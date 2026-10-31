# Horas Complementares com IA

**Resultado:** _a medir no piloto_: colegas usando, minutos por certificado antes × depois e acerto
da categoria em 20 certificados homologados.

O aluno de Engenharia de Computação do CEFET-MG Leopoldina envia o certificado e recebe, em uma
página: **qual tipo marcar no SIGAA**, **quantas horas-aula serão abatidas** (com a conta e a norma)
e **o PDF pronto para anexar**, com a Declaração de Autenticidade preenchida, assinada e datada antes
do certificado.

## Problema (Fato) e causa

- **Fato:** cada aluno precisa somar 450 h/a de Atividades Complementares. Para cada certificado,
  escolhe um entre 25 tipos parecidos no SIGAA ("Palestra" ou "Participação em congresso"? "Curso
  na área" ou "em área diferenciada"?), monta à mão o PDF com a declaração datada e não sabe quantas
  horas vão contar até a Coordenação responder. Tempo manual por certificado: _a medir_.
- **Causa:** as regras estão espalhadas em resoluções em PDF (algumas digitalizadas), a valoração
  muda por tipo (por hora, por dia de evento, valor fixo, por semestre) e a norma vigente
  (CGRAD 05/23) não é a que a página do curso ainda lista (CGRAD 17/11). Errar o tipo devolve o
  pedido; a declaração precisa ser refeita com a data de cada envio.

## Solução e arquitetura

```
Formulário n8n ──► normaliza e valida ──► 1º uso: HTML do Anexo I + assinatura ─► Gotenberg (PDF)
                                      └─► reuso: declaração-base do aluno
                                                     │
                                         serviço `declaracao`: carimba a data de hoje
                                                     │
certificado ─► extrai texto ─► anonimiza ([ALUNO]) ─► Gemini (JSON com schema) ─► calcula horas
                                                                                  pela tabela de regras
                                                     │
                       Gotenberg junta declaração + certificado ─► página de resultado + downloads

API /webhook/classificar ─► mesma classificação, resposta em JSON (usada pela avaliação)
```

- **n8n** orquestra tudo (29 nós). O código de cada Code node fica em [`n8n/codigo/`](n8n/codigo)
  e `node n8n/montar-workflow.mjs` gera o [workflow exportado](workflows/horas-complementares.json),
  sem credenciais.
- **Gotenberg** (container pronto) converte HTML em PDF e junta PDFs: API sem backend próprio.
- **Serviço `declaracao`** ([`services/declaracao`](services/declaracao)): ~150 linhas de Python
  que carimbam a data na declaração e extraem o texto do certificado. Reaproveita o script de troca
  de data da skill `cefetmg-horas-complementares`.
- **Gemini Flash (plano gratuito)** só escolhe a categoria, a variante e lê as quantidades. **As horas
  são calculadas em código** a partir de [`regras/categorias-2022-1.json`](regras), em que cada
  linha cita a norma e o artigo.
- **Kit pessoal sem guardar nada:** no primeiro uso o aluno digita os dados e envia a foto da
  assinatura (o fundo some com filtro CSS e `mix-blend-mode`, sem IA). Recebe também a
  declaração-base, que reutiliza depois: só a data muda.

## Prompts

[`prompts/classificacao/`](prompts/classificacao): `v1.md` (prompt de sistema), `schema.json`
(saída estruturada com enum das 25 categorias) e [`CHANGELOG.md`](prompts/CHANGELOG.md) com o par
erro → correção de cada versão.

Técnicas: papel e limites explícitos (o modelo não calcula), regras de decisão herdadas da skill,
5 exemplos few-shot de casos que confundem, JSON com schema, nota de confiança com alternativas, e
defesa contra instruções escondidas no certificado.

## Avaliação

[`evals/`](evals): `run_eval.py` envia os certificados homologados para a API e mede o acerto da
categoria, das horas e do alerta de injeção, além de tokens e custo por versão.

| Versão | Categoria correta | Horas corretas | Custo por certificado |
|---|---|---|---|
| v1 | _a medir_ | _a medir_ | _a medir_ |

## O que cortei, onde errei e a decisão difícil

- **Cortei (80/20):** outros cursos e campi, certificados escaneados (sem texto), assinatura digital,
  envio direto ao SIGAA, login e e-mail. A página avisa o teto da categoria, mas não soma o que o
  aluno já lançou.
- **Onde errei e o que mudei:**
  - Comecei pela CGRAD 17/11, como a skill e a página do curso. Lendo as normas, achei a CGRAD 05/23,
    que revogou a 17/11 sem regra de transição e é a que o SIGAA usa hoje. A tabela foi refeita.
  - O script de data da skill só lê PDFs "estilo Word". Para a declaração gerada pelo Chromium, a
    data passou a ser carimbada por cima, numa posição fixa do modelo.
  - O Form Trigger novo do n8n não aceita resposta customizada: fiquei na versão 2.1 do nó para
    devolver a página com os dois downloads.
  - O anonimizador trocava sobrenomes soltos e transformou "Instituto Exemplo" em
    "Instituto [ALUNO]" na descrição. Agora troca só o nome completo e "Primeiro Último".
  - `gemini-flash-latest` passou de 110 s sem responder num pico de demanda, e `gemini-2.5-flash`
    não está disponível para contas novas. Fixei `gemini-3.5-flash-lite` (2 s por certificado);
    apelidos `-latest` também mudam de modelo sem aviso e invalidam a comparação entre prompts.
- **Decisão difícil:** guardar os dados e a assinatura no servidor deixaria o uso ainda mais simples,
  mas exigiria login, criptografia e LGPD. Pior: sem login, qualquer pessoa que soubesse a matrícula
  de outra geraria uma declaração assinada por ela. Escolhi o kit pessoal: o aluno guarda e o servidor
  não guarda nada.

## Como rodar

```bash
cp .env.example .env        # preencha GEMINI_API_KEY e N8N_ENCRYPTION_KEY
docker compose up -d --build
docker compose exec n8n n8n import:workflow --input=/data/workflows/horas-complementares.json
docker compose exec n8n n8n publish:workflow --id=hcIaHorasCompl01
docker compose restart n8n
```

Formulário: <http://localhost:5679/form/horas-complementares>. Sem `GEMINI_API_KEY` o fluxo roda em
modo demonstração (classificação por palavras-chave, avisada na página).

Link público no piloto: `docker compose --profile tunnel up -d` e pegue a URL em
`docker compose logs cloudflared`. Coloque essa URL em `WEBHOOK_URL` no `.env` e reinicie o n8n.

Testes:

```bash
node --test tests/*.test.mjs
python -m pytest services/declaracao
python evals/run_eval.py --versao v1 --gabarito evals/gabarito.example.csv
```

## Privacidade

- Nada é gravado: o n8n não guarda histórico de execuções (`EXECUTIONS_DATA_SAVE_* = none`) e os
  arquivos existem só durante o processamento.
- O texto do certificado vai ao Gemini com nome, matrícula, RG, CPF e e-mail trocados por `[ALUNO]`.
  Os dados da declaração nunca vão ao modelo.
- O repositório não tem nenhum certificado, declaração ou assinatura real: só os fictícios de
  [`samples/`](samples).

## Vídeo

_2 min, a gravar depois do piloto._

---

A validação final de cada atividade é da Coordenação do curso. Regras: Resolução CGRAD 05/23,
CGRAD 19/11 e PPC de Eng. de Computação Leopoldina (detalhes em [`regras/README.md`](regras/README.md)).
