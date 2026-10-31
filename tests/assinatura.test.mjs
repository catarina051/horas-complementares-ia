import assert from 'node:assert/strict';
import { test } from 'node:test';
import { executar } from './n8n.mjs';

test('o HTML recebe o PNG processado em vez da fotografia original', async () => {
  const normal = { json: { curso: 'eng-computacao', nome: 'Pessoa Teste', matricula: '123456', rg: 'MG123456', cpf: '12345678900', erro: '' },
    binary: { assinatura: { buffer: Buffer.from('fotografia'), mimeType: 'image/jpeg' }, certificado: { buffer: Buffer.from('certificado') } } };
  const preparada = await executar('preparar-assinatura', {
    entrada: { json: { statusCode: 200, body: { imagem_base64: Buffer.from('png recortado').toString('base64') } } },
    nos: { 'Normalizar formulário': normal },
  });
  const declaracao = await executar('montar-declaracao', { entrada: preparada });
  const html = declaracao.binary.html.buffer.toString();
  assert.ok(html.includes('data:image/png;base64,cG5nIHJlY29ydGFkbw=='));
  assert.ok(!html.includes(Buffer.from('fotografia').toString('base64')));
  assert.equal(declaracao.binary.certificado, normal.binary.certificado);
});

test('falha do recorte interrompe a montagem com mensagem para o aluno', async () => {
  const r = await executar('preparar-assinatura', {
    entrada: { json: { statusCode: 422, body: { erro: 'Mais de uma assinatura.' } } },
    nos: { 'Normalizar formulário': { json: { origem: 'formulario', modo: 'primeiro_uso', erro: '' } } },
  });
  assert.equal(r.json.erro, 'Mais de uma assinatura.');
  assert.equal(r.binary, undefined);
});
