import React, { useState, useEffect } from 'react'
import {
  Clock3,
  Upload,
  Link,
  Trash2,
  FileText,
  Settings,
  Sparkles,
  CheckCircle2
} from 'lucide-react'
import { ActivityLog } from '../../types'
import { fetchActivity } from '../../lib/api'
import { formatDate } from '../../lib/utils'

export function ActivityTimelineView() {
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  const loadActivities = async () => {
    setLoading(true)
    try {
      const data = await fetchActivity()
      setActivities(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadActivities()
  }, [])

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'UPLOAD':
        return <Upload className="size-4 text-primary" />
      case 'LINK_FILE':
        return <Link className="size-4 text-emerald-400" />
      case 'UNLINK_FILE':
      case 'DELETE_FILE':
        return <Trash2 className="size-4 text-destructive" />
      case 'UPDATE_ASSIGNMENT':
      case 'UPDATE_NOTE':
        return <FileText className="size-4 text-amber-400" />
      case 'UPDATE_SETTINGS':
        return <Settings className="size-4 text-indigo-400" />
      default:
        return <Sparkles className="size-4 text-primary" />
    }
  }

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-6 px-4 py-6 sm:px-7 lg:px-9">
      {/* Top Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Clock3 className="size-6 text-primary" />
            <span>Activity Timeline</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Audit trail of real events: uploads, section notes edits, metadata changes, and link operations.
          </p>
        </div>

        <button
          onClick={loadActivities}
          className="rounded-lg border border-border bg-secondary px-3 py-1.5 font-mono text-xs text-muted-foreground hover:text-foreground self-start sm:self-auto"
        >
          Refresh Log
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center font-mono text-xs text-muted-foreground">
          Loading audit trail...
        </div>
      ) : activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-secondary/30 py-16 text-center">
          <Clock3 className="size-10 text-muted-foreground mb-3 opacity-40" />
          <p className="font-mono text-sm text-foreground font-medium">No activity recorded yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Actions like uploading assignment files or modifying section notes will appear in this timeline.
          </p>
        </div>
      ) : (
        <div className="relative border-l border-border/80 ml-4 sm:ml-6 space-y-6 py-2">
          {activities.map((act) => (
            <div key={act.id} className="relative pl-6 sm:pl-8 group">
              {/* Dot Icon */}
              <div className="absolute -left-3.5 top-0.5 flex size-7 items-center justify-center rounded-full bg-card border border-border group-hover:border-primary shadow-sm transition-colors">
                {getActionIcon(act.action_type)}
              </div>

              {/* Card */}
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm hover:border-primary/40 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                  <span className="font-mono text-xs font-semibold text-primary uppercase">
                    {act.action_type.replace('_', ' ')}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {formatDate(act.created_at)}
                  </span>
                </div>
                <p className="text-xs text-foreground/90 leading-relaxed font-sans">
                  {act.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
