import { db } from '../server/db'
import fs from 'fs'
import path from 'path'

async function inspect() {
  await db.init()

  console.log('--- SETTINGS ---')
  const settings = db.queryAll('SELECT * FROM settings')
  console.log(settings)

  console.log('--- ASSIGNMENTS ---')
  const assignments = db.queryAll(`
    SELECT id, section_number, title, category,
      (SELECT COUNT(*) FROM assignment_files af WHERE af.assignment_id = assignments.id) as file_count
    FROM assignments
    ORDER BY order_index ASC
  `)
  for (const a of assignments) {
    console.log(`[${a.id}] Sec ${a.section_number}: ${a.title} (${a.file_count} files)`)
  }

  console.log('--- FILES ---')
  const files = db.queryAll('SELECT id, original_name, extension, size_bytes, storage_key, sha256 FROM files')
  console.log(`Total files in DB: ${files.length}`)
  for (const f of files) {
    const filePath = path.resolve('uploads', f.storage_key)
    const exists = fs.existsSync(filePath)
    console.log(`- File [${f.id}] "${f.original_name}" -> key: ${f.storage_key} (${f.size_bytes} bytes, disk exists: ${exists})`)
  }

  console.log('--- ASSIGNMENT_FILES JUNCTIONS ---')
  const afs = db.queryAll('SELECT * FROM assignment_files')
  console.log(`Total junctions: ${afs.length}`)
}

inspect().catch(console.error)
