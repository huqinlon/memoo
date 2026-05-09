import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  maxContentLength: 10 * 1024 * 1024,
  maxBodyLength: 10 * 1024 * 1024
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    if (response.config.responseType === 'blob') return response.data;
    return response.data;
  },
  (error) => {
    let message = '网络请求失败';
    if (error.code === 'ECONNABORTED') message = '请求超时，请检查网络连接后重试';
    else if (error.code === 'ERR_NETWORK') message = '网络连接失败，请检查网络设置';
    else if (error.response) {
      switch (error.response.status) {
        case 400: message = error.response.data?.message || '请求参数错误'; break;
        case 401:
          message = error.response.data?.message || '登录已过期';
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          if (window.location.pathname !== '/login') window.location.href = '/login';
          break;
        case 403: message = '没有权限执行此操作'; break;
        case 413: message = '上传文件大小超过限制'; break;
        default: message = error.response.data?.message || `请求失败 (${error.response.status})`;
      }
    }
    return Promise.reject(new Error(message));
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updatePassword: (data) => api.put('/auth/password', data),
  updateProfile: (data) => api.put('/auth/profile', data),
  getStatus: () => api.get('/auth/status')
};

export const memoAPI = {
  list: (params) => api.get('/memos', { params }),
  get: (id) => api.get(`/memos/${id}`),
  create: (data) => api.post('/memos', data),
  update: (id, data) => api.put(`/memos/${id}`, data),
  delete: (id) => api.delete(`/memos/${id}`)
};

export const tagAPI = {
  list: () => api.get('/tags'),
  create: (data) => api.post('/tags', data),
  update: (id, data) => api.put(`/tags/${id}`, data),
  delete: (id) => api.delete(`/tags/${id}`)
};

export const searchAPI = {
  search: (params) => api.get('/search', { params }),
  suggestions: (params) => api.get('/search/suggestions', { params })
};

export const adminAPI = {
  stats: () => api.get('/admin/stats'),
  privateMemos: (params) => api.get('/admin/private-memos', { params }),
  users: (params) => api.get('/admin/users', { params }),
  createUser: (data) => api.post('/admin/users', data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  resetPassword: (id, data) => api.put(`/admin/users/${id}/password`, data),
  changeRole: (id, data) => api.put(`/admin/users/${id}/role`, data),
  getSettings: () => api.get('/admin/settings'),
  updateSettings: (data) => api.put('/admin/settings', data),
  getLogs: (params) => api.get('/admin/logs', { params })
};

export const iconAPI = {
  list: () => api.get('/admin/icons'),
  upload: (formData, onProgress) => api.post('/admin/icons/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) onProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100));
    }
  }),
  setDefault: (id) => api.put(`/admin/icons/${id}/default`),
  update: (id, data) => api.put(`/admin/icons/${id}`, data),
  delete: (id) => api.delete(`/admin/icons/${id}`),
  getCurrent: () => api.get('/admin/icons/current')
};

export const uploadAPI = {
  uploadImage: (formData, onProgress) => api.post('/upload/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000, maxContentLength: 10 * 1024 * 1024,
    onUploadProgress: (progressEvent) => { if (onProgress && progressEvent.total) onProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100)); }
  }),
  listImages: () => api.get('/upload/images'),
  deleteImage: (filename) => api.delete(`/upload/image/${filename}`)
};

export const ioAPI = {
  exportMemos: (data) => api.post('/io/export', data, { responseType: 'blob', timeout: 120000 }),
  importMemos: (formData, onProgress) => api.post('/io/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000, maxContentLength: 100 * 1024 * 1024,
    onUploadProgress: (progressEvent) => { if (onProgress && progressEvent.total) onProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100)); }
  })
};

export default api;