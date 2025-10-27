import React, { useState } from 'react';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import { addInvoices, setInvoices } from '../slices/invoicesSlice';
import { addProducts, setProducts } from '../slices/productsSlice';
import { addCustomers, setCustomers } from '../slices/customersSlice';
import Download from './Download';

export default function Upload() {
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState('');
  const [extras, setExtras] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fileProgress, setFileProgress] = useState([]);
  const dispatch = useDispatch();

  const onFiles = (e) => setFiles(Array.from(e.target.files));

  const upload = async () => {
    if (!files.length) {
      setStatus('⚠️ Select files first');
      return;
    }

    try {
      setIsLoading(true);
      setFileProgress([]);
      setExtras('');
      
      // Clear existing data
      dispatch(setInvoices([]));
      dispatch(setProducts([]));
      dispatch(setCustomers([]));

      setStatus('📁 Preparing files...');
      const fd = new FormData();
      files.forEach(f => fd.append('files', f));

      // Initialize progress for all files
      const initialProgress = files.map(f => ({ 
        name: f.name, 
        status: 'pending' 
      }));
      setFileProgress(initialProgress);

      setStatus('⬆️ Uploading to server...');
      const API_BASE = (import.meta?.env?.VITE_API_URL) || '/api';

      // Use fetch for SSE support
      const response = await fetch(`${API_BASE}/extract-stream`, {
        method: 'POST',
        body: fd
      });

      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
          if (errorData.hint) errorMsg += `\n${errorData.hint}`;
          console.error('Backend error details:', errorData);
        } catch (e) {
          // Response is not JSON
        }
        throw new Error(errorMsg);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          const eventMatch = line.match(/^event: (.+)\ndata: (.+)$/s);
          if (eventMatch) {
            const [, eventType, dataStr] = eventMatch;
            const data = JSON.parse(dataStr);

            switch (eventType) {
              case 'progress':
                setStatus(`🔄 Processing ${data.fileName} (${data.currentFile}/${data.totalFiles})...`);
                setFileProgress(prev => prev.map(f => 
                  f.name === data.fileName 
                    ? { ...f, status: 'processing' }
                    : f
                ));
                break;

              case 'fileComplete':
                setStatus(`✅ Completed ${data.fileName} (${data.currentFile}/${data.totalFiles})`);
                setFileProgress(prev => prev.map(f => 
                  f.name === data.fileName 
                    ? { ...f, status: 'complete', data }
                    : f
                ));
                
                // Add data incrementally
                if (data.invoices?.length) dispatch(addInvoices(data.invoices));
                if (data.products?.length) dispatch(addProducts(data.products));
                if (data.customers?.length) dispatch(addCustomers(data.customers));
                break;

              case 'fileError':
                setStatus(`❌ Error processing ${data.fileName}`);
                setFileProgress(prev => prev.map(f => 
                  f.name === data.fileName 
                    ? { ...f, status: 'error', error: data.error }
                    : f
                ));
                break;

              case 'complete':
                setStatus(`✅ All files processed successfully!`);
                
                // Update with final aggregated data
                if (data.invoices?.length) dispatch(setInvoices(data.invoices));
                if (data.products?.length) dispatch(setProducts(data.products));
                if (data.customers?.length) dispatch(setCustomers(data.customers));
                setExtras(data.extraDetails || '');
                break;

              case 'error':
                setStatus(`❌ Error: ${data.error}`);
                break;
            }
          }
        }
      }

    } catch (err) {
      console.error('Upload error:', err);
      const errorMsg = err?.message || 'Unknown error';
      setStatus(`❌ Error: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Section */}
  <div className="bg-gradient-to-r from-blue-50 to-white p-6 rounded-xl border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all">
        <label className="block text-base font-semibold text-blue-900 mb-3">
          📎 Upload Documents
        </label>
        <p className="text-sm text-gray-600 mb-4">
          Support for PDF, Images (PNG, JPG), and Excel files (.xlsx, .csv)
        </p>

        <input
          type="file"
          multiple
          onChange={onFiles}
          className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer cursor-pointer"
        />

        {files.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm font-medium text-blue-900 mb-2">Selected files:</p>
            <div className="space-y-1">
              {files.map((f, idx) => (
                <div key={idx} className="flex items-center text-sm text-gray-700">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                  {f.name}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center space-x-4">
          <button
            onClick={upload}
            disabled={files.length === 0 || isLoading} // 🟢 Added condition
            className={`relative flex items-center justify-center px-6 py-3 rounded-lg font-semibold text-white shadow-lg transition-all transform ${
              files.length === 0 || isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 hover:shadow-xl hover:scale-105'
            }`}
          >
            {isLoading && (
              // 🟢 White spinner loader
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                ></path>
              </svg>
            )}
            {isLoading ? 'Processing...' : '🚀 Upload & Extract'}
          </button>

          {status && (
            <div
              className={`flex items-center px-4 py-2 rounded-lg ${
                status.includes('✅')
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : status.includes('❌')
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : status.includes('⚠️')
                  ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}
            >
              <span className="text-sm font-medium">{status}</span>
            </div>
          )}
        </div>
      </div>

      {/* File Progress Section */}
      {fileProgress.length > 0 && (
        <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm">
          <label className="block text-base font-semibold text-blue-900 mb-4">
            📊 Processing Progress
          </label>
          <div className="space-y-3">
            {fileProgress.map((fileInfo, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center space-x-3">
                  {fileInfo.status === 'pending' && (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300 animate-pulse"></div>
                  )}
                  {fileInfo.status === 'processing' && (
                    <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                    </svg>
                  )}
                  {fileInfo.status === 'complete' && (
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {fileInfo.status === 'error' && (
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  <span className="text-sm font-medium text-gray-800">{fileInfo.name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  {fileInfo.status === 'complete' && fileInfo.data && (
                    <div className="flex items-center space-x-2 text-xs">
                      {fileInfo.data.invoices?.length > 0 && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          {fileInfo.data.invoices.length} invoice(s)
                        </span>
                      )}
                      {fileInfo.data.products?.length > 0 && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                          {fileInfo.data.products.length} product(s)
                        </span>
                      )}
                      {fileInfo.data.customers?.length > 0 && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                          {fileInfo.data.customers.length} customer(s)
                        </span>
                      )}
                    </div>
                  )}
                  {fileInfo.status === 'error' && (
                    <span className="text-xs text-red-600">{fileInfo.error}</span>
                  )}
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                    fileInfo.status === 'pending' ? 'bg-gray-200 text-gray-600' :
                    fileInfo.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                    fileInfo.status === 'complete' ? 'bg-green-100 text-green-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {fileInfo.status === 'pending' ? 'Pending' :
                     fileInfo.status === 'processing' ? 'Processing...' :
                     fileInfo.status === 'complete' ? 'Complete' :
                     'Error'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Download Section */}
      <Download />
    </div>
  );
}
