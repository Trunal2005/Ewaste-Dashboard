import app, { initBackend } from './app'

let initPromise: Promise<void> | null = null

export default async function handler(req: any, res: any) {
  try {
    if (!initPromise) {
      initPromise = initBackend()
    }
    await initPromise
    return app(req, res)
  } catch (err: any) {
    console.error('API Handler Error:', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        error: err?.message || String(err),
        stack: err?.stack || null,
      })
    )
  }
}
