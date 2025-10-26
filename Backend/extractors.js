import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import Tesseract from 'tesseract.js';
import ExcelJS from 'exceljs';

// Basic heuristics / regexes used across extractors
const reDate = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\-]\d{1,2}[\-]\d{1,2})\b/;
const reAmount = /(?:₹|Rs\.?|USD|EUR|\$)?\s?([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{1,2})?)/g;

function findAmounts(text) {
  const matches = [];
  let m;
  while ((m = reAmount.exec(text))) {
    matches.push(parseFloat(m[1].replace(/[,\s]/g, '')));
  }
  return matches;
}

export async function extractFromFile(filePath, originalName) {
  const ext = path.extname(originalName || filePath).toLowerCase();
  if (ext === '.xlsx' || ext === '.xls') return await extractFromExcel(filePath);
  if (ext === '.pdf') return await extractFromPdf(filePath);
  if (['.png', '.jpg', '.jpeg', '.tiff', '.bmp'].includes(ext)) return await extractFromImage(filePath);
  throw new Error('Unsupported file type: ' + ext);
}

async function extractFromExcel(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const invoices = [];
  const products = [];
  const customers = [];
  let allRowsText = [];
  workbook.eachSheet((sheet) => {
    const rows = [];
    sheet.eachRow(r => rows.push(r.values));

    // Try to find header row
    const header = rows[1] || rows[0] || [];
    const headers = header.map(h=> (h||'').toString().toLowerCase());

    // Simple heuristics: look for columns with 'serial'/'invoice' and 'customer' and 'qty' and 'price'
    const nameIdx = headers.findIndex(h=>h.includes('customer')||h.includes('name'));
    const serialIdx = headers.findIndex(h=>h.includes('serial')||h.includes('invoice')||h.includes('sno'));
    const qtyIdx = headers.findIndex(h=>h.includes('qty')||h.includes('quantity'));
    const priceIdx = headers.findIndex(h=>h.includes('price')||h.includes('unit'));
    const totalIdx = headers.findIndex(h=>h.includes('total')||h.includes('amount'));

    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i).values;
      if (!row) continue;
      const customer = nameIdx >=0 ? row[nameIdx] : null;
      const serial = serialIdx >=0 ? row[serialIdx] : null;
      const qty = qtyIdx>=0 ? row[qtyIdx] : null;
      const unit = priceIdx>=0 ? row[priceIdx] : null;
      const total = totalIdx>=0 ? row[totalIdx] : null;

      if (serial || customer || total) {
        invoices.push({ serial: serial ? String(serial) : null, customer: customer ? String(customer) : null, date: null, items: qty||unit ? [{ name: 'Item', qty: qty||1, unitPrice: unit||null, tax: null }] : [], total: total ? Number(total) : null });
        if (customer) customers.push({ name: String(customer), phone: null, totalPurchase: total ? Number(total) : 0 });
        if (unit) products.push({ name: 'Item', quantity: qty||0, unitPrice: Number(unit), tax: null, priceWithTax: unit ? Number(unit) : null });
      }
    }
    // collect sheet text preview
    try {
      const sheetText = rows.map(r => Array.isArray(r) ? r.join(' | ') : String(r)).join('\n');
      allRowsText.push(sheetText);
    } catch (e) {}
  });

  const rowsText = allRowsText.join('\n');
  return { invoices, products, customers, rawText: (rowsText||'').slice(0,2000) };
}

