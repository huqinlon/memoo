const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/init');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { formatResponse } = require('../utils/helpers');
const router = express.Router();
router.use(authMiddleware);
function logOperation(db, userId, username, action, targetType, targetId, detail, ip) { try { db.prepare('INSERT INTO operation_logs (user_id, username, action, target_type, target_id, detail, ip) VALUES (?, ?, ?, ?, ?, ?, ?)').run(userId || null, username || '', action, targetType || '', targetId || '', detail || '', ip || ''); } catch (e) { console.error('Log error:', e.message); }
router.get('/stats', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const memosStats = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN visibility='public' THEN 1 ELSE 0 END) as public_count, SUM(CASE WHEN visibility='private' THEN 1 ELSE 0 END) as private_count FROM memos").get();
    const usersStats = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN role='admin' THEN 1 ELSE 0 END) as admin_count, SUM(CASE WHEN role='user' THEN 1 ELSE 0 END) as user_count FROM users").get();
    const tagsCount = db.prepare('SELECT COUNT(*) as total FROM tags').get();
    const tagDistribution = db.prepare('SELECT t.name, t.color, COUNT(mt.memo_id) as count FROM tags t LEFT JOIN memo_tags mt ON t.id = mt.tag_id GROUP BY t.id ORDER BY count DESC LIMIT 10').all();
    const recentMemos = db.prepare('SELECT m.id, m.title, m.visibility, u.username as author_name FROM memos m LEFT JOIN users u ON m.user_id = u.id ORDER BY m.created_at DESC LIMIT 8').all();
    const recentUsers = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC LIMIT 5').all();
    const viewsStats = db.prepare("SELECT SUM(view_count) as total_views, CAST(AVG(view_count) AS INTEGER) as avg_views FROM memos WHERE view_count > 0").get();
    res.json(formatResponse({ memos: memosStats, users: usersStats, tags: tagsCount, tag_distribution: tagDistribution, recent_memos: recentMemos, recent_users: recentUsers, views: { total_views: viewsStats.total_views || 0, avg_views: viewsStats.avg_views || 0 } }));
  } catch (err) { console.error(err); res.status(500).json(formatResponse(null, err.message, 1)); }
});
router.get('/private-memos', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const offset = (page - 1) * limit;
    const total = db.prepare("SELECT COUNT(*) as total FROM memos WHERE visibility='private'").get().total;
    const items = db.prepare(`SELECT m.*, u.username as author_name, GROUP_CONCAT(DISTINCT json_object('id', t.id, 'name', t.name, 'color', t.color)) as tags FROM memos m LEFT JOIN users u ON m.user_id = u.id LEFT JOIN memo_tags mt ON m.id = mt.memo_id LEFT JOIN tags t ON mt.tag_id = t.id WHERE m.visibility='private' GROUP BY m.id ORDER BY m.updated_at DESC LIMIT ? OFFSET ?`).all(limit, offset);
    items.forEach(item => { if (item.tags) item.tags = JSON.parse(`[${item.tags}]`); else item.tags = []; });
    res.json(formatResponse({ items, total, page, limit }));
  } catch (err) { console.error(err); res.status(500).json(formatResponse(null, err.message, 1)); }
});
router.get('/users', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const offset = (page - 1) * limit;
    const total = db.prepare('SELECT COUNT(*) as total FROM users').get().total;
    const items = db.prepare(`SELECT u.id, u.username, u.email, u.role, u.is_default_password, u.created_at, (SELECT COUNT(*) FROM memos WHERE user_id = u.id) as memo_count FROM users u ORDER BY u.created_at DESC LIMIT ? OFFSET ?`).all(limit, offset);
    res.json(formatResponse({ items, total, page, limit }));
  } catch (err) { console.error(err); res.status(500).json(formatResponse(null, err.message, 1)); }
});
router.post('/users', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { username, password, email, role } = req.body;
    if (!username || !password) return res.status(400).json(formatResponse(null, '用户名和密码不能为空', 1));
    if (username.length < 2 || username.length > 30) return res.status(400).json(formatResponse(null, '用户名长度需在2-30个字符之间', 1));
    if (password.length < 6) return res.status(400).json(formatResponse(null, '密码长度不能少于6位', 1));
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return res.status(409).json(formatResponse(null, '用户名已存在', 1));
    const hashedPassword = bcrypt.hashSync(password, 10);
    const userRole = role === 'admin' ? 'admin' : 'user';
    db.prepare('INSERT INTO users (username, password, email, role, is_default_password) VALUES (?, ?, ?, ?, 1)').run(username, hashedPassword, email || null, userRole);
    const rowId = db.get('SELECT last_insert_rowid() as id')?.id;
    const newUser = rowId ? db.prepare('SELECT id, username, email, role, is_default_password, created_at FROM users WHERE id = ?').get(rowId) : null;
    logOperation(db, req.user.id, req.user.username, 'CREATE_USER', 'user', String(rowId), `创建用户: ${username}`, req.ip);
    res.status(201).json(formatResponse(newUser, '用户创建成功'));
  } catch (err) { console.error(err); res.status(500).json(formatResponse(null, err.message, 1)); }
});
router.put('/users/:id/password', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { new_password } = req.body;
    if (!new_password) return res.status(400).json(formatResponse(null, '新密码不能为空', 1));
    if (new_password.length < 6) return res.status(400).json(formatResponse(null, '密码长度不能少于6位', 1));
    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(parseInt(req.params.id));
    if (!user) return res.status(404).json(formatResponse(null, '用户不存在', 1));
    const hashedPassword = bcrypt.hashSync(new_password, 10);
    db.prepare('UPDATE users SET password = ?, is_default_password = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hashedPassword, parseInt(req.params.id));
    logOperation(db, req.user.id, req.user.username, 'RESET_PASSWORD', 'user', String(req.params.id), `重置用户 ${user.username} 的密码`, req.ip);
    res.json(formatResponse(null, '密码修改成功'));
  } catch (err) { console.error(err); res.status(500).json(formatResponse(null, err.message, 1)); }
});
router.put('/users/:id/role', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { role } = req.body;
    if (!['admin', 'user'].includes(role)) return res.status(400).json(formatResponse(null, '无效的角色', 1));
    if (parseInt(req.params.id) === req.user.id) return res.status(400).json(formatResponse(null, '不能修改自己的角色', 1));
    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(parseInt(req.params.id));
    if (!user) return res.status(404).json(formatResponse(null, '用户不存在', 1));
    db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(role, parseInt(req.params.id));
    logOperation(db, req.user.id, req.user.username, 'CHANGE_ROLE', 'user', String(req.params.id), `修改用户 ${user.username} 角色为 ${role}`, req.ip);
    res.json(formatResponse(null, '角色修改成功'));
  } catch (err) { console.error(err); res.status(500).json(formatResponse(null, err.message, 1)); }
});
router.delete('/users/:id', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    if (parseInt(req.params.id) === req.user.id) return res.status(400).json(formatResponse(null, '不能删除自己', 1));
    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(req.params.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    logOperation(db, req.user.id, req.user.username, 'DELETE_USER', 'user', req.params.id, `删除用户: ${user?.username || req.params.id}`, req.ip);
    res.json(formatResponse(null, '用户已删除'));
  } catch (err) { console.error(err); res.status(500).json(formatResponse(null, err.message, 1)); }
});
router.get('/logs', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const total = db.prepare('SELECT COUNT(*) as total FROM operation_logs').get().total;
    const items = db.prepare('SELECT * FROM operation_logs ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
    res.json(formatResponse({ items, total, page, limit }));
  } catch (err) { console.error(err); res.status(500).json(formatResponse(null, err.message, 1)); }
});
router.get('/settings', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const settings = db.prepare('SELECT key, value FROM settings').all();
    const data = {};
    settings.forEach(s => { data[s.key] = s.value; });
    if (!data.site_name) data.site_name = '网络备忘录';
    if (!data.site_description) data.site_description = '';
    if (!data.allow_registration) data.allow_registration = 'true';
    res.json(formatResponse(data));
  } catch (err) { console.error(err); res.status(500).json(formatResponse(null, err.message, 1)); }
});
router.put('/settings', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    for (const [key, value] of Object.entries(req.body)) db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP').run(key, String(value));
    const settings = db.prepare('SELECT key, value FROM settings').all();
    const data = {};
    settings.forEach(s => { data[s.key] = s.value; });
    logOperation(db, req.user.id, req.user.username, 'UPDATE_SETTINGS', 'settings', '', '更新系统设置', req.ip);
    res.json(formatResponse(data, '设置已保存'));
  } catch (err) { console.error(err); res.status(500).json(formatResponse(null, err.message, 1)); }
});
module.exports = router;