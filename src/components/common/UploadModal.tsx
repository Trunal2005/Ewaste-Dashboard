import React, { useState, useRef } from 'react'
import {
  X,
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FolderPlus
} from 'lucide-react'
import { Assignment } from '../../types'
import { uploadAssignmentFiles } from '../../lib/api'
import { formatBytes } from '../../lib/utils'

interface UploadModalProps {
  assignments: Assignment[]
  defaultAssignmentId?: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function UploadModal({
  assignments,
  defaultAssignmentId = '',
  isOpen,
  onClose,
  onSuccess,
}: UploadModalProps) {
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(defaultAssignmentId)
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync defaultAssignmentId if updated
  React.useEffect(() => {
    setSelectedAssignmentId(defaultAssignmentId)
  }, [defaultAssignmentId])

  if (!isOpen) return null

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files))
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files))
    }
  }

  const addFiles = (newFiles: File[]) => {
    setError(null)
    setFiles((prev) => [...prev, ...newFiles])
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (files.length === 0) {
      setError('Please select at least one file to upload.')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const res = await uploadAssignmentFiles(files, selectedAssignmentId || undefined)
      setSuccessMsg(res.message || 'Files stored successfully')
      setTimeout(() => {
        setFiles([])
        setSuccessMsg(null)
        setIsUploading(false)
        onSuccess()
        onClose()
      }, 700)
    } catch (err: any) {
      setError(err.message || 'Failed to complete upload')
      setIsUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Upload className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Upload Portfolio Files</h2>
              <p className="font-mono text-xs text-muted-foreground">
                Persistent storage with original byte preservation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
          >
            <X className="size-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-500">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Target Section Selector */}
          <div>
            <label className="block text-xs font-mono font-medium text-muted-foreground mb-1.5">
              Target Assignment Section:
            </label>
            <select
              value={selectedAssignmentId}
              onChange={(e) => setSelectedAssignmentId(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono text-xs"
            >
              <option value="">General File Library (Unassigned)</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  Section {a.section_number}: {a.title} ({a.file_count} files added)
                </option>
              ))}
            </select>
          </div>

          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all ${
              isDragging
                ? 'border-primary bg-primary/10'
                : 'border-border/80 bg-secondary/30 hover:border-primary/50 hover:bg-secondary/60'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FolderPlus className="size-6" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Drop files here, or <span className="text-primary underline">browse</span>
              </p>
              <p className="font-mono text-[11px] text-muted-foreground">
                PDF, DOCX, PPTX, XLSX, CSV, PNG, JPG, MP3, MP4, HTML (up to 100MB)
              </p>
            </div>
          </div>

          {/* Selected Files List */}
          {files.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              <p className="text-xs font-mono text-muted-foreground">
                Selected files ({files.length}):
              </p>
              {files.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-xs font-mono border border-border"
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <FileText className="size-4 shrink-0 text-primary" />
                    <span className="truncate text-foreground">{file.name}</span>
                    <span className="text-muted-foreground shrink-0">({formatBytes(file.size)})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || files.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Storing Files...</span>
                </>
              ) : (
                <>
                  <Upload className="size-4" />
                  <span>Upload & Store {files.length > 0 ? `(${files.length})` : ''}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
