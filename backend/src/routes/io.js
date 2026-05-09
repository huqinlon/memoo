const express = require('express');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { getDb } = require('../db/init');
const { optionalAuth } = require('../middleware/auth');
const { formatResponse } = require('../utils/helpers');
const multer = require('multer');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
function getClientIp(req) { return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || ''; }
function logPermission(db, opts) { try { db.prepare('INSERT INTO permission_logs (user_id, username, action, target_type, target_id, result, detail, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(opts.user_id || null, opts.username || '', opts.action, opts.target_type || 'memo', String(opts.target_id || ''), opts.result, opts.detail || '', opts.ip || ''); } catch (e) {} }
function getMemosForExport(db, user, memoIds) {
  let sql, params;
  if (user && user.role === 'admin') {
    if (memoIds && memoIds.length > 0) { const ph = memoIds.map(() => '?').join(','); sql = `SELECT m.*, u.username as author_name FROM memos m LEFT JOIN users u ON m.user_id = u.id WHERE m.id IN (${ph}) ORDER BY m.updated_at DESC`; params = memoIds; }
    else { sql = 'SELECT m.*, u.username as author_name FROM memos m LEFT JOIN users u ON m.user_id = u.id ORDER BY m.updated_at DESC'; params = []; }
  } else if (user) {
    if (memoIds && memoIds.length > 0) { const ph = memoIds.map(() => '?').join(','); sql = `SELECT m.*, u.username as author_name FROM memos m LEFT JOIN users u ON m.user_id = u.id WHERE m.id IN (${ph}) AND (m.visibility = 'public' OR m.user_id = ?) ORDER BY m.updated_at DESC`; params = [...memoIds, user.id]; }
    else { sql = `SELECT m.*, u.username as author_name FROM memos m LEFT JOIN users u ON m.user_id = u.id WHERE m.visibility = 'public' OR m.user_id = ? ORDER BY m.updated_at DESC`; params = [user.id]; }
  } else {
    if (memoIds && memoIds.length > 0) { const ph = memoIds.map(() => '?').join(','); sql = `SELECT m.*, u.username as author_name FROM memos m LEFT JOIN users u ON m.user_id = u.id WHERE m.id IN (${ph}) AND m.visibility = 'public' ORDER BY m.updated_at DESC`; params = memoIds; }
    else { sql = `SELECT m.*, u.username as author_name FROM memos m LEFT JOIN users u ON m.user_id = u.id WHERE m.visibility = 'public' ORDER BY m.updated_at DESC`; params = []; }
  }
  const memos = db.prepare(sql).all(...params);
  memos.forEach(m => { const tags = db.prepare('SELECT t.id, t.name, t.color FROM tags t JOIN memo_tags mt ON t.id = mt.tag_id WHERE mt.memo_id = ?').all(m.id); m.tags = tags; });
  return memos;
}
router.post('/export', optionalAuth, (req, res) => {
  try {
    const db = getDb();
    const user = req.user;
    const { format, memo_ids } = req.body;
    if (!user) return res.status(403).json(formatResponse(null, '权限不足', 1));
    const memoIds = memo_ids && Array.isArray(memo_ids) && memo_ids.length > 0 ? memo_ids : null;
    const memos = getMemosForExport(db, user, memoIds);
    if (memos.length === 0) return res.status(404).json(formatResponse(null, '没有可导出的备忘录', 1));
    logPermission(db, { user_id: user.id, username: user.username, action: 'EXPORT', result: 'GRANTED', detail: `format=${format}, count=${memos.length}`, ip: getClientIp(req) });
    const ts = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    switch (format) {
      case 'json': return exportJSON(res, memos, ts);
      case 'markdown': return exportMarkdownZip(res, db, memos, ts);
      case 'zip': return exportFullZip(res, db, memos, ts);
      case 'html': return exportHTML(res, memos, ts);
      case 'csv': return exportCSV(res, memos, ts);
      case 'txt': return exportTXT(res, memos, ts);
      default: return res.status(400).json(formatResponse(null, '不支持的导出格式', 1));
    }
  } catch (err) { console.error(err); res.status(500).json(formatResponse(null, err.message, 1)); }
});
function exportJSON(res, memos, ts) {
  const data = { version: '4.0.0', exported_at: new Date().toISOString(), count: memos.length, memos: memos.map(m => ({ id: m.id, title: m.title, content: m.content, content_type: m.content_type, visibility: m.visibility, author_name: m.author_name, is_pinned: m.is_pinned, view_count: m.view_count, tags: m.tags, created_at: m.created_at, updated_at: m.updated_at })) };
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="memo-export-${ts}.json"`);
  res.send(JSON.stringify(data, null, 2));
}
function exportMarkdownZip(res, db, memos, ts) {
  const archive = archiver('zip', { zlib: { level: 9 } });
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="memo-export-md-${ts}.zip"`);
  archive.pipe(res);
  memos.forEach((m, i) => {
    const fn = `${String(i + 1).padStart(3, '0')}-${(m.title || 'untitled').replace(/[/\\?%*:|"<>]/g, '-').substring(0, 50)}.md`;
    let content = '';
    if (m.tags && m.tags.length > 0) content += `---\ntags: [${m.tags.map(t => `"${t.name}"`).join(', ')}\nvisibility: ${m.visibility}\n---\n\n`;
    content += `# ${m.title}\n\n${m.content || ''}\n\n---\n*创建于 ${m.created_at} · ${m.author_name || '匿名'}*`;
    archive.append(content, { name: fn });
  });
  archive.finalize();
}
function exportFullZip(res, db, memos, ts) {
  const archive = archiver('zip', { zlib: { level: 9 } });
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="memo-export-full-${ts}.zip"`);
  archive.pipe(res);
  const meta = { version: '4.0.0', exported_at: new Date().toISOString(), count: memos.length, tags: db.prepare('SELECT id, name, color FROM tags').all(), memos: memos.map((m, i) => ({ filename: `${String(i + 1).padStart(3, '0')}-${(m.title || 'untitled').replace(/[/\\?%*:|"<>]/g, '-').substring(0, 50)}.md`, id: m.id, title: m.title, visibility: m.visibility, author_name: m.author_name, tags: m.tags, created_at: m.created_at })) };
  archive.append(JSON.stringify(meta, null, 2), { name: 'metadata.json' });
  memos.forEach((m, i) => {
    const fn = `${String(i + 1).padStart(3, '0')}-${(m.title || 'untitled').replace(/[/\\?%*:|"<>]/g, '-').substring(0, 50)}.md`;
    const content = `---\ntags: [${(m.tags || []).map(t => `"${t.name}"`).join(', ')}\n---\n# ${m.title}\n\n${m.content || ''}`;
    archive.append(content, { name: `memos/${fn}` });
  });
  archive.finalize();
}
function exportHTML(res, memos, ts) {
  let html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>备忘录导出</title><style>body{font-family:-apple-system,sans-serif;max-width:800px;margin:0 auto;padding:20px;background:#f9fafb;color:#111827}article{background:#fff;border-radius:12px;padding:24px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,.1)}h1{font-size:1.5rem;margin:0 0 8px}.meta{font-size:.875rem;color:#6b7280;margin-bottom:16px}.tag{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:.75rem;margin-right:4px}pre{background:#0f172a;color:#e2e8f0;padding:16px;border-radius:8px;overflow-x:auto}</style></head><body><h1>备忘录导出 - ${new Date().toLocaleString('zh-CN')}</h1><hr>`;
  memos.forEach(m => {
    html += `<article><h1>${m.title}</h1><div class="meta">${m.author_name || '匿名'} · ${m.created_at}`;
    if (m.tags && m.tags.length > 0) html += ` · ${m.tags.map(t => `<span class="tag">${t.name}</span>`).join('')}`;
    html += `</div><pre>${m.content || '<p>暂无内容</p>'}</pre></article>`;
  });
  html += '</body></html>';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="memo-export-${ts}.html"`);
  res.send(html);
}
function exportCSV(res, memos, ts) {
  const BOM = '\uFEFF';
  let csv = BOM + 'ID,标题,内容类型,可见性,作者,标签,浏览次数,创建时间,修改时间\n';
  memos.forEach(m => {
    const tags = (m.tags || []).map(t => t.name).join(';');
    csv += `${m.id},"${(m.title || '').replace(/"/g, '""')}","${m.content_type}","${m.visibility}","${m.author_name || '匿名'}","${tags}",${m.view_count},"${m.created_at}","${m.updated_at}"\n`;
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="memo-export-${ts}.csv"`);
  res.send(csv);
}
function exportTXT(res, memos, ts) {
  let txt = `备忘录导出 - 共 ${memos.length} 篇\n${'='.repeat(40)}\n\n`;
  memos.forEach((m, i) => {
    txt += `【${i + 1}】${m.title}\n作者: ${m.author_name || '匿名'} | 浏览: ${m.view_count}\n创建: ${m.created_at} | 修改: ${m.updated_at}\n${'-'.repeat(30)}\n${(m.content || '').replace(/<[^>]*>/g, '')}\n\n`;
  });
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="memo-export-${ts}.txt"`);
  res.send(txt);
}
function escapeHtml(s) { if (!s) return ''; return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
router.post('/import', optionalAuth, upload.single('file'), (req, res) => {
  try {
    const db = getDb();
    const user = req.user;
    if (!req.file) return res.status(400).json(formatResponse(null, '请选择文件', 1));
    const userId = user?.id || null;
    const authorName = user?.username || '';
    const fname = req.file.originalname.toLowerCase();
    const buf = req.file.buffer;
    let imported = 0, errors = 0;
    try {
      if (fname.endsWith('.json')) { const data = JSON.parse(buf.toString('utf-8')); const memos = data.memos || (Array.isArray(data) ? data : []); memos.forEach(m => { try { db.prepare('INSERT INTO memos (title, content, content_type, visibility, user_id, author_name) VALUES (?, ?, ?, ?, ?, ?)').run((m.title || '未命名').substring(0, 200), m.content || '', m.content_type || 'markdown', m.visibility || 'public', userId, authorName); imported++; } catch (e) { errors++; } }); }
      else if (fname.endsWith('.md') || fname.endsWith('.markdown') || fname.endsWith('.txt')) {
        const text = buf.toString('utf-8');
        const title = fname.replace(/\.(md|markdown|txt)$/i, '').replace(/^[0-9]+[-_\s]*/, '').substring(0, 200) || '导入的备忘录';
        db.prepare('INSERT INTO memos (title, content, content_type, user_id, author_name) VALUES (?, ?, ?, ?, ?)').run(title, text, 'markdown', userId, authorName);
        imported++;
      }
      else { errors++; }
    } catch (e) { errors++; }
    res.json(formatResponse({ imported, errors, total: imported + errors }, `完成：成功 ${imported} 篇，失败 ${errors} 篇`));
  } catch (err) { console.error(err); res.status(500).json(formatResponse(null, err.message, 1)); }
});
module.exports = router;