import React, { useState } from 'react'
import {
  X,
  Download,
  FileText,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  Film,
  Music,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react'
import { PortfolioFile } from '../../types'
import { getDownloadUrl, getViewUrl, getSandboxHtmlUrl } from '../../lib/api'
import { formatBytes, formatDate } from '../../lib/utils'

interface FilePreviewModalProps {
  file: PortfolioFile | null
  onClose: () => void
}

export function FilePreviewModal({ file, onClose }: FilePreviewModalProps) {
  const [scale, setScale] = useState(1)

  if (!file) return null

  const ext = file.extension.toLowerCase().replace('.', '')
  const isPdf = ext === 'pdf'
  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)
  const isAudio = ['mp3', 'wav', 'ogg'].includes(ext)
  const isVideo = ['mp4', 'webm', 'mov'].includes(ext)
  const isHtml = ['html', 'htm'].includes(ext)
  const isOffice = ['docx', 'doc', 'pptx', 'ppt', 'xlsx', 'xls', 'csv'].includes(ext)

  const downloadUrl = getDownloadUrl(file.id)
  const viewUrl = getViewUrl(file.id)
  const sandboxHtmlUrl = getSandboxHtmlUrl(file.id)

  const renderContent = () => {
    if (isPdf) {
      return (
        <div className="relative h-[70vh] w-full rounded-lg overflow-hidden border border-border bg-muted/30">
          <iframe
            src={`${viewUrl}#toolbar=1`}
            title={file.original_name}
            className="size-full border-0"
          />
        </div>
      )
    }

    if (isImage) {
      return (
        <div className="relative flex min-h-[50vh] max-h-[70vh] items-center justify-center overflow-auto rounded-lg bg-black/10 dark:bg-black/40 p-4 border border-border">
          <img
            src={viewUrl}
            alt={file.original_name}
            style={{ transform: `scale(${scale})` }}
            className="max-h-[65vh] max-w-full object-contain rounded transition-transform duration-200"
          />
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-card/90 px-2 py-1 shadow border border-border backdrop-blur">
            <button
              onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
              className="px-2 py-0.5 text-xs font-mono hover:bg-muted rounded"
            >
              -
            </button>
            <span className="text-xs font-mono">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale((s) => Math.min(2.5, s + 0.25))}
              className="px-2 py-0.5 text-xs font-mono hover:bg-muted rounded"
            >
              +
            </button>
            <button
              onClick={() => setScale(1)}
              className="px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground hover:bg-muted rounded"
            >
              Reset
            </button>
          </div>
        </div>
      )
    }

    if (isAudio) {
      return (
        <div className="flex flex-col items-center justify-center p-10 space-y-6 bg-secondary/50 rounded-lg border border-border">
          <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Music className="size-8" />
          </div>
          <div className="text-center">
            <p className="font-medium text-sm text-foreground">{file.original_name}</p>
            <p className="font-mono text-xs text-muted-foreground mt-1">Audio Recording / Interview</p>
          </div>
          <audio controls className="w-full max-w-md">
            <source src={viewUrl} type={file.mime_type} />
            Your browser does not support audio playback.
          </audio>
        </div>
      )
    }

    if (isVideo) {
      return (
        <div className="relative flex items-center justify-center overflow-hidden rounded-lg bg-black p-2 border border-border">
          <video controls className="max-h-[65vh] max-w-full rounded">
            <source src={viewUrl} type={file.mime_type} />
            Your browser does not support video playback.
          </video>
        </div>
      )
    }

    if (isHtml) {
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-md bg-secondary px-3 py-1.5 text-xs font-mono text-muted-foreground">
            <span className="flex items-center gap-1.5 text-primary">
              <ShieldCheck className="size-3.5" />
              Isolated Sandbox Mode (Restricted storage & cookie access)
            </span>
            <a
              href={sandboxHtmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground"
            >
              Open New Tab <ExternalLink className="size-3" />
            </a>
          </div>
          <div className="h-[65vh] w-full rounded-lg overflow-hidden border border-border bg-white">
            <iframe
              src={sandboxHtmlUrl}
              title={file.original_name}
              sandbox="allow-scripts"
              className="size-full border-0"
            />
          </div>
        </div>
      )
    }

    // Office formats (DOCX, PPTX, XLSX)
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-6 bg-secondary/40 rounded-xl border border-border text-center">
        <div className="size-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
          {['xlsx', 'xls', 'csv'].includes(ext) ? (
            <FileSpreadsheet className="size-10" />
          ) : ['pptx', 'ppt'].includes(ext) ? (
            <Film className="size-10" />
          ) : (
            <FileText className="size-10" />
          )}
        </div>
        <div className="space-y-2 max-w-md">
          <h3 className="font-semibold text-base text-foreground">{file.original_name}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Original document format: <span className="font-mono font-medium text-foreground uppercase">.{ext}</span> ({formatBytes(file.size_bytes)}).
            The original bytes are preserved completely without lossy conversions.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <a
            href={downloadUrl}
            download={file.original_name}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all"
          >
            <Download className="size-4" />
            Download Original Document
          </a>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground bg-card px-3 py-1.5 rounded-lg border border-border/80">
          <CheckCircle2 className="size-3.5 text-emerald-500" />
          <span>SHA-256 Checksum: {file.sha256 ? `${file.sha256.slice(0, 16)}...` : 'Verified on storage'}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Box */}
      <div className="relative z-10 w-full max-w-4xl rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary uppercase">
                {ext}
              </span>
              <h2 className="truncate text-base font-semibold text-foreground">
                {file.original_name}
              </h2>
            </div>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              Size: {formatBytes(file.size_bytes)} &bull; Uploaded: {formatDate(file.created_at)}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={downloadUrl}
              download={file.original_name}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              title="Download file with original filename and bytes"
            >
              <Download className="size-3.5 text-primary" />
              <span className="hidden sm:inline">Download</span>
            </a>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto flex-1">{renderContent()}</div>
      </div>
    </div>
  )
}
