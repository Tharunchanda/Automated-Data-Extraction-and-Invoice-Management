# Swipe Invoice Management (IMS)

This repository contains a frontend (Vite + React) and backend (Node + Express) for automated invoice extraction and management.

Structure
- Frontend/: React + Vite app (UI, Redux, upload component)
- Backend/: Node/Express API (file upload, extractors, optional Gemini/Vertex AI wrapper)

Goal
- Frontend deployed to Vercel (static site)
- Backend deployed to a Node hosting service (Render, Railway, Fly, etc.) and exposed at a public URL

Quick local dev
1. Start backend

```powershell
cd Backend
npm install
node index.js
```

2. Start frontend (in another terminal)

```powershell
cd Frontend
npm install
npm run dev
```

Deployment notes
- Frontend: deploy the `Frontend/` folder to Vercel. Set environment variable `VITE_API_URL` to your backend public URL (for example `https://ims-backend.example.com`). Build command: `npm run build`. Output directory: `dist`.
- Backend: deploy to a Node host (Render, Railway, Fly, Heroku). Use the `start` script (`node index.js`). Provide any required environment variables (see `Backend/.env.example`).

CI
- A basic GitHub Actions workflow exists at `.github/workflows/ci.yml` to lint and build the frontend on push/pull requests.

If you want, I can (a) create a GitHub repo for you and push these files, or (b) add a small GitHub Actions workflow to automatically deploy the frontend to Vercel via the Vercel CLI — tell me which and I will proceed.
