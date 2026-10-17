import React, { useState } from 'react'
import {
  Airplay,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  CheckCircle2,
  CircleDashed,
  FileText,
  FileSpreadsheet,
  Film,
  Music,
  FileCode,
  Image as ImageIcon,
  ExternalLink,
  ShieldCheck,
  User,
  GraduationCap
} from 'lucide-react'
import { Assignment, PortfolioFile, StudentSettings } from '../../types'
import { getDownloadUrl, getViewUrl, getSandboxHtmlUrl } from '../../lib/api'
import { formatBytes, formatDate } from '../../lib/utils'

interface PresentationViewProps {
  assignments: Assignment[]
  settings?: StudentSettings
  onPreviewFile: (file: PortfolioFile) => void
}

export function PresentationView({
  assignments,
  settings,
  onPreviewFile,
}: PresentationViewProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const current = assignments[selectedIndex] || assignments[0]

  const prevSection = () => {
    setSelectedIndex((idx) => Math.max(0, idx - 1))
  }

  const nextSection = () => {
    setSelectedIndex((idx) => Math.min(assignments.length - 1, idx + 1))
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
    <div className="mx-auto w-full max-w-screen-2xl space-y-6 px-4 py-6 sm:px-7 lg:px-9">
      {/* Presentation Top Bar for Professor Evaluation */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between rounded-2xl border border-primary/30 bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Airplay className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-primary uppercase">
                Presentation & Evaluation Mode
              </span>
              <span className="rounded bg-secondary px-2 py-0.2 font-mono text-[10px] text-muted-foreground border border-border">
                {settings?.roll_no ? `Roll: ${settings.roll_no}` : 'Roll: 24102C0026'}
              </span>
            </div>
            <h1 className="text-lg font-bold text-foreground">
              {settings?.student_name || 'Trunal Patil'} &mdash; E-Waste Management (EWEM) Portfolio
            </h1>
            <p className="font-mono text-xs text-muted-foreground">
              {settings?.college || 'Vidyalankar Institute of Technology, Mumbai'} &bull; {settings?.program || 'Third Year B.Tech — Computer Engineering'}
            </p>
          </div>
        </div>

        {/* Section Navigation Buttons */}
        <div className="flex items-center gap-2 self-start lg:self-auto">
          <button
            type="button"
            onClick={prevSection}
            disabled={selectedIndex === 0}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary px-3 py-1.5 font-mono text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
            <span>Prev Section</span>
          </button>
          <span className="font-mono text-xs px-2 text-muted-foreground">
            {selectedIndex + 1} / {assignments.length}
          </span>
          <button
            type="button"
            onClick={nextSection}
            disabled={selectedIndex === assignments.length - 1}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary px-3 py-1.5 font-mono text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40"
          >
            <span>Next Section</span>
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: 14 Sections Quick Picker (4 cols) */}
        <div className="lg:col-span-4 rounded-xl border border-border bg-card p-3 shadow-sm space-y-1.5 max-h-[78vh] overflow-y-auto">
          <div className="px-3 py-2 border-b border-border/80 mb-1">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Assignment Index (14)
            </span>
          </div>

          {assignments.map((asgn, index) => {
            const isSelected = index === selectedIndex
            const hasFiles = asgn.file_count > 0
            return (
              <button
                key={asgn.id}
                onClick={() => setSelectedIndex(index)}
                className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors font-mono text-xs ${
                  isSelected
                    ? 'bg-primary/15 text-primary font-semibold border border-primary/30'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <span className={`size-5 rounded flex items-center justify-center font-bold text-[10px] shrink-0 ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'}`}>
                    {asgn.section_number}
                  </span>
                  <span className="truncate">{asgn.title}</span>
                </div>

                {hasFiles ? (
                  <span className="text-[10px] text-emerald-500 font-medium shrink-0 flex items-center gap-1">
                    <CheckCircle2 className="size-3" />
                    {asgn.file_count}
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    —
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Right Column: Detailed Presentation Content (8 cols) */}
        {current && (
          <div className="lg:col-span-8 rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
            {/* Header */}
            <div className="border-b border-border pb-4">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                  Section {current.section_number} of 14
                </span>
                <span className="rounded bg-secondary px-2 py-0.5 font-mono text-xs text-muted-foreground border border-border">
                  {current.category}
                </span>
                {current.state && (
                  <span className="rounded bg-secondary px-2 py-0.5 font-mono text-xs text-foreground border border-border">
                    State: {current.state}
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                {current.title}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">
                {current.description}
              </p>
            </div>

            {/* Expected Checklist */}
            <div className="rounded-xl bg-secondary/40 p-4 border border-border/80 space-y-2">
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                Expected Submission Deliverables:
              </h3>
              <ul className="space-y-1">
                {current.expected_files.map((exp, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs font-mono text-foreground/90">
                    <span className="text-primary font-bold">&bull;</span>
                    <span>{exp}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Student Notes & Viva Pointers */}
            {current.notes && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-1.5">
                <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-primary">
                  Candidate Notes & Evaluation Summary:
                </h3>
                <p className="text-xs text-foreground/90 font-mono leading-relaxed whitespace-pre-wrap">
                  {current.notes}
                </p>
              </div>
            )}

            {/* Uploaded Documents List for Professor Review */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                  Submitted Deliverables ({current.files.length})
                </h3>
                {current.files.length > 0 && (
                  <span className="font-mono text-xs text-emerald-500 font-medium flex items-center gap-1">
                    <CheckCircle2 className="size-3.5" />
                    Files Added
                  </span>
                )}
              </div>

              {current.files.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-8 text-center">
                  <p className="font-mono text-xs text-muted-foreground">
                    No files have been added to this section yet.
                  </p>
                  <p className="text-[11px] text-muted-foreground/80 mt-1">
                    Trunal can upload deliverables for Section {current.section_number} from the Overview or Assignment view.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {current.files.map((file) => (
                    <div
                      key={file.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 p-4 hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-card shrink-0 border border-border">
                          {getFormatIcon(file.extension)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-foreground">
                            {file.original_name}
                          </p>
                          <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                            {formatBytes(file.size_bytes)} &bull; Uploaded {formatDate(file.created_at)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => onPreviewFile(file)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 font-mono text-xs font-medium text-foreground hover:bg-muted"
                        >
                          <Eye className="size-3.5 text-primary" />
                          <span>Inspect Preview</span>
                        </button>
                        <a
                          href={getDownloadUrl(file.id)}
                          download={file.original_name}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-mono text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                        >
                          <Download className="size-3.5" />
                          <span>Download Original</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
