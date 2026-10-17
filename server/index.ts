import express, { Request, Response } from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import crypto from 'crypto'
import fs from 'fs'
import { db } from './db'
import { LocalDiskStorageAdapter } from './storage/storage-adapter'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Setup Persistent Storage Adapter
const uploadsDir = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads')
const storageAdapter = new LocalDiskStorageAdapter(uploadsDir)

// Admin Passcode / Key for Owner Edit Access (protects public professor submission)
const ADMIN_KEY = process.env.ADMIN_KEY || ''

export function requireAdmin(req: Request, res: Response, next: () => void) {
  // In development without ADMIN_KEY set, allow open access
  if (!ADMIN_KEY) return next()

  const providedKey = req.headers['x-admin-key'] || req.query.adminKey
  if (providedKey === ADMIN_KEY) {
    return next()
  }

  return res.status(403).json({
    error: 'Academic presentation mode is active (read-only). Owner authorization is required to modify or upload submissions.',
    readOnly: true,
  })
}

// Multer memory storage so we can route files through the storage adapter
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
})

// Mime types helper
function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  const mimeMap: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.csv': 'text/csv',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.txt': 'text/plain',
  }
  return mimeMap[ext] || 'application/octet-stream'
}

// ==================== OVERVIEW & STATS ====================
app.get('/api/overview', (_req: Request, res: Response) => {
  try {
    const assignments = db.queryAll(`
      SELECT a.*, 
        (SELECT COUNT(*) FROM assignment_files af WHERE af.assignment_id = a.id) as file_count
      FROM assignments a
      ORDER BY a.order_index ASC
    `)

    const totalSections = assignments.length
    const sectionsWithFiles = assignments.filter((a: any) => a.file_count > 0).length
    const sectionsAwaitingFiles = totalSections - sectionsWithFiles
    const progressPercent = totalSections > 0 ? Math.round((sectionsWithFiles / totalSections) * 100) : 0

    const filesCount = db.queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM files')
    const totalFiles = filesCount?.cnt || 0

    const nextEmpty = assignments.find((a: any) => a.file_count === 0) || null

    const recentUploads = db.queryAll(`
      SELECT f.*, 
        GROUP_CONCAT(a.title, '|||') as assignment_titles,
        GROUP_CONCAT(a.id, '|||') as assignment_ids
      FROM files f
      LEFT JOIN assignment_files af ON f.id = af.file_id
      LEFT JOIN assignments a ON af.assignment_id = a.id
      GROUP BY f.id
      ORDER BY f.created_at DESC
      LIMIT 6
    `)

    const settingsRows = db.queryAll('SELECT key, value FROM settings')
    const settings: Record<string, string> = {}
    for (const row of settingsRows) {
      settings[row.key] = row.value || ''
    }

    res.json({
      totalSections,
      sectionsWithFiles,
      sectionsAwaitingFiles,
      totalFiles,
      progressPercent,
      nextEmptySection: nextEmpty,
      recentUploads: recentUploads.map((f: any) => ({
        ...f,
        assignments: f.assignment_titles
          ? f.assignment_titles.split('|||').map((title: string, idx: number) => ({
              id: f.assignment_ids.split('|||')[idx],
              title,
            }))
          : [],
      })),
      settings,
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// ==================== SETTINGS ====================
app.get('/api/settings', (_req: Request, res: Response) => {
  try {
    const rows = db.queryAll('SELECT key, value FROM settings')
    const settings: Record<string, string> = {}
    for (const row of rows) {
      settings[row.key] = row.value || ''
    }
    res.json(settings)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.patch('/api/settings', requireAdmin, (req: Request, res: Response) => {
  try {
    const updates = req.body
    for (const [key, value] of Object.entries(updates)) {
      db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?', [
        key,
        String(value),
        String(value),
      ])
    }
    db.logActivity('UPDATE_SETTINGS', 'Updated portfolio student metadata and configuration', 'settings')
    res.json({ success: true, message: 'Settings saved successfully' })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// ==================== ASSIGNMENTS ====================
app.get('/api/assignments', (_req: Request, res: Response) => {
  try {
    const assignments = db.queryAll('SELECT * FROM assignments ORDER BY order_index ASC')

    const result = assignments.map((assignment: any) => {
      const files = db.queryAll(`
        SELECT f.*, af.linked_at
        FROM files f
        JOIN assignment_files af ON f.id = af.file_id
        WHERE af.assignment_id = ?
        ORDER BY af.linked_at ASC
      `, [assignment.id])

      return {
        ...assignment,
        expected_files: JSON.parse(assignment.expected_files || '[]'),
        files,
        file_count: files.length,
      }
    })

    res.json(result)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/assignments/:id', (req: Request, res: Response) => {
  try {
    const assignment = db.queryOne('SELECT * FROM assignments WHERE id = ?', [req.params.id])
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' })
    }

    const files = db.queryAll(`
      SELECT f.*, af.linked_at
      FROM files f
      JOIN assignment_files af ON f.id = af.file_id
      WHERE af.assignment_id = ?
      ORDER BY af.linked_at ASC
    `, [req.params.id])

    res.json({
      ...assignment,
      expected_files: JSON.parse(assignment.expected_files || '[]'),
      files,
      file_count: files.length,
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.patch('/api/assignments/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const id = req.params.id
    const existing = db.queryOne('SELECT * FROM assignments WHERE id = ?', [id])
    if (!existing) {
      return res.status(404).json({ error: 'Assignment not found' })
    }

    const {
      title,
      category,
      description,
      notes,
      due_date,
      state,
      class_label,
      order_index,
    } = req.body

    const now = new Date().toISOString()

    db.run(`
      UPDATE assignments SET
        title = COALESCE(?, title),
        category = COALESCE(?, category),
        description = COALESCE(?, description),
        notes = COALESCE(?, notes),
        due_date = COALESCE(?, due_date),
        state = COALESCE(?, state),
        class_label = COALESCE(?, class_label),
        order_index = COALESCE(?, order_index),
        updated_at = ?
      WHERE id = ?
    `, [
      title ?? null,
      category ?? null,
      description ?? null,
      notes ?? null,
      due_date ?? null,
      state ?? null,
      class_label ?? null,
      order_index ?? null,
      now,
      id,
    ])

    db.logActivity(
      'UPDATE_ASSIGNMENT',
      `Updated assignment details for section ${existing.section_number}: ${title || existing.title}`,
      id
    )

    res.json({ success: true, message: 'Assignment updated successfully' })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// ==================== FILES & UPLOAD ====================
app.get('/api/files', (req: Request, res: Response) => {
  try {
    const { search, format, assignmentId } = req.query as {
      search?: string
      format?: string
      assignmentId?: string
    }

    let sql = `
      SELECT f.*, 
        GROUP_CONCAT(a.title, '|||') as assignment_titles,
        GROUP_CONCAT(a.id, '|||') as assignment_ids,
        GROUP_CONCAT(a.section_number, '|||') as assignment_sections
      FROM files f
      LEFT JOIN assignment_files af ON f.id = af.file_id
      LEFT JOIN assignments a ON af.assignment_id = a.id
      WHERE 1=1
    `
    const params: (string | number)[] = []

    if (search && search.trim()) {
      sql += ' AND f.original_name LIKE ?'
      params.push(`%${search.trim()}%`)
    }

    if (assignmentId && assignmentId.trim()) {
      sql += ' AND af.assignment_id = ?'
      params.push(assignmentId.trim())
    }

    sql += ' GROUP BY f.id ORDER BY f.created_at DESC'

    let rows = db.queryAll(sql, params)

    if (format && format.trim()) {
      const fmt = format.trim().toLowerCase()
      rows = rows.filter((r: any) => {
        const ext = r.extension.toLowerCase().replace('.', '')
        if (fmt === 'docs' || fmt === 'document') {
          return ['pdf', 'docx', 'doc', 'txt', 'rtf'].includes(ext)
        }
        if (fmt === 'sheets' || fmt === 'excel') {
          return ['xlsx', 'xls', 'csv'].includes(ext)
        }
        if (fmt === 'slides' || fmt === 'presentation') {
          return ['pptx', 'ppt'].includes(ext)
        }
        if (fmt === 'images' || fmt === 'image') {
          return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)
        }
        if (fmt === 'media') {
          return ['mp3', 'wav', 'mp4', 'webm'].includes(ext)
        }
        if (fmt === 'code' || fmt === 'html') {
          return ['html', 'htm'].includes(ext)
        }
        return ext === fmt
      })
    }

    const result = rows.map((f: any) => ({
      ...f,
      assignments: f.assignment_titles
        ? f.assignment_titles.split('|||').map((title: string, idx: number) => ({
            id: f.assignment_ids.split('|||')[idx],
            sectionNumber: Number(f.assignment_sections.split('|||')[idx]),
            title,
          }))
        : [],
    }))

    res.json(result)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Upload single or multiple files
app.post('/api/upload', requireAdmin, upload.array('files', 10), async (req: Request, res: Response) => {
  try {
    const rawFiles = req.files as Express.Multer.File[]
    if (!rawFiles || rawFiles.length === 0) {
      return res.status(400).json({ error: 'No files provided for upload' })
    }

    const assignmentId = req.body.assignmentId as string | undefined
    let targetAssignment: any = null
    if (assignmentId) {
      targetAssignment = db.queryOne('SELECT * FROM assignments WHERE id = ?', [assignmentId])
      if (!targetAssignment) {
        return res.status(404).json({ error: 'Target assignment section not found' })
      }
    }

    const uploadedRecords: any[] = []

    for (const file of rawFiles) {
      const ext = path.extname(file.originalname).toLowerCase() || ''
      const internalId = `file-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`
      const mimeType = file.mimetype || getMimeType(file.originalname)
      const sizeBytes = file.size
      const now = new Date().toISOString()

      // Compute sha256 to ensure byte integrity
      const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex')

      // Save via persistent storage adapter
      await storageAdapter.save(file.buffer, internalId, file.originalname)

      // Store in SQLite files table
      db.run(`
        INSERT INTO files (id, original_name, extension, mime_type, size_bytes, storage_key, sha256, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [internalId, file.originalname, ext, mimeType, sizeBytes, internalId, sha256, now])

      // Link to assignment if requested
      if (assignmentId) {
        const linkId = `link-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`
        db.run(`
          INSERT INTO assignment_files (id, assignment_id, file_id, linked_at)
          VALUES (?, ?, ?, ?)
        `, [linkId, assignmentId, internalId, now])
      }

      const logMsg = assignmentId
        ? `Uploaded "${file.originalname}" (${(sizeBytes / 1024).toFixed(1)} KB) to Section ${targetAssignment?.section_number}: ${targetAssignment?.title}`
        : `Uploaded "${file.originalname}" to File Library`

      db.logActivity('UPLOAD', logMsg, internalId)

      uploadedRecords.push({
        id: internalId,
        original_name: file.originalname,
        extension: ext,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        created_at: now,
      })
    }

    res.json({
      success: true,
      message: `${uploadedRecords.length} file(s) stored persistently`,
      files: uploadedRecords,
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Link existing file to another section (e.g. link Section 4 files to Section 7 without duplicate storage)
app.post('/api/assignments/:id/link-file', requireAdmin, (req: Request, res: Response) => {
  try {
    const assignmentId = req.params.id
    const { fileId } = req.body

    const assignment = db.queryOne('SELECT * FROM assignments WHERE id = ?', [assignmentId])
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' })

    const file = db.queryOne('SELECT * FROM files WHERE id = ?', [fileId])
    if (!file) return res.status(404).json({ error: 'File not found' })

    const existingLink = db.queryOne(
      'SELECT * FROM assignment_files WHERE assignment_id = ? AND file_id = ?',
      [assignmentId, fileId]
    )

    if (existingLink) {
      return res.status(400).json({ error: 'File is already linked to this assignment section' })
    }

    const linkId = `link-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`
    const now = new Date().toISOString()

    db.run(
      'INSERT INTO assignment_files (id, assignment_id, file_id, linked_at) VALUES (?, ?, ?, ?)',
      [linkId, assignmentId, fileId, now]
    )

    db.logActivity(
      'LINK_FILE',
      `Linked existing file "${file.original_name}" to Section ${assignment.section_number}: ${assignment.title}`,
      assignmentId
    )

    res.json({ success: true, message: 'File linked successfully without duplicating storage' })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Unlink file from assignment
app.delete('/api/assignments/:id/files/:fileId', requireAdmin, (req: Request, res: Response) => {
  try {
    const { id: assignmentId, fileId } = req.params

    const assignment = db.queryOne('SELECT * FROM assignments WHERE id = ?', [assignmentId])
    const file = db.queryOne('SELECT * FROM files WHERE id = ?', [fileId])

    db.run(
      'DELETE FROM assignment_files WHERE assignment_id = ? AND file_id = ?',
      [assignmentId, fileId]
    )

    db.logActivity(
      'UNLINK_FILE',
      `Unlinked "${file?.original_name || fileId}" from Section ${assignment?.section_number || assignmentId}`,
      assignmentId
    )

    res.json({ success: true, message: 'File removed from assignment section' })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Delete file completely from all assignments and delete from storage disk
app.delete('/api/files/:fileId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const fileId = req.params.fileId
    const file = db.queryOne('SELECT * FROM files WHERE id = ?', [fileId])
    if (!file) return res.status(404).json({ error: 'File not found' })

    // Delete from DB (cascades or delete links)
    db.run('DELETE FROM assignment_files WHERE file_id = ?', [fileId])
    db.run('DELETE FROM files WHERE id = ?', [fileId])

    // Delete from storage adapter
    await storageAdapter.delete(file.storage_key || fileId)

    db.logActivity('DELETE_FILE', `Permanently deleted file "${file.original_name}"`, fileId)

    res.json({ success: true, message: 'File deleted permanently' })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Download original file - EXACT BYTES & ORIGINAL FILENAME PRESERVED
app.get('/api/files/:fileId/download', async (req: Request, res: Response) => {
  try {
    const fileId = req.params.fileId
    const file = db.queryOne('SELECT * FROM files WHERE id = ?', [fileId])
    if (!file) return res.status(404).send('File not found')

    const exists = await storageAdapter.exists(file.storage_key || fileId)
    if (!exists) return res.status(404).send('File content not found on disk')

    const filePath = storageAdapter.getFilePath(file.storage_key || fileId)

    // Encode original name properly for RFC 5987 / HTTP headers
    const safeEncodedName = encodeURIComponent(file.original_name).replace(/['()]/g, escape)
    res.setHeader('Content-Disposition', `attachment; filename="${file.original_name.replace(/"/g, '')}"; filename*=UTF-8''${safeEncodedName}`)
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream')
    res.setHeader('Content-Length', file.size_bytes)

    const readStream = fs.createReadStream(filePath)
    readStream.pipe(res)
  } catch (error: any) {
    res.status(500).send(error.message)
  }
})

// View file inline (PDF, Image, Audio, Video)
app.get('/api/files/:fileId/view', async (req: Request, res: Response) => {
  try {
    const fileId = req.params.fileId
    const file = db.queryOne('SELECT * FROM files WHERE id = ?', [fileId])
    if (!file) return res.status(404).send('File not found')

    const exists = await storageAdapter.exists(file.storage_key || fileId)
    if (!exists) return res.status(404).send('File content not found on disk')

    const filePath = storageAdapter.getFilePath(file.storage_key || fileId)
    res.setHeader('Content-Type', file.mime_type || getMimeType(file.original_name))
    res.setHeader('Content-Disposition', `inline; filename="${file.original_name.replace(/"/g, '')}"`)

    const readStream = fs.createReadStream(filePath)
    readStream.pipe(res)
  } catch (error: any) {
    res.status(500).send(error.message)
  }
})

// Isolated Sandboxed HTML viewer: safe execution without cookies or app storage access
app.get('/api/files/:fileId/sandbox-html', async (req: Request, res: Response) => {
  try {
    const fileId = req.params.fileId
    const file = db.queryOne('SELECT * FROM files WHERE id = ?', [fileId])
    if (!file) return res.status(404).send('File not found')

    const exists = await storageAdapter.exists(file.storage_key || fileId)
    if (!exists) return res.status(404).send('File not found on disk')

    const filePath = storageAdapter.getFilePath(file.storage_key || fileId)
    const content = await fs.promises.readFile(filePath, 'utf-8')

    // Set restrictive CSP headers to isolate the preview
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Content-Security-Policy', "sandbox allow-scripts; default-src 'self' 'unsafe-inline' data: blob:; script-src 'unsafe-inline' 'unsafe-eval' *; connect-src *;")
    res.setHeader('X-Frame-Options', 'SAMEORIGIN')
    res.send(content)
  } catch (error: any) {
    res.status(500).send(error.message)
  }
})

// ==================== ACTIVITY TIMELINE ====================
app.get('/api/activity', (_req: Request, res: Response) => {
  try {
    const activities = db.queryAll('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 50')
    res.json(activities)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Reset uploaded files to honest zero state (BLOCKED IN PRODUCTION TO PREVENT ACADEMIC DATA LOSS)
app.post('/api/reset', requireAdmin, async (_req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      error: 'Portfolio reset is permanently disabled in production mode to protect academic files.',
    })
  }

  try {
    db.run('DELETE FROM assignment_files')
    db.run('DELETE FROM files')
    db.run('DELETE FROM activity_logs')
    db.run('UPDATE assignments SET notes = ""')
    
    // Clean uploads directory
    if (fs.existsSync(uploadsDir)) {
      const existing = fs.readdirSync(uploadsDir)
      for (const f of existing) {
        fs.unlinkSync(path.join(uploadsDir, f))
      }
    }
    
    db.logActivity('SYSTEM_RESET', 'Portfolio reset to honest initial state with 0 files', 'system')
    res.json({ success: true, message: 'Reset to initial honest zero state successfully' })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Secure production data migration endpoint (reloads database and populates uploads on persistent volume)
app.post(
  '/api/admin/sync-snapshot',
  requireAdmin,
  upload.fields([
    { name: 'db', maxCount: 1 },
    { name: 'files', maxCount: 100 },
  ]),
  async (req: Request, res: Response) => {
    try {
      const filesMap = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined
      if (!filesMap) {
        return res.status(400).json({ error: 'No files provided for snapshot sync' })
      }

      const dbFiles = filesMap['db']
      const contentFiles = filesMap['files'] || []

      // 1. Write SQLite DB
      if (dbFiles && dbFiles.length > 0) {
        const dbFile = dbFiles[0]
        const dbTarget = process.env.DB_PATH || path.resolve(process.cwd(), 'data', 'ewaste.sqlite')
        const targetDir = path.dirname(dbTarget)
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })
        await fs.promises.writeFile(dbTarget, dbFile.buffer)
        await db.reload()
        console.log(`[EWEM Server] SQLite database reloaded from snapshot (${dbFile.buffer.length} bytes)`)
      }

      // 2. Write uploaded content files
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
      let filesWritten = 0
      for (const f of contentFiles) {
        const internalId = path.basename(f.originalname)
        await storageAdapter.save(f.buffer, internalId, internalId)
        filesWritten++
      }

      console.log(`[EWEM Server] Successfully restored ${filesWritten} files to persistent storage`)

      // Return verification metrics
      const assignments = db.queryAll(
        'SELECT id, (SELECT COUNT(*) FROM assignment_files af WHERE af.assignment_id = assignments.id) as cnt FROM assignments'
      )
      const filesCount = db.queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM files')
      const sectionsWithFiles = assignments.filter((a: any) => a.cnt > 0).length

      res.json({
        success: true,
        message: 'Production snapshot sync completed successfully',
        filesWritten,
        databaseStats: {
          totalSections: assignments.length,
          sectionsWithFiles,
          totalFiles: filesCount?.cnt || 0,
        },
      })
    } catch (err: any) {
      console.error('[EWEM Server] Error syncing snapshot:', err)
      res.status(500).json({ error: err.message })
    }
  }
)

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    storage: 'Local persistent SQLite + disk storage',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    readOnlyMode: Boolean(ADMIN_KEY),
  })
})

// Serve static Vite client bundle in production
const distPath = path.resolve(process.cwd(), 'dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.use((req: Request, res: Response, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      return res.sendFile(path.join(distPath, 'index.html'))
    }
    next()
  })
}

// Start server
async function start() {
  await db.init()
  app.listen(PORT, () => {
    console.log(`[EWEM Server] Backend running at http://localhost:${PORT}`)
    console.log(`[EWEM Server] Persistent uploads directory: ${uploadsDir}`)
  })
}

start().catch((err) => {
  console.error('[EWEM Server] Failed to start:', err)
})
