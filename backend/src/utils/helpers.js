function formatResponse(data, message = 'success', code = 0) { return { code, message, data }; }
function validateRequired(obj, fields) {
  const missing = [];
  for (const field of fields) { if (!obj[field] && obj[field] !== 0) missing.push(field); }
  if (missing.length > 0) throw new Error(`缺少必要字段: ${missing.join(', ')}`);
}
module.exports = { formatResponse, validateRequired };