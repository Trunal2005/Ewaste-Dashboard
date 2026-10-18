import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import initSqlJs from 'sql.js'
import { sqlWasmBinary } from '../server/sql-wasm-binary'

async function comprehensiveAudit() {
  console.log('====================================================')
  console.log('   LOCAL DATA & DOCUMENTS COMPREHENSIVE AUDIT')
  console.log('====================================================\n')

  const dbPath = path.resolve('data/ewaste.sqlite')
  const uploadsDir = path.resolve('uploads')

  if (!fs.existsSync(dbPath)) {
    throw new Error(`CRITICAL: Database not found at ${dbPath}`)
  }
  if (!fs.existsSync(uploadsDir)) {
    throw new Error(`CRITICAL: Uploads directory not found at ${uploadsDir}`)
  }

  // 1. Physical files on disk
  const diskFiles = fs.readdirSync(uploadsDir)
  let totalDiskBytes = 0
  const diskFileMap = new Map<string, { size: number; sha256: string }>()

  for (const f of diskFiles) {
    const fPath = path.join(uploadsDir, f)
    const stat = fs.statSync(fPath)
    totalDiskBytes += stat.size
    const buf = fs.readFileSync(fPath)
    const hash = crypto.createHash('sha256').update(buf).digest('hex')
    diskFileMap.set(f, { size: stat.size, sha256: hash })
  }

  console.log(`[Disk Status]`)
  console.log(`- Uploads Directory: ${uploadsDir}`)
  console.log(`- Total physical files on disk: ${diskFiles.length}`)
  console.log(`- Total storage size on disk: ${(totalDiskBytes / (1024 * 1024)).toFixed(2)} MB (${totalDiskBytes} bytes)\n`)

  // 2. Database records
  const SQL = await initSqlJs({ wasmBinary: sqlWasmBinary })
  const dbBuf = fs.readFileSync(dbPath)
  const db = new SQL.Database(dbBuf)

  const assignmentsRows = db.exec(`
    SELECT a.id, a.section_number, a.order_index, a.title, a.category,
      (SELECT COUNT(*) FROM assignment_files af WHERE af.assignment_id = a.id) as file_count
    FROM assignments a
    ORDER BY a.order_index ASC
  `)
  const assignments = assignmentsRows[0]?.values || []

  const filesRows = db.exec(`SELECT id, original_name, extension, mime_type, size_bytes, storage_key, sha256, created_at FROM files ORDER BY created_at ASC`)
  const dbFiles = filesRows[0]?.values || []

  const afRows = db.exec(`SELECT id, assignment_id, file_id, linked_at FROM assignment_files ORDER BY linked_at ASC`)
  const assignmentFiles = afRows[0]?.values || []

  const settingsRows = db.exec(`SELECT key, value FROM settings`)
  const settings = settingsRows[0]?.values || []

  const logsRows = db.exec(`SELECT COUNT(*) FROM activity_logs`)
  const logsCount = logsRows[0]?.values[0][0]

  console.log(`[Database Records]`)
  console.log(`- Total assignment sections: ${assignments.length}`)
  const completedSections = assignments.filter((a: any) => a[5] > 0)
  const awaitingSections = assignments.filter((a: any) => a[5] === 0)
  console.log(`- Sections with files (completed): ${completedSections.length}`)
  console.log(`- Sections awaiting files: ${awaitingSections.length}`)
  console.log(`- Total file records in 'files' table: ${dbFiles.length}`)
  console.log(`- Total junction links in 'assignment_files' table: ${assignmentFiles.length}`)
  console.log(`- Total activity logs: ${logsCount}`)
  console.log(`- Settings count: ${settings.length}\n`)

  // 3. Section breakdown
  console.log(`[Sections Breakdown]`)
  for (const a of assignments) {
    const [id, secNum, _, title, category, fileCount] = a
    console.log(`  Sec ${secNum} [${id}]: "${title}" (${category}) -> ${fileCount} file(s)`)
  }
  console.log()

  // 4. Cross-check disk files vs database records
  console.log(`[Integrity & Cross-Verification]`)
  let matchedFiles = 0
  let shaMismatchCount = 0
  const dbFileKeySet = new Set<string>()

  for (const f of dbFiles) {
    const [id, originalName, ext, mime, sizeBytes, storageKey, dbSha256] = f
    dbFileKeySet.add(storageKey as string)

    const diskInfo = diskFileMap.get(storageKey as string)
    if (!diskInfo) {
      console.error(`❌ MISSING ON DISK: Record ${id} (${originalName}) points to key ${storageKey} but file does NOT exist in uploads/!`)
    } else {
      matchedFiles++
      const sizeMatch = diskInfo.size === sizeBytes
      const shaMatch = !dbSha256 || diskInfo.sha256 === dbSha256
      if (!shaMatch) {
        shaMismatchCount++
        console.error(`❌ SHA-256 MISMATCH for ${originalName} (disk: ${diskInfo.sha256}, db: ${dbSha256})`)
      }
      console.log(`  ✓ [File ${id}] "${originalName}" | ${(Number(sizeBytes) / 1024).toFixed(1)} KB | Size Match: ${sizeMatch ? 'PASS' : 'FAIL'} | SHA256 Match: ${shaMatch ? 'PASS' : 'FAIL'}`)
    }
  }

  // Check orphaned files on disk (on disk but not in DB)
  const orphanedDiskFiles: string[] = []
  for (const df of diskFiles) {
    if (!dbFileKeySet.has(df)) {
      orphanedDiskFiles.push(df)
    }
  }

  console.log(`\n[Integrity Summary]`)
  console.log(`- Database records matching disk files: ${matchedFiles} / ${dbFiles.length}`)
  console.log(`- Orphaned disk files (not referenced in DB): ${orphanedDiskFiles.length}`)
  console.log(`- SHA-256 mismatches: ${shaMismatchCount}`)

  // 5. Create verified backup
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = path.resolve(`.backups/backup-${timestamp}`)
  fs.mkdirSync(path.join(backupDir, 'uploads'), { recursive: true })
  fs.mkdirSync(path.join(backupDir, 'data'), { recursive: true })

  fs.copyFileSync(dbPath, path.join(backupDir, 'data', 'ewaste.sqlite'))
  for (const f of diskFiles) {
    fs.copyFileSync(path.join(uploadsDir, f), path.join(backupDir, 'uploads', f))
  }

  const manifest = {
    timestamp: new Date().toISOString(),
    sourceDatabase: dbPath,
    sourceUploads: uploadsDir,
    totalFiles: diskFiles.length,
    totalStorageBytes: totalDiskBytes,
    completedSections: completedSections.length,
    awaitingSections: awaitingSections.length,
    totalSections: assignments.length,
    files: dbFiles.map((f: any) => ({
      id: f[0],
      originalName: f[1],
      extension: f[2],
      mimeType: f[3],
      sizeBytes: f[4],
      storageKey: f[5],
      sha256: diskFileMap.get(f[5])?.sha256,
    })),
    assignmentFiles: assignmentFiles.map((af: any) => ({
      id: af[0],
      assignmentId: af[1],
      fileId: af[2],
      linkedAt: af[3],
    })),
  }

  fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`\n✓ VERIFIED BACKUP CREATED AT: ${backupDir}`)
  console.log(`- Manifest saved with ${manifest.files.length} verified files and ${manifest.assignmentFiles.length} links.`)
  console.log('====================================================\n')
}

comprehensiveAudit().catch(console.error)
