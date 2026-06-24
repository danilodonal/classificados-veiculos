require('express-async-errors');
const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'classificados-veiculos-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

const { initDB, parseImagens, primeiraImagem, getConfig } = require('./database');

initDB().then(async () => {
  app.locals.parseImagens = parseImagens;
  app.locals.primeiraImagem = primeiraImagem;
  const configDefaults = { whatsapp: '5511999999999', hora_seg_sex_abre: '8h', hora_seg_sex_fecha: '19h', hora_sab_abre: '8h', hora_sab_fecha: '13h', cor_primaria: '#0f3460', cor_secundaria: '#1a1a2e', cor_destaque: '#e94560', cor_fundo: '#f8f9fb', nome_site: 'AutoClassificados', slides: '[]' };
  await Promise.all(Object.entries(configDefaults).map(([k, v]) =>
    getConfig(k, v).then(val => { app.locals[k] = k === 'slides' ? JSON.parse(val) : val; })
  ));
  app.use('/', require('./routes/index'));
  app.use('/admin', require('./routes/admin'));

  // error handler global
app.use((err, req, res, next) => {
  console.error('ERRO:', err.message, err.stack);
  res.status(500).send('Erro interno: ' + err.message);
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Erro ao iniciar banco de dados:', err);
});
