import { API_URL } from '../constants/config';

let authToken = null;

export const setToken = (token) => {
  authToken = token;
};

export const clearToken = () => {
  authToken = null;
};

const request = async (endpoint, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error || 'Request failed');
    error.status = response.status;
    throw error;
  }

  return data;
};

// Auth
export const login = (email, password) =>
  request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const signup = (data) =>
  request('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getMe = () => request('/auth/me');

export const updateProfile = (data) =>
  request('/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const forgotPassword = (email) =>
  request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

// Rider Orders
export const getRiderOrders = () => request('/orders');

export const getOrderDetail = (id) => request(`/orders/${id}`);

export const acceptOrder = (id) =>
  request(`/orders/${id}/accept`, { method: 'PATCH' });

export const declineOrder = (id, reason) =>
  request(`/orders/${id}/decline`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });

export const markPickup = (id) =>
  request(`/orders/${id}/pickup`, { method: 'PATCH' });

export const markDelivered = (id, data) =>
  request(`/orders/${id}/deliver`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const cancelOrder = (id, reason) =>
  request(`/orders/${id}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });

// Rider Status
export const updateOnlineStatus = (isOnline) =>
  request('/riders/me/status', {
    method: 'PATCH',
    body: JSON.stringify({ isOnline }),
  });

export const getRiderStats = () => request('/riders/me/stats');

// Notifications
export const getNotifications = (limit = 50, offset = 0) =>
  request(`/notifications?limit=${limit}&offset=${offset}`);

export const markNotificationRead = (id) =>
  request(`/notifications/${id}/read`, { method: 'PATCH' });

export const markAllNotificationsRead = () =>
  request('/notifications/read-all', { method: 'PATCH' });

// Upload
export const uploadProofPhoto = async (imageUri) => {
  const formData = new FormData();
  const filename = imageUri.split('/').pop();
  const ext = filename.split('.').pop();
  formData.append('photo', {
    uri: imageUri,
    name: filename,
    type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
  });

  const headers = {};
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_URL}/upload/proof-photo`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Upload failed');
  }
  return data;
};
