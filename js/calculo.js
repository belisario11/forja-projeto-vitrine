// =============================================================
// CÁLCULO DO ORÇAMENTO
// Função "pura": recebe os dados da peça e devolve o preço detalhado.
// Não mexe na tela. Todos os valores vêm de data/precos.js e
// data/materiais.js (nenhum preço escrito aqui dentro).
//
// Fórmula (por pedido):
//   material    = área x espessura x densidade x R$/kg x (1 + perda) x quantidade
//   corte       = metros de corte x R$/m x quantidade
//   perfurações = nº de furos x R$/furo x quantidade
//   dobras      = nº de dobras x R$/dobra x quantidade
//   preparação  = valor fixo do laser (+ dobradeira, se tiver dobra)
//   acabamento  = por m² (pintura) ou por kg (galvanização)
//   ---------------------------------------------------------
//   custo de fabricação = soma de tudo acima (é o que a metalúrgica recebe)
//   margem da plataforma = custo / (1 - comissão) - custo
//   prazo expresso = + acréscimo sobre o total
// =============================================================

// Diz se um acabamento pode ser usado em um material
// (ex.: galvanização só faz sentido em aço carbono)
function acabamentoPermitido(chaveMaterial, chaveAcabamento) {
  const acabamento = PRECOS.acabamentos[chaveAcabamento];
  return Boolean(acabamento) && acabamento.materiais.includes(chaveMaterial);
}

// Calcula o prazo em dias úteis
function calcularPrazo(quantidade, chaveAcabamento, chavePrazo) {
  const normal = PRECOS.prazo.normal;

  // Prazo normal: base + 1 dia a cada lote de peças + dias de acabamento
  let dias = normal.diasBase + Math.floor((quantidade - 1) / normal.pecasPorDiaExtra);
  if (chaveAcabamento !== "nenhum") {
    dias += normal.diasAcabamento;
  }

  // Expresso: uma fração do prazo normal, com um mínimo
  if (chavePrazo === "expresso") {
    const expresso = PRECOS.prazo.expresso;
    dias = Math.max(expresso.diasMinimos, Math.ceil(dias * expresso.fatorDias));
  }
  return dias;
}

// Arredonda para centavos
function arredondar(valor) {
  return Math.round(valor * 100) / 100;
}

