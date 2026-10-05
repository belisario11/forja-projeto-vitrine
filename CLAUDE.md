# Forja — site da startup fictícia (Projeto Vitrine)

Trabalho escolar: cada grupo simula uma startup. Este repositório é o site da nossa.
**Tudo é simulação**: sem backend, sem pagamento real, sem coleta de dados reais.
O nome "Forja" é provisório e fica só em `js/config.js` (`NOME_STARTUP`).

## A startup
- Frase: "Sua peça de metal sob medida, com preço na hora."
- Problema (dois lados): empresas que precisam de peça de metal sob medida esperam dias por orçamento (e a máquina delas fica parada); metalúrgicas pequenas têm máquinas ociosas e vivem de indicação (sem vendedor nem site).
- Solução: marketplace B2B, "o Uber da fabricação". Cliente envia o desenho → recebe preço e prazo na hora → paga → o pedido vai para a parceira da região com a máquina certa e capacidade livre. A plataforma não tem máquinas.
- Preço: tabela de custos combinada com as parceiras (material/kg, corte/m por material e espessura, perfurações, dobras, preparação, acabamento) + margem da plataforma. A metalúrgica não orça.
- Match: filtra parceiras por processo, material e espessura; oferece; a primeira que aceitar leva. Se ninguém aceita, o valor oferecido sobe um pouco (tarifa dinâmica).
- Receita: comissão de 15% a 20% por pedido. Futuro: painel de gestão por assinatura para as metalúrgicas.
- Foco: chapa metálica (corte, dobra, solda) e rede regional em Minas Gerais. Concorrente no Brasil: Mech4u (SP, usinagem CNC).

## Personas
1. **Rafael, 34** — engenheiro de manutenção, indústria de alimentos em Contagem (MG). Peças urgentes de reposição; quer rapidez e previsibilidade.
2. **Seu Antônio, 58** — dono de metalúrgica com 12 funcionários na Grande BH. Laser e dobradeira parados à tarde; sem vendedor nem site. Quer encher a agenda sem gastar com vendas.
3. **Camila, 29** — sócia de startup de equipamentos agrícolas. ~50 peças de protótipo por mês; sem setor de compras.

## Regras do projeto
- Tudo fictício: nenhuma empresa real como parceira. Xometry, Fractory e Mech4u aparecem **só** como referência de mercado. Depoimentos marcados como fictícios.
- Preços, percentuais e prazos **só** em `data/` (nunca espalhados no código). Textos que mostram percentuais usam `<span data-dado="...">` preenchido por `js/comum.js`.
- Dados de mercado sempre com fonte visível ao lado.
- HTML + CSS + JavaScript puros, sem build, sem módulos ES (scripts clássicos com variáveis globais — funciona até abrindo o arquivo direto).
- Código simples e comentado em português (o grupo precisa apresentar e explicar).
- Todo o texto em português do Brasil.
- Acessibilidade: fonte base ~17px, contraste AA, navegação por teclado, `alt`/`aria-label`, nunca depender só de cor, respeitar `prefers-reduced-motion`.
- Antes de entregar: `node --check` em todos os `.js`.
- Git: não rodar `git push` nem alterar a configuração do git (o grupo usa o GitHub Desktop).

## Estrutura de pastas
```
index.html        landing page
orcamento.html    simulador (peças-modelo + DXF) + simulação do match + pedido
parceiro.html     painel simulado da metalúrgica
mercado.html      tese do setor (mesma estrutura de seções do "Ex Setor.pdf")
sobre.html        Projeto Vitrine, equipe, conceito, personas
exemplo.dxf       desenho simples para testar o upload
Ex Setor.pdf      modelo da escola (só a estrutura importa; o tema não é o nosso). Está no .gitignore: fica só no computador
css/estilo.css    estilo base (tokens de cor, layout, componentes)
css/<pagina>.css  estilos específicos de cada página
js/config.js      NOME_STARTUP, FRASE_STARTUP, AVISO_FICTICIO
js/comum.js       nome da startup nas páginas, data-dado, menu mobile, formatarReais()
js/calculo.js     calcularOrcamento(entrada) — fórmula pura do preço
js/pecas.js       peças-modelo: geometria + desenho SVG
js/dxf.js         leitura do DXF no navegador (comprimento de corte, contornos, retângulo)
js/orcamento.js   liga o formulário ao cálculo e à tela
js/match.js       filtro das parceiras, animação, aceite, linha do tempo do pedido
js/parceiro.js    painel da metalúrgica
js/vendor/dxf-parser.js  cópia local da biblioteca (reserva se o CDN falhar)
data/precos.js    PRECOS (todos os valores simulados)
data/materiais.js MATERIAIS (densidade e espessuras)
data/parceiros.js PROCESSOS, PARCEIROS (fictícios), PAINEL_PARCEIRO
img/              favicon e ícones SVG
```

## Ordem dos scripts em toda página
```html
<script src="js/config.js"></script>
<script src="data/precos.js"></script>
<script src="data/materiais.js"></script>
<script src="data/parceiros.js"></script>
<script src="js/comum.js"></script>
<!-- depois os scripts específicos da página -->
```

## Modelo de cabeçalho e rodapé (igual em todas as páginas)
- `<html lang="pt-BR">`, título no formato `Forja · <Página>` (o "Forja" é trocado por `NOME_STARTUP` via JS).
- Fontes Google: Barlow Condensed (600/700/800) + Inter (400/600/700); `css/estilo.css` + `css/<pagina>.css`.
- Primeiro elemento do body: `<a class="pular-link" href="#conteudo">Pular para o conteúdo</a>`.
- Cabeçalho `.cabecalho` > `.container` com: logo `.logo` (SVG da faísca `aria-hidden` + `<span class="js-nome">Forja</span>`), botão `.menu-botao` (`aria-expanded="false"`, `aria-controls="menu-principal"`), e `<nav id="menu-principal" class="menu" aria-label="Menu principal">` com links Início, Como funciona (index.html#como-funciona), Para metalúrgicas (parceiro.html), Mercado, Sobre e um link `.menu-cta` "Fazer orçamento" (orcamento.html). Link da página atual com `aria-current="page"`.
- `<main id="conteudo">`.
- Rodapé `.rodape` com logo, links, e `<p class="rodape-aviso js-aviso">Startup fictícia criada para o Projeto Vitrine</p>`.
- O arquivo `index.html` é a referência de marcação: copie o cabeçalho e o rodapé dele.

## Como rodar
`python -m http.server 8000` na pasta e abrir http://localhost:8000. Publicação: GitHub Pages (Settings → Pages → branch `main`, pasta `/root`).
