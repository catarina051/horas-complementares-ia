import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { RAIZ, executar } from './n8n.mjs';

const ler = (...p) => JSON.parse(readFileSync(join(RAIZ, ...p), 'utf8'));
const base = ler('regras', 'base-cgrad-05-23.json');
const cursos = ler('regras', 'cursos.json');
const schema = ler('prompts', 'classificacao', 'schema.json');

test('o schema lista as categorias gerais e as de todos os colegiados, sem repetir', () => {
  const esperado = [...base.categorias.map((c) => c.tipo_sigaa)];
  for (const curso of Object.values(cursos)) {
    for (const c of curso.categorias) if (!esperado.includes(c.tipo_sigaa)) esperado.push(c.tipo_sigaa);
  }
  assert.deepEqual(schema.properties.tipo_sigaa.enum, esperado);
});

test('toda regra confirmada tem fórmula, fator, teto e fonte', () => {
  const linhas = [
    ...base.categorias.map((c) => [c, base.fontes]),
    ...Object.values(cursos).flatMap((curso) => curso.categorias.map((c) => [c, { ...base.fontes, ...curso.fontes }])),
  ];
  for (const [c, fontes] of linhas) {
    assert.ok(c.teto_pct?.padrao > 0, `${c.tipo_sigaa}: sem teto`);
    if (c.status !== 'confirmado') continue;
    assert.ok(fontes[c.norma]?.url, `${c.tipo_sigaa}: norma sem URL`);
    assert.ok(c.artigo, `${c.tipo_sigaa}: sem artigo`);
    assert.ok(c.k && Object.keys(c.k).length, `${c.tipo_sigaa}: sem fator K`);
    if (['fixo', 'por_mes', 'por_semestre', 'por_ano', 'por_quantidade'].includes(c.calculo)) {
      assert.ok(c.base_ha > 0, `${c.tipo_sigaa}: sem base_ha`);
    }
    for (const variante of Object.keys(c.k)) {
      assert.ok(schema.properties.variante.enum.includes(variante), `${c.tipo_sigaa}: variante ${variante} fora do schema`);
    }
  }
});

test('cada curso tem modelo de declaração, marca de kit e pelo menos uma matriz com total', () => {
  for (const [id, c] of Object.entries(cursos)) {
    readFileSync(join(RAIZ, 'templates', c.modelo_declaracao));
    assert.ok(c.marca_kit.startsWith('horas-complementares-ia/'), id);
    assert.ok(Object.values(c.matrizes).every((m) => m.total_ac_ha > 0), id);
    if (c.matriz_padrao) assert.ok(c.matrizes[c.matriz_padrao], id);
  }
});

async function calcular(tipo_sigaa, variante, quantidades, curso = 'eng-computacao', matriz = 'desde-2023-1') {
  const classificacao = {
    e_comprovante: true, tipo_sigaa, variante,
    quantidades: { horas: null, dias: null, meses: null, semestres: null, anos: null, quantidade: null, ...quantidades },
  };
  const saida = await executar('validar-calcular', {
    entrada: { json: { statusCode: 200, body: { candidates: [{ content: { parts: [{ text: JSON.stringify(classificacao) }] } }] } } },
    nos: { 'Montar requisição': { json: { origem: 'api', modo: 'api', versao: 'v2', modelo: 'teste', curso, matriz } } },
  });
  return saida.json.calculo;
}

test('curso na área: horas × 1,2', async () => {
  const c = await calcular('Curso extracurricular na área de concentração do curso', 'padrao', { horas: 20 });
  assert.equal(c.ha_abatidas, 24);
  assert.equal(c.teto_ha, 54);
});

test('Computação nova: curso de 400 h tem teto de 40% das 135 h/a do PPC ativo', async () => {
  const c = await calcular('Curso extracurricular na área de concentração do curso', 'padrao', { horas: 400 });
  assert.equal(c.ha_calculadas, 480);
  assert.equal(c.ha_abatidas, 54);
});

test('teto da categoria limita o certificado', async () => {
  const c = await calcular('Curso extracurricular em área diferenciada da área de concentração do curso', 'padrao', { horas: 200 });
  assert.equal(c.ha_calculadas, 120);
  assert.equal(c.ha_abatidas, 27);
  assert.equal(c.limitado_pelo_teto, true);
});

