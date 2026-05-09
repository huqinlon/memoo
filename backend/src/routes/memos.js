const express = require('express');
const { getDb } = require('../db/init');
const { optionalAuth } = require('../middleware/auth');
const { formatResponse } = require('../utils/helpers');
const router = express.Router();
const MAX_CONTENT_SIZE = 10 * 1024 * 1024;
function logPermission(db, opts) { try { db.prepare('INSERT INTO permission_logs (user_id, username, action, target_type, target_id, result, detail, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(opts.user_id || null, opts.username || '', opts.action, opts.target_type, String(opts.target_id || ''), opts.result, opts.detail || '', opts.ip || ''); } catch (err) { console.error('Permission log error:', err.message); }
function getClientIp(req) { return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || ''; }
router.get('/', optionalAuth, (req, res) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const offset = (page - 1) * limit;
    let whereClauses = [];
    const params = [];
    const user = req.user;
    if (!user) whereClauses.push("m.visibility = 'public'");
    else if (user.role !== 'admin') { whereClauses.push("(m.visibility = 'public' OR m.user_id = ?)"); params.push(user.id); }
    if (req.query.visibility) { whereClauses.push('m.visibility = ?'); params.push(req.query.visibility); }
    if (req.query.tag) { whereClauses.push('t.name = ?'); params.push(req.query.tag); }
    if (req.query.search) { whereClauses.push('(m.title LIKE ? OR m.content LIKE ?)'); params.push(`%${req.query.search}%`, `%${req.query.search}%`); }
    const whereClause = whereClauses.length > 0 ? ' WHERE ' + whereClauses.join(' AND ') : '';
    const sortMap = { updated: 'm.updated_at', created: 'm.created_at', title: 'm.title' };
    const sortField = sortMap[req.query.sort] || 'm.updated_at';
    const countSql = `SELECT COUNT(DISTINCT m.id) as total FROM memos m LEFT JOIN memo_tags mt ON m.id = mt.memo_id LEFT JOIN tags t ON mt.tag_id = t.id${whereClause}`;
    const total = db.prepare(countSql).get(...params).total;
    const sql = `SELECT m.*, u.username as author_name, GROUP_CONCAT(DISTINCT json_object('id', t.id, 'name', t.name, 'color', t.color)) as tags FROM memos m LEFT JOIN users u ON m.user_id = u.id LEFT JOIN memo_tags mt ON m.id = mt.memo_id LEFT JOIN tags t ON mt.tag_id = t.id${whereClause} GROUP BY m.id ORDER BY ${sortField} DESC LIMIT ? OFFSET ?`;
    const items = db.prepare(sql).all(...params, limit, offset);
    items.forEach(item => { if (item.tags) item.tags = JSON.parse(`[${item.tags}]`); else item.tags = []; });
    res.json(formatResponse({ items, total, page, limit, totalPages: Math.ceil(total / limit) }));
  } catch (err) { console.error(err); res.status(500).json(formatResponse(null, err.message, 1)); }
});
router.get('/:id', optionalAuth, (req, res) => {
  try {
    const db = getDb();
    const memo = db.prepare(`SELECT m.*, u.username as author_name, GROUP_CONCAT(DISTINCT json_object('id', t.id, 'name', t.name, 'color', t.color)) as tags FROM memos m LEFT JOIN users u ON m.user_id = u.id LEFT JOIN memo_tags mt ON m.id = mt.memo_id LEFT JOIN tags t ON mt.tag_id = t.id WHERE m.id = ? GROUP BY m.id`).get(req.params.id);
    if (!memo) return res.status(404).json(formatResponse(null, '备忘录不存在', 1));
    const user = req.user;
    if (memo.visibility === 'private') {
      if (!user) { logPermission(db, { user_id: null, username: 'anonymous', action: 'VIEW', target_type: 'memo', target_id: memo.id, result: 'DENIED', detail: '匿名用户无权查看私密备忘录', ip: getClientIp(req) }); return res.status(403).json(formatResponse(null, '无权查看此私密备忘录', 1)); }
      if (user.role !== 'admin' && memo.user_id !== user.id) { logPermission(db, { user_id: user.id, username: user.username, action: 'VIEW', target_type: 'memo', target_id: memo.id, result: 'DENIED', detail: '非作者无权查看他人私密备忘录', ip: getClientIp(req) }); return res.status(403).json(formatResponse(null, '无权查看此私密备忘录', 1)); }
    }
    db.prepare('UPDATE memos SET view_count = view_count + 1 WHERE id = ?').run(req.params.id);
    if (memo.tags) memo.tags = JSON.parse(`[${memo.tags}]`); else memo.tags = [];
    res.json(formatResponse(memo));
  } catch (err) { console.error(err); res.status(500).json(formatResponse(null, err.message, 1)); }
});
router.post('/', optionalAuth, (req, res) => {
  try {
    const db = getDb();
    const { title, content, content_type, visibility, tag_ids, cover_image } = req.body;
    if (!title || !title.trim()) return res.status(400).json(formatResponse(null, '标题不能为空', 1));
    if (title.length > 200) return res.status(400).json(formatResponse(null, '标题过长（最多200字符）', 1));
    if (content && content.length > MAX_CONTENT_SIZE) return res.status(400).json(formatResponse(null, '内容过大（最多10MB）', 1));
    const userId = req.user?.id || null;
    const authorName = req.user?.username || '';
    db.prepare('INSERT INTO memos (title, content, content_type, visibility, user_id, author_name, cover_image) VALUES (?, ?, ?, ?, ?, ?, ?)').run(title.trim(), content || '', content_type || 'markdown', visibility || 'public', userId, authorName, cover_image || null);
    const rowIdResult = db.get('SELECT last_insert_rowid() as id');
    const memoId = rowIdResult ? rowIdResult.id : null;
    if (tag_ids && Array.isArray(tag_ids)) { for (const tagId of tag_ids) { db.prepare('INSERT OR IGNORE INTO memo_tags (memo_id, tag_id) VALUES (?, ?)').run(memoId, tagId); db.prepare('UPDATE tags SET memo_count = memo_count + 1 WHERE id = ?').run(tagId); } }
    logPermission(db, { user_id: userId, username: authorName || 'anonymous', action: 'CREATE', target_type: 'memo', target_id: memoId, result: 'GRANTED', detail: `visibility=${visibility || 'public'}`, ip: getClientIp(req) });
    const memo = memoId ? db.prepare('SELECT * FROM memos WHERE id = ?').get(memoId) : null;
    res.status(201).json(formatResponse(memo, '创建成功'));
  } catch (err) { console.error(err); res.status(500).json(formatResponse(null, err.message, 1)); }
});
router.put('/:id', optionalAuth, (req, res) => {
  try {
    const db = getDb();
    const { title, content, content_type, visibility, tag_ids, cover_image, is_pinned } = req.body;
    const memo = db.prepare('SELECT * FROM memos WHERE id = ?').get(req.params.id);
    if (!memo) return res.status(404).json(formatResponse(null, '备忘录不存在', 1));
    const user = req.user;
    const ip = getClientIp(req);
    if (memo.visibility === 'private') {
      if (!user) { logPermission(db, { user_id: null, username: 'anonymous', action: 'EDIT', target_type: 'memo', target_id: memo.id, result: 'DENIED', detail: '匿名用户无权编辑私密备忘录', ip }); return res.status(403).json(formatResponse(null, '权限不足', 1)); }
      if (user.role !== 'admin' && memo.user_id !== user.id) { logPermission(db, { user_id: user.id, username: user.username, action: 'EDIT', target_type: 'memo', target_id: memo.id, result: 'DENIED', detail: '非作者无权编辑', ip }); return res.status(403).json(formatResponse(null, '权限不足', 1)); }
    }
    const updateFields = [];
    const updateValues = [];
    if (title !== undefined) { updateFields.push('title = ?'); updateValues.push(title); }
    if (content !== undefined) { updateFields.push('content = ?'); updateValues.push(content); }
    if (content_type !== undefined) { updateFields.push('content_type = ?'); updateValues.push(content_type); }
    if (visibility !== undefined) { updateFields.push('visibility = ?'); updateValues.push(visibility); }
    if (cover_image !== undefined) { updateFields.push('cover_image = ?'); updateValues.push(cover_image); }
    if (is_pinned !== undefined) { updateFields.push('is_pinned = ?'); updateValues.push(is_pinned); }
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(req.params.id);
    if (updateFields.length > 1) db.prepare(`UPDATE memos SET ${updateFields.join(', ')} WHERE id = ?`).run(...updateValues);
    if (Array.isArray(tag_ids)) { db.prepare('DELETE FROM memo_tags WHERE memo_id = ?').run(req.params.id); for (const tagId of tag_ids) db.prepare('INSERT OR IGNORE INTO memo_tags (memo_id, tag_id) VALUES (?, ?)').run(req.params.id, tagId); }
    const updatedMemo = db.prepare('SELECT * FROM memos WHERE id = ?').get(req.params.id);
    res.json(formatResponse(updatedMemo, '更新成功'));
  } catch (err) { console.error(err); res.status(500).json(formatResponse(null, err.message, 1)); }
});
router.delete('/:id', optionalAuth, (req, res) => {
  try {
    const db = getDb();
    const memo = db.prepare('SELECT * FROM memos WHERE id = ?').get(req.params.id);
    if (!memo) return res.status(404).json(formatResponse(null, '备忘录不存在', 1));
    const user = req.user;
    if (memo.visibility === 'private') {
      if (!user) return res.status(403).json(formatResponse(null, '无权删除', 1));
      if (user.role !== 'admin' && memo.user_id !== user.id) return res.status(403).json(formatResponse(null, '无权删除', 1));
    }
    db.prepare('DELETE FROM memo_tags WHERE memo_id = ?').run(req.params.id);
    db.prepare('DELETE FROM memos WHERE id = ?').run(req.params.id);
    res.json(formatResponse(null, '删除成功'));
  } catch (err) { console.error(err); res.status(500).json(formatResponse(null, err.message, 1)); }
});
module.exports = router;