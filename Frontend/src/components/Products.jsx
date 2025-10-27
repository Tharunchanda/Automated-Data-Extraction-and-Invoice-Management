import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { updateProduct } from '../slices/productsSlice';
import { updateProductNameInInvoices } from '../slices/invoicesSlice';

export default function Products() {
  const products = useSelector(s=>s.products.list);
  const dispatch = useDispatch();

  console.log('📦 Products component render:', products?.length || 0, 'products');

  const onNameChange = (id, name) => {
    dispatch(updateProduct({ id, changes: { name } }));
    dispatch(updateProductNameInInvoices({ productId: id, name }));
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-blue-900">📦 Products ({products.length})</h2>
      {products.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No products extracted yet. Upload an invoice to see products here.
        </div>
      ) : (
      <div className="overflow-auto rounded-xl border border-blue-200 shadow-sm">
        <table className="w-full table-auto">
          <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <tr>
              <th className="p-3 text-left font-semibold">Name</th>
              <th className="p-3 text-left font-semibold">Qty</th>
              <th className="p-3 text-left font-semibold">Unit Price</th>
              <th className="p-3 text-left font-semibold">Tax</th>
              <th className="p-3 text-left font-semibold">Price w/ Tax</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {products.map((p, idx) => (
              <tr key={p.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-blue-50'} hover:bg-blue-100 transition-colors`}>
                <td className="p-3 border-t border-blue-100">
                  <input 
                    value={p.name||''} 
                    onChange={(e)=>onNameChange(p.id, e.target.value)} 
                    className="border border-blue-300 px-3 py-1 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>
                <td className="p-3 border-t border-blue-100 font-medium text-blue-700">{p.quantity||0}</td>
                <td className="p-3 border-t border-blue-100 text-gray-700">₹{p.unitPrice||'-'}</td>
                <td className="p-3 border-t border-blue-100 text-gray-700">{p.tax||'-'}</td>
                <td className="p-3 border-t border-blue-100 font-semibold text-blue-700">₹{p.priceWithTax||'-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
