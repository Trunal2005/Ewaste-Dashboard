import path from 'path'
import fs from 'fs'
import app, { initBackend } from './app'

const PORT = process.env.PORT || 3001

// Serve static Vite client bundle in production if running as standalone server
const distPath = path.resolve(process.cwd(), 'dist')
if (fs.existsSync(distPath)) {
  const express = await import('express')
  app.use(express.default.static(distPath))
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      return res.sendFile(path.join(distPath, 'index.html'))
    }
    next()
  })
}

// Start server
async function start() {
  await initBackend()
  app.listen(PORT, () => {
    console.log(`[EWEM Server] Backend running at http://localhost:${PORT}`)
  })
}

start().catch((err) => {
  console.error('[EWEM Server] Failed to start:', err)
})
