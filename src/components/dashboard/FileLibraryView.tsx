import React, { useState, useEffect } from 'react'
import {
  Database,
  Search,
  Filter,
  Download,
  Eye,
  Trash2,
  FileText,
  FileSpreadsheet,
  Film,
  Music,
  FileCode,
  Image as ImageIcon,
  CheckCircle2,
  Upload,
  HardDrive
} from 'lucide-react'
import { PortfolioFile, Assignment } from '../../types'
import { fetchFiles, deleteFilePermanently, getDownloadUrl } from '../../lib/api'
import { formatBytes, formatDate } from '../../lib/utils'

interface FileLibraryViewProps {
  assignments: Assignment[]
  onPreviewFile: (file: PortfolioFile) => void
  onOpenUpload: () => void
}

export function FileLibraryView({
  assignments,
  onPreviewFile,
  onOpenUpload,
}: FileLibraryViewProps) {
  const [files, setFiles] = useState<PortfolioFile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFormat, setSelectedFormat] = useState('all')
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('')
  const [fileToDelete, setFileToDelete] = useState<PortfolioFile | null>(null)

  const loadFiles = async () => {
    setLoading(true)
    try {
      const data = await fetchFiles({
        search: searchQuery,
        format: selectedFormat,
        assignmentId: selectedAssignmentId,
      })
      setFiles(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFiles()
  }, [searchQuery, selectedFormat, selectedAssignmentId])

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return
    try {
      await deleteFilePermanently(fileToDelete.id)
      setFileToDelete(null)
      loadFiles()
    } catch (err) {
      console.error(err)
    }
  }

  const formatTabs = [
    { id: 'all', label: 'All Formats' },
    { id: 'docs', label: 'PDF & Word' },
    { id: 'sheets', label: 'Excel & Data' },
    { id: 'slides', label: 'Presentations' },
    { id: 'images', label: 'Images' },
    { id: 'media', label: 'Audio & Video' },
    { id: 'html', label: 'HTML Dashboards' },
  ]

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
    <div className="mx-auto w-full max-w-screen-2xl space-y-6 px-4 py-6 sm:px-7 lg:px-9">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Database className="size-6 text-primary" />
            <span>Persistent File Library</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Central repository of all assignment deliverables stored with disk adapter and SQLite metadata.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenUpload}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all self-start sm:self-auto"
        >
          <Upload className="size-4" />
          <span>Upload Files</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by filename or keyword..."
              className="w-full rounded-lg border border-border bg-secondary pl-9 pr-4 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="size-3.5 text-muted-foreground" />
            <select
              value={selectedAssignmentId}
              onChange={(e) => setSelectedAssignmentId(e.target.value)}
              className="rounded-lg border border-border bg-secondary px-3 py-1.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
            >
              <option value="">All Assignment Sections</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  Section {a.section_number}: {a.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Format Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {formatTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedFormat(tab.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-mono shrink-0 transition-colors ${
                selectedFormat === tab.id
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* File List */}
      {loading ? (
        <div className="py-16 text-center font-mono text-xs text-muted-foreground">
          Querying SQLite storage...
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-secondary/20 py-16 text-center">
          <HardDrive className="size-10 text-muted-foreground mb-3 opacity-40" />
          <p className="font-mono text-sm text-foreground font-medium">No files stored in this view</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Files uploaded to any of the 14 assignment sections or via the upload button will appear in this durable library.
          </p>
          <button
            type="button"
            onClick={onOpenUpload}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Upload className="size-3.5" />
            <span>Upload Document</span>
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-sm hover:border-primary/40 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-secondary shrink-0 border border-border">
                    {getFormatIcon(file.extension)}
                  </div>
                  <span className="rounded bg-secondary px-2 py-0.5 font-mono text-[10px] text-primary uppercase font-semibold border border-border">
                    {file.extension.replace('.', '')}
                  </span>
                </div>

                <h3 className="font-semibold text-xs text-foreground line-clamp-1" title={file.original_name}>
                  {file.original_name}
                </h3>

                <p className="font-mono text-[11px] text-muted-foreground mt-1">
                  {formatBytes(file.size_bytes)} &bull; {formatDate(file.created_at)}
                </p>

                {/* Linked Assignment Chips */}
                {file.assignments && file.assignments.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {file.assignments.map((asgn, i) => (
                      <span
                        key={i}
                        className="rounded-md bg-secondary/80 px-2 py-0.5 font-mono text-[10px] text-muted-foreground border border-border/60 truncate max-w-[200px]"
                        title={asgn.title}
                      >
                        Sec {asgn.sectionNumber || ''}: {asgn.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                <span className="font-mono text-[10px] text-emerald-500 flex items-center gap-1">
                  <CheckCircle2 className="size-3" />
                  Preserved
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onPreviewFile(file)}
                    className="p-1.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Preview file"
                  >
                    <Eye className="size-3.5" />
                  </button>

                  <a
                    href={getDownloadUrl(file.id)}
                    download={file.original_name}
                    className="p-1.5 rounded text-muted-foreground hover:bg-muted hover:text-emerald-500"
                    title="Download original file"
                  >
                    <Download className="size-3.5" />
                  </a>

                  <button
                    type="button"
                    onClick={() => setFileToDelete(file)}
                    className="p-1.5 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Permanently delete from disk"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {fileToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75" onClick={() => setFileToDelete(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl space-y-4">
            <h4 className="font-semibold text-sm text-foreground">Permanently Delete File?</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This will remove <span className="font-mono text-foreground font-medium">"{fileToDelete.original_name}"</span> from all linked assignments and permanently delete the bytes from disk storage.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setFileToDelete(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-white hover:bg-destructive/90"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
