// =============================================================
// MATERIAIS DISPONÍVEIS (dados FICTÍCIOS, porém plausíveis)
// - densidade: em g/cm³ (que é o mesmo que kg por litro)
// - espessuras: chapas que a rede de parceiras trabalha, em mm
// Para adicionar um material, copie um bloco e mude a chave.
// Lembre de cadastrar o preço dele em data/precos.js.
// =============================================================

const MATERIAIS = {
  aco_carbono: {
    nome: "Aço carbono",
    densidade: 7.85,
    espessuras: [1.5, 2, 3, 4.75, 6.35]
  },
  inox_304: {
    nome: "Inox 304",
    densidade: 7.93,
    espessuras: [1, 1.5, 2, 3, 4]
  },
  aluminio: {
    nome: "Alumínio",
    densidade: 2.70,
    espessuras: [1, 1.5, 2, 3, 4, 6]
  }
};
