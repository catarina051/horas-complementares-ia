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

test('certificado ilegível (nem o OCR leu) vira erro claro', async () => {
  const saida = await anonimizar('   \n  ');
  assert.match(saida.erro, /nem como imagem/);
});

const MARIA = { nome: 'Maria José Ferreira Silva', matricula: '20240000001', rg: '', cpf: '123.456.789-09' };

test('nome em outra ordem, parcial, com erro de OCR ou hifenizado', async () => {
  const casos = [
    'Certificado. SILVA, Maria José Ferreira participou do evento de robótica por 8 horas.',
    'Certificamos que Maria José concluiu o curso de automação industrial de 20 horas.',
    'O aluno Marla José Ferreira Sílva concluiu o curso de redes com 40 horas no total.',
    'Conferido a Maria José Fer-\nreira Silva pela participação no seminário de 4 horas.',
  ];
  for (const texto of casos) {
    const { texto_anonimizado } = await anonimizar(texto, MARIA);
    assert.ok(!/maria|marla|ferreira|silva|s[íi]lva/i.test(texto_anonimizado), texto_anonimizado);
  }
});

test('nome depois de "certificamos que" é trocado mesmo sem bater com o informado', async () => {
  const { texto_anonimizado } = await anonimizar('Certificamos que Joana Pereira Lima, concluiu o curso de Python com 30 horas.', MARIA);
  assert.match(texto_anonimizado, /Certificamos que \[ALUNO\]/);
  assert.ok(!texto_anonimizado.includes('Joana'));
});

test('CPF com letras trocadas pelo OCR, links, códigos, telefone e CEP', async () => {
  const texto = 'CPF l23.456.789-O9. Valide em https://emissor.exemplo/valida?c=AB12CD34EF56 código X9K2-77QP-A1 ' +
    'tel (31) 99876-5432, CEP 36700-000. Curso de 20 horas.';
  const { texto_anonimizado } = await anonimizar(texto, { nome: '', matricula: '' });
  for (const vazado of ['l23.456.789-O9', 'emissor.exemplo', 'X9K2-77QP-A1', '99876-5432', '36700-000']) {
    assert.ok(!texto_anonimizado.includes(vazado), `${vazado} vazou: ${texto_anonimizado}`);
  }
  assert.match(texto_anonimizado, /20 horas/);
});

test('códigos técnicos curtos do certificado ficam (S7-1200, ISO 9001)', async () => {
  const texto = 'Curso de CLP Siemens S7-1200 e norma ISO 9001, de 01/09/2026 a 30/09/2026, 30 horas.';
  const { texto_anonimizado } = await anonimizar(texto, { nome: '', matricula: '' });
  assert.equal(texto_anonimizado, texto);
});

test('reuso sem nome lido na declaração-base é recusado', async () => {
  const saida = await executar('anonimizar', {
    entrada: { json: { statusCode: 200, body: { texto: 'Certificado de curso de Python com 20 horas e bastante texto.' } } },
    nos: { 'Preparar certificado': { json: { origem: 'formulario', dados_anonimizar: { nome: null }, erro: '' } } },
  });
  assert.match(saida.json.erro, /nome na declaração-base/);
});
