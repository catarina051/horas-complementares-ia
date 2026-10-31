// Sem GEMINI_API_KEY: devolve uma classificação de demonstração por palavras-chave, no mesmo
// formato da resposta do Gemini, para testar o resto do fluxo. A página avisa que é simulação.
const texto = $input.first().json.texto_anonimizado;
const t = texto.toLowerCase();
const horas = Number((t.match(/(\d+(?:[.,]\d+)?)\s*h(?:oras)?\b/) ?? [])[1]?.replace(',', '.')) || null;

let tipo = 'Curso extracurricular na área de concentração do curso';
if (/palestra|webinar/.test(t)) tipo = 'Palestra na área de concentração do curso';
else if (/ingl[eê]s|espanhol|idioma|english/.test(t)) tipo = 'Curso de Línguas Estrangeiras';

const classificacao = {
  e_comprovante: true,
  tipo_sigaa: tipo,
  variante: 'padrao',
  quantidades: { horas, dias: null, meses: null, semestres: null, anos: null },
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