async function extractFromPdf(filePath) {
  const data = fs.readFileSync(filePath);
  // dynamic import to handle CommonJS module compatibility and multiple export shapes
  const pdfModule = await import('pdf-parse');
  let pdfParse = null;
  if (typeof pdfModule === 'function') pdfParse = pdfModule;
  else if (pdfModule && typeof pdfModule.default === 'function') pdfParse = pdfModule.default;
  else if (pdfModule && typeof pdfModule.pdfParse === 'function') pdfParse = pdfModule.pdfParse;
  else throw new Error('Unable to load pdf-parse function from module');

  let parsed;
  try {
    parsed = await pdfParse(data);
  } catch (err) {
    console.error('pdf-parse error:', err);
    parsed = { text: '' };
  }
  let text = parsed.text || '';

  // If pdf-parse didn't extract useful text (image-only PDF), try rasterizing pages
  // and running Tesseract OCR as a fallback.
  try {
    if (!text || text.trim().length < 20) {
      // create temp directory
      const tmpDir = fs.mkdtempSync(path.join(process.cwd(), 'tmp_pdf_'));
      const outPrefix = path.join(tmpDir, 'page');

      // run pdftoppm to rasterize PDF to PNGs (requires poppler pdftoppm installed)
      const cmd = 'pdftoppm';
      const args = ['-png', filePath, outPrefix];
      const spawnRes = spawnSync(cmd, args, { encoding: 'utf8' });
      if (spawnRes.error) {
        console.warn('pdftoppm not available or failed:', spawnRes.error.message);
      } else if (spawnRes.status !== 0) {
        console.warn('pdftoppm exit status', spawnRes.status, spawnRes.stderr || spawnRes.stdout);
      } else {
        // collect generated PNGs
        const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.png')).sort();
        let ocrText = '';
        for (const f of files) {
          const imgPath = path.join(tmpDir, f);
          try {
            const res = await Tesseract.recognize(imgPath, 'eng', { logger: m=>{} });
            ocrText += '\n' + (res.data?.text || '');
          } catch (e) {
            console.error('tesseract error on', imgPath, e.message);
          }
        }
        if (ocrText && ocrText.trim().length>0) {
          console.log('PDF OCR fallback produced text length', ocrText.length);
          text = ocrText;
        }
      }

      // cleanup tmp dir
      try {
        const tmpFiles = fs.readdirSync(tmpDir);
        for (const f of tmpFiles) try { fs.unlinkSync(path.join(tmpDir, f)); } catch(e){}
        fs.rmdirSync(tmpDir);
      } catch(e){}
    }
  } catch (e) {
    console.error('OCR fallback error:', e.message);
  }

  // Basic heuristics: find invoice/serial, customer name, date, amounts
  const invoices = [];
  const products = [];
  const customers = [];

  const serialMatch = text.match(/(?:invoice\s*no\.?|inv\s*#|serial)[:\s]*(\S+)/i);
  const dateMatch = text.match(reDate);
  const amounts = findAmounts(text);

  // Attempt to extract item lines by looking for patterns like 'qty' and numbers
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const items = [];
  for (const ln of lines) {
    // a naive detection: line contains a word and two numbers (qty and amount)
    const parts = ln.split(/\s{2,}|\t|\s-\s|,|\|/).map(s=>s.trim()).filter(Boolean);
    if (parts.length>=2) {
      const lastNums = parts.slice(-2).map(p=>p.replace(/[^0-9.]/g,'')).filter(Boolean);
      if (lastNums.length>=1 && /\d/.test(lastNums[0])) {
        // treat as item
        items.push({ name: parts.slice(0, parts.length-2).join(' ') || parts[0], qty: parseFloat(lastNums[0])||1, unitPrice: lastNums[1] ? parseFloat(lastNums[1]) : null, tax: null });
      }
    }
  }

  const customerLine = lines.find(l=>/customer|bill to|ship to/i.test(l)) || lines.find(l=>/phone|mobile/i.test(l));
  const customer = customerLine ? customerLine.replace(/(customer|bill to|ship to)[:\-\s]*/i,'') : null;

  invoices.push({ serial: serialMatch ? serialMatch[1] : null, customer: customer, date: dateMatch ? dateMatch[0] : null, items, total: amounts.length? Math.max(...amounts): null });
  if (customer) customers.push({ name: customer, phone: null, totalPurchase: amounts.length? Math.max(...amounts):0 });
  if (items.length) products.push(...items.map(it=>({ name: it.name || 'Item', quantity: it.qty||0, unitPrice: it.unitPrice||null, tax: null, priceWithTax: it.unitPrice||null })));

  return { invoices, products, customers, rawText: text.slice(0, 2000) };
}

async function extractFromImage(filePath) {
  // Use tesseract to read text and then reuse pdf logic on text
  const res = await Tesseract.recognize(filePath, 'eng', { logger: m => {} });
  const text = res.data?.text || '';

  // mimic pdf extraction minimal
  const invoices = [];
  const products = [];
  const customers = [];
  const serialMatch = text.match(/(?:invoice\s*no\.?|inv\s*#|serial)[:\s]*(\S+)/i);
  const dateMatch = text.match(reDate);
  const amounts = findAmounts(text);
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const items = [];
  for (const ln of lines) {
    const parts = ln.split(/\s{2,}|\t|\s-\s|,|\|/).map(s=>s.trim()).filter(Boolean);
    if (parts.length>=2) {
      const lastNums = parts.slice(-2).map(p=>p.replace(/[^0-9.]/g,'')).filter(Boolean);
      if (lastNums.length>=1 && /\d/.test(lastNums[0])) items.push({ name: parts.slice(0, parts.length-2).join(' ') || parts[0], qty: parseFloat(lastNums[0])||1, unitPrice: lastNums[1] ? parseFloat(lastNums[1]) : null, tax: null });
    }
  }
  const customerLine = lines.find(l=>/customer|bill to|ship to/i.test(l)) || null;
  const customer = customerLine ? customerLine.replace(/(customer|bill to|ship to)[:\-\s]*/i,'') : null;
  invoices.push({ serial: serialMatch ? serialMatch[1] : null, customer: customer, date: dateMatch ? dateMatch[0] : null, items, total: amounts.length? Math.max(...amounts): null });
  if (customer) customers.push({ name: customer, phone: null, totalPurchase: amounts.length? Math.max(...amounts):0 });
  if (items.length) products.push(...items.map(it=>({ name: it.name || 'Item', quantity: it.qty||0, unitPrice: it.unitPrice||null, tax: null, priceWithTax: it.unitPrice||null })));
  return { invoices, products, customers, rawText: text.slice(0, 2000) };
}
