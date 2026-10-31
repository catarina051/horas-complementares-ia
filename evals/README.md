# Avaliação do prompt

Cada versão de `prompts/classificacao/` é medida no mesmo conjunto de certificados com categoria
**já homologada pela Coordenação**. É daqui que sai a frase do caso: "o acerto subiu de X% na v1
para Y% na v2".

## Montar o conjunto (local, nunca vai para o Git)

1. Coloque os PDFs em `evals/certificados/` (a pasta está no `.gitignore`).
2. Copie `gabarito.example.csv` para `gabarito.csv` (também ignorado) e preencha uma linha por
   certificado:
   - `arquivo`: caminho relativo a esta pasta, ex. `certificados/curso-python.pdf`
   - `tipo_esperado`: o tipo homologado no SIGAA, exatamente como em `regras/categorias-2022-1.json`
   - `nome`, `matricula`: usados só para anonimizar o texto antes do modelo
   - `ha_homologadas` (opcional): h/a que a Coordenação validou
   - `alerta_esperado` (opcional): `sim` se o certificado tem instrução escondida

Meta do plano: 20 certificados, seus e de colegas, com consentimento.

## Rodar

```bash
python evals/run_eval.py --versao v1
```

Precisa do `docker compose up` e da `GEMINI_API_KEY` no `.env`. Sem a chave o workflow responde em
modo simulado e o script avisa que o número não mede o prompt.

O resultado completo vai para `evals/resultados/<versao>.json` (ignorado pelo Git). Leve só os
números agregados e os erros que motivaram a próxima versão para `prompts/CHANGELOG.md`.

`gabarito.example.csv` usa os certificados fictícios de `samples/` e serve só para testar o script.
