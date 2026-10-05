// =============================================================
// MATCH (SIMULADO) + ACOMPANHAMENTO DO PEDIDO — orcamento.html
//
// O que este arquivo faz, na ordem:
// 1. Filtra as metalúrgicas parceiras que conseguem fazer o pedido
//    (processo, material e espessura).
// 2. Mostra a "busca" com um radar animado e os cartões das parceiras.
// 3. Simula o aceite: a parceira mais rápida entre as 3 mais próximas aceita.
//    Se ninguém aceita, o valor oferecido sobe um pouco (tarifa dinâmica).
// 4. Mostra o pedido confirmado e uma linha do tempo do status.
//
// Tudo é simulação: as metalúrgicas são fictícias (data/parceiros.js)
// e nenhum pagamento é feito.
//
// Quem chama: js/orcamento.js chama iniciarMatch(pedido) quando a
// pessoa clica em "Fazer pedido".
//
// DICA PARA A APRESENTAÇÃO: para mostrar a tarifa dinâmica funcionando,
// abra orcamento.html?tarifa-dinamica — na primeira rodada ninguém aceita
// e o valor oferecido à metalúrgica sobe antes do aceite.
// =============================================================

// Etapas da linha do tempo do pedido (na ordem)
const ETAPAS_PEDIDO = [
  "Pedido confirmado",
  "Na fila da metalúrgica",
  "Corte",
  "Dobra",
  "Inspeção de qualidade",
  "Enviado",
  "Entregue"
];

// Guarda os números de todos os timers (setTimeout) que estão rodando.
// Assim conseguimos cancelar tudo se a pessoa começar de novo.
let temporizadoresMatch = [];

// Guarda as informações do match que está acontecendo agora
let estadoMatch = null;

// -------------------------------------------------------------
// FUNÇÕES PEQUENAS DE APOIO
// -------------------------------------------------------------

// Agenda uma função para daqui a "ms" milissegundos e guarda o timer
function agendar(funcao, ms) {
  const id = setTimeout(funcao, ms);
  temporizadoresMatch.push(id);
}

// Cancela todos os timers agendados
function cancelarTemporizadores() {
  temporizadoresMatch.forEach(function (id) {
    clearTimeout(id);
  });
  temporizadoresMatch = [];
}

