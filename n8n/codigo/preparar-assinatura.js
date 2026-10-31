// Recupera a entrada do formulário e substitui a foto pelo PNG recortado localmente.
const item = $('Normalizar formulário').first();
const resposta = $input.first().json;
if (resposta.statusCode !== 200 || !resposta.body?.imagem_base64) {
  return [{ json: { ...item.json, erro: resposta.body?.erro ?? 'Não consegui recortar a assinatura. Envie uma foto nítida em papel branco.' } }];
}
const assinatura = await this.helpers.prepareBinaryData(
  Buffer.from(resposta.body.imagem_base64, 'base64'), 'assinatura.png', 'image/png',
);
return [{ json: item.json, binary: { ...item.binary, assinatura } }];
