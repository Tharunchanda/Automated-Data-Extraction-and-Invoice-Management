import { GoogleGenerativeAI } from '@google/generative-ai';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import ExcelJS from 'exceljs';

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
  
  // Use a modern, multimodal model that can "see" the document layout
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  console.log('✅ Initialized Gemini API with gemini-2.5 flash');

  const results = {
    invoices: [],
    products: [],
    customers: [],
    files: [] // To track status of each file
  };

  // Prompt updated to include total/generic GST under taxes
  const prompt = `
    You are an invoice data extraction expert. Analyze the attached document (image, PDF, or spreadsheet)
    and extract all relevant information in JSON format.
    Return ONLY a JSON object with these arrays:
    - invoices: [{
        serial, date, customer,
        // Line items mapped from common table columns (Sl, Description, Rate/Item, Quantity, Taxable Value, GST, Amount)
        items:[{
          name,                       // Description
          qty,                        // Quantity (number)
          unitPrice,                  // Rate/Item (exclusive of tax)
          taxableValue: number|null,   // row's Taxable Value if present
          taxPercent: number|null,     // GST percent for the line (e.g., 5, 12, or 18)
          taxAmountPerUnit: number|null, // if GST amount provided for the row: (GST amount for row) / qty
          unitPriceWithTax: number|null   // unitPrice + taxAmountPerUnit or (Amount / Quantity)
        }],
        // Totals and taxes
        totals: {
          itemsCount: number|null,      // Total number of item rows (e.g., 4 from "4/1,095.000")
          totalQty: number|null,        // Total item quantity (e.g., 1095 from "4/1,095.000")
          taxableAmount: number|null,   // Subtotal / Taxable Amount
          amountPayable: number|null,   // Amount Payable
          totalDue: number|null,        // Total Amount due
          total: number|null            // Final total amount
        },
        taxes: {
          CGST: { percent: number|null, amount: number|null }|null, // Total CGST amount (sum all CGST rows if multiple rates exist)
          SGST: { percent: number|null, amount: number|null }|null, // Total SGST amount (sum all SGST rows if multiple rates exist)
          IGST: { percent: number|null, amount: number|null }|null, // Total IGST amount
          GST: { percent: number|null, amount: number|null }|null   // Overall combined total GST amount/percent or fallback total tax
        },
        charges: [                     // Additional fees/charges listed (e.g., Making charges, Shipping, Debit card charges)
          { label: string, amount: number }
        ]
      }]
    - products: [{ name, description: string|null, price: number|null, taxPercent: number|null }]
    - customers: [{ name, address: string|null, contact: string|null }]

    Detailed Extraction Guidance:
    1. Line Items:
       - unitPrice = Rate/Item (exclusive of tax).
       - taxPercent = Parse numerical percentage from GST column when shown (e.g., "238.10 (5%)" -> 5).
       - taxAmountPerUnit = (Line GST amount) / Quantity.
       - unitPriceWithTax = (Inclusive Line Amount) / Quantity.

    2. Taxes Section:
       - Extract CGST, SGST, IGST, as well as total combined GST under `GST`.
       - Aggregate multiple tax rate entries into total amounts for CGST, SGST, IGST, and GST.
       - Example: If the document lists multiple lines like "CGST 2.5%: 940.48" and "CGST 6.0%: 1607.14", sum them (940.48 + 1607.14 = 2547.62) into `taxes.CGST.amount`.
       - Sum all taxes (CGST + SGST + IGST) into `taxes.GST.amount` if a overall GST amount is present or computable.
       - If a single tax rate applies to the entire document, populate `percent`. If multiple rates exist, set `percent` to null and populate the total aggregated `amount`.

    3. Additional Charges:
       - Extract extra charges listed (e.g., "Making charges", "debit card charges", "Shipping Charges") into the `charges` array as separate objects `{ label, amount }`.

    Rules:
    1. Analyze the visual layout to correctly associate items, prices, taxes, totals, and charges.
    2. Dates must strictly use YYYY-MM-DD format.
    3. All currency values must be raw numbers (remove ₹, $, commas, symbols).
    4. Always include qty as a number; if unclear use 1.
    5. If a field is not found or not applicable, use null.
    6. Do not include any text or commentary outside of the JSON.
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
        const responseObj = await model.generateContent([
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
        const responseObj = await model.generateContent([
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
        const responseObj = await model.generateContent([
          prompt,  // The text prompt
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
}
