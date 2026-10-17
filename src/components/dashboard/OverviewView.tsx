import React, { useState } from 'react'
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  CircleDashed,
  Database,
  FileText,
  Clock3,
  Layers,
  Upload,
  Airplay,
  ListChecks,
  CalendarDays,
  Sparkles,
  Download,
  Eye,
  Search,
  Command,
  FileSpreadsheet,
  Film,
  Music,
  FileCode,
  Image as ImageIcon
} from 'lucide-react'
import { Assignment, OverviewData, PortfolioFile } from '../../types'
import { ProgressRing } from '../common/ProgressRing'
import { formatBytes, formatDate } from '../../lib/utils'
import { getDownloadUrl } from '../../lib/api'

interface OverviewViewProps {
  overview: OverviewData | null
  assignments: Assignment[]
  onSelectAssignment: (assignment: Assignment) => void
  onOpenUpload: (assignmentId?: string) => void
  onOpenFilesNeeded: () => void
  onOpenPresentation: () => void
  onOpenAssignmentsTab: () => void
  onPreviewFile: (file: PortfolioFile) => void
}

export function OverviewView({
  overview,
  assignments,
  onSelectAssignment,
  onOpenUpload,
  onOpenFilesNeeded,
  onOpenPresentation,
  onOpenAssignmentsTab,
  onPreviewFile,
}: OverviewViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const settings = overview?.settings
  const sectionsWithFiles = overview?.sectionsWithFiles ?? 0
  const sectionsAwaiting = overview?.sectionsAwaitingFiles ?? 14
  const totalFiles = overview?.totalFiles ?? 0
  const progressPercent = overview?.progressPercent ?? 0
  const nextEmptySection = overview?.nextEmptySection
  const recentUploads = overview?.recentUploads ?? []

  const filteredAssignments = assignments.filter((a) =>
    `${a.title} ${a.category} Section ${a.section_number}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase().trim())
  )

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
    <div className="mx-auto w-full max-w-screen-2xl space-y-8 px-4 py-6 sm:px-7 lg:px-9 circuit-grid">
      {/* Welcoming Header Matching Watermelon Gridline Dashboard */}
      <div className="flex flex-col gap-6 border-b border-border/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary uppercase border border-primary/20">
              Third Year B.Tech &bull; Computer Engineering
            </span>
            <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-xs text-muted-foreground border border-border">
              {settings?.roll_no ? `Roll: ${settings.roll_no}` : 'Roll: 24102C0026'}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {settings?.student_name || 'Trunal Patil'} &bull; EWEM Workspace
          </h1>
          <p className="max-w-2xl text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Academic Assignment Portfolio for <strong className="text-foreground">E-Waste Management (EWEM)</strong>, Department of Computer Engineering at <strong className="text-foreground">Vidyalankar Institute of Technology, Mumbai</strong>.
          </p>
        </div>

        {/* Quick Search */}
        <div className="relative w-full sm:max-w-xs">
          <label htmlFor="assignment-search" className="sr-only">
            Search portfolio sections
          </label>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="assignment-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sections or tasks..."
            className="h-10 w-full rounded-lg border border-border bg-secondary/70 pl-9 pr-12 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-none"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            <Command className="size-2.5" /> K
          </div>
        </div>
      </div>

      {/* 4 Metric Cards in Watermelon Gridline Design */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1 */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground mb-3">
            <span className="font-mono text-xs font-medium uppercase tracking-wider">Total Sections</span>
            <Layers className="size-4 text-primary" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold text-foreground">14</span>
            <span className="font-mono text-xs text-muted-foreground">curriculum units</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Structured for evaluation & viva
          </p>
        </div>

        {/* Metric 2 */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground mb-3">
            <span className="font-mono text-xs font-medium uppercase tracking-wider">Files Added</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold text-emerald-500">{sectionsWithFiles}</span>
            <span className="font-mono text-xs text-muted-foreground">/ 14 sections</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {sectionsWithFiles === 0 ? 'No files added yet (honest count)' : `${sectionsWithFiles} sections have deliverables`}
          </p>
        </div>

        {/* Metric 3 */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground mb-3">
            <span className="font-mono text-xs font-medium uppercase tracking-wider">Awaiting Files</span>
            <CircleDashed className="size-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold text-amber-500">{sectionsAwaiting}</span>
            <span className="font-mono text-xs text-muted-foreground">sections pending</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Check Files Needed drawer
          </p>
        </div>

        {/* Metric 4 */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground mb-3">
            <span className="font-mono text-xs font-medium uppercase tracking-wider">Total Uploads</span>
            <Database className="size-4 text-primary" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold text-foreground">{totalFiles}</span>
            <span className="font-mono text-xs text-muted-foreground">stored in SQLite</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Original bytes preserved on disk
          </p>
        </div>
      </div>

      {/* Prominent "Continue your portfolio" Banner + Progress Ring + Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Continue Portfolio Card */}
        <div className="relative flex flex-col justify-between rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-sm lg:col-span-2">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-mono text-xs font-bold">
                &gt;_
              </span>
              <span className="font-mono text-xs font-semibold text-primary uppercase tracking-wider">
                Continue Your Portfolio
              </span>
            </div>

            {nextEmptySection ? (
              <div className="space-y-1.5">
                <h2 className="text-xl font-bold text-foreground">
                  Next: Section {nextEmptySection.section_number} &mdash; {nextEmptySection.title}
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                  {nextEmptySection.description}
                </p>
                <div className="mt-2 rounded-lg bg-card/70 border border-border p-2.5 max-w-lg">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
                    Expected files:
                  </span>
                  <p className="text-xs text-foreground/90 font-mono mt-0.5">
                    {Array.isArray(nextEmptySection.expected_files)
                      ? nextEmptySection.expected_files.join(' • ')
                      : 'Handwritten notes or reports'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <h2 className="text-xl font-bold text-foreground">
                  All 14 Sections Have Files Added!
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Excellent work, Trunal! All 14 assignment deliverables have been uploaded and linked into your portfolio.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 pt-4 border-t border-border/60">
            {nextEmptySection ? (
              <button
                type="button"
                onClick={() => onSelectAssignment(nextEmptySection)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all"
              >
                <span>Open Section {nextEmptySection.section_number}</span>
                <ArrowUpRight className="size-4" />
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => onOpenUpload(nextEmptySection?.id)}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
            >
              <Upload className="size-3.5 text-primary" />
              <span>Upload to {nextEmptySection ? `Section ${nextEmptySection.section_number}` : 'Portfolio'}</span>
            </button>

            <button
              type="button"
              onClick={onOpenFilesNeeded}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <ListChecks className="size-3.5" />
              <span>Files Needed Drawer</span>
            </button>
          </div>
        </div>

        {/* Readiness Ring Card */}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-6 shadow-sm text-center">
          <div className="flex items-center gap-2 mb-4 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            <Sparkles className="size-4 text-primary" />
            <span>Readiness Tracker</span>
          </div>

          <ProgressRing progress={progressPercent} size={130} strokeWidth={11} label="Sections" />

          <p className="mt-4 font-mono text-xs text-muted-foreground">
            {sectionsWithFiles} of 14 sections contain files
          </p>
          <p className="text-[11px] text-muted-foreground mt-1 max-w-xs">
            Calculated strictly from actual uploads. Zero fabrication.
          </p>

          <div className="mt-5 flex items-center justify-center gap-2 w-full pt-4 border-t border-border">
            <button
              type="button"
              onClick={onOpenPresentation}
              className="inline-flex items-center justify-center gap-1.5 w-full rounded-lg border border-border bg-secondary py-2 text-xs font-mono font-medium text-foreground hover:bg-muted"
            >
              <Airplay className="size-3.5 text-primary" />
              <span>Presentation View</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Uploads Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground font-mono uppercase">
            <Clock3 className="size-4 text-primary" />
            <span>Recent Uploads</span>
          </h2>
          <button
            type="button"
            onClick={onOpenAssignmentsTab}
            className="text-xs font-mono text-primary hover:underline flex items-center gap-1"
          >
            <span>Browse All Sections</span>
            <ArrowUpRight className="size-3" />
          </button>
        </div>

        {recentUploads.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-secondary/30 py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground mb-3">
              <Clock3 className="size-6" />
            </div>
            <p className="font-mono text-xs text-muted-foreground">
              Your recent uploads will appear here
            </p>
            <p className="text-[11px] text-muted-foreground/80 mt-1 max-w-sm">
              Use "Upload Files" to store PDF notes, Excel models, or PPT decks for your E-Waste coursework.
            </p>
            <button
              type="button"
              onClick={() => onOpenUpload()}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Upload className="size-3.5" />
              <span>Add First Document</span>
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentUploads.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-secondary shrink-0 border border-border">
                    {getFormatIcon(file.extension)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">
                      {file.original_name}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground truncate">
                      {formatBytes(file.size_bytes)} &bull; {formatDate(file.created_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onPreviewFile(file)}
                    className="p-1 text-muted-foreground hover:text-foreground"
                    title="Preview file"
                  >
                    <Eye className="size-3.5" />
                  </button>
                  <a
                    href={getDownloadUrl(file.id)}
                    download={file.original_name}
                    className="p-1 text-muted-foreground hover:text-emerald-500"
                    title="Download original file"
                  >
                    <Download className="size-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 14 Assignment Cards Grid Matching Watermelon Gridline WorkspaceCards */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-border/80 pb-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground font-mono uppercase flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              <span>Curriculum Assignment Modules (14 Sections)</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Click any card to inspect expected deliverables, upload files, or edit notes.
            </p>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            Showing {filteredAssignments.length} of 14
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAssignments.map((assignment) => {
            const hasFiles = assignment.file_count > 0
            return (
              <div
                key={assignment.id}
                onClick={() => onSelectAssignment(assignment)}
                className="group cursor-pointer rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:border-primary/50 hover:bg-secondary/40 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-secondary font-mono text-xs font-bold text-foreground border border-border group-hover:border-primary/40 group-hover:text-primary transition-colors">
                      {assignment.section_number}
                    </span>
                    <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
                  </div>

                  <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {assignment.title}
                  </h3>

                  <p className="font-mono text-[11px] text-muted-foreground mt-1">
                    {assignment.category}
                  </p>

                  <p className="text-xs text-muted-foreground/90 mt-2 line-clamp-2 leading-relaxed">
                    {assignment.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
                  <div className="font-mono text-xs">
                    {hasFiles ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-500 font-medium">
                        <CheckCircle2 className="size-3.5" />
                        {assignment.file_count} file(s) added
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <CircleDashed className="size-3.5" />
                        Awaiting files
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] font-mono text-primary group-hover:underline">
                    Open &rarr;
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
