// parsers/legisoft.js
// Parser para câmaras que usam o sistema Legisoft (Virtualiza Tecnologia)
// Método: GET com slugs no path, resposta em HTML (server-side rendering)
// URL padrão: /documentos/ordem:DESC/tipo:legislativo-2/ano:AAAA/pagina:N
// Testado em: Câmara de São Bernardo do Campo/SP
// Bloqueado por Cloudflare em: Guarulhos/SP

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
        'User-Agent': 'Mozilla/5.0 (compatible; MonitorBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      }
    });

    if (!response.ok) {
      console.error(`  [${nome}] Erro HTTP ${response.status}`);
      break;
    }

    const html = await response.text();
    const proposituras = parsearHTML(html, url_base, nome);
    console.log(`  [${nome}] → ${proposituras.length} proposituras`);

    if (proposituras.length === 0) break;
    todas.push(...proposituras);

    // Verifica se há próxima página
    const temProxima = html.includes(`pagina:${pagina + 1}`) ||
      html.includes('próxima') ||
      html.includes('Próxima') ||
      (html.match(/page-item(?!\s+disabled)[^>]*>\s*<a[^>]*>\s*[»›>]/i) !== null);

    if (!temProxima || proposituras.length < 10 || pagina >= 50) break;
    pagina++;
    await new Promise(r => setTimeout(r, 1500));
  }

  return todas;
}

function parsearHTML(html, url_base, nome) {
  const proposituras = [];

  // Legisoft renderiza cards com classe document-desc ou similar
  // Estrutura típica: div.list-link com título, data, autor, ementa

  // Extrai todos os links de proposituras
  // Padrão URL: /documento/SLUG ou /documentos/id:N
  const linkRegex = /href="(\/(?:documento|documentos)\/[^"]+)"/gi;
  const vistos = new Set();
  let m;

  // Estratégia: divide o HTML por card de documento
  // Legisoft usa padrão de card com classe específica
  const cardRegex = /<(?:div|article|li)[^>]*class="[^"]*(?:document|doc-item|list-link|card)[^"]*"[\s\S]*?(?=<(?:div|article|li)[^>]*class="[^"]*(?:document|doc-item|list-link|card)|$)/gi;

  // Abordagem alternativa mais robusta: busca por padrão de título + link
  // Legisoft usa títulos como "Projeto de Lei nº 100/2026" em links
  const tituloLinkRegex = /<a\s+href="(\/[^"]+)"[^>]*>\s*([^<]*(?:Projeto|Indicação|Moção|Requerimento|Proposta|Decreto|Resolução|Emenda|Veto)[^<]*)<\/a>/gi;

  while ((m = tituloLinkRegex.exec(html)) !== null) {
    const href = m[1];
    const titulo = m[2].trim();

    if (vistos.has(href)) continue;
    vistos.add(href);

    // Extrai tipo e número do título
    // Ex: "Projeto de Lei nº 100/2026" ou "PL 100/2026"
    const tipoNumeroMatch = titulo.match(/^(.+?)\s+n[ºo°]?\s*([\d]+\/\d{4})/i);
    const tipo = tipoNumeroMatch ? tipoNumeroMatch[1].trim() : titulo.split(/\s+\d/)[0].trim();
    const numero = tipoNumeroMatch ? tipoNumeroMatch[2] : '';

    // Pega contexto ao redor do link para extrair data, autor, ementa
    const idx = m.index;
    const bloco = html.substring(Math.max(0, idx - 200), idx + 2000);

    // Data: padrão dd/mm/aaaa
    const dataMatch = bloco.match(/(\d{2}\/\d{2}\/\d{4})/);
    const data = dataMatch ? dataMatch[1] : '-';

    // Autor: texto após "Autor" ou "Autoria"
    const autorMatch = bloco.match(/(?:Autor(?:ia)?|Vereador(?:a)?|De autoria)\s*:?\s*<[^>]*>\s*([^<\n]{3,80})/i)
      || bloco.match(/(?:Autor(?:ia)?)\s*:\s*([^<\n]{3,80})/i);
    const autor = autorMatch ? autorMatch[1].replace(/<[^>]+>/g, '').trim() : '-';

    // Ementa: texto mais longo próximo ao card
    const ementaMatch = bloco.match(/(?:Ementa|ementa|p\.document-desc)[^>]*>\s*([\s\S]{20,400}?)(?=<\/[^>]+>|Autor|Data|$)/i);
    const ementa = ementaMatch
      ? ementaMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 400)
      : titulo;

    // ID: usa o path do link
    const idSlug = href.replace(/\//g, '-').replace(/^-/, '');
    const id = `${nome.toLowerCase().replace(/\s+/g, '-')}-${idSlug}`;
    const url_prop = href.startsWith('http') ? href : `${url_base}${href}`;

    if (!tipo || tipo.length < 2) continue;

    proposituras.push({ id, tipo, numero, data, autor, ementa, url: url_prop });
  }

  return proposituras;
}

module.exports = { buscar };
