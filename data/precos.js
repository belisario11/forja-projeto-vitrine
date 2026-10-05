// =============================================================
// TABELA DE PREÇOS — VALORES SIMULADOS (fictícios, porém plausíveis)
// Nenhum preço ou percentual deve ficar espalhado pelo código:
// tudo o que é dinheiro, porcentagem ou prazo mora aqui.
// Quem usa estes valores: js/calculo.js (fórmula) e as páginas.
// =============================================================

const PRECOS = {
  // ---------- MATERIAL ----------
  // Preço da chapa em R$ por kg
  materialPorKg: {
    aco_carbono: 9.50,
    inox_304: 32.00,
    aluminio: 38.00
  },

  // Perda de chapa: sobra/retalho que não vira peça.
  // 0.15 = acrescenta 15% ao peso do material.
  perdaChapa: 0.15,

  // ---------- CORTE A LASER ----------
  // R$ por metro de corte, conforme material e espessura (mm).
  // Chapa mais grossa = corte mais lento = mais caro.
  cortePorMetro: {
    aco_carbono: { 1.5: 2.20, 2: 2.60, 3: 3.40, 4.75: 5.20, 6.35: 7.50 },
    inox_304:    { 1: 3.00, 1.5: 3.60, 2: 4.20, 3: 6.00, 4: 8.50 },
    aluminio:    { 1: 2.40, 1.5: 2.80, 2: 3.20, 3: 4.40, 4: 5.80, 6: 8.80 }
  },

  // R$ por perfuração (cada furo/contorno fechado: o laser precisa "furar" a chapa para começar)
  porPerfuracao: 0.60,

  // ---------- DOBRA ----------
  // R$ por dobra, em cada peça
  porDobra: 2.50,

  // ---------- PREPARAÇÃO DA MÁQUINA (setup) ----------
  // Valor fixo por pedido: programar o laser e ajustar a dobradeira
  preparacao: {
    corte: 60.00,
    dobra: 40.00 // só entra se o pedido tiver dobras
  },

  // ---------- ACABAMENTO ----------
  // unidade "m2": cobra pela área das duas faces da peça
  // unidade "kg": cobra pelo peso da peça
  // materiais: em quais materiais o acabamento faz sentido
  acabamentos: {
    nenhum:        { nome: "Nenhum",         valor: 0,     unidade: "m2", materiais: ["aco_carbono", "inox_304", "aluminio"] },
    pintura_epoxi: { nome: "Pintura epóxi",  valor: 45.00, unidade: "m2", materiais: ["aco_carbono", "inox_304", "aluminio"] },
    galvanizacao:  { nome: "Galvanização",   valor: 6.50,  unidade: "kg", materiais: ["aco_carbono"] }
  },

  // ---------- MARGEM DA PLATAFORMA ----------
  // Comissão que a plataforma fica de cada pedido (sobre o preço final).
  // Preço final = custo de fabricação / (1 - comissao)
  comissao: 0.18,
  comissaoMinima: 0.15, // faixa usada nos textos do site
  comissaoMaxima: 0.20,

  // Pedido mínimo (R$): pedidos muito pequenos sobem para este valor
  pedidoMinimo: 80.00,

  // ---------- PRAZO ----------
  prazo: {
    normal: {
      nome: "Normal",
      diasBase: 4,          // dias úteis para qualquer pedido
      pecasPorDiaExtra: 50, // a cada 50 peças, +1 dia útil
      diasAcabamento: 2,    // pintura/galvanização somam dias
      acrescimo: 0          // sem acréscimo no preço
    },
    expresso: {
      nome: "Expresso",
      fatorDias: 0.5,       // metade do prazo normal (arredondado para cima)
      diasMinimos: 2,
      acrescimo: 0.35       // +35% no preço total
    }
  },

  // ---------- MATCH (tarifa dinâmica) ----------
  // Se nenhuma parceira aceitar, o valor oferecido a elas sobe um pouco
  // (sai da margem da plataforma, o cliente não paga a mais).
  match: {
    aumentoPorRodada: 0.05, // +5% no repasse a cada rodada sem aceite
    maxRodadas: 3
  }
};
