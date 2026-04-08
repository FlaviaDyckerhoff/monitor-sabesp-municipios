// parsers/sino-siscam.js
// Parser para câmaras que usam o sistema SINO Siscam moderno
// URL: GET /Documentos?Pesquisa=Avancada&GrupoId=N&TipoId=X&Ano=AAAA&...
// Testado em: Botucatu/SP, Várzea Paulista/SP, Bragança Paulista/SP

async function buscar(municipio) {
  const { url_base, nome, grupo_id, tipo_ids } = municipio;
  const ano = new Date().getFullYear();
  const tipoParams = tipo_ids.map(id => `TipoId=${id}`).join('&');
  const todas = [];
  let pagina = 1;

  while (true) {
    // URL sem /Siscam/ — padrão correto para instâncias modernas
    const url = `${url_base}/Documentos?Pesquisa=Avancada&ShowSearch=False&GrupoId=${grupo_id}&${tipoParams}&SubtipoId=&Numeracao=Documento&NumeroSufixo=&Ano=${ano}&Data=&Ementa=&Observacoes=&SituacaoId=&ClassificacaoId=&RegimeId=&QuorumId=&TipoAutorId=&AutorId=&TipoIniciativaId=&Ordenacao=3&ItemsPerPage=100&NoTexto=false&Pagina=${pagina}`;

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
    const proposicoes = parsearHTML(html, url_base, grupo_id);
    console.log(`  [${nome}] → ${proposicoes.length} proposituras`);

    todas.push(...proposicoes);

    const temProxima = html.includes(`Pagina=${pagina + 1}`);
    if (!temProxima || proposicoes.length === 0 || pagina >= 10) break;

    pagina++;
    await new Promise(r => setTimeout(r, 1000));
  }

  return todas;
}

function parsearHTML(html, url_base, grupo_id) {
  const proposicoes = [];

  const tabelaMatch = html.match(/<tbody[\s\S]*?<\/tbody>/i);
  if (!tabelaMatch) return proposicoes;

  const trs = tabelaMatch[0].match(/<tr[\s\S]*?<\/tr>/gi) || [];

  for (const tr of trs) {
    const idMatch = tr.match(/Details\?id=(\d+)&grupoId=\d+/);
    if (!idMatch) continue;
    const id = idMatch[1];

    const linkTextMatch = tr.match(/Details\?id=\d+&grupoId=\d+[^>]*>([^<]+)<\/a>/);
    const linkText = linkTextMatch ? linkTextMatch[1].trim() : '';

    const tipoNumeroMatch = linkText.match(/^(.+?)\s+N[ºo°]?\s*([\d\/]+)$/i);
    const tipo = tipoNumeroMatch ? tipoNumeroMatch[1].trim() : linkText;
    const numero = tipoNumeroMatch ? tipoNumeroMatch[2].trim() : '';

    const dataMatch = tr.match(/(\d{2}\/\d{2}\/\d{4})/);
    const data = dataMatch ? dataMatch[1] : '';

    const tds = tr.match(/<td[\s\S]*?<\/td>/gi) || [];
    const tdLongo = tds
      .map(td => td.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
      .filter(t => t.length > 30 && !t.match(/^[\d\/\s]+$/))
      .sort((a, b) => b.length - a.length)[0] || '';

    const autorMatch = tdLongo.match(/Autor(?:ia)?\s*:\s*([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÇ][^(\n]{3,80}?)(?:\s{2,}|\s+(?:Apoio|Subscreve|$))/);
    const autor = autorMatch ? autorMatch[1].trim() : '-';

    const ementa = tdLongo.split(/\s+Autor(?:ia)?\s*:/i)[0].trim().substring(0, 400);

    const url_prop = `${url_base}/Documentos/Details?id=${id}&grupoId=${grupo_id}`;

    proposicoes.push({
      id: `${url_base.replace(/https?:\/\//, '').replace(/\./g, '-')}-${id}`,
      tipo, numero, data, autor, ementa, url: url_prop
    });
  }

  return proposicoes;
}

module.exports = { buscar };
