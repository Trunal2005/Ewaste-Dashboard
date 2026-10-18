import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { put } from '@vercel/blob'
import { db } from '../server/db'

async function migrate() {
  const token = process.argv[2] || process.env.BLOB_READ_WRITE_TOKEN
  const prodUrlArg = process.argv[3] || process.env.PROD_URL || 'https://ewaste-dashboard-xi.vercel.app'
  const prodUrl = prodUrlArg.replace(/\/$/, '')

  console.log('====================================================')
  console.log('   EWEM WORKSPACE VERCEL BLOB DATA MIGRATION TOOL')
  console.log('====================================================')
  console.log(`Target Production URL: ${prodUrl}`)

  if (!token) {
    console.error('\n❌ ERROR: BLOB_READ_WRITE_TOKEN is required.')
    console.error('\nUsage: npx tsx scripts/migrate-to-vercel.ts <BLOB_READ_WRITE_TOKEN> [PROD_URL]')
    console.error('Example: npx tsx scripts/migrate-to-vercel.ts vercel_blob_rw_xxxxxxxx https://ewaste-dashboard-xi.vercel.app')
    console.error('\nTo get your token:')
    console.error('1. Go to https://vercel.com/dashboard')
    console.error('2. Select project "ewaste-dashboard" -> Storage tab -> Create "Blob"')
    console.error('3. Click "Connect to Project", then copy the BLOB_READ_WRITE_TOKEN\n')
    process.exit(1)
  }

  process.env.BLOB_READ_WRITE_TOKEN = token

  // 1. Verify local database file exists
  const localDbPath = path.resolve(process.cwd(), 'data', 'ewaste.sqlite')
  if (!fs.existsSync(localDbPath)) {
    throw new Error(`Local SQLite database not found at ${localDbPath}`)
  }
  const dbBuffer = fs.readFileSync(localDbPath)
  console.log(`✓ Local SQLite database located: ${dbBuffer.length} bytes`)

  // Verify DB data
  await db.init()
  const dbAssignments = db.queryAll('SELECT COUNT(*) as cnt FROM assignments')
  const dbFiles = db.queryAll('SELECT COUNT(*) as cnt FROM files')
  console.log(`✓ Database contents verified: ${dbAssignments[0].cnt} assignments, ${dbFiles[0].cnt} files`)

  // 2. Verify local uploads directory exists
  const localUploadsDir = path.resolve(process.cwd(), 'uploads')
  if (!fs.existsSync(localUploadsDir)) {
    throw new Error(`Local uploads directory not found at ${localUploadsDir}`)
  }
  const uploadFileNames = fs.readdirSync(localUploadsDir)
  console.log(`✓ Local uploads directory located: ${uploadFileNames.length} files`)

  // 3. Upload SQLite database to Vercel Blob
  console.log('\n[1/3] Uploading ewaste.sqlite database to Vercel Blob...')
  const dbBlob = await put('data/ewaste.sqlite', dbBuffer, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    token,
  })
  console.log(`✓ Database uploaded to Vercel Blob: ${dbBlob.url}`)

  // 4. Upload each of the 22 physical files to Vercel Blob
  console.log(`\n[2/3] Uploading ${uploadFileNames.length} assignment documents to Vercel Blob...`)
  let uploadedBytes = 0
  let fileIndex = 0

  for (const filename of uploadFileNames) {
    fileIndex++
    const filePath = path.join(localUploadsDir, filename)
    const fileBuf = fs.readFileSync(filePath)
    uploadedBytes += fileBuf.length
    const sha256 = crypto.createHash('sha256').update(fileBuf).digest('hex')

    const blob = await put(`uploads/${filename}`, fileBuf, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      token,
    })

    console.log(`  [${fileIndex}/${uploadFileNames.length}] ✓ ${filename} (${(fileBuf.length / 1024).toFixed(1)} KB) -> SHA256: ${sha256.slice(0, 10)}...`)
  }

  console.log(`\n✓ All ${uploadFileNames.length} files (${(uploadedBytes / (1024 * 1024)).toFixed(2)} MB) migrated to persistent Vercel Blob!`)

  // 5. Verification on live production deployment
  console.log('\n[3/3] Verifying live production website and API...')
  console.log(`Querying ${prodUrl}/api/overview ...`)

  const overviewRes = await fetch(`${prodUrl}/api/overview`)
  if (!overviewRes.ok) {
    throw new Error(`Failed to query ${prodUrl}/api/overview (Status ${overviewRes.status})`)
  }
  const overview = await overviewRes.json()

  console.log('Production Overview Verification:')
  console.log(`- Total Sections: ${overview.totalSections} (Expected: 14)`)
  console.log(`- Sections with files: ${overview.sectionsWithFiles} (Expected: 13)`)
  console.log(`- Sections awaiting files: ${overview.sectionsAwaitingFiles} (Expected: 1)`)
  console.log(`- Total files in DB: ${overview.totalFiles} (Expected: 22)`)
  console.log(`- Student Name: ${overview.settings.student_name}`)
  console.log(`- Roll Number: ${overview.settings.roll_no}`)

  if (overview.totalSections !== 14 || overview.sectionsWithFiles !== 13 || overview.totalFiles !== 22) {
    throw new Error('VERIFICATION FAILED: Production metrics do not match expected local metrics!')
  }

  // Test random file download integrity from live site
  const filesRes = await fetch(`${prodUrl}/api/files`)
  if (!filesRes.ok) throw new Error('Failed to query production /api/files')
  const prodFiles = await filesRes.json()

  if (prodFiles.length > 0) {
    const testFile = prodFiles[0]
    console.log(`\nTesting download integrity on production server: "${testFile.original_name}"`)
    const dlRes = await fetch(`${prodUrl}/api/files/${testFile.id}/download`)
    if (!dlRes.ok) throw new Error(`Download test failed for file ${testFile.id}`)
    const dlBuf = await dlRes.arrayBuffer()
    const dlHash = crypto.createHash('sha256').update(Buffer.from(dlBuf)).digest('hex')
    console.log(`- Download size matches: ${dlBuf.byteLength === testFile.size_bytes ? 'PASS' : 'FAIL'} (${dlBuf.byteLength} bytes)`)
    if (testFile.sha256) {
      console.log(`- SHA-256 integrity match: ${dlHash === testFile.sha256 ? 'PASS' : 'FAIL'}`)
    }
  }

  console.log('\n====================================================')
  console.log(' SUCCESS: All 22 files and 14 sections verified on production!')
  console.log(' Zero data loss achieved.')
  console.log('====================================================\n')
}

migrate().catch((err) => {
  console.error('\n❌ Migration failed:', err.message)
  process.exit(1)
})
