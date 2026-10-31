// Troca nome, matrícula, RG, CPF e e-mails por [ALUNO] antes de o texto sair do Docker.
// O plano gratuito do Gemini pode usar o conteúdo enviado para treinar modelos.
const prep = $('Preparar certificado').first().json;
const resposta = $input.first().json; // resposta de /texto (fullResponse)

const MARCA = '[ALUNO]';
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
const VARIANTES = {
  a: 'aáàâãä', e: 'eéèêë', i: 'iíìîï', o: 'oóòôõö', u: 'uúùûü', c: 'cç', n: 'nñ',
};

const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// "José" casa com "JOSE", "jose", "José"...
function padraoPalavra(palavra) {
  return [...semAcento(palavra)].map((ch) => (VARIANTES[ch] ? `[${VARIANTES[ch]}]` : escaparRegex(ch))).join('');
}

// "123.456" casa com "123456", "123 456", "123-456"...
function padraoDigitos(valor) {
  const digitos = String(valor ?? '').replace(/\D/g, '');
  return digitos.length >= 5 ? digitos.split('').join('[\\s.\\-/]?') : null;
}

function anonimizar(texto, dados) {
  let t = texto;
  const trocar = (padrao) => {
    t = t.replace(new RegExp(padrao, 'giu'), MARCA);
  };

  const palavras = String(dados.nome ?? '').trim().split(/\s+/).filter(Boolean);
  const nomeTodo = (lista) => trocar(`(?<![\\p{L}])${lista.map(padraoPalavra).join('\\s+')}(?![\\p{L}])`);
  if (palavras.length) {
    nomeTodo(palavras);
    // Também "Primeiro Último" (ex.: "Maria Silva"). Partes soltas ficam: um sobrenome sozinho
    // costuma ser nome de instituição ("Escola Silva") e trocá-lo estragaria a descrição.
    const semParticulas = palavras.filter((p) => !PARTICULAS.has(semAcento(p)));
    if (semParticulas.length > 2) nomeTodo([semParticulas[0], semParticulas.at(-1)]);
  }
  for (const valor of [dados.matricula, dados.rg, dados.cpf]) {
    const padrao = padraoDigitos(valor);
    if (padrao) trocar(padrao);
  }
  if (dados.rg) trocar(escaparRegex(String(dados.rg)));
  // Padrões genéricos, para o que não veio nos dados (CPF de outra pessoa, matrícula etc.).
  trocar('\\b\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}\\b');
  trocar('\\b\\d{9,}\\b');
  trocar('[\\w.+-]+@[\\w-]+\\.[\\w.]+');
  return t.replace(/(\[ALUNO\][\s,]*){2,}/g, `${MARCA} `);
}

if (resposta.statusCode !== 200) {
  return [{ json: { ...prep, erro: resposta.body?.erro ?? 'Não consegui ler o certificado.' } }];
}
const texto = resposta.body.texto ?? '';
if (texto.replace(/\s/g, '').length < 40) {
  return [{ json: { ...prep, erro: 'Este certificado parece ser uma imagem escaneada, sem texto selecionável. Por enquanto a ferramenta só lê PDFs com texto (os emitidos por sistemas, não fotos ou digitalizações).' } }];
}
return [{ json: { ...prep, texto_anonimizado: anonimizar(texto, prep.dados_anonimizar), dados_anonimizar: undefined } }];
