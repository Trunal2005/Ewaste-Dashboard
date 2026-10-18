# EWEM Workspace — E-Waste Management Academic Portfolio

A comprehensive, production-grade academic assignment dashboard and portfolio workspace built for **Trunal Patil**, Third Year B.Tech Computer Engineering student at **Vidyalankar Institute of Technology, Mumbai**.

---

## 1. Quick Overview

- **Student:** Trunal Patil (Roll No: `24102C0026`)
- **Institution:** Vidyalankar Institute of Technology, Mumbai
- **Course:** E-Waste Management (EWEM) — Third Year B.Tech Computer Engineering
- **Curriculum Scope:** 14 university assignment modules covering toxic chemicals analysis, elemental recovery flows, carbon footprinting, state e-waste trackers, patent modifications, and IEEE research paper submissions.
- **Evaluation Status:** 13/14 sections submitted with complete deliverables (PDFs, DOCX, XLSX, PPTX, HTML interactive calculators, and photographic records).

---

## 2. Architecture & Tech Stack

- **Frontend:**
  - React 19, TypeScript, and Vite 8
  - Tailwind CSS with high-tech Watermelon Gridline dark aesthetic (`#0f1217`, card `#151a22`, teal electrical accent `#0ab1ba`)
  - Typography: `Inter` sans-serif paired with `JetBrains Mono` for telemetry and metadata
  - Lucide React icon suite
- **Backend:**
  - Express 5 REST API running on configurable port (`PORT` env, default `3001`)
  - Static SPA serving: Express serves the production Vite client bundle (`dist/`) directly at root `/`
  - Multi-file multipart uploads via Multer
  - Isolated Sandboxed HTML viewer (`/api/files/:id/sandbox-html`) with restricted Content Security Policy (CSP)
- **Database & Storage:**
  - WebAssembly SQLite (`sql.js`) persisted to disk via binary file (`data/ewaste.sqlite` or configurable `DB_PATH`)
  - Decoupled `StorageAdapter` pattern (`LocalDiskStorageAdapter`) storing files in `uploads/` (or `UPLOADS_DIR`)
  - Byte-for-byte original file preservation with SHA-256 integrity verification
  - Cross-section linking junction table (`assignment_files`) allowing documents to be shared across assignments without duplicate disk usage
- **Security & Professor Evaluation Mode:**
  - Read-Only Presentation Mode by default: Visitors and evaluators can view, inspect, preview documents inline, and download original files, with write/delete endpoints protected by `requireAdmin` middleware.
  - Owner Unlock: Configurable `ADMIN_KEY` unlocks editing, deleting, and uploading directly in the dashboard UI.
  - Destructive `/api/reset` is permanently disabled in production to protect academic submissions.

---

## 3. The 14 Assignment Sections & Status

| # | Section ID | Assignment Module Title | Category | Status |
|---|---|---|---|---|
| 1 | `sec-1` | Toxic Chemicals — Any 5 | Core Concepts & Notes | Submitted (1 File) |
| 2 | `sec-2` | Assignment 3 — Elemental Recovery Process Update | Process & Recovery | Submitted (1 File) |
| 3 | `sec-3` | Assignment 2 — Class Activity: Map of E-Waste | Class Activity | Submitted (1 File) |
| 4 | `sec-4` | Assignment 1 — E-Waste Tracker | Data & Tracking | Submitted (4 Files) |
| 5 | `sec-5` | E-Waste India vs World — Data Task | Comparative Analysis | Submitted (2 Files) |
| 6 | `sec-6` | Carbon Footprint Task — Excel Activity | Excel Activity | Submitted (1 File) |
| 7 | `sec-7` | TE CMPN C PPT — State Tracker Submission Folder | State Tracker & Presentation | Submitted (1 File) |
| 8 | `sec-8` | E-Waste Recovery Process — Modification for Design Patent | Patent & Innovation | Submitted (1 File) |
| 9 | `sec-9` | Indian Companies Following E-Waste Rules — Comparative Study | Policy & Industry Study | Submitted (3 Files) |
| 10 | `sec-10` | Novel Idea — E-Waste Pitch Deck | Entrepreneurship & Innovation | Submitted (2 Files) |
| 11 | `sec-11` | Campaign for E-Waste in Campus — Class Activity | Campus Awareness | Awaiting Files (0 Files) |
| 12 | `sec-12` | LEED Certification of Green Buildings in India | Sustainability & Standards | Submitted (2 Files) |
| 13 | `sec-13` | Case Studies E-Waste | Case Studies | Submitted (2 Files) |
| 14 | `sec-14` | IEEE Paper Submission — Students | Research Publication | Submitted (1 File) |

