// parsers/backsite.js
// Parser para câmaras que usam o sistema Backsite
// Método: POST com form data, resposta HTML em Latin-1
// Estrutura: cada card tem <strong>Tipo - Nº N/ANO [Processo Nº N/ANO]</strong>
//            seguido de um bloco <pre>Array(...)</pre> com todos os campos
// Testado em: Câmara Municipal de Santos/SP

async function buscar(municipio) {
  const { url_base, nome, backsite_path } = municipio;
  const ano = new Date().getFullYear();

  const path = backsite_path || '/dispositivo/customizado_publico/legislativo/busca_propositura_pub/';
  // Backsite faz redirect 302 para index.php — usar diretamente
  const url = `${url_base}${path}index.php`;

  const todas = [];
  const idsVistos = new Set();
  let inicio = 0;
  const itensPorPagina = 100;
  let pagina = 1;

  while (true) {
    console.log(`  [${nome}] Página ${pagina} (início: ${inicio})...`);

    const params = new URLSearchParams({
      'c522f793bcf692_tipo': '',
      'c5244a91e4a4f5_sequencia': '',
      'c522f747124526_ano': ano,
      'c_processo_adm': '',
      'c_ano_processo_adm': '',
      'c522f799123a17_autoria': '',
      'local': '-1',
      'c522f7549334b2_data_i': '',
      'c522f7549334b2_data_f': '',
      'c522f756ae367a_ementa': '',
      'busca': '1',
      'inicio': inicio,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': `${url_base}${path}`,
        'Origin': url_base,
      },
      body: params.toString(),
      redirect: 'follow',
    });

    if (!response.ok) {
      console.error(`  [${nome}] Erro HTTP ${response.status}`);
      break;
    }

    // HTML é Latin-1
    const buffer = Buffer.from(await response.arrayBuffer());
    const html = buffer.toString('latin1');

    const proposituras = parsearHTML(html, url_base, nome, idsVistos);
    console.log(`  [${nome}] → ${proposituras.length} proposituras`);

    if (proposituras.length === 0) break;
    todas.push(...proposituras);

    const totalMatch = html.match(/Mostrando\s+\d+\s+de\s+(\d+)\s+proposituras/i);
    const total = totalMatch ? parseInt(totalMatch[1]) : 0;

    inicio += itensPorPagina;
    if (inicio >= total || proposituras.length < itensPorPagina || pagina >= 20) break;

    pagina++;
    await new Promise(r => setTimeout(r, 1500));
  }

  return todas;
}

function parsearHTML(html, url_base, nome, idsVistos) {
  const proposituras = [];

  // Cada card começa com: <strong>Tipo - Nº N/ANO [Processo Nº N/ANO]</strong>
  // Dividir o HTML por esse padrão
  const cardRegex = /<strong>([^<]+?)\s*-\s*N[\xbaº°o]\.?\s*(\d+\/\d{4})\s*\[Processo\s+N[\xbaº°o]\.?\s*(\d+\/\d{4})\]<\/strong>/g;

  const cards = [];
  let m;
  while ((m = cardRegex.exec(html)) !== null) {
    cards.push({
      tipo: m[1].trim(),
      numeroAno: m[2],    // ex: 4421/2026
      processo: m[3],     // ex: 4421/2026
      index: m.index,
    });
  }

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const fim = cards[i + 1] ? cards[i + 1].index : card.index + 4000;
    const bloco = html.substring(card.index, fim);

    // ID único: auto_10 do bloco Array
    const autoMatch = bloco.match(/\[auto_10\]\s*=>\s*(\d+)/);
    const autoId = autoMatch ? autoMatch[1] : card.processo.replace('/', '-');

    if (idsVistos.has(autoId)) continue;
    idsVistos.add(autoId);

    const id = `${nome.toLowerCase().replace(/\s+/g, '-')}-${autoId}`;

    // Número/ano já vem formatado no título
    const numero = card.numeroAno;

    // Data — campo c522f7549334b2_data => 2026-04-07 (ISO)
    const dataMatch = bloco.match(/\[c522f7549334b2_data\]\s*=>\s*(\d{4}-\d{2}-\d{2})/);
    let data = '-';
    if (dataMatch) {
      const [, y, mo, d] = dataMatch[1].match(/(\d{4})-(\d{2})-(\d{2})/);
      data = `${d}/${mo}/${y}`;
    }

    // Ementa — campo c522f756ae367a_ementa
    const ementaMatch = bloco.match(/\[c522f756ae367a_ementa\]\s*=>\s*([^\n\[]{5,600})/);
    const ementa = ementaMatch
      ? ementaMatch[1].trim().substring(0, 400)
      : '-';

    // URL — link busca_documento_pub/detalhes.php?cod=ID (página real da propositura)
    const detalhesMatch = bloco.match(/href="([^"]*busca_documento_pub[^"]*detalhes\.php\?cod=\d+[^"]*)"/i);
    const url_prop = detalhesMatch
      ? (detalhesMatch[1].startsWith('http') ? detalhesMatch[1] : `${url_base}${detalhesMatch[1]}`)
      : `${url_base}/dispositivo/customizado_publico/legislativo/busca_documento_pub/detalhes.php?cod=${autoId}`;

    proposituras.push({
      id,
      tipo: card.tipo,
      numero,
      data,
      autor: '-',   // autoria é ID numérico no HTML; não exposto com nome
      ementa,
      url: url_prop,
    });
  }

  return proposituras;
}

module.exports = { buscar };
