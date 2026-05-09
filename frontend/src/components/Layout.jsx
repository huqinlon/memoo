import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Clock from './Clock';
import ScrollToTop from './ScrollToTop';
import { authAPI } from '../api';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    authAPI.getStatus().then((res) => {
      const hasUsers = res.data?.hasUsers ?? true;
      if (!hasUsers && location.pathname !== '/register') navigate('/register', { replace: true });
      setChecking(false);
    }).catch(() => setChecking(false));
  }, []);
  if (checking) return <div className="min-h-screen flex items-center justify-center"><div className="flex flex-col items-center gap-3"><div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" /><span className="text-sm text-gray-500">系统初始化中...</span></div></div>;
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1"><Outlet /></main>
        <footer className="border-t border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm py-4 mt-auto">
          <div className="px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500 dark:text-gray-400">
            <p>网络备忘录系统 &copy; {new Date().getFullYear()} <span className="mx-2">|</span> <Clock /></p>
          </div>
        </footer>
      </div>
      <ScrollToTop />
    </div>
  );
}