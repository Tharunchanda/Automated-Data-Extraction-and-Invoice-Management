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
    <div>
      <h2 className="text-lg font-medium mb-3">Customers</h2>
      <table className="w-full table-auto border">
        <thead className="bg-gray-50"><tr><th className="p-2 border">Customer Name</th><th className="p-2 border">Phone</th><th className="p-2 border">Total Purchase</th></tr></thead>
        <tbody>
          {customers.map(c => (
            <tr key={c.id} className="odd:bg-white even:bg-gray-50">
              <td className="p-2 border"><input value={c.name||''} onChange={(e)=>onNameChange(c.id, e.target.value)} className="border px-2 py-1 rounded w-full"/></td>
              <td className="p-2 border">{c.phone||'-'}</td>
              <td className="p-2 border">{c.totalPurchase||0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