// A pessoa pediu ao sistema para reduzir animações?
function movimentoReduzido() {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Tempo de espera: normal, ou bem curto se o movimento for reduzido
function tempo(msNormal, msReduzido) {
  return movimentoReduzido() ? msReduzido : msNormal;
}

// Endereço com "?tarifa-dinamica" => a primeira rodada é recusada
function deveSimularRecusa() {
  return new URLSearchParams(location.search).has("tarifa-dinamica");
}

// Distância no formato brasileiro: 4.2 -> "4,2 km"
function formatarDistancia(km) {
  return formatarNumero(km, 1) + " km";
}

// Lista de chaves de processo -> "Corte a laser, Dobra e Pintura epóxi"
function nomesDosProcessos(chaves) {
  const nomes = chaves.map(function (chave) {
    return PROCESSOS[chave];
  });
  if (nomes.length <= 1) return nomes.join("");
  return nomes.slice(0, -1).join(", ") + " e " + nomes[nomes.length - 1];
}

// Cria um elemento HTML com classe e texto (o texto nunca vira HTML)
function criarElemento(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

// Ícones SVG simples (fixos, escritos aqui — nenhum dado do usuário entra neles)
const ICONES_MATCH = {
  check: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
  relogio: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  espera: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/></svg>',
  pular: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>',
  local: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>'
};

// -------------------------------------------------------------
// 1. FILTRO DAS PARCEIRAS (função "pura": não mexe na tela)
// Uma parceira é compatível se:
//   - faz TODOS os processos que o pedido precisa;
//   - trabalha com o material do pedido;
//   - corta a espessura do pedido.
// Devolve { compativeis: [...], descartadas: [{ parceira, motivo }] }
// -------------------------------------------------------------
function filtrarParceirasCompativeis(pedido) {
  const compativeis = [];
  const descartadas = [];
  const nomeMaterial = MATERIAIS[pedido.material].nome;

  PARCEIROS.forEach(function (parceira) {
    const motivos = [];

    // Material e espessura
    const espessuraMax = parceira.espessuraMaxima[pedido.material];
    if (espessuraMax === undefined) {
      motivos.push("não trabalha com " + nomeMaterial);
    } else if (pedido.espessura > espessuraMax) {
      motivos.push("corta " + nomeMaterial + " só até " + formatarEspessura(espessuraMax));
    }

    // Processos (corte, dobra, acabamento...)
    pedido.processosNecessarios.forEach(function (processo) {
      if (!parceira.processos.includes(processo)) {
        motivos.push("não faz " + PROCESSOS[processo].toLowerCase());
      }
    });

    if (motivos.length === 0) {
      compativeis.push(parceira);
    } else {
      descartadas.push({ parceira: parceira, motivo: motivos.join("; ") });
    }
  });

  // Mais perto primeiro
  compativeis.sort(function (a, b) {
    return a.distanciaKm - b.distanciaKm;
  });

  return { compativeis: compativeis, descartadas: descartadas };
}

// Entre as 3 parceiras mais próximas, aceita a que responde mais rápido
function escolherParceiraQueAceita(compativeis) {
  const tresMaisProximas = compativeis.slice(0, 3);
  let escolhida = tresMaisProximas[0];
  tresMaisProximas.forEach(function (parceira) {
    if (parceira.segundosParaAceitar < escolhida.segundosParaAceitar) {
      escolhida = parceira;
    }
  });
  return escolhida;
}

// Soma dias úteis a uma data (pula sábado e domingo)
function somarDiasUteis(dataInicial, diasUteis) {
  const data = new Date(dataInicial.getTime());
  let somados = 0;
  while (somados < diasUteis) {
    data.setDate(data.getDate() + 1);
    const diaDaSemana = data.getDay(); // 0 = domingo, 6 = sábado
    if (diaDaSemana !== 0 && diaDaSemana !== 6) {
      somados = somados + 1;
    }
  }
  return data;
}

// Número de pedido de mentira: 2 letras do nome + 5 dígitos do relógio
function gerarNumeroPedido() {
  const prefixo = NOME_STARTUP.slice(0, 2).toUpperCase();
  return prefixo + "-" + String(Date.now()).slice(-5);
}

// -------------------------------------------------------------
// 2. FUNÇÃO PRINCIPAL — chamada por js/orcamento.js
// -------------------------------------------------------------
function iniciarMatch(pedido) {
  // Se já havia uma simulação rodando, para tudo antes de começar outra
  cancelarTemporizadores();

  const secaoMatch = document.getElementById("secao-match");
  const secaoPedido = document.getElementById("secao-pedido");
  if (!secaoMatch || !secaoPedido) return;

  secaoPedido.hidden = true;
  secaoPedido.innerHTML = "";

  estadoMatch = {
    pedido: pedido,
    filtro: filtrarParceirasCompativeis(pedido),
    valorOferecido: pedido.resultado.repasseParceira,
    rodada: 0,
    cartoes: {}, // id da parceira -> elemento do selo de status
    parceiraEscolhida: null
  };

  montarSecaoMatch(secaoMatch, pedido);
  secaoMatch.hidden = false;
  focarTitulo("titulo-match", secaoMatch);

  // Depois de um tempinho "procurando", mostra o resultado do filtro
  agendar(mostrarResultadoDoFiltro, tempo(1500, 0));
}

// Coloca o foco no título da seção e rola a tela até ela
function focarTitulo(idTitulo, secao) {
  const titulo = document.getElementById(idTitulo);
  if (titulo) titulo.focus({ preventScroll: true });
  secao.scrollIntoView({ behavior: movimentoReduzido() ? "auto" : "smooth", block: "start" });
}

// Escreve uma mensagem na região "aria-live" (o leitor de tela lê em voz alta)
function anunciarMatch(texto) {
  const status = document.getElementById("match-status");
  if (status) status.textContent = texto;
}

// Atualiza o valor oferecido à metalúrgica na tela
function mostrarValorOferecido() {
  const elemento = document.getElementById("match-valor");
  if (elemento) elemento.textContent = formatarReais(estadoMatch.valorOferecido);
}

// -------------------------------------------------------------
// MONTAGEM DA SEÇÃO DO MATCH
// -------------------------------------------------------------
function montarSecaoMatch(secao, pedido) {
  secao.innerHTML = "";
  const container = criarElemento("div", "container");

  const sobrelinha = criarElemento("span", "sobrelinha", "Passo 2 · Match");
  const titulo = criarElemento("h2", null, "Procurando a metalúrgica certa");
  titulo.id = "titulo-match";
  titulo.tabIndex = -1;
  container.appendChild(sobrelinha);
  container.appendChild(titulo);

  const aviso = criarElemento("p", "selo selo-ficticio match-aviso",
    "Simulação: as metalúrgicas são fictícias e nenhum pagamento é feito.");
  container.appendChild(aviso);

  // Linha de cima: radar + status | resumo do pedido
  const topo = criarElemento("div", "match-topo");

  const busca = criarElemento("div", "cartao match-busca");
  const radar = criarElemento("div", "match-radar");
  radar.id = "match-radar";
  radar.setAttribute("aria-hidden", "true");
  radar.innerHTML =
    '<svg viewBox="0 0 120 120" focusable="false">' +
    '<circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.35"/>' +
    '<circle cx="60" cy="60" r="38" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.35"/>' +
    '<circle cx="60" cy="60" r="20" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.35"/>' +
    '<circle class="match-radar-ponto" cx="60" cy="60" r="6"/>' +
    "</svg>" +
    '<span class="match-radar-onda"></span><span class="match-radar-onda match-radar-onda-2"></span>';
  busca.appendChild(radar);

  const status = criarElemento("p", "match-status texto-grande",
    "Procurando metalúrgicas com máquina livre perto de você...");
  status.id = "match-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  busca.appendChild(status);

  // Valor oferecido à metalúrgica (o repasse)
  const valor = criarElemento("p", "match-valor-linha", "Valor oferecido à metalúrgica: ");
  const valorForte = criarElemento("strong", null, formatarReais(estadoMatch.valorOferecido));
  valorForte.id = "match-valor";
  valor.appendChild(valorForte);
  busca.appendChild(valor);
  busca.appendChild(criarElemento("p", "ajuda",
    "É o total do pedido menos a comissão da plataforma. A metalúrgica não precisa fazer orçamento."));

  // Área da contagem regressiva (aparece só durante a espera do aceite)
  const contagem = criarElemento("div", "match-contagem");
  contagem.id = "match-contagem";
  contagem.hidden = true;
  busca.appendChild(contagem);

  topo.appendChild(busca);
  topo.appendChild(montarResumoPedido(pedido));
  container.appendChild(topo);

  // Lista das parceiras compatíveis (preenchida depois)
  const tituloLista = criarElemento("h3", null, "Parceiras compatíveis");
  tituloLista.id = "match-titulo-lista";
  tituloLista.hidden = true;
  container.appendChild(tituloLista);

  const lista = criarElemento("ul", "match-lista");
  lista.id = "match-lista";
  lista.setAttribute("aria-labelledby", "match-titulo-lista");
  container.appendChild(lista);

  // Espaço para as parceiras descartadas e para mensagens finais
  const extras = criarElemento("div", "match-extras");
  extras.id = "match-extras";
  container.appendChild(extras);

  secao.appendChild(container);
}

// Resumo do pedido em uma lista de definições (<dl>)
function montarResumoPedido(pedido) {
  const cartao = criarElemento("div", "cartao match-resumo");
  cartao.appendChild(criarElemento("h3", null, "Seu pedido"));

  const prazo = PRECOS.prazo[pedido.prazo];
  const linhas = [
    ["Peça", pedido.descricao],
    ["Material", MATERIAIS[pedido.material].nome],
    ["Espessura", formatarEspessura(pedido.espessura)],
    ["Quantidade", formatarNumero(pedido.quantidade) + (pedido.quantidade === 1 ? " peça" : " peças")],
    ["Acabamento", PRECOS.acabamentos[pedido.acabamento].nome],
    ["Prazo", prazo.nome + " · " + pedido.resultado.prazoDiasUteis + " dias úteis"],
    ["Total", formatarReais(pedido.resultado.total)]
  ];
  cartao.appendChild(montarListaDefinicoes(linhas));
  return cartao;
}

// Recebe [[rótulo, valor], ...] e devolve um <dl>
function montarListaDefinicoes(linhas) {
  const dl = criarElemento("dl", "match-dados");
  linhas.forEach(function (linha) {
    const grupo = criarElemento("div");
    grupo.appendChild(criarElemento("dt", null, linha[0]));
    grupo.appendChild(criarElemento("dd", null, linha[1]));
    dl.appendChild(grupo);
  });
  return dl;
}

// -------------------------------------------------------------
// 3. RESULTADO DO FILTRO: cartões aparecendo um por um
// -------------------------------------------------------------
function mostrarResultadoDoFiltro() {
  const compativeis = estadoMatch.filtro.compativeis;
  const descartadas = estadoMatch.filtro.descartadas;

  if (compativeis.length === 0) {
    anunciarMatch("Nenhuma parceira compatível encontrada. Tentando aumentar o valor oferecido...");
    // Sem parceiras, a lista de cartões ficaria vazia: escondemos
    document.getElementById("match-lista").hidden = true;
  } else {
    anunciarMatch("Encontramos " + compativeis.length +
      (compativeis.length === 1 ? " metalúrgica compatível" : " metalúrgicas compatíveis") +
      ". Enviando a oferta...");
    document.getElementById("match-titulo-lista").hidden = false;
  }

  if (descartadas.length > 0) {
    montarDescartadas(descartadas);
  }

  // Um cartão a cada 400 ms (todos de uma vez se o movimento for reduzido)
  const intervalo = tempo(400, 0);
  compativeis.forEach(function (parceira, posicao) {
    agendar(function () {
      adicionarCartaoParceira(parceira);
    }, intervalo * posicao);
  });

  // Depois que todos os cartões apareceram, começa a fase do aceite
  const esperaFinal = intervalo * compativeis.length + tempo(800, 0);
  agendar(function () {
    if (compativeis.length === 0) {
      rodadaSemParceira();
    } else {
      comecarAnalise();
    }
  }, esperaFinal);
}

// Cria o cartão de uma parceira na lista
function adicionarCartaoParceira(parceira) {
  const lista = document.getElementById("match-lista");
  const item = criarElemento("li", "cartao match-parceira");

  const cabeca = criarElemento("div", "match-parceira-topo");
  cabeca.appendChild(criarElemento("h4", null, parceira.nome));
  const selo = criarElemento("span", "match-chip chip-enviada", "Oferta enviada");
  cabeca.appendChild(selo);
  item.appendChild(cabeca);

  const local = criarElemento("p", "match-parceira-local");
  local.innerHTML = ICONES_MATCH.local;
  local.appendChild(document.createTextNode(parceira.cidade + " · " + formatarDistancia(parceira.distanciaKm)));
  item.appendChild(local);

  // A estrela é decorativa; o texto já diz a nota
  const nota = criarElemento("p", "match-parceira-nota");
  const estrela = criarElemento("span", "match-estrela", "★");
  estrela.setAttribute("aria-hidden", "true");
  nota.appendChild(estrela);
  nota.appendChild(document.createTextNode(" Nota " + formatarNumero(parceira.nota, 1) +
    " (" + parceira.avaliacoes + " avaliações)"));
  item.appendChild(nota);

  item.appendChild(criarElemento("p", "texto-suave",
    "Capacidade livre: " + parceira.capacidadeLivre + "% da semana"));
  item.appendChild(criarElemento("p", "texto-suave",
    "Faz: " + nomesDosProcessos(parceira.processos)));

  lista.appendChild(item);
  estadoMatch.cartoes[parceira.id] = selo;
}

// Lista das parceiras descartadas dentro de um <details> (abre e fecha)
function montarDescartadas(descartadas) {
  const extras = document.getElementById("match-extras");
  const detalhes = criarElemento("details", "match-descartadas");
  const textoResumo = descartadas.length === 1
    ? "Ver a parceira descartada e o motivo"
    : "Ver as " + descartadas.length + " parceiras descartadas e o motivo";
  const resumo = criarElemento("summary", null, textoResumo);
  detalhes.appendChild(resumo);

  const lista = criarElemento("ul");
  descartadas.forEach(function (item) {
    const linha = criarElemento("li");
    linha.appendChild(criarElemento("strong", null, item.parceira.nome));
    linha.appendChild(document.createTextNode(" (" + item.parceira.cidade + "): " + item.motivo + "."));
    lista.appendChild(linha);
  });
  detalhes.appendChild(lista);
  extras.appendChild(detalhes);
}

// Troca o texto e o estilo do selo de status de uma parceira
function mudarChip(idParceira, classe, texto) {
  const selo = estadoMatch.cartoes[idParceira];
  if (!selo) return;
  selo.className = "match-chip " + classe;
  selo.textContent = texto;
}

// -------------------------------------------------------------
// 4. ACEITE E TARIFA DINÂMICA
// -------------------------------------------------------------

// Todas as parceiras passam a "analisar" a oferta
function comecarAnalise() {
  estadoMatch.filtro.compativeis.forEach(function (parceira) {
    mudarChip(parceira.id, "chip-analisando", "Analisando…");
  });

  if (deveSimularRecusa() && estadoMatch.rodada === 0) {
    // Modo apresentação: ninguém aceita na 1ª rodada
    anunciarMatch("As metalúrgicas estão analisando a oferta...");
    agendar(function () {
      aumentarValorOferecido();
      agendar(esperarAceite, tempo(2000, 500));
    }, tempo(2500, 500));
  } else {
    esperarAceite();
  }
}

// Sobe o valor oferecido em PRECOS.match.aumentoPorRodada (ex.: +5%)
// O aumento sai da margem da plataforma: o cliente paga o mesmo total.
function aumentarValorOferecido() {
  const aumento = PRECOS.match.aumentoPorRodada;
  estadoMatch.rodada = estadoMatch.rodada + 1;
  const repasseOriginal = estadoMatch.pedido.resultado.repasseParceira;
  estadoMatch.valorOferecido = Math.round(repasseOriginal * (1 + aumento * estadoMatch.rodada) * 100) / 100;
  mostrarValorOferecido();
  anunciarMatch("Ninguém aceitou ainda. Aumentando o valor oferecido em " + formatarPorcentagem(aumento) +
    "... Novo valor: " + formatarReais(estadoMatch.valorOferecido) +
    ". O aumento sai da margem da plataforma: você continua pagando o mesmo total.");
}

// Rodadas quando NENHUMA parceira é compatível (até PRECOS.match.maxRodadas)
function rodadaSemParceira() {
  if (estadoMatch.rodada < PRECOS.match.maxRodadas) {
    aumentarValorOferecido();
    agendar(rodadaSemParceira, tempo(2200, 600));
    return;
  }
  pararRadar();
  mostrarSemParceira();
}

// Mensagem amigável quando ninguém da rede tem a máquina certa
function mostrarSemParceira() {
  anunciarMatch("Nenhuma parceira da rede tem a máquina para este pedido ainda.");
  const extras = document.getElementById("match-extras");
  const caixa = criarElemento("div", "aviso aviso-erro match-sem-parceira");
  caixa.appendChild(criarElemento("p", null,
    "Não foi desta vez. Nenhuma parceira da rede tem a máquina para este pedido ainda. " +
    "Tente outra espessura/material ou acabamento."));
  const botao = criarElemento("button", "botao", "Ajustar orçamento");
  botao.type = "button";
  botao.addEventListener("click", voltarAoOrcamento);
  caixa.appendChild(botao);
  extras.insertBefore(caixa, extras.firstChild);
}

// Espera a parceira escolhida "pensar" e mostra a contagem regressiva
function esperarAceite() {
  const escolhida = escolherParceiraQueAceita(estadoMatch.filtro.compativeis);
  estadoMatch.parceiraEscolhida = escolhida;

  // No máximo 6 segundos; meio segundo se o movimento for reduzido
  const segundos = movimentoReduzido() ? 0.5 : Math.min(escolhida.segundosParaAceitar, 6);
  const totalMs = segundos * 1000;
  const passoMs = 250;

  const area = document.getElementById("match-contagem");
  area.innerHTML = "";
  const texto = criarElemento("p", "match-contagem-texto");
  const barra = criarElemento("progress");
  barra.max = totalMs;
  barra.value = 0;
  barra.setAttribute("aria-label", "Tempo de espera pela resposta das metalúrgicas");
  area.appendChild(texto);
  area.appendChild(barra);
  area.hidden = false;

  // Atualiza a barra e o texto a cada 250 ms
  function atualizar(passado) {
    barra.value = passado;
    const restante = Math.max(0, Math.ceil((totalMs - passado) / 1000));
    texto.textContent = "Esperando a primeira resposta… " + restante + " s";
    if (passado < totalMs) {
      agendar(function () {
        atualizar(passado + passoMs);
      }, passoMs);
    } else {
      confirmarAceite(escolhida);
    }
  }
  atualizar(0);
}

// A parceira aceitou: atualiza os cartões e, depois, mostra o pedido
function confirmarAceite(escolhida) {
  pararRadar();
  document.getElementById("match-contagem").hidden = true;

  estadoMatch.filtro.compativeis.forEach(function (parceira) {
    if (parceira.id === escolhida.id) {
      mudarChip(parceira.id, "chip-aceitou", "Aceitou! ✓");
    } else {
      mudarChip(parceira.id, "chip-encerrada", "Oferta encerrada");
    }
  });

  anunciarMatch(escolhida.nome + " aceitou o pedido! Confirmando...");
  agendar(mostrarPedido, 1200);
}

// Para a animação do radar
function pararRadar() {
  const radar = document.getElementById("match-radar");
  if (radar) radar.classList.add("parado");
}

// -------------------------------------------------------------
// 5. PEDIDO CONFIRMADO + LINHA DO TEMPO
// -------------------------------------------------------------
function mostrarPedido() {
  const pedido = estadoMatch.pedido;
  const parceira = estadoMatch.parceiraEscolhida;
  const resultado = pedido.resultado;
  const secao = document.getElementById("secao-pedido");
  secao.innerHTML = "";

  const container = criarElemento("div", "container");
  container.appendChild(criarElemento("span", "sobrelinha", "Passo 3 · Pedido"));
  const titulo = criarElemento("h2", null, "Pedido confirmado!");
  titulo.id = "titulo-pedido";
  titulo.tabIndex = -1;
  container.appendChild(titulo);

  container.appendChild(criarElemento("p", "texto-grande",
    "Pedido " + gerarNumeroPedido() + " aceito pela " + parceira.nome +
    " (" + parceira.cidade + ", a " + formatarDistancia(parceira.distanciaKm) + ")."));

  const grade = criarElemento("div", "grade grade-2 pedido-grade");

  // Cartão com os valores
  const entrega = somarDiasUteis(new Date(), resultado.prazoDiasUteis);
  const dataEntrega = entrega.toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });
  const valores = criarElemento("div", "cartao cartao-destaque");
  valores.appendChild(criarElemento("h3", null, "Resumo"));
  valores.appendChild(montarListaDefinicoes([
    ["Peça", pedido.descricao],
    ["Total pago (simulado)", formatarReais(resultado.total)],
    ["Preço por peça", formatarReais(resultado.precoPorPeca)],
    ["Repasse à metalúrgica", formatarReais(estadoMatch.valorOferecido)],
    ["Prazo", resultado.prazoDiasUteis + " dias úteis"],
    ["Entrega estimada", dataEntrega]
  ]));
  valores.appendChild(criarElemento("p", "selo selo-ficticio",
    "Simulação: nenhum pagamento foi feito."));
  grade.appendChild(valores);

  // Cartão com a linha do tempo
  const acompanhamento = criarElemento("div", "cartao");
  acompanhamento.appendChild(criarElemento("h3", null, "Acompanhe o pedido"));
  const linhaDoTempo = criarElemento("ol", "linha-tempo");
  linhaDoTempo.id = "linha-tempo";
  acompanhamento.appendChild(linhaDoTempo);

  const statusPedido = criarElemento("p", "visualmente-oculto");
  statusPedido.id = "pedido-status";
  statusPedido.setAttribute("role", "status");
  statusPedido.setAttribute("aria-live", "polite");
  acompanhamento.appendChild(statusPedido);

  const fim = criarElemento("div", "aviso aviso-sucesso pedido-fim");
  fim.id = "pedido-fim";
  fim.hidden = true;
  fim.appendChild(criarElemento("p", null,
    "Peças entregues! Na vida real, agora você avaliaria a metalúrgica " +
    "e a nota ajudaria outros clientes a escolher."));
  acompanhamento.appendChild(fim);

  const botoes = criarElemento("div", "grupo-botoes");
  const botaoAvancar = criarElemento("button", "botao", "Avançar status");
  botaoAvancar.type = "button";
  botaoAvancar.id = "botao-avancar";
  botaoAvancar.addEventListener("click", avancarStatus);
  const botaoNovo = criarElemento("button", "botao botao-secundario", "Fazer novo orçamento");
  botaoNovo.type = "button";
  botaoNovo.addEventListener("click", voltarAoOrcamento);
  botoes.appendChild(botaoAvancar);
  botoes.appendChild(botaoNovo);
  acompanhamento.appendChild(botoes);

  grade.appendChild(acompanhamento);
  container.appendChild(grade);
  secao.appendChild(container);

  // Começa com "Pedido confirmado" concluído e "Na fila" em andamento
  estadoMatch.etapaAtual = 1;
  desenharLinhaDoTempo();

  secao.hidden = false;
  focarTitulo("titulo-pedido", secao);
}

