// =============================================================
// LEITURA DE ARQUIVOS DXF NO NAVEGADOR
//
// DXF é um formato de desenho técnico (usado por AutoCAD, LibreCAD,
// SolidWorks etc.). Ele é um arquivo de texto com uma lista de
// "entidades": linhas (LINE), arcos (ARC), círculos (CIRCLE) e
// polilinhas (LWPOLYLINE / POLYLINE).
//
// Este arquivo faz três coisas:
//   1. carregarBibliotecaDXF() -> baixa a biblioteca dxf-parser só
//      quando o usuário envia um arquivo (CDN; se falhar, cópia local).
//   2. lerArquivoDXF(arquivo)  -> lê o arquivo escolhido como texto.
//   3. analisarDXF(texto)      -> calcula o que o preço precisa:
//        - comprimento total de corte (em metros);
//        - número de perfurações (contornos fechados);
//        - tamanho do retângulo que envolve a peça;
//        - um desenho SVG para mostrar na tela.
//
// Combinado: as medidas do desenho estão em MILÍMETROS.
// =============================================================

// ---------- Limites (regras da máquina, não são preços) ----------

// Tamanho da mesa do laser das parceiras: 3000 x 1500 mm.
const DXF_MESA_COMPRIMENTO_MM = 3000;
const DXF_MESA_LARGURA_MM = 1500;

// Tamanho máximo do arquivo aceito: 5 MB.
const DXF_TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024;

// Duas pontas a menos de 0,01 mm uma da outra contam como "encostadas".
const DXF_TOLERANCIA_MM = 0.01;

// Endereços da biblioteca: primeiro a internet (CDN), depois a cópia local.
const DXF_URL_CDN = "https://cdn.jsdelivr.net/npm/dxf-parser@1.1.2/dist/dxf-parser.js";
const DXF_URL_LOCAL = "js/vendor/dxf-parser.js";
const DXF_TEMPO_LIMITE_MS = 8000;

// Mensagem usada quando o arquivo não pode ser lido.
const DXF_ERRO_ILEGIVEL =
  "Não conseguimos ler este arquivo. Ele pode estar corrompido ou em formato DXF binário. " +
  "Tente exportar como DXF ASCII (texto) no seu programa de desenho, ou use as peças-modelo.";


// =============================================================
// 1. CARREGAR A BIBLIOTECA
// =============================================================

// Guardamos a promessa para não baixar a biblioteca duas vezes.
let promessaBibliotecaDXF = null;

// Coloca um <script src="..."> na página e avisa quando terminou.
// Se demorar mais que o tempo limite, desiste.
function injetarScriptDXF(endereco) {
  return new Promise(function (resolver, rejeitar) {
    const script = document.createElement("script");
    script.src = endereco;
    script.async = true;

    const relogio = setTimeout(function () {
      rejeitar(new Error("Tempo esgotado ao carregar " + endereco));
    }, DXF_TEMPO_LIMITE_MS);

    script.addEventListener("load", function () {
      clearTimeout(relogio);
      if (window.DxfParser) {
        resolver();
      } else {
        rejeitar(new Error("A biblioteca não foi encontrada em " + endereco));
      }
    });

    script.addEventListener("error", function () {
      clearTimeout(relogio);
      rejeitar(new Error("Falha ao carregar " + endereco));
    });

    document.head.appendChild(script);
  });
}

// Garante que window.DxfParser existe.
// Tenta o CDN; se der erro, tenta a cópia local; se as duas falharem, rejeita.
function carregarBibliotecaDXF() {
  // Já carregada antes? Pronto.
  if (window.DxfParser) {
    return Promise.resolve();
  }
  // Já está carregando? Devolve a mesma promessa.
  if (promessaBibliotecaDXF) {
    return promessaBibliotecaDXF;
  }

  promessaBibliotecaDXF = injetarScriptDXF(DXF_URL_CDN)
    .catch(function () {
      // O CDN falhou (sem internet, bloqueado...). Tentamos a cópia local.
      return injetarScriptDXF(DXF_URL_LOCAL);
    })
    .catch(function () {
      // As duas falharam: limpamos a promessa para permitir tentar de novo.
      promessaBibliotecaDXF = null;
      throw new Error(
        "Não conseguimos carregar o leitor de DXF. Verifique sua conexão e tente de novo, ou use as peças-modelo."
      );
    });

  return promessaBibliotecaDXF;
}


