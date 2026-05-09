const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'memo-system-secret-key';
const JWT_EXPIRES_IN = '7d';
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try { const decoded = jwt.verify(token, JWT_SECRET); req.user = decoded; } catch (err) {}
  }
  next();
}
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ code: 'UNAUTHORIZED', message: '请先登录', data: null });
  const token = authHeader.split(' ')[1];
  try { const decoded = jwt.verify(token, JWT_SECRET); req.user = decoded; next(); } catch (err) { return res.status(401).json({ code: 'UNAUTHORIZED', message: '登录已过期', data: null });
}
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ code: 'UNAUTHORIZED', message: '请先登录', data: null });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ code: 'FORBIDDEN', message: '需要管理员权限', data: null });
  next();
}
function generateToken(user) { return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN }); }
module.exports = { authMiddleware, optionalAuth, requireAuth, requireAdmin, generateToken };