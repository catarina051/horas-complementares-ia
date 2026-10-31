import assert from 'node:assert/strict';
import { test } from 'node:test';
import { executar } from './n8n.mjs';

async function classificar(tipo_sigaa, variante = 'padrao', curso = 'eng-computacao', matriz = 'desde-2023-1') {
  const c = { e_comprovante: true, tipo_sigaa, variante, quantidades: { horas: 50 }, confianca: 'alta' };
  const r = await executar('validar-calcular', {
    entrada: { json: { statusCode: 200, body: { candidates: [{ content: { parts: [{ text: JSON.stringify(c) }] } }] } } },
    nos: { 'Montar requisição': { json: { origem: 'api', modo: 'api', curso, matriz } } },
  });
  return r.json;
}

test('curso na área devolve código e opção completa da matriz ativa ECL2023', async () => {
  const r = await classificar('Curso extracurricular na área de concentração do curso');
  assert.equal(r.sigaa.codigo, 'ECL2023');
  assert.equal(r.sigaa.opcao, 'OUTRAS ATIVIDADES COMPLEMENTARES/(ECL2023) CURSO EXTRACURRICULAR NA ÁREA DE CONCENTRAÇÃO DO CURSO (1.2h)');
});

test('extensão em Controle e Automação antigo usa 7878 / ECA2021', async () => {
  const r = await classificar('Atividade de Extensão', 'padrao', 'eng-controle-automacao', 'ate-2022-2');
  assert.equal(r.sigaa.codigo, '7878 / ECA2021');
  assert.equal(r.sigaa.opcao, 'ATIVIDADES COMPLEMENTARES/(7878 / ECA2021) ATIVIDADE DE EXTENSÃO (1.0h)');
});

test('variantes devolvem opções distintas; variante desconhecida não ganha opção', async () => {
  const internacional = await classificar('Apresentação de Trabalhos em Eventos', 'internacional');
  const nacional = await classificar('Apresentação de Trabalhos em Eventos', 'nacional');
  assert.match(internacional.sigaa.opcao, /EVENTO INTERNACIONAL \(18.0h\)/);
  assert.match(nacional.sigaa.opcao, /EVENTO NACIONAL \(12.0h\)/);
  const invalida = await classificar('Apresentação de Trabalhos em Eventos', 'padrao');
  assert.equal(invalida.sigaa.opcao, null);
  assert.equal(invalida.sigaa.status, 'a_confirmar');
});

test('categoria própria ausente nas capturas pede confirmação sem inventar opção', async () => {
  const r = await classificar('Monitor de Evento');
  assert.equal(r.sigaa.opcao, null);
  assert.equal(r.sigaa.status, 'a_confirmar');
});

test('resultado HTML e JSON apresentam a opção completa e o código', async () => {
  const r = await classificar('Palestra na área de concentração do curso');
  const api = await executar('resposta-api', { entrada: { json: r } });
  assert.equal(JSON.parse(api.json.resposta).codigo_sigaa, 'ECL2023');
  assert.equal(JSON.parse(api.json.resposta).opcao_sigaa, r.sigaa.opcao);
  const pagina = await executar('montar-pagina', {
    entrada: { json: {}, binary: { pdf_final: { buffer: Buffer.from('pdf teste') } } },
    nos: { 'Validar e calcular': { json: r } },
  });
  assert.ok(pagina.json.resposta.includes(r.sigaa.opcao));
  assert.match(pagina.json.resposta, /Código[^<]*<[^>]+>ECL2023/);
});

test('duas versões dos dois cursos usam código e teto próprios', async () => {
  for (const [curso, matriz, codigo, teto] of [
    ['eng-computacao', 'ate-2022-2', 'ECOM32', 180],
    ['eng-computacao', 'desde-2023-1', 'ECL2023', 54],
    ['eng-controle-automacao', 'ate-2022-2', '7878 / ECA2021', 96],
    ['eng-controle-automacao', 'desde-2023-1', 'CAU2023', 18],
  ]) {
    const r = await classificar('Curso extracurricular na área de concentração do curso', 'padrao', curso, matriz);
    assert.equal(r.sigaa.codigo, codigo);
    assert.ok(r.sigaa.opcao.includes(`(${codigo})`));
    assert.equal(r.calculo.teto_ha, teto);
  }
});

test('os dois cursos exigem a escolha do período da matriz no formulário', async () => {
  for (const curso of ['Engenharia de Computação', 'Engenharia de Controle e Automação']) {
    const entrada = { json: { Curso: curso, 'Ingresso / matriz atual': 'Ingresso até 2022.2', 'Declaração de autenticidade': 'Já tenho minha declaração-base' },
      binary: { Certificado__PDF_: { mimeType: 'application/pdf' }, Declara__o_base__PDF_: { mimeType: 'application/pdf' } } };
    const r = await executar('normalizar-formulario', { entrada });
    assert.equal(r.json.matriz, 'ate-2022-2');
    delete entrada.json['Ingresso / matriz atual'];
    const semIngresso = await executar('normalizar-formulario', { entrada });
    assert.match(semIngresso.json.erro, /ingresso/);
  }
});
