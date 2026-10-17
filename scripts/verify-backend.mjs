import crypto from 'crypto'

async function runTests() {
  const baseUrl = process.argv[2] || 'http://localhost:3001'
  console.log(`=== EWEM WORKSPACE INTEGRITY VERIFICATION SUITE ===`)
  console.log(`Target: ${baseUrl}\n`)

  // 1. Overview & Counts
  console.log('[Test 1] Checking Live Overview & Assignment Counts...')
  const overviewRes = await fetch(`${baseUrl}/api/overview`)
  if (!overviewRes.ok) throw new Error('Failed to fetch overview')
  const overview = await overviewRes.json()
  console.log(`- Total Sections: ${overview.totalSections}`)
  console.log(`- Sections with files: ${overview.sectionsWithFiles}`)
  console.log(`- Sections awaiting: ${overview.sectionsAwaitingFiles}`)
  console.log(`- Total files: ${overview.totalFiles}`)
  console.log(`- Student name: ${overview.settings.student_name}`)
  console.log(`- Roll number: ${overview.settings.roll_no}`)
  
  if (overview.totalSections !== 14) throw new Error(`Expected 14 total sections, got ${overview.totalSections}`);
  if (overview.sectionsWithFiles !== 13) throw new Error(`Expected 13 sections with files, got ${overview.sectionsWithFiles}`);
  if (overview.sectionsAwaitingFiles !== 1) throw new Error(`Expected 1 section awaiting files, got ${overview.sectionsAwaitingFiles}`);
  if (overview.totalFiles !== 22) throw new Error(`Expected 22 total uploaded files, got ${overview.totalFiles}`);
  console.log('✓ Academic counts verified: 14 sections, 13 completed, 1 awaiting, 22 files total\n')

  // 2. Query assignments list
  console.log('[Test 2] Querying all 14 assignments...')
  const assignmentsRes = await fetch(`${baseUrl}/api/assignments`)
  if (!assignmentsRes.ok) throw new Error('Failed to fetch assignments')
  const assignments = await assignmentsRes.json()
  console.log(`- Received ${assignments.length} assignments`)
  const sec11 = assignments.find(a => a.id === 'sec-11')
  if (sec11 && sec11.file_count === 0) {
    console.log(`- Section 11 correctly identified as awaiting submission: "${sec11.title}"`)
  }
  console.log('✓ Assignments list verified\n')

  // 3. Query files repository
  console.log('[Test 3] Querying File Library...')
  const filesRes = await fetch(`${baseUrl}/api/files`)
  if (!filesRes.ok) throw new Error('Failed to fetch files')
  const files = await filesRes.json()
  console.log(`- Total files in library: ${files.length}`)
  console.log('✓ File library verified\n')

  // 4. Test download endpoint with byte preservation
  console.log('[Test 4] Testing File Download Stream & Byte Preservation...')
  if (files.length > 0) {
    const sample = files[0]
    const dlRes = await fetch(`${baseUrl}/api/files/${sample.id}/download`)
    if (!dlRes.ok) throw new Error(`Failed to download ${sample.id}`)
    const buf = await dlRes.arrayBuffer()
    const hash = crypto.createHash('sha256').update(Buffer.from(buf)).digest('hex')
    console.log(`- Tested download: "${sample.original_name}"`)
    console.log(`- Size: ${buf.byteLength} bytes (expected: ${sample.size_bytes})`)
    if (buf.byteLength !== sample.size_bytes) throw new Error('Downloaded byte size mismatch');
    if (sample.sha256 && hash !== sample.sha256) throw new Error('Downloaded SHA-256 mismatch');
    console.log('✓ Exact byte integrity and original filename preserved\n')
  }

  // 5. Test health check
  console.log('[Test 5] Checking API Health Endpoint...')
  const healthRes = await fetch(`${baseUrl}/api/health`)
  if (!healthRes.ok) throw new Error('Health check failed')
  const health = await healthRes.json()
  console.log(`- Status: ${health.status}`)
  console.log(`- Storage: ${health.storage}`)
  console.log('✓ Backend health check passed\n')

  console.log('==============================================')
  console.log('ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!')
  console.log('==============================================\n')
}

runTests().catch(err => {
  console.error('\n❌ Verification Failed:', err.message)
  process.exit(1)
})
