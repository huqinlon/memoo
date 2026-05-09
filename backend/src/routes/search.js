const express = require('express');
const { getDb } = require('../db/init');
const { authMiddleware, requireAuth } = require('../middleware/auth');
const { formatResponse } = require('../utils/helpers');
const router = express.Router();
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const q = req.query.q || '';
    if (!q) return res.json(formatResponse({ items: [], total: 0 }));
    let whereClause = '';
    const params = [];
    if (req.query.tag) { whereClause += ' AND t.name = ?'; params.push(req.query.tag); }
    const searchPattern = `%${q}%`;
    params.push(searchPattern, searchPattern);
    const countSql = `SELECT COUNT(DISTINCT m.id) as total FROM memos m LEFT JOIN memo_tags mt ON m.id = mt.memo_id LEFT JOIN tags t ON mt.tag_id = t.id WHERE (m.title LIKE ? OR m.content LIKE ?)${whereClause}`;
    const total = db.prepare(countSql).get(...params).total;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const offset = (page - 1) * limit;
    const sql = `SELECT m.*, u.username as author_name, GROUP_CONCAT(DISTINCT json_object('id', t.id, 'name', t.name, 'color', t.color)) as tags FROM memos m LEFT JOIN users u ON m.user_id = u.id LEFT JOIN memo_tags mt ON m.id = mt.memo_id LEFT JOIN tags t ON mt.tag_id = t.id WHERE (m.title LIKE ? OR m.content LIKE ?)${whereClause} GROUP BY m.id ORDER BY m.updated_at DESC LIMIT ? OFFSET ?`;
    const items = db.prepare(sql).all(...params, limit, offset);
    items.forEach(item => { if (item.tags) item.tags = JSON.parse(`[${item.tags}]`); else item.tags = []; item.snippet = item.content?.substring(0, 200)?.replace(/<[^>]*>/g, '') || ''; });
    res.json(formatResponse({ items, total, page, limit, totalPages: Math.ceil(total / limit) }));
  } catch (err) { console.error(err); res.status(500).json(formatResponse(null, err.message, 1)); }
});
router.get('/suggestions', (req, res) => {
  try {
    const db = getDb();
    const q = req.query.q || '';
    if (q.length < 2) return res.json(formatResponse([]));
    const pattern = `%${q}%`;
    const suggestions = db.prepare('SELECT DISTINCT title FROM memos WHERE title LIKE ? ORDER BY updated_at DESC LIMIT 10').all(pattern);
    res.json(formatResponse(suggestions.map(s => s.title)));
  } catch (err) { console.error(err); res.status(500).json(formatResponse(null, err.message, 1)); }
});
router.get('/history', authMiddleware, requireAuth, (req, res) => {
  try {
    const db = getDb();
    const history = db.prepare('SELECT query FROM search_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 10').all(req.user.id);
    res.json(formatResponse(history));
  } catch (err) { console.error(err); res.status(500).json(formatResponse(null, err.message, 1)); }
});
module.exports = router;