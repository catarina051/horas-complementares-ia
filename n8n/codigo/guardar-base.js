// Guarda a declaração-base (sem data) gerada pelo Gotenberg: ela vai para o carimbo de data
// e também volta para o aluno baixar e reutilizar.
const item = $input.first();
const pdf = item.binary?.declaracao_base;
if (!pdf) {
  throw new Error(`Gotenberg não gerou a declaração: ${item.json.error?.message ?? 'sem resposta'}`);
}
const bytes = await this.helpers.getBinaryDataBuffer(0, 'declaracao_base');
const dados = $('Normalizar formulário').first().json;
return [{
  json: { ...dados, declaracao_base_b64: bytes.toString('base64') },
  binary: { declaracao_base: { ...pdf, fileName: 'minha-declaracao-base.pdf' } },
}];
