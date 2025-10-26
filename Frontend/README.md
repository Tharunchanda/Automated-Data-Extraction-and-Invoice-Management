# Frontend (Vite + React)

This folder contains the Vite React app used as the UI for the IMS project.

Local dev

```powershell
cd Frontend
npm install
npm run dev
```

Build

```powershell
npm run build
```

Environment variables
- VITE_API_URL - optional. If set, the frontend will send API requests to `${VITE_API_URL}/extract`. If not set, it will use a relative `/api` path.
  - Example: `VITE_API_URL="https://ims-backend.example.com"`

Deploying to Vercel
- In Vercel choose "Import Project" → GitHub and select this repo.
- When creating the project, set the Root to `Frontend` (if you import the monorepo root), or just import the `Frontend` folder as a separate project.
- Set the Build Command to `npm run build` and the Output Directory to `dist`.
- Add Environment Variable in Vercel: `VITE_API_URL` = `https://<your-backend-url>`.

Notes
- The app uses Vite's `import.meta.env.VITE_API_URL` variable. After changing environment variables in Vercel, trigger a redeploy.
# Frontend (React)

This project contains a Vite + React frontend for the Invoice Extraction demo. It includes a file upload UI that sends files to the local backend (`/api/extract`) and three tabs (Invoices, Products, Customers) backed by Redux.

Run locally:

1. Install (if needed):

   npm install

2. Start dev server:

   npm run dev

Notes:
- The frontend is configured to proxy `/api` to `http://localhost:4000` where the backend server runs.
- After uploading files, extracted data will populate the Redux store and be visible in the tabs. Edit names in Products/Customers to see live sync into Invoices.
# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
