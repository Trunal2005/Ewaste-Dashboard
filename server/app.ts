import express, { Request, Response } from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import crypto from 'crypto'
import fs from 'fs'
import { db } from './db'
import { createStorageAdapter, hasBlobStorageConfigured } from './storage/storage-adapter'

const app = express()

app.use(cors())
app.use(express.json())

// Setup Persistent Storage Adapter (Private Vercel Blob or Local Disk)
const storageAdapter = createStorageAdapter()

// Admin Passcode / Key for Owner Edit Access (protects public professor submission)
const ADMIN_KEY = process.env.ADMIN_KEY || ''

export function requireAdmin(req: Request, res: Response, next: () => void) {
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL)

  // In production, fail closed if ADMIN_KEY is missing or empty
  if (isProd && !ADMIN_KEY) {
    return res.status(403).json({
      error: 'Write operations are locked in production. Owner ADMIN_KEY must be configured.',
      readOnly: true,
    })
  }

  // In local development without ADMIN_KEY, allow open access
  if (!isProd && !ADMIN_KEY) return next()

  const providedKey = req.headers['x-admin-key'] || req.query.adminKey
  if (providedKey && providedKey === ADMIN_KEY) {
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

let isInitialized = false
export async function initBackend(): Promise<void> {
  if (isInitialized) return
  await db.init()
  isInitialized = true
}

// Router to handle both /api/... and /...
const apiRouter = express.Router()

// ==================== OVERVIEW & STATS ====================
apiRouter.get('/overview', async (_req: Request, res: Response) => {
  try {
    const assignments = await db.queryAll(`
      SELECT a.*, 
        (SELECT COUNT(*) FROM assignment_files af WHERE af.assignment_id = a.id) as file_count
      FROM assignments a
      ORDER BY a.order_index ASC
    `)

    const totalSections = assignments.length
    const sectionsWithFiles = assignments.filter((a: any) => Number(a.file_count) > 0).length
    const sectionsAwaitingFiles = totalSections - sectionsWithFiles
    const progressPercent = totalSections > 0 ? Math.round((sectionsWithFiles / totalSections) * 100) : 0

    const filesCount = await db.queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM files')
    const totalFiles = Number(filesCount?.cnt || 0)

    const nextEmpty = assignments.find((a: any) => Number(a.file_count) === 0) || null

    const recentUploads = await db.queryAll(`
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

    const settingsRows = await db.queryAll('SELECT key, value FROM settings')
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
apiRouter.get('/settings', async (_req: Request, res: Response) => {
  try {
    const rows = await db.queryAll('SELECT key, value FROM settings')
    const settings: Record<string, string> = {}
    for (const row of rows) {
      settings[row.key] = row.value || ''
    }
    res.json(settings)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

apiRouter.patch('/settings', requireAdmin, async (req: Request, res: Response) => {
  try {
    const updates = req.body
    for (const [key, value] of Object.entries(updates)) {
      await db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?', [
        key,
        String(value),
        String(value),
      ])
    }
    await db.logActivity('UPDATE_SETTINGS', 'Updated portfolio student metadata and configuration', 'settings')
    res.json({ success: true, message: 'Settings saved successfully' })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// ==================== ASSIGNMENTS ====================
apiRouter.get('/assignments', async (_req: Request, res: Response) => {
  try {
    const assignments = await db.queryAll('SELECT * FROM assignments ORDER BY order_index ASC')

    const allFiles = await db.queryAll(`
      SELECT f.*, af.assignment_id, af.linked_at
      FROM files f
      JOIN assignment_files af ON f.id = af.file_id
      ORDER BY af.linked_at ASC
    `)

    const filesByAssignment = new Map<string, any[]>()
    for (const f of allFiles) {
      const list = filesByAssignment.get(f.assignment_id) || []
      list.push(f)
      filesByAssignment.set(f.assignment_id, list)
    }

    const result = assignments.map((assignment: any) => {
      const files = filesByAssignment.get(assignment.id) || []
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

apiRouter.get('/assignments/:id', async (req: Request, res: Response) => {
  try {
    const assignment = await db.queryOne('SELECT * FROM assignments WHERE id = ?', [req.params.id])
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' })
    }

    const files = await db.queryAll(`
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

apiRouter.patch('/assignments/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id
    const existing = await db.queryOne('SELECT * FROM assignments WHERE id = ?', [id])
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

    await db.run(`
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

    await db.logActivity(
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
apiRouter.get('/files', async (req: Request, res: Response) => {
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

    let rows = await db.queryAll(sql, params)

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
            sectionNumber: Number(f.assignment_sections?.split('|||')[idx] || 0),
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
apiRouter.post('/upload', requireAdmin, upload.array('files', 10), async (req: Request, res: Response) => {
  try {
    const rawFiles = req.files as Express.Multer.File[]
    if (!rawFiles || rawFiles.length === 0) {
      return res.status(400).json({ error: 'No files provided for upload' })
    }

    const assignmentId = req.body.assignmentId as string | undefined
    let targetAssignment: any = null
    if (assignmentId) {
      targetAssignment = await db.queryOne('SELECT * FROM assignments WHERE id = ?', [assignmentId])
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

      // Save via persistent storage adapter (Private Vercel Blob or local)
      await storageAdapter.save(file.buffer, internalId, file.originalname)

      // Store in files table
      await db.run(`
        INSERT INTO files (id, original_name, extension, mime_type, size_bytes, storage_key, sha256, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [internalId, file.originalname, ext, mimeType, sizeBytes, internalId, sha256, now])

      // Link to assignment if requested
      if (assignmentId) {
        const linkId = `link-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`
        await db.run(`
          INSERT INTO assignment_files (id, assignment_id, file_id, linked_at)
          VALUES (?, ?, ?, ?)
        `, [linkId, assignmentId, internalId, now])
      }

      const logMsg = assignmentId
        ? `Uploaded "${file.originalname}" (${(sizeBytes / 1024).toFixed(1)} KB) to Section ${targetAssignment?.section_number}: ${targetAssignment?.title}`
        : `Uploaded "${file.originalname}" to File Library`

      await db.logActivity('UPLOAD', logMsg, internalId)

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

// Link existing file to another section
apiRouter.post('/assignments/:id/link-file', requireAdmin, async (req: Request, res: Response) => {
  try {
    const assignmentId = req.params.id
    const { fileId } = req.body

    const assignment = await db.queryOne('SELECT * FROM assignments WHERE id = ?', [assignmentId])
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' })

    const file = await db.queryOne('SELECT * FROM files WHERE id = ?', [fileId])
    if (!file) return res.status(404).json({ error: 'File not found' })

    const existingLink = await db.queryOne(
      'SELECT * FROM assignment_files WHERE assignment_id = ? AND file_id = ?',
      [assignmentId, fileId]
    )

    if (existingLink) {
      return res.status(400).json({ error: 'File is already linked to this assignment section' })
    }

    const linkId = `link-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`
    const now = new Date().toISOString()

    await db.run(
      'INSERT INTO assignment_files (id, assignment_id, file_id, linked_at) VALUES (?, ?, ?, ?)',
      [linkId, assignmentId, fileId, now]
    )

    await db.logActivity(
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
apiRouter.delete('/assignments/:id/files/:fileId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id: assignmentId, fileId } = req.params

    const assignment = await db.queryOne('SELECT * FROM assignments WHERE id = ?', [assignmentId])
    const file = await db.queryOne('SELECT * FROM files WHERE id = ?', [fileId])

    await db.run(
      'DELETE FROM assignment_files WHERE assignment_id = ? AND file_id = ?',
      [assignmentId, fileId]
    )

    await db.logActivity(
      'UNLINK_FILE',
      `Unlinked "${file?.original_name || fileId}" from Section ${assignment?.section_number || assignmentId}`,
      assignmentId
    )

    res.json({ success: true, message: 'File removed from assignment section' })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Delete file completely from all assignments and delete from storage
apiRouter.delete('/files/:fileId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const fileId = req.params.fileId
    const file = await db.queryOne('SELECT * FROM files WHERE id = ?', [fileId])
    if (!file) return res.status(404).json({ error: 'File not found' })

    // Delete from DB
    await db.run('DELETE FROM assignment_files WHERE file_id = ?', [fileId])
    await db.run('DELETE FROM files WHERE id = ?', [fileId])

    // Delete from storage adapter
    await storageAdapter.delete(file.storage_key || fileId)

    await db.logActivity('DELETE_FILE', `Permanently deleted file "${file.original_name}"`, fileId)

    res.json({ success: true, message: 'File deleted permanently' })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Download original file - EXACT BYTES & ORIGINAL FILENAME PRESERVED
apiRouter.get('/files/:fileId/download', async (req: Request, res: Response) => {
  try {
    const fileId = req.params.fileId
    const file = await db.queryOne('SELECT * FROM files WHERE id = ?', [fileId])
    if (!file) return res.status(404).send('File not found')

    const exists = await storageAdapter.exists(file.storage_key || fileId)
    if (!exists) return res.status(404).send('File content not found')

    const buffer = await storageAdapter.read(file.storage_key || fileId)

    // Encode original name properly for RFC 5987 / HTTP headers
    const safeEncodedName = encodeURIComponent(file.original_name).replace(/['()]/g, escape)
    res.setHeader('Content-Disposition', `attachment; filename="${file.original_name.replace(/"/g, '')}"; filename*=UTF-8''${safeEncodedName}`)
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream')
    res.setHeader('Content-Length', buffer.length)

    res.send(buffer)
  } catch (error: any) {
    res.status(500).send(error.message)
  }
})

// View file inline (PDF, Image, Audio, Video)
apiRouter.get('/files/:fileId/view', async (req: Request, res: Response) => {
  try {
    const fileId = req.params.fileId
    const file = await db.queryOne('SELECT * FROM files WHERE id = ?', [fileId])
    if (!file) return res.status(404).send('File not found')

    const exists = await storageAdapter.exists(file.storage_key || fileId)
    if (!exists) return res.status(404).send('File content not found')

    const buffer = await storageAdapter.read(file.storage_key || fileId)

    res.setHeader('Content-Type', file.mime_type || getMimeType(file.original_name))
    res.setHeader('Content-Disposition', `inline; filename="${file.original_name.replace(/"/g, '')}"`)
    res.setHeader('Content-Length', buffer.length)

    res.send(buffer)
  } catch (error: any) {
    res.status(500).send(error.message)
  }
})

// Isolated Sandboxed HTML viewer
apiRouter.get('/files/:fileId/sandbox-html', async (req: Request, res: Response) => {
  try {
    const fileId = req.params.fileId
    const file = await db.queryOne('SELECT * FROM files WHERE id = ?', [fileId])
    if (!file) return res.status(404).send('File not found')

    const exists = await storageAdapter.exists(file.storage_key || fileId)
    if (!exists) return res.status(404).send('File not found')

    const buffer = await storageAdapter.read(file.storage_key || fileId)
    const content = buffer.toString('utf-8')

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Content-Security-Policy', "sandbox allow-scripts; default-src 'self' 'unsafe-inline' data: blob:; script-src 'unsafe-inline' 'unsafe-eval' *; connect-src *;")
    res.setHeader('X-Frame-Options', 'SAMEORIGIN')
    res.send(content)
  } catch (error: any) {
    res.status(500).send(error.message)
  }
})

// ==================== ACTIVITY TIMELINE ====================
apiRouter.get('/activity', async (_req: Request, res: Response) => {
  try {
    const activities = await db.queryAll('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 50')
    res.json(activities)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Reset uploaded files to honest zero state (BLOCKED IN PRODUCTION TO PREVENT ACADEMIC DATA LOSS)
apiRouter.post('/reset', requireAdmin, async (_req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL)) {
    return res.status(403).json({
      error: 'Portfolio reset is permanently disabled in production mode to protect academic files.',
    })
  }

  try {
    await db.run('DELETE FROM assignment_files')
    await db.run('DELETE FROM files')
    await db.run('DELETE FROM activity_logs')
    await db.run('UPDATE assignments SET notes = ""')

    await db.logActivity('SYSTEM_RESET', 'Portfolio reset to honest initial state with 0 files', 'system')
    res.json({ success: true, message: 'Reset to initial honest zero state successfully' })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Sync individual file to persistent storage
apiRouter.post(
  '/admin/sync-file',
  requireAdmin,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const file = req.file
      const filename = (req.body.filename || file?.originalname) as string
      if (!file || !filename) {
        return res.status(400).json({ error: 'File and filename are required' })
      }

      await storageAdapter.save(file.buffer, filename, filename)
      res.json({ success: true, message: `File ${filename} synced successfully` })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
)

// Health check
apiRouter.get('/health', async (_req: Request, res: Response) => {
  const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
  const hasBlob = hasBlobStorageConfigured()
  const isTurso = db.isTurso()

  const localDbPath = path.resolve(process.cwd(), 'data', 'ewaste.sqlite')
  const durable = isTurso || (!isVercel && fs.existsSync(localDbPath))

  let storageType = 'Local persistent disk storage'
  let databaseType = db.getType()

  if (isVercel) {
    if (hasBlob) {
      storageType = 'Vercel Blob Object Storage (Private)'
    } else {
      storageType = 'Ephemeral Serverless (/tmp) — Vercel Blob Not Connected'
    }
  }

  const assignments = await db.queryAll(
    'SELECT id, (SELECT COUNT(*) FROM assignment_files af WHERE af.assignment_id = assignments.id) as cnt FROM assignments'
  )
  const filesCount = await db.queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM files')
  const sectionsWithFiles = assignments.filter((a: any) => Number(a.cnt) > 0).length
  const sectionsAwaitingFiles = assignments.length - sectionsWithFiles

  res.json({
    status: 'ok',
    durable,
    storage: storageType,
    database: databaseType,
    totalSections: assignments.length,
    sectionsWithFiles,
    sectionsAwaitingFiles,
    totalFiles: Number(filesCount?.cnt || 0),
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    readOnlyMode: Boolean(ADMIN_KEY),
    isVercel,
    hasBlobToken: hasBlob,
    hasTursoDatabase: isTurso,
  })
})

// Mount apiRouter on BOTH '/api' and '/'
app.use('/api', apiRouter)
app.use('/', apiRouter)

export default app
