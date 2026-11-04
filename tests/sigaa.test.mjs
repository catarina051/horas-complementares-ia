import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { RAIZ, executar } from './n8n.mjs';

async function classificar(tipo_sigaa, variante = 'padrao', curso = 'eng-computacao', matriz = 'desde-2023-1', codigo_sigaa = undefined) {
  const c = { e_comprovante: true, codigo_sigaa, tipo_sigaa, variante, quantidades: { horas: 50 }, confianca: 'alta' };
  const saida = await executar('validar-calcular', {
    entrada: { json: { statusCode: 200, body: { candidates: [{ content: { parts: [{ text: JSON.stringify(c) }] } }] } } },
    nos: { 'Montar requisição': { json: { origem: 'api', modo: 'api', curso, matriz } } },
  });
  return saida.json;
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
  const cert = await classificar('Programa de Educação Tutorial', 'certificado_final');
  const parc = await classificar('Programa de Educação Tutorial', 'padrao');
  assert.notEqual(cert.sigaa.opcao, parc.sigaa.opcao);
  assert.ok(cert.sigaa.opcao.includes('FINAL'));
  assert.ok(parc.sigaa.opcao.includes('PARCIAL'));

  const semVariante = await classificar('Programa de Educação Tutorial', 'inexistente');
  assert.equal(semVariante.sigaa.opcao, null);
  assert.equal(semVariante.sigaa.status, 'a_confirmar');
});

test('categoria própria ausente nas capturas pede confirmação sem inventar opção', async () => {
  const r = await classificar('Monitor de Evento');
  assert.equal(r.sigaa.opcao, null);
  assert.equal(r.sigaa.status, 'a_confirmar');
});

test('resultado HTML e JSON apresentam a opção completa, o código e o pré-visualizador de PDF', async () => {
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
  assert.ok(pagina.json.resposta.includes('Pré-visualização do PDF Final'));
  assert.ok(pagina.json.resposta.includes('data:application/pdf;base64,'));
});

test('todas as versões dos cursos usam código e teto próprios', async () => {
  for (const [curso, matriz, codigo, teto] of [
    ['eng-computacao', 'ate-2022-2', 'ECOM32', 180],
    ['eng-computacao', 'migracao', 'CL2023T', 228],
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

test('aluno que migrou para a grade nova recebe código CL2023T e opções correspondentes', async () => {
  const r = await classificar('Curso extracurricular na área de concentração do curso', 'padrao', 'eng-computacao', 'migracao');
  assert.equal(r.sigaa.codigo, 'CL2023T');
  assert.equal(r.sigaa.opcao, 'OUTRAS ATIVIDADES COMPLEMENTARES/(CL2023T) CURSO EXTRACURRICULAR NA ÁREA DE CONCENTRAÇÃO DO CURSO (1.2h)');
  assert.equal(r.calculo.total_ac_ha, 570);
  assert.equal(r.calculo.teto_ha, 228);
});

test('os dois cursos exigem a escolha do período da matriz no formulário', async () => {
  for (const curso of ['Engenharia de Computação', 'Engenharia de Controle e Automação']) {
    const entrada = { json: { Curso: curso, 'Ingresso / matriz atual': 'Ingressei antes de 2023.1 e MIGREI para a grade nova', 'Declaração de autenticidade': 'Já tenho minha declaração-base' },
      binary: { Certificado__PDF_: { mimeType: 'application/pdf' }, Declara__o_base__PDF_: { mimeType: 'application/pdf' } } };
    const r = await executar('normalizar-formulario', { entrada });
    assert.equal(r.json.matriz, 'migracao');
    delete entrada.json['Ingresso / matriz atual'];
    const semIngresso = await executar('normalizar-formulario', { entrada });
    assert.match(semIngresso.json.erro, /ingresso/);
  }
});

test('montar-requisicao inclui grade do aluno, código SIGAA e tipos disponíveis no prompt', async () => {
  const entrada = {
    json: {
      versao: 'v2',
      curso: 'eng-computacao',
      matriz: 'migracao',
      texto_anonimizado: 'Certificado de curso na área de software',
    },
  };
  const r = await executar('montar-requisicao', { entrada });
  const partes = r.json.requisicao.contents[0].parts[0].text;
  assert.ok(partes.includes('CL2023T'));
  assert.ok(partes.includes('matriz de transição'));
  assert.ok(partes.includes('Tipos cadastrados no SIGAA para este código'));
  assert.ok(partes.includes('Curso extracurricular na área de concentração do curso'));
});

test('montar-requisicao diferencia grade antiga de Controle e Automação', async () => {
  const entrada = {
    json: {
      versao: 'v2',
      curso: 'eng-controle-automacao',
      matriz: 'ate-2022-2',
      texto_anonimizado: 'Certificado de curso de CLP',
    },
  };
  const r = await executar('montar-requisicao', { entrada });
  const partes = r.json.requisicao.contents[0].parts[0].text;
  assert.ok(partes.includes('7878 / ECA2021'));
  assert.ok(partes.includes('NÃO migrou'));
});