// A etapa "Dobra" não se aplica se a peça não tem dobras
function etapaNaoSeAplica(indice) {
  // Number(...) garante a comparação mesmo se as dobras chegarem como texto ("0")
  return ETAPAS_PEDIDO[indice] === "Dobra" && Number(estadoMatch.pedido.dobras) === 0;
}

// Desenha (de novo) a linha do tempo conforme a etapa atual
function desenharLinhaDoTempo() {
  const lista = document.getElementById("linha-tempo");
  lista.innerHTML = "";
  const ultima = ETAPAS_PEDIDO.length - 1;
  const entregue = estadoMatch.etapaAtual === ultima;

  ETAPAS_PEDIDO.forEach(function (nome, indice) {
    let estado; // "concluido", "andamento", "aguardando" ou "pulado"
    if (etapaNaoSeAplica(indice)) {
      estado = "pulado";
    } else if (indice < estadoMatch.etapaAtual || entregue) {
      estado = "concluido";
    } else if (indice === estadoMatch.etapaAtual) {
      estado = "andamento";
    } else {
      estado = "aguardando";
    }

    const textos = {
      concluido: "Concluído",
      andamento: "Em andamento",
      aguardando: "Aguardando",
      pulado: "Não se aplica"
    };
    const icones = {
      concluido: ICONES_MATCH.check,
      andamento: ICONES_MATCH.relogio,
      aguardando: ICONES_MATCH.espera,
      pulado: ICONES_MATCH.pular
    };

    const item = criarElemento("li", "etapa etapa-" + estado);
    if (estado === "andamento" || (entregue && indice === ultima)) {
      item.setAttribute("aria-current", "step");
    }
    const marcador = criarElemento("span", "etapa-marcador");
    marcador.innerHTML = icones[estado];
    item.appendChild(marcador);

    const textoEtapa = criarElemento("span", "etapa-texto");
    textoEtapa.appendChild(criarElemento("strong", null, nome));
    textoEtapa.appendChild(criarElemento("span", "etapa-estado", textos[estado]));
    item.appendChild(textoEtapa);
    lista.appendChild(item);
  });
}

