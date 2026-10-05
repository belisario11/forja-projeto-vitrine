// =============================================================
// PÁGINA DE ORÇAMENTO
// Liga o formulário ao cálculo do preço e mostra tudo na tela.
//
// Usa funções de outros arquivos (carregados antes deste):
//   js/comum.js   -> formatarReais, formatarNumero, formatarEspessura
//   js/calculo.js -> calcularOrcamento, acabamentoPermitido
//   js/pecas.js   -> PECAS_MODELO, validarMedidasPeca, medidasPadrao
//   js/dxf.js     -> carregarBibliotecaDXF, lerArquivoDXF, analisarDXF
//   js/match.js   -> iniciarMatch (chamada no botão "Fazer pedido")
//
// Este arquivo cria a função global reabilitarOrcamento(), que o
// js/match.js chama quando o cliente clica em "Fazer novo orçamento".
// =============================================================

// ---------- Estado da página (o que está escolhido agora) ----------
const estadoOrcamento = {
  modo: "modelo",          // "modelo" (peças-modelo) ou "dxf" (desenho enviado)
  peca: "placa",           // chave da peça-modelo escolhida (ver js/pecas.js)
  dxf: null,               // resultado da leitura do DXF: { nomeArquivo, analise }
  leituraAtual: 0,         // número da leitura de arquivo mais recente
  resultado: null,         // último resultado de calcularOrcamento()
  entrada: null,           // dados usados no último cálculo
  descricao: "",           // texto do pedido, ex.: "20 × Suporte em L"
  pedidoEmAndamento: false // true enquanto a simulação do match está rodando
};

// Referências aos elementos da página (preenchidas em iniciarPagina)
const tela = {};

// Mensagem mostrada quando a página foi aberta com dois cliques (file://)
const MENSAGEM_ARQUIVO_LOCAL =
  "O navegador não deixa carregar o arquivo de exemplo quando a página é aberta direto do computador (endereço começando com file://). " +
  "Rode \"python -m http.server 8000\" na pasta do site e abra http://localhost:8000, " +
  "ou baixe o arquivo de exemplo e envie pelo botão \"Escolher arquivo .dxf\".";

// Quem pediu menos animação no sistema também não recebe rolagem suave
function querMenosMovimento() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// "1 dia útil" ou "4 dias úteis"
function textoDias(dias) {
  return dias === 1 ? "1 dia útil" : dias + " dias úteis";
}

// =============================================================
// 1) PEÇAS-MODELO
// =============================================================

// Cria os cartões de escolha das peças a partir de PECAS_MODELO
function montarCartoesPecas() {
  Object.keys(PECAS_MODELO).forEach(function (chave) {
    const peca = PECAS_MODELO[chave];

    const cartao = document.createElement("label");
    cartao.className = "cartao-peca";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "peca";
    radio.value = chave;
    radio.checked = chave === estadoOrcamento.peca;

    const icone = document.createElement("span");
    icone.className = "icone";
    icone.innerHTML = peca.icone; // SVG fixo, escrito em js/pecas.js

    const nome = document.createElement("span");
    nome.className = "cartao-peca-nome";
    nome.textContent = peca.nome;

    const descricao = document.createElement("span");
    descricao.className = "cartao-peca-descricao";
    descricao.textContent = peca.descricao;

    cartao.appendChild(radio);
    cartao.appendChild(icone);
    cartao.appendChild(nome);
    cartao.appendChild(descricao);
    tela.listaPecas.appendChild(cartao);

    radio.addEventListener("change", function () {
      if (radio.checked) escolherPeca(chave);
    });
  });
}

// Troca a peça-modelo: ajusta rótulos, limites e valores dos campos
function escolherPeca(chave) {
  estadoOrcamento.peca = chave;
  const peca = PECAS_MODELO[chave];
  const padrao = medidasPadrao(chave);

  CAMPOS_PECA.forEach(function (nome) {
    const regra = peca.campos[nome];
    const grupo = document.getElementById("grupo-" + nome);
    const input = document.getElementById("medida-" + nome);

    if (!regra) {
      // Campo não usado por esta peça (ex.: a flange não tem "altura")
      grupo.hidden = true;
      input.disabled = true;
      return;
    }
    grupo.hidden = false;
    input.disabled = false;
    document.getElementById("rotulo-" + nome).textContent = regra.rotulo;
    input.min = regra.min;
    input.max = regra.max;
    input.value = padrao[nome];

    // Texto de ajuda: explicação da peça (se houver) + limites
    const limites = "De " + regra.min + " a " + regra.max + ".";
    document.getElementById("ajuda-" + nome).textContent = regra.ajuda ? regra.ajuda + " " + limites : limites;
  });

  // Marca o cartão escolhido (classe usada no CSS)
  tela.listaPecas.querySelectorAll(".cartao-peca").forEach(function (cartao) {
    const radio = cartao.querySelector("input");
    cartao.classList.toggle("selecionada", radio.checked);
  });

  // Cada peça já sabe quantas dobras tem
  tela.dobras.value = peca.dobrasPadrao;

  atualizar();
}

