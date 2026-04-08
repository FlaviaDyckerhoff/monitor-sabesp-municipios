// parsers/spl.js
// Parser para câmaras que usam o sistema SPL (Ágape Consultoria)
// API documentada em /dados-abertos.aspx
// Endpoint: GET /api/publico/proposicao/?pg=N&qtd=100&ano=AAAA
// Testado em: Tremembé/SP
// Compatível com: Santo André/SP, Caçapava/SP e demais instâncias Ágape

async function buscar(municipio) {
  const { url_base, nome } = municipio;
  const ano = new Date().getFullYear();
  const todas = [];
  let pagina = 1;

  while (true) {
    const url = `${url_base}/api/publico/proposicao/?pg=${pagina}&qtd=100&ano=${ano}`;
    console.log(`  [${nome}] Página ${pagina}...`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; MonitorBot/1.0)',
      }
    });

    if (!response.ok) {
      console.error(`  [${nome}] Erro HTTP ${response.status}`);
      break;
    }

    let json;
    try {
      json = await response.json();
    } catch (e) {
      console.error(`  [${nome}] Resposta não é JSON: ${e.message}`);
      break;
    }

    // SPL retorna { Total, Data: [...] } ou { total, data: [...] }
    const resultados = json.Data || json.data || json.results || json.items || [];
    const total = json.Total || json.total || json.count || 0;
    console.log(`  [${nome}] → ${resultados.length} proposições (total: ${total})`);

    if (resultados.length === 0) break;

    for (const p of resultados) {
      const idRaw = p.Id || p.id || p.ProposicaoId || p.proposicaoId || p.Codigo || p.codigo;
      if (!idRaw) continue;

      const id = `${nome.toLowerCase().replace(/\s+/g, '-')}-${idRaw}`;

      // Tipo — campo Sigla ou Tipo
      const sigla = p.Sigla || p.sigla || '';
      const tipoDesc = p.Tipo || p.tipo || p.TipoDescricao || p.tipoDescricao || sigla || '-';
      const tipo = typeof tipoDesc === 'object' ? (tipoDesc.Descricao || tipoDesc.descricao || sigla) : tipoDesc;

      // Número/Ano
      const numero = p.Numero || p.numero || '';
      const anoP = p.Ano || p.ano || ano;
      const numeroAno = numero ? `${numero}/${anoP}` : `${anoP}`;

      // Data
      const dataRaw = p.Data || p.data || p.DataApresentacao || p.dataApresentacao
        || p.DataProtocolo || p.dataProtocolo || '';
      let data = '-';
      if (dataRaw) {
        const isoMatch = dataRaw.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
          data = `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
        } else {
          const msMatch = dataRaw.match(/\/Date\((\d+)[\+\-]/);
          if (msMatch) data = new Date(parseInt(msMatch[1])).toLocaleDateString('pt-BR');
        }
      }

      // Autor — pode ser array ou string
      let autor = '-';
      const autoresRaw = p.Autores || p.autores || p.Autor || p.autor;
      if (Array.isArray(autoresRaw)) {
        autor = autoresRaw
          .map(a => a.Nome || a.nome || a.NomeAutor || a.nomeAutor || '')
          .filter(Boolean).join(', ') || '-';
      } else if (typeof autoresRaw === 'string' && autoresRaw) {
        autor = autoresRaw;
      }

      // Ementa
      const ementa = (p.Ementa || p.ementa || p.Assunto || p.assunto || '-')
        .toString().trim().substring(0, 400);

      // URL direta
      const processo = p.Processo || p.processo || p.NumProcesso || p.numProcesso || idRaw;
      const url_prop = p.Url || p.url ||
        `${url_base}/spl/processo.aspx?id=${processo}`;

      todas.push({ id, tipo, numero: numeroAno, data, autor, ementa, url: url_prop });
    }

    // Paginação
    if (pagina * 100 >= total || resultados.length < 100 || pagina >= 20) break;
    pagina++;
    await new Promise(r => setTimeout(r, 1000));
  }

  return todas;
}

module.exports = { buscar };
