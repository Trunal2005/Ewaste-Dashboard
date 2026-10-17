import { Assignment, OverviewData, PortfolioFile, StudentSettings, ActivityLog } from '../types'

const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export function getAdminKey(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('ewem_admin_key') || ''
}

export function setAdminKey(key: string): void {
  if (typeof window === 'undefined') return
  if (key && key.trim()) {
    localStorage.setItem('ewem_admin_key', key.trim())
  } else {
    localStorage.removeItem('ewem_admin_key')
  }
}

export function isOwnerUnlocked(): boolean {
  return Boolean(getAdminKey())
}

function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const key = getAdminKey()
  const headers: Record<string, string> = { ...extraHeaders }
  if (key) {
    headers['x-admin-key'] = key
  }
  return headers
}

export async function fetchOverview(): Promise<OverviewData> {
  const res = await fetch(`${BASE_URL}/api/overview`)
  if (!res.ok) throw new Error('Failed to fetch overview data')
  return res.json()
}

export async function fetchAssignments(): Promise<Assignment[]> {
  const res = await fetch(`${BASE_URL}/api/assignments`)
  if (!res.ok) throw new Error('Failed to fetch assignments')
  return res.json()
}

export async function fetchAssignment(id: string): Promise<Assignment> {
  const res = await fetch(`${BASE_URL}/api/assignments/${id}`)
  if (!res.ok) throw new Error('Failed to fetch assignment details')
  return res.json()
}

export async function updateAssignment(
  id: string,
  data: Partial<Assignment>
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE_URL}/api/assignments/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to update assignment')
  }
  return res.json()
}

export async function fetchFiles(params?: {
  search?: string
  format?: string
  assignmentId?: string
}): Promise<PortfolioFile[]> {
  const query = new URLSearchParams()
  if (params?.search) query.append('search', params.search)
  if (params?.format && params.format !== 'all') query.append('format', params.format)
  if (params?.assignmentId) query.append('assignmentId', params.assignmentId)

  const url = `${BASE_URL}/api/files${query.toString() ? '?' + query.toString() : ''}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch files')
  return res.json()
}

export async function uploadAssignmentFiles(
  files: File[],
  assignmentId?: string
): Promise<{ success: boolean; files: PortfolioFile[]; message: string }> {
  const formData = new FormData()
  for (const file of files) {
    formData.append('files', file)
  }
  if (assignmentId) {
    formData.append('assignmentId', assignmentId)
  }

  const res = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to upload files')
  }
  return res.json()
}

export async function linkExistingFile(
  assignmentId: string,
  fileId: string
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE_URL}/api/assignments/${assignmentId}/link-file`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ fileId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to link file')
  }
  return res.json()
}

export async function unlinkFile(
  assignmentId: string,
  fileId: string
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE_URL}/api/assignments/${assignmentId}/files/${fileId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to unlink file')
  }
  return res.json()
}

export async function deleteFilePermanently(
  fileId: string
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE_URL}/api/files/${fileId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to delete file')
  }
  return res.json()
}

export async function fetchSettings(): Promise<StudentSettings> {
  const res = await fetch(`${BASE_URL}/api/settings`)
  if (!res.ok) throw new Error('Failed to fetch student settings')
  return res.json()
}

export async function updateSettings(
  settings: Partial<StudentSettings>
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE_URL}/api/settings`, {
    method: 'PATCH',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(settings),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to save settings')
  }
  return res.json()
}

export async function fetchActivity(): Promise<ActivityLog[]> {
  const res = await fetch(`${BASE_URL}/api/activity`)
  if (!res.ok) throw new Error('Failed to fetch activity logs')
  return res.json()
}

export function getDownloadUrl(fileId: string): string {
  return `${BASE_URL}/api/files/${fileId}/download`
}

export function getViewUrl(fileId: string): string {
  return `${BASE_URL}/api/files/${fileId}/view`
}

export function getSandboxHtmlUrl(fileId: string): string {
  return `${BASE_URL}/api/files/${fileId}/sandbox-html`
}
