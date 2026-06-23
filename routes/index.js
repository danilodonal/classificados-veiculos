const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', async (req, res) => {
  const { busca, marca, preco_min, preco_max } = req.query;

  let sql = 'SELECT * FROM veiculos WHERE vendido = FALSE';
  const params = [];

  if (busca) {
    sql += ' AND (marca ILIKE $' + (params.length + 1) + ' OR modelo ILIKE $' + (params.length + 2) + ')';
    params.push(`%${busca}%`, `%${busca}%`);
  }
  if (marca) {
    sql += ' AND marca = $' + (params.length + 1);
    params.push(marca);
  }
  if (preco_min) {
    sql += ' AND preco >= $' + (params.length + 1);
    params.push(parseFloat(preco_min));
  }
  if (preco_max) {
    sql += ' AND preco <= $' + (params.length + 1);
    params.push(parseFloat(preco_max));
  }

  sql += ' ORDER BY destaque DESC, created_at DESC';

  const [veiculos, marcas] = await Promise.all([
    db.query(sql, params),
    db.query('SELECT DISTINCT marca FROM veiculos WHERE vendido = FALSE ORDER BY marca')
  ]);

  res.render('index', { ...req.app.locals, veiculos, marcas, filtros: req.query });
});

router.get('/veiculo/:id', async (req, res) => {
  const veiculo = await db.get('SELECT * FROM veiculos WHERE id = $1', [req.params.id]);
  if (!veiculo) return res.status(404).send('Veículo não encontrado');
  res.render('detalhe', { ...req.app.locals, veiculo });
});

router.get('/ofertas', async (req, res) => {
  const [veiculos, marcas] = await Promise.all([
    db.query('SELECT * FROM veiculos WHERE vendido = FALSE AND destaque = TRUE ORDER BY created_at DESC'),
    db.query('SELECT DISTINCT marca FROM veiculos WHERE vendido = FALSE ORDER BY marca')
  ]);
  res.render('ofertas', { ...req.app.locals, veiculos, marcas });
});

router.get('/vender', (req, res) => {
  res.render('vender', { ...req.app.locals, enviado: false, erro: null });
});

router.post('/vender', (req, res) => {
  const { nome, email, telefone, marca, modelo, ano, mensagem } = req.body;
  if (!nome || !telefone) {
    return res.render('vender', { ...req.app.locals, enviado: false, erro: 'Preencha nome e telefone.' });
  }

  const texto = [
    '*Proposta de venda - AutoClassificados*',
    '',
    '*Dados do vendedor*',
    `Nome: ${nome}`,
    `Telefone: ${telefone}`,
    email ? `E-mail: ${email}` : null,
    '',
    '*Dados do veículo*',
    marca ? `Marca: ${marca}` : null,
    modelo ? `Modelo: ${modelo}` : null,
    ano ? `Ano: ${ano}` : null,
    mensagem ? `Mensagem: ${mensagem}` : null,
  ].filter(Boolean).join('\n');

  const url = `https://wa.me/${req.app.locals.whatsapp}?text=${encodeURIComponent(texto)}`;
  res.redirect(url);
});

router.get('/financie', (req, res) => {
  res.render('financie', { ...req.app.locals });
});

router.get('/sobre', (req, res) => {
  res.render('sobre', { ...req.app.locals });
});

module.exports = router;
