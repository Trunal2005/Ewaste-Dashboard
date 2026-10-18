import initSqlJs, { Database, SqlValue } from 'sql.js'
import { sqlWasmBinary } from './sql-wasm-binary'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { createClient, Client } from '@libsql/client/http'

export interface DBRow {
  [key: string]: any
}

export interface AppDatabase {
  init(): Promise<void>
  queryAll<T = DBRow>(sql: string, params?: any[]): Promise<T[]>
  queryOne<T = DBRow>(sql: string, params?: any[]): Promise<T | null>
  run(sql: string, params?: any[]): Promise<void>
  logActivity(actionType: string, description: string, entityId?: string): Promise<void>
  isTurso(): boolean
  getType(): string
}

const INITIAL_SETTINGS: [string, string][] = [
  ['student_name', 'Trunal Patil'],
  ['roll_no', '24102C0026'],
  ['subject', 'E-Waste Management (EWEM)'],
  ['college', 'Vidyalankar Institute of Technology, Mumbai'],
  ['program', 'Third Year B.Tech — Computer Engineering'],
  ['academic_year', ''],
  ['division', ''],
  ['faculty_name', ''],
  ['default_state', ''],
]

const INITIAL_SECTIONS = [
  {
    id: 'sec-1',
    section_number: 1,
    order_index: 1,
    title: 'Toxic Chemicals — Any 5',
    category: 'Core Concepts & Notes',
    description: 'Document and analyze any 5 hazardous chemicals found in electronic waste (e.g. Lead, Mercury, Cadmium, BFRs, Hexavalent Chromium), detailing their sources, toxicity, and health/environmental impact.',
    expected_files: JSON.stringify([
      'Handwritten notes or detailed laboratory report (PDF or scanned images)',
      'Chemical toxicology analysis breakdown',
    ]),
    state: '',
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
      'Pre-treatment & sorting-method content',
    ]),
    state: '',
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
      'Supporting classroom activity write-up',
    ]),
    state: '',
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
      'Optional interactive HTML dashboard',
    ]),
    state: '',
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
      'Handwritten comparison notes or full study report',
    ]),
    state: '',
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
      'Formula explanation & methodology document',
    ]),
    state: '',
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
      'Supporting tracker documents / data tables (linked or uploaded)',
    ]),
    state: '',
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
      'Supporting prior-art & technical brief',
    ]),
    state: '',
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
      'Optional compliance calculator',
    ]),
    state: '',
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
      'Executive concept summary document',
    ]),
    state: '',
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
      'Optional campaign audio or video clip',
    ]),
    state: '',
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
      'Optional points calculator',
    ]),
    state: '',
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
      'Case-study presentation deck (PPTX/PDF)',
    ]),
    state: '',
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
      'Editable manuscript source (DOCX or LaTeX files)',
    ]),
    state: '',
  },
]

const TABLE_SCHEMAS = `
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
`

/**
 * Turso Cloud LibSQL Adapter for production.
 * Provides genuinely durable, transactional, concurrent SQL database operations.
 */
class TursoDatabaseAdapter implements AppDatabase {
  private client: Client
  private initPromise: Promise<void> | null = null

  constructor(url: string, authToken?: string) {
    this.client = createClient({
      url,
      authToken,
    })
  }

  isTurso(): boolean {
    return true
  }

  getType(): string {
    return 'Turso Cloud LibSQL (Transactional & Durable)'
  }

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise
    this.initPromise = this._doInit()
    try {
      await this.initPromise
    } finally {
      this.initPromise = null
    }
  }

  private async _doInit(): Promise<void> {
    console.log('[EWEM DB] Connected to Turso cloud database. Ensuring schema integrity...')
    await this.client.executeMultiple(TABLE_SCHEMAS)

    // Check settings
    const settingsCheck = await this.client.execute('SELECT COUNT(*) as cnt FROM settings')
    const settingsCnt = Number(settingsCheck.rows[0]?.cnt || 0)
    if (settingsCnt === 0) {
      for (const [key, value] of INITIAL_SETTINGS) {
        await this.client.execute({
          sql: 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING',
          args: [key, value],
        })
      }
    }

    // Check assignments
    const countCheck = await this.client.execute('SELECT COUNT(*) as cnt FROM assignments')
    const count = Number(countCheck.rows[0]?.cnt || 0)
    if (count === 0) {
      const now = new Date().toISOString()
      for (const sec of INITIAL_SECTIONS) {
        await this.client.execute({
          sql: `INSERT INTO assignments (id, section_number, order_index, title, category, description, expected_files, notes, due_date, state, class_label, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, '', '', ?, 'TE CMPN C', ?, ?)`,
          args: [sec.id, sec.section_number, sec.order_index, sec.title, sec.category, sec.description, sec.expected_files, sec.state, now, now],
        })
      }
      await this.logActivity('SYSTEM_INIT', 'EWEM Workspace initialized with 14 assignment sections for Trunal Patil', 'portfolio')
    }
  }

  async queryAll<T = DBRow>(sql: string, params: any[] = []): Promise<T[]> {
    const res = await this.client.execute({ sql, args: params })
    return res.rows as unknown as T[]
  }

  async queryOne<T = DBRow>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.queryAll<T>(sql, params)
    return rows.length > 0 ? rows[0] : null
  }

  async run(sql: string, params: any[] = []): Promise<void> {
    await this.client.execute({ sql, args: params })
  }

  async logActivity(actionType: string, description: string, entityId: string = ''): Promise<void> {
    const id = 'act-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7)
    const now = new Date().toISOString()
    await this.run(
      'INSERT INTO activity_logs (id, action_type, description, entity_id, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, actionType, description, entityId, now]
    )
  }
}

