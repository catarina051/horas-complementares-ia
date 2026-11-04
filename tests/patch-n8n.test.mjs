import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { RAIZ } from './n8n.mjs';

// n8n/patches/utils.js substitui um arquivo interno do n8n. Ele só é válido para a versão de onde
// foi copiado; com outra imagem, o formulário quebraria em silêncio.
const VERSAO_DO_PATCH = '2.45.7';

test('o patch do formulário só é montado na versão do n8n de onde foi copiado', () => {
  const compose = readFileSync(join(RAIZ, 'docker-compose.yml'), 'utf8');
  if (!compose.includes('n8n/patches/utils.js')) return;
  const imagem = compose.match(/image:\s*n8nio\/n8n:(\S+)/)?.[1];
  assert.equal(imagem, VERSAO_DO_PATCH, `imagem n8n ${imagem}: refaça n8n/patches/utils.js a partir dela`);
});

test('o patch muda só a sanitização do HTML dos campos do formulário', () => {
  const patch = readFileSync(join(RAIZ, 'n8n', 'patches', 'utils.js'), 'utf8');
  assert.match(patch, /field\.html = field\.html;/);
  assert.doesNotMatch(patch, /field\.html = sanitizeHtml\(field\.html\)/);
});
