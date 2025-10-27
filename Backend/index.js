import express from 'express';
import dotenv from 'dotenv';
import multer from 'multer';
import cors from 'cors';
import { geminiExtract } from './gemini.js';

// Load .env if present
dotenv.config();

const app = express();

// CORS configuration for production
const corsOptions = {
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

const upload = multer({ storage: multer.memoryStorage() }); // Store files in memory for direct access

app.use(express.json());

// -------------------- helpers: totals and parsing --------------------
function num(v, d = 0) {
  const n = typeof v === 'string' ? Number(v.replace(/[^0-9.\-]/g, '')) : Number(v);
  return Number.isFinite(n) ? n : d;
}

function pctFrom(obj, key) {
  const v = obj?.[key];
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const m = String(v).match(/([0-9]+(?:\.[0-9]+)?)\s*%/);
  return m ? Number(m[1]) : num(v, 0);
}

function getInvoiceTaxPercent(inv) {
  try {
    const t = inv.taxes || inv.tax || {};
    const cg = pctFrom(t, 'CGST');
    const sg = pctFrom(t, 'SGST');
    const ig = pctFrom(t, 'IGST');
    const g = pctFrom(t, 'GST');
    const sum = (cg + sg + ig);
    return sum > 0 ? sum : (g > 0 ? g : null);
  } catch {
    return null;
  }
}

function parseTaxPercent(item, invoiceTaxPercent) {
  // prefer explicit line percent
  if (item.taxPercent != null) return num(item.taxPercent, null);
  if (typeof item.tax === 'string') {
    const m = item.tax.match(/([0-9]+(?:\.[0-9]+)?)\s*%/);
    if (m) return Number(m[1]);
  }
  if (invoiceTaxPercent != null) return invoiceTaxPercent;
  return null;
}

function parseUnitBreakdown(item, invoiceTaxPercent) {
  const qty = num(item.qty ?? item.quantity ?? 1, 1);
  let unitEx = item.unitPrice ?? item.unitPriceExclTax ?? null;
  let unitIncl = item.unitPriceWithTax ?? null;
  let taxPercent = parseTaxPercent(item, invoiceTaxPercent);
  let unitTaxAmt = item.taxAmountPerUnit != null ? num(item.taxAmountPerUnit, null) : null;

  // Derive unknowns where possible
  if (unitEx == null && unitIncl != null && taxPercent != null) {
    unitEx = Number((unitIncl / (1 + taxPercent / 100)).toFixed(6));
  }
  if (unitIncl == null && unitEx != null && taxPercent != null) {
    unitIncl = Number((unitEx * (1 + taxPercent / 100)).toFixed(6));
  }
  if (unitTaxAmt == null && unitEx != null && taxPercent != null) {
    unitTaxAmt = Number((unitEx * (taxPercent / 100)).toFixed(6));
  }
  if (unitTaxAmt == null && unitEx != null && unitIncl != null) {
    unitTaxAmt = Number((unitIncl - unitEx).toFixed(6));
  }

  // Fallback: if we only have inclusive and invoice-level percent
  if (unitEx == null && unitIncl != null && taxPercent == null && invoiceTaxPercent != null) {
    taxPercent = invoiceTaxPercent;
    unitEx = Number((unitIncl / (1 + taxPercent / 100)).toFixed(6));
    unitTaxAmt = Number((unitIncl - unitEx).toFixed(6));
  }

  const lineTaxable = unitEx != null ? Number((unitEx * qty).toFixed(2)) : 0;
  const lineTax = unitTaxAmt != null ? Number((unitTaxAmt * qty).toFixed(2)) : 0;
  const lineGross = (unitIncl != null
    ? Number((unitIncl * qty).toFixed(2))
    : (unitEx != null ? Number(((unitEx + (unitTaxAmt || 0)) * qty).toFixed(2)) : 0));

  return { qty, unitEx, unitIncl, taxPercent, unitTaxAmt, lineTaxable, lineTax, lineGross };
}

function sumCharges(inv) {
  const charges = Array.isArray(inv.charges) ? inv.charges : [];
  let total = 0;
  for (const c of charges) {
    if (c == null) continue;
    if (typeof c === 'number') total += c;
    else if (typeof c === 'string') total += num(c, 0);
    else if (typeof c === 'object') total += num(c.amount ?? c.price ?? c.value ?? 0, 0);
  }
  return Number(total.toFixed(2));
}

function computeInvoiceTotals(inv) {
  const invoiceTaxPercent = getInvoiceTaxPercent(inv);
  let taxableSum = 0;
  let taxSum = 0;
  let grossSum = 0;

  for (const it of (inv.items || [])) {
    const b = parseUnitBreakdown(it, invoiceTaxPercent);
    taxableSum += b.lineTaxable;
    taxSum += b.lineTax;
    grossSum += b.lineGross;
  }

  // If no line-level tax, apply invoice-level percent to taxable
  if (taxSum === 0 && invoiceTaxPercent != null && taxableSum > 0) {
    taxSum = Number((taxableSum * (invoiceTaxPercent / 100)).toFixed(2));
    grossSum = Number((taxableSum + taxSum).toFixed(2));
  }

  const chargesTotal = sumCharges(inv);
  const total = Number((grossSum + chargesTotal).toFixed(2));

  return {
    taxableAmount: Number(taxableSum.toFixed(2)),
    taxTotal: Number(taxSum.toFixed(2)),
    chargesTotal,
    total
  };
}
// --------------------------------------------------------------------

app.post('/api/extract', upload.array('files'), async (req, res) => {
  console.log('\n📥 Received extraction request');
  
  try {
    // 1. Validate files
    if (!req.files || req.files.length === 0) {
      console.log('❌ No files uploaded');
      return res.status(400).json({ error: 'No files uploaded' });
    }
    console.log(`✅ Received ${req.files.length} file(s):`, req.files.map(f => f.originalname));

    // 2. Extract data using Gemini
    console.log('🔄 Calling Gemini extraction...');
    const results = await geminiExtract(req.files);
    console.log('✅ Gemini extraction complete');

    // Ensure unique IDs for all entities
    let prodId = 1;
    let custId = 1;
    let invId = 1;

    // 3. Process and link entities
    console.log('🔄 Processing entities...');
    
    // Add IDs to products and customers and normalize product fields expected by frontend
    results.products = (results.products || []).map(p => ({
      // normalize product shape for frontend
      id: prodId++,
      name: p.name || p.productName || 'Item',
      description: p.description || null,
      // frontend expects quantity, unitPrice, tax, priceWithTax
      quantity: typeof p.quantity === 'number' ? p.quantity : (p.qty || 0),
      unitPrice: p.unitPrice ?? p.price ?? null,
      tax: p.tax ?? null,
      priceWithTax: p.priceWithTax ?? p.unitPrice ?? p.price ?? null,
      // keep any original fields too (original fields merged last)
      ...p
    }));
    // Normalize customers with expected fields (name, contact/phone, address, totalPurchase)
    results.customers = (results.customers || []).map(c => ({
      id: custId++,
      name: c.name || c.customerName || c.fullName || 'Customer',
      address: c.address || null,
      phone: c.phone || c.contact || c.mobile || null,
      totalPurchase: typeof c.totalPurchase === 'number' ? c.totalPurchase : (c.total || 0),
      ...c
    }));
    console.log(`✅ Processed: ${results.products.length} products, ${results.customers.length} customers`);

    // Add IDs to invoices and link to products/customers
    console.log('🔄 Linking invoices to products and customers...');
    results.invoices = (results.invoices || []).map(inv => {
      // Handle customer matching with proper type checking
      const customerName = typeof inv.customer === 'string' ? inv.customer 
        : typeof inv.customer === 'object' && inv.customer ? inv.customer.name
        : '';
      
      const customer = results.customers.find(c => {
        const cName = (c.name || '').toLowerCase();
        return customerName.toLowerCase().includes(cName) || cName.includes(customerName.toLowerCase());
      });
      
      // Handle items with proper type checking
      const items = (inv.items || []).map(item => {
        const itemName = typeof item.name === 'string' ? item.name : '';
        const product = results.products.find(p => {
          const pName = (p.name || '').toLowerCase();
          return itemName.toLowerCase().includes(pName) || pName.includes(itemName.toLowerCase());
        });
        return { ...item, productId: product ? product.id : null };
      });

      const linked = {
        id: invId++,
        ...inv,
        customerId: customer ? customer.id : null,
        items
      };

      // Compute totals for invoice
      const totals = computeInvoiceTotals(linked);
      return { ...linked, ...totals };
    });

    // 4. Send response
    // Aggregate product quantities and prices from invoices when possible
    try {
      const prodMap = new Map();
      results.products.forEach(p => prodMap.set(p.id, { ...p, quantity: p.quantity || 0 }));

      (results.invoices || []).forEach(inv => {
        // Compute invoice total tax percent as fallback (CGST+SGST or IGST)
        let invoiceTaxPercent = null;
        try {
          const t = inv.taxes || {};
          const cg = t.CGST?.percent ? Number(t.CGST.percent) : 0;
          const sg = t.SGST?.percent ? Number(t.SGST.percent) : 0;
          const ig = t.IGST?.percent ? Number(t.IGST.percent) : 0;
          const sum = (cg + sg + ig);
          invoiceTaxPercent = sum > 0 ? sum : null;
        } catch {}

        (inv.items || []).forEach(item => {
          if (item.productId && prodMap.has(item.productId)) {
            const prod = prodMap.get(item.productId);
            const itemQty = Number(item.qty ?? item.quantity ?? 0) || 0;
            // Prefer explicit exclusive-of-tax unit price; fallback to price field
            const itemUnit = item.unitPrice ?? item.unitPriceExclTax ?? item.price ?? null;
            const unitIncl = item.unitPriceWithTax ?? null;

            // sum quantities
            prod.quantity = (prod.quantity || 0) + itemQty;

            // set unitPrice if missing
            if (!prod.unitPrice && itemUnit != null) prod.unitPrice = Number(itemUnit);

            // tax handling: prefer taxPercent or taxAmountPerUnit or derive from inclusive price
            let unitTaxAmount = null;
            let unitTaxPercent = null;
            if (item.taxPercent != null) {
              unitTaxPercent = Number(item.taxPercent);
              if (prod.unitPrice != null) unitTaxAmount = prod.unitPrice * (unitTaxPercent / 100);
            } else if (item.taxAmountPerUnit != null) {
              unitTaxAmount = Number(item.taxAmountPerUnit);
              if (prod.unitPrice != null && unitTaxAmount >= 0) {
                unitTaxPercent = (unitTaxAmount / prod.unitPrice) * 100;
              }
            } else if (unitIncl != null && (itemUnit != null)) {
              // derive per-unit tax from inclusive minus exclusive
              const delta = Number(unitIncl) - Number(itemUnit);
              if (!Number.isNaN(delta) && delta >= 0) {
                unitTaxAmount = delta;
                if (itemUnit > 0) unitTaxPercent = (delta / itemUnit) * 100;
              }
            } else if (invoiceTaxPercent != null && itemUnit != null) {
              // fallback: use invoice level tax percent
              unitTaxPercent = invoiceTaxPercent;
              unitTaxAmount = Number(itemUnit) * (unitTaxPercent / 100);
            } else if (item.tax != null) {
              // support legacy fields: tax number/percent string
              if (typeof item.tax === 'number') {
                // treat number as tax amount per item if >1, else as percent (e.g., 5 means 5%)
                if (item.tax > 1 && prod.unitPrice != null) {
                  unitTaxAmount = Number(item.tax);
                  unitTaxPercent = (unitTaxAmount / prod.unitPrice) * 100;
                } else {
                  unitTaxPercent = Number(item.tax);
                  if (prod.unitPrice != null) unitTaxAmount = prod.unitPrice * (unitTaxPercent / 100);
                }
              } else if (typeof item.tax === 'string') {
                const pctMatch = item.tax.match(/([0-9]+(?:\.[0-9]+)?)\s*%/);
                if (pctMatch) {
                  unitTaxPercent = Number(pctMatch[1]);
                  if (prod.unitPrice != null) unitTaxAmount = prod.unitPrice * (unitTaxPercent / 100);
                } else {
                  // try parse as amount
                  const num = Number(item.tax.replace(/[^0-9\.\-]/g, ''));
                  if (!Number.isNaN(num)) unitTaxAmount = num;
                }
              }
            }

            // set product.tax as percent if available, otherwise amount per unit
            if (unitTaxPercent != null) prod.tax = `${unitTaxPercent}%`;
            else if (unitTaxAmount != null) prod.tax = Number(unitTaxAmount.toFixed(2));

            // compute priceWithTax per unit
            if (unitIncl != null) {
              prod.priceWithTax = Number(unitIncl);
            } else if (prod.unitPrice != null) {
              const taxPerUnit = unitTaxAmount != null ? unitTaxAmount : 0;
              prod.priceWithTax = Number((prod.unitPrice + taxPerUnit).toFixed(2));
            }

            prodMap.set(prod.id, prod);
          }
        });
      });

      // write back to results.products preserving order
      results.products = results.products.map(p => prodMap.get(p.id) || p);
    } catch (aggErr) {
      console.warn('Product aggregation failed:', aggErr.message);
    }

    // Aggregate totals for customers from invoices
    try {
      const custMap = new Map();
      results.customers.forEach(c => custMap.set(c.id, { ...c, totalPurchase: Number(c.totalPurchase || 0) }));
      (results.invoices || []).forEach(inv => {
        const cid = inv.customerId;
        const invTotal = Number(inv.total ?? inv.amount ?? 0) || 0;
        if (cid && custMap.has(cid)) {
          const cust = custMap.get(cid);
          cust.totalPurchase = (cust.totalPurchase || 0) + invTotal;
          custMap.set(cust.id, cust);
        }
      });
      // write back to results.customers preserving order
      results.customers = results.customers.map(c => custMap.get(c.id) || c);
    } catch (custErr) {
      console.warn('Customer aggregation failed:', custErr.message);
    }

    // -------------------- build extraDetails summary for UI --------------------
    try {
      const lines = [];
      (results.invoices || []).forEach(inv => {
        lines.push(`Invoice: ${inv.serial || inv.id || 'unknown'}`);
        // Skip standard fields
        const skip = new Set(['id','serial','date','customer','items','total','customerId']);
        Object.keys(inv || {}).forEach(k => {
          if (skip.has(k)) return;
          const v = inv[k];
          if (v == null) return;
          if (typeof v === 'object') {
            try { lines.push(`  ${k}: ${JSON.stringify(v)}`); }
            catch (e) { lines.push(`  ${k}: [complex]`); }
          } else {
            lines.push(`  ${k}: ${v}`);
          }
        });
      });
      results.extraDetails = lines.join('\n') || '';
    } catch (e) {
      results.extraDetails = '';
    }
    // ------------------------------------------------------------------------

    console.log('📤 Sending response...');
    console.log('Final counts:', {
      invoices: results.invoices.length,
      products: results.products.length,
      customers: results.customers.length,
      files: results.files.length
    });
    res.json(results);
    console.log('✅ Request complete\n');

  } catch (err) {
    console.error('❌ Extraction error:', err);
    const errorResponse = { 
      error: err.message,
      details: 'Make sure GEMINI_API_KEY is set in .env file'
    };
    console.error('Sending error response:', errorResponse);
    res.status(500).json(errorResponse);
  }
});

app.get('/api/ping', (req, res) => res.json({ ok: true }));

// New streaming endpoint for incremental file processing
app.post('/api/extract-stream', upload.array('files'), async (req, res) => {
  console.log('\n📥 Received streaming extraction request');
  
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  // Set headers for Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (eventType, data) => {
    res.write(`event: ${eventType}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    let prodId = 1;
    let custId = 1;
    let invId = 1;
    
    const allInvoices = [];
    const allProducts = [];
    const allCustomers = [];
    const processedFiles = [];

    // Process each file one by one
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      
      try {
        sendEvent('progress', { 
          currentFile: i + 1, 
          totalFiles: req.files.length, 
          fileName: file.originalname,
          status: 'processing'
        });

        // Extract data for this single file
        const fileResults = await geminiExtract([file]);
        
        // Normalize and add IDs to products
        const products = (fileResults.products || []).map(p => ({
          id: prodId++,
          name: p.name || p.productName || 'Item',
          description: p.description || null,
          quantity: typeof p.quantity === 'number' ? p.quantity : (p.qty || 0),
          unitPrice: p.unitPrice ?? p.price ?? null,
          tax: p.tax ?? null,
          priceWithTax: p.priceWithTax ?? p.unitPrice ?? p.price ?? null,
          ...p
        }));

        // Normalize and add IDs to customers
        const customers = (fileResults.customers || []).map(c => ({
          id: custId++,
          name: c.name || c.customerName || c.fullName || 'Customer',
          address: c.address || null,
          phone: c.phone || c.contact || c.mobile || null,
          totalPurchase: typeof c.totalPurchase === 'number' ? c.totalPurchase : (c.total || 0),
          ...c
        }));

        allProducts.push(...products);
        allCustomers.push(...customers);

        // Process invoices and link to products/customers
        const invoices = (fileResults.invoices || []).map(inv => {
          const customerName = typeof inv.customer === 'string' ? inv.customer 
            : typeof inv.customer === 'object' && inv.customer ? inv.customer.name : '';
          
          const customer = allCustomers.find(c => {
            const cName = (c.name || '').toLowerCase();
            return customerName.toLowerCase().includes(cName) || cName.includes(customerName.toLowerCase());
          });
          
          const items = (inv.items || []).map(item => {
            const itemName = typeof item.name === 'string' ? item.name : '';
            const product = allProducts.find(p => {
              const pName = (p.name || '').toLowerCase();
              return itemName.toLowerCase().includes(pName) || pName.includes(itemName.toLowerCase());
            });
            return { ...item, productId: product ? product.id : null };
          });

          const linked = {
            id: invId++,
            ...inv,
            customerId: customer ? customer.id : null,
            items
          };

          const totals = computeInvoiceTotals(linked);
          return { ...linked, ...totals };
        });

        allInvoices.push(...invoices);
        processedFiles.push({ file: file.originalname, status: 'success' });

        // Send incremental update with current file's data
        sendEvent('fileComplete', {
          fileName: file.originalname,
          invoices,
          products,
          customers,
          currentFile: i + 1,
          totalFiles: req.files.length
        });

      } catch (fileErr) {
        console.error(`Error processing ${file.originalname}:`, fileErr.message);
        processedFiles.push({ file: file.originalname, error: fileErr.message });
        
        sendEvent('fileError', {
          fileName: file.originalname,
          error: fileErr.message,
          currentFile: i + 1,
          totalFiles: req.files.length
        });
      }
    }

    // After all files processed, aggregate quantities and totals
    // Aggregate products
    try {
      const prodMap = new Map();
      allProducts.forEach(p => prodMap.set(p.id, { ...p, quantity: p.quantity || 0 }));

      allInvoices.forEach(inv => {
        (inv.items || []).forEach(item => {
          if (item.productId && prodMap.has(item.productId)) {
            const prod = prodMap.get(item.productId);
            const itemQty = Number(item.qty ?? item.quantity ?? 0) || 0;
            const itemUnit = item.unitPrice ?? item.price ?? null;

            prod.quantity = (prod.quantity || 0) + itemQty;
            if (!prod.unitPrice && itemUnit != null) prod.unitPrice = Number(itemUnit);

            let unitTaxAmount = null;
            let unitTaxPercent = null;
            if (item.tax != null) {
              if (typeof item.tax === 'number') {
                if (item.tax > 1 && prod.unitPrice != null) {
                  unitTaxAmount = Number(item.tax);
                  unitTaxPercent = (unitTaxAmount / prod.unitPrice) * 100;
                } else {
                  unitTaxPercent = Number(item.tax);
                  if (prod.unitPrice != null) unitTaxAmount = prod.unitPrice * (unitTaxPercent / 100);
                }
              } else if (typeof item.tax === 'string') {
                const pctMatch = item.tax.match(/([0-9]+(?:\.[0-9]+)?)\s*%/);
                if (pctMatch) {
                  unitTaxPercent = Number(pctMatch[1]);
                  if (prod.unitPrice != null) unitTaxAmount = prod.unitPrice * (unitTaxPercent / 100);
                } else {
                  const num = Number(item.tax.replace(/[^0-9\.\-]/g, ''));
                  if (!Number.isNaN(num)) unitTaxAmount = num;
                }
              }
            }

            if (unitTaxPercent != null) prod.tax = `${unitTaxPercent}%`;
            else if (unitTaxAmount != null) prod.tax = Number(unitTaxAmount.toFixed(2));

            if (prod.unitPrice != null) {
              const taxPerUnit = unitTaxAmount != null ? unitTaxAmount : 0;
              prod.priceWithTax = Number((prod.unitPrice + taxPerUnit).toFixed(2));
            }

            prodMap.set(prod.id, prod);
          }
        });
      });

      allProducts.length = 0;
      allProducts.push(...Array.from(prodMap.values()));
    } catch (aggErr) {
      console.warn('Product aggregation failed:', aggErr.message);
    }

    // Aggregate customers
    try {
      const custMap = new Map();
      allCustomers.forEach(c => custMap.set(c.id, { ...c, totalPurchase: Number(c.totalPurchase || 0) }));
      allInvoices.forEach(inv => {
        const cid = inv.customerId;
        const invTotal = Number(inv.total ?? inv.amount ?? 0) || 0;
        if (cid && custMap.has(cid)) {
          const cust = custMap.get(cid);
          cust.totalPurchase = (cust.totalPurchase || 0) + invTotal;
          custMap.set(cust.id, cust);
        }
      });
      allCustomers.length = 0;
      allCustomers.push(...Array.from(custMap.values()));
    } catch (custErr) {
      console.warn('Customer aggregation failed:', custErr.message);
    }

    // Build extraDetails
    let extraDetails = '';
    try {
      const lines = [];
      allInvoices.forEach(inv => {
        lines.push(`Invoice: ${inv.serial || inv.id || 'unknown'}`);
        const skip = new Set(['id','serial','date','customer','items','total','customerId']);
        Object.keys(inv || {}).forEach(k => {
          if (skip.has(k)) return;
          const v = inv[k];
          if (v == null) return;
          if (typeof v === 'object') {
            try { lines.push(`  ${k}: ${JSON.stringify(v)}`); }
            catch (e) { lines.push(`  ${k}: [complex]`); }
          } else {
            lines.push(`  ${k}: ${v}`);
          }
        });
      });
      extraDetails = lines.join('\n') || '';
    } catch (e) {
      extraDetails = '';
    }

    // Send final aggregated data
    sendEvent('complete', {
      invoices: allInvoices,
      products: allProducts,
      customers: allCustomers,
      files: processedFiles,
      extraDetails
    });

    res.end();
    console.log('✅ Streaming extraction complete\n');

  } catch (err) {
    console.error('❌ Streaming extraction error:', err);
    sendEvent('error', { error: err.message });
    res.end();
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log('Backend listening on', port));
