# Backend (Node + Express)

This folder contains the backend API that handles file uploads and extraction pipelines.

Local dev

```powershell
cd Backend
npm install
node index.js
```

Environment variables (example)
- PORT=4000
- USE_GEMINI=true|false — optional toggle for using Gemini/Vertex AI wrapper
- GCLOUD_SERVICE_ACCOUNT — path to a Google Cloud service account JSON (if using Vertex AI)
- GCLOUD_BUCKET — optional bucket name if the pipeline uploads files to GCS

Deployment
- Recommended hosts: Render, Railway, Fly, Heroku. These allow you to run a Node process with `node index.js`.
- On Render: create a new Web Service pointing to this repo and set the Root Directory to `Backend` (or create a separate service); set the Start Command to `node index.js` and add the env vars above.

Security
- Keep any Google Cloud service account JSON secret. Use the host's secret/env var store rather than checking secrets into git.
# Backend (local extraction service)

This backend provides a simple `/api/extract` endpoint which accepts multipart file uploads and returns JSON arrays for `invoices`, `products`, and `customers`.

Features:
- Excel reading via `exceljs`
- PDF text extraction via `pdf-parse` (simple heuristics)
- Image OCR via `tesseract.js`

Run locally:

1. Install dependencies (already installed in this workspace):

   npm install

2. Start server:

   node index.js

The server listens on port 4000 by default. Frontend (Vite) is configured to proxy `/api` to this backend in `Frontend/vite.config.js`.

Notes:
- This is a heuristic-based extractor for basic invoice formats. It will not match every layout; use the frontend UI to correct missing fields.
- For higher accuracy, you can later add Google Gemini / Document AI integration in this backend and replace the `extractors.js` logic.

Gemini (Vertex AI) integration
--------------------------------
This project includes an optional Gemini (Vertex AI) integration. To enable it:

1. Install additional packages in the Backend folder:

   npm install @google-cloud/aiplatform @google-cloud/storage

2. Set environment variables (example):

   # path to service account JSON file
   setx GOOGLE_APPLICATION_CREDENTIALS "C:\path\to\service-account.json"
   # (optional) GCS bucket to upload files before calling Gemini
   setx GCLOUD_BUCKET "your-gcs-bucket-name"
   # enable Gemini mode
   setx USE_GEMINI true
   # Google Cloud project id
   setx GCLOUD_PROJECT "your-project-id"
   # region (optional)
   setx GCLOUD_REGION "us-central1"

3. Restart the backend. When `USE_GEMINI` is `true`, the server will attempt to call Vertex AI
   for multimodal extraction. If anything fails, the backend falls back to the local extractors so
   your app continues to work.

Mock mode
---------
By default (when `USE_GEMINI` is not `true`) the server uses local extractors as a mock implementation.
This allows you to develop and test the full end-to-end flow without Google Cloud credentials.

Notes about cost and security
-----------------------------
- Calling Vertex AI costs money; use billing alerts and quotas to avoid surprises. Test with a small number of files first.
- Keep service account JSON secret; store it in your deployment platform's secret manager rather than source control.

