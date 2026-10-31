# Changelog dos prompts

Formato de cada versão: o erro que apareceu na avaliação → a correção no prompt → o acerto antes e
depois, medido com `evals/run_eval.py` no mesmo conjunto de certificados.

## classificacao/v2

Motivo: a ferramenta passou a atender também Engenharia de Controle e Automação.

- Erro que a v1 cometeria: "curso na área" era sempre computação, então um curso de CLP para um aluno
  de Controle e Automação cairia em "área diferenciada" e valeria metade das horas.
- Correção: cada pedido traz um bloco `<curso>` com a área de concentração e as categorias próprias
  do curso; o prompt manda medir "na área" por ele. Um exemplo novo (CLP para Controle e Automação).
- Categorias próprias dos colegiados: 5 de Eng. de Computação (CCECOMLP 06/22) e 1 de Controle e
  Automação (núcleos estudantis, CCECA 004/2018). Novo campo `quantidade` para organizações
  visitadas e trabalhos avaliados.

Acerto: a medir.

## classificacao/v1

Primeira versão, escrita a partir da skill `cefetmg-horas-complementares` e da Resolução CGRAD 05/23.

- Papel e limite claros: o modelo escolhe categoria, variante e quantidades, e **não** calcula horas
  (a conta fica em código, com `regras/categorias-cl2023t.json`).
- As 25 categorias com o rótulo exato do SIGAA e a quantidade que cada uma usa.
- 9 regras de decisão herdadas da skill (curso no estágio continua curso; participar ≠ apresentar ≠
  organizar; evento inteiro ≠ palestra; "Outras Atividades" só como último recurso).
- 5 exemplos few-shot, todos casos que confundem.
- Defesa contra instruções escondidas no certificado: o texto entre `<certificado>` é dado e qualquer
  pedido dentro dele vira `alerta_instrucao_suspeita: true`.
- Saída estruturada com `responseSchema` (JSON), com enum das categorias e das variantes.

Modelo: `gemini-3.5-flash-lite`, temperatura 0. Nas 4 amostras fictícias de `samples/` acertou
categoria, horas e alerta de injeção (4/4), com cerca de 2.200 tokens de entrada por certificado.
Isso só valida o fluxo, não é a métrica do caso.

Primeiro certificado real homologado (curso de 400 h do IFCE, enviado como imagem e lido por OCR):
categoria e horas corretas (228 h/a, igual ao SIGAA), com confiança alta.

Acerto: 1/1 real até agora; a meta é medir com 20 certificados homologados.

Nota de 31/10/2026: esse registro é histórico, anterior à correção dos totais e das matrizes em
`regras/cursos.json`. Não é benchmark da versão atual nem evidência de melhora da v1 para a v2.
Os totais do PPC atual e as fontes estão em [`regras/README.md`](../regras/README.md).
