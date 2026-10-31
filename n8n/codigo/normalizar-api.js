// Entrada da API de avaliação (POST multipart: certificado, versao, nome, matricula).
// Só classifica: não gera declaração nem PDF final.
const item = $input.first();
const corpo = item.json.body ?? {};
const certificado = item.binary?.certificado;

const versao = String(corpo.versao ?? 'v1').trim();
let erro = '';
if (!certificado) erro = 'Envie o PDF no campo "certificado".';
else if (certificado.mimeType !== 'application/pdf') erro = 'O certificado precisa estar em PDF.';
else if (!/^v\d+$/.test(versao)) erro = 'O campo "versao" deve ter o formato v1, v2...';

return [{
  json: {
    origem: 'api',
    modo: 'api',
    versao,
    nome: String(corpo.nome ?? '').trim(),
    matricula: String(corpo.matricula ?? '').trim(),
    rg: '',
    cpf: '',
    erro,
  },
  binary: certificado ? { certificado } : {},
}];
