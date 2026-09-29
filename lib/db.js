/*
 * SQLite datubāze (sql.js — SQLite, kompilēts WebAssembly; nav vajadzīga kompilēšana Windows datorā).
 * Datubāze glabājas atmiņā un pēc katras izmaiņas tiek atomāri ierakstīta failā (data/kib1.sqlite).
 * Node.js ir vienpavediena, tāpēc visas operācijas notiek secīgi — konflikti starp audzēkņiem nav iespējami.
 */
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  current_module TEXT,
  progress_json TEXT NOT NULL DEFAULT '{}',
  drafts_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  student_id INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  answer_json TEXT NOT NULL,
  detail_json TEXT NOT NULL,
  score REAL NOT NULL,
  max_score REAL NOT NULL,
  teacher_score REAL,
  teacher_note TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(student_id, item_id)
);
CREATE TABLE IF NOT EXISTS roster (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_answers_student ON answers(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_student ON sessions(student_id);
`;

async function openDb(file) {
  const SQL = await initSqlJs();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = fs.existsSync(file) ? new SQL.Database(fs.readFileSync(file)) : new SQL.Database();
  db.run(SCHEMA);

  let timer = null;
  let dirty = false;

  function saveNow() {
    if (!dirty) return;
    const data = db.export();
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, Buffer.from(data));
    fs.renameSync(tmp, file);
    dirty = false;
  }

  function scheduleSave() {
    dirty = true;
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      try { saveNow(); } catch (e) { console.error('Neizdevās saglabāt datubāzi:', e.message); dirty = true; }
    }, 250);
  }

  function all(sql, params = []) {
    const st = db.prepare(sql);
    try {
      st.bind(params);
      const rows = [];
      while (st.step()) rows.push(st.getAsObject());
      return rows;
    } finally { st.free(); }
  }

  function get(sql, params = []) { return all(sql, params)[0] || null; }

  function run(sql, params = []) {
    db.run(sql, params);
    const changes = db.getRowsModified();
    const id = get('SELECT last_insert_rowid() AS id').id;
    scheduleSave();
    return { changes, lastId: id };
  }

  function transaction(fn) {
    db.run('BEGIN');
    try { const r = fn(); db.run('COMMIT'); scheduleSave(); return r; } catch (e) { db.run('ROLLBACK'); throw e; }
  }

  function flush() {
    if (timer) { clearTimeout(timer); timer = null; }
    saveNow();
  }

  dirty = true; saveNow();
  return { all, get, run, transaction, flush };
}

module.exports = { openDb };
