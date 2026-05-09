import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useStore from './store';
import Layout from './components/Layout';

const Home = lazy(() => import('./pages/Home'));
const MemoList = lazy(() => import('./pages/MemoList'));
const MemoDetail = lazy(() => import('./pages/MemoDetail'));
const MemoEdit = lazy(() => import('./pages/MemoEdit'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const TagManage = lazy(() => import('./pages/TagManage'));
const DataIO = lazy(() => import('./pages/DataIO'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const MemoManage = lazy(() => import('./pages/admin/MemoManage'));
const UserManage = lazy(() => import('./pages/admin/UserManage'));
const Settings = lazy(() => import('./pages/admin/Settings'));
const OperationLogs = lazy(() => import('./pages/admin/OperationLogs'));
const IconManage = lazy(() => import('./pages/admin/IconManage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500 dark:text-gray-400">加载中...</span>
      </div>
    </div>
  );
}

export default function App() {
  const checkAuth = useStore((s) => s.checkAuth);
  useEffect(() => { checkAuth(); }, [checkAuth]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="memos" element={<MemoList />} />
          <Route path="tags" element={<TagManage />} />
          <Route path="data" element={<DataIO />} />
          <Route path="memos/:id" element={<MemoDetail />} />
          <Route path="memos/:id/edit" element={<MemoEdit />} />
          <Route path="new" element={<MemoEdit />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
        </Route>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="memos" element={<MemoManage />} />
          <Route path="users" element={<UserManage />} />
          <Route path="logs" element={<OperationLogs />} />
          <Route path="settings" element={<Settings />} />
          <Route path="icons" element={<IconManage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}