const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { UPLOAD_DIR, getDb } = require('../db/init');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { formatResponse } = require('../utils/helpers');
const router = express.Router();
const ICON_DIR = path.join(UPLOAD_DIR, 'icons');
if (!fs.existsSync(ICON_DIR)) fs.mkdirSync(ICON_DIR, { recursive: true });
const storage = multer.diskStorage({ destination: (req, file, cb) => cb(null, ICON_DIR), filename: (req, file, cb) => { const ext = path.extname(file.originalname).toLowerCase(); const prefix = req.body.usage_type || 'favicon'; cb(null, `${prefix}_${uuidv4().slice(0, 8)}${ext}`); } });
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const allowedExts = ['.ico', '.png', '.svg', '.jpg', '.jpeg', '.gif', '.webp']; const ext = path.extname(file.originalname).toLowerCase(); if (allowedExts.includes(ext)) cb(null, true); else cb(new Error('仅支持图标文件格式')); } });
router.use(authMiddleware);
router.use(requireAdmin);
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const icons = db.prepare('SELECT si.*, u.username as creator_name FROM site_icons si LEFT JOIN users u ON si.created_by = u.id ORDER BY si.is_default DESC, si.sort_order ASC, si.created_at DESC').all();
    const currentDefault = icons.find(i => i.is_default === 1);
    res.json(formatResponse({ items: icons, default_icon_id: currentDefault ? currentDefault.id : null }));
  } catch (err) { res.status(500).json(formatResponse(null, '获取图标列表失败', 1)); }
});
router.post('/upload', (req, res) => {
  upload.single('icon')(req, res, (err) => {
    if (err) return res.status(400).json(formatResponse(null, err.message || '上传失败', 1));
    if (!req.file) return res.status(400).json(formatResponse(null, '请选择图标文件', 1));
    try {
      const db = getDb();
      const name = req.body.name || path.basename(req.file.originalname, path.extname(req.file.originalname));
      const usageType = req.body.usage_type || 'favicon';
      let width = 32, height = 32;
      if (req.file.mimetype === 'image/svg+xml') { const svg = fs.readFileSync(req.file.path, 'utf-8'); const vb = svg.match(/viewBox="[^"]*\s+([\d.]+)\s+([\d.]+)"/); if (vb) { width = parseFloat(vb[1]); height = parseFloat(vb[2]); } }
      const count = db.prepare('SELECT COUNT(*) as c FROM site_icons').get().c;
      const isDefault = count === 0 ? 1 : 0;
      const result = db.prepare('INSERT INTO site_icons (name, filename, original_name, file_type, file_size, width, height, usage_type, is_default, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(name, `icons/${req.file.filename}`, req.file.originalname, req.file.mimetype, req.file.size, width, height, usageType, isDefault, req.user?.id);
      const newIconId = result.lastInsertRowid;
      const newIcon = db.prepare('SELECT * FROM site_icons WHERE id = ?').get(newIconId);
      res.status(201).json(formatResponse(newIcon, '图标上传成功'));
    } catch (e) { res.status(500).json(formatResponse(null, '保存图标信息失败', 1)); }
  });
});
router.put('/:id/default', (req, res) => {
  try {
    const db = getDb();
    const iconId = parseInt(req.params.id);
    const icon = db.prepare('SELECT * FROM site_icons WHERE id = ?').get(iconId);
    if (!icon) return res.status(404).json(formatResponse(null, '图标不存在', 1));
    db.prepare('UPDATE site_icons SET is_default = 0').run();
    db.prepare('UPDATE site_icons SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(iconId);
    res.json(formatResponse({ id: iconId, is_default: 1 }, '已设为默认图标'));
  } catch (err) { res.status(500).json(formatResponse(null, '设置默认图标失败', 1)); }
});
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const iconId = parseInt(req.params.id);
    const { name, usage_type, sort_order } = req.body;
    db.prepare('UPDATE site_icons SET name = COALESCE(?, name), usage_type = COALESCE(?, usage_type), sort_order = COALESCE(?, sort_order), updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name, usage_type, sort_order ? parseInt(sort_order) : null, iconId);
    res.json(formatResponse({ id: iconId }, '图标信息已更新'));
  } catch (err) { res.status(500).json(formatResponse(null, '更新图标失败', 1)); }
});
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const iconId = parseInt(req.params.id);
    const icon = db.prepare('SELECT * FROM site_icons WHERE id = ?').get(iconId);
    if (!icon) return res.status(404).json(formatResponse(null, '图标不存在', 1));
    const filePath = path.join(UPLOAD_DIR, icon.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.prepare('DELETE FROM site_icons WHERE id = ?').run(iconId);
    if (!db.prepare('SELECT id FROM site_icons WHERE is_default = 1').get()) { const next = db.prepare('SELECT id FROM site_icons ORDER BY created_at ASC LIMIT 1').get(); if (next) db.prepare('UPDATE site_icons SET is_default = 1 WHERE id = ?').run(next.id); }
    res.json(formatResponse(null, '图标已删除'));
  } catch (err) { res.status(500).json(formatResponse(null, '删除图标失败', 1)); }
});
router.get('/current', (req, res) => {
  try {
    const db = getDb();
    const def = db.prepare('SELECT * FROM site_icons WHERE is_default = 1 LIMIT 1').get();
    if (!def) res.json(formatResponse({ url: '/favicon.svg', type: 'image/svg+xml' }, '使用系统默认图标'));
    else res.json(formatResponse({ id: def.id, name: def.name, url: `/uploads/${def.filename}`, type: def.file_type, usage_type: def.usage_type }));
  } catch (err) { res.status(500).json(formatResponse(null, '获取当前图标失败', 1)); }
});
module.exports = router;