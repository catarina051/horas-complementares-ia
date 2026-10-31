// Valida a resposta do modelo e calcula as horas pela tabela regras/categorias-2022-1.json.
// O modelo só escolhe categoria, variante e quantidades; toda conta é feita aqui.
const fs = require('fs');
const regras = JSON.parse(fs.readFileSync('/data/regras/categorias-2022-1.json', 'utf8'));
const base = $('Montar requisição').first().json;
const r = $input.first().json;

const num = (v) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const arred = (v) => Math.round(v * 100) / 100;
const UNIDADE = { por_hora: 'horas', por_dia: 'dias', por_mes: 'meses', por_semestre: 'semestres', por_ano: 'anos' };

function calcular(regras, c) {
  const cat = regras.categorias.find((x) => x.tipo_sigaa === c.tipo_sigaa);
  if (!cat) return { status: 'a_confirmar', motivo: 'Categoria sem regra cadastrada.' };

  const tetoPct = cat.teto_pct[c.variante] ?? cat.teto_pct.padrao;
  const resultado = {
    status: 'confirmado',
    teto_pct: tetoPct,
    teto_ha: arred((regras.total_ac_ha * tetoPct) / 100),
    total_ac_ha: regras.total_ac_ha,
    norma: cat.norma === 'cgrad05_23' ? 'Resolução CGRAD 05/23' : 'Resolução CGRAD 19/11',
    artigo: cat.artigo,
    url_fonte: regras.fontes[cat.norma],
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
    return { ...resultado, status: 'a_confirmar', motivo: `O certificado não informa ${unidade === 'horas' ? 'a carga horária' : `o número de ${unidade}`}.` };
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
return [{
  json: {
    origem: base.origem,
    modo: base.modo,
    versao: base.versao,
    modelo: base.modelo,
    simulado: Boolean(r.simulado),
    linha_data: base.linha_data,
    classificacao: c,
    calculo: calcular(regras, c),
    ha_certificado: horas > 0 ? arred(horas * 1.2) : null,
    tokens: { entrada: uso.promptTokenCount ?? 0, saida: uso.candidatesTokenCount ?? 0 },
    erro: '',
  },
}];
