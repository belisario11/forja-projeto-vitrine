// =============================================================
// PAINEL DA METALÚRGICA (parceiro.html) — SIMULAÇÃO
// Mostra a visão do "Seu Antônio", dono de uma metalúrgica parceira.
// Todos os dados vêm de data/parceiros.js (PAINEL_PARCEIRO, PROCESSOS,
// PARCEIROS). Nada aqui é real: é só uma demonstração.
//
// Como funciona:
// 1. Desenha as máquinas, a ocupação da semana e os ganhos do mês.
// 2. Um "relógio" (setInterval) bate a cada 1 segundo e cuida de TUDO
//    que depende de tempo: chegada de ofertas, contagem regressiva de
//    cada oferta e o sumiço das ofertas recusadas.
// 3. Aceitar soma o valor nos ganhos e aumenta a ocupação da semana.
// =============================================================

// ---------- Constantes da demonstração (não são preços) ----------
// Quantos segundos cada oferta fica aberta antes de expirar
const SEGUNDOS_PARA_EXPIRAR = 30;
// Quando faltar este tempo, a barra da oferta fica com aspecto de urgência
const SEGUNDOS_URGENTE = 10;
// Pontos percentuais somados ao dia menos ocupado quando uma oferta é aceita
const AUMENTO_OCUPACAO = 10;
// Segundos que a mensagem de "recusada"/"expirada" fica na tela antes de sumir
const SEGUNDOS_PARA_SUMIR = 5;

// Nomes completos dos dias (para o texto lido por leitores de tela)
const NOMES_DIAS = {
  Seg: "segunda-feira",
  Ter: "terça-feira",
  Qua: "quarta-feira",
  Qui: "quinta-feira",
  Sex: "sexta-feira",
  "Sáb": "sábado",
  Dom: "domingo"
};

// Ícones SVG simples para cada processo (desenhados à mão)
const ICONES_PROCESSO = {
  // Laser: um feixe descendo até a chapa, com faíscas
  corte_laser: '<path d="M12 2v10"/><path d="M8 6h8"/><path d="M3 18h18"/><path d="M12 12l-3 4M12 12l3 4"/>',
  // Dobradeira: uma chapa dobrada em L sob uma lâmina
  dobra: '<path d="M4 4h16"/><path d="M12 4v5"/><path d="M5 20V13h14"/>',
  // Solda: uma chama
  solda_mig: '<path d="M12 3c3 4 5 6.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3 0-5 1-8.5z"/>'
};
// Ícone reserva (engrenagem simples) para processos sem desenho próprio
const ICONE_PADRAO = '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/>';

// ---------- Estado da demonstração ----------
// "Estado" são as variáveis que mudam enquanto a página está aberta.
let disponivel = true;        // interruptor "Disponível para novos serviços"
let proximaOferta = 0;        // posição da próxima oferta em PAINEL_PARCEIRO.ofertas
let segundosAteProxima = 0;   // contagem até a próxima oferta chegar
let ofertasNaTela = [];       // ofertas que estão no painel agora
let ocupacao = [];            // cópia de PAINEL_PARCEIRO.ocupacaoSemana
let ganhos = {};              // cópia de PAINEL_PARCEIRO.ganhosMes
let relogio = null;           // guarda o setInterval, para poder parar depois

// Quem pediu "menos movimento" ao sistema não vê o efeito de sumir
const reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Atalho para pegar um elemento pelo id
function el(id) {
  return document.getElementById(id);
}

// Cria um <svg> de ícone a partir do "miolo" (os paths)
function criarIcone(miolo) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    miolo + "</svg>";
}

// Nome de uma parceira da rede diferente da nossa empresa
// (regra: a primeira da lista PARCEIROS cujo nome é diferente)
function outraParceira() {
  for (let i = 0; i < PARCEIROS.length; i++) {
    if (PARCEIROS[i].nome !== PAINEL_PARCEIRO.empresa) {
      return PARCEIROS[i].nome;
    }
  }
  return "outra parceira da rede";
}

// =============================================================
// 1. DADOS DA EMPRESA
// =============================================================
function mostrarEmpresa() {
  el("painel-empresa").textContent = PAINEL_PARCEIRO.empresa;
  el("painel-dono").textContent = PAINEL_PARCEIRO.dono;
  el("painel-cidade").textContent = PAINEL_PARCEIRO.cidade;
}

