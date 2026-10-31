import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { RAIZ, codigo } from './n8n.mjs';

const workflow = JSON.parse(readFileSync(join(RAIZ, 'workflows', 'horas-complementares.json'), 'utf8'));

test('o workflow exportado está em dia com n8n/codigo (rode node n8n/montar-workflow.mjs)', () => {
  const arquivos = readFileSync(join(RAIZ, 'n8n', 'montar-workflow.mjs'), 'utf8');
  for (const [, nome, arquivo] of arquivos.matchAll(/code\('([^']+)', '([^']+)'/g)) {
    const no = workflow.nodes.find((n) => n.name === nome);
    assert.ok(no, `nó ${nome} ausente`);
    assert.equal(no.parameters.jsCode, codigo(arquivo), `nó ${nome} desatualizado`);
  }
});

test('os rótulos do formulário batem com os do normalizador', () => {
  const form = workflow.nodes.find((n) => n.type === 'n8n-nodes-base.formTrigger');
  const rotulos = form.parameters.formFields.values.map((f) => f.fieldLabel).filter(Boolean);
  const bloco = codigo('normalizar-formulario').match(/const ROTULOS = \{([\s\S]*?)\};/)[1];
  const esperados = [...bloco.matchAll(/\w+: '([^']+)'/g)].map((m) => m[1]);
  assert.ok(esperados.length >= 8);
  for (const r of esperados) assert.ok(rotulos.includes(r), `rótulo "${r}" não existe no formulário`);
});

test('nenhuma chave ou credencial no workflow', () => {
  const texto = JSON.stringify(workflow);
  assert.ok(!/AIza[0-9A-Za-z_-]{20,}/.test(texto));
  assert.ok(!workflow.nodes.some((n) => n.credentials));
});
