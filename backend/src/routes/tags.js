const express = require('express');
const { getDb } = require('../db/init');
const { authMiddleware, requireAuth } = require('../middleware/auth');
const { formatResponse } = require('../utils/helpers');
const router = express.Router();
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const tags = db.prepare('SELECT t.*, COUNT(mt.memo_id) as memo_count FROM tags t LEFT JOIN memo_tags mt ON t.id = mt.tag_id GROUP BY t.id ORDER BY memo_count DESC').all();
    res.json(formatResponse(tags));
  } catch (err) { console.error(err); res.status(500).json(formatResponse(null, err.message, 1)); }
});
router.post('/', authMiddleware, requireAuth, (req, res) => {
  try {
    const db = getDb();
    const { name, color } = req.body;
    if (!name || !name.trim()) return res.status(400).json(formatResponse(null, '标签名称不能为空', 1));
    const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(name.trim());
    if (existing) return res.status(409).json(formatResponse(null, '标签已存在', 1));
    db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run(name.trim(), color || '#2563eb');
    const tag = db.prepare('SELECT * FROM tags WHERE name = ?').get(name.trim());
    res.status(201).json(formatResponse(tag, '创建成功'));
  } catch (err) { console.error(err); res.status(500).json(formatResponse(null, err.message, 1)); }
});
router.put('/:id', authMiddleware, requireAuth, (req, res) => {
  try {
    const db = getDb();
    const { name, color } = req.body;
    if (name) {
      const existing = db.prepare('SELECT id FROM tags WHERE name = ? AND id != ?').get(name, req.params.id);
      if (existing) return res.status(409).json(formatResponse(null, '标签名称已存在', 1));
    }
    db.prepare('UPDATE tags SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ?').run(name?.trim(), color, req.params.id);
    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
    res.json(formatResponse(tag, '更新成功'));
  } catch (err) { console.error(err); res.status(500).json(formatResponse(null, err.message, 1)); }
});
router.delete('/:id', authMiddleware, requireAuth, (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM memo_tags WHERE tag_id = ?').run(req.params.id);
    db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
    res.json(formatResponse(null, '删除成功'));
  } catch (err) { console.error(err); res.status(500).json(formatResponse(null, err.message, 1)); }
});
module.exports = router;