// Lê o que está digitado nos campos de medida (ainda sem validar)
function lerMedidasDigitadas() {
  const medidas = {};
  CAMPOS_PECA.forEach(function (nome) {
    medidas[nome] = document.getElementById("medida-" + nome).value;
  });
  return medidas;
}

// Quando o usuário sai do campo, grava nele o valor corrigido
function corrigirCamposMedidas() {
  const validacao = validarMedidasPeca(estadoOrcamento.peca, lerMedidasDigitadas());
  CAMPOS_PECA.forEach(function (nome) {
    if (validacao.medidas[nome] !== undefined) {
      document.getElementById("medida-" + nome).value = validacao.medidas[nome];
    }
  });
  atualizar();
}

// Mostra as mensagens de ajuste das medidas (só mexe na tela se o texto mudou)
function mostrarAvisosMedidas(avisos) {
  const texto = avisos.join(" ");
  if (tela.avisosMedidas.dataset.texto === texto) return;
  tela.avisosMedidas.dataset.texto = texto;
  tela.avisosMedidas.innerHTML = "";
  avisos.forEach(function (aviso) {
    const p = document.createElement("p");
    p.className = "ajuda";
    p.textContent = "Ajuste: " + aviso;
    tela.avisosMedidas.appendChild(p);
  });
}

// =============================================================
// 2) ABAS: PEÇAS-MODELO OU DESENHO DXF
// =============================================================
function trocarModo(modo) {
  estadoOrcamento.modo = modo;
  const ehModelo = modo === "modelo";

  tela.abaModelo.setAttribute("aria-selected", String(ehModelo));
  tela.abaDxf.setAttribute("aria-selected", String(!ehModelo));
  // Só a aba ativa entra na ordem do Tab; as setas trocam entre elas
  tela.abaModelo.tabIndex = ehModelo ? 0 : -1;
  tela.abaDxf.tabIndex = ehModelo ? -1 : 0;
  tela.painelModelo.hidden = !ehModelo;
  tela.painelDxf.hidden = ehModelo;

  // Dobras: a peça-modelo já sabe as dela; no DXF começamos com 0
  tela.dobras.value = ehModelo ? PECAS_MODELO[estadoOrcamento.peca].dobrasPadrao : 0;

  atualizar();
}

function configurarAbas() {
  const abas = [tela.abaModelo, tela.abaDxf];
  const modos = ["modelo", "dxf"];

  abas.forEach(function (aba, indice) {
    aba.addEventListener("click", function () {
      trocarModo(modos[indice]);
    });

    // Teclado: setas esquerda/direita, Home e End
    aba.addEventListener("keydown", function (evento) {
      let novo = -1;
      if (evento.key === "ArrowRight" || evento.key === "ArrowLeft") {
        novo = indice === 0 ? 1 : 0; // só existem duas abas
      } else if (evento.key === "Home") {
        novo = 0;
      } else if (evento.key === "End") {
        novo = 1;
      }
      if (novo >= 0) {
        evento.preventDefault();
        trocarModo(modos[novo]);
        abas[novo].focus();
      }
    });
  });
}

// =============================================================
// 3) OPÇÕES: MATERIAL, ESPESSURA, ACABAMENTO
// =============================================================
function montarMateriais() {
  Object.keys(MATERIAIS).forEach(function (chave) {
    const opcao = document.createElement("option");
    opcao.value = chave;
    opcao.textContent = MATERIAIS[chave].nome;
    tela.material.appendChild(opcao);
  });
}

// Refaz a lista de espessuras do material escolhido.
// Mantém a espessura anterior se ela existir no novo material;
// se não existir, escolhe a mais próxima.
function atualizarEspessuras() {
  const anterior = parseFloat(tela.espessura.value) || 2;
  const espessuras = MATERIAIS[tela.material.value].espessuras;

  let escolhida = espessuras[0];
  espessuras.forEach(function (mm) {
    if (Math.abs(mm - anterior) < Math.abs(escolhida - anterior)) escolhida = mm;
  });

  tela.espessura.innerHTML = "";
  espessuras.forEach(function (mm) {
    const opcao = document.createElement("option");
    opcao.value = String(mm);
    opcao.textContent = formatarEspessura(mm);
    tela.espessura.appendChild(opcao);
  });
  tela.espessura.value = String(escolhida);
}

// Texto "(só aço carbono)" a partir da lista de materiais do acabamento
function textoRestricaoAcabamento(acabamento) {
  const todos = Object.keys(MATERIAIS);
  if (acabamento.materiais.length >= todos.length) return "";
  const nomes = acabamento.materiais.map(function (chave) {
    return MATERIAIS[chave].nome.toLowerCase();
  });
  return "(só " + nomes.join(" e ") + ")";
}

