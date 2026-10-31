// Página de resultado: o que marcar no SIGAA, quantas horas abatem e os PDFs para baixar.
// O formulário do n8n troca o corpo da página por este HTML (sem scripts), então tudo é estático.
const r = $('Validar e calcular').first().json;
const final = $input.first().binary?.pdf_final;
if (!final) throw new Error(`Gotenberg não juntou os PDFs: ${$input.first().json.error?.message ?? 'sem resposta'}`);

const c = r.classificacao;
const calc = r.calculo;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));
const num = (v) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^\w]+/g, '_').replace(/^_|_$/g, '').slice(0, 50) || 'atividade';

const pdfFinal = (await this.helpers.getBinaryDataBuffer(0, 'pdf_final')).toString('base64');
const pdfBase = r.modo === 'primeiro_uso' ? $('Guardar base').first().json.declaracao_base_b64 : null;

const horas = calc.ha_abatidas !== null
  ? `<p class="valor">${num(calc.ha_abatidas)} h/a</p>
     <p class="conta">${esc(calc.conta)}${calc.limitado_pelo_teto ? ` → limitado ao teto de ${num(calc.teto_ha)} h/a` : ''}</p>`
  : `<p class="valor pendente">A confirmar</p><p class="conta">${esc(calc.motivo)} Confirme com a Coordenação.</p>`;

const alertas = [];
if (r.simulado) alertas.push('<strong>Modo demonstração:</strong> sem chave do Gemini, a classificação foi feita por palavras-chave. Não use este resultado.');
if (c.alerta_instrucao_suspeita) alertas.push('O certificado contém um texto que tenta instruir a IA. Ele foi ignorado, mas confira se o documento é legítimo.');
if (c.confianca !== 'alta') alertas.push(`Confiança <strong>${esc(c.confianca)}</strong>: ${esc(c.justificativa)}${c.alternativas?.length ? ` Outras opções possíveis: ${c.alternativas.map(esc).join('; ')}.` : ''}`);
if (c.evidencia_faltante) alertas.push(`Falta no certificado: ${esc(c.evidencia_faltante)}`);

const html = `
<style>
  #hc { max-width: 680px; margin: 24px auto; padding: 0 16px; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2328; line-height: 1.5; }
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
    <div class="card"><p class="rotulo">Marque no SIGAA</p><p class="tipo">${esc(c.tipo_sigaa)}</p></div>
    <div class="card"><p class="rotulo">Horas que serão abatidas</p>${horas}</div>
  </div>

  ${alertas.map((a) => `<p class="alerta">${a}</p>`).join('\n  ')}

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
      <dt>Teto da categoria</dt><dd>${num(calc.teto_ha ?? 0)} h/a (${num(calc.teto_pct ?? 0)}% das ${num(calc.total_ac_ha ?? 450)} h/a)</dd>
      <dt>Regra</dt><dd>${calc.url_fonte ? `<a href="${esc(calc.url_fonte)}" target="_blank" rel="noopener">${esc(calc.norma)}</a>, ${esc(calc.artigo)}` : '—'}</dd>
    </dl>
  </div>

  <p class="conta">O teto é somado por categoria. Se você já tem ${num(calc.teto_ha ?? 0)} h/a lançadas em "${esc(c.tipo_sigaa)}", este certificado não abate mais nada.</p>

  <p class="rotulo" style="margin-top:18px">Como lançar</p>
  <ol>
    <li>SIGAA → Portal do Discente → Ensino → Registro de Atividades Complementares (ou Autônomas) → Cadastrar Novo Registro.</li>
    <li>Tipo: <strong>${esc(c.tipo_sigaa)}</strong>.</li>
    <li>Anexe o PDF baixado (declaração datada + certificado) e cole a descrição.</li>
  </ol>

  <p class="rodape">A validação final é da Coordenação do curso. Matriz considerada: Eng. de Computação Leopoldina, ingresso 2022.1 (450 h/a).
  Nada foi guardado: os arquivos foram descartados ao fim do processamento.</p>
</div>`;

return [{ json: { resposta: html, content_type: 'text/html; charset=utf-8', status: 200 } }];
