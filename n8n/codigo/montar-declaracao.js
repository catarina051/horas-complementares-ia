// 1º uso: preenche o Anexo I com os dados e a assinatura (data URI) para o Gotenberg converter.
const fs = require('fs');
const item = $input.first();

const escapar = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const assinatura = item.binary.assinatura;
const bytes = await this.helpers.getBinaryDataBuffer(0, 'assinatura');
let html = fs.readFileSync('/data/templates/declaracao.html', 'utf8');
for (const campo of ['nome', 'matricula', 'rg', 'cpf']) {
  html = html.replaceAll(`{{${campo}}}`, escapar(item.json[campo]));
}
html = html.replace('{{assinatura}}', `data:${assinatura.mimeType};base64,${bytes.toString('base64')}`);

const pagina = await this.helpers.prepareBinaryData(Buffer.from(html, 'utf8'), 'index.html', 'text/html');
return [{ json: item.json, binary: { ...item.binary, html: pagina } }];
