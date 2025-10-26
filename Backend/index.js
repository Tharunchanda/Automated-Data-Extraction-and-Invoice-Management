import express from 'express';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { extractFromFile } from './extractors.js';
import { geminiExtract } from './gemini.js';

// Load .env if present
dotenv.config();

// If service account file exists in Backend folder, enable Gemini by default
if (!process.env.USE_GEMINI) {
  try {
    const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'data-analytics-461707-b2a6c89192f0.json';
    if (saPath && fs.existsSync(saPath)) {
      process.env.USE_GEMINI = 'true';
      process.env.GOOGLE_APPLICATION_CREDENTIALS = saPath;
      console.log('Detected service account JSON, enabling USE_GEMINI=true');
    }
  } catch(e){}
}

const app = express();
const upload = multer({ dest: path.join(process.cwd(), 'uploads') });

app.use(express.json());

app.post('/api/extract', upload.array('files'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = { invoices: [], products: [], customers: [], errors: [], files: [] };

    // If Gemini integration is enabled, call it once for all files. geminiExtract
    // will run in mock/local mode if USE_GEMINI env var is not set to true.
    if (String(process.env.USE_GEMINI).toLowerCase() === 'true') {
      try {
        const r = await geminiExtract(req.files);
        results.files.push(...(r.files || []));
        results.invoices.push(...(r.invoices || []));
        results.products.push(...(r.products || []));
        results.customers.push(...(r.customers || []));
      } catch (err) {
        results.errors.push({ file: 'gemini', message: err.message });
      } finally {
        // cleanup uploaded files
        for (const f of req.files) { try { fs.unlinkSync(f.path); } catch(e){} }
      }
    } else {
      for (const f of req.files) {
        try {
          const r = await extractFromFile(f.path, f.originalname);
          // store per-file raw text for debugging
          results.files.push({ file: f.originalname, rawText: r.rawText || null });
          // merge results (simple concat, dedupe done in client or later)
          results.invoices.push(...(r.invoices || []));
          results.products.push(...(r.products || []));
          results.customers.push(...(r.customers || []));
        } catch (err) {
          results.errors.push({ file: f.originalname, message: err.message });
        } finally {
          // remove upload
          try { fs.unlinkSync(f.path); } catch(e){}
        }
      }
    }

    // simple dedupe by name for products and customers
    const uniqBy = (arr, keyFn) => {
      const map = new Map();
      for (const item of arr) map.set(keyFn(item), item);
      return Array.from(map.values());
    };

    results.products = uniqBy(results.products, p => (p.name || '').toLowerCase());
    results.customers = uniqBy(results.customers, c => (c.name || '').toLowerCase());

    // assign ids
    let prodId = 1; results.products = results.products.map(p=>({ id: prodId++, ...p }));
    let custId = 1; results.customers = results.customers.map(c=>({ id: custId++, ...c }));

    // link invoices to ids where possible
    let invId = 1;
    results.invoices = results.invoices.map(inv => {
      const customer = results.customers.find(c => (inv.customer||'').toLowerCase().includes((c.name||'').toLowerCase())) || null;
      const items = (inv.items||[]).map(it => {
        const prod = results.products.find(p => (it.name||'').toLowerCase().includes((p.name||'').toLowerCase())) || null;
        return { ...it, productId: prod ? prod.id : null };
      });
      return { id: invId++, ...inv, customerId: customer ? customer.id : null, items };
    });

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/ping', (req,res)=>res.json({ok:true}));

const port = process.env.PORT || 4000;
app.listen(port, ()=>console.log('Backend listening on', port));
