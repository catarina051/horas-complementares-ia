// Sem GEMINI_API_KEY: devolve uma classificação de demonstração por palavras-chave, no mesmo
// formato da resposta do Gemini, para testar o resto do fluxo. A página avisa que é simulação.
const fs = require('fs');
const item = $input.first().json;
const texto = item.texto_anonimizado ?? '';
const t = texto.toLowerCase();
const horas = Number((t.match(/(\d+(?:[.,]\d+)?)\s*h(?:oras)?\b/) ?? [])[1]?.replace(',', '.')) || null;

let tipo = 'Curso extracurricular na área de concentração do curso';
if (/palestra|webinar/.test(t)) tipo = 'Palestra na área de concentração do curso';
else if (/ingl[eê]s|espanhol|idioma|english/.test(t)) tipo = 'Curso de Línguas Estrangeiras';

let codigoSigaa = 'ECL2023';
try {
  const cursos = JSON.parse(fs.readFileSync('/data/regras/cursos.json', 'utf8'));
  codigoSigaa = cursos[item.curso]?.matrizes[item.matriz]?.codigo_sigaa ?? 'ECL2023';
} catch (e) {}

const classificacao = {
  e_comprovante: true,
  codigo_sigaa: codigoSigaa,
  tipo_sigaa: tipo,
  variante: 'padrao',
  quantidades: { horas, dias: null, meses: null, semestres: null, anos: null, quantidade: null },
  atividade: 'Atividade do certificado (simulação)',
  instituicao: 'Não identificada (simulação)',
  periodo: '',
  ano_conclusao: null,
  papel: 'participante',
  descricao_sigaa: 'Classificação simulada: configure GEMINI_API_KEY para a análise real.',
  confianca: 'baixa',
  justificativa: 'Modo demonstração: classificação por palavras-chave, sem modelo de IA.',
  alternativas: [],
  evidencia_faltante: null,
  alerta_instrucao_suspeita: false,
};

return [{
  json: {
    simulado: true,
    statusCode: 200,
    body: {
      candidates: [{ content: { parts: [{ text: JSON.stringify(classificacao) }] } }],
      usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0 },
    },
  },
}];
