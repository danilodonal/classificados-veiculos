const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'data.db');

let db;

async function initDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS veiculos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      marca TEXT NOT NULL,
      modelo TEXT NOT NULL,
      ano_fabricacao INTEGER NOT NULL,
      ano_modelo INTEGER NOT NULL,
      quilometragem INTEGER NOT NULL DEFAULT 0,
      combustivel TEXT NOT NULL DEFAULT 'Gasolina',
      cambio TEXT NOT NULL DEFAULT 'Manual',
      cor TEXT NOT NULL DEFAULT 'Branco',
      portas INTEGER NOT NULL DEFAULT 4,
      preco REAL NOT NULL,
      descricao TEXT,
      destaque INTEGER NOT NULL DEFAULT 0,
      vendido INTEGER NOT NULL DEFAULT 0,
      imagem TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS vendedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      telefone TEXT,
      email TEXT,
      comissao_percentual REAL NOT NULL DEFAULT 5.0,
      ativo INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS vendas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      veiculo_id INTEGER NOT NULL,
      vendedor_id INTEGER,
      data_venda DATE NOT NULL,
      preco_venda REAL NOT NULL,
      comissao_percentual REAL NOT NULL DEFAULT 5.0,
      comissao_valor REAL NOT NULL DEFAULT 0,
      financiado INTEGER NOT NULL DEFAULT 0,
      tipo_pagamento TEXT NOT NULL DEFAULT 'avista',
      observacao TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (veiculo_id) REFERENCES veiculos(id),
      FOREIGN KEY (vendedor_id) REFERENCES vendedores(id)
    )
  `);

  try { db.run("ALTER TABLE vendas ADD COLUMN tipo_pagamento TEXT NOT NULL DEFAULT 'avista'"); } catch(e) {}

  db.run(`CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)`);

  const defaults = {
    whatsapp: '5511999999999',
    hora_seg_sex_abre: '8h',
    hora_seg_sex_fecha: '19h',
    hora_sab_abre: '8h',
    hora_sab_fecha: '13h',
    cor_primaria: '#0f3460',
    cor_secundaria: '#1a1a2e',
    cor_destaque: '#e94560',
    cor_fundo: '#f8f9fb'
  };

  for (const [chave, valor] of Object.entries(defaults)) {
    const exist = db.exec(`SELECT valor FROM config WHERE chave = '${chave}'`);
    if (!exist.length || !exist[0].values.length) {
      db.run('INSERT INTO config (chave, valor) VALUES (?, ?)', [chave, valor]);
    }
  }

  const s = db.exec('SELECT COUNT(*) as count FROM admin');
  if (s.length === 0 || s[0].values[0][0] === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.run('INSERT INTO admin (username, password) VALUES (?, ?)', ['admin', hash]);
    console.log('Admin padrão criado: admin / admin123');
  }

  saveDB();
  return db;
}

function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  const rows = query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDB();
  return { changes: db.getRowsModified() };
}

function parseImagens(veiculo) {
  if (!veiculo || !veiculo.imagem) return [];
  try {
    const parsed = JSON.parse(veiculo.imagem);
    return Array.isArray(parsed) ? parsed : [veiculo.imagem];
  } catch {
    return [veiculo.imagem];
  }
}

function primeiraImagem(veiculo) {
  const imgs = parseImagens(veiculo);
  return imgs.length > 0 ? imgs[0] : null;
}

function getConfig(chave, padrao = '') {
  const row = get('SELECT valor FROM config WHERE chave = ?', [chave]);
  return row ? row.valor : padrao;
}

module.exports = { initDB, query, get, run, saveDB, parseImagens, primeiraImagem, getConfig };
