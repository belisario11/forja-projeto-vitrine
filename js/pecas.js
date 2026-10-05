// =============================================================
// PEÇAS-MODELO
// Quatro peças prontas que o cliente pode ajustar sem ter um desenho:
// placa com furos, suporte em L, flange circular e cantoneira.
//
// Para cada peça, este arquivo sabe:
//   - quais campos aparecem no formulário (rótulo, mínimo, máximo, padrão)
//   - quantas dobras ela tem (dobrasPadrao)
//   - calcular a geometria: área da chapa, metros de corte e perfurações
//   - desenhar a peça em SVG para a pré-visualização
//
// Tudo em milímetros (mm). A geometria devolve área em m² e corte em metros,
// que é o formato que a função calcularOrcamento() (js/calculo.js) espera.
//
// Observação: as peças com dobra (suporte em L e cantoneira) são medidas
// "planificadas", ou seja, como a chapa fica ANTES de ser dobrada.
// É assim que o laser corta: chapa reta; depois a dobradeira faz a dobra.
// =============================================================

// Tamanho da "tela" do desenho SVG (em pixels do viewBox)
const SVG_LARGURA = 420;
const SVG_ALTURA = 280;
const SVG_MARGEM = 48; // espaço em volta da peça para as cotas (medidas)

// Mostra um número com vírgula: 12.5 -> "12,5"; 10 -> "10"
function numeroTexto(valor) {
  const arredondado = Math.round(valor * 10) / 10;
  return String(arredondado).replace(".", ",");
}

// Texto dos furos para o aria-label: "sem furos", "1 furo de 8 milímetros"...
function textoFuros(quantidade, diametro) {
  if (quantidade === 0) return "sem furos";
  const palavra = quantidade === 1 ? " furo" : " furos";
  return quantidade + palavra + " de " + numeroTexto(diametro) + " milímetros";
}

// -------------------------------------------------------------
// FUROS EM GRADE
// Espalha "n" furos de forma regular dentro de um retângulo.
// Divide o retângulo em células (colunas x linhas) e põe um furo
// no centro de cada célula. A última linha, se incompleta, fica centralizada.
// -------------------------------------------------------------
function calcularGrade(largura, altura, n) {
  // Quantas colunas: proporcional ao formato do retângulo
  let colunas = Math.round(Math.sqrt(n * largura / altura));
  if (colunas < 1) colunas = 1;
  if (colunas > n) colunas = n;
  // Se der, usa um número de colunas que divide os furos por igual
  // (ex.: 4 furos viram 2 x 2, um em cada canto, e não 3 + 1)
  if (n % colunas !== 0) {
    if (colunas > 1 && n % (colunas - 1) === 0) colunas = colunas - 1;
    else if (colunas < n && n % (colunas + 1) === 0) colunas = colunas + 1;
  }
  const linhas = Math.ceil(n / colunas);
  return { colunas: colunas, linhas: linhas };
}

function furosEmGrade(x0, y0, largura, altura, n) {
  const pontos = [];
  if (n <= 0) return pontos;
  const grade = calcularGrade(largura, altura, n);
  const larguraCelula = largura / grade.colunas;
  const alturaCelula = altura / grade.linhas;

  for (let linha = 0; linha < grade.linhas; linha++) {
    // Quantos furos cabem nesta linha (a última pode ter menos)
    const restantes = n - linha * grade.colunas;
    const nestaLinha = Math.min(grade.colunas, restantes);
    // Desloca para centralizar uma linha incompleta
    const deslocamento = (grade.colunas - nestaLinha) * larguraCelula / 2;
    for (let coluna = 0; coluna < nestaLinha; coluna++) {
      pontos.push({
        x: x0 + deslocamento + (coluna + 0.5) * larguraCelula,
        y: y0 + (linha + 0.5) * alturaCelula
      });
    }
  }
  return pontos;
}

// Maior diâmetro de furo que cabe na grade:
// o furo pode ocupar no máximo metade da célula (sobra material entre os furos e até a borda)
function diametroMaximoGrade(largura, altura, n) {
  if (n <= 0) return Infinity;
  const grade = calcularGrade(largura, altura, n);
  return 0.5 * Math.min(largura / grade.colunas, altura / grade.linhas);
}

