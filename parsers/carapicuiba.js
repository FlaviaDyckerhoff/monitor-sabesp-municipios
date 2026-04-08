// parsers/carapicuiba.js
// Parser para o sistema próprio da Câmara Municipal de Carapicuíba/SP
// Endpoint: GET /atividade-legislativa/proposicoes/pesquisa/N?ano=AAAA
// Detalhe:  GET /atividade-legislativa/proposicoes/materia/ID
// Sem API REST, sem XHR — scraping HTML paginado

async function buscar(municipio) {
  const { url_base, nome } = municipio;
  const ano = new Date().getFullYear();
  const todas = [];
  let pagina = 1;

  while (true) {
    const url = `${url_base}/atividade-legislativa/proposicoes/pesquisa/${pagina}?ano=${ano}`;
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
    const props = parsearHTML(html, url_base);
    console.log(`  [${nome}] → ${props.length} proposituras`);

    if (props.length === 0) break;
    todas.push(...props);

    // Verifica se há próxima página
    const temProxima = html.includes(`/pesquisa/${pagina + 1}`) ||
      (html.match(/href="[^"]*\/pesquisa\/\d+"/) !== null &&
       !html.includes(`class="[^"]*disabled[^"]*">[^<]*${pagina + 1}`));

    if (!temProxima || pagina >= 200) break;
    pagina++;
    await new Promise(r => setTimeout(r, 1200));
  }

  return todas;
}

function parsearHTML(html, url_base) {
  const proposituras = [];

  // Cada card tem estrutura:
  // <div class="..."> Projeto de Lei Ordinária 3646/2026
  //   Identificação: PLO-3646/2026
  //   Ementa/Assunto: ...
  //   Autoria: ...
  //   Situação: ...
  //   <a href="/atividade-legislativa/proposicoes/materia/16845">Mais informações</a>

  // Divide por card — cada propositura tem link "Mais informações" com ID único
  const cardRegex = /href="(\/atividade-legislativa\/proposicoes\/materia\/(\d+))"[^>]*>[^<]*Mais informa/gi;
  let m;

  while ((m = cardRegex.exec(html)) !== null) {
    const href = m[1];
    const id_interno = m[2];

    // Pega contexto antes do link (até 2000 chars atrás)
    const idx = m.index;
    const bloco = html.substring(Math.max(0, idx - 2000), idx + 200);

    // Tipo e número — padrão no título do card
    // Ex: "Projeto de Lei Ordinária 3646/2026" ou "Indicação 0763/2026"
    const tituloMatch = bloco.match(/([A-ZÀ-Úa-zà-ú][^\n<\d]{2,50}?)\s+(\d+\/\d{4})(?:\s|<)/);
    const tipo = tituloMatch ? tituloMatch[1].trim() : '-';
    const numero = tituloMatch ? tituloMatch[2].trim() : '-';

    // Identificação — ex: "PLO-3646/2026"
    const identMatch = bloco.match(/Identifica(?:ção|cao)\s*:?\s*<[^>]*>\s*([A-Z]+-[\d\/]+)/i)
      || bloco.match(/Identifica(?:ção|cao)\s*:?\s*([A-Z]+-[\d\/]+)/i);
    const identificacao = identMatch ? identMatch[1].trim() : numero;

    // Ementa
    const ementaMatch = bloco.match(/Ementa\/Assunto\s*:?\s*<[^>]*>\s*([\s\S]{10,400}?)(?=<\/|Autoria|Situação)/i)
      || bloco.match(/Ementa\/Assunto\s*:?\s*([\s\S]{10,400}?)(?=Autoria|Situação)/i);
    const ementa = ementaMatch
      ? ementaMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 400)
      : '-';

    // Autor
    const autorMatch = bloco.match(/Autoria\s*:?\s*<[^>]*>\s*([^<\n]{3,80})/i)
      || bloco.match(/Autoria\s*:?\s*([^\n<]{3,80})/i);
    const autor = autorMatch ? autorMatch[1].replace(/<[^>]+>/g, '').trim() : '-';

    // Data — pode vir em formato variado
    const dataMatch = bloco.match(/(\d{2}\/\d{2}\/\d{4})/);
    const data = dataMatch ? dataMatch[1] : '-';

    const id = `carapicuiba-${id_interno}`;
    const url_prop = `${url_base}${href}`;

    proposituras.push({ id, tipo, numero, data, autor, ementa, url: url_prop });
  }

  return proposituras;
}

module.exports = { buscar };
