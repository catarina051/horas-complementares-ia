// 1º uso: preenche o modelo oficial de declaração do curso (templates/, indicado em
// regras/cursos.json) com os dados e a assinatura, para o Gotenberg converter.
const fs = require('fs');
const item = $input.first();
const curso = JSON.parse(fs.readFileSync('/data/regras/cursos.json', 'utf8'))[item.json.curso];

const escapar = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };

const assinatura = item.binary.assinatura;
const bytes = await this.helpers.getBinaryDataBuffer(0, 'assinatura');
let html = fs.readFileSync(`/data/templates/${curso.modelo_declaracao}`, 'utf8');
for (const campo of ['nome', 'matricula', 'rg', 'cpf']) {
  html = html.replaceAll(`{{${campo}}}`, escapar(item.json[campo]));
}
html = html.replace('{{assinatura}}', `data:${assinatura.mimeType};base64,${bytes.toString('base64')}`);
// Imagens do próprio modelo (logo, brasão), lidas de templates/.
html = html.replace(/\{\{arquivo:([\w.-]+)\}\}/g, (_, nome) => (
  `data:${MIME[nome.split('.').pop()]};base64,${fs.readFileSync(`/data/templates/${nome}`).toString('base64')}`
));

const pagina = await this.helpers.prepareBinaryData(Buffer.from(html, 'utf8'), 'index.html', 'text/html');
// A marca nos metadados diz ao serviço `declaracao` onde carimbar a data no reuso.
return [{ json: { ...item.json, marca_kit: curso.marca_kit }, binary: { ...item.binary, html: pagina } }];
