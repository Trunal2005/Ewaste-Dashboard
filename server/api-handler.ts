import app, { initBackend } from './app'

let initPromise: Promise<void> | null = null

// Serverless initialization middleware ensures DB is ready before routes execute
app.use(async (_req, _res, next) => {
  try {
    if (!initPromise) {
      initPromise = initBackend()
    }
    await initPromise
    next()
  } catch (err) {
    next(err)
  }
})

export default app
