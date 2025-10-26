import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { updateCustomer } from '../slices/customersSlice';
import { updateCustomerNameInInvoices } from '../slices/invoicesSlice';

export default function Customers() {
  const customers = useSelector(s=>s.customers.list);
  const dispatch = useDispatch();

  const onNameChange = (id, name) => {
    dispatch(updateCustomer({ id, changes: { name } }));
    dispatch(updateCustomerNameInInvoices({ customerId: id, name }));
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-blue-900">👥 Customers</h2>
      <div className="overflow-auto rounded-xl border border-blue-200 shadow-sm">
        <table className="w-full table-auto">
          <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <tr>
              <th className="p-3 text-left font-semibold">Customer Name</th>
              <th className="p-3 text-left font-semibold">Phone</th>
              <th className="p-3 text-left font-semibold">Total Purchase</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {customers.map((c, idx) => (
              <tr key={c.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-blue-50'} hover:bg-blue-100 transition-colors`}>
                <td className="p-3 border-t border-blue-100">
                  <input 
                    value={c.name||''} 
                    onChange={(e)=>onNameChange(c.id, e.target.value)} 
                    className="border border-blue-300 px-3 py-1 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>
                <td className="p-3 border-t border-blue-100 text-gray-700">{c.phone||'-'}</td>
                <td className="p-3 border-t border-blue-100 font-semibold text-blue-700">₹{c.totalPurchase||0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
