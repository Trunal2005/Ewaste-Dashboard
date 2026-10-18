import app, { initBackend } from '../server/app'

export default async function handler(req: any, res: any) {
  await initBackend()
  return app(req, res)
}
