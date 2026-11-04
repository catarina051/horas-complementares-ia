// Monta a chamada ao Gemini lendo o prompt e o schema versionados em prompts/.
const fs = require('fs');
const j = $input.first().json;

if (!/^v\d+$/.test(j.versao)) throw new Error(`Versão de prompt inválida: ${j.versao}`);
const arquivo = `/data/prompts/classificacao/${j.versao}.md`;
if (!fs.existsSync(arquivo)) throw new Error(`Prompt ${j.versao} não existe em prompts/classificacao/`);

const prompt = fs.readFileSync(arquivo, 'utf8');
const schema = JSON.parse(fs.readFileSync('/data/prompts/classificacao/schema.json', 'utf8'));
const curso = JSON.parse(fs.readFileSync('/data/regras/cursos.json', 'utf8'))[j.curso];
const tiposSigaa = JSON.parse(fs.readFileSync('/data/regras/tipos-sigaa.json', 'utf8'));

// "Na área" depende do curso, e cada colegiado tem categorias próprias: o modelo precisa saber qual é.
const base = JSON.parse(fs.readFileSync('/data/regras/base-cgrad-05-23.json', 'utf8')).categorias.map((c) => c.tipo_sigaa);
const extras = curso.categorias.map((c) => c.tipo_sigaa).filter((t) => !base.includes(t));

// Informações da matriz e código do SIGAA para o usuário específico
const matrizInfo = curso.matrizes[j.matriz];
const codigoMatriz = matrizInfo ? matrizInfo.codigo_sigaa : '';
const opcoesMatriz = codigoMatriz ? (tiposSigaa.matrizes[codigoMatriz] ?? []) : [];
const tiposDisponiveis = [...new Set(opcoesMatriz.map((o) => o.categoria).filter(Boolean))];

let situacaoAluno;
if (j.matriz === 'desde-2023-1') {
  situacaoAluno = 'Ingresso a partir de 2023.1 diretamente na grade nova';
} else if (j.matriz === 'migracao') {
  situacaoAluno = 'Ingresso anterior a 2023.1 que MIGROU para a grade nova (matriz de transição)';
} else {
  situacaoAluno = 'Ingresso até 2022.2 na grade antiga e NÃO migrou';
}

// O certificado não pode fechar a tag e "sair" da área de dados.
const certificado = (j.texto_anonimizado ?? '').replace(/<\/?\s*(certificado|curso|usuario)\s*>/gi, '');
const mensagem = [
  `<curso>${curso.nome}. Área de concentração: ${curso.area_concentracao}.`,
  `Categorias próprias deste curso: ${extras.length ? extras.join('; ') : 'nenhuma'}.</curso>`,
  `<usuario>`,
  `Curso: ${curso.nome}`,
  `Grade/Matriz: ${matrizInfo ? matrizInfo.rotulo : j.matriz} (${situacaoAluno})`,
  `Código do SIGAA deste aluno: ${codigoMatriz}`,
  `Tipos cadastrados no SIGAA para este código (${codigoMatriz}): ${tiposDisponiveis.length ? tiposDisponiveis.join('; ') : 'conferir catálogo'}.`,
  `</usuario>`,
  `<certificado>\n${certificado}\n</certificado>`,
].join('\n');

return [{
  json: {
    ...j,
    modelo: $env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    simular: !$env.GEMINI_API_KEY,
    requisicao: {
      systemInstruction: { parts: [{ text: prompt }] },
      contents: [{ role: 'user', parts: [{ text: mensagem }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: schema },
    },
  },
}];