// Texto do preço do acabamento, ex.: "R$ 45,00 por m²"
function textoPrecoAcabamento(acabamento) {
  if (acabamento.valor <= 0) return "sem custo extra";
  const unidade = acabamento.unidade === "kg" ? "por kg" : "por m² (duas faces)";
  return formatarReais(acabamento.valor) + " " + unidade;
}

// Cria os rádios de acabamento a partir de PRECOS.acabamentos
function montarAcabamentos() {
  Object.keys(PRECOS.acabamentos).forEach(function (chave) {
    const acabamento = PRECOS.acabamentos[chave];

    const rotulo = document.createElement("label");
    rotulo.className = "orc-radio";
    rotulo.dataset.acabamento = chave;

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "acabamento";
    radio.value = chave;
    radio.checked = chave === "nenhum";

    const textos = document.createElement("span");
    const nome = document.createElement("strong");
    nome.textContent = acabamento.nome;
    const detalhe = document.createElement("span");
    detalhe.className = "ajuda";
    detalhe.textContent = textoPrecoAcabamento(acabamento);
    const restricao = document.createElement("span");
    restricao.className = "ajuda orc-restricao";
    restricao.textContent = textoRestricaoAcabamento(acabamento);

    textos.appendChild(nome);
    textos.appendChild(detalhe);
    if (restricao.textContent) textos.appendChild(restricao);
    rotulo.appendChild(radio);
    rotulo.appendChild(textos);
    tela.listaAcabamentos.appendChild(rotulo);
  });
}

// Liga/desliga cada acabamento conforme o material.
// Se o escolhido deixou de valer, volta para "nenhum" e avisa.
function atualizarAcabamentos() {
  const material = tela.material.value;
  let trocou = "";

  tela.listaAcabamentos.querySelectorAll(".orc-radio").forEach(function (rotulo) {
    const radio = rotulo.querySelector("input");
    const permitido = acabamentoPermitido(material, radio.value);
    if (!permitido && radio.checked) {
      trocou = PRECOS.acabamentos[radio.value].nome;
      radio.checked = false;
    }
    radio.disabled = !permitido;
    rotulo.classList.toggle("indisponivel", !permitido);
  });

  if (trocou) {
    tela.listaAcabamentos.querySelector('input[value="nenhum"]').checked = true;
    tela.anuncioOpcoes.textContent = trocou + " não está disponível para " + MATERIAIS[material].nome +
      ". Trocamos o acabamento para \"Nenhum\".";
  }
  marcarRadiosSelecionados();
}

// Pinta a borda do rádio escolhido (a bolinha marcada continua visível)
function marcarRadiosSelecionados() {
  document.querySelectorAll(".orc-radio").forEach(function (rotulo) {
    rotulo.classList.toggle("selecionada", rotulo.querySelector("input").checked);
  });
}

// Lê um número inteiro de um campo, preso entre mínimo e máximo
function lerInteiro(input, minimo, maximo, padrao) {
  let valor = Math.round(parseFloat(input.value));
  if (isNaN(valor)) valor = padrao;
  if (valor < minimo) valor = minimo;
  if (valor > maximo) valor = maximo;
  return valor;
}

// Junta todas as opções comuns aos dois modos
function lerOpcoes() {
  return {
    material: tela.material.value,
    espessura: parseFloat(tela.espessura.value),
    quantidade: lerInteiro(tela.quantidade, 1, 1000, 1),
    dobras: lerInteiro(tela.dobras, 0, 10, 0),
    acabamento: document.querySelector('input[name="acabamento"]:checked').value,
    prazo: document.querySelector('input[name="prazo"]:checked').value
  };
}

// Mostra embaixo do campo quando o número digitado foi corrigido
function avisarCorrecao(input, ajuda, textoBase, valorUsado) {
  const digitado = parseFloat(input.value);
  if (input.value !== "" && digitado === valorUsado) {
    ajuda.textContent = textoBase;
  } else {
    ajuda.textContent = textoBase + " Usamos " + valorUsado + ".";
  }
}