test('congresso conta por dia e pela variante', async () => {
  const nacional = await calcular('Participação em congresso e encontro científico', 'nacional', { dias: 3, horas: 20 });
  assert.equal(nacional.ha_abatidas, 28.8);
  const outros = await calcular('Participação em congresso e encontro científico', 'outros', { dias: 3 });
  assert.equal(outros.ha_abatidas, 14.4);
});

test('valores fixos e por semestre', async () => {
  assert.equal((await calcular('Apresentação de Trabalhos em Eventos', 'internacional', {})).ha_abatidas, 18);
  assert.equal((await calcular('Monitoria', 'padrao', { semestres: 2 })).ha_abatidas, 90);
  assert.equal((await calcular('Representação estudantil em Órgão Colegiado da Instituição', 'suplente', { semestres: 2 })).ha_abatidas, 18);
});

test('PET tem teto maior com certificado final', async () => {
  assert.equal((await calcular('Programa de Educação Tutorial', 'certificado_final', { semestres: 4 })).ha_abatidas, 108);
  assert.equal((await calcular('Programa de Educação Tutorial', 'padrao', { semestres: 4 })).ha_abatidas, 67.5);
});

test('prática profissional: 60 h valem 15 h/a', async () => {
  assert.equal((await calcular('Atividade de Prática Profissional', 'padrao', { horas: 60 })).ha_abatidas, 15);
});

test('Eng. de Computação: extensão segue o colegiado (120 h/a por semestre)', async () => {
  const c = await calcular('Atividade de Extensão', 'padrao', { semestres: 2 });
  assert.equal(c.ha_calculadas, 240);
  assert.equal(c.ha_abatidas, 67.5);
  assert.match(c.norma, /CCECOMLP 06\/22/);
});

test('Eng. de Computação: categorias próprias do colegiado', async () => {
  assert.equal((await calcular('Organização de Visita Técnica', 'padrao', { quantidade: 2 })).ha_abatidas, 36);
  assert.equal((await calcular('Avaliador de Trabalho em Evento Técnico-Científico Local', 'padrao', { quantidade: 5 })).ha_abatidas, 12);
  assert.equal((await calcular('Evento esportivo representando o CEFET-MG', 'padrao', { horas: 10 })).ha_abatidas, 6);
});

test('Controle e Automação: o teto depende do ingresso (240 ou 45 h/a)', async () => {
  const antigo = await calcular('Curso extracurricular na área de concentração do curso', 'padrao', { horas: 100 }, 'eng-controle-automacao', 'ate-2022-2');
  assert.equal(antigo.ha_calculadas, 120);
  assert.equal(antigo.ha_abatidas, 96);
  const novo = await calcular('Curso extracurricular na área de concentração do curso', 'padrao', { horas: 100 }, 'eng-controle-automacao', 'desde-2023-1');
  assert.equal(novo.ha_abatidas, 18);
});

test('Controle e Automação: núcleo estudantil vale; extensão sem fórmula fica a confirmar', async () => {
  const nucleo = await calcular('Participação em Núcleo Estudantil', 'titular', { semestres: 2 }, 'eng-controle-automacao', 'ate-2022-2');
  assert.equal(nucleo.ha_abatidas, 18);
  const extensao = await calcular('Atividade de Extensão', 'padrao', { horas: 40 }, 'eng-controle-automacao', 'ate-2022-2');
  assert.equal(extensao.status, 'a_confirmar');
});

test('categoria própria de outro curso não é calculada', async () => {
  const c = await calcular('Participação em Núcleo Estudantil', 'titular', { semestres: 2 });
  assert.equal(c.status, 'a_confirmar');
  assert.match(c.motivo, /não existe para Engenharia de Computação/);
});

test('sem fórmula na norma ou sem quantidade: a confirmar, sem número inventado', async () => {
  const outras = await calcular('Outras Atividades', 'padrao', { horas: 10 });
  assert.equal(outras.status, 'a_confirmar');
  assert.equal(outras.ha_abatidas, null);
  const semHoras = await calcular('Palestra na área de concentração do curso', 'padrao', {});
  assert.equal(semHoras.status, 'a_confirmar');
  assert.match(semHoras.motivo, /carga horária/);
});
