// parsers/sagl.js
// Parser para câmaras que usam o sistema SAGL 5.1 (OpenLegis)
// API: GET /@@materias?ano=AAAA
// Testado em: Câmara de Hortolândia/SP

async function buscar(municipio) {
  const { url_base, nome } = municipio;
  const ano = new Date().getFullYear();
  const todas = [];

  const url = `${url_base}/@@materias?ano=${ano}`;
  console.log(`  [${nome}] Buscando ${url}...`);

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; MonitorBot/1.0)',
    }
  });

  if (!response.ok) {
    console.error(`  [${nome}] Erro HTTP ${response.status}`);
    return [];
  }

  const json = await response.json();
  const items = json.items || [];
  console.log(`  [${nome}] → ${items.length} matérias encontradas`);

  for (const item of items) {
    // title: "Projeto de Lei nº 12/2026" → separa tipo e número
    const titleMatch = (item.title || '').match(/^(.+?)\s+n[ºo°]?\s*([\d\/]+)$/i);
    const tipo = titleMatch ? titleMatch[1].trim() : (item.title || '-');
    const numero = titleMatch ? titleMatch[2].trim() : '';

    // date: "2026-04-07" → "07/04/2026"
    const data = item.date
      ? new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR')
      : '-';

    // authorship: array, pega o firstAuthor
    const autores = (item.authorship || [])
      .filter(a => a.firstAuthor)
      .map(a => a.title)
      .join(', ') || (item.authorship || []).map(a => a.title).join(', ') || '-';

    const ementa = (item.description || '-').trim().substring(0, 400);
    const url_prop = item.remoteUrl || `${url_base}/@@materias/${item.id}`;
    const id = `${nome.toLowerCase().replace(/\s+/g, '-')}-${item.id}`;

    todas.push({ id, tipo, numero, data, autor: autores, ementa, url: url_prop });
  }

  // Ordena por id numérico decrescente (mais recentes primeiro)
  todas.sort((a, b) => {
    const na = parseInt(a.id.split('-').pop()) || 0;
    const nb = parseInt(b.id.split('-').pop()) || 0;
    return nb - na;
  });

  return todas;
}

module.exports = { buscar };