// =============================================================
// 4) CÁLCULO E RESULTADO (roda a cada mudança no formulário)
// =============================================================
function atualizar() {
  const opcoes = lerOpcoes();
  avisarCorrecao(tela.quantidade, tela.ajudaQuantidade, "De 1 a 1000 peças.", opcoes.quantidade);
  avisarCorrecao(tela.dobras, tela.ajudaDobras, "De 0 a 10. Cada dobra é feita na dobradeira.", opcoes.dobras);
  marcarRadiosSelecionados();

  // --- Geometria da peça: vem da peça-modelo ou do DXF ---
  let geometria = null;
  if (estadoOrcamento.modo === "modelo") {
    const peca = PECAS_MODELO[estadoOrcamento.peca];
    const validacao = validarMedidasPeca(estadoOrcamento.peca, lerMedidasDigitadas());
    mostrarAvisosMedidas(validacao.avisos);
    geometria = peca.geometria(validacao.medidas);
    tela.previaDesenho.innerHTML = peca.desenharSVG(validacao.medidas);
    // Peças com dobra aparecem planificadas (chapa reta, antes de dobrar)
    if (peca.dobrasPadrao > 0) {
      tela.previaLegenda.textContent = "Chapa planificada (antes das dobras), desenhada em proporção. Medidas em milímetros.";
    } else {
      tela.previaLegenda.textContent = "Peça desenhada em proporção. Medidas em milímetros.";
    }
    estadoOrcamento.descricao = opcoes.quantidade + " × " + peca.nome;
  } else if (estadoOrcamento.dxf) {
    const analise = estadoOrcamento.dxf.analise;
    geometria = { areaM2: analise.areaM2, corteM: analise.corteM, perfuracoes: analise.perfuracoes };
    tela.previaDesenho.innerHTML = analise.svg; // SVG gerado pelo js/dxf.js
    tela.previaLegenda.textContent = "Desenho lido do arquivo " + estadoOrcamento.dxf.nomeArquivo + ".";
    estadoOrcamento.descricao = opcoes.quantidade + " × peça do arquivo " + estadoOrcamento.dxf.nomeArquivo;
  } else {
    tela.previaDesenho.innerHTML = '<p class="previa-vazia">Envie um arquivo DXF para ver o desenho aqui.</p>';
    tela.previaLegenda.textContent = "Nenhum desenho enviado ainda.";
  }

  if (!geometria) {
    mostrarErroResultado("");
    mostrarSemResultado("Envie um desenho DXF (ou use o arquivo de exemplo) para calcular o preço.");
    return;
  }

  // --- Preço: a fórmula fica em js/calculo.js ---
  const entrada = {
    material: opcoes.material,
    espessura: opcoes.espessura,
    quantidade: opcoes.quantidade,
    dobras: opcoes.dobras,
    acabamento: opcoes.acabamento,
    prazo: opcoes.prazo,
    geometria: geometria
  };

  try {
    const resultado = calcularOrcamento(entrada);
    if (!isFinite(resultado.total) || resultado.total <= 0) {
      throw new Error("O cálculo não chegou a um valor válido. Confira as medidas.");
    }
    estadoOrcamento.resultado = resultado;
    estadoOrcamento.entrada = entrada;
    mostrarResultado(resultado);
  } catch (erro) {
    mostrarSemResultado("Não conseguimos calcular: " + erro.message);
    mostrarErroResultado(erro.message);
  }
}

// Preenche o painel com o resultado do cálculo
function mostrarResultado(resultado) {
  mostrarErroResultado("");
  tela.resumo.classList.remove("sem-resultado");
  tela.total.textContent = formatarReais(resultado.total);
  tela.totalTabela.textContent = formatarReais(resultado.total);
  tela.porPeca.textContent = formatarReais(resultado.precoPorPeca);
  tela.prazo.textContent = textoDias(resultado.prazoDiasUteis);

  // Parte da metalúrgica e parte da plataforma (as duas somam o total)
  tela.repasse.textContent = "A metalúrgica recebe: " + formatarReais(resultado.repasseParceira) +
    " · Plataforma: " + formatarReais(resultado.margem);

  // Tabela de detalhamento, uma linha por item
  tela.itens.innerHTML = "";
  resultado.itens.forEach(function (item) {
    const linha = document.createElement("tr");
    if (item.chave === "margem") linha.className = "orc-linha-margem";

    const celulaItem = document.createElement("th");
    celulaItem.scope = "row";
    celulaItem.textContent = item.rotulo;
    const detalhe = document.createElement("span");
    detalhe.className = "orc-item-detalhe";
    detalhe.textContent = item.detalhe;
    celulaItem.appendChild(detalhe);

    const celulaValor = document.createElement("td");
    celulaValor.className = "orc-col-valor";
    celulaValor.textContent = formatarReais(item.valor);

    linha.appendChild(celulaItem);
    linha.appendChild(celulaValor);
    tela.itens.appendChild(linha);
  });

  anunciarTotal("Total " + formatarReais(resultado.total) + ", " + formatarReais(resultado.precoPorPeca) +
    " por peça, prazo de " + textoDias(resultado.prazoDiasUteis) + ".");
  atualizarBotaoPedido();
}

// Painel sem preço (falta o desenho ou houve erro).
// Não mexe na caixa de erro: quem chama decide se mostra ou limpa o erro.
function mostrarSemResultado(mensagem) {
  estadoOrcamento.resultado = null;
  estadoOrcamento.entrada = null;
  tela.resumo.classList.add("sem-resultado");
  tela.total.textContent = "—";
  tela.totalTabela.textContent = "—";
  tela.porPeca.textContent = "—";
  tela.prazo.textContent = "—";
  tela.repasse.textContent = "";
  tela.itens.innerHTML = "";
  const linha = document.createElement("tr");
  const celula = document.createElement("td");
  celula.colSpan = 2;
  celula.textContent = mensagem;
  linha.appendChild(celula);
  tela.itens.appendChild(linha);
  anunciarTotal("");
  atualizarBotaoPedido();
}