// =============================================================
// 2. MÁQUINAS CADASTRADAS
// =============================================================
function mostrarMaquinas() {
  const lista = el("lista-maquinas");
  lista.innerHTML = "";

  PAINEL_PARCEIRO.maquinas.forEach(function (maquina) {
    const icone = ICONES_PROCESSO[maquina.processo] || ICONE_PADRAO;
    const item = document.createElement("li");
    item.className = "cartao maquina";
    item.innerHTML =
      '<span class="icone">' + criarIcone(icone) + "</span>" +
      '<h3 class="maquina-nome"></h3>' +
      '<p class="maquina-processo"></p>' +
      '<p class="texto-suave maquina-detalhe"></p>' +
      '<p class="maquina-situacao"></p>';
    // textContent evita problemas com caracteres especiais
    item.querySelector(".maquina-nome").textContent = maquina.nome;
    item.querySelector(".maquina-processo").textContent = PROCESSOS[maquina.processo] || maquina.processo;
    item.querySelector(".maquina-detalhe").textContent = maquina.detalhe;
    lista.appendChild(item);
  });

  atualizarSituacaoMaquinas();
}

// O selo de cada máquina acompanha o interruptor de disponibilidade.
// O texto e o símbolo dizem a situação (não só a cor).
function atualizarSituacaoMaquinas() {
  document.querySelectorAll(".maquina-situacao").forEach(function (selo) {
    if (disponivel) {
      selo.className = "maquina-situacao selo selo-sucesso";
      selo.textContent = "✓ Recebendo pedidos";
    } else {
      selo.className = "maquina-situacao selo";
      selo.textContent = "⏸ Pausada";
    }
  });
}

// =============================================================
// 3. OCUPAÇÃO DA SEMANA
// =============================================================
function mostrarOcupacao() {
  const lista = el("ocupacao-lista");
  lista.innerHTML = "";

  ocupacao.forEach(function (dia, indice) {
    const item = document.createElement("li");
    item.className = "ocupacao-dia";
    item.id = "ocupacao-dia-" + indice;
    // A barra é decorativa (aria-hidden); o número aparece em texto ao lado
    item.innerHTML =
      '<span class="ocupacao-rotulo" aria-hidden="true"></span>' +
      '<span class="visualmente-oculto ocupacao-rotulo-longo"></span>' +
      '<div class="barra" aria-hidden="true"><div class="barra-preenchida"></div></div>' +
      '<span class="ocupacao-numero"></span>';
    item.querySelector(".ocupacao-rotulo").textContent = dia.dia;
    item.querySelector(".ocupacao-rotulo-longo").textContent = (NOMES_DIAS[dia.dia] || dia.dia) + ":";
    lista.appendChild(item);
  });

  atualizarOcupacao();
}

// Atualiza larguras e números das barras (chamada também ao aceitar)
function atualizarOcupacao() {
  let soma = 0;

  ocupacao.forEach(function (dia, indice) {
    const item = el("ocupacao-dia-" + indice);
    item.querySelector(".barra-preenchida").style.width = dia.ocupacao + "%";
    item.querySelector(".ocupacao-numero").textContent = dia.ocupacao + "% ocupado";
    soma = soma + dia.ocupacao;
  });

  const media = Math.round(soma / ocupacao.length);
  el("ocupacao-media").textContent = media + "%";
  el("barra-media").style.width = media + "%";
  el("tempo-livre").textContent = (100 - media) + "%";
}

// Soma AUMENTO_OCUPACAO ao dia menos ocupado (máximo 100%).
// Devolve o índice do dia que mudou.
function aumentarOcupacao() {
  // Tira o destaque de uma mudança anterior
  document.querySelectorAll(".ocupacao-mudou").forEach(function (linha) {
    linha.classList.remove("ocupacao-mudou");
  });

  let menor = 0;
  for (let i = 1; i < ocupacao.length; i++) {
    if (ocupacao[i].ocupacao < ocupacao[menor].ocupacao) {
      menor = i;
    }
  }
  ocupacao[menor].ocupacao = Math.min(100, ocupacao[menor].ocupacao + AUMENTO_OCUPACAO);
  atualizarOcupacao();

  // Destaque rápido na linha que mudou
  const linha = el("ocupacao-dia-" + menor);
  linha.classList.add("ocupacao-mudou");
  return menor;
}

