import { createSlice } from '@reduxjs/toolkit';

const productsSlice = createSlice({
  name: 'products',
  initialState: { list: [] },
  reducers: {
    setProducts(state, action) { state.list = action.payload; },
    addProducts(state, action) { state.list.push(...action.payload); },
    updateProduct(state, action) {
      const idx = state.list.findIndex(p=>p.id===action.payload.id);
      if (idx>=0) state.list[idx] = { ...state.list[idx], ...action.payload.changes };
    }
  }
});

export const { setProducts, addProducts, updateProduct } = productsSlice.actions;
export default productsSlice.reducer;
