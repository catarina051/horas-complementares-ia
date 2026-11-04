// Entrada da API de avaliação (POST multipart: certificado, versao, curso, matriz, nome, matricula).
// Só classifica: não gera declaração nem PDF final.
const fs = require('fs');
const cursos = JSON.parse(fs.readFileSync('/data/regras/cursos.json', 'utf8'));
const item = $input.first();
const corpo = item.json.body ?? {};
const certificado = item.binary?.certificado;

const versao = String(corpo.versao ?? 'v2').trim();
const cursoId = String(corpo.curso ?? 'eng-computacao').trim();
const curso = Object.hasOwn(cursos, cursoId) ? cursos[cursoId] : undefined;
const matriz = String(corpo.matriz ?? curso?.matriz_padrao ?? '').trim();
let erro = '';
if (!curso) erro = `Curso inválido. Use um destes: ${Object.keys(cursos).join(', ')}.`;
else if (!curso.matrizes[matriz]) erro = `Informe "matriz": ${Object.keys(curso.matrizes).join(', ')}.`;
else if (!certificado) erro = 'Envie o PDF no campo "certificado".';
else if (certificado.mimeType !== 'application/pdf') erro = 'O certificado precisa estar em PDF.';
else if (!/^v\d+$/.test(versao)) erro = 'O campo "versao" deve ter o formato v1, v2...';

return [{
  json: {
    origem: 'api',
    modo: 'api',
    versao,
    curso: cursoId,
    matriz,
    nome: String(corpo.nome ?? '').trim(),
    matricula: String(corpo.matricula ?? '').trim(),
    rg: '',
    cpf: '',
    erro,
  },
  binary: certificado ? { certificado } : {},
}];
