// =============================================================
// METALÚRGICAS PARCEIRAS — TODAS FICTÍCIAS
// Nomes, cidades, notas e números foram inventados para a simulação.
// Nenhuma empresa real faz parte desta lista.
//
// Campos de cada parceira:
// - processos: o que ela sabe fazer (chaves de PROCESSOS abaixo)
// - espessuraMaxima: por material, a chapa mais grossa que ela corta (mm).
//   Se o material não aparece, ela não trabalha com ele.
// - distanciaKm: distância até o cliente da simulação (Contagem-MG)
// - nota: média das avaliações de clientes (0 a 5)
// - capacidadeLivre: % da semana com máquina parada (quanto maior, mais rápido aceita)
// - segundosParaAceitar: tempo que ela "demora" para aceitar na animação
// =============================================================

// Nomes amigáveis dos processos (usados nas telas)
const PROCESSOS = {
  corte_laser: "Corte a laser",
  dobra: "Dobra",
  solda_mig: "Solda MIG",
  pintura_epoxi: "Pintura epóxi",
  galvanizacao: "Galvanização"
};

const PARCEIROS = [
  {
    id: "p1",
    nome: "Metalúrgica Vale do Aço Leve",
    cidade: "Contagem",
    distanciaKm: 4.2,
    nota: 4.8,
    avaliacoes: 132,
    processos: ["corte_laser", "dobra", "solda_mig", "pintura_epoxi"],
    espessuraMaxima: { aco_carbono: 6.35, inox_304: 3, aluminio: 4 },
    capacidadeLivre: 45,
    segundosParaAceitar: 3
  },
  {
    id: "p2",
    nome: "Chaparia Horizonte",
    cidade: "Belo Horizonte",
    distanciaKm: 11.5,
    nota: 4.6,
    avaliacoes: 87,
    processos: ["corte_laser", "dobra", "pintura_epoxi"],
    espessuraMaxima: { aco_carbono: 4.75, inox_304: 4, aluminio: 6 },
    capacidadeLivre: 60,
    segundosParaAceitar: 4
  },
  {
    id: "p3",
    nome: "Ferro & Forma Industrial",
    cidade: "Betim",
    distanciaKm: 14.8,
    nota: 4.7,
    avaliacoes: 64,
    processos: ["corte_laser", "dobra", "solda_mig", "galvanizacao"],
    espessuraMaxima: { aco_carbono: 6.35 },
    capacidadeLivre: 35,
    segundosParaAceitar: 5
  },
  {
    id: "p4",
    nome: "Inox Precisão Minas",
    cidade: "Belo Horizonte",
    distanciaKm: 9.1,
    nota: 4.9,
    avaliacoes: 41,
    processos: ["corte_laser", "dobra", "solda_mig"],
    espessuraMaxima: { inox_304: 4, aluminio: 3 },
    capacidadeLivre: 50,
    segundosParaAceitar: 3
  },
  {
    id: "p5",
    nome: "Oficina Laser Ribeirão",
    cidade: "Ribeirão das Neves",
    distanciaKm: 18.3,
    nota: 4.3,
    avaliacoes: 29,
    processos: ["corte_laser"],
    espessuraMaxima: { aco_carbono: 3, aluminio: 3 },
    capacidadeLivre: 70,
    segundosParaAceitar: 2
  },
  {
    id: "p6",
    nome: "Caldeiraria Serra Verde",
    cidade: "Santa Luzia",
    distanciaKm: 24.6,
    nota: 4.5,
    avaliacoes: 53,
    processos: ["corte_laser", "dobra", "solda_mig", "pintura_epoxi", "galvanizacao"],
    espessuraMaxima: { aco_carbono: 6.35, aluminio: 6 },
    capacidadeLivre: 30,
    segundosParaAceitar: 6
  },
  {
    id: "p7",
    nome: "Dobras & Cortes Sete Lagos",
    cidade: "Sete Lagoas",
    distanciaKm: 58.0,
    nota: 4.4,
    avaliacoes: 18,
    processos: ["corte_laser", "dobra", "pintura_epoxi"],
    espessuraMaxima: { aco_carbono: 4.75, inox_304: 2, aluminio: 4 },
    capacidadeLivre: 55,
    segundosParaAceitar: 4
  }
];

// =============================================================
// PAINEL DA PARCEIRA (parceiro.html) — dados FICTÍCIOS
// Simula a visão do "Seu Antônio", dono de uma metalúrgica parceira.
// =============================================================

const PAINEL_PARCEIRO = {
  empresa: "Metalúrgica Antônio & Filhos (fictícia)",
  dono: "Seu Antônio",
  cidade: "Contagem - MG",

  // Máquinas cadastradas na plataforma
  maquinas: [
    { nome: "Laser de fibra 3 kW", processo: "corte_laser", detalhe: "Mesa 3000 x 1500 mm · aço até 6,35 mm" },
    { nome: "Dobradeira CNC 100 t", processo: "dobra", detalhe: "Comprimento útil 3000 mm" },
    { nome: "Solda MIG", processo: "solda_mig", detalhe: "Aço carbono e inox" }
  ],

  // Ofertas que "chegam" no painel durante a demonstração
  ofertas: [
    { id: "o1", titulo: "20 suportes em L", material: "Aço carbono", espessura: "3 mm", cidadeCliente: "Contagem", valorRepasse: 486.00, prazoDiasUteis: 4 },
    { id: "o2", titulo: "8 flanges circulares", material: "Inox 304", espessura: "2 mm", cidadeCliente: "Belo Horizonte", valorRepasse: 352.00, prazoDiasUteis: 5 },
    { id: "o3", titulo: "50 placas com furos", material: "Alumínio", espessura: "2 mm", cidadeCliente: "Betim", valorRepasse: 915.00, prazoDiasUteis: 6 },
    { id: "o4", titulo: "12 cantoneiras", material: "Aço carbono", espessura: "4,75 mm", cidadeCliente: "Contagem", valorRepasse: 274.00, prazoDiasUteis: 3 },
    { id: "o5", titulo: "30 tampas de painel", material: "Aço carbono", espessura: "1,5 mm", cidadeCliente: "Ibirité", valorRepasse: 628.00, prazoDiasUteis: 5 }
  ],

  // Segundos entre uma oferta nova e outra na demonstração
  segundosEntreOfertas: 6,

  // Ocupação da semana: % do horário com máquina trabalhando
  ocupacaoSemana: [
    { dia: "Seg", ocupacao: 85 },
    { dia: "Ter", ocupacao: 70 },
    { dia: "Qua", ocupacao: 55 },
    { dia: "Qui", ocupacao: 40 },
    { dia: "Sex", ocupacao: 30 }
  ],

  // Resumo do mês
  ganhosMes: {
    pedidosConcluidos: 23,
    valorRecebido: 18450.00,
    horasMaquinaOcupadas: 96,
    notaMedia: 4.8
  }
};