// =============================================================
// 4. GANHOS DO MÊS
// =============================================================
function mostrarGanhos() {
  el("ganho-pedidos").textContent = formatarNumero(ganhos.pedidosConcluidos);
  el("ganho-valor").textContent = formatarReais(ganhos.valorRecebido);
  el("ganho-horas").textContent = formatarNumero(ganhos.horasMaquinaOcupadas) + " h";
  el("ganho-nota").textContent = formatarNumero(ganhos.notaMedia, 1) + " de 5";
}

// =============================================================
// 5. OFERTAS
// =============================================================

// Cria o cartão de uma oferta nova e coloca na lista
function mostrarProximaOferta() {
  const dados = PAINEL_PARCEIRO.ofertas[proximaOferta];
  proximaOferta = proximaOferta + 1;

  const item = document.createElement("li");
  item.className = "cartao oferta";
  item.innerHTML =
    '<p class="oferta-etiqueta">Nova oferta</p>' +
    '<h3 class="oferta-titulo"></h3>' +
    '<ul class="oferta-detalhes">' +
    '  <li class="oferta-material"></li>' +
    '  <li class="oferta-cliente"></li>' +
    '  <li class="oferta-prazo"></li>' +
    "</ul>" +
    '<p class="oferta-valor">Você recebe <strong></strong></p>' +
    '<div class="oferta-acoes">' +
    '  <div class="oferta-tempo">' +
    '    <div class="barra barra-tempo" aria-hidden="true"><div class="barra-preenchida"></div></div>' +
    '    <p class="oferta-tempo-texto" aria-hidden="true"></p>' +
    '    <p class="visualmente-oculto">Você tem ' + SEGUNDOS_PARA_EXPIRAR + ' segundos para responder.</p>' +
    "  </div>" +
    '  <div class="grupo-botoes">' +
    '    <button type="button" class="botao botao-aceitar">' + criarIcone('<path d="M5 12l5 5L20 7"/>') + "Aceitar</button>" +
    '    <button type="button" class="botao botao-secundario botao-recusar">' + criarIcone('<path d="M6 6l12 12M18 6L6 18"/>') + "Recusar</button>" +
    "  </div>" +
    "</div>";

  // Preenche os textos (sempre com textContent)
  item.querySelector(".oferta-titulo").textContent = dados.titulo;
  item.querySelector(".oferta-material").textContent = dados.material + " " + dados.espessura;
  item.querySelector(".oferta-cliente").textContent = "Cliente em " + dados.cidadeCliente;
  item.querySelector(".oferta-prazo").textContent = "Prazo: " + dados.prazoDiasUteis + " dias úteis";
  item.querySelector(".oferta-valor strong").textContent = formatarReais(dados.valorRepasse);

  // O nome do botão inclui o título, para o leitor de tela saber qual oferta é
  const botaoAceitar = item.querySelector(".botao-aceitar");
  const botaoRecusar = item.querySelector(".botao-recusar");
  botaoAceitar.setAttribute("aria-label", "Aceitar oferta: " + dados.titulo);
  botaoRecusar.setAttribute("aria-label", "Recusar oferta: " + dados.titulo);

  // Objeto que guarda a situação desta oferta
  const oferta = {
    dados: dados,
    elemento: item,
    situacao: "pendente", // pendente, aceita, recusada ou expirada
    segundosRestantes: SEGUNDOS_PARA_EXPIRAR,
    segundosParaSumir: 0
  };
  ofertasNaTela.push(oferta);

  botaoAceitar.addEventListener("click", function () {
    aceitarOferta(oferta);
  });
  botaoRecusar.addEventListener("click", function () {
    recusarOferta(oferta, "recusada");
  });

  // Ofertas novas aparecem no topo da lista
  el("lista-ofertas").prepend(item);
  atualizarContagem(oferta);
}

// Atualiza a barra e o texto "expira em X s" de uma oferta
function atualizarContagem(oferta) {
  const porcentagem = (oferta.segundosRestantes / SEGUNDOS_PARA_EXPIRAR) * 100;
  const cartao = oferta.elemento;
  cartao.querySelector(".barra-tempo .barra-preenchida").style.width = porcentagem + "%";
  cartao.querySelector(".oferta-tempo-texto").textContent = "Expira em " + oferta.segundosRestantes + " s";
  cartao.classList.toggle("oferta-urgente", oferta.segundosRestantes <= SEGUNDOS_URGENTE);
}