// -------------------------------------------------------------
// AJUDANTES DE DESENHO (SVG)
// -------------------------------------------------------------

// Escala para a peça caber na tela mantendo as proporções
function calcularEscala(larguraMm, alturaMm) {
  const escalaX = (SVG_LARGURA - 2 * SVG_MARGEM) / larguraMm;
  const escalaY = (SVG_ALTURA - 2 * SVG_MARGEM) / alturaMm;
  return Math.min(escalaX, escalaY);
}

// Arredonda coordenadas para o SVG ficar mais curto
function px(valor) {
  return Math.round(valor * 10) / 10;
}

// Monta a tag <svg> completa com o conteúdo e a descrição acessível
function envolverSVG(conteudo, descricao) {
  return '<svg class="previa-svg" viewBox="0 0 ' + SVG_LARGURA + ' ' + SVG_ALTURA + '"' +
    ' role="img" aria-label="' + descricao + '" focusable="false"' +
    ' xmlns="http://www.w3.org/2000/svg">' + conteudo + '</svg>';
}

// Círculo de furo (pinta com a cor do fundo, parecendo um buraco)
function desenharFuro(x, y, raio) {
  const raioVisivel = Math.max(1.5, raio); // furo muito pequeno ainda aparece
  return '<circle class="peca-furo" cx="' + px(x) + '" cy="' + px(y) + '" r="' + px(raioVisivel) + '"/>';
}

// Cota horizontal: linha com "tracinhos" nas pontas e o texto embaixo
function cotaHorizontal(x1, x2, y, texto) {
  return '<g class="peca-cota">' +
    '<line x1="' + px(x1) + '" y1="' + px(y) + '" x2="' + px(x2) + '" y2="' + px(y) + '"/>' +
    '<line x1="' + px(x1) + '" y1="' + px(y - 5) + '" x2="' + px(x1) + '" y2="' + px(y + 5) + '"/>' +
    '<line x1="' + px(x2) + '" y1="' + px(y - 5) + '" x2="' + px(x2) + '" y2="' + px(y + 5) + '"/>' +
    '<text x="' + px((x1 + x2) / 2) + '" y="' + px(y + 20) + '" text-anchor="middle">' + texto + '</text>' +
    '</g>';
}

// Cota vertical: linha à esquerda da peça com o texto girado
function cotaVertical(x, y1, y2, texto) {
  const meio = (y1 + y2) / 2;
  return '<g class="peca-cota">' +
    '<line x1="' + px(x) + '" y1="' + px(y1) + '" x2="' + px(x) + '" y2="' + px(y2) + '"/>' +
    '<line x1="' + px(x - 5) + '" y1="' + px(y1) + '" x2="' + px(x + 5) + '" y2="' + px(y1) + '"/>' +
    '<line x1="' + px(x - 5) + '" y1="' + px(y2) + '" x2="' + px(x + 5) + '" y2="' + px(y2) + '"/>' +
    '<text x="' + px(x - 10) + '" y="' + px(meio) + '" text-anchor="middle"' +
    ' transform="rotate(-90 ' + px(x - 10) + ' ' + px(meio) + ')">' + texto + '</text>' +
    '</g>';
}

// Linha de dobra: tracejada em laranja, com a palavra "dobra" ao lado
function linhaDobra(x1, x2, y) {
  return '<line class="peca-dobra" x1="' + px(x1) + '" y1="' + px(y) + '" x2="' + px(x2) + '" y2="' + px(y) + '"/>' +
    '<text class="peca-dobra-texto" x="' + px(x2 + 6) + '" y="' + px(y + 5) + '">dobra</text>';
}

