// Valida a resposta do modelo e calcula as horas pelas regras de regras/:
// base-cgrad-05-23.json (comum a todos) + cursos.json (total da matriz e categorias do colegiado).
// O modelo só escolhe categoria, variante e quantidades; toda conta é feita aqui.
const fs = require('fs');
const regrasBase = JSON.parse(fs.readFileSync('/data/regras/base-cgrad-05-23.json', 'utf8'));
const cursos = JSON.parse(fs.readFileSync('/data/regras/cursos.json', 'utf8'));
const tiposSigaa = JSON.parse(fs.readFileSync('/data/regras/tipos-sigaa.json', 'utf8'));
const base = $('Montar requisição').first().json;
const r = $input.first().json;

const num = (v) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const arred = (v) => Math.round(v * 100) / 100;
const UNIDADE = {
  por_hora: 'horas', por_dia: 'dias', por_mes: 'meses', por_semestre: 'semestres', por_ano: 'anos', por_quantidade: 'quantidade',
};
const ROTULO_UNIDADE = { horas: 'a carga horária', quantidade: 'a quantidade (organizações, trabalhos)' };

function calcular(regrasBase, curso, matrizId, c) {
  const matriz = curso.matrizes[matrizId];
  // A regra do colegiado do curso vale no lugar da geral quando as duas tratam da mesma categoria.
  const cat = curso.categorias.find((x) => x.tipo_sigaa === c.tipo_sigaa)
    ?? regrasBase.categorias.find((x) => x.tipo_sigaa === c.tipo_sigaa);
  const contexto = { curso: curso.nome, matriz: matriz.rotulo, total_ac_ha: matriz.total_ac_ha };
  if (!cat) return { ...contexto, status: 'a_confirmar', motivo: `Esta categoria não existe para ${curso.nome}.` };

  const fonte = curso.fontes[cat.norma] ?? regrasBase.fontes[cat.norma];
  const tetoPct = cat.teto_pct[c.variante] ?? cat.teto_pct.padrao;
  const resultado = {
    ...contexto,
    status: 'confirmado',
    teto_pct: tetoPct,
    teto_ha: arred((matriz.total_ac_ha * tetoPct) / 100),
    norma: fonte.nome,
    artigo: cat.artigo,
    url_fonte: fonte.url,
    observacao: cat.observacao ?? null,
    ha_calculadas: null,
    ha_abatidas: null,
    conta: null,
  };
  if (cat.calculo === 'a_definir') {
    return { ...resultado, status: 'a_confirmar', motivo: 'A norma não define a fórmula: a Coordenação decide o valor.' };
  }

  const k = cat.k[c.variante] ?? cat.k.padrao;
  if (k === undefined) {
    return { ...resultado, status: 'a_confirmar', motivo: `Não sei qual fator usar (variante "${c.variante}").` };
  }

  const unidade = UNIDADE[cat.calculo];
  const qtd = unidade ? Number(c.quantidades?.[unidade]) : 1;
  if (unidade && !(qtd > 0)) {
    return { ...resultado, status: 'a_confirmar', motivo: `O certificado não informa ${ROTULO_UNIDADE[unidade] ?? `o número de ${unidade}`}.` };
  }

  let ha;
  let conta;
  if (cat.calculo === 'por_hora') {
    const fator = cat.ha_por_hora ?? 1.2;
    ha = k * qtd * fator;
    conta = `${num(qtd)} h × K ${num(k)} × ${num(fator)}`;
  } else if (cat.calculo === 'por_dia') {
    ha = k * 9.6 * qtd;
    conta = `${num(qtd)} dia(s) × 9,6 × K ${num(k)}`;
  } else if (cat.calculo === 'fixo') {
    ha = k * cat.base_ha;
    conta = `${num(cat.base_ha)} h/a × K ${num(k)}`;
  } else {
    ha = k * cat.base_ha * qtd;
    conta = `${num(qtd)} ${unidade} × ${num(cat.base_ha)} h/a × K ${num(k)}`;
  }
  ha = arred(ha);
  return {
    ...resultado,
    ha_calculadas: ha,
    ha_abatidas: Math.min(ha, resultado.teto_ha),
    limitado_pelo_teto: ha > resultado.teto_ha,
    conta: `${conta} = ${num(ha)} h/a`,
  };
}

const falha = (erro) => [{ json: { origem: base.origem, modo: base.modo, erro } }];

if (r.statusCode === 429) return falha('O limite gratuito do modelo de IA acabou por agora. Tente de novo em alguns minutos.');
if (r.statusCode === 503) return falha('O modelo de IA está sobrecarregado agora. Tente de novo em alguns minutos.');
if (r.statusCode === undefined && /timeout|aborted/i.test(r.error?.message ?? '')) {
  return falha('O modelo de IA demorou demais para responder. Tente de novo.');
}
if (r.statusCode !== 200) return falha(`O modelo de IA não respondeu (erro ${r.statusCode ?? 'de rede'}). Tente de novo.`);

let c;
try {
  c = JSON.parse(r.body.candidates[0].content.parts[0].text);
} catch (e) {
  return falha('O modelo de IA devolveu uma resposta fora do formato. Tente de novo.');
}
if (!c.e_comprovante) {
  return falha(`Este arquivo não parece um certificado ou comprovante de atividade. ${c.justificativa ?? ''}`.trim());
}

const horas = Number(c.quantidades?.horas);
const uso = r.body.usageMetadata ?? {};
// Identificadores e rótulos vêm das capturas do SIGAA, nunca do modelo.
const codigoMatriz = cursos[base.curso].matrizes[base.matriz].codigo_sigaa;
c.codigo_sigaa = c.codigo_sigaa ?? codigoMatriz;
const codigoSigaa = codigoMatriz;
let varianteSigaa = c.variante;
if (codigoSigaa === '7878 / ECA2021' && c.tipo_sigaa === 'Participação em Programas de Intercâmbio cultural/estudantil') {
  const meses = Number(c.quantidades?.meses) || Number(c.quantidades?.anos) * 12;
  varianteSigaa = meses >= 12 ? 'um_ano_ou_mais' : meses === 6 ? 'seis_meses' : null;
}
const opcoes = (tiposSigaa.matrizes[codigoSigaa] ?? []).filter((o) => (
  o.categoria === c.tipo_sigaa && (o.variante === varianteSigaa || o.variante === '*')
));
const sigaa = {
  codigo: codigoSigaa,
  opcao: opcoes.length === 1 ? opcoes[0].opcao : null,
  status: opcoes.length === 1 ? 'confirmado' : 'a_confirmar',
  motivo: opcoes.length === 1 ? null : 'Não há uma opção confirmada nas capturas para esta categoria e variante. Confira o tipo com a Coordenação antes de lançar.',
};
return [{
  json: {
    origem: base.origem,
    modo: base.modo,
    versao: base.versao,
    modelo: base.modelo,
    curso: base.curso,
    matriz: base.matriz,
    simulado: Boolean(r.simulado),
    linha_data: base.linha_data,
    classificacao: c,
    sigaa,
    calculo: calcular(regrasBase, cursos[base.curso], base.matriz, c),
    ha_certificado: horas > 0 ? arred(horas * 1.2) : null,
    tokens: { entrada: uso.promptTokenCount ?? 0, saida: uso.candidatesTokenCount ?? 0 },
    erro: '',
  },
}];
