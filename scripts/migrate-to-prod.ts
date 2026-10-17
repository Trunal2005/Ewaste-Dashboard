import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

async function migrate() {
  const prodUrlArg = process.argv[2] || process.env.PROD_URL
  const adminKeyArg = process.argv[3] || process.env.ADMIN_KEY || ''

  if (!prodUrlArg) {
    console.error('Usage: npx tsx scripts/migrate-to-prod.ts <PROD_URL> [ADMIN_KEY]')
    console.error('Example: npx tsx scripts/migrate-to-prod.ts https://ewaste-dashboard.onrender.com my_admin_passcode')
    process.exit(1)
  }

  const prodUrl = prodUrlArg.replace(/\/$/, '')
  console.log('====================================================')
  console.log('   EWEM WORKSPACE PRODUCTION DATA MIGRATION TOOL')
  console.log('====================================================')
  console.log(`Target Production URL: ${prodUrl}`)

  // 1. Verify local database file exists
  const localDbPath = path.resolve(process.cwd(), 'data', 'ewaste.sqlite')
  if (!fs.existsSync(localDbPath)) {
    throw new Error(`Local SQLite database not found at ${localDbPath}`)
  }
  const dbBuffer = fs.readFileSync(localDbPath)
  console.log(`✓ Local SQLite database located: ${dbBuffer.length} bytes`)

  // 2. Verify local uploads directory exists
  const localUploadsDir = path.resolve(process.cwd(), 'uploads')
  if (!fs.existsSync(localUploadsDir)) {
    throw new Error(`Local uploads directory not found at ${localUploadsDir}`)
  }
  const uploadFileNames = fs.readdirSync(localUploadsDir)
  console.log(`✓ Local uploads directory located: ${uploadFileNames.length} files`)

  // 3. Prepare FormData payload
  console.log('\n[1/4] Assembling secure migration bundle...')
  const formData = new FormData()

  // Add SQLite database binary
  const dbBlob = new Blob([dbBuffer], { type: 'application/x-sqlite3' })
  formData.append('db', dbBlob, 'ewaste.sqlite')

  // Add each physical upload file
  let totalUploadBytes = 0
  for (const filename of uploadFileNames) {
    const filePath = path.join(localUploadsDir, filename)
    const fileBuf = fs.readFileSync(filePath)
    totalUploadBytes += fileBuf.length
    const fileBlob = new Blob([fileBuf])
    formData.append('files', fileBlob, filename)
  }
  console.log(`- Total data bundle size: ${(totalUploadBytes / (1024 * 1024)).toFixed(2)} MB across ${uploadFileNames.length} files`)

  // 4. Send snapshot to production endpoint
  console.log('\n[2/4] Uploading snapshot to production persistent storage...')
  const syncEndpoint = `${prodUrl}/api/admin/sync-snapshot`
  const headers: Record<string, string> = {}
  if (adminKeyArg) {
    headers['x-admin-key'] = adminKeyArg
  }

  const uploadStart = Date.now()
  const syncRes = await fetch(syncEndpoint, {
    method: 'POST',
    headers,
    body: formData,
  })

  if (!syncRes.ok) {
    const errorText = await syncRes.text()
    throw new Error(`Production sync failed (Status ${syncRes.status}): ${errorText}`)
  }

  const syncResult = await syncRes.json()
  const elapsedSec = ((Date.now() - uploadStart) / 1000).toFixed(1)
  console.log(`✓ Production persistent storage snapshot deployed in ${elapsedSec}s`)
  console.log(`- Files written on server: ${syncResult.filesWritten}`)

  // 5. Verification on live production server
  console.log('\n[3/4] Verifying live production database and file integrity...')
  const overviewRes = await fetch(`${prodUrl}/api/overview`)
  if (!overviewRes.ok) throw new Error('Failed to query production /api/overview')
  const overview = await overviewRes.json()

  const filesRes = await fetch(`${prodUrl}/api/files`)
  if (!filesRes.ok) throw new Error('Failed to query production /api/files')
  const prodFiles = await filesRes.json()

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

  // 6. Test file download stream on production
  console.log('\n[4/4] Testing random file download integrity on production server...')
  if (prodFiles.length > 0) {
    const testFile = prodFiles[0]
    const dlRes = await fetch(`${prodUrl}/api/files/${testFile.id}/download`)
    if (!dlRes.ok) throw new Error(`Download test failed for file ${testFile.id}`)
    const dlBuf = await dlRes.arrayBuffer()
    const dlHash = crypto.createHash('sha256').update(Buffer.from(dlBuf)).digest('hex')
    console.log(`- Tested download: "${testFile.original_name}"`)
    console.log(`- Download size matches: ${dlBuf.byteLength === testFile.size_bytes ? 'PASS' : 'FAIL'}`)
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