// Caixa de erro no painel do resultado (texto vazio = esconde)
function mostrarErroResultado(mensagem) {
  if (tela.resultadoErro.dataset.texto === mensagem) return; // evita repetir o alerta
  tela.resultadoErro.dataset.texto = mensagem;
  tela.resultadoErro.innerHTML = "";
  if (!mensagem) return;

  const caixa = document.createElement("div");
  caixa.className = "aviso aviso-erro";
  caixa.setAttribute("role", "alert");
  const p = document.createElement("p");
  const forte = document.createElement("strong");
  forte.textContent = "Erro: ";
  p.appendChild(forte);
  p.appendChild(document.createTextNode(mensagem));
  caixa.appendChild(p);
  tela.resultadoErro.appendChild(caixa);
}

// Leitores de tela ouvem o total só quando o usuário para de mexer
// (evita ler o preço a cada tecla digitada)
let temporizadorAnuncio = null;
function anunciarTotal(texto) {
  clearTimeout(temporizadorAnuncio);
  temporizadorAnuncio = setTimeout(function () {
    tela.anuncioTotal.textContent = texto;
  }, 900);
}

// O botão "Fazer pedido" só funciona com um preço válido e sem pedido rodando
function atualizarBotaoPedido() {
  tela.botaoPedido.disabled = !estadoOrcamento.resultado || estadoOrcamento.pedidoEmAndamento;
  tela.botaoPedidoTexto.textContent = estadoOrcamento.pedidoEmAndamento ? "Pedido em andamento…" : "Fazer pedido";
  atualizarBarraTotal();
}

// =============================================================
// BARRA FIXA DO TOTAL (só no celular)
// No celular o painel "Seu orçamento" fica lá embaixo da página.
// Enquanto ele está fora da tela, uma barra presa no rodapé mostra
// o total. O CSS esconde a barra em telas grandes (≥ 960px).
// =============================================================
let resumoNaTela = true; // o total do painel está visível agora?

// Atualiza o texto da barra e decide se ela aparece
function atualizarBarraTotal() {
  if (!tela.barra) return; // a barra ainda não foi configurada

  const resultado = estadoOrcamento.resultado;
  if (resultado) {
    tela.barraValor.textContent = formatarReais(resultado.total);
    tela.barraDetalhe.textContent = formatarReais(resultado.precoPorPeca) + " por peça · " +
      textoDias(resultado.prazoDiasUteis);
  } else {
    tela.barraValor.textContent = "—";
    tela.barraDetalhe.textContent = "Complete os dados da peça";
  }

  // Some quando o painel já está na tela ou quando há um pedido em andamento
  tela.barra.hidden = resumoNaTela || estadoOrcamento.pedidoEmAndamento;
  // Espaço extra no fim da página para a barra não cobrir o rodapé
  document.body.classList.toggle("com-barra-total", !tela.barra.hidden);
}

function configurarBarraTotal() {
  tela.barra = document.getElementById("barra-total");
  tela.barraValor = document.getElementById("barra-total-valor");
  tela.barraDetalhe = document.getElementById("barra-total-detalhe");

  // IntersectionObserver avisa quando um elemento entra ou sai da tela
  if ("IntersectionObserver" in window) {
    const observador = new IntersectionObserver(function (entradas) {
      resumoNaTela = entradas[0].isIntersecting;
      atualizarBarraTotal();
    });
    observador.observe(tela.resumo);
  }

  // "Ver orçamento": rola até o painel e leva o foco do teclado para ele
  document.getElementById("barra-total-link").addEventListener("click", function (evento) {
    evento.preventDefault();
    const titulo = document.getElementById("titulo-resultado");
    titulo.scrollIntoView({ behavior: querMenosMovimento() ? "auto" : "smooth", block: "start" });
    titulo.focus({ preventScroll: true });
  });
}

// =============================================================
// 5) DESENHO DXF
// =============================================================

// Mostra "Lendo o desenho…" e limpa erro/resultado anteriores
function mostrarCarregandoDXF() {
  tela.dxfErro.innerHTML = "";
  tela.dxfResultado.hidden = true;
  tela.dxfEstado.innerHTML = '<p class="orc-carregando">Lendo o desenho…</p>';
  tela.botaoExemplo.disabled = true;
}