// Troca a parte dos botões por uma mensagem de resultado.
// Se o foco estava nos botões, ele vai para a mensagem (para não se perder).
function mostrarResultado(oferta, classe, textoHtml) {
  const cartao = oferta.elemento;
  const focoEstavaNoCartao = cartao.contains(document.activeElement);

  const mensagem = document.createElement("p");
  mensagem.className = "oferta-resultado";
  mensagem.tabIndex = -1; // pode receber foco pelo JavaScript, mas não pelo Tab
  mensagem.innerHTML = textoHtml;

  cartao.querySelector(".oferta-acoes").replaceWith(mensagem);
  cartao.querySelector(".oferta-etiqueta").remove();
  cartao.classList.remove("oferta-urgente");
  cartao.classList.add(classe);

  if (focoEstavaNoCartao) {
    mensagem.focus();
  }
}

// Aceitar: entra na agenda, soma nos ganhos e aumenta a ocupação
function aceitarOferta(oferta) {
  if (oferta.situacao !== "pendente") return;
  oferta.situacao = "aceita";

  ganhos.pedidosConcluidos = ganhos.pedidosConcluidos + 1;
  ganhos.valorRecebido = ganhos.valorRecebido + oferta.dados.valorRepasse;
  mostrarGanhos();

  const indiceDia = aumentarOcupacao();
  const dia = ocupacao[indiceDia];

  mostrarResultado(
    oferta,
    "oferta-aceita",
    "<strong>Aceito ✓ — entrou na sua agenda.</strong> " +
    formatarReais(oferta.dados.valorRepasse) + " somados aos ganhos do mês. " +
    "Ocupação de " + (NOMES_DIAS[dia.dia] || dia.dia) + " agora: " + dia.ocupacao + "%."
  );

  verificarFim();
}

// Recusar (ou expirar): a oferta vai para outra parceira e some depois
function recusarOferta(oferta, motivo) {
  if (oferta.situacao !== "pendente") return;
  oferta.situacao = motivo; // "recusada" ou "expirada"
  oferta.segundosParaSumir = SEGUNDOS_PARA_SUMIR;

  let texto;
  if (motivo === "expirada") {
    texto = "<strong>⏱ A oferta expirou e foi para outra parceira.</strong>";
  } else {
    texto = "<strong>✕ Oferta recusada.</strong> Ela foi oferecida para outra parceira da rede: ";
  }
  mostrarResultado(oferta, "oferta-recusada", texto);

  // Nome da outra parceira com textContent (só no caso de recusa)
  if (motivo === "recusada") {
    const nome = document.createElement("span");
    nome.textContent = outraParceira() + ".";
    oferta.elemento.querySelector(".oferta-resultado").appendChild(nome);
  }

  verificarFim();
}

// Tira da tela um cartão recusado/expirado.
// Se o foco estava nele, leva o foco para a próxima oferta ou para o título.
function removerOferta(oferta) {
  const cartao = oferta.elemento;
  const focoEstavaNoCartao = cartao.contains(document.activeElement);

  ofertasNaTela = ofertasNaTela.filter(function (item) {
    return item !== oferta;
  });
  cartao.remove();

  if (focoEstavaNoCartao) {
    const pendente = ofertasNaTela.find(function (item) {
      return item.situacao === "pendente";
    });
    if (pendente) {
      pendente.elemento.querySelector(".botao-aceitar").focus();
    } else {
      el("titulo-ofertas").focus();
    }
  }
}

// Quantas ofertas ainda esperam resposta
function contarPendentes() {
  return ofertasNaTela.filter(function (item) {
    return item.situacao === "pendente";
  }).length;
}

// Se todas as ofertas já chegaram e foram respondidas, mostra o fim
function verificarFim() {
  const todasChegaram = proximaOferta >= PAINEL_PARCEIRO.ofertas.length;
  if (todasChegaram && contarPendentes() === 0) {
    el("ofertas-fim-mensagem").innerHTML =
      '<p class="aviso">Sem novas ofertas por enquanto.</p>';
    el("botao-reiniciar").hidden = false;
  }
}