// Botão "Avançar status": vai para a próxima etapa (pulando a que não se aplica)
function avancarStatus() {
  const ultima = ETAPAS_PEDIDO.length - 1;
  if (estadoMatch.etapaAtual >= ultima) return;

  let proxima = estadoMatch.etapaAtual + 1;
  if (etapaNaoSeAplica(proxima)) {
    proxima = proxima + 1;
  }
  estadoMatch.etapaAtual = proxima;
  desenharLinhaDoTempo();

  document.getElementById("pedido-status").textContent =
    "Status atualizado: " + ETAPAS_PEDIDO[proxima];

  if (proxima === ultima) {
    const botao = document.getElementById("botao-avancar");
    botao.disabled = true;
    botao.textContent = "Pedido entregue";
    document.getElementById("pedido-fim").hidden = false;
  }
}

// -------------------------------------------------------------
// 6. RECOMEÇAR: esconde o match e o pedido e volta ao formulário
// -------------------------------------------------------------
function voltarAoOrcamento() {
  cancelarTemporizadores();
  document.getElementById("secao-match").hidden = true;
  document.getElementById("secao-pedido").hidden = true;

  // Função de js/orcamento.js (reativa o botão e foca o título do orçamento)
  if (typeof reabilitarOrcamento === "function") {
    reabilitarOrcamento();
  }

  const secaoOrcamento = document.getElementById("secao-orcamento");
  const comportamento = movimentoReduzido() ? "auto" : "smooth";
  if (secaoOrcamento) {
    secaoOrcamento.scrollIntoView({ behavior: comportamento, block: "start" });
  } else {
    window.scrollTo({ top: 0, behavior: comportamento });
  }
}