/**
 * Local SQLite Adapter for development.
 * Reads and writes directly to local data/ewaste.sqlite using sql.js.
 */
class SQLiteLocalAdapter implements AppDatabase {
  private db: Database | null = null
  private dbFilePath: string
  private initPromise: Promise<void> | null = null

  constructor(dbFilePath: string) {
    this.dbFilePath = dbFilePath
  }

  isTurso(): boolean {
    return false
  }

  getType(): string {
    const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
    return isVercel
      ? 'Ephemeral Serverless (/tmp) — Turso Not Connected'
      : 'Local SQLite (data/ewaste.sqlite)'
  }

  async init(): Promise<void> {
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

    const dbDir = path.dirname(this.dbFilePath)
    try {
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true })
      }
    } catch {
      // Safe on read-only environments
    }

    if (fs.existsSync(this.dbFilePath)) {
      try {
        const fileBuffer = fs.readFileSync(this.dbFilePath)
        this.db = new SQL.Database(fileBuffer)
      } catch (err) {
        console.warn('[EWEM DB] Failed to read database from file, initializing fresh:', err)
        this.db = new SQL.Database()
      }
    } else {
      this.db = new SQL.Database()
    }

    this.createTables()
    this.seedInitialData()
    this.persistSync()
  }

  public persistSync(): void {
    if (!this.db) return
    try {
      const data = this.db.export()
      const buffer = Buffer.from(data)
      const dir = path.dirname(this.dbFilePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(this.dbFilePath, buffer)
    } catch (e) {
      // Safe on read-only environments
    }
  }

  private createTables(): void {
    if (!this.db) return
    this.db.run(TABLE_SCHEMAS)
  }

  private seedInitialData(): void {
    if (!this.db) return
    const settingsCheck = this._queryAllSync('SELECT * FROM settings WHERE key = "student_name"')
    if (settingsCheck.length === 0) {
      for (const [key, value] of INITIAL_SETTINGS) {
        this._runSync('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value])
      }
    }

    const countCheck = this._queryAllSync('SELECT COUNT(*) as cnt FROM assignments')
    if (countCheck[0]?.cnt === 0) {
      const now = new Date().toISOString()
      for (const sec of INITIAL_SECTIONS) {
        this._runSync(
          `INSERT INTO assignments (id, section_number, order_index, title, category, description, expected_files, notes, due_date, state, class_label, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, '', '', ?, 'TE CMPN C', ?, ?)`,
          [sec.id, sec.section_number, sec.order_index, sec.title, sec.category, sec.description, sec.expected_files, sec.state, now, now]
        )
      }
      this._logActivitySync('SYSTEM_INIT', 'EWEM Workspace initialized with 14 assignment sections for Trunal Patil', 'portfolio')
    }
  }

  private _queryAllSync<T = DBRow>(sql: string, params: SqlValue[] = []): T[] {
    if (!this.db) return []
    const stmt = this.db.prepare(sql)
    if (params.length > 0) stmt.bind(params)
    const rows: T[] = []
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as T)
    }
    stmt.free()
    return rows
  }

  private _runSync(sql: string, params: SqlValue[] = []): void {
    if (!this.db) return
    this.db.run(sql, params)
    this.persistSync()
  }

  private _logActivitySync(actionType: string, description: string, entityId: string = ''): void {
    const id = 'act-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7)
    const now = new Date().toISOString()
    this._runSync(
      'INSERT INTO activity_logs (id, action_type, description, entity_id, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, actionType, description, entityId, now]
    )
  }

  async queryAll<T = DBRow>(sql: string, params: any[] = []): Promise<T[]> {
    return this._queryAllSync<T>(sql, params as SqlValue[])
  }

  async queryOne<T = DBRow>(sql: string, params: any[] = []): Promise<T | null> {
    const results = await this.queryAll<T>(sql, params)
    return results.length > 0 ? results[0] : null
  }

  async run(sql: string, params: any[] = []): Promise<void> {
    this._runSync(sql, params as SqlValue[])
  }

  async logActivity(actionType: string, description: string, entityId: string = ''): Promise<void> {
    this._logActivitySync(actionType, description, entityId)
  }
}

/**
 * Creates the appropriate database adapter.
 * Uses Turso Cloud LibSQL if TURSO_DATABASE_URL or LIBSQL_URL is defined.
 * Otherwise, uses the local SQLite file adapter.
 */
export function createDatabase(): AppDatabase {
  const tursoUrl = process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL
  const tursoToken = process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN

  if (tursoUrl) {
    console.log(`[EWEM DB] Using Turso LibSQL adapter: ${tursoUrl.replace(/:[^:@]+@/, ':***@')}`)
    return new TursoDatabaseAdapter(tursoUrl, tursoToken)
  }

  const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
  const defaultDbPath = isVercel
    ? path.join(os.tmpdir(), 'ewaste.sqlite')
    : path.resolve(process.cwd(), 'data', 'ewaste.sqlite')
  const dbPath = process.env.DB_PATH || defaultDbPath

  return new SQLiteLocalAdapter(dbPath)
}

export const db: AppDatabase = createDatabase()
