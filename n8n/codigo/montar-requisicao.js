// Monta a chamada ao Gemini lendo o prompt e o schema versionados em prompts/.
const fs = require('fs');
const j = $input.first().json;

if (!/^v\d+$/.test(j.versao)) throw new Error(`Versão de prompt inválida: ${j.versao}`);
const arquivo = `/data/prompts/classificacao/${j.versao}.md`;
if (!fs.existsSync(arquivo)) throw new Error(`Prompt ${j.versao} não existe em prompts/classificacao/`);

const prompt = fs.readFileSync(arquivo, 'utf8');
const schema = JSON.parse(fs.readFileSync('/data/prompts/classificacao/schema.json', 'utf8'));
// O certificado não pode fechar a tag e "sair" da área de dados.
const certificado = j.texto_anonimizado.replace(/<\/?\s*certificado\s*>/gi, '');

return [{
  json: {
    ...j,
    modelo: $env.GEMINI_MODEL || 'gemini-flash-latest',
    simular: !$env.GEMINI_API_KEY,
    requisicao: {
      systemInstruction: { parts: [{ text: prompt }] },
      contents: [{ role: 'user', parts: [{ text: `<certificado>\n${certificado}\n</certificado>` }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: schema },
    },
  },
}];
