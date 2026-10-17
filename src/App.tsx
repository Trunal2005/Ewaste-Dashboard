import React, { useState, useEffect, useCallback } from 'react'
import { AppSidebar, NavTab } from './components/layout/AppSidebar'
import { TopNavbar } from './components/layout/TopNavbar'
import { OverviewView } from './components/dashboard/OverviewView'
import { AssignmentsView } from './components/dashboard/AssignmentsView'
import { FileLibraryView } from './components/dashboard/FileLibraryView'
import { ActivityTimelineView } from './components/dashboard/ActivityTimelineView'
import { PresentationView } from './components/dashboard/PresentationView'
import { ProfileSettingsView } from './components/dashboard/ProfileSettingsView'
import { AssignmentDetailModal } from './components/assignments/AssignmentDetailModal'
import { FilePreviewModal } from './components/common/FilePreviewModal'
import { UploadModal } from './components/common/UploadModal'
import { FilesNeededDrawer } from './components/common/FilesNeededDrawer'
import { Assignment, OverviewData, PortfolioFile } from './types'
import { fetchOverview, fetchAssignments } from './lib/api'

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('overview')
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    const saved = localStorage.getItem('theme')
    return saved ? saved === 'dark' : true // Default to dark for high-tech gridline aesthetic
  })

  // Data state
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Modal / Drawer state
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null)
  const [previewFile, setPreviewFile] = useState<PortfolioFile | null>(null)
  const [uploadModalOpen, setUploadModalOpen] = useState<boolean>(false)
  const [uploadTargetId, setUploadTargetId] = useState<string>('')
  const [filesNeededOpen, setFilesNeededOpen] = useState<boolean>(false)
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false)

  // Sync theme to document element
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDark])

  const toggleTheme = () => setIsDark((prev) => !prev)

  // Data fetching
  const loadPortfolioData = useCallback(async () => {
    try {
      setLoadError(null)
      const [overviewData, assignmentsData] = await Promise.all([
        fetchOverview(),
        fetchAssignments(),
      ])
      setOverview(overviewData)
      setAssignments(assignmentsData)

      // If an assignment was open in detail view, update its reference
      if (selectedAssignment) {
        const updated = assignmentsData.find((a) => a.id === selectedAssignment.id)
        if (updated) setSelectedAssignment(updated)
      }
    } catch (err: any) {
      console.error('[EWEM] Error fetching data:', err)
      setLoadError(err.message || 'Could not connect to backend server. Make sure server is running.')
    } finally {
      setLoading(false)
    }
  }, [selectedAssignment])

  useEffect(() => {
    loadPortfolioData()
  }, [])

  // Keyboard shortcut: Ctrl+K or Cmd+K to search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        const input = document.getElementById('assignment-search') as HTMLInputElement | null
        input?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleOpenUpload = (assignmentId?: string) => {
    setUploadTargetId(assignmentId || '')
    setUploadModalOpen(true)
  }

  const renderActiveView = () => {
    switch (currentTab) {
      case 'overview':
        return (
          <OverviewView
            overview={overview}
            assignments={assignments}
            onSelectAssignment={(asgn) => setSelectedAssignment(asgn)}
            onOpenUpload={handleOpenUpload}
            onOpenFilesNeeded={() => setFilesNeededOpen(true)}
            onOpenPresentation={() => setCurrentTab('presentation')}
            onOpenAssignmentsTab={() => setCurrentTab('assignments')}
            onPreviewFile={(f) => setPreviewFile(f)}
          />
        )
      case 'assignments':
        return (
          <AssignmentsView
            assignments={assignments}
            onSelectAssignment={(asgn) => setSelectedAssignment(asgn)}
            onOpenUpload={handleOpenUpload}
          />
        )
      case 'library':
        return (
          <FileLibraryView
            assignments={assignments}
            onPreviewFile={(f) => setPreviewFile(f)}
            onOpenUpload={() => handleOpenUpload()}
          />
        )
      case 'activity':
        return <ActivityTimelineView />
      case 'presentation':
        return (
          <PresentationView
            assignments={assignments}
            settings={overview?.settings}
            onPreviewFile={(f) => setPreviewFile(f)}
          />
        )
      case 'settings':
        return <ProfileSettingsView onSettingsSaved={loadPortfolioData} />
      default:
        return null
    }
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      {/* Sidebar Navigation */}
      <AppSidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onOpenFilesNeeded={() => setFilesNeededOpen(true)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      {/* Top Navbar */}
      <TopNavbar
        overview={overview}
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenUpload={() => handleOpenUpload()}
        onOpenFilesNeeded={() => setFilesNeededOpen(true)}
        onOpenMobileNav={() => setMobileNavOpen(true)}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />

      {/* Main Viewport Content */}
      <main className="min-h-screen pt-18 md:pl-17">
        {loadError && (
          <div className="mx-4 sm:mx-8 my-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs font-mono text-destructive flex items-center justify-between">
            <span>Server Connection Notice: {loadError}</span>
            <button
              onClick={loadPortfolioData}
              className="rounded bg-destructive/20 px-2 py-1 hover:bg-destructive/30 text-foreground"
            >
              Retry
            </button>
          </div>
        )}

        {renderActiveView()}
      </main>

      {/* Detail Modal for Selected Assignment */}
      <AssignmentDetailModal
        assignment={selectedAssignment}
        onClose={() => setSelectedAssignment(null)}
        onRefresh={loadPortfolioData}
        onPreviewFile={(f) => setPreviewFile(f)}
      />

      {/* File Preview Modal (PDF, Image, Video, Audio, Sandboxed HTML, Office) */}
      <FilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />

      {/* Universal Upload Modal */}
      <UploadModal
        assignments={assignments}
        defaultAssignmentId={uploadTargetId}
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={loadPortfolioData}
      />

      {/* Files Needed Drawer */}
      <FilesNeededDrawer
        assignments={assignments}
        isOpen={filesNeededOpen}
        onClose={() => setFilesNeededOpen(false)}
        onSelectAssignment={(asgn) => {
          setSelectedAssignment(asgn)
          setFilesNeededOpen(false)
        }}
        onUploadToAssignment={(id) => {
          setFilesNeededOpen(false)
          handleOpenUpload(id)
        }}
      />
    </div>
  )
}
