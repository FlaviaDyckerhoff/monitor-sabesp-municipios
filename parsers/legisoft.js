// parsers/legisoft.js
// Parser para câmaras que usam o sistema Legisoft (Virtualiza Tecnologia)
// URL: /documentos/ordem:DESC/tipo:legislativo-2/ano:AAAA/pagina:N
// Links de detalhe: /documento/titulo-do-doc-NUMEROID
// Testado em: São Bernardo do Campo/SP

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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
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

    // Verifica próxima página
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

  // SBC usa links no padrão: /documento/titulo-do-documento-NUMEROID
  // O ID numérico fica após o último hífen no slug
  const linkRegex = /href="(\/documento\/([a-z0-9\-]+))"/gi;
  let m;

  while ((m = linkRegex.exec(html)) !== null) {
    const href = m[1];
    const slug = m[2];

    // Extrai ID numérico do final do slug (após último hífen)
    const idMatch = slug.match(/-(\d+)$/);
    if (!idMatch) continue;

    const id_interno = idMatch[1];
    if (vistos.has(id_interno)) continue;
    vistos.add(id_interno);

    // Contexto ao redor do link
    const idx = m.index;
    const bloco = html.substring(Math.max(0, idx - 500), idx + 1500);

    // Tipo e número do título do documento
    // Ex: "Projeto de Lei nº 100/2026" ou "PL 100/2026"
    const tituloMatch = bloco.match(/([A-ZÀ-Úa-zà-ú][^\n<\d]{2,60}?)\s+n[ºo°]?\s*([\d]+\/\d{4})/i);
    const tipo = tituloMatch ? tituloMatch[1].trim() : 'Propositura';
    const numero = tituloMatch ? tituloMatch[2] : '';

    // Data
    const dataMatch = bloco.match(/(\d{2}\/\d{2}\/\d{4})/);
    const data = dataMatch ? dataMatch[1] : '-';

    // Autor
    const autorMatch = bloco.match(/(?:Autor(?:ia)?|Vereador[a]?)\s*:?\s*([A-ZÁÉÍÓÚÃÕ][^<\n]{3,60})/i);
    const autor = autorMatch ? autorMatch[1].replace(/<[^>]+>/g, '').trim() : '-';

    // Ementa — texto mais longo próximo ao link
    const ementaMatch = bloco.match(/(?:Ementa|ementa|p\.document-desc)[^>]*>\s*([\s\S]{20,400}?)(?=<\/[^>]+>|Autor|Data|class=)/i);
    const ementa = ementaMatch
      ? ementaMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 400)
      : tipo;

    const url_prop = href.startsWith('http') ? href : `${url_base}${href}`;

    proposituras.push({
      id: `sbc-${id_interno}`,
      tipo, numero, data, autor, ementa,
      url: url_prop
    });
  }

  return proposituras;
}

module.exports = { buscar };
