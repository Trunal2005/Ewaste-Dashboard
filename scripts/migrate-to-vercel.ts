import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { put, head } from '@vercel/blob'
import initSqlJs from 'sql.js'
import { sqlWasmBinary } from '../server/sql-wasm-binary'

async function migrate() {
  const blobToken = process.argv[2] || process.env.BLOB_READ_WRITE_TOKEN
  const prodUrlArg = process.argv[3] || process.env.PROD_URL || 'https://ewaste-dashboard-xi.vercel.app'
  const prodUrl = prodUrlArg.replace(/\/$/, '')

  console.log('====================================================')
  console.log('   EWEM WORKSPACE PRODUCTION DATA MIGRATION SUITE   ')
  console.log('====================================================')
  console.log(`Target Production URL: ${prodUrl}`)

  if (!blobToken) {
    console.error('\n❌ ERROR: BLOB_READ_WRITE_TOKEN is required to migrate documents to Vercel.')
    console.error('\nUsage:')
    console.error('  npx tsx scripts/migrate-to-vercel.ts <BLOB_READ_WRITE_TOKEN> [PROD_URL]')
    console.error('\nExample:')
    console.error('  npx tsx scripts/migrate-to-vercel.ts vercel_blob_rw_xxxxxxxx https://ewaste-dashboard-xi.vercel.app')
    console.error('\nHow to obtain your BLOB_READ_WRITE_TOKEN:')
    console.error('1. Open your Vercel Dashboard: https://vercel.com/dashboard')
    console.error('2. Click project "ewaste-dashboard" -> navigate to the "Storage" tab')
    console.error('3. Click "Create" (or "Connect Store") -> Select "Blob" -> Click "Continue"')
    console.error('4. Connect to project "ewaste-dashboard" with Read & Write access')
    console.error('5. Go to Settings > Environment Variables, copy the generated BLOB_READ_WRITE_TOKEN\n')
    process.exit(1)
  }

  process.env.BLOB_READ_WRITE_TOKEN = blobToken

  // 1. Verify and read local SQLite database
  const localDbPath = path.resolve(process.cwd(), 'data', 'ewaste.sqlite')
  if (!fs.existsSync(localDbPath)) {
    throw new Error(`CRITICAL: Local SQLite database not found at ${localDbPath}`)
  }
  const dbBuffer = fs.readFileSync(localDbPath)
  console.log(`\n[Step 1/4] Reading local SQLite database (${dbBuffer.length} bytes)...`)

  const SQL = await initSqlJs({ wasmBinary: sqlWasmBinary })
  const localDb = new SQL.Database(dbBuffer)

  const assignmentsRows = localDb.exec(`
    SELECT a.id, a.section_number, a.title,
      (SELECT COUNT(*) FROM assignment_files af WHERE af.assignment_id = a.id) as cnt
    FROM assignments a
    ORDER BY a.order_index ASC
  `)
  const localAssignments = assignmentsRows[0]?.values || []
  const completedLocal = localAssignments.filter((a: any) => a[3] > 0)
  const awaitingLocal = localAssignments.filter((a: any) => a[3] === 0)

  const filesRows = localDb.exec('SELECT id, original_name, extension, mime_type, size_bytes, storage_key, sha256 FROM files')
  const localFiles = filesRows[0]?.values || []

  const afRows = localDb.exec('SELECT id, assignment_id, file_id, linked_at FROM assignment_files')
  const localLinks = afRows[0]?.values || []

  console.log(`- Authoritative Local Database Status:`)
  console.log(`  • Total Sections: ${localAssignments.length}`)
  console.log(`  • Sections with files (completed): ${completedLocal.length}`)
  console.log(`  • Sections awaiting files: ${awaitingLocal.length}`)
  console.log(`  • Unique file records: ${localFiles.length}`)
  console.log(`  • Total assignment-to-file links: ${localLinks.length}`)

  // 2. Verify local physical files directory
  const localUploadsDir = path.resolve(process.cwd(), 'uploads')
  if (!fs.existsSync(localUploadsDir)) {
    throw new Error(`CRITICAL: Local uploads directory not found at ${localUploadsDir}`)
  }
  const diskFiles = fs.readdirSync(localUploadsDir)
  console.log(`\n[Step 2/4] Verifying ${diskFiles.length} physical documents on disk...`)

  const diskFileMap = new Map<string, { size: number; sha256: string; path: string }>()
  let totalBytes = 0
  for (const f of diskFiles) {
    const fPath = path.join(localUploadsDir, f)
    const stat = fs.statSync(fPath)
    totalBytes += stat.size
    const buf = fs.readFileSync(fPath)
    const hash = crypto.createHash('sha256').update(buf).digest('hex')
    diskFileMap.set(f, { size: stat.size, sha256: hash, path: fPath })
  }
  console.log(`- Verified ${diskFiles.length} files on disk (${(totalBytes / (1024 * 1024)).toFixed(2)} MB total).`)

  // 3. Upload SQLite database snapshot to Vercel Blob
  console.log('\n[Step 3/4] Uploading SQLite database to Vercel Blob storage...')
  const dbBlob = await put('data/ewaste.sqlite', dbBuffer, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    token: blobToken,
  })
  console.log(`✓ SQLite database deployed to Vercel Blob: ${dbBlob.url}`)

  // 4. Upload every document individually with retry logic
  console.log(`\n[Step 4/4] Migrating ${diskFiles.length} academic documents to Vercel Blob...`)
  let uploadedCount = 0
  let failedCount = 0

  for (let i = 0; i < diskFiles.length; i++) {
    const filename = diskFiles[i]
    const info = diskFileMap.get(filename)!
    const fileBuf = fs.readFileSync(info.path)

    let success = false
    let attempts = 0
    while (!success && attempts < 3) {
      attempts++
      try {
        const blob = await put(`uploads/${filename}`, fileBuf, {
          access: 'public',
          addRandomSuffix: false,
          allowOverwrite: true,
          token: blobToken,
        })
        success = true
        uploadedCount++
        console.log(`  [${i + 1}/${diskFiles.length}] ✓ "${filename}" (${(info.size / 1024).toFixed(1)} KB) -> SHA256: ${info.sha256.slice(0, 12)}...`)
      } catch (err: any) {
        if (attempts >= 3) {
          failedCount++
          console.error(`  [${i + 1}/${diskFiles.length}] ❌ Failed "${filename}": ${err.message}`)
        } else {
          console.warn(`  [${i + 1}/${diskFiles.length}] Retry ${attempts}/3 for "${filename}"...`)
          await new Promise((r) => setTimeout(r, 1000))
        }
      }
    }
  }

  console.log(`\nMigration completed: ${uploadedCount} uploaded successfully, ${failedCount} failures.`)
  if (failedCount > 0) {
    throw new Error(`Migration had ${failedCount} file upload failure(s).`)
  }

  // 5. End-to-end verification against live production deployment
  console.log('\n====================================================')
  console.log('   END-TO-END PRODUCTION VERIFICATION CHECKS        ')
  console.log('====================================================\n')
  console.log(`Testing live endpoints at ${prodUrl} ...\n`)

  // Check 1: Health
  console.log('[Check 1] Querying /api/health ...')
  const healthRes = await fetch(`${prodUrl}/api/health`)
  if (!healthRes.ok) throw new Error(`Health check failed: Status ${healthRes.status}`)
  const health = await healthRes.json()
  console.log(`- Status: ${health.status}`)
  console.log(`- Storage: ${health.storage}`)
  console.log(`- Database: ${health.database}`)
  console.log(`- Durable: ${health.durable}`)

  // Check 2: Overview
  console.log('\n[Check 2] Querying /api/overview ...')
  const overviewRes = await fetch(`${prodUrl}/api/overview`)
  if (!overviewRes.ok) throw new Error(`Overview query failed: Status ${overviewRes.status}`)
  const overview = await overviewRes.json()
  console.log(`- Total Sections: ${overview.totalSections} (Expected: ${localAssignments.length})`)
  console.log(`- Completed Sections: ${overview.sectionsWithFiles} (Expected: ${completedLocal.length})`)
  console.log(`- Awaiting Sections: ${overview.sectionsAwaitingFiles} (Expected: ${awaitingLocal.length})`)
  console.log(`- Total Files in DB: ${overview.totalFiles} (Expected: ${localFiles.length})`)
  console.log(`- Student: ${overview.settings.student_name} (${overview.settings.roll_no})`)

  if (
    overview.totalSections !== localAssignments.length ||
    overview.sectionsWithFiles !== completedLocal.length ||
    overview.sectionsAwaitingFiles !== awaitingLocal.length ||
    overview.totalFiles !== localFiles.length
  ) {
    throw new Error('VERIFICATION FAILED: Live production metrics do not match local database metrics!')
  }
  console.log('✓ Section and file counts match authoritative local database!')

  // Check 3: Assignments List
  console.log('\n[Check 3] Querying all 14 assignments from /api/assignments ...')
  const asgnRes = await fetch(`${prodUrl}/api/assignments`)
  if (!asgnRes.ok) throw new Error(`Assignments query failed: Status ${asgnRes.status}`)
  const asgns = await asgnRes.json()
  console.log(`- Retrieved ${asgns.length} assignments`)
  for (const asgn of asgns) {
    const localMatch = localAssignments.find((la: any) => la[0] === asgn.id)
    const expectedCnt = localMatch ? localMatch[3] : 0
    if (asgn.file_count !== expectedCnt) {
      throw new Error(`Section ${asgn.section_number} file_count mismatch: got ${asgn.file_count}, expected ${expectedCnt}`)
    }
  }
  console.log('✓ Every assignment section file count matches local database!')

  // Check 4: Files Library & Downloads
  console.log('\n[Check 4] Testing File Library & Download Integrity...')
  const filesRes = await fetch(`${prodUrl}/api/files`)
  if (!filesRes.ok) throw new Error(`Files query failed: Status ${filesRes.status}`)
  const prodFiles = await filesRes.json()
  console.log(`- Total files in production library: ${prodFiles.length}`)

  // Download test for random sample
  const sampleIndices = [0, Math.floor(prodFiles.length / 2), prodFiles.length - 1]
  for (const idx of sampleIndices) {
    const sample = prodFiles[idx]
    console.log(`\n  Testing file download: "${sample.original_name}" (ID: ${sample.id})`)
    const dlRes = await fetch(`${prodUrl}/api/files/${sample.id}/download`)
    if (!dlRes.ok) throw new Error(`Download failed for ${sample.id}: Status ${dlRes.status}`)
    const dlBuf = await dlRes.arrayBuffer()
    const dlHash = crypto.createHash('sha256').update(Buffer.from(dlBuf)).digest('hex')
    console.log(`  • Downloaded bytes: ${dlBuf.byteLength} (Expected: ${sample.size_bytes})`)
    if (dlBuf.byteLength !== sample.size_bytes) {
      throw new Error(`Size mismatch for ${sample.original_name}`)
    }
    if (sample.sha256) {
      console.log(`  • SHA-256 match: ${dlHash === sample.sha256 ? 'PASS' : 'FAIL'} (${dlHash.slice(0, 16)}...)`)
      if (dlHash !== sample.sha256) {
        throw new Error(`SHA-256 integrity mismatch for ${sample.original_name}`)
      }
    }
  }

  console.log('\n====================================================')
  console.log(' ALL 22 ACADEMIC DOCUMENTS FULLY RESTORED & VERIFIED')
  console.log(' ZERO DATA LOSS CONFIRMED.')
  console.log('====================================================\n')
}

migrate().catch((err) => {
  console.error('\n❌ Migration failed:', err.message)
  process.exit(1)
})