---

## 4. Local Development

### Prerequisites
- Node.js (v18, v20, or v22)
- npm (v9+)

### Running Locally
```bash
# 1. Install dependencies
npm install

# 2. Run both Vite client (port 5173) and Express server (port 3001) concurrently
npm run dev

# 3. Production build validation
npm run build
```

Access locally at:
- Frontend Dashboard: [http://localhost:5173](http://localhost:5173)
- Unified Backend & API: [http://localhost:3001](http://localhost:3001)
- API Health Check: [http://localhost:3001/api/health](http://localhost:3001/api/health)

---

## 5. Deployment & Permanent Cloud Storage

The application supports both Vercel Serverless Functions and container platforms (Railway / Render).

### Option A: Vercel Functions + Vercel Blob (Active Live Deployment)
Deploys frontend statically on Vercel CDN and backend API on Vercel Serverless Functions (`api/index.ts`) with persistent cloud file storage via Vercel Blob:
1. Connect GitHub repository `Trunal2005/Ewaste-Dashboard` on [Vercel](https://vercel.com).
2. Attach **Vercel Blob Storage** in 1 click:
   - Go to Project -> **Storage** tab -> Click **Create** -> Select **Blob** -> Click **Connect to Project**.
   - Vercel automatically creates and provisions `BLOB_READ_WRITE_TOKEN`.
3. Set Environment Variables in Vercel Settings -> Environment Variables:
   - `ADMIN_KEY=your_secure_passcode` (Passcode to unlock owner edit & upload mode)
   - `NODE_ENV=production`
4. Migrate all 22 assignments and SQLite records:
   ```bash
   npm run migrate:vercel <YOUR_BLOB_READ_WRITE_TOKEN>
   ```

### Option B: Railway (Persistent Container Volume)
Railway natively supports attaching persistent volumes to containers so files and SQLite survive rebuilds:
1. Connect your GitHub repository `Trunal2005/Ewaste-Dashboard` on [Railway](https://railway.app).
2. Add a **Persistent Volume** mounted at `/app/data` and `/app/uploads`.
3. Set Environment Variables:
   - `PORT=3001`
   - `NODE_ENV=production`
   - `ADMIN_KEY=your_secure_passcode`
   - `DB_PATH=/app/data/ewaste.sqlite`
   - `UPLOADS_DIR=/app/uploads`
4. Deploy the service.

### Option C: Render Web Service
1. Connect `Trunal2005/Ewaste-Dashboard` on [Render](https://render.com) as a **Web Service**.
2. Mount Render Disk at `/var/data`, set `DB_PATH=/var/data/ewaste.sqlite` and `UPLOADS_DIR=/var/data/uploads`.
3. Set `NODE_ENV=production` and `ADMIN_KEY=your_secure_passcode`.

---

## 6. Zero-Loss Production Data Migration

### For Vercel Deployment (Vercel Blob):
```bash
# Migrate local SQLite database and all 22 assignment documents directly to Vercel Blob:
npx tsx scripts/migrate-to-vercel.ts <BLOB_READ_WRITE_TOKEN> https://ewaste-dashboard-xi.vercel.app
```

### For Container / Volume Deployments:
```bash
# Run the automated migration script with your live URL and ADMIN_KEY
npx tsx scripts/migrate-to-prod.ts <YOUR_PRODUCTION_URL> <YOUR_ADMIN_KEY>
```

---

## 7. Environment Variables Reference

| Variable | Description | Default |
|---|---|---|
| `PORT` | Listening port for Express server | `3001` |
| `NODE_ENV` | Runtime environment (`production` disables `/api/reset`) | `development` |
| `DB_PATH` | File path for SQLite database file | `./data/ewaste.sqlite` |
| `UPLOADS_DIR` | Directory path for persistent file uploads | `./uploads` |
| `ADMIN_KEY` | Owner passcode for unlocking full edit and upload rights | *(optional, open in dev)* |
| `VITE_API_URL` | Optional backend API base URL if frontend is deployed on separate domain | *(empty, uses relative `/api`)* |

---

## 8. Verification Suite

Run the non-destructive academic data integrity test against any running instance:

```bash
# Test local backend
node scripts/verify-backend.mjs http://localhost:3001

# Test deployed production instance
node scripts/verify-backend.mjs https://your-deployed-app.com
```
