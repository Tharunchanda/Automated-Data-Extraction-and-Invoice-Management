import { createSlice } from '@reduxjs/toolkit';

const invoicesSlice = createSlice({
  name: 'invoices',
  initialState: { list: [] },
  reducers: {
    setInvoices(state, action) { state.list = action.payload; },
    addInvoices(state, action) { state.list.push(...action.payload); },
    updateInvoice(state, action) {
      const idx = state.list.findIndex(i=>i.id===action.payload.id);
      if (idx>=0) state.list[idx] = { ...state.list[idx], ...action.payload.changes };
    },
    updateProductNameInInvoices(state, action) {
      // action.payload = { productId, name }
      const { productId, name } = action.payload;
      state.list = state.list.map(inv => ({
        ...inv,
        items: (inv.items||[]).map(it => it.productId===productId ? ({...it, name}) : it)
      }));
    },
    updateCustomerNameInInvoices(state, action) {
      const { customerId, name } = action.payload;
      state.list = state.list.map(inv => inv.customerId===customerId ? ({...inv, customer: name}) : inv);
    }
  }
});

export const { setInvoices, addInvoices, updateInvoice, updateProductNameInInvoices, updateCustomerNameInInvoices } = invoicesSlice.actions;
export default invoicesSlice.reducer;
