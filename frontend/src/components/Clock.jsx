import React, { useState, useEffect } from 'react';
export default function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  return <span suppressHydrationWarning>{time.toLocaleTimeString('zh-CN')}</span>;
}