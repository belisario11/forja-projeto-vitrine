# Forja — site da startup fictícia (Projeto Vitrine)

> **Startup fictícia criada para um trabalho escolar.** Preços, metalúrgicas parceiras, pedidos e depoimentos são simulados. Nenhum dado é coletado e nenhum pagamento é real.

**"Sua peça de metal sob medida, com preço na hora."**

A Forja (nome provisório) é um marketplace B2B (venda de empresa para empresa), "o Uber da fabricação": a empresa envia o desenho da peça de metal, recebe preço e prazo na hora, paga, e o pedido vai para a metalúrgica parceira da região que tem a máquina certa e está com capacidade livre. A plataforma não tem máquinas, assim como o Uber não tem carros.

## Páginas

| Arquivo | O que tem |
|---|---|
| `index.html` | Página inicial: problema, solução, como funciona, números do mercado |
| `orcamento.html` | Simulador: peças-modelo ou arquivo DXF → preço na hora → pedido → escolha da metalúrgica (match) → linha do tempo do pedido |
| `parceiro.html` | Painel simulado da metalúrgica: ofertas chegando, aceitar/recusar, ocupação das máquinas |
| `mercado.html` | Tese do setor (mesma estrutura do modelo "Ex Setor.pdf"), com fontes |
| `sobre.html` | Projeto Vitrine, equipe, conceito da ideia, personas e concorrência |

Tudo é HTML, CSS e JavaScript puros: sem *build*, sem framework, sem instalar nada.

## Como rodar no computador

Na pasta do projeto, abra um terminal e rode:

```
python -m http.server 8000
```

Depois abra **http://localhost:8000** no navegador. Para parar o servidor, aperte `Ctrl + C` no terminal.

Também dá para abrir os arquivos `.html` direto (duplo clique, endereço `file://`). Tudo funciona, **exceto** o botão "Usar o arquivo de exemplo" do orçamento: por segurança, o navegador não deixa a página buscar outro arquivo quando ela é aberta assim. Nesse caso, use o servidor acima, ou clique em "Baixar arquivo de exemplo" e envie o `exemplo.dxf` pelo botão "Escolher arquivo .dxf".

## Como publicar no GitHub Pages

1. Envie os arquivos para o repositório no GitHub (pelo GitHub Desktop: *Commit* e depois *Push origin*).
2. No site do GitHub, abra o repositório e vá em **Settings → Pages**.
3. Em *Build and deployment*, escolha **Source: Deploy from a branch**.
4. Em *Branch*, escolha **main** e a pasta **/ (root)**. Clique em **Save**.
5. Espere um ou dois minutos. O site fica em:
   `https://<usuario>.github.io/forja-projeto-vitrine/`
   (troque `<usuario>` pelo nome de usuário do GitHub dono do repositório).

## Onde mudar cada coisa

| Quero mudar... | Arquivo |
|---|---|
| O nome da startup, a frase e o aviso de "fictícia" | `js/config.js` (`NOME_STARTUP`, `FRASE_STARTUP`, `AVISO_FICTICIO`). O nome muda em todas as páginas sozinho. |
| Preços, comissão, pedido mínimo, prazos, acréscimo do expresso, tarifa dinâmica | `data/precos.js` |
| Materiais (densidade e espessuras de chapa) | `data/materiais.js` |
| Metalúrgicas parceiras (fictícias) e os números do painel da metalúrgica | `data/parceiros.js` (`PARCEIROS` e `PAINEL_PARCEIRO`) |
| Nomes da equipe | `sobre.html`, seção "Equipe" (há um comentário "COMO EDITAR A EQUIPE" explicando; depois apague o aviso "Nomes em ordem alfabética — preencher") |
| Peças-modelo do simulador | `js/pecas.js` |
| A fórmula do preço | `js/calculo.js` (`calcularOrcamento`) |
| Cores, fontes e componentes | `css/estilo.css` (geral) e `css/<pagina>.css` (cada página) |

Regra do projeto: nenhum preço, percentual ou prazo fica escrito no HTML ou no JavaScript das páginas. Eles moram em `data/` e aparecem nos textos por meio de `<span data-dado="...">`, preenchido por `js/comum.js`.

## Truque para a apresentação: tarifa dinâmica

Abra **`orcamento.html?tarifa-dinamica`** (ex.: `http://localhost:8000/orcamento.html?tarifa-dinamica`) e faça um pedido. Na primeira rodada nenhuma metalúrgica aceita; o valor oferecido à metalúrgica sobe (o percentual vem de `data/precos.js`) e só então uma parceira aceita. O cliente continua pagando o mesmo total: o aumento sai da margem da plataforma.

## Dicas para a apresentação

- **Teste antes**, no mesmo computador e navegador da apresentação, com o servidor ligado (`python -m http.server 8000`) ou já publicado no GitHub Pages.
- **Roteiro sugerido (cerca de 5 minutos):** página inicial (problema dos dois lados) → orçamento com uma peça-modelo (mude a quantidade e o material e mostre o preço mudando na hora) → "Usar o arquivo de exemplo" (mostra a leitura do DXF) → "Fazer pedido" (match) → "Avançar status" até "Entregue" → painel da metalúrgica (aceitar uma oferta) → página Mercado (números com fonte).
- **Explique a tabela "Como chegamos nesse preço"**: mostra que o preço vem de custos combinados com as parceiras + a comissão da plataforma.
- **Mostre a tarifa dinâmica** com o endereço `?tarifa-dinamica` (veja acima).
- **Na página Mercado**, cite sempre a fonte de cada número (Xometry, Fractory, CNI, Banco Central, Instituto Aço Brasil).
- **Deixe claro que é simulação**: as metalúrgicas, os pedidos e os depoimentos são fictícios. Xometry, Fractory e Mech4u aparecem só como referência de mercado, não como parceiras.
- **Acessibilidade**: dá para usar todo o site só com o teclado (Tab, Enter, setas nas abas do orçamento). Vale mostrar.
- **Se a internet cair**: o site funciona sem internet, exceto as fontes do Google (o navegador usa uma fonte parecida). A biblioteca que lê o DXF tem uma cópia local em `js/vendor/`.

## Estrutura de pastas

```
index.html, orcamento.html, parceiro.html, mercado.html, sobre.html
exemplo.dxf          desenho simples para testar o envio de DXF
css/estilo.css       estilo base (cores, layout, componentes)
css/<pagina>.css     estilos de cada página
js/config.js         nome, frase e aviso da startup
js/comum.js          funções usadas em todas as páginas (nome, data-dado, menu, formatação)
js/calculo.js        fórmula do preço
js/pecas.js          peças-modelo (geometria e desenho)
js/dxf.js            leitura do arquivo DXF no navegador
js/orcamento.js      liga o formulário do orçamento ao cálculo e à tela
js/match.js          escolha da metalúrgica e linha do tempo do pedido
js/parceiro.js       painel da metalúrgica
js/vendor/           cópia local da biblioteca dxf-parser
data/                preços, materiais e parceiras (valores simulados)
img/                 favicon
```

## Antes de entregar

Confira a sintaxe de todos os scripts (precisa do Node.js instalado):

```
node --check js/calculo.js
```

(repita para cada arquivo em `js/`, menos `js/vendor/`).
