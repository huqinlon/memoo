const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const DB_PATH = path.resolve('/app/data', 'memo.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const UPLOAD_DIR = path.resolve('/app/data', 'uploads');
let db = null, dbInstance = null;
function initDirectories() {
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
async function initDatabase() {
  initDirectories();
  const SQL = await initSqlJs();
  let dbData = null;
  try { if (fs.existsSync(DB_PATH)) dbData = fs.readFileSync(DB_PATH); } catch (e) {}
  dbInstance = new SQL.Database(dbData);
  db = createDbWrapper(dbInstance);
  console.log('Database initialized, creating tables...');
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  const statements = schema.split(';').filter(s => s.trim());
  for (const stmt of statements) { try { db.run(stmt); } catch (e) { console.error('Schema error:', e.message); } }
  console.log('Tables created, checking for existing users...');
  const userCount = db.get('SELECT COUNT(*) as count FROM users');
  if (!userCount || userCount.count === 0) console.log('No users found - system will redirect to registration on first access');
  else console.log('Found', userCount.count, 'existing users');
  saveDatabase();
  console.log('Database saved');
  return db;
}
function createDbWrapper(sqlDb) {
  const wrapper = {
    prepare: (sql) => ({
      run: (...args) => { const params = args.length > 0 ? (Array.isArray(args[0]) ? args[0] : args) : []; sqlDb.run(sql, params); const changes = sqlDb.getRowsModified(); return { lastInsertRowid: changes > 0 ? 1 : 0, changes }; },
      get: (...args) => { try { const params = args.length > 0 ? (Array.isArray(args[0]) ? args[0] : args) : []; const result = sqlDb.exec(sql, params); if (result.length === 0 || result[0].values.length === 0) return null; const columns = result[0].columns; const values = result[0].values[0]; const row = {}; columns.forEach((col, i) => { row[col] = values[i]; }); return row; } catch (e) { console.error('DB get error:', e); return null; } },
      all: (...args) => { try { const params = args.length > 0 ? (Array.isArray(args[0]) ? args[0] : args) : []; const result = sqlDb.exec(sql, params); if (result.length === 0) return []; const columns = result[0].columns; return result[0].values.map(values => { const row = {}; columns.forEach((col, i) => { row[col] = values[i]; }); return row; }); } catch (e) { return []; } }
    }),
    run: (sql, params) => { sqlDb.run(sql, params || []); },
    exec: (sql) => { sqlDb.run(sql); },
    pragma: () => {},
    close: () => { const data = sqlDb.export(); const buffer = Buffer.from(data); fs.writeFileSync(DB_PATH, buffer); sqlDb.close(); }
  };
  wrapper.get = (sql, params) => { try { const result = sqlDb.exec(sql, params || []); if (result.length === 0 || result[0].values.length === 0) return null; const columns = result[0].columns; const values = result[0].values[0]; const row = {}; columns.forEach((col, i) => { row[col] = values[i]; }); return row; } catch (e) { console.error('DB get error:', e); return null; } };
  wrapper.all = (sql, params) => { try { const result = sqlDb.exec(sql, params || []); if (result.length === 0) return []; const columns = result[0].columns; return result[0].values.map(values => { const row = {}; columns.forEach((col, i) => { row[col] = values[i]; }); return row; }); } catch (e) { return []; } };
  return wrapper;
}
function saveDatabase() { if (dbInstance) { try { const data = dbInstance.export(); const buffer = Buffer.from(data); fs.writeFileSync(DB_PATH, buffer); console.log('Database saved to', DB_PATH, 'size:', buffer.length); } catch (e) { console.error('Failed to save database:', e); } } }
process.on('SIGINT', () => { saveDatabase(); process.exit(); });
process.on('SIGTERM', () => { saveDatabase(); process.exit(); });
setInterval(saveDatabase, 30000);
function getDb() { if (!db) throw new Error('Database not initialized'); return db; }
module.exports = { getDb, initDatabase, UPLOAD_DIR };