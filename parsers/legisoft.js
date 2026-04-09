// parsers/legisoft.js
// Parser para câmaras que usam o sistema Legisoft (Virtualiza Tecnologia)
// URL: /documentos/ordem:DESC/tipo:legislativo-2/ano:AAAA/pagina:N
// Testado em: São Bernardo do Campo/SP
// Nota: listagem não tem ementa; usa Situação do sub-title como descrição

async function buscar(municipio) {
  const { url_base, nome, legisoft_tipo } = municipio;
  const ano = new Date().getFullYear();
  const tipo = legisoft_tipo || 'legislativo-2';
  const todas = [];
  let pagina = 1;

  while (true) {
    const url = `${url_base}/documentos/ordem:DESC/tipo:${tipo}/ano:${ano}/pagina:${pagina}`;
    console.log(`  [${nome}] Página ${pagina}...`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      }
    });

    if (!response.ok) {
      console.error(`  [${nome}] Erro HTTP ${response.status}`);
      break;
    }

    const html = await response.text();
    const proposituras = parsearHTML(html, url_base);
    console.log(`  [${nome}] → ${proposituras.length} proposituras`);

    if (proposituras.length === 0) break;
    todas.push(...proposituras);

    const temProxima = html.includes(`pagina:${pagina + 1}`);
    if (!temProxima || proposituras.length < 5 || pagina >= 50) break;
    pagina++;
    await new Promise(r => setTimeout(r, 1500));
  }

  return todas;
}

function parsearHTML(html, url_base) {
  const proposituras = [];
  const vistos = new Set();

  // Links no padrão: /documento/titulo-slug-NUMEROID
  const linkRegex = /href="(\/documento\/([a-z0-9\-]+))"/gi;
  let m;

  while ((m = linkRegex.exec(html)) !== null) {
    const href = m[1];
    const slug = m[2];

    const idMatch = slug.match(/-(\d+)$/);
    if (!idMatch) continue;

    const id_interno = idMatch[1];
    if (vistos.has(id_interno)) continue;
    vistos.add(id_interno);

    const idx = m.index;
    const bloco = html.substring(Math.max(0, idx - 100), idx + 1200);

    // Título: <span class="title-link"><strong>Tipo Nº N/ANO</strong></span>
    const strongMatch = bloco.match(/<span[^>]*title-link[^>]*>\s*<strong>([^<]+)<\/strong>/i)
      || bloco.match(/<strong>([A-ZÁÉÍÓÚÃÕ][^<]{5,80})<\/strong>/);
    const titulo = strongMatch ? strongMatch[1].trim() : '';

    // Tipo e número
    const numMatch = titulo.match(/^(.+?)\s+N[ºo°\xba]?\.?\s*(\d+\/\d{4})/i);
    const tipo = numMatch ? numMatch[1].trim() : titulo || 'Propositura';
    const numero = numMatch ? numMatch[2] : '';

    // Data do Protocolo (sub-title: "Protocolo: 12506, Data Protocolo: 09/04/2026, ...")
    const dataMatch = bloco.match(/Data\s+Protocolo:\s*(\d{2}\/\d{2}\/\d{4})/i)
      || bloco.match(/(\d{2}\/\d{2}\/\d{4})/);
    const data = dataMatch ? dataMatch[1] : '-';

    // Situação como ementa (único campo descritivo disponível na listagem)
    // Ex: "Situação: Indicação ao Executivo"
    const situacaoMatch = bloco.match(/Situa[çc][ãa]o:\s*([^,<\n]{3,100})/i);
    const ementa = situacaoMatch
      ? situacaoMatch[1].trim()
      : titulo.substring(0, 400);

    const url_prop = `${url_base}${href}`;

    proposituras.push({ id: `sbc-${id_interno}`, tipo, numero, data, autor: '-', ementa, url: url_prop });
  }

  return proposituras;
}

module.exports = { buscar };
