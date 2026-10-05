// =============================================================
// FUNÇÕES COMUNS A TODAS AS PÁGINAS
// - coloca o nome da startup (NOME_STARTUP) onde houver class="js-nome"
// - preenche valores de data/precos.js onde houver data-dado="..."
// - abre e fecha o menu no celular
// - formata números em reais e no padrão brasileiro
// =============================================================

// Formata um número como dinheiro: 1234.5 -> "R$ 1.234,50"
function formatarReais(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Formata um número no padrão brasileiro: 4.75 -> "4,75"
function formatarNumero(valor, casas) {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: casas || 0,
    maximumFractionDigits: casas || 0
  });
}

// Formata espessura: 4.75 -> "4,75 mm"; 2 -> "2 mm"
function formatarEspessura(mm) {
  return String(mm).replace(".", ",") + " mm";
}

// Formata porcentagem: 0.18 -> "18%"
function formatarPorcentagem(fracao) {
  return Math.round(fracao * 100) + "%";
}

// Valores de data/precos.js que aparecem em textos das páginas.
// No HTML: <span data-dado="comissaoFaixa">15% a 20%</span>
// O texto dentro do span é só um "reserva" caso o JavaScript não rode.
const DADOS_TEXTO = {
  comissaoFaixa: function () {
    return formatarPorcentagem(PRECOS.comissaoMinima) + " a " + formatarPorcentagem(PRECOS.comissaoMaxima);
  },
  comissao: function () {
    return formatarPorcentagem(PRECOS.comissao);
  },
  acrescimoExpresso: function () {
    return formatarPorcentagem(PRECOS.prazo.expresso.acrescimo);
  },
  pedidoMinimo: function () {
    return formatarReais(PRECOS.pedidoMinimo);
  },
  totalParceiras: function () {
    return String(PARCEIROS.length);
  }
};

// Coloca o nome da startup em todos os lugares marcados
function aplicarNomeStartup() {
  document.querySelectorAll(".js-nome").forEach(function (el) {
    el.textContent = NOME_STARTUP;
  });
  // Título da aba do navegador: troca "Forja" pelo nome configurado
  document.title = document.title.replace(/Forja/g, NOME_STARTUP);
  document.querySelectorAll(".js-frase").forEach(function (el) {
    el.textContent = FRASE_STARTUP;
  });
  document.querySelectorAll(".js-aviso").forEach(function (el) {
    el.textContent = AVISO_FICTICIO;
  });
}

// Preenche os spans com data-dado="..."
function aplicarDadosTexto() {
  document.querySelectorAll("[data-dado]").forEach(function (el) {
    const funcao = DADOS_TEXTO[el.dataset.dado];
    // Só preenche se o arquivo de dados necessário foi carregado na página
    try {
      if (funcao) el.textContent = funcao();
    } catch (erro) {
      // Mantém o texto reserva do HTML
    }
  });
}

// Menu do celular: o botão abre/fecha a lista de links
function configurarMenu() {
  const botao = document.querySelector(".menu-botao");
  const menu = document.getElementById("menu-principal");
  if (!botao || !menu) return;

  function fecharMenu() {
    botao.setAttribute("aria-expanded", "false");
    menu.classList.remove("aberto");
  }

  botao.addEventListener("click", function () {
    const aberto = botao.getAttribute("aria-expanded") === "true";
    botao.setAttribute("aria-expanded", String(!aberto));
    menu.classList.toggle("aberto", !aberto);
  });

  // Tecla Esc fecha o menu e devolve o foco ao botão
  document.addEventListener("keydown", function (evento) {
    if (evento.key === "Escape" && menu.classList.contains("aberto")) {
      fecharMenu();
      botao.focus();
    }
  });

  // Clicar em um link fecha o menu (útil em links para a mesma página)
  menu.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", fecharMenu);
  });
}

document.addEventListener("DOMContentLoaded", function () {
  aplicarNomeStartup();
  aplicarDadosTexto();
  configurarMenu();
});
