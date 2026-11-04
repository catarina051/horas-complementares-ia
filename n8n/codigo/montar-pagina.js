// Página de resultado: o que marcar no SIGAA, quantas horas abatem e os PDFs para baixar.
// O formulário do n8n troca o corpo da página por este HTML (sem scripts), então tudo é estático.
const r = $('Validar e calcular').first().json;
const final = $input.first().binary?.pdf_final;
if (!final) throw new Error(`Gotenberg não juntou os PDFs: ${$input.first().json.error?.message ?? 'sem resposta'}`);

const c = r.classificacao;
const calc = r.calculo;
const sigaa = r.sigaa;
const tipoCompleto = sigaa.opcao ?? c.tipo_sigaa;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));
const num = (v) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^\w]+/g, '_').replace(/^_|_$/g, '').slice(0, 50) || 'atividade';

const pdfFinalBuf = await this.helpers.getBinaryDataBuffer(0, 'pdf_final');
const pdfFinal = pdfFinalBuf.toString('base64');
const pdfBase = r.modo === 'primeiro_uso' ? $('Guardar base').first().json.declaracao_base_b64 : null;

// Renderização das páginas do PDF para visualização em imagem (compatível com Edge, Chrome, Safari)
let paginas = [];
try {
  let dados;
  if (this?.helpers?.httpRequest) {
    dados = await this.helpers.httpRequest({
      method: 'POST',
      url: 'http://declaracao:8000/renderizar',
      body: pdfFinalBuf,
      headers: { 'Content-Type': 'application/pdf' },
      json: true,
    });
  } else if (typeof fetch !== 'undefined') {
    const resp = await fetch('http://declaracao:8000/renderizar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf' },
      body: pdfFinalBuf,
    });
    if (resp.ok) dados = await resp.json();
  }
  if (dados?.paginas) paginas = dados.paginas;
} catch (e) {
  // Em testes unitários sem o serviço declaracao ativo, continua normalmente
}

const horas = calc.ha_abatidas !== null
  ? `<p class="valor">${num(calc.ha_abatidas)} h/a</p>
     <p class="conta">${esc(calc.conta)}${calc.limitado_pelo_teto ? ` → limitado ao teto de ${num(calc.teto_ha)} h/a` : ''}</p>`
  : `<p class="valor pendente">A confirmar</p><p class="conta">${esc(calc.motivo)} Confirme com a Coordenação.</p>`;

const alertas = [];
if (sigaa.status !== 'confirmado') alertas.push(esc(sigaa.motivo));
if (r.simulado) alertas.push('<strong>Modo demonstração:</strong> sem chave do Gemini, a classificação foi feita por palavras-chave. Não use este resultado.');
if (c.alerta_instrucao_suspeita) alertas.push('O certificado contém um texto que tenta instruir a IA. Ele foi ignorado, mas confira se o documento é legítimo.');
if (c.confianca !== 'alta') alertas.push(`Confiança <strong>${esc(c.confianca)}</strong>: ${esc(c.justificativa)}${c.alternativas?.length ? ` Outras opções possíveis: ${c.alternativas.map(esc).join('; ')}.` : ''}`);
if (c.evidencia_faltante) alertas.push(`Falta no certificado: ${esc(c.evidencia_faltante)}`);

