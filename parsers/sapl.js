// parsers/sapl.js
// Parser para câmaras que usam o sistema SAPL (Software de Apoio ao Processo Legislativo)
// API REST pública: /api/materia/materialegislativa/
// Testado em: AL-AL, e compatível com demais SAPLs públicos

async function buscar(municipio) {
  const { url_base } = municipio;
  const ano = new Date().getFullYear();
  const todas = [];
  let pagina = 1;

  while (true) {
    const url = `${url_base}/api/materia/materialegislativa/?ano=${ano}&page=${pagina}&page_size=100&ordering=-numero`;

    console.log(`  [${municipio.nome}] Página ${pagina}...`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; MonitorBot/1.0)',
      }
    });

    if (!response.ok) {
      console.error(`  [${municipio.nome}] Erro HTTP ${response.status}`);
      break;
    }

    const json = await response.json();

    // SAPL retorna { count, next, previous, results }
    const resultados = json.results || [];
    console.log(`  [${municipio.nome}] → ${resultados.length} proposituras`);

    for (const p of resultados) {
      const id = `${municipio.nome.toLowerCase().replace(/\s/g,'-')}-${p.id}`;
      const tipo = p.tipo?.sigla || p.tipo?.descricao || '-';
      const numero = `${p.numero}/${p.ano}`;
      const data = p.data_apresentacao
        ? new Date(p.data_apresentacao).toLocaleDateString('pt-BR')
        : '-';
      const autor = (p.autoria || []).map(a => a.autor_related?.nome || a.nome || '').filter(Boolean).join(', ') || '-';
      const ementa = (p.ementa || '-').substring(0, 400);
      const url_prop = `${url_base}/materia/${p.id}`;

      todas.push({ id, tipo, numero, data, autor, ementa, url: url_prop });
    }

    if (!json.next || pagina >= 10) break;
    pagina++;
    await new Promise(r => setTimeout(r, 1000));
  }

  return todas;
}

module.exports = { buscar };
