// Erro esperado (entrada incompleta, declaração errada, certificado escaneado, limite do modelo):
// página amigável no formulário, JSON 422 na API.
const { origem, erro } = $input.first().json;
const mensagem = erro || 'Algo deu errado. Tente de novo.';

if (origem === 'api') {
  return [{ json: { resposta: JSON.stringify({ erro: mensagem }), content_type: 'application/json; charset=utf-8', status: 422 } }];
}

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));
const html = `
<div style="max-width:560px;margin:40px auto;padding:0 16px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1f2328;line-height:1.5">
  <h1 style="font-size:22px;margin:0 0 12px">Não deu para concluir</h1>
  <p style="border-left:4px solid #cf222e;background:#ffebe9;padding:12px 14px;border-radius:6px;margin:0 0 16px">${esc(mensagem)}</p>
  <p style="color:#59636e;font-size:14px">Recarregue a página para enviar de novo. Nada do que você enviou foi guardado.</p>
</div>`;
return [{ json: { resposta: html, content_type: 'text/html; charset=utf-8', status: 200 } }];