let previewCorpo = '';
if (paginas.length > 0) {
  previewCorpo = `
    <div style="border: 1px solid #d1d9e0; border-radius: 8px; background: #eef1f5; padding: 16px; display: flex; flex-direction: column; align-items: center; gap: 20px;">
      ${paginas.map((p, idx) => `
        <div id="preview-pag-${idx + 1}" style="background: #fff; box-shadow: 0 4px 14px rgba(0,0,0,0.12); border-radius: 6px; overflow: hidden; width: 100%; max-width: 600px; border: 1px solid #d0d7de;">
          <div style="background: #f6f8fa; border-bottom: 1px solid #d0d7de; padding: 8px 14px; font-size: 13px; font-weight: 600; color: #59636e; display: flex; justify-content: space-between; align-items: center;">
            <span>📄 Página ${idx + 1} de ${paginas.length}${idx === 0 ? ' · Declaração assinada' : ' · Certificado'}</span>
            ${paginas.length > 1 ? `<a href="#preview-pag-${idx === 0 ? 2 : 1}" style="font-size: 12px; color: #0969da; text-decoration: none; font-weight: 500;">${idx === 0 ? 'Ir para Certificado ↓' : 'Ir para Declaração ↑'}</a>` : ''}
          </div>
          <img src="${p.imagem_b64}" alt="Página ${idx + 1}" style="display: block; width: 100%; height: auto;" />
        </div>
      `).join('')}
    </div>`;
} else {
  previewCorpo = `
    <div style="border: 1px dashed #d1d9e0; border-radius: 8px; padding: 20px; text-align: center; background: #f6f8fa;">
      <p style="margin: 0; color: #59636e; font-size: 14px;">
        O documento foi montado com sucesso contendo a declaração assinada e o certificado.
        Clique no botão abaixo para baixar o arquivo completo e conferir antes de lançar no SIGAA.
      </p>
    </div>`;
}

