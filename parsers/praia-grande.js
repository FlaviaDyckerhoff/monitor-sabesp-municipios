// parsers/praia-grande.js
// Parser para a Câmara Municipal de Praia Grande/SP
// Sistema PHP próprio — server-side rendering, sem API JSON
// URL: GET /result_materias.php?ano_materia=AAAA&offset=N
// Campos: Tipo, Autor, Data, Ementa, Número com link
// 2089 matérias em 2026 — câmara grande, paginação obrigatória

async function buscar(municipio) {
  const { url_base, nome } = municipio;
  const ano = new Date().getFullYear();
  const todas = [];
  const base = `${url_base}/dispositivo/ideCustom/camarapg_publico/materias_leg`;
  let offset = 1;
  let totalPaginas = 300; // fallback seguro; sobrescrito pela função paginacao() da pág 1

  while (true) {
    const url = `${base}/result_materias.php?ano_materia=${ano}&offset=${offset}`;
    console.log(`  [${nome}] Página ${offset}...`);

    let response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'Referer': `${base}/pesquisa.php`,
        }
      });
    } catch (err) {
      console.error(`  [${nome}] Erro de conexão: ${err.message}`);
      break;
    }

    if (!response.ok) {
      console.error(`  [${nome}] Erro HTTP ${response.status}`);
      break;
    }

    const html = await response.text();

    // Extrai total e limite da função paginacao() inline
    if (offset === 1) {
      const totalMatch = html.match(/var total\s*=\s*(\d+)/);
      const limiteMatch = html.match(/let limite\s*=\s*(\d+)/);
      if (totalMatch && limiteMatch) {
        const total = parseInt(totalMatch[1]);
        const limite = parseInt(limiteMatch[1]);
        totalPaginas = Math.ceil(total / limite);
        console.log(`  [${nome}] Total: ${total} matérias, ${totalPaginas} páginas`);
      }
    }

    const props = parsearHTML(html, url_base, ano);
    console.log(`  [${nome}] → ${props.length} proposituras`);

    if (props.length === 0) break;
    todas.push(...props);

    if (offset >= totalPaginas) break;
    offset++;
    await new Promise(r => setTimeout(r, 1000));
  }

  return todas;
}

function parsearHTML(html, url_base, ano) {
  const proposituras = [];
  const vistos = new Set();

  // Estrutura: cada matéria tem link com número e ano
  // Ex: <a href="...">Indicações Nº 1910/2026</a>
  // Seguido de: Tipo, Autor, Data, Ementa

  // Divide por bloco de matéria — âncora é o link com número/ano
  const blocoRegex = /href="([^"]*)"[^>]*>\s*([\w\s]+N[ºo°]\s*[\d]+\/\d{4})/gi;
  let m;

  while ((m = blocoRegex.exec(html)) !== null) {
    const href = m[1];
    const linkText = m[2].trim();

    // Extrai tipo e número do link
    const tipoNumMatch = linkText.match(/^(.+?)\s+N[ºo°]\s*([\d]+\/\d{4})/i);
    if (!tipoNumMatch) continue;

    const tipo = tipoNumMatch[1].trim();
    const numero = tipoNumMatch[2].trim();

    // Verifica ano
    if (!numero.endsWith(`/${ano}`)) continue;

    // ID único baseado no número
    const id = `praia-grande-${numero.replace('/', '-')}`;
    if (vistos.has(id)) continue;
    vistos.add(id);

    // Contexto ao redor do link
    const idx = m.index;
    const bloco = html.substring(Math.max(0, idx - 100), idx + 1500);

    // Tipo (pode vir em campo separado)
    const tipoMatch = bloco.match(/Tipo:\s*<\/strong>\s*([^\n<]{3,60})/i)
      || bloco.match(/Tipo:\s*([^\n<]{3,60})/i);
    const tipoFinal = tipoMatch ? tipoMatch[1].trim() : tipo;

    // Autor
    const autorMatch = bloco.match(/Autor:\s*<\/strong>\s*([^\n<]{3,80})/i)
      || bloco.match(/Autor:\s*([^\n<]{3,80})/i);
    const autor = autorMatch ? autorMatch[1].replace(/<[^>]+>/g, '').trim() : '-';

    // Data
    const dataMatch = bloco.match(/Data[^:]*:\s*<\/strong>\s*(\d{2}\s+de\s+\w+\s+de\s+\d{4})/i)
      || bloco.match(/(\d{2}\/\d{2}\/\d{4})/);
    const data = dataMatch ? dataMatch[1].trim() : '-';

    // Ementa
    const ementaMatch = bloco.match(/Ementa:\s*<\/strong>\s*([\s\S]{10,500}?)(?=<\/p>|Tipo:|Autor:|<div|$)/i)
      || bloco.match(/Ementa:\s*([\s\S]{10,500}?)(?=Tipo:|Autor:|$)/i);
    const ementa = ementaMatch
      ? ementaMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 400)
      : tipoFinal;

    // URL de detalhe
    const url_prop = href.startsWith('http') ? href : `${url_base}${href}`;

    proposituras.push({
      id, tipo: tipoFinal, numero, data, autor, ementa, url: url_prop
    });
  }

  return proposituras;
}

module.exports = { buscar };
