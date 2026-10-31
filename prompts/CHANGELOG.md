# Changelog dos prompts

Formato de cada versão: o erro que apareceu na avaliação → a correção no prompt → o acerto antes e
depois, medido com `evals/run_eval.py` no mesmo conjunto de certificados.

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

Acerto: a medir com os 20 certificados homologados.