// Desenha uma chapa retangular com furos, linhas de dobra e cotas.
// Usada pela placa, pelo suporte em L e pela cantoneira.
// furos: lista de {x, y} em mm; dobrasY: lista de alturas (mm) das linhas de dobra
function desenharRetangulo(larguraMm, alturaMm, furos, diametroMm, dobrasY, textoAltura, descricao) {
  const escala = calcularEscala(larguraMm, alturaMm);
  const w = larguraMm * escala;
  const h = alturaMm * escala;
  const x0 = (SVG_LARGURA - w) / 2;
  const y0 = (SVG_ALTURA - h) / 2;

  let conteudo = '<rect class="peca-chapa" x="' + px(x0) + '" y="' + px(y0) + '" width="' + px(w) + '" height="' + px(h) + '" rx="1"/>';

  furos.forEach(function (furo) {
    conteudo += desenharFuro(x0 + furo.x * escala, y0 + furo.y * escala, diametroMm / 2 * escala);
  });

  dobrasY.forEach(function (yMm) {
    conteudo += linhaDobra(x0, x0 + w, y0 + yMm * escala);
  });

  conteudo += cotaHorizontal(x0, x0 + w, y0 + h + 14, numeroTexto(larguraMm) + " mm");
  conteudo += cotaVertical(x0 - 14, y0, y0 + h, textoAltura);

  return envolverSVG(conteudo, descricao);
}

// =============================================================
// 1) PLACA RETANGULAR COM FUROS
// Chapa plana L x A com furos espalhados em grade.
// =============================================================
function furosPlaca(m) {
  return furosEmGrade(0, 0, m.largura, m.altura, m.furos);
}

function diametroMaximoPlaca(m, n) {
  return diametroMaximoGrade(m.largura, m.altura, n);
}

function geometriaPlaca(m) {
  const perimetro = 2 * (m.largura + m.altura);       // contorno externo (mm)
  const contornoFuros = m.furos * Math.PI * m.diametro; // soma das circunferências (mm)
  return {
    areaM2: (m.largura * m.altura) / 1000000,
    corteM: (perimetro + contornoFuros) / 1000,
    perfuracoes: m.furos + 1 // furos + contorno externo (o laser também fura a chapa para começar o contorno)
  };
}

function desenharPlaca(m) {
  const descricao = "Placa " + numeroTexto(m.largura) + " por " + numeroTexto(m.altura) +
    " milímetros com " + textoFuros(m.furos, m.diametro);
  return desenharRetangulo(m.largura, m.altura, furosPlaca(m), m.diametro, [],
    numeroTexto(m.altura) + " mm", descricao);
}

// =============================================================
// 2) SUPORTE EM L
// Para simplificar, o usuário informa a chapa planificada:
//   largura = largura do suporte
//   altura  = aba A + aba B (a dobra fica no meio: abas iguais)
// Os furos são divididos entre as duas abas.
// =============================================================
function furosSuporteL(m) {
  const meia = m.altura / 2;
  const furosAbaA = Math.ceil(m.furos / 2);
  const furosAbaB = m.furos - furosAbaA;
  const abaA = furosEmGrade(0, 0, m.largura, meia, furosAbaA);
  const abaB = furosEmGrade(0, meia, m.largura, meia, furosAbaB);
  return abaA.concat(abaB);
}

function diametroMaximoSuporteL(m, n) {
  // A aba com mais furos é a que limita
  return diametroMaximoGrade(m.largura, m.altura / 2, Math.ceil(n / 2));
}

function geometriaSuporteL(m) {
  // Mesma conta da placa: o laser corta a chapa ainda reta
  return geometriaPlaca(m);
}

function desenharSuporteL(m) {
  const descricao = "Suporte em L planificado, " + numeroTexto(m.largura) + " por " + numeroTexto(m.altura) +
    " milímetros, com uma dobra no meio e " + textoFuros(m.furos, m.diametro);
  return desenharRetangulo(m.largura, m.altura, furosSuporteL(m), m.diametro, [m.altura / 2],
    numeroTexto(m.altura) + " mm", descricao);
}

// =============================================================
// 3) FLANGE CIRCULAR
//   largura = diâmetro externo D (não tem "altura")
//   furo central = 40% de D (também é cortado e conta como 1 perfuração)
//   furos de fixação = espalhados num círculo de 75% de D
// =============================================================
const FLANGE_FURO_CENTRAL = 0.40;   // fração do diâmetro externo
const FLANGE_CIRCULO_FUROS = 0.75;  // fração do diâmetro externo

