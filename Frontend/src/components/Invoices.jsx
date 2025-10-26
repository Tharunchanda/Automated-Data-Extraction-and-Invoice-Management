import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { updateInvoice } from '../slices/invoicesSlice';

export default function Invoices() {
  const invoices = useSelector(s=>s.invoices.list);
  const products = useSelector(s=>s.products.list);
  const customers = useSelector(s=>s.customers.list);
  const dispatch = useDispatch();

  const onChangeDate = (id, val) => dispatch(updateInvoice({ id, changes: { date: val } }));

  return (
    <div>
      <h2 className="text-lg font-medium mb-3">Invoices</h2>
      <div className="overflow-auto">
        <table className="w-full table-auto border">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 border">Serial</th>
              <th className="p-2 border">Customer</th>
              <th className="p-2 border">Products</th>
              <th className="p-2 border">Total</th>
              <th className="p-2 border">Date</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv=> (
              <tr key={inv.id} className="odd:bg-white even:bg-gray-50">
                <td className="p-2 border">{inv.serial||'-'}</td>
                <td className="p-2 border">{(customers.find(c=>c.id===inv.customerId)?.name) || inv.customer || '-'}</td>
                <td className="p-2 border">
                  {(inv.items||[]).map((it,i)=>(<div key={i} className="text-sm">{it.name} x {it.qty||1} @{it.unitPrice||'-'}</div>))}
                </td>
                <td className="p-2 border">{inv.total||'-'}</td>
                <td className="p-2 border"><input value={inv.date||''} onChange={(e)=>onChangeDate(inv.id, e.target.value)} className="border px-2 py-1 rounded"/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
