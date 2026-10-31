import assert from 'node:assert/strict';
import { test } from 'node:test';
import { executar } from './n8n.mjs';

const DADOS = { nome: 'Fulana de Tal Exemplo', matricula: '20240000001', rg: 'MG-12.345.678', cpf: '123.456.789-09' };

async function anonimizar(texto, dados = DADOS) {
  const saida = await executar('anonimizar', {
    entrada: { json: { statusCode: 200, body: { texto } } },
    nos: { 'Preparar certificado': { json: { origem: 'api', dados_anonimizar: dados, erro: '' } } },
  });
  return saida.json;
}

test('troca o nome com e sem acento e em qualquer caixa', async () => {
  const dados = { ...DADOS, nome: 'José Antônio da Conceição' };
  for (const escrito of ['José Antônio da Conceição', 'JOSE ANTONIO DA CONCEICAO', 'jose antônio da conceicao']) {
    const { texto_anonimizado } = await anonimizar(`Certificamos que ${escrito} concluiu o curso de Redes com 40 horas e bastante texto.`, dados);
    assert.ok(!/jos[eé]|concei/i.test(texto_anonimizado), texto_anonimizado);
    assert.match(texto_anonimizado, /\[ALUNO\]/);
  }
});

test('troca "Primeiro Último", mas não um sobrenome solto que é nome de instituição', async () => {
  const { texto_anonimizado } = await anonimizar('Certificamos que Fulana Exemplo participou da palestra no Instituto Exemplo por 2 horas, com debate.');
  assert.match(texto_anonimizado, /que \[ALUNO\] participou/);
  assert.match(texto_anonimizado, /Instituto Exemplo/);
});

test('troca matrícula, RG e CPF, com ou sem pontuação', async () => {
  const texto = 'Matrícula 20240000001, RG MG-12.345.678, CPF 12345678909 e também 123.456.789-09, carga de 20 horas no curso.';
  const { texto_anonimizado } = await anonimizar(texto);
  for (const vazado of ['20240000001', '12.345.678', '12345678909', '123.456.789-09']) {
    assert.ok(!texto_anonimizado.includes(vazado), `${vazado} vazou: ${texto_anonimizado}`);
  }
  assert.match(texto_anonimizado, /20 horas/);
});

test('troca CPF e e-mail mesmo sem dados do aluno (API de avaliação)', async () => {
  const { texto_anonimizado } = await anonimizar('Participante CPF 987.654.321-00, contato aluna@exemplo.com, curso de Python de 30 horas.', { nome: '', matricula: '' });
  assert.ok(!texto_anonimizado.includes('987.654.321-00'));
  assert.ok(!texto_anonimizado.includes('aluna@exemplo.com'));
  assert.match(texto_anonimizado, /30 horas/);
});

test('texto sem dados pessoais fica igual', async () => {
  const texto = 'Curso de Docker e Kubernetes, Escola Fictícia de Tecnologia, 01/09/2026 a 30/09/2026, 20 horas.';
  const { texto_anonimizado } = await anonimizar(texto, { nome: '', matricula: '' });
  assert.equal(texto_anonimizado, texto);
});

test('certificado escaneado (sem texto) vira erro claro', async () => {
  const saida = await anonimizar('   \n  ');
  assert.match(saida.erro, /escaneada/);
});
