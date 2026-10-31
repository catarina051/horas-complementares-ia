// Entrada do formulário → campos padronizados e validação do que cada modo exige.
// O Form Trigger 2.1 identifica cada campo pelo rótulo, e o arquivo pelo rótulo com \W → _.
// Estes rótulos precisam ser iguais aos de n8n/montar-workflow.mjs (um teste confere).
const ROTULOS = {
  curso: 'Curso',
  ingresso: 'Ingresso (só Controle e Automação)',
  certificado: 'Certificado (PDF)',
  modo: 'Declaração de autenticidade',
  nome: 'Nome completo',
  matricula: 'Matrícula',
  rg: 'RG',
  cpf: 'CPF',
  assinatura: 'Foto da assinatura (JPG ou PNG)',
  declaracao_base: 'Declaração-base (PDF)',
};
const fs = require('fs');
const cursos = JSON.parse(fs.readFileSync('/data/regras/cursos.json', 'utf8'));
const item = $input.first();
const texto = (chave) => (typeof item.json[ROTULOS[chave]] === 'string' ? item.json[ROTULOS[chave]].trim() : '');
const recebidos = item.binary ?? {};
const arquivos = Object.fromEntries(['certificado', 'assinatura', 'declaracao_base']
  .map((chave) => [chave, recebidos[ROTULOS[chave].replace(/\W/g, '_')]])
  .filter(([, arquivo]) => arquivo));

const modo = texto('modo').startsWith('Primeira') ? 'primeiro_uso' : 'reuso';
// As opções de Curso e Ingresso no formulário são os rótulos de regras/cursos.json.
const [cursoId, curso] = Object.entries(cursos).find(([, c]) => c.rotulo_formulario === texto('curso')) ?? [];
const matrizId = curso?.matriz_padrao
  ?? Object.entries(curso?.matrizes ?? {}).find(([, m]) => m.rotulo === texto('ingresso'))?.[0];
const saida = {
  origem: 'formulario',
  modo,
  versao: 'v2',
  curso: cursoId ?? null,
  matriz: matrizId ?? null,
  nome: texto('nome').replace(/\s+/g, ' '),
  matricula: texto('matricula'),
  rg: texto('rg'),
  cpf: texto('cpf'),
  erro: '',
};

const faltando = [];
if (!curso) faltando.push('o curso');
else if (!matrizId) faltando.push(`o ingresso (obrigatório para ${curso.nome})`);
if (!arquivos.certificado) faltando.push('o certificado');
if (modo === 'primeiro_uso') {
  if (!saida.nome) faltando.push('o nome completo');
  if (!saida.matricula) faltando.push('a matrícula');
  if (!saida.rg) faltando.push('o RG');
  if (!saida.cpf) faltando.push('o CPF');
  if (!arquivos.assinatura) faltando.push('a foto da assinatura');
} else if (!arquivos.declaracao_base) {
  faltando.push('a sua declaração-base (PDF que a ferramenta gerou no primeiro uso)');
}

const problemas = [];
if (faltando.length) problemas.push(`Faltou enviar ${faltando.join(', ')}.`);
if (arquivos.certificado && arquivos.certificado.mimeType !== 'application/pdf') {
  problemas.push('O certificado precisa estar em PDF.');
}
if (modo === 'reuso' && arquivos.declaracao_base && arquivos.declaracao_base.mimeType !== 'application/pdf') {
  problemas.push('A declaração-base precisa estar em PDF.');
}
if (modo === 'primeiro_uso') {
  if (arquivos.assinatura && !/^image\/(png|jpe?g)$/.test(arquivos.assinatura.mimeType)) {
    problemas.push('A assinatura precisa ser uma foto em JPG ou PNG.');
  }
  if (saida.matricula && !/^\d{6,15}$/.test(saida.matricula)) problemas.push('A matrícula deve ter só números.');
  if (saida.cpf && saida.cpf.replace(/\D/g, '').length !== 11) problemas.push('O CPF deve ter 11 dígitos.');
}
saida.erro = problemas.join(' ');

// Só segue o que o modo usa: no reuso a assinatura e os dados digitados são descartados.
const binary = { certificado: arquivos.certificado };
if (modo === 'primeiro_uso') binary.assinatura = arquivos.assinatura;
else binary.declaracao_base = arquivos.declaracao_base;
return [{ json: saida, binary }];
