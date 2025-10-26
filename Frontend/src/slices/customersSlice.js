import { createSlice } from '@reduxjs/toolkit';

const customersSlice = createSlice({
  name: 'customers',
  initialState: { list: [] },
  reducers: {
    setCustomers(state, action) { state.list = action.payload; },
    addCustomers(state, action) { state.list.push(...action.payload); },
    updateCustomer(state, action) {
      const idx = state.list.findIndex(c=>c.id===action.payload.id);
      if (idx>=0) state.list[idx] = { ...state.list[idx], ...action.payload.changes };
    }
  }
});

export const { setCustomers, addCustomers, updateCustomer } = customersSlice.actions;
export default customersSlice.reducer;
