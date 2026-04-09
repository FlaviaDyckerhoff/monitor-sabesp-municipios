// parsers/legisoft.js
// Parser para câmaras que usam o sistema Legisoft (Virtualiza Tecnologia)
// URL: /documentos/ordem:DESC/tipo:legislativo-2/ano:AAAA/pagina:N
// Testado em: São Bernardo do Campo/SP
// Ementa: buscada na página de detalhe de cada item novo

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

// Busca ementa na página de detalhe
// Estrutura: <span class="title">Ementa</span><p>TEXTO</p>
async function buscarEmenta(url_prop) {
  try {
    const r = await fetch(url_prop, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (!r.ok) return null;
    const html = await r.text();
    const m = html.match(/<span[^>]*class="title"[^>]*>Ementa<\/span>\s*<p>([\s\S]*?)<\/p>/i);
    if (!m) return null;
    return m[1]
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/g, c => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&apos;': "'", '&quot;': '"' })[c] || c)
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 500);
  } catch {
    return null;
  }
}

// Enriquecer proposituras novas com ementa real (chamadas em paralelo, max 5)
async function enriquecerEmentas(proposituras) {
  const batchSize = 5;
  for (let i = 0; i < proposituras.length; i += batchSize) {
    const batch = proposituras.slice(i, i + batchSize);
    await Promise.all(batch.map(async p => {
      const ementa = await buscarEmenta(p.url);
      if (ementa && ementa.length > 5) p.ementa = ementa;
    }));
    if (i + batchSize < proposituras.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return proposituras;
}

function parsearHTML(html, url_base) {
  const proposituras = [];
  const vistos = new Set();

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

    const strongMatch = bloco.match(/<span[^>]*title-link[^>]*>\s*<strong>([^<]+)<\/strong>/i)
      || bloco.match(/<strong>([A-ZÁÉÍÓÚÃÕ][^<]{5,80})<\/strong>/);
    const titulo = strongMatch ? strongMatch[1].trim() : '';

    const numMatch = titulo.match(/^(.+?)\s+N[ºo°\xba]?\.?\s*(\d+\/\d{4})/i);
    const tipo = numMatch ? numMatch[1].trim() : titulo || 'Propositura';
    const numero = numMatch ? numMatch[2] : '';

    const dataMatch = bloco.match(/Data\s+Protocolo:\s*(\d{2}\/\d{2}\/\d{4})/i)
      || bloco.match(/(\d{2}\/\d{2}\/\d{4})/);
    const data = dataMatch ? dataMatch[1] : '-';

    // Situação como ementa fallback — será substituída pela ementa real no enriquecimento
    const situacaoMatch = bloco.match(/Situa[çc][ãa]o:\s*([^,<\n]{3,100})/i);
    const ementa = situacaoMatch ? situacaoMatch[1].trim() : titulo.substring(0, 400);

    const url_prop = `${url_base}${href}`;
    proposituras.push({ id: `sbc-${id_interno}`, tipo, numero, data, autor: '-', ementa, url: url_prop });
  }

  return proposituras;
}

module.exports = { buscar, enriquecerEmentas };
