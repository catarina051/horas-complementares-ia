// Roda o código de um Code node (n8n/codigo/*.js) fora do n8n, com $input, $(), $env e require
// simulados. Caminhos /data/... apontam para a raiz do repositório, como no docker-compose.
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const local = (p) => (p.startsWith('/data/') ? join(RAIZ, p.slice('/data/'.length)) : p);
const fsData = {
  readFileSync: (p, ...resto) => fs.readFileSync(local(p), ...resto),
  existsSync: (p) => fs.existsSync(local(p)),
};

export function codigo(nome) {
  return fs.readFileSync(join(RAIZ, 'n8n', 'codigo', `${nome}.js`), 'utf8');
}

export async function executar(nome, { entrada = { json: {} }, nos = {}, env = {} } = {}) {
  const $input = { first: () => entrada, all: () => [entrada] };
  const $ = (no) => ({ first: () => nos[no], isExecuted: no in nos });
  const helpers = {
    getBinaryDataBuffer: async (_i, prop) => entrada.binary[prop].buffer,
    prepareBinaryData: async (buffer, fileName, mimeType) => ({ buffer, fileName, mimeType }),
  };
  const fn = new AsyncFunction('$input', '$', '$env', 'require', codigo(nome));
  const saida = await fn.call({ helpers }, $input, $, env, (m) => (m === 'fs' ? fsData : null));
  return saida[0];
}
