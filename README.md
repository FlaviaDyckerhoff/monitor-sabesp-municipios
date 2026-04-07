# 🏛️ Monitor SABESP — Proposituras Municipais

Monitor automático de proposituras de câmaras municipais com foco em temas relacionados à SABESP e saneamento básico. Roda via GitHub Actions 4x/dia, sem custo.

---

## Como funciona

1. A cada execução, o monitor lê `municipios.json` e busca as proposituras do ano corrente em cada câmara cadastrada
2. Compara com o `estado.json` para identificar apenas as **novas** desde a última verificação
3. Destaca em amarelo as ementas que contêm palavras de `keywords.json`
4. Envia **um único email consolidado** com todas as câmaras, separando as proposituras com keywords das demais

---

## Estrutura do repositório

```
monitor-sabesp-municipios/
├── monitor.js            ← orquestrador central (não editar)
├── keywords.json         ← palavras-chave de interesse (editar aqui)
├── municipios.json       ← câmaras monitoradas (editar aqui)
├── estado.json           ← IDs já vistos por município (gerado automaticamente)
├── package.json
├── parsers/
│   ├── sino-siscam.js    ← câmaras com sistema SINO Siscam
│   └── sapl.js           ← câmaras com sistema SAPL
└── .github/workflows/
    └── monitor.yml       ← agendamento e execução
```

---

## Configuração inicial

### 1. Criar repositório privado no GitHub

Nome sugerido: `monitor-sabesp-municipios`

### 2. Adicionar Secrets no GitHub

`Settings → Secrets and variables → Actions → New repository secret`

| Secret | Descrição |
|---|---|
| `EMAIL_REMETENTE` | Endereço Gmail usado para enviar |
| `EMAIL_SENHA` | App Password do Gmail (16 chars, sem espaços) |
| `EMAIL_DESTINO` | Endereço que vai receber os alertas |

> Para gerar um App Password Gmail: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)

### 3. Fazer upload dos arquivos

Suba todos os arquivos mantendo a estrutura de pastas, especialmente a pasta `parsers/`.

### 4. Testar manualmente

`Actions → Monitor SABESP → Run workflow`

---

## Editar palavras-chave

Abra `keywords.json` e edite a lista. Não precisa mexer em nenhum outro arquivo.

```json
{
  "keywords": [
    "sabesp",
    "saneamento",
    "hídrico",
    "abastecimento",
    "esgoto",
    "água",
    "concessão",
    "privatização",
    "serviço de água",
    "serviço de esgoto",
    "recursos hídricos"
  ]
}
```

---

## Adicionar um novo município

Abra `municipios.json` e acrescente um objeto ao array.

### Câmara com sistema SINO Siscam

```json
{
  "nome": "NomeCidade",
  "uf": "SP",
  "sistema": "sino-siscam",
  "url_base": "https://www.camaraNOME.sp.gov.br",
  "grupo_id": 3,
  "tipo_ids": [67, 50, 51, 46, 48, 44, 45, 47, 49, 39]
}
```

### Câmara com sistema SAPL

```json
{
  "nome": "NomeCidade",
  "uf": "SP",
  "sistema": "sapl",
  "url_base": "https://sapl.camaraNOME.sp.leg.br"
}
```

> **Dúvida sobre qual sistema a câmara usa?** Verifique o rodapé do site da câmara ou inspecione a URL da página de proposituras. Se não conseguir identificar, abra uma issue ou consulte o responsável pelo projeto.

---

## Sistemas suportados

| Sistema | Parser | Método | Observações |
|---|---|---|---|
| SINO Siscam | `sino-siscam.js` | Scraping HTML via GET | Testado em Botucatu/SP |
| SAPL | `sapl.js` | API REST JSON | Compatível com câmaras e assembleias |
| SAGL 5.1 (OpenLegis) | `sagl.js` | API REST JSON (`/@@materias?ano=`) | Testado em Hortolândia/SP |

Para adicionar suporte a um novo sistema, crie um arquivo em `parsers/nome-do-sistema.js` exportando a função `buscar(municipio)` que retorna um array de proposituras no formato padrão (veja abaixo).

### Formato padrão de propositura

```js
{
  id: 'string única por município',  // ex: 'botucatu-141321'
  tipo: 'Projeto de Lei',
  numero: '12/2026',
  data: '07/04/2026',
  autor: 'Nome do Vereador',
  ementa: 'Texto da ementa...',
  url: 'https://link-direto-para-a-propositura'
}
```

---

## Agendamento

O monitor roda automaticamente 4x/dia nos seguintes horários (BRT):

| Horário BRT | Cron UTC |
|---|---|
| 08:00 | `0 11 * * *` |
| 12:00 | `0 15 * * *` |
| 17:00 | `0 20 * * *` |
| 21:00 | `0 0 * * *` |

Para alterar, edite `.github/workflows/monitor.yml`.

---

## Municípios monitorados

| Município | UF | Sistema |
|---|---|---|
| Botucatu | SP | SINO Siscam |
| Hortolândia | SP | SAGL 5.1 (OpenLegis) |

> Atualize esta tabela conforme novos municípios forem adicionados ao `municipios.json`.

---

## Lições aprendidas

- **Não usar Playwright** em sites Angular com hash routing (`#/`) — o conteúdo não renderiza no servidor headless
- **Não tentar resolver reCAPTCHA** automaticamente — expira em 30 segundos, inviável
- Se o site não tiver API nem scraping viável, recorrer ao pedido via **LAI (e-SIC)**
- Sempre substituir arquivos `.js` inteiros ao editar, nunca linha a linha pelo editor do GitHub