// Caixa de erro do DXF, com botão para voltar às peças-modelo
function mostrarErroDXF(mensagem) {
  estadoOrcamento.dxf = null;
  tela.dxfEstado.innerHTML = "";
  tela.dxfResultado.hidden = true;
  tela.botaoExemplo.disabled = false;
  tela.dxfErro.innerHTML = "";

  const caixa = document.createElement("div");
  caixa.className = "aviso aviso-erro";
  caixa.setAttribute("role", "alert");

  const p = document.createElement("p");
  const forte = document.createElement("strong");
  forte.textContent = "Não conseguimos usar esse desenho. ";
  p.appendChild(forte);
  p.appendChild(document.createTextNode(mensagem));

  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "botao botao-secundario";
  botao.textContent = "Usar peças-modelo";
  botao.addEventListener("click", function () {
    trocarModo("modelo");
    tela.abaModelo.focus();
  });

  caixa.appendChild(p);
  caixa.appendChild(botao);
  tela.dxfErro.appendChild(caixa);
  atualizar();
}

// Cria um item "rótulo: valor" na lista de dados do DXF
function adicionarDado(lista, rotulo, valor) {
  const item = document.createElement("div");
  const dt = document.createElement("dt");
  dt.textContent = rotulo;
  const dd = document.createElement("dd");
  dd.textContent = valor;
  item.appendChild(dt);
  item.appendChild(dd);
  lista.appendChild(item);
}

// Nomes amigáveis dos tipos de entidade do DXF
const NOMES_ENTIDADES = {
  LINE: "linhas",
  ARC: "arcos",
  CIRCLE: "círculos",
  LWPOLYLINE: "polilinhas",
  POLYLINE: "polilinhas antigas",
  ignoradas: "ignoradas"
};

// Mostra o que foi lido do arquivo
function mostrarResultadoDXF(nomeArquivo, analise) {
  // Aviso curto para leitores de tela (a área dxf-estado tem aria-live)
  tela.dxfEstado.innerHTML = "";
  const anuncio = document.createElement("p");
  anuncio.className = "visualmente-oculto";
  anuncio.textContent = "Desenho " + nomeArquivo + " lido com sucesso. O preço foi atualizado.";
  tela.dxfEstado.appendChild(anuncio);
  tela.dxfErro.innerHTML = "";
  tela.botaoExemplo.disabled = false;
  tela.dxfResultado.innerHTML = "";

  const titulo = document.createElement("h3");
  titulo.textContent = "Desenho lido: " + nomeArquivo;
  tela.dxfResultado.appendChild(titulo);

  const lista = document.createElement("dl");
  lista.className = "orc-dados-dxf";
  adicionarDado(lista, "Comprimento de corte", formatarNumero(analise.corteM, 2) + " m");
  adicionarDado(lista, "Contornos fechados (perfurações)", String(analise.perfuracoes));
  adicionarDado(lista, "Retângulo envolvente", formatarNumero(analise.larguraMm, 1) + " × " +
    formatarNumero(analise.alturaMm, 1) + " mm");
  adicionarDado(lista, "Área da chapa", formatarNumero(analise.areaM2, 3) + " m²");

  // Contagem de entidades: "4 linhas · 2 arcos · 1 círculo..."
  const partes = [];
  const contagem = analise.contagem || {};
  Object.keys(contagem).forEach(function (tipo) {
    if (!contagem[tipo]) return; // não mostra tipos com zero
    if (tipo === "ignoradas") {
      partes.push(contagem[tipo] + " ignoradas");
      return;
    }
    const nome = NOMES_ENTIDADES[tipo] || tipo;
    partes.push(contagem[tipo] + " " + nome + " (" + tipo + ")");
  });
  if (partes.length === 0) partes.push("—");
  adicionarDado(lista, "Entidades encontradas", partes.join(" · "));
  tela.dxfResultado.appendChild(lista);

  // Avisos da leitura (ex.: entidades ignoradas)
  if (analise.avisos && analise.avisos.length > 0) {
    const caixa = document.createElement("div");
    caixa.className = "aviso";
    const p = document.createElement("p");
    p.innerHTML = "<strong>Atenção:</strong>";
    const ul = document.createElement("ul");
    ul.className = "orc-dxf-avisos";
    analise.avisos.forEach(function (aviso) {
      const li = document.createElement("li");
      li.textContent = aviso;
      ul.appendChild(li);
    });
    caixa.appendChild(p);
    caixa.appendChild(ul);
    tela.dxfResultado.appendChild(caixa);
  }

  const dica = document.createElement("p");
  dica.className = "ajuda";
  dica.textContent = "Se a peça tiver dobras, informe quantas no campo \"Número de dobras por peça\".";
  tela.dxfResultado.appendChild(dica);

  tela.dxfResultado.hidden = false;
}

// Analisa o texto de um DXF (do arquivo enviado ou do exemplo)
async function analisarTextoDXF(texto, nomeArquivo, numeroLeitura) {
  if (typeof carregarBibliotecaDXF !== "function" || typeof analisarDXF !== "function") {
    throw new Error("O leitor de DXF (js/dxf.js) não foi carregado. Recarregue a página ou use as peças-modelo.");
  }
  await carregarBibliotecaDXF();
  const analise = analisarDXF(texto);

  // Se o usuário já escolheu outro arquivo enquanto este carregava, ignora este
  if (numeroLeitura !== estadoOrcamento.leituraAtual) return;

  estadoOrcamento.dxf = { nomeArquivo: nomeArquivo, analise: analise };
  mostrarResultadoDXF(nomeArquivo, analise);
  atualizar();
}

