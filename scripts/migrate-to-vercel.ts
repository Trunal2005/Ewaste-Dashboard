import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { put, get } from '@vercel/blob'
import initSqlJs from 'sql.js'
import { sqlWasmBinary } from '../server/sql-wasm-binary'
import { createClient } from '@libsql/client/http'

// Attempt to load local .env if present
try {
  if (typeof (process as any).loadEnvFile === 'function') {
    const envPath = path.resolve(process.cwd(), '.env')
    if (fs.existsSync(envPath)) {
      ;(process as any).loadEnvFile(envPath)
    }
  }
} catch {
  // Ignore env file loading issues
}

async function migrate() {
  const args = process.argv.slice(2)
  const tursoUrlArg = args.find((a) => a.startsWith('libsql://') || a.startsWith('https://'))
  const blobTokenArg = args.find((a) => a.startsWith('vercel_blob_rw_') || a.startsWith('blob_'))
  const prodUrlArg = args.find((a) => a.startsWith('http://') || (a.startsWith('https://') && a.includes('vercel.app')))

  const tursoUrl = process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL || tursoUrlArg || ''
  const tursoToken = process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN || ''
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN || blobTokenArg || ''
  const prodUrl = (process.env.PROD_URL || prodUrlArg || 'https://ewaste-dashboard-xi.vercel.app').replace(/\/$/, '')

  console.log('====================================================================')
  console.log('   EWEM WORKSPACE PRODUCTION MIGRATION & VERIFICATION SUITE         ')
  console.log('====================================================================')
  console.log(`Target Production URL: ${prodUrl}`)
  console.log(`Turso Database URL   : ${tursoUrl ? tursoUrl.replace(/:[^:@]+@/, ':***@') : '(Not provided)'}`)
  console.log(`Vercel Blob Storage  : ${blobToken ? 'Credentials Available (access: private)' : (process.env.VERCEL_OIDC_TOKEN ? 'Vercel OIDC Ambient' : '(Not provided)')}`)

  // 1. Verify and read local SQLite database (NEVER MODIFIED OR DELETED)
  const localDbPath = path.resolve(process.cwd(), 'data', 'ewaste.sqlite')
  if (!fs.existsSync(localDbPath)) {
    throw new Error(`CRITICAL: Local SQLite database not found at ${localDbPath}`)
  }
  const dbBuffer = fs.readFileSync(localDbPath)
  console.log(`\n[Step 1/5] Reading authoritative local SQLite database (${dbBuffer.length} bytes)...`)

  const SQL = await initSqlJs({ wasmBinary: sqlWasmBinary })
  const localDb = new SQL.Database(dbBuffer)

  const assignmentsRows = localDb.exec(`
    SELECT a.id, a.section_number, a.order_index, a.title, a.category, a.description, a.expected_files, a.notes, a.due_date, a.state, a.class_label, a.created_at, a.updated_at,
      (SELECT COUNT(*) FROM assignment_files af WHERE af.assignment_id = a.id) as cnt
    FROM assignments a
    ORDER BY a.order_index ASC
  `)
  const localAssignments = assignmentsRows[0]?.values || []
  const completedLocal = localAssignments.filter((a: any) => Number(a[13]) > 0)
  const awaitingLocal = localAssignments.filter((a: any) => Number(a[13]) === 0)

  const filesRows = localDb.exec('SELECT id, original_name, extension, mime_type, size_bytes, storage_key, sha256, created_at FROM files')
  const localFiles = filesRows[0]?.values || []

  const afRows = localDb.exec('SELECT id, assignment_id, file_id, linked_at FROM assignment_files')
  const localLinks = afRows[0]?.values || []

  const settingsRows = localDb.exec('SELECT key, value FROM settings')
  const localSettings = settingsRows[0]?.values || []

  const logsRows = localDb.exec('SELECT id, action_type, description, entity_id, created_at FROM activity_logs')
  const localLogs = logsRows[0]?.values || []

  console.log(`- Authoritative Local State Summary:`)
  console.log(`  • Total Sections                : ${localAssignments.length} (Expected: 14)`)
  console.log(`  • Sections with files (completed): ${completedLocal.length} (Expected: 13)`)
  console.log(`  • Sections awaiting files        : ${awaitingLocal.length} (Expected: 1 — Section 11)`)
  console.log(`  • Unique academic file records  : ${localFiles.length} (Expected: 22)`)
  console.log(`  • Assignment-to-file links       : ${localLinks.length} (Expected: 22)`)
  console.log(`  • Student settings records      : ${localSettings.length}`)
  console.log(`  • Activity log records          : ${localLogs.length}`)

  // 2. Verify all local physical documents on disk
  const localUploadsDir = path.resolve(process.cwd(), 'uploads')
  if (!fs.existsSync(localUploadsDir)) {
    throw new Error(`CRITICAL: Local uploads directory not found at ${localUploadsDir}`)
  }
  const diskFiles = fs.readdirSync(localUploadsDir)
  console.log(`\n[Step 2/5] Auditing ${diskFiles.length} physical documents in uploads/ directory...`)

  const diskFileMap = new Map<string, { size: number; sha256: string; path: string }>()
  let totalDiskBytes = 0

  for (const f of diskFiles) {
    const fPath = path.join(localUploadsDir, f)
    const stat = fs.statSync(fPath)
    totalDiskBytes += stat.size
    const buf = fs.readFileSync(fPath)
    const hash = crypto.createHash('sha256').update(buf).digest('hex')
    diskFileMap.set(f, { size: stat.size, sha256: hash, path: fPath })
  }

  console.log(`- Found ${diskFiles.length} files (${(totalDiskBytes / (1024 * 1024)).toFixed(2)} MB total)`)

  // Check that every file in database exists on disk with exact checksum
  for (const dbFile of localFiles) {
    const fileId = String(dbFile[0])
    const storageKey = String(dbFile[5] || fileId)
    const expectedSha = String(dbFile[6] || '')
    const diskInfo = diskFileMap.get(storageKey)

    if (!diskInfo) {
      throw new Error(`CRITICAL INTEGRITY FAILURE: Database file record "${fileId}" missing from uploads/ directory!`)
    }
    if (expectedSha && diskInfo.sha256 !== expectedSha) {
      throw new Error(`CRITICAL INTEGRITY FAILURE: SHA-256 mismatch for "${fileId}": disk=${diskInfo.sha256}, db=${expectedSha}`)
    }
  }
  console.log(`✓ 100% integrity verified: All ${localFiles.length} database records match physical disk files.`)

  // 3. Migrate Metadata to Turso Transactional Database (if configured)
  if (tursoUrl) {
    console.log(`\n[Step 3/5] Migrating metadata to Turso Cloud LibSQL (${tursoUrl.replace(/:[^:@]+@/, ':***@')})...`)
    const tursoClient = createClient({
      url: tursoUrl,
      authToken: tursoToken,
    })

    // Create tables
    await tursoClient.executeMultiple(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS assignments (
        id TEXT PRIMARY KEY,
        section_number INTEGER NOT NULL,
        order_index INTEGER NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        expected_files TEXT NOT NULL,
        notes TEXT DEFAULT '',
        due_date TEXT DEFAULT '',
        state TEXT DEFAULT '',
        class_label TEXT DEFAULT 'TE CMPN C',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        original_name TEXT NOT NULL,
        extension TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        storage_key TEXT NOT NULL,
        sha256 TEXT DEFAULT '',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS assignment_files (
        id TEXT PRIMARY KEY,
        assignment_id TEXT NOT NULL,
        file_id TEXT NOT NULL,
        linked_at TEXT NOT NULL,
        UNIQUE(assignment_id, file_id),
        FOREIGN KEY(assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
        FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY,
        action_type TEXT NOT NULL,
        description TEXT NOT NULL,
        entity_id TEXT DEFAULT '',
        created_at TEXT NOT NULL
      );
    `)

    // Migrate Settings
    for (const s of localSettings) {
      await tursoClient.execute({
        sql: 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        args: [String(s[0]), String(s[1] || '')],
      })
    }
    console.log(`  • Migrated ${localSettings.length} settings records`)

    // Migrate Assignments
    for (const a of localAssignments) {
      await tursoClient.execute({
        sql: `INSERT INTO assignments (id, section_number, order_index, title, category, description, expected_files, notes, due_date, state, class_label, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                section_number = excluded.section_number,
                order_index = excluded.order_index,
                title = excluded.title,
                category = excluded.category,
                description = excluded.description,
                expected_files = excluded.expected_files,
                notes = excluded.notes,
                due_date = excluded.due_date,
                state = excluded.state,
                class_label = excluded.class_label,
                updated_at = excluded.updated_at`,
        args: [
          String(a[0]),
          Number(a[1]),
          Number(a[2]),
          String(a[3]),
          String(a[4]),
          String(a[5]),
          String(a[6]),
          String(a[7] || ''),
          String(a[8] || ''),
          String(a[9] || ''),
          String(a[10] || 'TE CMPN C'),
          String(a[11]),
          String(a[12]),
        ],
      })
    }
    console.log(`  • Migrated ${localAssignments.length} assignment sections`)

    // Migrate Files
    for (const f of localFiles) {
      await tursoClient.execute({
        sql: `INSERT INTO files (id, original_name, extension, mime_type, size_bytes, storage_key, sha256, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                original_name = excluded.original_name,
                extension = excluded.extension,
                mime_type = excluded.mime_type,
                size_bytes = excluded.size_bytes,
                storage_key = excluded.storage_key,
                sha256 = excluded.sha256,
                created_at = excluded.created_at`,
        args: [
          String(f[0]),
          String(f[1]),
          String(f[2]),
          String(f[3]),
          Number(f[4]),
          String(f[5]),
          String(f[6] || ''),
          String(f[7]),
        ],
      })
    }
    console.log(`  • Migrated ${localFiles.length} file records`)

    // Migrate Assignment Files links
    for (const af of localLinks) {
      await tursoClient.execute({
        sql: `INSERT INTO assignment_files (id, assignment_id, file_id, linked_at)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(id) DO NOTHING`,
        args: [String(af[0]), String(af[1]), String(af[2]), String(af[3])],
      })
    }
    console.log(`  • Migrated ${localLinks.length} assignment-file junction links`)

    // Migrate Activity Logs
    for (const l of localLogs) {
      await tursoClient.execute({
        sql: `INSERT INTO activity_logs (id, action_type, description, entity_id, created_at)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(id) DO NOTHING`,
        args: [String(l[0]), String(l[1]), String(l[2]), String(l[3] || ''), String(l[4])],
      })
    }
    console.log(`  • Migrated ${localLogs.length} activity logs`)

    // Verification on Turso
    const checkAsgns = await tursoClient.execute(
      'SELECT id, (SELECT COUNT(*) FROM assignment_files af WHERE af.assignment_id = assignments.id) as cnt FROM assignments'
    )
    const checkFiles = await tursoClient.execute('SELECT COUNT(*) as cnt FROM files')
    const completedOnTurso = checkAsgns.rows.filter((r: any) => Number(r.cnt) > 0).length
    const awaitingOnTurso = checkAsgns.rows.length - completedOnTurso

    console.log(`✓ Turso Database verification complete:`)
    console.log(`  • Total Sections        : ${checkAsgns.rows.length}`)
    console.log(`  • Sections with files   : ${completedOnTurso}`)
    console.log(`  • Sections awaiting     : ${awaitingOnTurso}`)
    console.log(`  • Total Files in DB     : ${checkFiles.rows[0]?.cnt}`)
  } else {
    console.log('\n[Step 3/5] Skipping Turso migration (TURSO_DATABASE_URL not set).')
    console.log('  Configure TURSO_DATABASE_URL and TURSO_AUTH_TOKEN to populate cloud metadata.')
  }

  // 4. Migrate Academic Documents to Vercel Blob with PRIVATE Access (if configured)
  const hasBlobCredentials = Boolean(blobToken || (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID))

  if (hasBlobCredentials) {
    if (blobToken) process.env.BLOB_READ_WRITE_TOKEN = blobToken
    console.log(`\n[Step 4/5] Migrating ${diskFiles.length} academic documents to Private Vercel Blob...`)
    console.log('  (Strict privacy enabled: access: private, NO public database exposure)')

    let uploadedCount = 0
    let failedCount = 0

    for (let i = 0; i < diskFiles.length; i++) {
      const filename = diskFiles[i]
      const info = diskFileMap.get(filename)!
      const fileBuf = fs.readFileSync(info.path)
      const blobPath = `uploads/${filename}`

      let success = false
      let attempts = 0
      while (!success && attempts < 3) {
        attempts++
        try {
          await put(blobPath, fileBuf, {
            access: 'private',
            addRandomSuffix: false,
            allowOverwrite: true,
            ...(blobToken ? { token: blobToken } : {}),
          })

          // Verify uploaded blob by reading back and checking SHA-256
          const downloaded = await get(blobPath, {
            access: 'private',
            ...(blobToken ? { token: blobToken } : {}),
          })

          if (!downloaded || !downloaded.stream) {
            throw new Error('Upload verification failed: blob could not be retrieved.')
          }

          const reader = downloaded.stream.getReader()
          const chunks: Uint8Array[] = []
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (value) chunks.push(value)
          }
          const verifiedBuf = Buffer.concat(chunks)
          const verifiedHash = crypto.createHash('sha256').update(verifiedBuf).digest('hex')

          if (verifiedHash !== info.sha256) {
            throw new Error(`SHA-256 verification mismatch: uploaded=${verifiedHash}, original=${info.sha256}`)
          }

          success = true
          uploadedCount++
          console.log(`  [${i + 1}/${diskFiles.length}] ✓ "${filename}" (${(info.size / 1024).toFixed(1)} KB) -> SHA256 verified: ${info.sha256.slice(0, 16)}...`)
        } catch (err: any) {
          if (attempts >= 3) {
            failedCount++
            console.error(`  [${i + 1}/${diskFiles.length}] ❌ Failed "${filename}": ${err.message}`)
          } else {
            console.warn(`  [${i + 1}/${diskFiles.length}] Retry ${attempts}/3 for "${filename}"...`)
            await new Promise((r) => setTimeout(r, 1500))
          }
        }
      }
    }

    console.log(`\nDocument migration result: ${uploadedCount} uploaded & verified, ${failedCount} failures.`)
    if (failedCount > 0) {
      throw new Error(`Migration had ${failedCount} file upload failure(s).`)
    }
  } else {
    console.log('\n[Step 4/5] Skipping Vercel Blob file migration (BLOB_READ_WRITE_TOKEN not set).')
    console.log('  Configure BLOB_READ_WRITE_TOKEN to upload academic documents.')
  }

  // 5. End-to-end verification against live production deployment
  console.log('\n====================================================================')
  console.log('   END-TO-END PRODUCTION SYSTEM VERIFICATION CHECKS                 ')
  console.log('====================================================================')
  console.log(`Testing live endpoints at ${prodUrl} ...\n`)

  // Check 1: Health
  console.log('[Check 1] Querying /api/health ...')
  try {
    const healthRes = await fetch(`${prodUrl}/api/health`)
    if (healthRes.ok) {
      const health = await healthRes.json()
      console.log(`  • Status            : ${health.status}`)
      console.log(`  • Storage           : ${health.storage}`)
      console.log(`  • Database          : ${health.database}`)
      console.log(`  • Durable           : ${health.durable}`)
      console.log(`  • Total Sections    : ${health.totalSections}`)
      console.log(`  • Completed Sections: ${health.sectionsWithFiles}`)
      console.log(`  • Total Files in DB : ${health.totalFiles}`)
      console.log(`  • Has Turso DB      : ${health.hasTursoDatabase}`)
      console.log(`  • Has Blob Token    : ${health.hasBlobToken}`)
    } else {
      console.warn(`  Health endpoint returned HTTP ${healthRes.status}`)
    }
  } catch (err: any) {
    console.warn(`  Failed to reach health endpoint: ${err.message}`)
  }

  // Check 2: Overview
  console.log('\n[Check 2] Querying /api/overview ...')
  try {
    const overviewRes = await fetch(`${prodUrl}/api/overview`)
    if (overviewRes.ok) {
      const overview = await overviewRes.json()
      console.log(`  • Total Sections     : ${overview.totalSections} (Target: 14)`)
      console.log(`  • Completed Sections : ${overview.sectionsWithFiles} (Target: 13)`)
      console.log(`  • Awaiting Sections  : ${overview.sectionsAwaitingFiles} (Target: 1)`)
      console.log(`  • Total Files in DB  : ${overview.totalFiles} (Target: 22)`)
      console.log(`  • Student Name       : ${overview.settings?.student_name} (${overview.settings?.roll_no})`)

      const matches =
        overview.totalSections === 14 &&
        overview.sectionsWithFiles === 13 &&
        overview.sectionsAwaitingFiles === 1 &&
        overview.totalFiles === 22

      if (matches) {
        console.log('  ✓ Production overview metrics EXACTLY MATCH requirements!')
      } else {
        console.log('  ⚠️ Production metrics do not match final expected numbers yet (cloud credentials may need to be applied in Vercel settings).')
      }
    } else {
      console.warn(`  Overview endpoint returned HTTP ${overviewRes.status}`)
    }
  } catch (err: any) {
    console.warn(`  Failed to reach overview endpoint: ${err.message}`)
  }

  // Check 3: Files & Downloads
  console.log('\n[Check 3] Testing File Library & Authorized Download Integrity...')
  try {
    const filesRes = await fetch(`${prodUrl}/api/files`)
    if (filesRes.ok) {
      const prodFiles = await filesRes.json()
      console.log(`  • Files in production library: ${prodFiles.length}`)

      if (prodFiles.length > 0) {
        // Test downloads for a sample of files across formats
        const sampleFiles = prodFiles.slice(0, 3)
        for (const sample of sampleFiles) {
          console.log(`  Testing download: "${sample.original_name}" (${sample.id})`)
          const dlRes = await fetch(`${prodUrl}/api/files/${sample.id}/download`)
          if (dlRes.ok) {
            const dlBuf = await dlRes.arrayBuffer()
            const dlHash = crypto.createHash('sha256').update(Buffer.from(dlBuf)).digest('hex')
            console.log(`    • Bytes received : ${dlBuf.byteLength} (DB size: ${sample.size_bytes})`)
            console.log(`    • SHA-256 Match  : ${dlHash === sample.sha256 ? 'PASS' : 'FAIL'} (${dlHash.slice(0, 16)}...)`)
          } else {
            console.warn(`    • Download failed: HTTP ${dlRes.status}`)
          }
        }
      }
    }
  } catch (err: any) {
    console.warn(`  Failed to query files endpoint: ${err.message}`)
  }

  console.log('\n====================================================================')
  console.log('   MIGRATION RUN COMPLETED                                          ')
  console.log('====================================================================\n')
}

migrate().catch((err) => {
  console.error('\n❌ Migration error:', err.message)
  process.exit(1)
})
