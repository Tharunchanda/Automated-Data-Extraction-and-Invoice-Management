# Swipe Invoice Management (IMS)

This repository contains a frontend (Vite + React) and backend (Node + Express) for automated invoice extraction and management.

Structure
- Frontend/: React + Vite app (UI, Redux, upload component)
- Backend/: Node/Express API (file upload, extractors, optional Gemini/Vertex AI wrapper)

Goal
- Frontend deployed to Vercel (static site)
- Backend deployed to a Node hosting service (Render, Railway, Fly, etc.) and exposed at a public URL

Quick local dev
# Automated Data Extraction & Invoice Management

A full-stack application that extracts structured invoice data (invoices, products, customers) from uploaded documents using a generative AI extraction service, and provides a lightweight invoice management UI with export features.

Live deployments
- Frontend (Vercel): https://swipe-ims.vercel.app
- Backend (Render): https://automated-data-extraction-and-invoice-jk3f.onrender.com/

Table of contents
- About
- Features
- Architecture & Tech Stack
- API Endpoints
- Local development
	- Backend
	- Frontend
- Environment variables
- Deployment notes
- Troubleshooting
- Contribution

## About
This project ingests PDF/images/Excel files, streams extraction progress back to the browser (Server-Sent Events), normalizes and links entities (products/customers/invoices), and lets users review, edit and export the data as Excel/CSV/PDF.

The system is intentionally pragmatic: streaming file-level results to the UI improves perceived responsiveness; final aggregated data is sent after all files are processed.

## Features
- File upload (PDF / PNG / JPG / XLSX / CSV)
- Streaming extraction progress via SSE (per-file `fileComplete` events + final `complete` event)
- Normalization & linking of products, customers and invoices
- Incremental Redux updates and final aggregated state
- Export to Excel/CSV and PDF (ExcelJS, jsPDF with auto-table)
- Mobile-first responsive UI using Tailwind
- Production-ready backend: CORS handling, upload limits, error middleware, health endpoint

## Architecture & Tech Stack
- Backend: Node.js + Express, Multer (file uploads), SSE streaming endpoint
- Frontend: React + Vite, Redux Toolkit, Tailwind CSS
- Document extraction: integrated to a Gemini-like generative extraction flow (wrapped in `geminiExtract`)
- Exports: ExcelJS, jsPDF (+ jspdf-autotable)
- Deployments: Render (backend) and Vercel (frontend)

Key packages (selected)
- Backend: express, multer, cors, dotenv, @google/generative-ai (gemini wrapper), pdf-parse, sharp, tesseract.js, exceljs
- Frontend: react, react-dom, @reduxjs/toolkit, react-redux, exceljs, jspdf, jspdf-autotable, tailwindcss

## API Endpoints
- POST /api/extract (single-request extraction, returns aggregated JSON)
- POST /api/extract-stream (Server-Sent Events): returns progressive events:
	- `progress` — processing status for a file
	- `fileComplete` — per-file extracted data: { invoices, products, customers, fileName, currentFile, totalFiles }
	- `fileError` — per-file error
	- `complete` — final aggregated data: { invoices, products, customers, files, extraDetails }
- GET /api/health — service health and basic env info

Notes: the frontend uses `/api/extract-stream` by default to provide live progress.

## Local development
Prerequisites: Node.js (v18+ recommended), npm

1) Backend

Open a terminal in `Backend/` and install dependencies:

```powershell
cd Backend
npm install
```

Create a `.env` based on `.env.example` and set required keys (see Environment variables below).

Run in development with auto-reload:

```powershell
npm run dev
# or
npm start
```

The backend listens on the port configured in `.env` or default port (check `index.js`).

2) Frontend

Open a terminal in `Frontend/`:

```powershell
cd Frontend
npm install
npm run dev
```

By default the frontend reads `VITE_API_URL` from `.env` (for production) or will fall back to `http://localhost:4000/api` for local testing if not set.

Build for production:

```powershell
npm run build
npm run preview
```

## Environment variables

Backend (examples in `Backend/.env.example`):
- GEMINI_API_KEY (or relevant API key used by `gemini.js`)
- FRONTEND_URL (allowed CORS origin for the deployed frontend)
- PORT (optional)

Frontend (`Frontend/.env`):
- VITE_API_URL (e.g. `https://automated-data-extraction-and-invoice-jk3f.onrender.com/api`)

Security: never commit real API keys to the repository. Use the hosting providers' environment variable settings (Render/Vercel) for secrets.

## Deployment notes
- Backend: `render.yaml` exists for Render; ensure `GEMINI_API_KEY` and `FRONTEND_URL` are configured in Render's environment. Multer limits are set to 10 MB per file, max 10 files.
- Frontend: `vercel.json` is included for SPA routing. Set `VITE_API_URL` in Vercel project settings to point at the Render backend.

## Troubleshooting
- CORS errors: ensure `FRONTEND_URL` (or the deployed Vercel origin) is present in backend allowed origins. Also verify `VITE_API_URL` points at the correct backend URL.
- SSE / proxy: Vite dev server proxy may not behave the same as production; set `VITE_API_URL` to the backend local URL when developing locally.
- Missing bundles (jspdf) on deployment: confirm dependencies are listed in the proper `Frontend/package.json` and that Vite plugin `@vitejs/plugin-react` is present.
- Products not appearing in products tab: the app streams per-file `fileComplete` events and dispatches incremental updates. The final `complete` event also contains the aggregated products — check browser console logs for `fileComplete` and `complete` event payloads.

## Contribution
- Fork, create a feature branch, and open a PR with a brief description and screenshots (if UI changes).
- For heavy refactors, open an issue first to discuss the approach.

## What I changed (notes for reviewers)
- Streaming SSE extraction flow implemented (per-file `fileComplete` + final `complete`)
- Frontend: added SSE parsing logic, incremental Redux dispatches (`addInvoices`, `addProducts`, `addCustomers`) plus final `setInvoices/setProducts/setCustomers` on `complete`
- Mobile-first responsive redesign of main layout and tables using Tailwind
- Added better error handling and user messaging for long-running processing steps
- Added DEPLOYMENT.md, `render.yaml`, and `vercel.json` to simplify repeatable deployments
