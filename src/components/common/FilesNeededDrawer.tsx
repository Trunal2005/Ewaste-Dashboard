import React from 'react'
import {
  X,
  ListChecks,
  CheckCircle2,
  CircleDashed,
  Upload,
  ArrowRight,
  FileText
} from 'lucide-react'
import { Assignment } from '../../types'

interface FilesNeededDrawerProps {
  assignments: Assignment[]
  isOpen: boolean
  onClose: () => void
  onSelectAssignment: (assignment: Assignment) => void
  onUploadToAssignment: (assignmentId: string) => void
}

export function FilesNeededDrawer({
  assignments,
  isOpen,
  onClose,
  onSelectAssignment,
  onUploadToAssignment,
}: FilesNeededDrawerProps) {
  if (!isOpen) return null

  const totalSections = assignments.length
  const completedSections = assignments.filter((a) => a.file_count > 0).length
  const pendingSections = totalSections - completedSections

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-card border-l border-border shadow-2xl flex flex-col justify-between">
          {/* Header */}
          <div className="p-5 border-b border-border bg-sidebar/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-primary font-mono text-xs font-semibold tracking-wider uppercase">
                <ListChecks className="size-4" />
                <span>Files Needed Checklist</span>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>
            <h2 className="text-lg font-semibold text-foreground">Portfolio Requirements</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Section-wise breakdown of expected deliverables across all 14 assignments.
            </p>

            {/* Status pills */}
            <div className="flex items-center gap-2 mt-4 font-mono text-xs">
              <span className="rounded-md bg-primary/10 px-2.5 py-1 text-primary font-medium border border-primary/20">
                {completedSections} Completed
              </span>
              <span className="rounded-md bg-secondary px-2.5 py-1 text-muted-foreground border border-border">
                {pendingSections} Awaiting Files
              </span>
            </div>
          </div>

          {/* Section List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 divide-y divide-border/40">
            {assignments.map((assignment) => {
              const hasFiles = assignment.file_count > 0
              return (
                <div key={assignment.id} className="pt-3.5 first:pt-0">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex size-5 items-center justify-center rounded-full font-mono text-[10px] font-bold bg-secondary border border-border shrink-0">
                        {assignment.section_number}
                      </span>
                      <h3 className="font-semibold text-xs text-foreground truncate">
                        {assignment.title}
                      </h3>
                    </div>

                    {hasFiles ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-emerald-500 border border-emerald-500/20 shrink-0">
                        <CheckCircle2 className="size-3" />
                        {assignment.file_count} added
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground border border-border shrink-0">
                        <CircleDashed className="size-3 text-muted-foreground" />
                        Awaiting
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground line-clamp-1 mb-2 font-mono">
                    Category: {assignment.category}
                  </p>

                  {/* Expected checklist items */}
                  <div className="rounded-lg bg-secondary/50 p-2.5 space-y-1.5 border border-border/60">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                      Expected Deliverables:
                    </p>
                    <ul className="space-y-1 text-xs">
                      {assignment.expected_files.map((exp, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 text-foreground/80 text-[11px] leading-tight">
                          <span className="text-primary font-bold">&bull;</span>
                          <span>{exp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 mt-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        onClose()
                        onSelectAssignment(assignment)
                      }}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-mono text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <span>View Details</span>
                      <ArrowRight className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClose()
                        onUploadToAssignment(assignment.id)
                      }}
                      className="inline-flex items-center gap-1 rounded bg-primary/10 px-2.5 py-1 text-[11px] font-mono font-medium text-primary hover:bg-primary/20 transition-colors"
                    >
                      <Upload className="size-3" />
                      <span>Upload Files</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border bg-sidebar/50">
            <button
              onClick={onClose}
              className="w-full rounded-lg border border-border py-2 text-xs font-mono font-medium text-muted-foreground hover:bg-muted text-center"
            >
              Close Checklist
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