function furosFlange(m) {
  const pontos = [];
  const raioCirculo = (m.largura * FLANGE_CIRCULO_FUROS) / 2;
  for (let i = 0; i < m.furos; i++) {
    // Começa no topo (-90°) e dá a volta em passos iguais
    const angulo = -Math.PI / 2 + (2 * Math.PI * i) / m.furos;
    pontos.push({
      x: m.largura / 2 + raioCirculo * Math.cos(angulo),
      y: m.largura / 2 + raioCirculo * Math.sin(angulo)
    });
  }
  return pontos;
}

function diametroMaximoFlange(m, n) {
  if (n <= 0) return Infinity;
  const D = m.largura;
  // Limite 1: o furo precisa caber entre o furo central e a borda
  const limiteRadial = 0.18 * D;
  // Limite 2: os furos não podem encostar um no outro ao longo do círculo
  const distanciaEntreFuros = (Math.PI * D * FLANGE_CIRCULO_FUROS) / n;
  const limiteVizinhos = 0.6 * distanciaEntreFuros;
  return Math.min(limiteRadial, limiteVizinhos);
}

function geometriaFlange(m) {
  const D = m.largura;
  const contornoExterno = Math.PI * D;
  const contornoCentral = Math.PI * D * FLANGE_FURO_CENTRAL;
  const contornoFuros = m.furos * Math.PI * m.diametro;
  return {
    areaM2: (D * D) / 1000000, // quadrado de chapa onde a flange é cortada
    corteM: (contornoExterno + contornoCentral + contornoFuros) / 1000,
    perfuracoes: m.furos + 2     // furos de fixação + furo central + contorno externo
  };
}

function desenharFlange(m) {
  const D = m.largura;
  const escala = calcularEscala(D, D);
  const raio = (D / 2) * escala;
  const cx = SVG_LARGURA / 2;
  const cy = SVG_ALTURA / 2;
  const x0 = cx - raio;
  const y0 = cy - raio;

  let conteudo = '<circle class="peca-chapa" cx="' + cx + '" cy="' + cy + '" r="' + px(raio) + '"/>';
  // Círculo-guia onde ficam os furos (só referência visual)
  conteudo += '<circle class="peca-guia" cx="' + cx + '" cy="' + cy + '" r="' + px(raio * FLANGE_CIRCULO_FUROS) + '"/>';
  // Furo central
  conteudo += desenharFuro(cx, cy, raio * FLANGE_FURO_CENTRAL);
  // Furos de fixação
  furosFlange(m).forEach(function (furo) {
    conteudo += desenharFuro(x0 + furo.x * escala, y0 + furo.y * escala, (m.diametro / 2) * escala);
  });
  conteudo += cotaHorizontal(x0, x0 + 2 * raio, y0 + 2 * raio + 14, "⌀ " + numeroTexto(D) + " mm");

  const descricao = "Flange circular de " + numeroTexto(D) + " milímetros de diâmetro, furo central de " +
    numeroTexto(D * FLANGE_FURO_CENTRAL) + " milímetros e " + textoFuros(m.furos, m.diametro);
  return envolverSVG(conteudo, descricao);
}

// =============================================================
// 4) CANTONEIRA
//   largura = comprimento da cantoneira
//   altura  = largura de CADA aba (as duas abas são iguais)
// Planificada: uma tira de comprimento x (2 x aba), com a dobra no meio.
// Os furos ficam ao longo do comprimento, só na aba A (em fila; se forem muitos, em duas fileiras).
// =============================================================
function furosCantoneira(m) {
  return furosEmGrade(0, 0, m.largura, m.altura, m.furos);
}

function diametroMaximoCantoneira(m, n) {
  return diametroMaximoGrade(m.largura, m.altura, n);
}

function geometriaCantoneira(m) {
  const larguraTira = 2 * m.altura;
  const perimetro = 2 * (m.largura + larguraTira);
  const contornoFuros = m.furos * Math.PI * m.diametro;
  return {
    areaM2: (m.largura * larguraTira) / 1000000,
    corteM: (perimetro + contornoFuros) / 1000,
    perfuracoes: m.furos + 1 // furos + contorno externo
  };
}