// =============================================================
// 2. LER O ARQUIVO ESCOLHIDO PELO USUÁRIO
// =============================================================

// Recebe o "File" do <input type="file"> e devolve uma promessa com o texto.
function lerArquivoDXF(arquivo) {
  return new Promise(function (resolver, rejeitar) {
    if (!arquivo) {
      rejeitar(new Error("Nenhum arquivo foi escolhido."));
      return;
    }

    const nome = String(arquivo.name || "").toLowerCase();
    if (nome.slice(-4) !== ".dxf") {
      rejeitar(new Error("O arquivo precisa ter a extensão .dxf. Exporte o desenho como DXF no seu programa de desenho."));
      return;
    }

    if (arquivo.size > DXF_TAMANHO_MAXIMO_BYTES) {
      rejeitar(new Error("O arquivo é grande demais (máximo de 5 MB). Envie só o desenho da peça, sem carimbos ou outras folhas."));
      return;
    }

    if (arquivo.size === 0) {
      rejeitar(new Error("O arquivo está vazio."));
      return;
    }

    const leitor = new FileReader();
    leitor.addEventListener("load", function () {
      resolver(String(leitor.result));
    });
    leitor.addEventListener("error", function () {
      rejeitar(new Error("Não conseguimos abrir o arquivo. Tente escolher de novo."));
    });
    leitor.readAsText(arquivo);
  });
}


// =============================================================
// 3. ANALISAR O DESENHO
// =============================================================

// ---------- Pequenas funções de geometria ----------

const DXF_DOIS_PI = 2 * Math.PI;

