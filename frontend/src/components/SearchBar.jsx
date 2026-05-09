import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchAPI } from '../api';
export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const navigate = useNavigate();
  const ref = useRef();
  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); return; }
    const timer = setTimeout(() => { searchAPI.suggestions({ q: query }).then(res => setSuggestions(res.data || [])).catch(() => setSuggestions([])); }, 200);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setShowSuggestions(false); };
    document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler);
  }, []);
  const handleSearch = (e) => { e.preventDefault(); if (query.trim()) { setShowSuggestions(false); navigate(`/memos?search=${encodeURIComponent(query.trim())}`); } };
  return (
    <form ref={ref} onSubmit={handleSearch} className="relative w-full max-w-md mx-auto">
      <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2 transition-all duration-200 focus-within:ring-2 focus-within:ring-primary-500/30 focus-within:bg-white dark:focus-within:bg-gray-800">
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input type="text" value={query} onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} placeholder="搜索备忘录..." className="w-full bg-transparent border-none outline-none text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400" />
        {query && <button type="button" onClick={() => { setQuery(''); setSuggestions([]); }} className="text-gray-400 hover:text-gray-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>}
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
          {suggestions.map((s, i) => (
            <button key={i} type="button" onClick={() => { setQuery(s); setShowSuggestions(false); navigate(`/memos?search=${encodeURIComponent(s)}`); }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">{s}</button>
          ))}
        </div>
      )}
    </form>
  );
}