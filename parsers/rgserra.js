// parsers/rgserra.js
// Parser para a Câmara Municipal de Rio Grande da Serra/SP
// Sistema: Joomla + DocMan
// API: GET /[categoria-slug]-[ano]?format=json&limit=20&offset=N
// Documentos em: response.linked.documents[]
// Nota: API ignora limit>20; usar offset para paginar

const CATEGORIAS_BASE = [
  'indicacoes',
  'requerimentos',
  'mocoes',
  'projetos-de-leis',
  'pedidos-de-providencia',
  'atos',
  'decreto-legislativo',
];

async function buscar(municipio) {
  const { url_base, nome } = municipio;
  const ano = new Date().getFullYear();
  const todas = [];

  for (const cat of CATEGORIAS_BASE) {
    const subcatSlug = await descobrirSubcat(url_base, cat, ano);
    if (!subcatSlug) {
      console.log(`  [${nome}] ${cat}: sem subcat ${ano}, pulando`);
      continue;
    }

    console.log(`  [${nome}] Buscando ${cat} ${ano}...`);
    const docs = await buscarDocs(url_base, subcatSlug);
    console.log(`  [${nome}] → ${docs.length} docs em ${cat}`);
    todas.push(...docs);
    await new Promise(r => setTimeout(r, 500));
  }

  return todas;
}

async function descobrirSubcat(url_base, catSlug, ano) {
  try {
    const r = await fetch(`${url_base}/materias-legislativas-categorias/${catSlug}?format=json`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MonitorBot/1.0)' }
    });
    if (!r.ok) return null;
    const d = await r.json();
    const cats = (d.linked || {}).categories || [];
    const match = cats.find(c => c.title && c.title.includes(String(ano)));
    if (!match) return null;
    const href = (match.links || {}).self?.href || '';
    const slugMatch = href.match(/materias-legislativas-categorias\/([^?]+)/);
    return slugMatch ? slugMatch[1] : null;
  } catch {
    return null;
  }
}

async function buscarDocs(url_base, subcatSlug) {
  const LIMIT = 20;
  const docs = [];
  let offset = 0;

  while (true) {
    try {
      const url = `${url_base}/materias-legislativas-categorias/${subcatSlug}?format=json&limit=${LIMIT}&offset=${offset}`;
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MonitorBot/1.0)' }
      });
      if (!r.ok) break;
      const d = await r.json();
      const pageDocs = (d.linked || {}).documents || [];
      if (pageDocs.length === 0) break;

      for (const doc of pageDocs) {
        const href = (doc.links || {}).self?.href ||
          `${url_base}/materias-legislativas-categorias/${subcatSlug}/${doc.id}`;
        docs.push({
          id: `rgserra-${doc.id}`,
          tipo: extrairTipo(doc.title),
          numero: extrairNumero(doc.title),
          data: (doc.created_on || '-').substring(0, 10),
          autor: '-',
          ementa: doc.title || '-',
          url: href,
        });
      }

      const total = (d.meta || {}).total || 0;
      offset += LIMIT;
      if (offset >= total || pageDocs.length < LIMIT) break;
      await new Promise(r => setTimeout(r, 400));
    } catch {
      break;
    }
  }

  return docs;
}

function extrairTipo(title) {
  if (!title) return 'Propositura';
  const m = title.match(/^([A-Za-zÀ-ú\s]+?)(?:\s+[nN][º°.\s]*\d|\s+\d)/);
  return m ? m[1].trim() : title.split(' ').slice(0, 2).join(' ');
}

function extrairNumero(title) {
  if (!title) return '-';
  const m = title.match(/[nN][º°.\s]*(\d+[.\-/]\d+)/);
  return m ? m[1] : '-';
}

module.exports = { buscar };
