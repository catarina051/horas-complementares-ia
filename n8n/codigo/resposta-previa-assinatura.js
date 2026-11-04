// Devolve ao editor do formulário o recorte com IA feito pelo serviço `declaracao`.
// Nada é guardado: a imagem só passa por esta execução, cujo histórico não é salvo.
const r = $input.first().json;
const ok = r.statusCode === 200 && r.body?.imagem_base64;
const corpo = ok ? r.body : { erro: r.body?.erro ?? 'Não consegui recortar a assinatura com IA. Use o recorte manual.' };
return [{ json: { resposta: JSON.stringify(corpo), content_type: 'application/json; charset=utf-8', status: ok ? 200 : 422 } }];
