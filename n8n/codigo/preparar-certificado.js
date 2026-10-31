// Junta o que a classificação precisa: o certificado, os dados para anonimizar e,
// no formulário, a declaração já datada pelo serviço `declaracao`.
const doFormulario = $('Normalizar formulário').isExecuted;
const normal = doFormulario ? $('Normalizar formulário').first() : $('Normalizar API').first();
const n = normal.json;

const saida = {
  origem: n.origem,
  modo: n.modo,
  versao: n.versao,
  curso: n.curso,
  matriz: n.matriz,
  dados_anonimizar: { nome: n.nome, matricula: n.matricula, rg: n.rg, cpf: n.cpf },
  declaracao_datada_b64: null,
  linha_data: null,
  erro: '',
};

if (doFormulario) {
  const r = $input.first().json; // resposta de /redatar (fullResponse)
  if (r.statusCode !== 200) {
    saida.erro = r.body?.erro ?? 'Não consegui colocar a data de hoje na declaração. Tente de novo.';
  } else {
    saida.declaracao_datada_b64 = r.body.pdf_base64;
    saida.linha_data = r.body.linha_data;
    if (n.modo === 'reuso') {
      // No reuso os dados vêm da própria declaração-base.
      saida.dados_anonimizar = { nome: r.body.nome, matricula: r.body.matricula, rg: r.body.rg, cpf: r.body.cpf };
    }
  }
}

return [{ json: saida, binary: { certificado: normal.binary.certificado } }];
