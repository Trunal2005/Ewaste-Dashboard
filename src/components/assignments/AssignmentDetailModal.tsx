import React, { useState, useRef } from 'react'
import {
  X,
  Upload,
  Download,
  Eye,
  Trash2,
  RefreshCw,
  Link as LinkIcon,
  Save,
  CheckCircle2,
  Calendar,
  MapPin,
  Tag,
  AlertCircle,
  FileText,
  FileSpreadsheet,
  Film,
  Music,
  FileCode,
  Image as ImageIcon,
  Edit3,
  Check,
  FolderOpen
} from 'lucide-react'
import { Assignment, PortfolioFile } from '../../types'
import {
  updateAssignment,
  uploadAssignmentFiles,
  unlinkFile,
  linkExistingFile,
  fetchFiles,
  getDownloadUrl
} from '../../lib/api'
import { formatBytes, formatDate } from '../../lib/utils'

interface AssignmentDetailModalProps {
  assignment: Assignment | null
  onClose: () => void
  onRefresh: () => void
  onPreviewFile: (file: PortfolioFile) => void
}

export function AssignmentDetailModal({
  assignment,
  onClose,
  onRefresh,
  onPreviewFile,
}: AssignmentDetailModalProps) {
  if (!assignment) return null

  // Local state for editable fields
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [title, setTitle] = useState(assignment.title)
  const [category, setCategory] = useState(assignment.category)
  const [description, setDescription] = useState(assignment.description)
  const [notes, setNotes] = useState(assignment.notes || '')
  const [dueDate, setDueDate] = useState(assignment.due_date || '')
  const [stateName, setStateName] = useState(assignment.state || '')
  const [classLabel, setClassLabel] = useState(assignment.class_label || 'TE CMPN C')

  // UI state
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // File Removal Confirmation
  const [fileToRemove, setFileToRemove] = useState<PortfolioFile | null>(null)

  // Link Existing File Drawer/Dialog
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [availableLibraryFiles, setAvailableLibraryFiles] = useState<PortfolioFile[]>([])
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const replaceFileInputRef = useRef<HTMLInputElement>(null)
  const [fileToReplace, setFileToReplace] = useState<PortfolioFile | null>(null)

  // Sync state if assignment prop changes
  React.useEffect(() => {
    setTitle(assignment.title)
    setCategory(assignment.category)
    setDescription(assignment.description)
    setNotes(assignment.notes || '')
    setDueDate(assignment.due_date || '')
    setStateName(assignment.state || '')
    setClassLabel(assignment.class_label || 'TE CMPN C')
  }, [assignment])

  // Save metadata changes (Title, notes, due date, state, class label)
  const handleSaveChanges = async () => {
    setIsSaving(true)
    setErrorMessage(null)
    try {
      await updateAssignment(assignment.id, {
        title,
        category,
        description,
        notes,
        due_date: dueDate,
        state: stateName,
        class_label: classLabel,
      })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
      setIsEditingTitle(false)
      onRefresh()
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }

  // Handle Drag & Drop upload
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleUploadFiles(Array.from(e.dataTransfer.files))
    }
  }

  const handleUploadFiles = async (files: File[]) => {
    setIsUploading(true)
    setErrorMessage(null)
    try {
      await uploadAssignmentFiles(files, assignment.id)
      onRefresh()
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to upload files')
    } finally {
      setIsUploading(false)
    }
  }

  // Handle File Replacement
  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !fileToReplace) return
    const newFile = e.target.files[0]
    setIsUploading(true)
    setErrorMessage(null)

    try {
      // 1. Upload new file to this assignment
      await uploadAssignmentFiles([newFile], assignment.id)
      // 2. Unlink old file
      await unlinkFile(assignment.id, fileToReplace.id)
      setFileToReplace(null)
      onRefresh()
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to replace file')
    } finally {
      setIsUploading(false)
      if (replaceFileInputRef.current) replaceFileInputRef.current.value = ''
    }
  }

  // Confirm and Remove File
  const handleConfirmRemove = async () => {
    if (!fileToRemove) return
    try {
      await unlinkFile(assignment.id, fileToRemove.id)
      setFileToRemove(null)
      onRefresh()
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to remove file')
    }
  }

  // Open Link Existing Files Dialog
  const handleOpenLinkDialog = async () => {
    setShowLinkDialog(true)
    setIsLoadingLibrary(true)
    try {
      const allFiles = await fetchFiles()
      // Filter out files already linked to this assignment
      const existingFileIds = new Set(assignment.files.map((f) => f.id))
      setAvailableLibraryFiles(allFiles.filter((f) => !existingFileIds.has(f.id)))
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load file library')
    } finally {
      setIsLoadingLibrary(false)
    }
  }

  const handleLinkFile = async (fileId: string) => {
    try {
      await linkExistingFile(assignment.id, fileId)
      setShowLinkDialog(false)
      onRefresh()
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to link file')
    }
  }

  const getFormatIcon = (ext: string) => {
    const cleanExt = ext.toLowerCase().replace('.', '')
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(cleanExt)) return <ImageIcon className="size-4 text-emerald-400" />
    if (['xlsx', 'xls', 'csv'].includes(cleanExt)) return <FileSpreadsheet className="size-4 text-green-500" />
    if (['pptx', 'ppt'].includes(cleanExt)) return <Film className="size-4 text-amber-500" />
    if (['mp3', 'wav'].includes(cleanExt)) return <Music className="size-4 text-purple-400" />
    if (['mp4', 'webm'].includes(cleanExt)) return <Film className="size-4 text-red-400" />
    if (['html', 'htm'].includes(cleanExt)) return <FileCode className="size-4 text-orange-400" />
    return <FileText className="size-4 text-primary" />
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Main Modal Box */}
      <div className="relative z-10 w-full max-w-4xl rounded-2xl border border-border bg-card p-5 sm:p-7 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Hidden replacement file input */}
        <input
          ref={replaceFileInputRef}
          type="file"
          onChange={handleReplaceFile}
          className="hidden"
        />

        {/* Header Bar */}
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4 mb-4 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="flex size-6 items-center justify-center rounded-md font-mono text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                {assignment.section_number}
              </span>
              <span className="rounded bg-secondary px-2 py-0.5 font-mono text-[11px] text-muted-foreground border border-border">
                {category}
              </span>
              {assignment.section_number === 7 && (
                <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary border border-primary/20">
                  Class: {classLabel}
                </span>
              )}
              {stateName && (
                <span className="rounded bg-secondary px-2 py-0.5 font-mono text-[11px] text-foreground border border-border flex items-center gap-1">
                  <MapPin className="size-3 text-primary" />
                  State: {stateName}
                </span>
              )}
            </div>

            {isEditingTitle ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="rounded-lg border border-primary bg-secondary px-3 py-1.5 text-base font-semibold text-foreground w-full focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(false)}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground truncate">
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(true)}
                  className="text-muted-foreground hover:text-foreground p-1"
                  title="Rename assignment"
                >
                  <Edit3 className="size-4" />
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive shrink-0">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          {/* Assignment Description */}
          <div className="rounded-xl bg-secondary/40 p-4 border border-border/80 text-xs text-muted-foreground leading-relaxed">
            <p>{description}</p>
          </div>

          {/* Deliverables Checklist (Files Needed) */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary" />
                <span>Files Needed Checklist</span>
              </h3>
              <span className="font-mono text-[11px] text-muted-foreground">
                {assignment.file_count > 0 ? `${assignment.file_count} file(s) added` : '0 files added'}
              </span>
            </div>
            <ul className="space-y-1.5">
              {assignment.expected_files.map((req, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-xs text-foreground/90 rounded-md bg-secondary/50 px-2.5 py-1.5 border border-border/40 font-mono"
                >
                  <span className="text-primary font-bold mt-0.5">&bull;</span>
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Drag & Drop Upload Zone + Link File Button */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-semibold tracking-wider text-muted-foreground uppercase">
                Add Section Documents
              </h3>
              <button
                type="button"
                onClick={handleOpenLinkDialog}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 py-1 text-xs font-mono text-foreground hover:bg-muted transition-colors"
                title="Link existing file from another section without duplicate storage"
              >
                <LinkIcon className="size-3 text-primary" />
                <span>Link from Library</span>
              </button>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                setIsDragging(false)
              }}
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
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleUploadFiles(Array.from(e.target.files))
                  }
                }}
                className="hidden"
              />
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Upload className="size-5" />
                </div>
                <p className="text-xs font-medium text-foreground">
                  {isUploading ? (
                    'Storing file persistently...'
                  ) : (
                    <>
                      Drop files to add to Section {assignment.section_number}, or <span className="text-primary underline">browse</span>
                    </>
                  )}
                </p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  PDF, DOCX, PPTX, XLSX, CSV, PNG, JPG, MP3, MP4, HTML (persisted in SQLite + disk adapter)
                </p>
              </div>
            </div>
          </div>

          {/* Uploaded Files Cards List */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono font-semibold tracking-wider text-muted-foreground uppercase flex items-center justify-between">
              <span>Section Documents ({assignment.files.length})</span>
              {assignment.files.length > 0 && (
                <span className="text-emerald-500 font-medium lowercase">Files added &bull; Ready for review</span>
              )}
            </h3>

            {assignment.files.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-8 text-center">
                <FolderOpen className="size-8 mx-auto text-muted-foreground mb-2 opacity-50" />
                <p className="font-mono text-xs text-muted-foreground">
                  Your assignment files will appear here.
                </p>
                <p className="text-[11px] text-muted-foreground/80 mt-1">
                  Upload expected deliverables or link existing files from the library.
                </p>
              </div>
            ) : (
              <div className="grid gap-2.5">
                {assignment.files.map((file) => (
                  <div
                    key={file.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-secondary shrink-0 border border-border/80">
                        {getFormatIcon(file.extension)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-foreground">
                          {file.original_name}
                        </p>
                        <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground mt-0.5">
                          <span className="uppercase text-primary font-medium">{file.extension}</span>
                          <span>&bull;</span>
                          <span>{formatBytes(file.size_bytes)}</span>
                          <span>&bull;</span>
                          <span>{formatDate(file.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => onPreviewFile(file)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary px-2.5 py-1 text-xs font-mono font-medium text-foreground hover:bg-muted"
                        title="Preview file"
                      >
                        <Eye className="size-3.5 text-primary" />
                        <span>Preview</span>
                      </button>

                      <a
                        href={getDownloadUrl(file.id)}
                        download={file.original_name}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary px-2.5 py-1 text-xs font-mono font-medium text-foreground hover:bg-muted"
                        title="Download original file bytes"
                      >
                        <Download className="size-3.5 text-emerald-500" />
                        <span>Download</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          setFileToReplace(file)
                          replaceFileInputRef.current?.click()
                        }}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Replace file"
                      >
                        <RefreshCw className="size-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setFileToRemove(file)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Remove file from section"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section Metadata & Notes Settings */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <h3 className="text-xs font-mono font-semibold tracking-wider text-muted-foreground uppercase">
              Section Metadata & Faculty Notes
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* Optional Due Date */}
              <div>
                <label className="block text-[11px] font-mono text-muted-foreground mb-1">
                  Optional Target Due Date:
                </label>
                <div className="relative">
                  <Calendar className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-lg border border-border bg-secondary pl-9 pr-3 py-1.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* State Field (For state-specific assignments e.g. Section 7) */}
              <div>
                <label className="block text-[11px] font-mono text-muted-foreground mb-1">
                  Assigned State / Region:
                </label>
                <div className="relative">
                  <MapPin className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                  <input
                    type="text"
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    placeholder="e.g. Maharashtra (leave unset if unassigned)"
                    className="w-full rounded-lg border border-border bg-secondary pl-9 pr-3 py-1.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Class Label for Section 7 */}
              {assignment.section_number === 7 && (
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-mono text-muted-foreground mb-1">
                    Editable Class / Division Label:
                  </label>
                  <input
                    type="text"
                    value={classLabel}
                    onChange={(e) => setClassLabel(e.target.value)}
                    placeholder="TE CMPN C"
                    className="w-full rounded-lg border border-border bg-secondary px-3 py-1.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Editable Notes Textarea */}
            <div>
              <label className="block text-[11px] font-mono text-muted-foreground mb-1">
                Personal Notes & Faculty Evaluation Pointers:
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Write specific notes, chemical citations, or experiment observations here..."
                className="w-full rounded-lg border border-border bg-secondary p-3 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-mono text-muted-foreground">
                {saveSuccess ? (
                  <span className="text-emerald-500 font-medium flex items-center gap-1">
                    <Check className="size-3.5" /> Notes and metadata saved
                  </span>
                ) : (
                  'Changes persist to SQLite database'
                )}
              </span>
              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
              >
                <Save className="size-3.5" />
                <span>Save Notes</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Bar */}
        <div className="border-t border-border pt-3 mt-3 flex items-center justify-between shrink-0">
          <p className="font-mono text-xs text-muted-foreground">
            Section {assignment.section_number} of 14 &bull; Vidyalankar Institute of Technology
          </p>
          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-secondary px-4 py-1.5 text-xs font-mono font-medium text-foreground hover:bg-muted"
          >
            Close Section
          </button>
        </div>
      </div>

      {/* Confirmation Dialog for File Removal */}
      {fileToRemove && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70" onClick={() => setFileToRemove(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl space-y-4">
            <h4 className="font-semibold text-sm text-foreground">Remove file from Section {assignment.section_number}?</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to unlink <span className="font-mono text-foreground font-medium">"{fileToRemove.original_name}"</span>?
              The original file will remain safely in the File Library.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setFileToRemove(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemove}
                className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-white hover:bg-destructive/90"
              >
                Confirm Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Existing File Dialog */}
      {showLinkDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70" onClick={() => setShowLinkDialog(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-2xl space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <LinkIcon className="size-4 text-primary" />
                <h4 className="font-semibold text-sm text-foreground">Link Existing File to Section {assignment.section_number}</h4>
              </div>
              <button onClick={() => setShowLinkDialog(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Select an already uploaded file from your library (e.g. tracker spreadsheets or presentations from Assignment 1) to link without duplicate storage:
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {isLoadingLibrary ? (
                <p className="font-mono text-xs text-muted-foreground text-center py-6">Loading files...</p>
              ) : availableLibraryFiles.length === 0 ? (
                <p className="font-mono text-xs text-muted-foreground text-center py-6">
                  No other unlinked files found in your library. Upload files first.
                </p>
              ) : (
                availableLibraryFiles.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between rounded-lg bg-secondary p-2.5 border border-border text-xs hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {getFormatIcon(f.extension)}
                      <span className="truncate font-medium text-foreground">{f.original_name}</span>
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">({formatBytes(f.size_bytes)})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleLinkFile(f.id)}
                      className="rounded bg-primary/10 px-2 py-1 font-mono text-[11px] font-medium text-primary hover:bg-primary/20 shrink-0"
                    >
                      Link
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-border pt-3 flex justify-end">
              <button
                onClick={() => setShowLinkDialog(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
