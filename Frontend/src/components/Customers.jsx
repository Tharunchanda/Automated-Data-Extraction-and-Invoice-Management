import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { updateCustomer } from '../slices/customersSlice';
import { updateCustomerNameInInvoices } from '../slices/invoicesSlice';

export default function Customers() {
  const customers = useSelector(s=>s.customers.list);
  const dispatch = useDispatch();

  console.log('👥 Customers component render:', customers?.length || 0, 'customers');

  const onNameChange = (id, name) => {
    dispatch(updateCustomer({ id, changes: { name } }));
    dispatch(updateCustomerNameInInvoices({ customerId: id, name }));
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl sm:text-2xl font-bold text-blue-900">👥 Customers ({customers.length})</h2>
      {customers.length === 0 ? (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 sm:p-8 text-center">
          <p className="text-sm sm:text-base text-gray-500">
            No customers extracted yet. Upload an invoice to see customers here.
          </p>
        </div>
      ) : (
      <div className="overflow-x-auto rounded-xl border border-blue-200 shadow-sm -mx-3 sm:mx-0">
        <table className="w-full table-auto min-w-[500px]">
          <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <tr>
              <th className="p-2 sm:p-3 text-left font-semibold text-xs sm:text-sm">Customer Name</th>
              <th className="p-2 sm:p-3 text-left font-semibold text-xs sm:text-sm">Phone</th>
              <th className="p-2 sm:p-3 text-left font-semibold text-xs sm:text-sm">Total Purchase</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {customers.map((c, idx) => (
              <tr key={c.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-blue-50'} hover:bg-blue-100 transition-colors`}>
                <td className="p-2 sm:p-3 border-t border-blue-100">
                  <input 
                    value={c.name||''} 
                    onChange={(e)=>onNameChange(c.id, e.target.value)} 
                    className="border border-blue-300 px-2 sm:px-3 py-1 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
                  />
                </td>
                <td className="p-2 sm:p-3 border-t border-blue-100 text-gray-700 text-xs sm:text-sm">{c.phone||'-'}</td>
                <td className="p-2 sm:p-3 border-t border-blue-100 font-semibold text-blue-700 text-xs sm:text-sm">₹{c.totalPurchase||0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
