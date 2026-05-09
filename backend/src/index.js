const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase, UPLOAD_DIR } = require('./db/init');
const { authMiddleware } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const memoRoutes = require('./routes/memos');
const tagRoutes = require('./routes/tags');
const searchRoutes = require('./routes/search');
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/upload');
const ioRoutes = require('./routes/io');
const iconRoutes = require('./routes/icons');
const app = express();
const PORT = process.env.PORT || 3001;
const corsOptions = {
  origin: (origin, callback) => { callback(null, true); },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));
initDatabase();
app.use('/api/auth', authRoutes);
app.use('/api/memos', memoRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/io', ioRoutes);
app.use('/api/admin/icons', iconRoutes);
app.get('/api/health', (req, res) => { res.json({ status: 'ok', timestamp: new Date().toISOString() }); });
const frontendDist = path.join(__dirname, '../../frontend/dist');
if (require('fs').existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(frontendDist, 'index.html'));
    }
  });
}
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  if (err.code === 'LIMIT_FILE_SIZE') res.status(400).json({ code: 1, message: '文件大小超过限制（最大5MB）' });
  else if (err.code === 'LIMIT_UNEXPECTED_FILE') res.status(400).json({ code: 1, message: '上传字段名称错误' });
  else res.status(500).json({ code: 1, message: err.message || '服务器内部错误' });
});
async function startServer() {
  await initDatabase();
  app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });
}
startServer().catch((err) => { console.error('Failed to start server:', err); process.exit(1); });
module.exports = app;