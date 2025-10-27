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
    <div className="space-y-4">
      <h2 className="text-xl sm:text-2xl font-bold text-blue-900">📄 Invoices</h2>
      <div className="overflow-x-auto rounded-xl border border-blue-200 shadow-sm -mx-3 sm:mx-0">
        <table className="w-full table-auto min-w-[640px]">
          <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <tr>
              <th className="p-2 sm:p-3 text-left font-semibold text-xs sm:text-sm">Serial</th>
              <th className="p-2 sm:p-3 text-left font-semibold text-xs sm:text-sm">Customer</th>
              <th className="p-2 sm:p-3 text-left font-semibold text-xs sm:text-sm">Products</th>
              <th className="p-2 sm:p-3 text-left font-semibold text-xs sm:text-sm">Total</th>
              <th className="p-2 sm:p-3 text-left font-semibold text-xs sm:text-sm">Date</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {invoices.map((inv, idx)=> (
              <tr key={inv.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-blue-50'} hover:bg-blue-100 transition-colors`}>
                <td className="p-2 sm:p-3 border-t border-blue-100 font-medium text-gray-900 text-xs sm:text-sm">{inv.serial||'-'}</td>
                <td className="p-2 sm:p-3 border-t border-blue-100 text-gray-700 text-xs sm:text-sm">{(customers.find(c=>c.id===inv.customerId)?.name) || inv.customer || '-'}</td>
                <td className="p-2 sm:p-3 border-t border-blue-100">
                  <div className="space-y-1">
                    {(inv.items||[]).map((it,i)=>(
                      <div key={i} className="text-xs sm:text-sm bg-white px-2 py-1 rounded border border-blue-200">
                        <span className="font-medium text-blue-900">{it.name}</span> 
                        <span className="text-gray-600"> x {it.qty||1}</span> 
                        <span className="text-blue-700"> @{it.unitPrice||'-'}</span>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="p-2 sm:p-3 border-t border-blue-100 font-semibold text-blue-700 text-xs sm:text-sm">₹{inv.total||'-'}</td>
                <td className="p-2 sm:p-3 border-t border-blue-100">
                  <input 
                    value={inv.date||''} 
                    onChange={(e)=>onChangeDate(inv.id, e.target.value)} 
                    className="border border-blue-300 px-2 sm:px-3 py-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full text-xs sm:text-sm"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
