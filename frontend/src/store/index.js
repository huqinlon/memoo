import { create } from 'zustand';
import { authAPI, memoAPI } from '../api';

const useStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  setUser: (user) => set({ user }),
  setToken: (token) => { localStorage.setItem('token', token); set({ token }); },
  logout: () => { localStorage.removeItem('token'); localStorage.removeItem('user'); set({ user: null, token: null }); },
  login: async (credentials) => {
    const res = await authAPI.login(credentials);
    const data = res.data;
    get().setToken(data.token);
    get().setUser(data.user);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  },
  register: async (userData) => {
    const res = await authAPI.register(userData);
    const data = res.data;
    get().setToken(data.token);
    get().setUser(data.user);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  },
  checkAuth: () => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) { try { set({ token, user: JSON.parse(userData) }); } catch { get().logout(); } }
    else { get().logout(); }
  }
}));

export default useStore;