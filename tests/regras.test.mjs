import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { RAIZ, executar } from './n8n.mjs';

const regras = JSON.parse(readFileSync(join(RAIZ, 'regras', 'categorias-cl2023t.json'), 'utf8'));
const schema = JSON.parse(readFileSync(join(RAIZ, 'prompts', 'classificacao', 'schema.json'), 'utf8'));

test('toda categoria do schema tem regra, e vice-versa', () => {
  assert.deepEqual(schema.properties.tipo_sigaa.enum, regras.categorias.map((c) => c.tipo_sigaa));
});

test('toda regra confirmada tem fórmula, fator, teto e fonte', () => {
  for (const c of regras.categorias) {
    assert.ok(c.teto_pct?.padrao > 0, `${c.tipo_sigaa}: sem teto`);
    if (c.status !== 'confirmado') continue;
    assert.ok(regras.fontes[c.norma], `${c.tipo_sigaa}: norma sem URL`);
    assert.ok(c.artigo, `${c.tipo_sigaa}: sem artigo`);
    assert.ok(c.k && Object.keys(c.k).length, `${c.tipo_sigaa}: sem fator K`);
    if (['fixo', 'por_mes', 'por_semestre', 'por_ano'].includes(c.calculo)) assert.ok(c.base_ha > 0, `${c.tipo_sigaa}: sem base_ha`);
    for (const variante of Object.keys(c.k)) {
      assert.ok(schema.properties.variante.enum.includes(variante), `${c.tipo_sigaa}: variante ${variante} fora do schema`);
    }
  }
});

async function calcular(tipo_sigaa, variante, quantidades) {
  const classificacao = {
    e_comprovante: true, tipo_sigaa, variante,
    quantidades: { horas: null, dias: null, meses: null, semestres: null, anos: null, ...quantidades },
  };
  const saida = await executar('validar-calcular', {
    entrada: { json: { statusCode: 200, body: { candidates: [{ content: { parts: [{ text: JSON.stringify(classificacao) }] } }] } } },
    nos: { 'Montar requisição': { json: { origem: 'api', modo: 'api', versao: 'v1', modelo: 'teste' } } },
  });
  return saida.json.calculo;
}

test('curso na área: horas × 1,2', async () => {
  const c = await calcular('Curso extracurricular na área de concentração do curso', 'padrao', { horas: 20 });
  assert.equal(c.ha_abatidas, 24);
  assert.equal(c.teto_ha, 228);
});

test('caso real homologado: curso de 400 h na área virou 228 h/a no SIGAA (teto de 40% de 570)', async () => {
  const c = await calcular('Curso extracurricular na área de concentração do curso', 'padrao', { horas: 400 });
  assert.equal(c.ha_calculadas, 480);
  assert.equal(c.ha_abatidas, 228);
});

test('teto da categoria limita o certificado', async () => {
  const c = await calcular('Curso extracurricular em área diferenciada da área de concentração do curso', 'padrao', { horas: 200 });
  assert.equal(c.ha_calculadas, 120);
  assert.equal(c.ha_abatidas, 114);
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
  assert.equal((await calcular('Programa de Educação Tutorial', 'certificado_final', { semestres: 4 })).ha_abatidas, 456);
  assert.equal((await calcular('Programa de Educação Tutorial', 'padrao', { semestres: 4 })).ha_abatidas, 285);
});

test('prática profissional: 60 h valem 15 h/a', async () => {
  assert.equal((await calcular('Atividade de Prática Profissional', 'padrao', { horas: 60 })).ha_abatidas, 15);
});

test('sem fórmula na norma ou sem quantidade: a confirmar, sem número inventado', async () => {
  const outras = await calcular('Outras Atividades', 'padrao', { horas: 10 });
  assert.equal(outras.status, 'a_confirmar');
  assert.equal(outras.ha_abatidas, null);
  const semHoras = await calcular('Palestra na área de concentração do curso', 'padrao', {});
  assert.equal(semHoras.status, 'a_confirmar');
  assert.match(semHoras.motivo, /carga horária/);
});
