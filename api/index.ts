let appInstance: any = null
let initBackendFn: any = null

async function getApp() {
  if (!appInstance) {
    const mod = await import('../server/app')
    appInstance = mod.default
    initBackendFn = mod.initBackend
  }
  return { app: appInstance, initBackend: initBackendFn }
}

export default async function handler(req: any, res: any) {
  try {
    const { app, initBackend } = await getApp()
    await initBackend()
    return app(req, res)
  } catch (err: any) {
    console.error('Vercel Function Error:', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    return res.end(
      JSON.stringify({
        error: err?.message || String(err),
        stack: err?.stack || null,
        name: err?.name || 'Error',
      })
    )
  }
}
