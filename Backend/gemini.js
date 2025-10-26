import fs from 'fs';
import path from 'path';
import { extractFromFile } from './extractors.js';

// This module provides a safe wrapper to call Google Vertex AI (Gemini)
// for document extraction. It also supports a mock/local mode so the
// server runs without real credentials.

async function mockExtract(files) {
  // Run local extractors as a mock for Gemini to allow testing without keys
  const invoices = [];
  const products = [];
  const customers = [];
  const fileInfos = [];

  for (const f of files) {
    try {
      const r = await extractFromFile(f.path, f.originalname);
      fileInfos.push({ file: f.originalname, rawText: r.rawText || null });
      invoices.push(...(r.invoices||[]));
      products.push(...(r.products||[]));
      customers.push(...(r.customers||[]));
    } catch (err) {
      fileInfos.push({ file: f.originalname, rawText: null });
    }
  }

  return { invoices, products, customers, files: fileInfos };
}

export async function geminiExtract(files) {
  // If USE_GEMINI is not explicitly "true", run mock local extraction
  if (String(process.env.USE_GEMINI).toLowerCase() !== 'true') {
    return await mockExtract(files);
  }

  // If Gemini mode enabled, ensure credentials are present
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GCLOUD_SERVICE_KEY) {
    throw new Error('Gemini mode enabled but GOOGLE_APPLICATION_CREDENTIALS or GCLOUD_SERVICE_KEY not set');
  }

  // Attempt to import Vertex AI client dynamically. If unavailable, instruct user.
  let aiplatform;
  try {
    aiplatform = await import('@google-cloud/aiplatform');
  } catch (err) {
    throw new Error('Missing @google-cloud/aiplatform package. Run `npm install @google-cloud/aiplatform`');
  }

  // Placeholder: minimal example of calling Vertex AI Generative Models.
  // Full multimodal calls require model selection and proper request shape.
  // Here we implement a simple pattern: for each file, upload to GCS if a bucket
  // is provided and then call the model with a prompt asking for JSON output.

  // If GCLOUD_BUCKET is configured upload files and create URIs
  let storage;
  let gcsUris = [];
  if (process.env.GCLOUD_BUCKET) {
    try {
      const {Storage} = await import('@google-cloud/storage');
      storage = new Storage();
      for (const f of files) {
        const dest = `${Date.now()}_${path.basename(f.originalname)}`;
        await storage.bucket(process.env.GCLOUD_BUCKET).upload(f.path, { destination: dest });
        gcsUris.push(`gs://${process.env.GCLOUD_BUCKET}/${dest}`);
      }
    } catch (err) {
      throw new Error('Failed to upload files to GCS: ' + err.message);
    }
  }

  // Create Vertex AI client
  const {PredictionServiceClient,} = aiplatform.v1;
  const client = new PredictionServiceClient();

  // We'll build a prompt for the model. This is a simple example; for best
  // results you should refine the prompt and possibly use structured tool calls.
  const location = process.env.GCLOUD_REGION || 'us-central1';
  const model = process.env.GEMINI_MODEL || 'models/text-bison@001';

  const invoices = [];
  const products = [];
  const customers = [];
  const fileInfos = [];

  for (let i=0;i<files.length;i++) {
    const f = files[i];
    const uri = gcsUris[i] || null;
    // Build a helpful instruction prompt
    const instruction = `Extract invoice fields from the document. Return JSON with arrays invoices, products, customers. Each invoice: serial, date, customer, items [{name, qty, unitPrice, tax}], total. If a field is missing set null. Provide only valid JSON.`;

    // Construct request. Note: this is an example and may require adjustments
    // depending on the Vertex AI client library version and model capabilities.
    const request = {
      endpoint: `projects/${process.env.GCLOUD_PROJECT}/locations/${location}/publishers/google/models/${model}`,
      instances: [ { content: uri ? `Please parse document at ${uri}. ${instruction}` : `Please parse the following document (text omitted due to size): ${instruction}` } ],
    };

    try {
      // Call the prediction client - this is illustrative. You may instead use
      // the Generative API client in @google-cloud/aiplatform (check docs).
      const [response] = await client.predict(request);
      // Response parsing depends on model output. Here we attempt to find JSON text
      const payload = response.predictions && response.predictions[0] ? response.predictions[0] : response;
      const textOut = JSON.stringify(payload);
      // try to extract JSON embedded in text
      let jsonText = null;
      try {
        // naive: find first { and last }
        const first = textOut.indexOf('{');
        const last = textOut.lastIndexOf('}');
        if (first>=0 && last>first) jsonText = textOut.slice(first, last+1);
      } catch(e){}

      let parsed = null;
      if (jsonText) {
        try { parsed = JSON.parse(jsonText); } catch(e) { parsed = null; }
      }

      if (parsed && (parsed.invoices||parsed.products||parsed.customers)) {
        invoices.push(...(parsed.invoices||[]));
        products.push(...(parsed.products||[]));
        customers.push(...(parsed.customers||[]));
        fileInfos.push({ file: f.originalname, rawText: jsonText });
      } else {
        // fallback to local extraction per-file if model didn't return structured data
        const r = await extractFromFile(f.path, f.originalname);
        fileInfos.push({ file: f.originalname, rawText: r.rawText || null });
        invoices.push(...(r.invoices||[]));
        products.push(...(r.products||[]));
        customers.push(...(r.customers||[]));
      }
    } catch (err) {
      // Log error for debugging, then fallback to local extract so we never completely fail
      console.error('geminiExtract error for file', f.originalname, err);
      const r = await extractFromFile(f.path, f.originalname);
      fileInfos.push({ file: f.originalname, rawText: r.rawText || null, error: err.message });
      invoices.push(...(r.invoices||[]));
      products.push(...(r.products||[]));
      customers.push(...(r.customers||[]));
    }
  }

  return { invoices, products, customers, files: fileInfos };
}

export default { geminiExtract };