// Arquivo escolhido no botão ou arrastado para a zona
async function processarArquivo(arquivo) {
  if (!arquivo) return;
  estadoOrcamento.leituraAtual = estadoOrcamento.leituraAtual + 1;
  const numeroLeitura = estadoOrcamento.leituraAtual;
  mostrarCarregandoDXF();

  try {
    if (typeof lerArquivoDXF !== "function") {
      throw new Error("O leitor de DXF (js/dxf.js) não foi carregado. Recarregue a página ou use as peças-modelo.");
    }
    const texto = await lerArquivoDXF(arquivo);
    await analisarTextoDXF(texto, arquivo.name, numeroLeitura);
  } catch (erro) {
    if (numeroLeitura === estadoOrcamento.leituraAtual) mostrarErroDXF(erro.message);
  }
}

// Botão "Usar o arquivo de exemplo": busca exemplo.dxf no próprio site
async function usarArquivoExemplo() {
  estadoOrcamento.leituraAtual = estadoOrcamento.leituraAtual + 1;
  const numeroLeitura = estadoOrcamento.leituraAtual;

  if (window.location.protocol === "file:") {
    mostrarErroDXF(MENSAGEM_ARQUIVO_LOCAL);
    return;
  }
  mostrarCarregandoDXF();

  try {
    let resposta;
    try {
      resposta = await fetch("exemplo.dxf");
    } catch (erroRede) {
      throw new Error(MENSAGEM_ARQUIVO_LOCAL);
    }
    if (!resposta.ok) {
      throw new Error("O arquivo de exemplo não foi encontrado no site (erro " + resposta.status + ").");
    }
    const texto = await resposta.text();
    await analisarTextoDXF(texto, "exemplo.dxf", numeroLeitura);
  } catch (erro) {
    if (numeroLeitura === estadoOrcamento.leituraAtual) mostrarErroDXF(erro.message);
  }
}

// Escolha de arquivo + arrastar e soltar
function configurarEnvioDXF() {
  tela.arquivo.addEventListener("change", function () {
    processarArquivo(tela.arquivo.files[0]);
    tela.arquivo.value = ""; // permite escolher o mesmo arquivo de novo
  });

  ["dragenter", "dragover"].forEach(function (tipo) {
    tela.zona.addEventListener(tipo, function (evento) {
      evento.preventDefault();
      tela.zona.classList.add("arrastando");
    });
  });
  ["dragleave", "drop"].forEach(function (tipo) {
    tela.zona.addEventListener(tipo, function () {
      tela.zona.classList.remove("arrastando");
    });
  });
  tela.zona.addEventListener("drop", function (evento) {
    evento.preventDefault();
    const arquivos = evento.dataTransfer.files;
    if (arquivos.length > 0) processarArquivo(arquivos[0]);
  });

  // Se o arquivo cair fora da zona, o navegador não sai da página
  document.addEventListener("dragover", function (evento) { evento.preventDefault(); });
  document.addEventListener("drop", function (evento) { evento.preventDefault(); });

  tela.botaoExemplo.addEventListener("click", usarArquivoExemplo);
}

// =============================================================
// 6) PEDIDO (liga com o js/match.js)
// =============================================================

// Monta o objeto do pedido no formato combinado com o js/match.js
function montarPedido() {
  const entrada = estadoOrcamento.entrada;
  const processos = ["corte_laser"];
  if (entrada.dobras > 0) processos.push("dobra");
  if (entrada.acabamento === "pintura_epoxi" || entrada.acabamento === "galvanizacao") {
    processos.push(entrada.acabamento);
  }
  return {
    descricao: estadoOrcamento.descricao,
    material: entrada.material,
    espessura: entrada.espessura,
    quantidade: entrada.quantidade,
    dobras: entrada.dobras,
    acabamento: entrada.acabamento,
    prazo: entrada.prazo,
    processosNecessarios: processos,
    resultado: estadoOrcamento.resultado
  };
}

function fazerPedido() {
  if (!estadoOrcamento.resultado || estadoOrcamento.pedidoEmAndamento) return;

  if (typeof iniciarMatch !== "function") {
    mostrarErroResultado("A simulação do pedido (js/match.js) não carregou. Recarregue a página.");
    return;
  }

  const pedido = montarPedido();
  estadoOrcamento.pedidoEmAndamento = true;
  atualizarBotaoPedido();

  try {
    iniciarMatch(pedido);
  } catch (erro) {
    estadoOrcamento.pedidoEmAndamento = false;
    atualizarBotaoPedido();
    mostrarErroResultado("A simulação do pedido falhou: " + erro.message);
  }
}

