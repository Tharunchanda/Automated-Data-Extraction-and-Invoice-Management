import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { updateProduct } from '../slices/productsSlice';
import { updateProductNameInInvoices } from '../slices/invoicesSlice';

export default function Products() {
  const products = useSelector(s=>s.products.list);
  const dispatch = useDispatch();

  const onNameChange = (id, name) => {
    dispatch(updateProduct({ id, changes: { name } }));
    dispatch(updateProductNameInInvoices({ productId: id, name }));
  };

  return (
    <div>
      <h2 className="text-lg font-medium mb-3">Products</h2>
      <table className="w-full table-auto border">
        <thead className="bg-gray-50"><tr><th className="p-2 border">Name</th><th className="p-2 border">Qty</th><th className="p-2 border">Unit Price</th><th className="p-2 border">Tax</th><th className="p-2 border">Price w/ Tax</th></tr></thead>
        <tbody>
          {products.map(p => (
            <tr key={p.id} className="odd:bg-white even:bg-gray-50">
              <td className="p-2 border"><input value={p.name||''} onChange={(e)=>onNameChange(p.id, e.target.value)} className="border px-2 py-1 rounded w-full"/></td>
              <td className="p-2 border">{p.quantity||0}</td>
              <td className="p-2 border">{p.unitPrice||'-'}</td>
              <td className="p-2 border">{p.tax||'-'}</td>
              <td className="p-2 border">{p.priceWithTax||'-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
