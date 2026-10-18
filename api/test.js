import express from 'express'

const app = express()

app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', express: true, time: new Date().toISOString() })
})

export default function handler(req, res) {
  return app(req, res)
}
