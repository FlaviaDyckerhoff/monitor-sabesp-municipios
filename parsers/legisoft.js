// parsers/legisoft.js
// Parser para câmaras que usam o sistema Legisoft (Virtualiza Tecnologia)
// URL: /documentos/ordem:DESC/tipo:legislativo-2/ano:AAAA/pagina:N
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

    // Título vem em <span class="title-link"><strong>Tipo Nº N/ANO</strong></span>
    const strongMatch = bloco.match(/<span[^>]*title-link[^>]*>\s*<strong>([^<]+)<\/strong>/i)
      || bloco.match(/<strong>([A-ZÁÉÍÓÚÃÕ][^<]{5,80})<\/strong>/);

    const titulo = strongMatch ? strongMatch[1].trim() : '';

    // Extrair tipo e número do título
    const numMatch = titulo.match(/^(.+?)\s+N[ºo°\xba]?\.?\s*(\d+\/\d{4})/i);
    const tipo = numMatch ? numMatch[1].trim() : titulo || 'Propositura';
    const numero = numMatch ? numMatch[2] : '';

    // Metadata do sub-title: Protocolo, Data, Situação, Processo
    const dataMatch = bloco.match(/Data\s+Protocolo:\s*(\d{2}\/\d{2}\/\d{4})/i)
      || bloco.match(/(\d{2}\/\d{2}\/\d{4})/);
    const data = dataMatch ? dataMatch[1] : '-';

    // Ementa — pode não existir nessa listagem; usar título como fallback
    const ementaMatch = bloco.match(/(?:Ementa|Objeto)\s*:?\s*([^<\n]{20,400})/i);
    const ementa = ementaMatch
      ? ementaMatch[1].replace(/<[^>]+>/g, '').trim().substring(0, 400)
      : titulo.substring(0, 400);

    const url_prop = `${url_base}${href}`;

    proposituras.push({ id: `sbc-${id_interno}`, tipo, numero, data, autor: '-', ementa, url: url_prop });
  }

  return proposituras;
}

module.exports = { buscar };
