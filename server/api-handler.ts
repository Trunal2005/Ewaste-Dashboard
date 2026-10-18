import app, { initBackend } from './app'

let isReady = false

export default async function handler(req: any, res: any) {
  if (!isReady) {
    await initBackend()
    isReady = true
  }
  return app(req, res)
}
