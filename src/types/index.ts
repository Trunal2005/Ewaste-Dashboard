export interface LinkedAssignment {
  id: string
  sectionNumber?: number
  title: string
}

export interface PortfolioFile {
  id: string
  original_name: string
  extension: string
  mime_type: string
  size_bytes: number
  storage_key: string
  sha256?: string
  created_at: string
  linked_at?: string
  assignments?: LinkedAssignment[]
}

export interface Assignment {
  id: string
  section_number: number
  order_index: number
  title: string
  category: string
  description: string
  expected_files: string[]
  notes: string
  due_date: string
  state: string
  class_label: string
  created_at: string
  updated_at: string
  files: PortfolioFile[]
  file_count: number
}

export interface StudentSettings {
  student_name: string
  roll_no: string
  subject: string
  college: string
  program: string
  academic_year: string
  division: string
  faculty_name: string
  default_state: string
}

export interface OverviewData {
  totalSections: number
  sectionsWithFiles: number
  sectionsAwaitingFiles: number
  totalFiles: number
  progressPercent: number
  nextEmptySection: Assignment | null
  recentUploads: PortfolioFile[]
  settings: StudentSettings
}

export interface ActivityLog {
  id: string
  action_type: string
  description: string
  entity_id: string
  created_at: string
}
