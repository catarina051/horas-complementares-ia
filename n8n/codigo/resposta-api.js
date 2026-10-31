// Resposta JSON da API de avaliação.
const r = $input.first().json;
const corpo = {
  versao: r.versao,
  modelo: r.modelo,
  simulado: r.simulado,
  tipo_sigaa: r.classificacao.tipo_sigaa,
  codigo_sigaa: r.sigaa.codigo,
  opcao_sigaa: r.sigaa.opcao,
  sigaa: r.sigaa,
  ha_certificado: r.ha_certificado,
  ha_abatidas: r.calculo.ha_abatidas,
  teto_ha: r.calculo.teto_ha,
  regra_status: r.calculo.status,
  regra_fonte: r.calculo.url_fonte ? `${r.calculo.norma}, ${r.calculo.artigo}` : null,
  classificacao: r.classificacao,
  calculo: r.calculo,
  tokens: r.tokens,
};
return [{ json: { resposta: JSON.stringify(corpo), content_type: 'application/json; charset=utf-8', status: 200 } }];
