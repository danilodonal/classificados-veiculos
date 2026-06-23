const { initDB, query, run } = require('./database');

const carros = [
  { marca: 'Toyota', modelo: 'Corolla Altis', ano_f: 2023, ano_m: 2024, km: 15000, comb: 'Flex', cambio: 'Automático', cor: 'Prata', portas: 4, preco: 125000, destaque: true, descricao: 'Completo, teto solar, bancos em couro, central multimídia, câmera de ré. Único dono, revisões em dia.' },
  { marca: 'Volkswagen', modelo: 'T-Cross Highline', ano_f: 2022, ano_m: 2023, km: 28000, comb: 'Flex', cambio: 'Automático', cor: 'Branco', portas: 4, preco: 139900, destaque: true, descricao: 'SUV completo, painel digital, sensor de estacionamento, ar-condicionado digital, vidros elétricos.' },
  { marca: 'Fiat', modelo: 'Strada Volcano', ano_f: 2023, ano_m: 2024, km: 8000, comb: 'Flex', cambio: 'Manual', cor: 'Vermelho', portas: 4, preco: 99900, destaque: false, descricao: 'Pick-up nova, direção elétrica, ar-condicionado, som original, barras no teto.' },
  { marca: 'Honda', modelo: 'HR-V Touring', ano_f: 2020, ano_m: 2021, km: 45000, comb: 'Flex', cambio: 'Automático', cor: 'Azul', portas: 4, preco: 115000, destaque: false, descricao: 'SUV completo, teto panorâmico, bancos em couro, Honda Sensing, muito econômico.' },
  { marca: 'Chevrolet', modelo: 'Onix Premier', ano_f: 2021, ano_m: 2022, km: 35000, comb: 'Flex', cambio: 'Automático', cor: 'Preto', portas: 4, preco: 79900, destaque: true, descricao: 'Completo, central MyLink, Wi-Fi nativo, câmera de ré, sensor de estacionamento, bancos em couro.' },
  { marca: 'Jeep', modelo: 'Compass Longitude', ano_f: 2023, ano_m: 2024, km: 12000, comb: 'Diesel', cambio: 'Automático', cor: 'Branco', portas: 4, preco: 189900, destaque: true, descricao: 'SUV Premium, 4x4, bancos em couro, ar-condicionado dual zone, painel digital, carregador por indução.' },
  { marca: 'Hyundai', modelo: 'Hb20 Diamond', ano_f: 2022, ano_m: 2023, km: 22000, comb: 'Flex', cambio: 'Automático', cor: 'Prata', portas: 4, preco: 89900, destaque: false, descricao: 'Completo, alerta de ponto cego, central multimídia, chave presencial, partida remota.' },
  { marca: 'Ford', modelo: 'Ranger XLS', ano_f: 2021, ano_m: 2022, km: 50000, comb: 'Diesel', cambio: 'Automático', cor: 'Preto', portas: 4, preco: 169900, destaque: false, descricao: 'Pick-up cabine dupla, 4x4, ar-condicionado, direção elétrica, engate pronto, muito robusta.' },
  { marca: 'Nissan', modelo: 'Kicks Exclusive', ano_f: 2023, ano_m: 2023, km: 18000, comb: 'Flex', cambio: 'Automático', cor: 'Laranja', portas: 4, preco: 109900, destaque: false, descricao: 'SUV compacto, bancos em couro, câmera 360°, sensor de estacionamento, multimídia com Android Auto.' },
  { marca: 'BMW', modelo: '320i GP', ano_f: 2020, ano_m: 2021, km: 38000, comb: 'Gasolina', cambio: 'Automático', cor: 'Azul', portas: 4, preco: 179900, destaque: true, descricao: 'Esportivo de luxo, teto solar, bancos em couro, head-up display, rodas 18", som harman kardon.' }
];

async function seed() {
  await initDB();

  const existing = await query('SELECT COUNT(*)::int as total FROM veiculos');
  if (existing[0].total > 0) {
    console.log(`Já existem ${rows[0].total} veículos no banco. Pulando seed.`);
    return;
  }

  for (const c of carros) {
    await run(
      `INSERT INTO veiculos (marca, modelo, ano_fabricacao, ano_modelo, quilometragem, combustivel, cambio, cor, portas, preco, descricao, destaque)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [c.marca, c.modelo, c.ano_f, c.ano_m, c.km, c.comb, c.cambio, c.cor, c.portas, c.preco, c.descricao, c.destaque]
    );
  }

  console.log('10 veículos inseridos com sucesso!');
}

seed().catch(console.error);
