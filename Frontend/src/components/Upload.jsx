import React, { useState } from 'react';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import { addInvoices, setInvoices } from '../slices/invoicesSlice';
import { addProducts, setProducts } from '../slices/productsSlice';
import { addCustomers, setCustomers } from '../slices/customersSlice';

export default function Upload() {
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState('');
  const [raws, setRaws] = useState([]);
  const dispatch = useDispatch();

  const onFiles = (e) => setFiles(Array.from(e.target.files));

  const upload = async () => {
    if (!files.length) return setStatus('Select files first');
    const fd = new FormData();
    files.forEach(f=>fd.append('files', f));
    setStatus('Uploading...');
    try {
      // Use Vite env var VITE_API_URL when provided, otherwise fallback to relative /api
      // This allows deploying the frontend to Vercel while pointing to a remote backend.
      const API_BASE = (import.meta && import.meta.env && import.meta.env.VITE_API_URL) || '/api';
      const res = await axios.post(`${API_BASE}/extract`, fd, { headers: {'Content-Type':'multipart/form-data'} });
      const data = res.data;
      console.log('Extraction response:', data);

      // show server errors if any
      if (data.errors && data.errors.length) {
        setStatus('Extraction finished with errors. See console for details.');
        console.warn('Extraction errors:', data.errors);
      } else {
        setStatus('Extraction complete — results received');
      }

      // save raw texts for display when helpful
      if (Array.isArray(data.files) && data.files.length>0) setRaws(data.files);

      // Prefer set actions to replace/initialize lists so UI shows results immediately
      if (Array.isArray(data.invoices) && data.invoices.length>0) dispatch(setInvoices(data.invoices));
      if (Array.isArray(data.products) && data.products.length>0) dispatch(setProducts(data.products));
      if (Array.isArray(data.customers) && data.customers.length>0) dispatch(setCustomers(data.customers));

      // If all arrays are empty, give clearer feedback
      if ((!(data.invoices && data.invoices.length)) && (!(data.products && data.products.length)) && (!(data.customers && data.customers.length))) {
        setStatus('No structured data could be extracted from these files. See extracted text below and try manual correction or upload a different file.');
      }
    } catch (err) {
      console.error(err);
      setStatus('Error: ' + (err?.response?.data?.error || err.message));
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700">Upload files (pdf, images, excel)</label>
      <input type="file" multiple onChange={onFiles} className="mt-2" />
      <div className="mt-3">
        <button onClick={upload} className="px-4 py-2 bg-blue-600 text-white rounded">Upload & Extract</button>
        <span className="ml-3 text-sm text-gray-600">{status}</span>
      </div>
      {files.length>0 && (
        <div className="mt-2 text-sm text-gray-500">{files.map(f=>f.name).join(', ')}</div>
      )}
      {raws.length>0 && (
        <div className="mt-4 bg-gray-50 p-3 rounded border">
          <h3 className="font-medium">Extracted text (preview)</h3>
          {raws.map(r=> (
            <div key={r.file} className="mt-2">
              <div className="text-sm font-semibold">{r.file}</div>
              <pre className="text-xs whitespace-pre-wrap max-h-40 overflow-auto bg-white p-2 border rounded">{r.rawText || '(no text extracted)'}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