// =============================================================
// 6. O RELÓGIO: roda a cada 1 segundo
// =============================================================
function baterRelogio() {
  // a) Cartões recusados/expirados: contam até sumir (mesmo com o painel pausado)
  ofertasNaTela.slice().forEach(function (oferta) {
    if (oferta.situacao === "recusada" || oferta.situacao === "expirada") {
      oferta.segundosParaSumir = oferta.segundosParaSumir - 1;
      // No último segundo, começa o efeito de sumir (se o movimento for permitido)
      if (oferta.segundosParaSumir === 1 && !reduzirMovimento) {
        oferta.elemento.classList.add("oferta-sumindo");
      }
      if (oferta.segundosParaSumir <= 0) {
        removerOferta(oferta);
      }
    }
  });

  // Com o interruptor desligado, nada mais anda: nem chegada, nem contagem
  if (!disponivel) return;

  // b) Contagem regressiva de cada oferta pendente
  ofertasNaTela.forEach(function (oferta) {
    if (oferta.situacao === "pendente") {
      oferta.segundosRestantes = oferta.segundosRestantes - 1;
      if (oferta.segundosRestantes <= 0) {
        recusarOferta(oferta, "expirada");
      } else {
        atualizarContagem(oferta);
      }
    }
  });

  // c) Chegada da próxima oferta
  if (proximaOferta < PAINEL_PARCEIRO.ofertas.length) {
    segundosAteProxima = segundosAteProxima - 1;
    if (segundosAteProxima <= 0) {
      mostrarProximaOferta();
      segundosAteProxima = PAINEL_PARCEIRO.segundosEntreOfertas;
    }
  }
}

function ligarRelogio() {
  pararRelogio(); // garante que nunca existam dois relógios ao mesmo tempo
  relogio = setInterval(baterRelogio, 1000);
}

function pararRelogio() {
  if (relogio !== null) {
    clearInterval(relogio);
    relogio = null;
  }
}

// =============================================================
// 7. INTERRUPTOR "DISPONÍVEL PARA NOVOS SERVIÇOS"
// =============================================================
function mudarDisponibilidade() {
  disponivel = !disponivel;

  const botao = el("botao-disponivel");
  botao.setAttribute("aria-checked", String(disponivel));
  el("texto-disponivel").textContent = disponivel ? "Ligado" : "Desligado";

  if (disponivel) {
    el("aviso-invisivel").innerHTML = "";
  } else {
    el("aviso-invisivel").innerHTML =
      '<p class="aviso">⏸ <strong>Você está invisível para novos pedidos.</strong> ' +
      "A chegada de ofertas e a contagem de tempo estão pausadas. Ligue de novo para continuar.</p>";
  }

  atualizarSituacaoMaquinas();
}

// =============================================================
// 8. INÍCIO E REINÍCIO DA DEMONSTRAÇÃO
// =============================================================
function iniciarDemonstracao() {
  // Cópias dos dados: assim "Reiniciar" volta aos valores originais
  ocupacao = PAINEL_PARCEIRO.ocupacaoSemana.map(function (dia) {
    return { dia: dia.dia, ocupacao: dia.ocupacao };
  });
  ganhos = Object.assign({}, PAINEL_PARCEIRO.ganhosMes);

  proximaOferta = 0;
  ofertasNaTela = [];
  el("lista-ofertas").innerHTML = "";
  el("ofertas-fim-mensagem").innerHTML = "";
  el("botao-reiniciar").hidden = true;

  mostrarOcupacao();
  mostrarGanhos();

  // A primeira oferta chega na hora; as outras, a cada segundosEntreOfertas
  if (disponivel && PAINEL_PARCEIRO.ofertas.length > 0) {
    mostrarProximaOferta();
    segundosAteProxima = PAINEL_PARCEIRO.segundosEntreOfertas;
  } else {
    segundosAteProxima = 0; // chega assim que o interruptor for ligado
  }

  ligarRelogio();
}

document.addEventListener("DOMContentLoaded", function () {
  mostrarEmpresa();
  mostrarMaquinas();
  iniciarDemonstracao();

  el("botao-disponivel").addEventListener("click", mudarDisponibilidade);

  el("botao-reiniciar").addEventListener("click", function () {
    iniciarDemonstracao();
    // O botão some; o foco vai para o título da lista de ofertas
    el("titulo-ofertas").focus();
  });

  // Ao sair da página, para o relógio
  window.addEventListener("pagehide", pararRelogio);
  // Se o navegador trouxer a página de volta da memória (botão Voltar), religa
  window.addEventListener("pageshow", function (evento) {
    if (evento.persisted) {
      ligarRelogio();
    }
  });
});