// Distância entre dois pontos {x, y}.
function distanciaDXF(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Ponto de um círculo no ângulo dado (em radianos).
function pontoNoArcoDXF(centro, raio, angulo) {
  return {
    x: centro.x + raio * Math.cos(angulo),
    y: centro.y + raio * Math.sin(angulo)
  };
}

// Um ARC do DXF vai do ângulo inicial ao final no sentido anti-horário.
// Se o final for menor que o inicial (ex.: de 350° a 10°), o arco
// "passa pelo zero": somamos uma volta inteira. Resultado entre 0 e 2π.
function varreduraDoArcoDXF(inicio, fim) {
  let varredura = fim - inicio;
  while (varredura <= 0) {
    varredura += DXF_DOIS_PI;
  }
  while (varredura > DXF_DOIS_PI) {
    varredura -= DXF_DOIS_PI;
  }
  return varredura;
}

// Converte um trecho de polilinha com "bulge" (barriga) em um arco.
// O bulge b diz o quanto o trecho entre dois vértices é curvo:
//   b = 0 -> reta;  b = 1 -> meia-volta;  b > 0 anti-horário; b < 0 horário.
// Ângulo do arco: θ = 4·atan(b). Raio: r = corda / (2·sen(θ/2)).
// Devolve { centro, raio, inicio, varredura } com varredura POSITIVA
// (sempre anti-horária), para tratar igual a um ARC comum.
function arcoDoBulgeDXF(p1, p2, bulge) {
  const corda = distanciaDXF(p1, p2);
  const theta = 4 * Math.atan(bulge); // com sinal
  const raio = corda / (2 * Math.abs(Math.sin(theta / 2)));

  // O centro fica na reta perpendicular à corda, passando pelo meio dela.
  // Distância (com sinal) do meio da corda até o centro: corda·(1 - b²)/(4b).
  const meio = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const normalX = -(p2.y - p1.y) / corda; // vetor perpendicular, à esquerda
  const normalY = (p2.x - p1.x) / corda;
  const deslocamento = corda * (1 - bulge * bulge) / (4 * bulge);
  const centro = { x: meio.x + normalX * deslocamento, y: meio.y + normalY * deslocamento };

  // Se o arco é horário (b < 0), invertemos: começamos no p2 e vamos
  // no sentido anti-horário até p1. O desenho fica exatamente o mesmo.
  let partida = p1;
  if (bulge < 0) {
    partida = p2;
  }
  const inicio = Math.atan2(partida.y - centro.y, partida.x - centro.x);

  return { centro: centro, raio: raio, inicio: inicio, varredura: Math.abs(theta) };
}

// ---------- Retângulo envolvente (bounding box) ----------

function novoRetanguloDXF() {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

function incluirPontoDXF(ret, p) {
  if (p.x < ret.minX) ret.minX = p.x;
  if (p.y < ret.minY) ret.minY = p.y;
  if (p.x > ret.maxX) ret.maxX = p.x;
  if (p.y > ret.maxY) ret.maxY = p.y;
}

// Um arco pode ir além das pontas: um arco de 350° a 10° passa pelo
// ponto mais à direita do círculo (0°). Por isso incluímos as duas pontas
// e também os pontos de 0°, 90°, 180° e 270° que estiverem dentro do arco.
function incluirArcoDXF(ret, centro, raio, inicio, varredura) {
  incluirPontoDXF(ret, pontoNoArcoDXF(centro, raio, inicio));
  incluirPontoDXF(ret, pontoNoArcoDXF(centro, raio, inicio + varredura));

  for (let k = 0; k < 4; k++) {
    const angulo = k * Math.PI / 2;
    // Quanto falta, girando no sentido anti-horário, do início até este ângulo?
    let falta = angulo - inicio;
    while (falta < 0) falta += DXF_DOIS_PI;
    while (falta >= DXF_DOIS_PI) falta -= DXF_DOIS_PI;
    if (falta <= varredura) {
      incluirPontoDXF(ret, pontoNoArcoDXF(centro, raio, angulo));
    }
  }
}

// ---------- Desenho SVG ----------

// Números curtos no SVG (3 casas decimais bastam para milímetros).
function numeroSvgDXF(n) {
  return String(Math.round(n * 1000) / 1000);
}

// No DXF o eixo Y cresce para CIMA; no SVG, para BAIXO.
// Por isso escrevemos sempre -y (espelhamos o desenho na vertical).
function pontoSvgDXF(p) {
  return numeroSvgDXF(p.x) + " " + numeroSvgDXF(-p.y);
}

// Comando de arco do SVG (A) a partir de um arco anti-horário do DXF.
// Depois de espelhar o Y, "anti-horário" vira sweep-flag = 0.
function comandoArcoSvgDXF(centro, raio, inicio, varredura) {
  const fim = pontoNoArcoDXF(centro, raio, inicio + varredura);
  const arcoGrande = varredura > Math.PI ? 1 : 0;
  return "A " + numeroSvgDXF(raio) + " " + numeroSvgDXF(raio) + " 0 " + arcoGrande + " 0 " + pontoSvgDXF(fim);
}

// ---------- Contornos fechados (perfurações) ----------
//
// "Perfurações" = número de contornos fechados do desenho, INCLUINDO o
// contorno de fora da peça. Cada contorno fechado exige que o laser fure
// a chapa uma vez para começar a cortar.
//
// Círculos e polilinhas marcadas como fechadas já são um contorno cada.
// Já linhas e arcos soltos precisam ser "emendados": se cada ponta encosta
// em outra ponta, o contorno fecha. Para isso montamos um "mapa de pontas":
//   - cada ponta (arredondada para a grade de 0,01 mm) é um nó;
//   - cada linha/arco é uma ligação entre dois nós;
//   - um grupo de peças ligadas é um contorno FECHADO se em todos os nós
//     chegam exatamente um número par de ligações (2, 4...). Se algum nó
//     tem só 1 ligação, existe uma ponta solta: o contorno está aberto.

// Transforma um ponto em um "nome" de nó, arredondando para 0,01 mm.
function chaveDoPontoDXF(p) {
  const x = Math.round(p.x / DXF_TOLERANCIA_MM);
  const y = Math.round(p.y / DXF_TOLERANCIA_MM);
  return x + "," + y;
}

// Recebe a lista de ligações [{a: ponto, b: ponto}] e conta os contornos fechados.
function contarContornosFechadosDXF(ligacoes) {
  const vizinhos = {}; // nó -> lista de nós ligados a ele
  const grau = {};     // nó -> quantas pontas de peças chegam nele

  ligacoes.forEach(function (lig) {
    const a = chaveDoPontoDXF(lig.a);
    const b = chaveDoPontoDXF(lig.b);
    if (!vizinhos[a]) { vizinhos[a] = []; grau[a] = 0; }
    if (!vizinhos[b]) { vizinhos[b] = []; grau[b] = 0; }
    vizinhos[a].push(b);
    vizinhos[b].push(a);
    // Cada peça tem duas pontas. Se as duas caem no mesmo nó
    // (ex.: um arco que começa e termina no mesmo lugar), o nó ganha 2.
    grau[a] += 1;
    grau[b] += 1;
  });

  // Percorremos cada grupo de nós ligados (busca em largura).
  const visitado = {};
  let fechados = 0;

  Object.keys(vizinhos).forEach(function (inicio) {
    if (visitado[inicio]) {
      return;
    }
    let todosPares = true;
    const fila = [inicio];
    visitado[inicio] = true;

    while (fila.length > 0) {
      const no = fila.shift();
      if (grau[no] < 2 || grau[no] % 2 !== 0) {
        todosPares = false; // ponta solta ou bifurcação estranha
      }
      vizinhos[no].forEach(function (outro) {
        if (!visitado[outro]) {
          visitado[outro] = true;
          fila.push(outro);
        }
      });
    }

    if (todosPares) {
      fechados += 1;
    }
  });

  return fechados;
}

// ---------- Análise principal ----------

// Recebe o texto do arquivo DXF e devolve as medidas da peça.
// Precisa que a biblioteca já esteja carregada (carregarBibliotecaDXF).
function analisarDXF(texto) {
  // No navegador a biblioteca fica em window.DxfParser;
  // nos testes com Node, em globalThis.DxfParser.
  let Leitor = null;
  if (typeof window !== "undefined" && window.DxfParser) {
    Leitor = window.DxfParser;
  } else if (typeof globalThis !== "undefined" && globalThis.DxfParser) {
    Leitor = globalThis.DxfParser;
  }
  if (!Leitor) {
    throw new Error("O leitor de DXF ainda não foi carregado. Tente de novo em alguns segundos.");
  }

  if (typeof texto !== "string" || texto.trim() === "") {
    throw new Error("O arquivo está vazio.");
  }
  // DXF binário começa com este texto; a biblioteca só lê DXF de texto.
  if (texto.indexOf("AutoCAD Binary DXF") === 0) {
    throw new Error(DXF_ERRO_ILEGIVEL);
  }

  // 1) A biblioteca transforma o texto em uma lista de entidades.
  let desenho;
  try {
      desenho = new Leitor().parseSync(texto);
  } catch (erro) {
    throw new Error(DXF_ERRO_ILEGIVEL);
  }
  if (!desenho || !Array.isArray(desenho.entities)) {
    throw new Error(DXF_ERRO_ILEGIVEL);
  }

  // 2) Percorremos as entidades somando o corte, o retângulo e o SVG.
  let corteMm = 0;
  let perfuracoes = 0;
  const ligacoesSoltas = []; // pontas de linhas, arcos e polilinhas abertas
  const ret = novoRetanguloDXF();
  const partesSvg = [];
  const contagem = { LINE: 0, ARC: 0, CIRCLE: 0, LWPOLYLINE: 0, ignoradas: 0 };
  const ignoradasPorTipo = {};

  // Se alguma entidade vier incompleta (ex.: círculo sem raio), a conta
  // quebraria no meio. O try/catch transforma isso na mensagem amigável.
  try {
  desenho.entities.forEach(function (ent) {
    if (ent.inPaperSpace) {
      // Espaço de papel = folha de impressão (moldura, carimbo, notas).
      // Não faz parte da peça, então não entra no corte.
      contagem.ignoradas += 1;
      ignoradasPorTipo["do espaço de papel"] = (ignoradasPorTipo["do espaço de papel"] || 0) + 1;

    } else if (ent.type === "LINE") {
      const p1 = ent.vertices[0];
      const p2 = ent.vertices[1];
      contagem.LINE += 1;
      corteMm += distanciaDXF(p1, p2);
      incluirPontoDXF(ret, p1);
      incluirPontoDXF(ret, p2);
      ligacoesSoltas.push({ a: p1, b: p2 });
      partesSvg.push('<path d="M ' + pontoSvgDXF(p1) + " L " + pontoSvgDXF(p2) + '"/>');

    } else if (ent.type === "CIRCLE") {
      contagem.CIRCLE += 1;
      corteMm += DXF_DOIS_PI * ent.radius;
      perfuracoes += 1; // um círculo é sempre um contorno fechado
      incluirPontoDXF(ret, { x: ent.center.x - ent.radius, y: ent.center.y - ent.radius });
      incluirPontoDXF(ret, { x: ent.center.x + ent.radius, y: ent.center.y + ent.radius });
      partesSvg.push(
        '<circle cx="' + numeroSvgDXF(ent.center.x) + '" cy="' + numeroSvgDXF(-ent.center.y) +
        '" r="' + numeroSvgDXF(ent.radius) + '"/>'
      );

    } else if (ent.type === "ARC") {
      contagem.ARC += 1;
      const varredura = varreduraDoArcoDXF(ent.startAngle, ent.endAngle);
      corteMm += ent.radius * varredura;
      incluirArcoDXF(ret, ent.center, ent.radius, ent.startAngle, varredura);

      if (Math.abs(varredura - DXF_DOIS_PI) < 1e-9) {
        // Arco de volta inteira = um círculo.
        perfuracoes += 1;
        partesSvg.push(
          '<circle cx="' + numeroSvgDXF(ent.center.x) + '" cy="' + numeroSvgDXF(-ent.center.y) +
          '" r="' + numeroSvgDXF(ent.radius) + '"/>'
        );
      } else {
        const ini = pontoNoArcoDXF(ent.center, ent.radius, ent.startAngle);
        const fim = pontoNoArcoDXF(ent.center, ent.radius, ent.startAngle + varredura);
        ligacoesSoltas.push({ a: ini, b: fim });
        partesSvg.push(
          '<path d="M ' + pontoSvgDXF(ini) + " " +
          comandoArcoSvgDXF(ent.center, ent.radius, ent.startAngle, varredura) + '"/>'
        );
      }

    } else if ((ent.type === "LWPOLYLINE" || ent.type === "POLYLINE") && ent.vertices && ent.vertices.length >= 2 &&
               !ent.is3dPolygonMesh && !ent.isPolyfaceMesh) {
      // (Malhas 3D também usam POLYLINE, mas não são contornos: ficam de fora.)
      // Contamos POLYLINE junto com LWPOLYLINE (são a mesma ideia).
      contagem.LWPOLYLINE += 1;
      const v = ent.vertices;
      const fechada = ent.shape === true;
      let caminho = "M " + pontoSvgDXF(v[0]);
      incluirPontoDXF(ret, v[0]);

      // Quantos trechos? Aberta: n-1. Fechada: n (o último volta ao primeiro).
      const trechos = fechada ? v.length : v.length - 1;
      for (let i = 0; i < trechos; i++) {
        const p1 = v[i];
        const p2 = v[(i + 1) % v.length];
        const bulge = p1.bulge || 0;
        incluirPontoDXF(ret, p2);

        if (bulge === 0 || distanciaDXF(p1, p2) === 0) {
          // Trecho reto.
          corteMm += distanciaDXF(p1, p2);
          caminho += " L " + pontoSvgDXF(p2);
        } else {
          // Trecho curvo: comprimento do arco = θ·r.
          const arco = arcoDoBulgeDXF(p1, p2, bulge);
          corteMm += arco.raio * arco.varredura;
          incluirArcoDXF(ret, arco.centro, arco.raio, arco.inicio, arco.varredura);
          // No SVG desenhamos de p1 para p2: o sentido depende do sinal do bulge.
          const arcoGrande = arco.varredura > Math.PI ? 1 : 0;
          const sentido = bulge > 0 ? 0 : 1; // Y espelhado inverte o sentido
          caminho += " A " + numeroSvgDXF(arco.raio) + " " + numeroSvgDXF(arco.raio) +
            " 0 " + arcoGrande + " " + sentido + " " + pontoSvgDXF(p2);
        }
      }

      if (fechada) {
        perfuracoes += 1;
        caminho += " Z";
      } else {
        // Polilinha aberta: suas duas pontas entram no mapa de pontas.
        ligacoesSoltas.push({ a: v[0], b: v[v.length - 1] });
      }
      partesSvg.push('<path d="' + caminho + '"/>');

    } else {
      // Textos, cotas, splines, blocos, hachuras... não são cortados.
      contagem.ignoradas += 1;
      const tipo = ent.type || "desconhecido";
      ignoradasPorTipo[tipo] = (ignoradasPorTipo[tipo] || 0) + 1;
    }
  });
  } catch (erro) {
    throw new Error(DXF_ERRO_ILEGIVEL);
  }
  // Se algum número veio faltando, a soma vira NaN ("não é número").
  if (!isFinite(corteMm)) {
    throw new Error(DXF_ERRO_ILEGIVEL);
  }

  // 3) Avisos sobre o que deixamos de fora.
  const avisos = [];
  Object.keys(ignoradasPorTipo).forEach(function (tipo) {
    const n = ignoradasPorTipo[tipo];
    // "do espaço de papel" não é um tipo, então a frase muda um pouco.
    const descricao = tipo === "do espaço de papel" ? tipo : "do tipo " + tipo;
    if (n === 1) {
      avisos.push("1 entidade " + descricao + " foi ignorada");
    } else {
      avisos.push(n + " entidades " + descricao + " foram ignoradas");
    }
  });
  if (ignoradasPorTipo.SPLINE || ignoradasPorTipo.ELLIPSE) {
    avisos.push("Curvas SPLINE e ELLIPSE não são lidas: converta-as em arcos ou polilinhas no programa de desenho");
  }
  if (ignoradasPorTipo.INSERT) {
    avisos.push("Blocos (INSERT) não são lidos: \"exploda\" os blocos no programa de desenho antes de exportar");
  }
  // Unidade do arquivo: 4 = milímetros. 0 = sem unidade (aceitamos como mm).
  const unidade = desenho.header ? desenho.header.$INSUNITS : undefined;
  if (unidade !== undefined && unidade !== 0 && unidade !== 4) {
    avisos.push("O arquivo indica uma unidade diferente de milímetros; consideramos todas as medidas em milímetros");
  }

  const suportadas = contagem.LINE + contagem.ARC + contagem.CIRCLE + contagem.LWPOLYLINE;
  if (suportadas === 0) {
    throw new Error(
      "Não encontramos linhas, arcos, círculos ou polilinhas neste desenho. " +
      "Verifique se a peça não está dentro de um bloco ou feita só de splines, ou use as peças-modelo."
    );
  }

  // 4) Os contornos feitos de peças soltas (linhas e arcos emendados).
  perfuracoes += contarContornosFechadosDXF(ligacoesSoltas);

  // 5) Tamanho da peça e verificação da mesa do laser.
  const larguraMm = ret.maxX - ret.minX;
  const alturaMm = ret.maxY - ret.minY;

  if (!(larguraMm > 0) || !(alturaMm > 0)) {
    throw new Error("O desenho não tem tamanho (largura ou altura zero). Confira se ele está em 2D e em milímetros.");
  }
  // A peça pode ser girada na mesa: comparamos o lado maior com 3000 mm
  // e o lado menor com 1500 mm.
  const ladoMaior = Math.max(larguraMm, alturaMm);
  const ladoMenor = Math.min(larguraMm, alturaMm);
  if (ladoMaior > DXF_MESA_COMPRIMENTO_MM || ladoMenor > DXF_MESA_LARGURA_MM) {
    throw new Error(
      "A peça é maior que a mesa do laser (" + DXF_MESA_COMPRIMENTO_MM + " × " + DXF_MESA_LARGURA_MM + " mm). " +
      "Confira se o desenho está em milímetros."
    );
  }

  // 6) Monta o SVG. A "janela" (viewBox) é o retângulo da peça com uma
  //    pequena margem. Como espelhamos o Y, o topo da janela é -maxY.
  const margem = Math.max(larguraMm, alturaMm) * 0.05;
  const viewBox = [
    numeroSvgDXF(ret.minX - margem),
    numeroSvgDXF(-ret.maxY - margem),
    numeroSvgDXF(larguraMm + 2 * margem),
    numeroSvgDXF(alturaMm + 2 * margem)
  ].join(" ");

  // vector-effect="non-scaling-stroke": a linha fica com a mesma
  // espessura na tela, seja a peça pequena ou grande. Esse atributo não
  // passa do <g> para os filhos, então o replace() abaixo o coloca em
  // cada <path> e <circle>.
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + viewBox + '" ' +
    'role="img" aria-label="Pré-visualização do desenho DXF" focusable="false">' +
    '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
    'stroke-linejoin="round">' +
    partesSvg.join("").replace(/<(path|circle) /g, '<$1 vector-effect="non-scaling-stroke" ') +
    "</g></svg>";

  return {
    corteM: corteMm / 1000,
    perfuracoes: perfuracoes,
    larguraMm: larguraMm,
    alturaMm: alturaMm,
    areaM2: (larguraMm / 1000) * (alturaMm / 1000),
    contagem: contagem,
    avisos: avisos,
    svg: svg
  };
}

// Permite usar analisarDXF em testes com Node (no navegador isso é ignorado).
if (typeof module !== "undefined" && module.exports) {
  module.exports = { analisarDXF: analisarDXF };
}
