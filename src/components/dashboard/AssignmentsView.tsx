import React, { useState } from 'react'
import {
  Layers,
  Search,
  CheckCircle2,
  CircleDashed,
  ArrowUpRight,
  Upload,
  Calendar,
  MapPin,
  List,
  LayoutGrid
} from 'lucide-react'
import { Assignment } from '../../types'

interface AssignmentsViewProps {
  assignments: Assignment[]
  onSelectAssignment: (assignment: Assignment) => void
  onOpenUpload: (assignmentId?: string) => void
}

export function AssignmentsView({
  assignments,
  onSelectAssignment,
  onOpenUpload,
}: AssignmentsViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')

  const categories = ['all', ...Array.from(new Set(assignments.map((a) => a.category)))]

  const filtered = assignments.filter((a) => {
    const matchesSearch = `${a.title} ${a.description} Section ${a.section_number}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase().trim())
    const matchesCat = selectedCategory === 'all' || a.category === selectedCategory
    return matchesSearch && matchesCat
  })

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-6 px-4 py-6 sm:px-7 lg:px-9">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Layers className="size-6 text-primary" />
            <span>Assignments Portfolio Structure</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            All 14 academic assignment sections for EWEM coursework. Click any module to edit notes or upload files.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex rounded-lg border border-border bg-secondary p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md ${viewMode === 'grid' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
              title="Grid View"
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md ${viewMode === 'table' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
              title="Table View"
            >
              <List className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Controls: Search & Category Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, number, or keyword..."
            className="w-full rounded-lg border border-border bg-secondary pl-9 pr-4 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          <span className="text-[11px] font-mono text-muted-foreground shrink-0">Category:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-lg px-2.5 py-1 text-xs font-mono capitalize shrink-0 transition-colors ${
                selectedCategory === cat
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat === 'all' ? 'All (14)' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid or Table Display */}
      {viewMode === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((assignment) => {
            const hasFiles = assignment.file_count > 0
            return (
              <div
                key={assignment.id}
                onClick={() => onSelectAssignment(assignment)}
                className="group cursor-pointer rounded-xl border border-border bg-card p-5 shadow-sm hover:border-primary/50 hover:bg-secondary/30 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-secondary font-mono text-xs font-bold text-foreground border border-border group-hover:border-primary/40 group-hover:text-primary transition-colors">
                      {assignment.section_number}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {assignment.state && (
                        <span className="rounded bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground border border-border flex items-center gap-1">
                          <MapPin className="size-2.5 text-primary" />
                          {assignment.state}
                        </span>
                      )}
                      <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                  </div>

                  <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {assignment.title}
                  </h3>
                  <p className="font-mono text-[11px] text-muted-foreground mt-1">
                    {assignment.category}
                  </p>
                  <p className="text-xs text-muted-foreground/85 mt-2 line-clamp-3 leading-relaxed">
                    {assignment.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
                  {hasFiles ? (
                    <span className="inline-flex items-center gap-1 font-mono text-xs text-emerald-500 font-medium">
                      <CheckCircle2 className="size-3.5" />
                      {assignment.file_count} file(s) added
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
                      <CircleDashed className="size-3.5" />
                      Awaiting files
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenUpload(assignment.id)
                    }}
                    className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-1 font-mono text-[11px] text-primary hover:bg-muted"
                  >
                    <Upload className="size-3" />
                    <span>Upload</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-secondary/60 text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-3 px-4 w-14">#</th>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4 hidden md:table-cell">Category</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((assignment) => {
                  const hasFiles = assignment.file_count > 0
                  return (
                    <tr
                      key={assignment.id}
                      onClick={() => onSelectAssignment(assignment)}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-bold text-foreground">
                        {assignment.section_number}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-sans font-semibold text-foreground block">
                          {assignment.title}
                        </span>
                        <span className="text-[11px] text-muted-foreground line-clamp-1">
                          {assignment.description}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell text-muted-foreground">
                        {assignment.category}
                      </td>
                      <td className="py-3 px-4">
                        {hasFiles ? (
                          <span className="inline-flex items-center gap-1 text-emerald-500 font-medium">
                            <CheckCircle2 className="size-3" />
                            {assignment.file_count} files
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <CircleDashed className="size-3" />
                            Awaiting
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelectAssignment(assignment)
                          }}
                          className="rounded bg-primary/10 px-2.5 py-1 text-primary hover:bg-primary/20"
                        >
                          Details &rarr;
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
