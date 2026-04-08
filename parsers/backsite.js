// parsers/backsite.js
// Parser para câmaras que usam o sistema Backsite
// Método: POST com form data, resposta em HTML
// Testado em: Câmara Municipal de Santos/SP

async function buscar(municipio) {
  const { url_base, nome, backsite_path } = municipio;
  const ano = new Date().getFullYear();

  // Path da busca — pode variar entre instâncias
  const path = backsite_path || '/dispositivo/customizado_publico/legislativo/busca_propositura_pub/';
  const url = `${url_base}${path}`;

  const todas = [];
  let inicio = 0;
  const itensPorPagina = 100;
  let pagina = 1;

  while (true) {
    console.log(`  [${nome}] Página ${pagina} (início: ${inicio})...`);

    // Parâmetros mapeados do DevTools
    const params = new URLSearchParams({
      'c522f793bcf692_tipo': '',        // tipo vazio = todos
      'c5244a91e4a4f5_sequencia': '',
      'c522f747124526_ano': ano,        // ano corrente
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
        'User-Agent': 'Mozilla/5.0 (compatible; MonitorBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Referer': url,
      },
      body: params.toString(),
    });

    if (!response.ok) {
      console.error(`  [${nome}] Erro HTTP ${response.status}`);
      break;
    }

    const html = await response.text();
    const proposituras = parsearHTML(html, url_base, nome);
    console.log(`  [${nome}] → ${proposituras.length} proposituras`);

    if (proposituras.length === 0) break;
    todas.push(...proposituras);

    // Verifica total disponível
    const totalMatch = html.match(/Mostrando\s+\d+\s+de\s+(\d+)\s+proposituras/i);
    const total = totalMatch ? parseInt(totalMatch[1]) : 0;

    inicio += itensPorPagina;
    if (inicio >= total || proposituras.length < itensPorPagina || pagina >= 20) break;

    pagina++;
    await new Promise(r => setTimeout(r, 1500));
  }

  return todas;
}

function parsearHTML(html, url_base, nome) {
  const proposituras = [];

  // Cada propositura fica num bloco identificado pelo título
  // Padrão: "Projeto de Lei - Nº 100/2026 [Processo Nº 4381/2026]"
  const blocoRegex = /<div[^>]*class="[^"]*(?:documento|propositura|resultado)[^"]*"[\s\S]*?(?=<div[^>]*class="[^"]*(?:documento|propositura|resultado)|$)/gi;

  // Estratégia alternativa: parsear por padrão de título + campos
  // Título: "Tipo - Nº numero/ano [Processo Nº X/ano]"
  const tituloRegex = /([A-ZÀ-Ú][^<\n]+?)\s*-\s*N[ºo°]\s*(\d+\/\d{4})\s*\[Processo\s+N[ºo°]\s*([\d\/]+)\]/gi;

  // Campos dentro de cada bloco
  const camposRegex = {
    data:   /Nº:\s*<\/[^>]+>\s*[\s\S]*?Data:\s*<\/[^>]+>\s*([^<\n]+)/i,
    autor:  /Autor:\s*<\/[^>]+>\s*([^<\n]+)/i,
    ementa: /Ementa:\s*<\/[^>]+>\s*([\s\S]+?)(?=<\/td>|<tr|$)/i,
  };

  // Parser linha a linha — mais robusto para HTML variável
  // Divide por ocorrências do padrão de título
  const partes = html.split(/(?=<[^>]+>(?:[A-ZÀ-Ú][^\n<]+?)\s*-\s*N[ºo°]\s*\d+\/\d{4})/);

  let match;
  const re = /([A-ZÀ-Úa-zà-ú][^\n\-<]{2,60}?)\s*-\s*N[ºo°]\.?\s*(\d+)\/(\d{4})/g;

  // Abordagem direta: busca todos os títulos no HTML
  const titulos = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    titulos.push({
      tipo: m[1].trim(),
      numero: m[2],
      ano: m[3],
      index: m.index,
    });
  }

  for (let i = 0; i < titulos.length; i++) {
    const t = titulos[i];
    const fim = titulos[i + 1] ? titulos[i + 1].index : t.index + 3000;
    const bloco = html.substring(t.index, fim);

    // Processo (ID único)
    const processoMatch = bloco.match(/Processo\s+N[ºo°]\.?\s*([\d\/]+)/i);
    const processo = processoMatch ? processoMatch[1].replace(/\//g, '-') : `${t.numero}-${t.ano}`;
    const id = `${nome.toLowerCase().replace(/\s+/g, '-')}-${processo}`;

    // Data
    const dataMatch = bloco.match(/Data:\s*<[^>]+>\s*([^<\n]{6,12})/i)
      || bloco.match(/(\d{2}\/\d{2}\/\d{4})/);
    const data = dataMatch ? dataMatch[1].trim() : '-';

    // Autor
    const autorMatch = bloco.match(/Autor:\s*(?:<[^>]+>)?\s*([^<\n]{3,80})/i);
    const autor = autorMatch ? autorMatch[1].trim() : '-';

    // Ementa
    const ementaMatch = bloco.match(/Ementa:\s*(?:<[^>]+>)?\s*([\s\S]{10,500}?)(?=<\/td>|<tr|Arquivos:|Detalhes)/i);
    const ementa = ementaMatch
      ? ementaMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 400)
      : '-';

    // URL de detalhe — link "Detalhes"
    const linkMatch = bloco.match(/href="([^"]*busca_propositura_pub[^"]*(?:detalhe|ver|processo)[^"]*)"/i)
      || bloco.match(/href="([^"]*processo[^"]*\d+[^"]*)"/i);
    const urlProp = linkMatch
      ? (linkMatch[1].startsWith('http') ? linkMatch[1] : `${url_base}${linkMatch[1]}`)
      : `${url_base}/dispositivo/customizado_publico/legislativo/busca_propositura_pub/?processo=${processo}`;

    if (!t.tipo || !t.numero) continue;

    proposituras.push({
      id,
      tipo: t.tipo,
      numero: `${t.numero}/${t.ano}`,
      data,
      autor,
      ementa,
      url: urlProp,
    });
  }

  return proposituras;
}

module.exports = { buscar };
