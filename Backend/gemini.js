import { GoogleGenerativeAI } from '@google/generative-ai';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import ExcelJS from 'exceljs';

const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';
const DEFAULT_GEMINI_FALLBACK_MODEL = 'gemini-3.8-flash';
const MAX_TRANSIENT_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

function isTransientGeminiError(error) {
 const status = error?.status;
 return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function getRetryDelay(attempt) {
 const exponentialDelay = INITIAL_RETRY_DELAY_MS * (2 ** attempt);
 const jitter = Math.floor(Math.random() * 250);
 return exponentialDelay + jitter;
}

async function generateContentWithRetry(model, content, modelName) {
 for (let attempt = 0; attempt <= MAX_TRANSIENT_RETRIES; attempt++) {
   try {
     return await model.generateContent(content);
   } catch (error) {
     if (!isTransientGeminiError(error) || attempt === MAX_TRANSIENT_RETRIES) {
       throw error;
     }

     const delay = getRetryDelay(attempt);
     console.warn(
       `Gemini ${modelName} request failed with HTTP ${error.status}; ` +
       `retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_TRANSIENT_RETRIES})`
     );
     await new Promise(resolve => setTimeout(resolve, delay));
   }
 }
}

/**
* Extracts a JSON object from a string, even if it's wrapped in
* markdown backticks (```json ... ```) or has other text.
 */
function extractJson(text) {
  console.log('Attempting to parse JSON...');
  
  // Regex to find a JSON block, either in ```json ... ``` or as a plain object
  const jsonRegex = /```json\s*([\s\S]*?)\s*```|({[\s\S]*})/;
  const match = text.match(jsonRegex);

  if (!match) {
    console.error('❌ No JSON block found in the response.');
    throw new Error('No JSON block found in response');
  }
  
  // Use the first capture group that matched (either the one inside ```json or the object itself)
  const jsonString = match[1] || match[2];

  if (!jsonString) {
    console.error('❌ Regex matched but failed to capture JSON string.');
    throw new Error('Failed to capture JSON string');
  }

  try {
    const data = JSON.parse(jsonString);
    console.log('✅ Successfully parsed JSON.');
    return data;
  } catch (parseError) {
    console.error('❌ Failed to parse extracted JSON string:', parseError.message);
    console.log('Attempted to parse this string:', jsonString);
    throw parseError; // Re-throw the parsing error
  }
}


export async function geminiExtract(files) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  console.log('\n🚀 Starting extraction process...');
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  
const modelName = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
const fallbackModelName = process.env.GEMINI_FALLBACK_MODEL || DEFAULT_GEMINI_FALLBACK_MODEL;
const model = genAI.getGenerativeModel({ model: modelName });
const fallbackModel = fallbackModelName && fallbackModelName !== modelName
  ? genAI.getGenerativeModel({ model: fallbackModelName })
  : null;
console.log(`✅ Initialized Gemini API with ${modelName}`);

  const results = {
    invoices: [],   
    products: [],
    customers: [],
    files: [] // To track status of each file
  };

  // This prompt is sent with every file
  const prompt = `
    You are an invoice data extraction expert. Analyze the attached document (image, PDF, or spreadsheet)
    and extract all relevant information in JSON format.
    Return ONLY a JSON object with these arrays:
    - invoices: [{
        serial, date, customer,
        // Line items mapped from common table columns (Sl, Description, Rate/Item, Quantity, Taxable Value, GST, Amount)
        items:[{
          name,                       // Description
          qty,                        // Quantity (number)
          unitPrice,                  // Rate/Item (exclusive of tax)
          taxableValue: number|null,  // row's Taxable Value if present
          taxPercent: number|null,    // GST percent for the line (e.g., 18 for 18%)
          taxAmountPerUnit: number|null, // if GST amount provided for the row: GST amount / qty
          unitPriceWithTax: number|null   // unitPrice + taxAmountPerUnit if visible or derivable
        }],
        // Totals and taxes
        totals: {
          itemsCount: number|null,      // from "Total Items / Qty"
          totalQty: number|null,        // from "Total Items / Qty"
          taxableAmount: number|null,   // e.g., "Taxable Amount"
          amountPayable: number|null,   // e.g., "Amount Payable"
          totalDue: number|null,        // e.g., "Total Amount due" or final Total
          total: number|null            // fallback overall total if only one total present
        },
        taxes: {
          CGST: { percent: number|null, amount: number|null }|null,
          SGST: { percent: number|null, amount: number|null }|null,
          IGST: { percent: number|null, amount: number|null }|null
        },
        charges: [                     // Additional charges listed (e.g., Making charges, Shipping, Debit card charges)
          { label: string, amount: number }
        ]
      }]
    - products: [{ name, description: string|null, price: number|null, taxPercent: number|null }]
    - customers: [{ name, address: string|null, contact: string|null }]

    Mapping guidance:
    - If columns like Rate/Item, Quantity, Taxable Value, GST, Amount are present:
      unitPrice = Rate/Item (exclusive of tax)
      taxPercent = parse percent from GST column when shown (e.g., 18)
      If GST amount per line is shown, taxAmountPerUnit = (GST amount for the line) / Quantity
      If inclusive line Amount is shown and exclusive unitPrice is known, unitPriceWithTax = (Amount / Quantity)

    Rules:
    1. Analyze the visual layout to correctly associate items, prices, taxes, totals, charges.
    2. Dates must be YYYY-MM-DD.
    3. All currency numbers must be numeric (remove commas, symbols).
    4. Always include qty as a number; if unclear use 1.
    5. If a field is not found, use null.
    6. Do not include any text outside of the JSON.
  `;

  for (const file of files) {
    try {
      console.log(`\n📝 Processing ${file.originalname} (${file.mimetype})`);

      // We support images, PDFs and spreadsheet/CSV files
      const isImage = file.mimetype.startsWith('image/');
      const isPdf = file.mimetype === 'application/pdf';
      const isCsv = file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv');
      const isXlsx = file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        || file.mimetype === 'application/vnd.ms-excel'
        || file.originalname.toLowerCase().endsWith('.xlsx')
        || file.originalname.toLowerCase().endsWith('.xls');

      if (!isImage && !isPdf && !isCsv && !isXlsx) {
        console.log(`Skipping file ${file.originalname}, unsupported type (${file.mimetype}).`);
        results.files.push({
          file: file.originalname,
          error: 'Skipped: Unsupported file type'
        });
        continue; // Skip to the next file
      }

      // Prepare the model input depending on file type:
      // - Images/PDFs: send as inlineData (multimodal)
      // - CSV/XLSX: parse locally into text/JSON and send as text part
      let text;
      if (isCsv) {
        console.log('📄 Parsing CSV locally...');
        text = file.buffer.toString('utf8');
        console.log(`✅ CSV size ${text.length} characters`);

        console.log('Generating content from model (this may take a moment)...');
const responseObj = await generateWithFallback([
          prompt,
          { text }
        ]);
        text = await responseObj.response.text();

      } else if (isXlsx) {
        console.log('📊 Parsing Excel file locally using exceljs...');
        // Parse the workbook from the buffer using exceljs
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(file.buffer);
        const sheets = {};

        workbook.eachSheet((worksheet) => {
          const rows = [];
          worksheet.eachRow({ includeEmpty: true }, (row) => {
            // row.values is 1-based index array; slice off the first undefined element
            const vals = Array.isArray(row.values) ? row.values.slice(1) : [];
            rows.push(vals);
          });
          sheets[worksheet.name] = rows;
        });

        const excelText = JSON.stringify({ filename: file.originalname, sheets }, null, 2);
        console.log(`✅ Parsed Excel with sheets: ${Object.keys(sheets).join(', ')}`);

        console.log('Generating content from model (this may take a moment)...');
const responseObj = await generateWithFallback([
          prompt,
          { text: excelText }
        ]);
        text = await responseObj.response.text();

      } else {
        // image or pdf - use multimodal inlineData
        const filePart = {
          inlineData: {
            data: file.buffer.toString('base64'),
            mimeType: file.mimetype,
          },
        };

        console.log('Generating content from model (this may take a moment)...');
        const responseObj = await generateWithFallback([
          prompt,  // The text prompt
          filePart // The image or PDF file data
        ]);

        // 3. Get the text response
        text = await responseObj.response.text();
      }

      console.log('Raw response:', (text || '').substring(0, 200) + '...');

      try {
        // 4. Use the robust JSON parser
        const data = extractJson(text);

        // 5. Aggregate results
        if (Array.isArray(data.invoices)) results.invoices.push(...data.invoices);
        if (Array.isArray(data.products)) results.products.push(...data.products);
        if (Array.isArray(data.customers)) results.customers.push(...data.customers);

        results.files.push({
          file: file.originalname,
          status: 'success'
        });

      } catch (parseError) {
        console.error(`Failed to parse JSON for ${file.originalname}:`, parseError.message);
        results.files.push({
          file: file.originalname,
          error: 'Failed to parse structured data from model response',
          rawResponse: text // Save the raw text for debugging
        });
      }
    } catch (error) {
      // This catches errors from the Gemini API call itself
      console.error(`Gemini API error for ${file.originalname}:`, error);
      
      let errorMessage = error.message || 'Unknown error';
      
      // Check for common API errors
      if (error.message?.includes('quota')) {
        errorMessage = 'Gemini API quota exceeded. Please try again later or upgrade your API plan.';
      } else if (error.message?.includes('rate limit')) {
        errorMessage = 'Gemini API rate limit reached. Please wait a moment and try again.';
} else if (isTransientGeminiError(error)) {
errorMessage = 'Gemini service is temporarily unavailable. Please try again shortly.';
} else if (error.message?.includes('API key')) {
errorMessage = 'Invalid Gemini API key. Please check your configuration.';
      } else if (error.message?.includes('timeout')) {
        errorMessage = 'Request timed out. Please try with a smaller file.';
      }
      
      results.files.push({
        file: file.originalname,
        error: errorMessage,
        details: error.message
      });
    }
  }

  console.log('\n✅ Extraction process finished.');
  return results;

async function generateWithFallback(content) {
  try {
    return await generateContentWithRetry(model, content, modelName);
  } catch (error) {
    if (!fallbackModel || !isTransientGeminiError(error)) {
      throw error;
    }

    console.warn(
      `Gemini ${modelName} remained unavailable after retries; ` +
      `trying fallback model ${fallbackModelName}`
    );
    return generateContentWithRetry(fallbackModel, content, fallbackModelName);
  }
}
}
