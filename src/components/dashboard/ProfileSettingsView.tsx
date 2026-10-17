import React, { useState, useEffect } from 'react'
import {
  SlidersHorizontal,
  Save,
  Check,
  User,
  GraduationCap,
  Building,
  BookOpen,
  Calendar,
  Layers,
  MapPin,
  HardDrive,
  Database,
  FileCheck,
  Download,
  AlertCircle
} from 'lucide-react'
import { StudentSettings } from '../../types'
import { fetchSettings, updateSettings } from '../../lib/api'

interface ProfileSettingsViewProps {
  onSettingsSaved?: () => void
}

export function ProfileSettingsView({ onSettingsSaved }: ProfileSettingsViewProps) {
  const [settings, setSettings] = useState<StudentSettings>({
    student_name: 'Trunal Patil',
    roll_no: '24102C0026',
    subject: 'E-Waste Management (EWEM)',
    college: 'Vidyalankar Institute of Technology, Mumbai',
    program: 'Third Year B.Tech — Computer Engineering',
    academic_year: '',
    division: '',
    faculty_name: '',
    default_state: '',
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchSettings()
        setSettings({
          student_name: data.student_name || 'Trunal Patil',
          roll_no: data.roll_no || '24102C0026',
          subject: data.subject || 'E-Waste Management (EWEM)',
          college: data.college || 'Vidyalankar Institute of Technology, Mumbai',
          program: data.program || 'Third Year B.Tech — Computer Engineering',
          academic_year: data.academic_year || '',
          division: data.division || '',
          faculty_name: data.faculty_name || '',
          default_state: data.default_state || '',
        })
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErrorMessage(null)
    try {
      await updateSettings(settings)
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 2500)
      onSettingsSaved?.()
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const exportSummaryJSON = () => {
    const summaryData = {
      profile: settings,
      exportDate: new Date().toISOString(),
      platform: 'EWEM Workspace',
      storage: 'Persistent Local SQLite + Disk Storage',
    }
    const blob = new Blob([JSON.stringify(summaryData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `EWEM_Portfolio_${settings.roll_no || 'Profile'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-6 sm:px-7">
      {/* Top Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <SlidersHorizontal className="size-6 text-primary" />
            <span>Profile & Academic Settings</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Configure your personal identity, college metadata, division, and persistent storage preferences.
          </p>
        </div>

        <button
          type="button"
          onClick={exportSummaryJSON}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 font-mono text-xs text-foreground hover:bg-muted self-start sm:self-auto"
        >
          <Download className="size-3.5 text-primary" />
          <span>Export Summary JSON</span>
        </button>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center font-mono text-xs text-muted-foreground">
          Loading student configuration...
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Candidate Academic Details */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
            <h2 className="text-sm font-mono font-semibold uppercase tracking-wider text-primary flex items-center gap-2">
              <User className="size-4" />
              <span>Student & Institution Metadata</span>
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Name */}
              <div>
                <label className="block text-xs font-mono font-medium text-muted-foreground mb-1">
                  Student Name:
                </label>
                <input
                  type="text"
                  value={settings.student_name}
                  onChange={(e) => setSettings({ ...settings, student_name: e.target.value })}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                  required
                />
              </div>

              {/* Roll Number */}
              <div>
                <label className="block text-xs font-mono font-medium text-muted-foreground mb-1">
                  Roll Number:
                </label>
                <input
                  type="text"
                  value={settings.roll_no}
                  onChange={(e) => setSettings({ ...settings, roll_no: e.target.value })}
                  placeholder="e.g. 24102C0026"
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none font-mono"
                />
              </div>

              {/* College */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-mono font-medium text-muted-foreground mb-1">
                  College / Institution:
                </label>
                <input
                  type="text"
                  value={settings.college}
                  onChange={(e) => setSettings({ ...settings, college: e.target.value })}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              {/* Program */}
              <div>
                <label className="block text-xs font-mono font-medium text-muted-foreground mb-1">
                  Academic Program:
                </label>
                <input
                  type="text"
                  value={settings.program}
                  onChange={(e) => setSettings({ ...settings, program: e.target.value })}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-mono font-medium text-muted-foreground mb-1">
                  Subject / Course:
                </label>
                <input
                  type="text"
                  value={settings.subject}
                  onChange={(e) => setSettings({ ...settings, subject: e.target.value })}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              {/* Academic Year (Editable, initially blank as specified) */}
              <div>
                <label className="block text-xs font-mono font-medium text-muted-foreground mb-1">
                  Academic Year:
                </label>
                <input
                  type="text"
                  value={settings.academic_year}
                  onChange={(e) => setSettings({ ...settings, academic_year: e.target.value })}
                  placeholder="e.g. 2025-2026 (leave blank or fill)"
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none font-mono"
                />
              </div>

              {/* Division (Editable, initially blank as specified) */}
              <div>
                <label className="block text-xs font-mono font-medium text-muted-foreground mb-1">
                  Division / Class:
                </label>
                <input
                  type="text"
                  value={settings.division}
                  onChange={(e) => setSettings({ ...settings, division: e.target.value })}
                  placeholder="e.g. C / TE CMPN C"
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none font-mono"
                />
              </div>

              {/* Faculty / Guide Name (Editable, initially blank as specified) */}
              <div>
                <label className="block text-xs font-mono font-medium text-muted-foreground mb-1">
                  Faculty / Guide Name:
                </label>
                <input
                  type="text"
                  value={settings.faculty_name}
                  onChange={(e) => setSettings({ ...settings, faculty_name: e.target.value })}
                  placeholder="e.g. Prof. Name"
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              {/* Default State Field (for state-specific assignments) */}
              <div>
                <label className="block text-xs font-mono font-medium text-muted-foreground mb-1">
                  Default State (for state-specific tasks):
                </label>
                <input
                  type="text"
                  value={settings.default_state}
                  onChange={(e) => setSettings({ ...settings, default_state: e.target.value })}
                  placeholder="e.g. Maharashtra"
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none font-mono"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <span className="font-mono text-xs text-muted-foreground">
                {savedSuccess ? (
                  <span className="text-emerald-500 font-medium flex items-center gap-1">
                    <Check className="size-4" /> Profile settings saved to SQLite
                  </span>
                ) : (
                  'Metadata persists to database across reloads'
                )}
              </span>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
              >
                <Save className="size-4" />
                <span>{saving ? 'Saving...' : 'Save Profile'}</span>
              </button>
            </div>
          </div>

          {/* Storage Architecture Verification Box */}
          <div className="rounded-2xl border border-border bg-secondary/30 p-6 space-y-4">
            <h2 className="text-sm font-mono font-semibold uppercase tracking-wider text-foreground flex items-center gap-2">
              <HardDrive className="size-4 text-emerald-500" />
              <span>Durable Storage Architecture & Adapter Status</span>
            </h2>

            <div className="grid gap-3 sm:grid-cols-2 text-xs font-mono">
              <div className="rounded-lg bg-card p-3 border border-border/80 space-y-1">
                <span className="text-muted-foreground text-[11px]">Database Engine:</span>
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <Database className="size-3.5 text-primary" />
                  SQLite (sql.js / binary disk-backed)
                </p>
                <p className="text-[10px] text-muted-foreground">Location: data/ewaste.sqlite</p>
              </div>

              <div className="rounded-lg bg-card p-3 border border-border/80 space-y-1">
                <span className="text-muted-foreground text-[11px]">Storage Adapter:</span>
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <FileCheck className="size-3.5 text-emerald-500" />
                  LocalDiskStorageAdapter
                </p>
                <p className="text-[10px] text-muted-foreground">Uploads Directory: uploads/</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Files are stored under UUID keys while retaining original filenames and extensions in metadata. Byte integrity is verified via SHA-256 hashes. Storage persists across browser refreshes and server restarts.
            </p>
          </div>
        </form>
      )}
    </div>
  )
}
