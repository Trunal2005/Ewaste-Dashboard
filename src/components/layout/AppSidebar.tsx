import React from 'react'
import {
  House,
  Layers,
  Database,
  Clock3,
  SlidersHorizontal,
  Airplay,
  ListChecks,
  SunDim,
  MoonStar,
  ChevronRight,
  X
} from 'lucide-react'
import { EwemEmblem } from '../common/Emblem'

export type NavTab = 'overview' | 'assignments' | 'library' | 'activity' | 'presentation' | 'settings'

interface AppSidebarProps {
  currentTab: NavTab
  onSelectTab: (tab: NavTab) => void
  isDark: boolean
  onToggleTheme: () => void
  onOpenFilesNeeded: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

export function AppSidebar({
  currentTab,
  onSelectTab,
  isDark,
  onToggleTheme,
  onOpenFilesNeeded,
  mobileOpen,
  onCloseMobile,
}: AppSidebarProps) {
  const navItems: { tab: NavTab; label: string; icon: React.ElementType; badge?: string }[] = [
    { tab: 'overview', label: 'Overview', icon: House },
    { tab: 'assignments', label: 'Assignments', icon: Layers, badge: '14' },
    { tab: 'library', label: 'File Library', icon: Database },
    { tab: 'activity', label: 'Activity Timeline', icon: Clock3 },
    { tab: 'presentation', label: 'Presentation View', icon: Airplay },
    { tab: 'settings', label: 'Profile & Settings', icon: SlidersHorizontal },
  ]

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab)
    onCloseMobile()
  }

  return (
    <>
      {/* Desktop Sidebar: 68px (w-17) compact sidebar matching Watermelon Gridline Dashboard */}
      <aside
        aria-label="Primary navigation"
        className="fixed inset-y-0 left-0 z-30 hidden w-17 flex-col items-center justify-between border-r border-sidebar-border bg-sidebar px-2.5 py-4 text-sidebar-foreground md:flex"
      >
        <div className="flex w-full flex-col items-center gap-5">
          {/* Logo / Emblem */}
          <button
            type="button"
            onClick={() => onSelectTab('overview')}
            title="EWEM Workspace — Academic Portfolio"
            className="group flex flex-col items-center gap-1.5 focus:outline-none"
          >
            <EwemEmblem className="size-10 shadow-sm transition-transform group-hover:scale-105" />
            <span className="font-mono text-[9px] font-semibold tracking-wider text-muted-foreground uppercase group-hover:text-primary transition-colors">
              EWEM
            </span>
          </button>

          <div className="w-8 border-b border-sidebar-border" />

          {/* Navigation Buttons */}
          <nav className="flex flex-col items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = currentTab === item.tab
              return (
                <div key={item.tab} className="relative group">
                  <button
                    type="button"
                    onClick={() => handleNavClick(item.tab)}
                    aria-label={item.label}
                    className={`relative flex size-10 items-center justify-center rounded-xl transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      active
                        ? 'bg-primary/15 text-primary shadow-sm font-semibold'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <Icon className="size-5" strokeWidth={active ? 2.1 : 1.7} />
                    {item.badge && (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary text-[9px] font-mono font-medium px-1 border border-border text-foreground">
                        {item.badge}
                      </span>
                    )}
                  </button>

                  {/* Tooltip on right */}
                  <div className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 z-50 hidden rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background shadow-lg whitespace-nowrap group-hover:block transition-opacity">
                    {item.label}
                  </div>
                </div>
              )
            })}
          </nav>
        </div>

        {/* Bottom Actions: Files Needed Drawer button, Theme switcher, Profile icon */}
        <div className="flex flex-col items-center gap-3">
          {/* Files Needed Drawer Quick Trigger */}
          <div className="relative group">
            <button
              type="button"
              onClick={onOpenFilesNeeded}
              title="Files Needed Checklist Drawer"
              className="flex size-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/5 text-primary hover:bg-primary/20 transition-all outline-none"
            >
              <ListChecks className="size-5" />
            </button>
            <div className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 z-50 hidden rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background shadow-lg whitespace-nowrap group-hover:block">
              Files Needed Checklist
            </div>
          </div>

          {/* Theme switch */}
          <div className="relative group">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Toggle theme"
              className="flex size-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all outline-none"
            >
              {isDark ? (
                <SunDim className="size-5 text-amber-400" />
              ) : (
                <MoonStar className="size-5 text-indigo-500" />
              )}
            </button>
            <div className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 z-50 hidden rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background shadow-lg whitespace-nowrap group-hover:block">
              {isDark ? 'Switch to Light' : 'Switch to Dark'}
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Navigation Backdrop & Sheet */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-72 bg-sidebar border-r border-sidebar-border p-5 shadow-2xl flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-sidebar-border pb-4">
                <div className="flex items-center gap-3">
                  <EwemEmblem className="size-9" />
                  <div>
                    <h2 className="font-semibold text-sm leading-tight text-foreground">
                      EWEM Workspace
                    </h2>
                    <p className="font-mono text-xs text-muted-foreground">
                      Trunal Patil
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Navigation List */}
              <nav className="space-y-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const active = currentTab === item.tab
                  return (
                    <button
                      key={item.tab}
                      type="button"
                      onClick={() => handleNavClick(item.tab)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? 'bg-primary/15 text-primary font-semibold'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="size-5" />
                        <span>{item.label}</span>
                      </div>
                      <ChevronRight className="size-4 opacity-50" />
                    </button>
                  )
                })}
              </nav>

              <button
                type="button"
                onClick={() => {
                  onCloseMobile()
                  onOpenFilesNeeded()
                }}
                className="flex w-full items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                <ListChecks className="size-5" />
                <span>Files Needed Checklist</span>
              </button>
            </div>

            {/* Mobile Footer */}
            <div className="border-t border-sidebar-border pt-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                {isDark ? <MoonStar className="size-4" /> : <SunDim className="size-4" />}
                <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
              </div>
              <button
                type="button"
                onClick={onToggleTheme}
                className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                Toggle
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
