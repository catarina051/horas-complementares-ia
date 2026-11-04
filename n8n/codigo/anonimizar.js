// Troca nome, matrícula, RG, CPF e outros identificadores por marcas antes de o texto sair do Docker.
// O plano gratuito do Gemini pode usar o conteúdo enviado para treinar modelos.
const prep = $('Preparar certificado').first().json;
const resposta = $input.first().json; // resposta de /texto (fullResponse)

const MARCA = '[ALUNO]';
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
const VARIANTES = {
  a: 'aáàâãä', e: 'eéèêë', i: 'iíìîï', o: 'oóòôõö', u: 'uúùûü', c: 'cç', n: 'nñ',
};
// O OCR confunde dígitos com letras parecidas (CPF "l23.456.789-O9").
const PARECIDOS = { 0: '0Oo', 1: '1lIi|', 2: '2Zz', 5: '5Ss', 6: '6b', 8: '8B' };
const D = '[\\dOoIl|]'; // dígito, ou letra que o OCR troca por dígito
// Depois destas expressões vem o nome de quem recebe o certificado.
const ANCORAS = 'certificamos que|certifica que|declaramos que|declara que|atestamos que|conferido a|conferida a|concedido a|concedida a|outorgado a';
const DEPOIS_DO_NOME = 'participou|concluiu|conclu[íi]da|apresentou|organizou|atuou|realizou|cursou|esteve|obteve|foi|portador|inscrit|CPF|RG|matr[íi]cula|aluno|aluna|estudante|discente';

const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// "José" casa com "JOSE", "jose", "José"...
function padraoPalavra(palavra) {
  return [...semAcento(palavra)].map((ch) => (VARIANTES[ch] ? `[${VARIANTES[ch]}]` : escaparRegex(ch))).join('');
}

// "123.456" casa com "123456", "123 456", "123-456" e com as trocas do OCR ("l23.456").
function padraoDigitos(valor) {
  const digitos = String(valor ?? '').replace(/\D/g, '');
  if (digitos.length < 5) return null;
  return digitos.split('').map((d) => (PARECIDOS[d] ? `[${escaparRegex(PARECIDOS[d])}]` : d)).join('[\\s.\\-/]?');
}

// Distância de edição até 1 (um erro de OCR por palavra: "Marla" ~ "Maria").
function quase(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let diferencas = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i += 1; j += 1; continue; }
    diferencas += 1;
    if (diferencas > 1) return false;
    if (a.length > b.length) i += 1;
    else if (b.length > a.length) j += 1;
    else { i += 1; j += 1; }
  }
  return diferencas + (a.length - i) + (b.length - j) <= 1;
}

// Palavras do nome em qualquer ordem, completas ou com um erro de OCR, desde que apareçam pelo
// menos duas perto uma da outra ("SILVA, Maria", "Maria José", "Marla Silva"). Uma palavra sozinha
// fica: um sobrenome solto costuma ser nome de instituição ("Escola Silva").
function trocarPartesDoNome(t, palavras) {
  const nomes = palavras.map(semAcento).filter((p) => p.length >= 3 && !PARTICULAS.has(p));
  if (!nomes.length) return t;
  const ehNome = (w) => {
    const x = semAcento(w);
    return x.length >= 3 && nomes.some((n) => x === n || (n.length >= 5 && quase(x, n)));
  };
  const pedacos = t.split(/([\p{L}]+)/u); // palavras nas posições ímpares
  const posicoes = [];
  for (let i = 1; i < pedacos.length; i += 2) if (ehNome(pedacos[i])) posicoes.push(i);
  const perto = (a, b) => Math.abs(a - b) <= 6; // até 3 palavras de distância
  for (const i of posicoes) {
    if (posicoes.some((j) => j !== i && perto(i, j))) pedacos[i] = MARCA;
  }
  return pedacos.join('');
}

function anonimizar(texto, dados) {
  // "Fer-\nreira": a hifenização no fim da linha separaria o nome em duas palavras.
  let t = texto.replace(/(\p{L})-\s*\n\s*(\p{L})/gu, '$1$2');
  const trocar = (padrao, marca = MARCA) => {
    t = t.replace(new RegExp(padrao, 'giu'), marca);
  };

  const palavras = String(dados.nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (palavras.length) {
    trocar(`(?<![\\p{L}])${palavras.map(padraoPalavra).join('\\s+')}(?![\\p{L}])`);
    t = trocarPartesDoNome(t, palavras);
  }
  // O nome logo depois de "Certificamos que", mesmo quando não bate com o informado.
  t = t.replace(new RegExp(`(${ANCORAS})\\s+(?!\\[ALUNO\\])([^,\\n]{3,80}?)(?=\\s*,|\\s+(?:${DEPOIS_DO_NOME})\\b)`, 'giu'),
    (_, ancora) => `${ancora} ${MARCA}`);

  for (const valor of [dados.matricula, dados.rg, dados.cpf]) {
    const padrao = padraoDigitos(valor);
    if (padrao) trocar(padrao);
  }
  if (dados.rg) trocar(escaparRegex(String(dados.rg)));
  // Padrões genéricos, para o que não veio nos dados (CPF de outra pessoa, matrícula etc.).
  trocar(`(?<![\\w])${D}{3}\\.${D}{3}\\.${D}{3}-${D}{2}(?![\\w])`);
  trocar('\\b\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}\\b');
  trocar('\\b\\d{9,}\\b');
  trocar('[\\w.+-]+@[\\w-]+\\.[\\w.]+');
  // Links e códigos de verificação permitiriam achar o certificado (e o aluno) no site do emissor.
  trocar('(?:https?:\\/\\/|www\\.)\\S+', '[LINK]');
  trocar('\\b(?=[A-Za-z0-9-]*\\d)(?=[A-Za-z0-9-]*[A-Za-z])[A-Za-z0-9]{4,}(?:-[A-Za-z0-9]{3,}){1,}\\b', '[CODIGO]');
  trocar('\\b(?=[A-Za-z0-9]*\\d)(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{12,}\\b', '[CODIGO]');
  trocar('\\(?\\b\\d{2}\\)?\\s?9?\\d{4}-\\d{4}\\b', '[TELEFONE]');
  trocar('\\b\\d{5}-\\d{3}\\b', '[CEP]');
  return t.replace(/(\[ALUNO\][\s,]*){2,}/g, `${MARCA} `);
}

if (resposta.statusCode !== 200) {
  return [{ json: { ...prep, erro: resposta.body?.erro ?? 'Não consegui ler o certificado.' } }];
}
// No reuso o nome vem da declaração-base; sem ele, o nome do aluno iria ao Gemini sem máscara.
if (prep.origem === 'formulario' && !String(prep.dados_anonimizar?.nome ?? '').trim()) {
  return [{ json: { ...prep, erro: 'Não consegui ler o seu nome na declaração-base. Use a opção "Primeira vez" para gerar uma declaração nova.' } }];
}
const texto = resposta.body.texto ?? '';
if (texto.replace(/\s/g, '').length < 40) {
  return [{ json: { ...prep, erro: 'Não consegui ler o certificado, nem como imagem. Envie um PDF mais nítido: de preferência o arquivo original do emissor, ou uma digitalização reta e bem iluminada.' } }];
}
return [{ json: { ...prep, texto_anonimizado: anonimizar(texto, prep.dados_anonimizar), dados_anonimizar: undefined } }];