// Chamada pelo js/match.js no botão "Fazer novo orçamento":
// esconde o match e o pedido, libera o botão e volta o foco ao título.
function reabilitarOrcamento() {
  estadoOrcamento.pedidoEmAndamento = false;
  document.getElementById("secao-match").hidden = true;
  document.getElementById("secao-pedido").hidden = true;
  atualizar();

  const secao = document.getElementById("secao-orcamento");
  secao.scrollIntoView({ behavior: querMenosMovimento() ? "auto" : "smooth", block: "start" });
  tela.titulo.focus({ preventScroll: true });
}

// =============================================================
// 7) INÍCIO: pega os elementos, monta as listas e liga os eventos
// =============================================================
function iniciarPagina() {
  tela.titulo = document.getElementById("titulo-orcamento");
  tela.abaModelo = document.getElementById("aba-modelo");
  tela.abaDxf = document.getElementById("aba-dxf");
  tela.painelModelo = document.getElementById("painel-modelo");
  tela.painelDxf = document.getElementById("painel-dxf");
  tela.listaPecas = document.getElementById("lista-pecas");
  tela.avisosMedidas = document.getElementById("avisos-medidas");
  tela.arquivo = document.getElementById("arquivo-dxf");
  tela.zona = document.getElementById("zona-arquivo");
  tela.botaoExemplo = document.getElementById("botao-usar-exemplo");
  tela.dxfEstado = document.getElementById("dxf-estado");
  tela.dxfErro = document.getElementById("dxf-erro");
  tela.dxfResultado = document.getElementById("dxf-resultado");
  tela.material = document.getElementById("material");
  tela.espessura = document.getElementById("espessura");
  tela.quantidade = document.getElementById("quantidade");
  tela.ajudaQuantidade = document.getElementById("ajuda-quantidade");
  tela.dobras = document.getElementById("dobras");
  tela.ajudaDobras = document.getElementById("ajuda-dobras");
  tela.listaAcabamentos = document.getElementById("lista-acabamentos");
  tela.anuncioOpcoes = document.getElementById("anuncio-opcoes");
  tela.previaDesenho = document.getElementById("previa-desenho");
  tela.previaLegenda = document.getElementById("previa-legenda");
  tela.resumo = document.getElementById("resultado-resumo");
  tela.total = document.getElementById("resultado-total");
  tela.totalTabela = document.getElementById("resultado-total-tabela");
  tela.porPeca = document.getElementById("resultado-por-peca");
  tela.prazo = document.getElementById("resultado-prazo");
  tela.repasse = document.getElementById("resultado-repasse");
  tela.itens = document.getElementById("resultado-itens");
  tela.resultadoErro = document.getElementById("resultado-erro");
  tela.anuncioTotal = document.getElementById("anuncio-total");
  tela.botaoPedido = document.getElementById("botao-pedido");
  tela.botaoPedidoTexto = document.getElementById("botao-pedido-texto");

  // Monta as listas a partir dos dados
  montarCartoesPecas();
  montarMateriais();
  tela.material.value = Object.keys(MATERIAIS)[0];
  atualizarEspessuras();
  montarAcabamentos();
  atualizarAcabamentos();

  // Campos de medida: recalcula a cada tecla e corrige ao sair do campo
  CAMPOS_PECA.forEach(function (nome) {
    const input = document.getElementById("medida-" + nome);
    input.addEventListener("input", atualizar);
    input.addEventListener("change", corrigirCamposMedidas);
  });

  // Material: refaz espessuras e acabamentos
  tela.material.addEventListener("change", function () {
    tela.anuncioOpcoes.textContent = "";
    atualizarEspessuras();
    atualizarAcabamentos();
    atualizar();
  });
  tela.espessura.addEventListener("change", atualizar);

  // Quantidade e dobras: recalcula a cada tecla; ao sair, grava o valor corrigido
  tela.quantidade.addEventListener("input", atualizar);
  tela.quantidade.addEventListener("change", function () {
    tela.quantidade.value = lerInteiro(tela.quantidade, 1, 1000, 1);
    atualizar();
  });
  tela.dobras.addEventListener("input", atualizar);
  tela.dobras.addEventListener("change", function () {
    tela.dobras.value = lerInteiro(tela.dobras, 0, 10, 0);
    atualizar();
  });

  // Acabamento e prazo (rádios)
  tela.listaAcabamentos.addEventListener("change", function () {
    tela.anuncioOpcoes.textContent = "";
    atualizar();
  });
  document.querySelectorAll('input[name="prazo"]').forEach(function (radio) {
    radio.addEventListener("change", atualizar);
  });

  configurarAbas();
  configurarEnvioDXF();
  configurarBarraTotal();
  tela.botaoPedido.addEventListener("click", fazerPedido);

  // Começa com a primeira peça-modelo (isso já faz o primeiro cálculo)
  escolherPeca(estadoOrcamento.peca);
}

document.addEventListener("DOMContentLoaded", iniciarPagina);
