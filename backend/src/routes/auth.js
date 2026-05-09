const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/init');
const { authMiddleware, requireAuth, generateToken } = require('../middleware/auth');
const { formatResponse } = require('../utils/helpers');
const router = express.Router();
function getSetting(db, key, defaultValue) { const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key); return row ? row.value : (defaultValue || ''); }
router.post('/register', (req, res) => {
  try {
    const db = getDb();
    const { username, password, email } = req.body;
    if (!username || !password) return res.status(400).json(formatResponse(null, '用户名和密码不能为空', 1));
    if (password.length < 6) return res.status(400).json(formatResponse(null, '密码长度不能少于6位', 1));
    if (username.length < 3) return res.status(400).json(formatResponse(null, '用户名长度不能少于3位', 1));
    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username)) return res.status(400).json(formatResponse(null, '用户名只能包含字母、数字、下划线和中文', 1));
    const allowRegistration = getSetting(db, 'allow_registration', 'true');
    const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
    const isFirstUser = existingUsers.count === 0;
    if (!isFirstUser && allowRegistration !== 'true') return res.status(403).json(formatResponse(null, '系统已关闭注册功能，请联系管理员', 1));
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return res.status(409).json(formatResponse(null, '用户名已存在', 1));
    const hashedPassword = bcrypt.hashSync(password, 10);
    const role = isFirstUser ? 'admin' : 'user';
    db.prepare('INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)').run(username, hashedPassword, email || null, role);
    const user = db.prepare('SELECT id, username, email, role FROM users WHERE username = ?').get(username);
    if (!user) return res.status(500).json(formatResponse(null, '创建用户失败', 1));
    const token = generateToken(user);
    if (isFirstUser) db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP').run('allow_registration', 'false');
    const message = isFirstUser ? `注册成功！您是系统首位用户，已被授予管理员权限` : '注册成功';
    res.json(formatResponse({ user, token, isFirstUser, role }, message));
  } catch (err) { console.error(err); res.status(500).json(formatResponse(null, err.message, 1)); }
});
router.get('/status', (req, res) => {
  try {
    const db = getDb();
    const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
    const allowRegistration = getSetting(db, 'allow_registration', 'true');
    res.json(formatResponse({ hasUsers: existingUsers.count > 0, allowRegistration: existingUsers.count === 0 || allowRegistration === 'true' }));
  } catch (err) { res.status(500).json(formatResponse(null, err.message, 1)); }
});
router.post('/login', (req, res) => {
  try {
    const db = getDb();
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json(formatResponse(null, '请输入用户名和密码', 1));
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json(formatResponse(null, '用户名或密码错误', 1));
    const token = generateToken(user);
    delete user.password;
    res.json(formatResponse({ user: { ...user, is_default_password: !!user.is_default_password }, token }, '登录成功'));
  } catch (err) { console.error(err); res.status(500).json(formatResponse(null, err.message, 1)); }
});
router.get('/me', authMiddleware, requireAuth, (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT id, username, email, role, avatar, is_default_password, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json(formatResponse(null, '用户不存在', 1));
    res.json(formatResponse(user));
  } catch (err) { console.error(err); res.status(500).json(formatResponse(null, err.message, 1)); }
});
router.put('/password', authMiddleware, requireAuth, (req, res) => {
  try {
    const db = getDb();
    const { old_password, new_password } = req.body;
    if (!old_password || !new_password) return res.status(400).json(formatResponse(null, '请输入旧密码和新密码', 1));
    if (new_password.length < 6) return res.status(400).json(formatResponse(null, '新密码长度不能少于6位', 1));
    const user = db.prepare('SELECT password, is_default_password FROM users WHERE id = ?').get(req.user.id);
    if (!user || !bcrypt.compareSync(old_password, user.password)) return res.status(401).json(formatResponse(null, '旧密码错误', 1));
    const hashedPassword = bcrypt.hashSync(new_password, 10);
    db.prepare('UPDATE users SET password = ?, is_default_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hashedPassword, req.user.id);
    res.json(formatResponse(null, '密码修改成功'));
  } catch (err) { console.error(err); res.status(500).json(formatResponse(null, err.message, 1)); }
});
router.put('/profile', authMiddleware, requireAuth, (req, res) => {
  try {
    const db = getDb();
    const { email, avatar } = req.body;
    db.prepare('UPDATE users SET email = COALESCE(?, email), avatar = COALESCE(?, avatar), updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(email, avatar, req.user.id);
    const user = db.prepare('SELECT id, username, email, role, avatar, created_at FROM users WHERE id = ?').get(req.user.id);
    res.json(formatResponse(user, '更新成功'));
  } catch (err) { console.error(err); res.status(500).json(formatResponse(null, err.message, 1)); }
});
module.exports = router;