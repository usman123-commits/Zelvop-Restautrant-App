import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../services/api';

export const fetchOrders = createAsyncThunk(
  'orders/fetchOrders',
  async (_, { rejectWithValue }) => {
    try {
      const data = await api.getRiderOrders();
      return data.orders;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const fetchOrderDetail = createAsyncThunk(
  'orders/fetchDetail',
  async (id, { rejectWithValue }) => {
    try {
      const data = await api.getOrderDetail(id);
      return data.order;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const acceptOrderThunk = createAsyncThunk(
  'orders/accept',
  async (id, { rejectWithValue }) => {
    try {
      const data = await api.acceptOrder(id);
      return data.order;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const declineOrderThunk = createAsyncThunk(
  'orders/decline',
  async ({ id, reason }, { rejectWithValue }) => {
    try {
      const data = await api.declineOrder(id, reason);
      return data.order;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const pickupOrderThunk = createAsyncThunk(
  'orders/pickup',
  async (id, { rejectWithValue }) => {
    try {
      const data = await api.markPickup(id);
      return data.order;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const deliverOrderThunk = createAsyncThunk(
  'orders/deliver',
  async ({ id, ...deliveryData }, { rejectWithValue }) => {
    try {
      const data = await api.markDelivered(id, deliveryData);
      return data.order;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const ordersSlice = createSlice({
  name: 'orders',
  initialState: {
    items: [],
    currentOrder: null,
    loading: false,
    actionLoading: false,
    error: null,
    lastFetched: null,
  },
  reducers: {
    clearOrderError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch all
      .addCase(fetchOrders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
        state.lastFetched = Date.now();
      })
      .addCase(fetchOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch detail
      .addCase(fetchOrderDetail.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchOrderDetail.fulfilled, (state, action) => {
        state.loading = false;
        state.currentOrder = action.payload;
      })
      .addCase(fetchOrderDetail.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Accept
      .addCase(acceptOrderThunk.pending, (state) => {
        state.actionLoading = true;
      })
      .addCase(acceptOrderThunk.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.currentOrder = action.payload;
        const idx = state.items.findIndex((o) => o._id === action.payload._id);
        if (idx !== -1) state.items[idx] = action.payload;
      })
      .addCase(acceptOrderThunk.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload;
      })
      // Decline
      .addCase(declineOrderThunk.pending, (state) => {
        state.actionLoading = true;
      })
      .addCase(declineOrderThunk.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.items = state.items.filter((o) => o._id !== action.payload._id);
        state.currentOrder = null;
      })
      .addCase(declineOrderThunk.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload;
      })
      // Pickup
      .addCase(pickupOrderThunk.pending, (state) => {
        state.actionLoading = true;
      })
      .addCase(pickupOrderThunk.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.currentOrder = action.payload;
        const idx = state.items.findIndex((o) => o._id === action.payload._id);
        if (idx !== -1) state.items[idx] = action.payload;
      })
      .addCase(pickupOrderThunk.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload;
      })
      // Deliver
      .addCase(deliverOrderThunk.pending, (state) => {
        state.actionLoading = true;
      })
      .addCase(deliverOrderThunk.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.currentOrder = action.payload;
        const idx = state.items.findIndex((o) => o._id === action.payload._id);
        if (idx !== -1) state.items[idx] = action.payload;
      })
      .addCase(deliverOrderThunk.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearOrderError } = ordersSlice.actions;
export default ordersSlice.reducer;