function desenharCantoneira(m) {
  const descricao = "Cantoneira planificada de " + numeroTexto(m.largura) +
    " milímetros de comprimento com abas de " + numeroTexto(m.altura) +
    " milímetros, uma dobra no meio e " + textoFuros(m.furos, m.diametro);
  return desenharRetangulo(m.largura, 2 * m.altura, furosCantoneira(m), m.diametro, [m.altura],
    "2 × " + numeroTexto(m.altura) + " mm", descricao);
}

// =============================================================
// CATÁLOGO DAS PEÇAS
// Cada campo: rotulo, min, max, padrao (e ajuda opcional).
// Campo = null quer dizer que a peça não usa aquele campo.
// =============================================================
const PECAS_MODELO = {
  placa: {
    nome: "Placa retangular com furos",
    nomeCurto: "Placa com furos",
    descricao: "Chapa plana: tampas, bases e espelhos.",
    dobrasPadrao: 0,
    campos: {
      largura: { rotulo: "Largura (mm)", min: 20, max: 3000, padrao: 200 },
      altura: { rotulo: "Altura (mm)", min: 20, max: 1500, padrao: 100 },
      furos: { rotulo: "Quantidade de furos", min: 0, max: 40, padrao: 4 },
      diametro: { rotulo: "Diâmetro dos furos (mm)", min: 3, max: 100, padrao: 10 }
    },
    icone: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="1"/><circle cx="7" cy="10" r="1"/><circle cx="17" cy="10" r="1"/><circle cx="7" cy="14" r="1"/><circle cx="17" cy="14" r="1"/></svg>',
    diametroMaximo: diametroMaximoPlaca,
    geometria: geometriaPlaca,
    desenharSVG: desenharPlaca
  },
  suporte_l: {
    nome: "Suporte em L",
    nomeCurto: "Suporte em L",
    descricao: "Chapa com uma dobra de 90° no meio.",
    dobrasPadrao: 1,
    campos: {
      largura: { rotulo: "Largura (mm)", min: 20, max: 1500, padrao: 80 },
      altura: { rotulo: "Altura total planificada (mm)", min: 40, max: 1500, padrao: 150,
        ajuda: "Aba A + aba B, com a chapa ainda reta. A dobra fica no meio." },
      furos: { rotulo: "Quantidade de furos", min: 0, max: 20, padrao: 4,
        ajuda: "Os furos são divididos entre as duas abas." },
      diametro: { rotulo: "Diâmetro dos furos (mm)", min: 3, max: 50, padrao: 8 }
    },
    icone: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v15h15"/><path d="M9 3v12h12"/></svg>',
    diametroMaximo: diametroMaximoSuporteL,
    geometria: geometriaSuporteL,
    desenharSVG: desenharSuporteL
  },
  flange: {
    nome: "Flange circular",
    nomeCurto: "Flange",
    descricao: "Disco com furo central e furos de fixação.",
    dobrasPadrao: 0,
    campos: {
      largura: { rotulo: "Diâmetro externo (mm)", min: 40, max: 1000, padrao: 150,
        ajuda: "O furo central tem " + Math.round(FLANGE_FURO_CENTRAL * 100) + "% do diâmetro externo." },
      altura: null,
      furos: { rotulo: "Furos de fixação", min: 0, max: 24, padrao: 6,
        ajuda: "Ficam num círculo de " + Math.round(FLANGE_CIRCULO_FUROS * 100) + "% do diâmetro externo." },
      diametro: { rotulo: "Diâmetro dos furos (mm)", min: 3, max: 100, padrao: 12 }
    },
    icone: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="5.5" r="0.8"/><circle cx="12" cy="18.5" r="0.8"/><circle cx="5.5" cy="12" r="0.8"/><circle cx="18.5" cy="12" r="0.8"/></svg>',
    diametroMaximo: diametroMaximoFlange,
    geometria: geometriaFlange,
    desenharSVG: desenharFlange
  },
  cantoneira: {
    nome: "Cantoneira",
    nomeCurto: "Cantoneira",
    descricao: "Perfil comprido em L, com abas iguais.",
    dobrasPadrao: 1,
    campos: {
      largura: { rotulo: "Comprimento (mm)", min: 50, max: 3000, padrao: 500 },
      altura: { rotulo: "Largura de cada aba (mm)", min: 15, max: 200, padrao: 40,
        ajuda: "A chapa reta tem o dobro dessa largura; a dobra fica no meio." },
      furos: { rotulo: "Quantidade de furos", min: 0, max: 30, padrao: 4,
        ajuda: "Os furos ficam ao longo do comprimento, em uma das abas." },
      diametro: { rotulo: "Diâmetro dos furos (mm)", min: 3, max: 50, padrao: 8 }
    },
    icone: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V8l4-4v12h12l-4 4z"/><path d="M4 20l4-4"/></svg>',
    diametroMaximo: diametroMaximoCantoneira,
    geometria: geometriaCantoneira,
    desenharSVG: desenharCantoneira
  }
};

