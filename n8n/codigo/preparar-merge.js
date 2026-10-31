// Declaração datada + certificado. O Gotenberg junta em ordem alfabética do nome do arquivo.
const prep = $('Preparar certificado').first();
const declaracao = await this.helpers.prepareBinaryData(
  Buffer.from(prep.json.declaracao_datada_b64, 'base64'), '1_declaracao.pdf', 'application/pdf',
);
return [{
  json: $input.first().json,
  binary: { declaracao, certificado: { ...prep.binary.certificado, fileName: '2_certificado.pdf' } },
}];
