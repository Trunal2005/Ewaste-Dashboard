import React, { useState, useEffect } from 'react'
import {
  Menu,
  Upload,
  ListChecks,
  Airplay,
  Database,
  UserCheck,
  Lock,
  ShieldCheck
} from 'lucide-react'
import { OverviewData } from '../../types'
import { NavTab } from './AppSidebar'
import { getAdminKey, setAdminKey } from '../../lib/api'

interface TopNavbarProps {
  overview: OverviewData | null
  currentTab: NavTab
  onSelectTab: (tab: NavTab) => void
  onOpenUpload: () => void
  onOpenFilesNeeded: () => void
  onOpenMobileNav: () => void
  isDark: boolean
  onToggleTheme: () => void
}

export function TopNavbar({
  overview,
  currentTab,
  onSelectTab,
  onOpenUpload,
  onOpenFilesNeeded,
  onOpenMobileNav,
}: TopNavbarProps) {
  const [isAdmin, setIsAdmin] = useState<boolean>(() => Boolean(getAdminKey()))
  const settings = overview?.settings
  const sectionsWithFiles = overview?.sectionsWithFiles ?? 0
  const sectionsAwaiting = overview?.sectionsAwaitingFiles ?? 14

  useEffect(() => {
    setIsAdmin(Boolean(getAdminKey()))
  }, [])

  const handleToggleAdmin = () => {
    if (isAdmin) {
      if (confirm('Switch to Read-Only Evaluation Mode for professor presentation?')) {
        setAdminKey('')
        setIsAdmin(false)
      }
    } else {
      const passcode = prompt('Enter Owner Passcode to unlock editing and uploads:')
      if (passcode !== null) {
        if (passcode.trim()) {
          setAdminKey(passcode.trim())
          setIsAdmin(true)
        } else {
          alert('Passcode cannot be empty')
        }
      }
    }
  }

  const tabTitles: Record<NavTab, string> = {
    overview: 'Portfolio Overview',
    assignments: '14 Assignment Modules',
    library: 'File Repository & Explorer',
    activity: 'Portfolio Activity Log',
    presentation: 'Evaluation Presentation View',
    settings: 'Student Profile & System Settings',
  }

  return (
    <header className="fixed inset-x-0 top-0 z-20 flex h-18 items-center justify-between gap-3 border-b border-sidebar-border bg-sidebar/95 px-4 backdrop-blur-md md:left-17 md:px-7">
      {/* Left side: Mobile menu toggle + Page title & breadcrumb */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open mobile menu"
          className="rounded-lg p-2 text-foreground hover:bg-muted md:hidden outline-none"
        >
          <Menu className="size-5" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground hidden sm:inline">
              EWEM
            </span>
            <span className="text-muted-foreground hidden sm:inline">/</span>
            <h1 className="truncate text-base font-semibold tracking-tight text-foreground">
              {tabTitles[currentTab] || 'Dashboard'}
            </h1>
          </div>
          <p className="hidden lg:block font-mono text-[11px] text-muted-foreground truncate">
            {settings?.student_name || 'Trunal Patil'} &bull; {settings?.college || 'Vidyalankar Institute of Technology, Mumbai'}
          </p>
        </div>
      </div>

      {/* Middle: Technical status strip matching Watermelon Gridline style */}
      <div className="hidden xl:flex items-center gap-2">
        <div className="flex h-7 items-center overflow-hidden rounded-md bg-secondary/80 border border-border/60 font-mono text-xs">
          <span className="flex h-full items-center gap-1.5 border-r border-border/60 px-3 text-primary font-medium">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            Added: {sectionsWithFiles}/14
          </span>
          <span className="flex h-full items-center gap-1.5 border-r border-border/60 px-3 text-muted-foreground">
            Awaiting: {sectionsAwaiting}
          </span>
          <span className="flex h-full items-center gap-1.5 px-3 text-emerald-500 font-medium">
            <Database className="size-3.5" />
            SQLite Active
          </span>
        </div>

        {/* Evaluation / Owner Mode Indicator */}
        <button
          type="button"
          onClick={handleToggleAdmin}
          className="flex h-7 items-center gap-1.5 rounded-md border border-border/60 bg-secondary/80 px-2.5 font-mono text-[11px] hover:bg-muted transition-colors outline-none cursor-pointer"
          title={isAdmin ? 'Owner Mode Active (Full Edit). Click to switch to Read-Only.' : 'Professor Evaluation Mode (Read-Only). Click to unlock Owner Edit Mode.'}
        >
          {isAdmin ? (
            <>
              <ShieldCheck className="size-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Owner Mode</span>
            </>
          ) : (
            <>
              <Lock className="size-3.5 text-amber-400" />
              <span className="text-muted-foreground">Evaluation Mode</span>
            </>
          )}
        </button>
      </div>

      {/* Right side: Action buttons */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Files Needed Drawer Button */}
        <button
          type="button"
          onClick={onOpenFilesNeeded}
          className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 font-mono text-xs font-medium text-foreground hover:bg-secondary transition-colors outline-none cursor-pointer"
          title="Open checklist of required files across all 14 assignments"
        >
          <ListChecks className="size-3.5 text-primary" />
          <span>Files Needed</span>
          {sectionsAwaiting > 0 && (
            <span className="rounded-full bg-secondary px-1.5 py-0.2 text-[10px] text-primary border border-primary/20">
              {sectionsAwaiting}
            </span>
          )}
        </button>

        {/* Presentation View Quick Button */}
        <button
          type="button"
          onClick={() => onSelectTab('presentation')}
          className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 font-mono text-xs font-medium text-foreground hover:bg-secondary transition-colors outline-none cursor-pointer"
          title="Open clean Presentation View for professor evaluation"
        >
          <Airplay className="size-3.5 text-primary" />
          <span>Presentation</span>
        </button>

        {/* Primary Upload Action */}
        <button
          type="button"
          onClick={onOpenUpload}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-all outline-none cursor-pointer"
        >
          <Upload className="size-4" />
          <span className="font-semibold">Upload Files</span>
        </button>

        {/* Settings / Student avatar */}
        <button
          type="button"
          onClick={() => onSelectTab('settings')}
          className="flex size-8 items-center justify-center rounded-lg border border-border bg-secondary text-foreground hover:bg-muted transition-colors outline-none cursor-pointer"
          title="Student Profile & Settings"
        >
          <UserCheck className="size-4 text-primary" />
        </button>
      </div>
    </header>
  )
}