// Ordem dos campos no formulário
const CAMPOS_PECA = ["largura", "altura", "furos", "diametro"];

// Valores iniciais de uma peça (os "padrao" de cada campo)
function medidasPadrao(chavePeca) {
  const peca = PECAS_MODELO[chavePeca];
  const medidas = {};
  CAMPOS_PECA.forEach(function (nome) {
    if (peca.campos[nome]) medidas[nome] = peca.campos[nome].padrao;
  });
  return medidas;
}

// -------------------------------------------------------------
// VALIDAÇÃO DAS MEDIDAS
// Recebe o que o usuário digitou e devolve:
//   medidas: valores corrigidos (dentro do mínimo/máximo e com furos que cabem)
//   avisos:  frases explicando o que foi corrigido (para mostrar na tela)
// -------------------------------------------------------------
function validarMedidasPeca(chavePeca, entrada) {
  const peca = PECAS_MODELO[chavePeca];
  const medidas = {};
  const avisos = [];

  // 1) Cada campo dentro do mínimo e do máximo
  CAMPOS_PECA.forEach(function (nome) {
    const regra = peca.campos[nome];
    if (!regra) return; // campo não usado por esta peça

    let valor = parseFloat(entrada[nome]);
    const nomeCampo = regra.rotulo.replace(" (mm)", "");

    if (isNaN(valor)) {
      valor = regra.padrao;
      avisos.push(nomeCampo + ": campo vazio, usamos " + numeroTexto(valor) + ".");
    }
    if (nome === "furos") {
      valor = Math.round(valor); // não existe meio furo
    }
    if (valor < regra.min) {
      valor = regra.min;
      avisos.push(nomeCampo + ": o mínimo é " + numeroTexto(regra.min) + ", usamos esse valor.");
    } else if (valor > regra.max) {
      valor = regra.max;
      avisos.push(nomeCampo + ": o máximo é " + numeroTexto(regra.max) + ", usamos esse valor.");
    }
    medidas[nome] = valor;
  });

  // 2) Os furos cabem na peça? Se não, diminui a quantidade...
  const diametroMinimo = peca.campos.diametro.min;
  let quantidade = medidas.furos;
  while (quantidade > 0 && peca.diametroMaximo(medidas, quantidade) < diametroMinimo) {
    quantidade = quantidade - 1;
  }
  if (quantidade < medidas.furos) {
    avisos.push("Nessas medidas cabem no máximo " + quantidade + (quantidade === 1 ? " furo" : " furos") + "; usamos essa quantidade.");
    medidas.furos = quantidade;
  }

  // 3) ...e, se preciso, diminui o diâmetro dos furos
  if (medidas.furos > 0) {
    const diametroMaximo = Math.floor(peca.diametroMaximo(medidas, medidas.furos));
    if (medidas.diametro > diametroMaximo) {
      avisos.push("Com " + medidas.furos + (medidas.furos === 1 ? " furo" : " furos") +
        ", o diâmetro máximo é " + diametroMaximo + " mm. Usamos " + diametroMaximo + " mm.");
      medidas.diametro = diametroMaximo;
    }
  }

  return { medidas: medidas, avisos: avisos };
}
