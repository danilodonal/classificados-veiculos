const { Pool, types } = require('pg');
const bcrypt = require('bcryptjs');

// NUMERIC OID = 1700 → converter para float para .toLocaleString() funcionar
types.setTypeParser(1700, val => parseFloat(val));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/classificados',
});

pool.on('error', err => console.error('Erro no pool PG:', err));

function query(sql, params = []) {
  return pool.query(sql, params).then(r => r.rows);
}

function get(sql, params = []) {
  return pool.query(sql, params).then(r => r.rows[0] || null);
}

function run(sql, params = []) {
  return pool.query(sql, params).then(r => ({ changes: r.rowCount }));
}

async function initDB() {
  const sql = `
    CREATE TABLE IF NOT EXISTS admin (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      nome TEXT NOT NULL DEFAULT ''
    );

    ALTER TABLE admin ADD COLUMN IF NOT EXISTS nome TEXT NOT NULL DEFAULT '';

    CREATE TABLE IF NOT EXISTS veiculos (
      id SERIAL PRIMARY KEY,
      marca TEXT NOT NULL,
      modelo TEXT NOT NULL,
      ano_fabricacao INTEGER NOT NULL,
      ano_modelo INTEGER NOT NULL,
      quilometragem INTEGER NOT NULL DEFAULT 0,
      combustivel TEXT NOT NULL DEFAULT 'Gasolina',
      cambio TEXT NOT NULL DEFAULT 'Manual',
      cor TEXT NOT NULL DEFAULT 'Branco',
      portas INTEGER NOT NULL DEFAULT 4,
      preco NUMERIC(12,2) NOT NULL,
      descricao TEXT,
      destaque BOOLEAN NOT NULL DEFAULT FALSE,
      vendido BOOLEAN NOT NULL DEFAULT FALSE,
      imagem TEXT,
      video_url TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS video_url TEXT;

    CREATE TABLE IF NOT EXISTS vendedores (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      telefone TEXT,
      email TEXT,
      comissao_percentual NUMERIC(5,2) NOT NULL DEFAULT 5.0,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS vendas (
      id SERIAL PRIMARY KEY,
      veiculo_id INTEGER NOT NULL REFERENCES veiculos(id),
      vendedor_id INTEGER REFERENCES vendedores(id),
      data_venda DATE NOT NULL,
      preco_venda NUMERIC(12,2) NOT NULL,
      comissao_percentual NUMERIC(5,2) NOT NULL DEFAULT 5.0,
      comissao_valor NUMERIC(12,2) NOT NULL DEFAULT 0,
      financiado BOOLEAN NOT NULL DEFAULT FALSE,
      tipo_pagamento TEXT NOT NULL DEFAULT 'avista',
      observacao TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS config (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );
  `;

  await pool.query(sql);

  const defaults = {
    whatsapp: '5511999999999',
    hora_seg_sex_abre: '8h',
    hora_seg_sex_fecha: '19h',
    hora_sab_abre: '8h',
    hora_sab_fecha: '13h',
    cor_primaria: '#0f3460',
    cor_secundaria: '#1a1a2e',
    cor_destaque: '#e94560',
    cor_fundo: '#f8f9fb',
    nome_site: 'AutoClassificados'
  };

  for (const [chave, valor] of Object.entries(defaults)) {
    await pool.query('INSERT INTO config (chave, valor) VALUES ($1, $2) ON CONFLICT (chave) DO NOTHING', [chave, valor]);
  }

  const adminCount = await pool.query('SELECT COUNT(*) as count FROM admin').then(r => r.rows[0].count);
  if (parseInt(adminCount) === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    await pool.query('INSERT INTO admin (username, password, nome) VALUES ($1, $2, $3)', ['admin', hash, 'Administrador']);
    console.log('Admin padrão criado: admin / admin123');
  }
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

async function getConfig(chave, padrao = '') {
  const row = await get('SELECT valor FROM config WHERE chave = $1', [chave]);
  return row ? row.valor : padrao;
}

module.exports = { initDB, query, get, run, parseImagens, primeiraImagem, getConfig };