const html = `
<style>
  html, body { height: auto !important; min-height: 100vh; overflow-y: auto !important; scroll-behavior: smooth; }
  #hc { max-width: 680px; margin: 24px auto; padding: 0 16px 48px; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2328; line-height: 1.5; height: auto !important; overflow: visible !important; }
  #hc h1 { font-size: 22px; margin: 0 0 4px; }
  #hc .sub { color: #59636e; margin: 0 0 20px; }
  #hc .destaque { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  #hc .card { border: 1px solid #d1d9e0; border-radius: 10px; padding: 14px 16px; background: #fff; }
  #hc .rotulo { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #59636e; margin: 0 0 4px; }
  #hc .tipo { font-size: 17px; font-weight: 650; margin: 0; }
  #hc .valor { font-size: 28px; font-weight: 700; margin: 0; color: #1a7f37; }
  #hc .valor.pendente { color: #9a6700; font-size: 22px; }
  #hc .conta { font-size: 13px; color: #59636e; margin: 4px 0 0; }
  #hc .alerta { border-left: 4px solid #d4a72c; background: #fff8c5; padding: 10px 12px; border-radius: 6px; margin: 0 0 10px; font-size: 14px; }
  #hc dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 14px; margin: 0; font-size: 14px; }
  #hc dt { color: #59636e; }
  #hc dd { margin: 0; }
  #hc textarea { width: 100%; box-sizing: border-box; font: inherit; font-size: 14px; padding: 8px; border: 1px solid #d1d9e0; border-radius: 6px; resize: vertical; }
  #hc .botoes { display: flex; flex-wrap: wrap; gap: 10px; margin: 18px 0; }
  #hc .botao { display: inline-block; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; }
  #hc .primario { background: #1f6feb; color: #fff; }
  #hc .secundario { background: #f6f8fa; color: #1f2328; border: 1px solid #d1d9e0; }
  #hc ol { padding-left: 20px; font-size: 14px; }
  #hc .rodape { font-size: 12px; color: #59636e; border-top: 1px solid #d1d9e0; padding-top: 12px; margin-top: 20px; }
  #hc a { color: #0969da; }
  @media (max-width: 520px) { #hc .destaque { grid-template-columns: 1fr; } }
</style>
<div id="hc">
  <h1>Pronto para lançar no SIGAA</h1>
  <p class="sub">${esc(c.atividade)} · ${esc(c.instituicao)}</p>

  <div class="destaque">
    <div class="card"><p class="rotulo">${sigaa.opcao ? 'Marque no SIGAA' : 'Tipo a confirmar no SIGAA'}</p><p class="tipo">${esc(tipoCompleto)}</p><p class="conta">Código: <strong>${esc(sigaa.codigo)}</strong></p></div>
    <div class="card"><p class="rotulo">Horas que serão abatidas</p>${horas}</div>
  </div>

  ${alertas.map((a) => `<p class="alerta">${a}</p>`).join('\n  ')}

  <div class="card" style="margin-bottom: 16px;">
    <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
      <p class="rotulo" style="margin: 0;">Pré-visualização do PDF Final</p>
      ${paginas.length ? `<span style="font-size: 12px; color: #59636e;">${paginas.length} ${paginas.length === 1 ? 'página' : 'páginas'}</span>` : ''}
    </div>
    <p class="conta" style="margin-bottom: 12px;">Confira as páginas do documento montado (declaração com assinatura e certificado anexado) antes de baixar:</p>

    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; align-items: center;">
      <a class="botao primario" style="padding: 7px 14px; font-size: 13px;" download="AC_${slug(c.atividade)}.pdf" href="data:application/pdf;base64,${pdfFinal}">⬇️ Baixar PDF Completo</a>
      <a class="botao secundario" style="padding: 7px 14px; font-size: 13px;" target="_blank" href="data:application/pdf;base64,${pdfFinal}">🔍 Abrir PDF em Nova Aba</a>
      ${paginas.length > 1 ? `
        <a href="#preview-pag-1" style="font-size: 12px; color: #0969da; text-decoration: none; padding: 5px 10px; background: #fff; border: 1px solid #d0d7de; border-radius: 6px;">Pág. 1 (Declaração)</a>
        <a href="#preview-pag-2" style="font-size: 12px; color: #0969da; text-decoration: none; padding: 5px 10px; background: #fff; border: 1px solid #d0d7de; border-radius: 6px;">Pág. 2 (Certificado)</a>
      ` : ''}
    </div>

    ${previewCorpo}
  </div>

  <div class="botoes">
    <a class="botao primario" download="AC_${slug(c.atividade)}.pdf" href="data:application/pdf;base64,${pdfFinal}">Baixar PDF para o SIGAA</a>
    ${pdfBase ? `<a class="botao secundario" download="minha-declaracao-base.pdf" href="data:application/pdf;base64,${pdfBase}">Baixar minha declaração-base</a>` : ''}
  </div>
  ${pdfBase ? '<p class="conta" style="margin:-8px 0 16px">Guarde a declaração-base: no próximo certificado, escolha "Já tenho minha declaração-base" e envie só ela e o certificado. A data é trocada sozinha.</p>' : ''}

  <div class="card">
    <p class="rotulo">Descrição para colar no SIGAA</p>
    <textarea rows="2" readonly>${esc(c.descricao_sigaa)}</textarea>
    <dl style="margin-top:12px">
      <dt>Período</dt><dd>${esc(c.periodo) || '—'}</dd>
      <dt>Carga do certificado</dt><dd>${c.quantidades?.horas ? `${num(c.quantidades.horas)} h` : '—'}</dd>
      <dt>Teto da categoria</dt><dd>${num(calc.teto_ha ?? 0)} h/a (${num(calc.teto_pct ?? 0)}% das ${num(calc.total_ac_ha)} h/a)</dd>
      <dt>Regra</dt><dd>${calc.url_fonte ? `<a href="${esc(calc.url_fonte)}" target="_blank" rel="noopener">${esc(calc.norma)}</a>, ${esc(calc.artigo)}` : '—'}</dd>
    </dl>
  </div>

  <p class="conta">O teto é somado por categoria. Se você já tem ${num(calc.teto_ha ?? 0)} h/a lançadas em "${esc(c.tipo_sigaa)}", este certificado não abate mais nada.</p>

  <p class="rotulo" style="margin-top:18px">Como lançar</p>
  <ol>
    <li>SIGAA → Portal do Discente → Ensino → Registro de Atividades Complementares (ou Autônomas) → Cadastrar Novo Registro.</li>
    <li>Tipo: <strong>${esc(tipoCompleto)}</strong> (código ${esc(sigaa.codigo)}).${sigaa.opcao ? '' : ' Confirme a opção com a Coordenação antes de lançar.'}</li>
    <li>Anexe o PDF baixado (declaração datada + certificado) e cole a descrição.</li>
  </ol>

  <p class="rodape">A validação final é da Coordenação do curso. Curso e matriz considerados: ${esc(calc.curso)}, ${esc(calc.matriz)} (${num(calc.total_ac_ha)} h/a).
  Nada foi guardado: os arquivos foram descartados ao fim do processamento.</p>
</div>`;

return [{ json: { resposta: html, content_type: 'text/html; charset=utf-8', status: 200 } }];
