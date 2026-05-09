const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { UPLOAD_DIR } = require('../db/init');
const { optionalAuth, authMiddleware, requireAuth } = require('../middleware/auth');
const { formatResponse } = require('../utils/helpers');
const router = express.Router();
const storage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, UPLOAD_DIR); },
  filename: (req, file, cb) => { const ext = path.extname(file.originalname); cb(null, uuidv4() + ext); }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'image/svg+xml';
  if (extname && mimetype) cb(null, true);
  else cb(new Error('只支持图片文件 (jpeg, jpg, png, gif, webp, svg)');
}});
router.post('/image', optionalAuth, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      let message = '上传失败';
      if (err.code === 'LIMIT_FILE_SIZE') message = '文件大小超过限制（最大5MB）';
      else if (err.message) message = err.message;
      console.error('上传错误:', err);
      return res.status(400).json(formatResponse(null, message, 1));
    }
    if (!req.file) return res.status(400).json(formatResponse(null, '请选择图片文件', 1));
    const url = `/uploads/${req.file.filename}`;
    res.json(formatResponse({ url, filename: req.file.originalname, size: req.file.size, type: req.file.mimetype }, '上传成功'));
  });
});
router.get('/images', authMiddleware, (req, res) => {
  const fs = require('fs');
  try {
    const files = fs.readdirSync(UPLOAD_DIR).filter(f => f.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i));
    const images = files.map(filename => ({ url: `/uploads/${filename}`, filename }));
    res.json(formatResponse(images, 'success'));
  } catch (err) { res.json(formatResponse([], 'success')); }
});
router.delete('/image/:filename', authMiddleware, requireAuth, (req, res) => {
  const fs = require('fs');
  const filename = req.params.filename;
  const filePath = path.join(UPLOAD_DIR, filename);
  if (!filename.match(/^[a-f0-9-]+\.(jpg|jpeg|png|gif|webp|svg)$/i)) return res.status(400).json(formatResponse(null, '无效的文件名', 1));
  fs.unlink(filePath, (err) => {
    if (err) { if (err.code === 'ENOENT') return res.status(404).json(formatResponse(null, '文件不存在', 1)); return res.status(500).json(formatResponse(null, '删除失败', 1)); }
    res.json(formatResponse(null, '删除成功'));
  });
});
module.exports = router;