/*
  entrada = {
    material:    "aco_carbono" | "inox_304" | "aluminio",
    espessura:   número em mm (precisa estar em MATERIAIS[material].espessuras),
    quantidade:  número de peças (inteiro >= 1),
    dobras:      dobras por peça (inteiro >= 0),
    acabamento:  "nenhum" | "pintura_epoxi" | "galvanizacao",
    prazo:       "normal" | "expresso",
    geometria: {
      areaM2:      área da chapa usada por peça, em m² (retângulo envolvente / chapa planificada)
      corteM:      metros de corte por peça
      perfuracoes: contornos fechados por peça (furos)
    }
  }
*/
function calcularOrcamento(entrada) {
  const material = MATERIAIS[entrada.material];
  if (!material) {
    throw new Error("Material desconhecido: " + entrada.material);
  }
  if (!material.espessuras.includes(entrada.espessura)) {
    throw new Error("Espessura não disponível para " + material.nome);
  }
  if (!acabamentoPermitido(entrada.material, entrada.acabamento)) {
    throw new Error("Acabamento não disponível para " + material.nome);
  }

  const qtd = Math.max(1, Math.round(entrada.quantidade));
  const dobras = Math.max(0, Math.round(entrada.dobras));
  const geo = entrada.geometria;

  // ---- Material ----
  // 1 m² x 1 mm = 1 litro; litro x densidade (kg/L) = kg
  const massaPecaKg = geo.areaM2 * entrada.espessura * material.densidade;
  const massaTotalKg = massaPecaKg * qtd * (1 + PRECOS.perdaChapa);
  const valorMaterial = massaTotalKg * PRECOS.materialPorKg[entrada.material];

  // ---- Corte ----
  const precoMetro = PRECOS.cortePorMetro[entrada.material][entrada.espessura];
  const metrosTotais = geo.corteM * qtd;
  const valorCorte = metrosTotais * precoMetro;

  // ---- Perfurações ----
  const furosTotais = geo.perfuracoes * qtd;
  const valorPerfuracoes = furosTotais * PRECOS.porPerfuracao;

  // ---- Dobras ----
  const dobrasTotais = dobras * qtd;
  const valorDobras = dobrasTotais * PRECOS.porDobra;

  // ---- Preparação da máquina (fixo por pedido) ----
  const valorPreparacao = PRECOS.preparacao.corte + (dobras > 0 ? PRECOS.preparacao.dobra : 0);

  // ---- Acabamento ----
  const acabamento = PRECOS.acabamentos[entrada.acabamento];
  let valorAcabamento = 0;
  let detalheAcabamento = acabamento.nome;
  if (acabamento.valor > 0 && acabamento.unidade === "m2") {
    const areaPintada = geo.areaM2 * 2 * qtd; // duas faces
    valorAcabamento = areaPintada * acabamento.valor;
    detalheAcabamento = areaPintada.toFixed(2).replace(".", ",") + " m² (duas faces)";
  } else if (acabamento.valor > 0 && acabamento.unidade === "kg") {
    const massaAcabada = massaPecaKg * qtd;
    valorAcabamento = massaAcabada * acabamento.valor;
    detalheAcabamento = massaAcabada.toFixed(1).replace(".", ",") + " kg";
  }

  // ---- Soma: custo de fabricação (o que vai para a metalúrgica) ----
  let custo = valorMaterial + valorCorte + valorPerfuracoes + valorDobras + valorPreparacao + valorAcabamento;

  // Pedido mínimo: se a soma ficar muito baixa, completa até o mínimo
  const precoSemExpresso = custo / (1 - PRECOS.comissao);
  let ajusteMinimo = 0;
  if (precoSemExpresso < PRECOS.pedidoMinimo) {
    ajusteMinimo = PRECOS.pedidoMinimo * (1 - PRECOS.comissao) - custo;
    custo += ajusteMinimo;
  }

  // ---- Margem da plataforma ----
  const subtotal = custo / (1 - PRECOS.comissao);
  const margem = subtotal - custo;

  // ---- Prazo expresso ----
  const acrescimoPct = entrada.prazo === "expresso" ? PRECOS.prazo.expresso.acrescimo : 0;
  const valorExpresso = subtotal * acrescimoPct;

  const total = subtotal + valorExpresso;

  // Lista de itens para mostrar o detalhamento na tela
  const itens = [
    { chave: "material", rotulo: "Material", valor: arredondar(valorMaterial),
      detalhe: massaTotalKg.toFixed(2).replace(".", ",") + " kg com " + Math.round(PRECOS.perdaChapa * 100) + "% de perda de chapa" },
    { chave: "corte", rotulo: "Corte a laser", valor: arredondar(valorCorte),
      detalhe: metrosTotais.toFixed(2).replace(".", ",") + " m de corte" },
    { chave: "perfuracoes", rotulo: "Perfurações", valor: arredondar(valorPerfuracoes),
      detalhe: furosTotais + " perfurações" },
    { chave: "dobras", rotulo: "Dobras", valor: arredondar(valorDobras),
      detalhe: dobrasTotais + " dobras" },
    { chave: "preparacao", rotulo: "Preparação da máquina", valor: arredondar(valorPreparacao),
      detalhe: dobras > 0 ? "laser + dobradeira" : "laser" },
    { chave: "acabamento", rotulo: "Acabamento", valor: arredondar(valorAcabamento),
      detalhe: detalheAcabamento }
  ];
  if (ajusteMinimo > 0) {
    itens.push({ chave: "minimo", rotulo: "Ajuste de pedido mínimo", valor: arredondar(ajusteMinimo),
      detalhe: "pedido mínimo da plataforma" });
  }
  itens.push({ chave: "margem", rotulo: "Margem da plataforma", valor: arredondar(margem),
    detalhe: Math.round(PRECOS.comissao * 100) + "% do preço" });
  if (valorExpresso > 0) {
    itens.push({ chave: "expresso", rotulo: "Prazo expresso", valor: arredondar(valorExpresso),
      detalhe: "+" + Math.round(acrescimoPct * 100) + "%" });
  }

  return {
    itens: itens,
    custoFabricacao: arredondar(custo),
    // Parte da plataforma no total (a comissão vale também sobre o acréscimo do expresso)
    margem: arredondar(total * PRECOS.comissao),
    total: arredondar(total),
    precoPorPeca: arredondar(total / qtd),
    // O que a metalúrgica recebe: o total menos a comissão da plataforma
    repasseParceira: arredondar(total * (1 - PRECOS.comissao)),
    prazoDiasUteis: calcularPrazo(qtd, entrada.acabamento, entrada.prazo),
    massaPecaKg: massaPecaKg,
    quantidade: qtd
  };
}
