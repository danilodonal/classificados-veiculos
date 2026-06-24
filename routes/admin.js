const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const db = require('../database');
const auth = require('../middleware/auth');

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ----- LOGIN -----
router.get('/login', (req, res) => {
  if (req.session.admin) return res.redirect('/admin');
  res.render('admin/login', { erro: null });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const admin = await db.get('SELECT * FROM admin WHERE username = $1', [username]);
  if (admin && bcrypt.compareSync(password, admin.password)) {
    req.session.admin = { id: admin.id, username: admin.username, nome: admin.nome };
    return res.redirect('/admin');
  }
  res.render('admin/login', { erro: 'Usuário ou senha inválidos' });
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// ----- USUÁRIOS (ADMIN) -----
router.get('/usuarios', auth, async (req, res) => {
  const usuarios = await db.query('SELECT id, username, nome FROM admin ORDER BY id');
  const erro = req.query.erro || null;
  res.render('admin/usuarios', { usuarios, admin: req.session.admin, erro });
});

router.get('/usuarios/novo', auth, (req, res) => {
  res.render('admin/usuario-form', { usuario: null, erro: null });
});

router.post('/usuarios/novo', auth, async (req, res) => {
  const { username, password, nome } = req.body;
  if (!username || !password) return res.render('admin/usuario-form', { usuario: null, erro: 'Username e senha são obrigatórios.' });
  const existente = await db.get('SELECT id FROM admin WHERE username = $1', [username]);
  if (existente) return res.render('admin/usuario-form', { usuario: null, erro: 'Username já existe.' });
  const hash = bcrypt.hashSync(password, 10);
  await db.run('INSERT INTO admin (username, password, nome) VALUES ($1, $2, $3)', [username, hash, nome || username]);
  res.redirect('/admin/usuarios');
});

router.get('/usuarios/editar/:id', auth, async (req, res) => {
  const usuario = await db.get('SELECT id, username, nome FROM admin WHERE id = $1', [req.params.id]);
  if (!usuario) return res.status(404).send('Usuário não encontrado');
  res.render('admin/usuario-form', { usuario, erro: null });
});

router.post('/usuarios/editar/:id', auth, async (req, res) => {
  const { username, password, nome } = req.body;
  const usuario = await db.get('SELECT id FROM admin WHERE id = $1', [req.params.id]);
  if (!usuario) return res.status(404).send('Usuário não encontrado');
  const existente = await db.get('SELECT id FROM admin WHERE username = $1 AND id != $2', [username, req.params.id]);
  if (existente) return res.render('admin/usuario-form', { usuario: { id: req.params.id, username: usuario.username, nome: usuario.nome }, erro: 'Username já está em uso.' });
  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    await db.run('UPDATE admin SET username=$1, password=$2, nome=$3 WHERE id=$4', [username, hash, nome || '', req.params.id]);
  } else {
    await db.run('UPDATE admin SET username=$1, nome=$2 WHERE id=$3', [username, nome || '', req.params.id]);
  }
  res.redirect('/admin/usuarios');
});

router.get('/usuarios/excluir/:id', auth, async (req, res) => {
  if (parseInt(req.params.id) === req.session.admin.id) {
    return res.redirect('/admin/usuarios?erro=Você não pode excluir seu próprio usuário.');
  }
  await db.run('DELETE FROM admin WHERE id = $1', [req.params.id]);
  res.redirect('/admin/usuarios');
});

// ----- DASHBOARD -----
router.get('/', auth, async (req, res) => {
  const [veiculos, totalVendas, vendasMes, vendasSemana, totalVendedores] = await Promise.all([
    db.query('SELECT * FROM veiculos ORDER BY created_at DESC'),
    db.get("SELECT COUNT(*)::int as total, COALESCE(SUM(preco_venda),0)::numeric(12,2) as soma FROM vendas").then(r => r || { total: 0, soma: 0 }),
    db.get("SELECT COUNT(*)::int as total, COALESCE(SUM(preco_venda),0)::numeric(12,2) as soma FROM vendas WHERE to_char(data_venda, 'YYYY-MM') = to_char(CURRENT_DATE, 'YYYY-MM')").then(r => r || { total: 0, soma: 0 }),
    db.get("SELECT COUNT(*)::int as total, COALESCE(SUM(preco_venda),0)::numeric(12,2) as soma FROM vendas WHERE data_venda >= date_trunc('week', CURRENT_DATE)::date - INTERVAL '1 day'").then(r => r || { total: 0, soma: 0 }),
    db.get('SELECT COUNT(*)::int as total FROM vendedores WHERE ativo = TRUE').then(r => r || { total: 0 }),
  ]);

  const veiculosDisponiveis = veiculos.filter(v => !v.vendido).length;

  res.render('admin/dashboard', { veiculos, admin: req.session.admin, totalVendas, vendasMes, vendasSemana, totalVendedores, veiculosDisponiveis });
});

// ----- VEÍCULOS CRUD -----
router.get('/novo', auth, (req, res) => {
  res.render('admin/form', { veiculo: null, erro: null });
});

router.post('/novo', auth, upload.array('imagens', 10), async (req, res) => {
  const { marca, modelo, ano_fabricacao, ano_modelo, quilometragem, combustivel, cambio, cor, portas, preco, descricao } = req.body;
  if (!marca || !modelo || !ano_fabricacao || !ano_modelo || !preco) {
    return res.render('admin/form', { veiculo: null, erro: 'Preencha todos os campos obrigatórios.' });
  }
  const imagens = req.files && req.files.length > 0
    ? JSON.stringify(req.files.map(f => 'data:' + f.mimetype + ';base64,' + f.buffer.toString('base64')))
    : null;
  await db.run(
    'INSERT INTO veiculos (marca, modelo, ano_fabricacao, ano_modelo, quilometragem, combustivel, cambio, cor, portas, preco, descricao, imagem) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
    [marca, modelo, parseInt(ano_fabricacao), parseInt(ano_modelo), parseInt(quilometragem || 0), combustivel, cambio, cor, parseInt(portas || 4), parseFloat(preco), descricao || '', imagens]
  );
  res.redirect('/admin');
});

router.get('/editar/:id', auth, async (req, res) => {
  const veiculo = await db.get('SELECT * FROM veiculos WHERE id = $1', [req.params.id]);
  if (!veiculo) return res.status(404).send('Veículo não encontrado');
  res.render('admin/form', { veiculo, erro: null });
});

router.post('/editar/:id', auth, upload.array('imagens', 10), async (req, res) => {
  const veiculo = await db.get('SELECT * FROM veiculos WHERE id = $1', [req.params.id]);
  if (!veiculo) return res.status(404).send('Veículo não encontrado');
  const { marca, modelo, ano_fabricacao, ano_modelo, quilometragem, combustivel, cambio, cor, portas, preco, descricao, destaque, vendido, remover_imagens } = req.body;
  let imagens = db.parseImagens(veiculo);
  if (remover_imagens) {
    const remover = Array.isArray(remover_imagens) ? remover_imagens.map(Number) : [Number(remover_imagens)];
    imagens = imagens.filter((_, i) => !remover.includes(i));
  }
  if (req.files && req.files.length > 0) {
    const novas = req.files.map(f => 'data:' + f.mimetype + ';base64,' + f.buffer.toString('base64'));
    imagens = [...imagens, ...novas];
  }
  imagens = imagens.length > 0 ? JSON.stringify(imagens) : null;
  await db.run(
    'UPDATE veiculos SET marca=$1, modelo=$2, ano_fabricacao=$3, ano_modelo=$4, quilometragem=$5, combustivel=$6, cambio=$7, cor=$8, portas=$9, preco=$10, descricao=$11, imagem=$12, destaque=$13, vendido=$14, updated_at=NOW() WHERE id=$15',
    [marca, modelo, parseInt(ano_fabricacao), parseInt(ano_modelo), parseInt(quilometragem || 0), combustivel, cambio, cor, parseInt(portas || 4), parseFloat(preco), descricao || '', imagens, destaque ? true : false, vendido ? true : false, req.params.id]
  );
  res.redirect('/admin');
});

router.get('/excluir/:id', auth, async (req, res) => {
  await db.run('DELETE FROM veiculos WHERE id = $1', [req.params.id]);
  res.redirect('/admin');
});

// ----- VENDEDORES (CRM) -----
router.get('/vendedores', auth, async (req, res) => {
  const vendedores = await db.query('SELECT * FROM vendedores ORDER BY ativo DESC, nome');
  res.render('admin/vendedores', { vendedores, admin: req.session.admin });
});

router.get('/vendedores/novo', auth, (req, res) => {
  res.render('admin/vendedor-form', { vendedor: null, erro: null });
});

router.post('/vendedores/novo', auth, async (req, res) => {
  const { nome, telefone, email, comissao_percentual } = req.body;
  if (!nome) return res.render('admin/vendedor-form', { vendedor: null, erro: 'Nome é obrigatório.' });
  await db.run('INSERT INTO vendedores (nome, telefone, email, comissao_percentual) VALUES ($1, $2, $3, $4)',
    [nome, telefone || '', email || '', parseFloat(comissao_percentual || 5)]);
  res.redirect('/admin/vendedores');
});

router.get('/vendedores/editar/:id', auth, async (req, res) => {
  const vendedor = await db.get('SELECT * FROM vendedores WHERE id = $1', [req.params.id]);
  if (!vendedor) return res.status(404).send('Vendedor não encontrado');
  res.render('admin/vendedor-form', { vendedor, erro: null });
});

router.post('/vendedores/editar/:id', auth, async (req, res) => {
  const { nome, telefone, email, comissao_percentual, ativo } = req.body;
  await db.run('UPDATE vendedores SET nome=$1, telefone=$2, email=$3, comissao_percentual=$4, ativo=$5 WHERE id=$6',
    [nome, telefone || '', email || '', parseFloat(comissao_percentual || 5), ativo ? true : false, req.params.id]);
  res.redirect('/admin/vendedores');
});

router.get('/vendedores/excluir/:id', auth, async (req, res) => {
  await db.run('DELETE FROM vendedores WHERE id = $1', [req.params.id]);
  res.redirect('/admin/vendedores');
});

// ----- REGISTRAR VENDA -----
router.get('/vendas/nova/:veiculo_id', auth, async (req, res) => {
  const [veiculo, vendedores] = await Promise.all([
    db.get('SELECT * FROM veiculos WHERE id = $1', [req.params.veiculo_id]),
    db.query('SELECT * FROM vendedores WHERE ativo = TRUE ORDER BY nome')
  ]);
  if (!veiculo) return res.status(404).send('Veículo não encontrado');
  res.render('admin/venda-form', { veiculo, vendedores, erro: null });
});

router.post('/vendas/nova/:veiculo_id', auth, async (req, res) => {
  const veiculo = await db.get('SELECT * FROM veiculos WHERE id = $1', [req.params.veiculo_id]);
  if (!veiculo) return res.status(404).send('Veículo não encontrado');

  const { vendedor_id, data_venda, preco_venda, comissao_percentual, tipo_pagamento, observacao } = req.body;

  if (!data_venda || !preco_venda) {
    const vendedores = await db.query('SELECT * FROM vendedores WHERE ativo = TRUE ORDER BY nome');
    return res.render('admin/venda-form', { veiculo, vendedores, erro: 'Preencha data e preço da venda.' });
  }

  const pv = parseFloat(preco_venda);
  const cp = parseFloat(comissao_percentual || 5);
  const cv = pv * (cp / 100);

  await db.run(
    'INSERT INTO vendas (veiculo_id, vendedor_id, data_venda, preco_venda, comissao_percentual, comissao_valor, financiado, tipo_pagamento, observacao) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [req.params.veiculo_id, vendedor_id || null, data_venda, pv, cp, cv, tipo_pagamento === 'financiado' ? true : false, tipo_pagamento || 'avista', observacao || '']
  );
  await db.run('UPDATE veiculos SET vendido = TRUE, updated_at = NOW() WHERE id = $1', [req.params.veiculo_id]);

  res.redirect('/admin/vendas');
});

// ----- LISTAR VENDAS -----
router.get('/vendas', auth, async (req, res) => {
  const vendas = await db.query(`
    SELECT v.*, ve.marca, ve.modelo, ve.ano_fabricacao, ve.ano_modelo, vd.nome as vendedor_nome
    FROM vendas v
    LEFT JOIN veiculos ve ON v.veiculo_id = ve.id
    LEFT JOIN vendedores vd ON v.vendedor_id = vd.id
    ORDER BY v.data_venda DESC
  `);
  res.render('admin/vendas', { vendas, admin: req.session.admin });
});

router.get('/vendas/excluir/:id', auth, async (req, res) => {
  const venda = await db.get('SELECT * FROM vendas WHERE id = $1', [req.params.id]);
  if (venda) {
    await db.run('UPDATE veiculos SET vendido = FALSE WHERE id = $1', [venda.veiculo_id]);
    await db.run('DELETE FROM vendas WHERE id = $1', [req.params.id]);
  }
  res.redirect('/admin/vendas');
});

// ----- ANALYTICS -----
router.get('/analytics', auth, async (req, res) => {
  const periodo = req.query.periodo || 'mes';

  let vendasPeriodo, vendasPorVendedor;

  if (periodo === 'semana') {
    vendasPeriodo = await db.query(`
      SELECT v.data_venda, v.preco_venda, v.comissao_valor, v.financiado,
             ve.marca, ve.modelo, vd.nome as vendedor_nome
      FROM vendas v
      LEFT JOIN veiculos ve ON v.veiculo_id = ve.id
      LEFT JOIN vendedores vd ON v.vendedor_id = vd.id
      WHERE v.data_venda >= date_trunc('week', CURRENT_DATE)::date - INTERVAL '1 day'
      ORDER BY v.data_venda DESC
    `);
    vendasPorVendedor = await db.query(`
      SELECT vd.nome, COUNT(*)::int as total, COALESCE(SUM(v.preco_venda),0)::numeric(12,2) as soma, COALESCE(SUM(v.comissao_valor),0)::numeric(12,2) as comissao
      FROM vendas v JOIN vendedores vd ON v.vendedor_id = vd.id
      WHERE v.data_venda >= date_trunc('week', CURRENT_DATE)::date - INTERVAL '1 day'
      GROUP BY vd.nome ORDER BY soma DESC
    `);
  } else {
    vendasPeriodo = await db.query(`
      SELECT v.data_venda, v.preco_venda, v.comissao_valor, v.financiado,
             ve.marca, ve.modelo, vd.nome as vendedor_nome
      FROM vendas v
      LEFT JOIN veiculos ve ON v.veiculo_id = ve.id
      LEFT JOIN vendedores vd ON v.vendedor_id = vd.id
      WHERE to_char(v.data_venda, 'YYYY-MM') = to_char(CURRENT_DATE, 'YYYY-MM')
      ORDER BY v.data_venda DESC
    `);
    vendasPorVendedor = await db.query(`
      SELECT vd.nome, COUNT(*)::int as total, COALESCE(SUM(v.preco_venda),0)::numeric(12,2) as soma, COALESCE(SUM(v.comissao_valor),0)::numeric(12,2) as comissao
      FROM vendas v JOIN vendedores vd ON v.vendedor_id = vd.id
      WHERE to_char(v.data_venda, 'YYYY-MM') = to_char(CURRENT_DATE, 'YYYY-MM')
      GROUP BY vd.nome ORDER BY soma DESC
    `);
  }

  const totalFaturado = vendasPeriodo.reduce((s, v) => s + parseFloat(v.preco_venda), 0);
  const totalComissao = vendasPeriodo.reduce((s, v) => s + parseFloat(v.comissao_valor), 0);
  const totalFinanciados = vendasPeriodo.filter(v => v.financiado).length;

  res.render('admin/analytics', { periodo, vendasPeriodo, vendasPorVendedor, totalFaturado, totalComissao, totalFinanciados, admin: req.session.admin });
});

// ----- CONFIGURAÇÕES -----
router.get('/config', auth, async (req, res) => {
  const defaults = { whatsapp: '5511999999999', hora_seg_sex_abre: '8h', hora_seg_sex_fecha: '19h', hora_sab_abre: '8h', hora_sab_fecha: '13h', cor_primaria: '#0f3460', cor_secundaria: '#1a1a2e', cor_destaque: '#e94560', cor_fundo: '#f8f9fb' };
  const config = {};
  for (const k of Object.keys(defaults)) {
    config[k] = await db.getConfig(k, defaults[k]);
  }
  res.render('admin/config', { ...config, admin: req.session.admin, salvo: false });
});

router.post('/config', auth, async (req, res) => {
  const keys = ['whatsapp','hora_seg_sex_abre','hora_seg_sex_fecha','hora_sab_abre','hora_sab_fecha','cor_primaria','cor_secundaria','cor_destaque','cor_fundo'];
  for (const k of keys) {
    if (req.body[k] !== undefined) {
      await db.run('INSERT INTO config (chave, valor) VALUES ($1, $2) ON CONFLICT (chave) DO UPDATE SET valor = $2', [k, req.body[k]]);
    }
  }
  if (req.app.locals) {
    for (const k of keys) {
      req.app.locals[k] = req.body[k] || await db.getConfig(k);
    }
  }
  const config = {};
  for (const k of keys) {
    config[k] = await db.getConfig(k);
  }
  res.render('admin/config', { ...config, admin: req.session.admin, salvo: true });
});

module.exports = router;
