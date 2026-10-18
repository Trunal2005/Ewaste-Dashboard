import initSqlJs, { Database, SqlValue } from 'sql.js'
import { sqlWasmBinary } from './sql-wasm-binary'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { put, head, BlobNotFoundError } from '@vercel/blob'

export interface DBRow {
  [key: string]: any
}

class SQLiteDB {
  private db: Database | null = null
  private dbFilePath: string
  private isBlobStorage: boolean = false
  private initPromise: Promise<void> | null = null

  constructor(dbFilePath: string) {
    this.dbFilePath = dbFilePath
    this.isBlobStorage = Boolean(process.env.BLOB_READ_WRITE_TOKEN)
  }

  public async init(): Promise<void> {
    if (this.db) return
    if (this.initPromise) return this.initPromise

    this.initPromise = this._doInit()
    try {
      await this.initPromise
    } finally {
      this.initPromise = null
    }
  }

  private async _doInit(): Promise<void> {
    const SQL = await initSqlJs({ wasmBinary: sqlWasmBinary })

    if (this.isBlobStorage) {
      const tmpPath = path.join(os.tmpdir(), 'ewaste.sqlite')
      let dbBuffer: Buffer | null = null

      // 1. Try reading from /tmp cache first
      if (fs.existsSync(tmpPath)) {
        try {
          dbBuffer = fs.readFileSync(tmpPath)
          console.log(`[EWEM DB] Loaded SQLite database from /tmp cache (${dbBuffer.length} bytes)`)
        } catch (e) {
          console.warn('[EWEM DB] Failed to read /tmp cache:', e)
        }
      }

      // 2. If not in /tmp, fetch from Vercel Blob
      if (!dbBuffer) {
        try {
          const blobPath = 'data/ewaste.sqlite'
          const details = await head(blobPath).catch((err) => {
            if (err instanceof BlobNotFoundError || err?.name === 'BlobNotFoundError') return null
            throw err
          })

          if (details && details.url) {
            console.log(`[EWEM DB] Downloading database snapshot from Vercel Blob: ${details.url}`)
            const res = await fetch(details.url)
            if (res.ok) {
              const arrayBuf = await res.arrayBuffer()
              dbBuffer = Buffer.from(arrayBuf)
              fs.writeFileSync(tmpPath, dbBuffer)
              console.log(`[EWEM DB] Restored SQLite database from Vercel Blob (${dbBuffer.length} bytes)`)
            }
          }
        } catch (err) {
          console.warn('[EWEM DB] Notice: Vercel Blob fetch attempt encountered error:', err)
        }
      }

      // 3. Fallback to local file if available
      if (!dbBuffer && fs.existsSync(this.dbFilePath)) {
        try {
          dbBuffer = fs.readFileSync(this.dbFilePath)
          fs.writeFileSync(tmpPath, dbBuffer)
          console.log(`[EWEM DB] Loaded SQLite database from local fallback path (${dbBuffer.length} bytes)`)
        } catch (e) {
          console.warn('[EWEM DB] Failed to read local fallback:', e)
        }
      }

      if (dbBuffer && dbBuffer.length > 0) {
        this.db = new SQL.Database(dbBuffer)
      } else {
        console.log('[EWEM DB] Initializing fresh SQLite database instance')
        this.db = new SQL.Database()
      }

      this.dbFilePath = tmpPath
    } else {
      // Local development disk storage
      const dbDir = path.dirname(this.dbFilePath)
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true })
      }

      if (fs.existsSync(this.dbFilePath)) {
        const fileBuffer = fs.readFileSync(this.dbFilePath)
        this.db = new SQL.Database(fileBuffer)
      } else {
        this.db = new SQL.Database()
      }
    }

    this.createTables()
    this.seedInitialData()
    this.persistSync()
  }

  public persistSync(): void {
    if (!this.db) return
    const data = this.db.export()
    const buffer = Buffer.from(data)

    try {
      const dir = path.dirname(this.dbFilePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(this.dbFilePath, buffer)
    } catch (e) {
      console.warn('[EWEM DB] Failed to write local DB file:', e)
    }

    // If using Vercel Blob, upload asynchronously
    if (this.isBlobStorage) {
      put('data/ewaste.sqlite', buffer, {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
      }).catch((err) => {
        console.error('[EWEM DB] Error uploading snapshot to Vercel Blob:', err)
      })
    }
  }

  public schedulePersist(): void {
    this.persistSync()
  }

  public async reload(): Promise<void> {
    const SQL = await initSqlJs({ wasmBinary: sqlWasmBinary })
    if (fs.existsSync(this.dbFilePath)) {
      const fileBuffer = fs.readFileSync(this.dbFilePath)
      this.db = new SQL.Database(fileBuffer)
    }
  }

  private createTables(): void {
    if (!this.db) return

    this.db.run(`
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
  }

  private seedInitialData(): void {
    if (!this.db) return

    // Seed student settings if not exists
    const settingsCheck = this.queryAll('SELECT * FROM settings WHERE key = "student_name"')
    if (settingsCheck.length === 0) {
      const initialSettings = [
        ['student_name', 'Trunal Patil'],
        ['roll_no', '24102C0026'],
        ['subject', 'E-Waste Management (EWEM)'],
        ['college', 'Vidyalankar Institute of Technology, Mumbai'],
        ['program', 'Third Year B.Tech — Computer Engineering'],
        ['academic_year', ''],
        ['division', ''],
        ['faculty_name', ''],
        ['default_state', '']
      ]

      for (const [key, value] of initialSettings) {
        this.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value])
      }
    }

    // Seed the 14 initial sections if assignments table is empty
    const countCheck = this.queryAll('SELECT COUNT(*) as cnt FROM assignments')
    if (countCheck[0]?.cnt === 0) {
      const now = new Date().toISOString()
      const initialSections = [
        {
          id: 'sec-1',
          section_number: 1,
          order_index: 1,
          title: 'Toxic Chemicals — Any 5',
          category: 'Core Concepts & Notes',
          description: 'Document and analyze any 5 hazardous chemicals found in electronic waste (e.g. Lead, Mercury, Cadmium, BFRs, Hexavalent Chromium), detailing their sources, toxicity, and health/environmental impact.',
          expected_files: JSON.stringify([
            'Handwritten notes or detailed laboratory report (PDF or scanned images)',
            'Chemical toxicology analysis breakdown'
          ]),
          state: ''
        },
        {
          id: 'sec-2',
          section_number: 2,
          order_index: 2,
          title: 'Assignment 3 — Elemental Recovery Process Update',
          category: 'Process & Recovery',
          description: 'Comprehensive study of elemental recovery pathways for precious and rare-earth metals (Gold, Copper, Palladium) from printed circuit boards, featuring process flowsheets and sorting techniques.',
          expected_files: JSON.stringify([
            'Recovery-process technical document',
            'Elemental extraction infographic diagram',
            'Pre-treatment & sorting-method content'
          ]),
          state: ''
        },
        {
          id: 'sec-3',
          section_number: 3,
          order_index: 3,
          title: 'Assignment 2 — Class Activity: Map of E-Waste',
          category: 'Class Activity',
          description: 'Geographic and structural mapping of electronic waste generation hubs, informal recycling clusters, and formal treatment plants, accompanied by reflective analysis.',
          expected_files: JSON.stringify([
            'E-Waste flow map (High-res image or PDF)',
            'Supporting classroom activity write-up'
          ]),
          state: ''
        },
        {
          id: 'sec-4',
          section_number: 4,
          order_index: 4,
          title: 'Assignment 1 — E-Waste Tracker',
          category: 'Data & Tracking',
          description: 'Institutional or municipal e-waste audit and tracking mechanism, quantifying electrical device lifecycles, assessment reports, and authorized recycler directory.',
          expected_files: JSON.stringify([
            'E-Waste tracker workbook (Excel / CSV)',
            'Comprehensive audit & assessment report (PDF/DOCX)',
            'Presentation deck (PPTX)',
            'Authorized recycler directory',
            'Optional interactive HTML dashboard'
          ]),
          state: ''
        },
        {
          id: 'sec-5',
          section_number: 5,
          order_index: 5,
          title: 'E-Waste India vs World — Data Task',
          category: 'Comparative Analysis',
          description: 'Statistical benchmarking of e-waste generation per capita, recycling rates, legislation enforcement, and transboundary movement comparing India with global benchmarks (EU, US, East Asia).',
          expected_files: JSON.stringify([
            'Comparative analysis data worksheets (Excel / CSV)',
            'Handwritten comparison notes or full study report'
          ]),
          state: ''
        },
        {
          id: 'sec-6',
          section_number: 6,
          order_index: 6,
          title: 'Carbon Footprint Task — Excel Activity',
          category: 'Excel Activity',
          description: 'Quantitative calculation of embodied carbon, Scope 1-3 greenhouse emissions saved through circular recycling vs virgin mining of electronic component metals.',
          expected_files: JSON.stringify([
            'Carbon footprint calculation workbook (Excel / CSV)',
            'Formula explanation & methodology document'
          ]),
          state: ''
        },
        {
          id: 'sec-7',
          section_number: 7,
          order_index: 7,
          title: 'TE CMPN C PPT — State Tracker Submission Folder',
          category: 'State Tracker & Presentation',
          description: 'State-level electronic waste inventory and compliance tracker with presentation slides. Allows direct linking of tracker artifacts from Assignment 1 without duplicating storage.',
          expected_files: JSON.stringify([
            'State tracker presentation slides (PPTX)',
            'Supporting tracker documents / data tables (linked or uploaded)'
          ]),
          state: ''
        },
        {
          id: 'sec-8',
          section_number: 8,
          order_index: 8,
          title: 'E-Waste Recovery Process — Modification for Design Patent',
          category: 'Patent & Innovation',
          description: 'Novel engineering modification to an existing mechanical or hydrometallurgical e-waste disassembly/recovery process drafted according to Indian Patent Office design specifications.',
          expected_files: JSON.stringify([
            'Patent design proposal & novel claims document',
            'Engineering process schematic / flowsheet diagram',
            'Supporting prior-art & technical brief'
          ]),
          state: ''
        },
        {
          id: 'sec-9',
          section_number: 9,
          order_index: 9,
          title: 'Indian Companies Following E-Waste Rules — Comparative Study',
          category: 'Policy & Industry Study',
          description: 'Critical investigation of Extended Producer Responsibility (EPR) compliance across top Indian tech manufacturers (OEMs), EPR targets, take-back channels, and PRO partnerships.',
          expected_files: JSON.stringify([
            'Comparative industry report (PDF/DOCX)',
            'EPR compliance matrix worksheet (Excel)',
            'Optional compliance calculator'
          ]),
          state: ''
        },
        {
          id: 'sec-10',
          section_number: 10,
          order_index: 10,
          title: 'Novel Idea — E-Waste Pitch Deck',
          category: 'Entrepreneurship & Innovation',
          description: 'Startup or institutional solution concept addressing urban e-waste collection, incentivized reverse logistics, AI-driven sorting, or circular refurbishing business models.',
          expected_files: JSON.stringify([
            'Pitch presentation deck (PPTX/PDF)',
            'Executive concept summary document'
          ]),
          state: ''
        },
        {
          id: 'sec-11',
          section_number: 11,
          order_index: 11,
          title: 'Campaign for E-Waste in Campus — Class Activity',
          category: 'Campus Awareness',
          description: 'Student-led institutional awareness drive: collection drives, educational posters, social media campaigns, and creative media aimed at Vidyalankar campus community.',
          expected_files: JSON.stringify([
            'Campaign execution report (PDF/DOCX)',
            'Awareness posters / comics / infographic designs',
            'Event photographs & documentation',
            'Optional campaign audio or video clip'
          ]),
          state: ''
        },
        {
          id: 'sec-12',
          section_number: 12,
          order_index: 12,
          title: 'LEED Certification of Green Buildings in India',
          category: 'Sustainability & Standards',
          description: 'Assessment of LEED green building rating system regarding construction e-waste management, energy efficiency, and hazardous material mitigation in Indian commercial infrastructure.',
          expected_files: JSON.stringify([
            'LEED credit assessment workbook (Excel)',
            'Evaluation report on Indian green building standards',
            'Optional points calculator'
          ]),
          state: ''
        },
        {
          id: 'sec-13',
          section_number: 13,
          order_index: 13,
          title: 'Case Studies E-Waste',
          category: 'Case Studies',
          description: 'Deep dive into real-world international and domestic e-waste scenarios (e.g. Agbogbloshie Ghana, Guiyu China, Moradabad India informal recycling, Seelampur Delhi).',
          expected_files: JSON.stringify([
            'Comprehensive case-study analysis report',
            'Case-study presentation deck (PPTX/PDF)'
          ]),
          state: ''
        },
        {
          id: 'sec-14',
          section_number: 14,
          order_index: 14,
          title: 'IEEE Paper Submission — Students',
          category: 'Research Publication',
          description: 'Academic research paper composed in two-column IEEE conference format analyzing technical, environmental, or algorithmic advances in smart e-waste management.',
          expected_files: JSON.stringify([
            'Manuscript in IEEE conference format (PDF)',
            'Editable manuscript source (DOCX or LaTeX files)'
          ]),
          state: ''
        }
      ]

      for (const sec of initialSections) {
        this.run(
          `INSERT INTO assignments (id, section_number, order_index, title, category, description, expected_files, notes, due_date, state, class_label, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, '', '', ?, 'TE CMPN C', ?, ?)`,
          [sec.id, sec.section_number, sec.order_index, sec.title, sec.category, sec.description, sec.expected_files, sec.state, now, now]
        )
      }

      this.logActivity('SYSTEM_INIT', 'EWEM Workspace initialized with 14 assignment sections for Trunal Patil', 'portfolio')
    }
  }

  public queryAll<T = DBRow>(sql: string, params: SqlValue[] = []): T[] {
    if (!this.db) return []
    const stmt = this.db.prepare(sql)
    if (params.length > 0) {
      stmt.bind(params)
    }

    const rows: T[] = []
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as T)
    }
    stmt.free()
    return rows
  }

  public queryOne<T = DBRow>(sql: string, params: SqlValue[] = []): T | null {
    const results = this.queryAll<T>(sql, params)
    return results.length > 0 ? results[0] : null
  }

  public run(sql: string, params: SqlValue[] = []): void {
    if (!this.db) return
    this.db.run(sql, params)
    this.schedulePersist()
  }

  public logActivity(actionType: string, description: string, entityId: string = ''): void {
    const id = 'act-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7)
    const now = new Date().toISOString()
    this.run(
      'INSERT INTO activity_logs (id, action_type, description, entity_id, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, actionType, description, entityId, now]
    )
  }
}

// Singleton database instance located in data/ewaste.sqlite or configured persistent volume via DB_PATH
const dataDir = path.resolve(process.cwd(), 'data')
const defaultDbPath = path.join(dataDir, 'ewaste.sqlite')
const dbPath = process.env.DB_PATH || defaultDbPath
export const db = new SQLiteDB(dbPath)
