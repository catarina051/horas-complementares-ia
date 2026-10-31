# Horas Complementares com IA

**Resultado:** _a medir no piloto_: colegas usando, minutos por certificado antes × depois e acerto
da categoria em 20 certificados homologados.

O aluno de Engenharia de Computação ou de Engenharia de Controle e Automação do CEFET-MG Leopoldina
envia o certificado e recebe, em uma
página: **qual tipo marcar no SIGAA**, **quantas horas-aula serão abatidas** (com a conta e a norma)
e **o PDF pronto para anexar**, com a Declaração de Autenticidade preenchida, assinada e datada antes
do certificado.

## Problema (Fato) e causa

- **Fato:** cada aluno precisa somar as horas de Atividades Complementares da sua matriz (450 ou 135 h/a em
  Eng. de Computação; 240 ou 45 h/a em Controle e Automação, conforme o PPC atual). Para cada certificado,
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
certificado ─► texto (OCR local se for imagem) ─► anonimiza ([ALUNO]) ─► Gemini (JSON com schema) ─► calcula horas
                                                                                  pela tabela de regras
                                                     │
                       Gotenberg junta declaração + certificado ─► página de resultado + downloads

API /webhook/classificar ─► mesma classificação, resposta em JSON (usada pela avaliação)
```

- **n8n** orquestra tudo (32 nós). O código de cada Code node fica em [`n8n/codigo/`](n8n/codigo)
  e `node n8n/montar-workflow.mjs` gera o [workflow exportado](workflows/horas-complementares.json),
  sem credenciais.
- **Gotenberg** (container pronto) converte HTML em PDF e junta PDFs: API sem backend próprio.
- **Serviço `declaracao`** ([`services/declaracao`](services/declaracao)): Python
  que reconhece e recorta a assinatura, carimba a data na declaração e extrai o texto do certificado, com OCR local (Tesseract) quando
  ele vem como imagem. Reaproveita o script de troca
  de data da skill `cefetmg-horas-complementares`.
- **Gemini Flash (plano gratuito)** só escolhe a categoria, a variante e lê as quantidades. **As horas
  são calculadas em código** a partir de [`regras/`](regras): a tabela geral da CGRAD 05/23 mais, por
  curso, o total da matriz e as categorias do colegiado. Cada linha cita a norma e o artigo.
- **Um modelo de declaração por curso,** cada um fiel ao PDF oficial da coordenação (Eng. de Computação
  com o logo do CEFET-MG; Controle e Automação com o brasão e o cabeçalho do Conselho de Graduação).
- **Kit pessoal sem guardar nada:** no primeiro uso o aluno digita os dados e envia a foto da
  assinatura. Um detector de visão treinado (YOLOS Tiny, ONNX em CPU) localiza a assinatura em cada foto;
  a limpeza local remove papel, sombras e margens e preserva os traços próximos. Não usa coordenadas
  fixas nem uma cor de caneta específica. Imagens ambíguas pedem uma nova foto. Recebe também a
  declaração-base, que reutiliza depois: só a data muda.
- **Código e opção do SIGAA:** [`regras/tipos-sigaa.json`](regras/tipos-sigaa.json) contém os rótulos
  transcritos das capturas, separados por código e variante. A página e a API devolvem o código
  e o texto completo. Categorias ausentes ou com rótulo cortado ficam a confirmar, sem opção inventada.
  O ingresso é obrigatório nos dois cursos; quem migrou escolhe a versão da matriz atual.

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
| v1 (histórico) | 1/1 real (meta: 20) | Reavaliar com as matrizes atuais; total de 570 corrigido abaixo | R$ 0 (plano gratuito, ~2.500 tokens) |

## O que cortei, onde errei e a decisão difícil

- **Cortei (80/20):** outros cursos e campi, fotos tortas ou ilegíveis (o OCR só lê imagens razoáveis), assinatura digital,
  envio direto ao SIGAA, login e e-mail. A página avisa o teto da categoria, mas não soma o que o
  aluno já lançou.
- **Onde errei e o que mudei:**
  - Comecei pela CGRAD 17/11, como a skill e a página do curso. Lendo as normas, achei a CGRAD 05/23,
    que revogou a 17/11 sem regra de transição e é a que o SIGAA usa hoje. A tabela foi refeita.
  - Um lançamento de 228 h/a levou à inferência incorreta de 570 h/a para toda Computação.
    Na manutenção de 31/10/2026, o SIGAA público mostrou CL2023T inativa e ECL2023 ativa.
    O PPC de 2024 separa 135 h/a de AC de 435 h/a de extensão. A ferramenta agora usa
    ECOM32/450 h/a para o PPC antigo e ECL2023/135 h/a para o novo, com fontes em `regras/README.md`.
  - Cortei certificados em imagem pelo 80/20, e o primeiro certificado real era exatamente isso: o
    aluno cola a figura do certificado no modelo do curso. A ferramenta lia só o cabeçalho e dizia
    "não é certificado". Entrou OCR local antes da anonimização, e o caso passou a acertar.
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
sh scripts/implantar.sh     # gera o workflow, sobe os containers e importa com o n8n parado
```

Importar com o n8n ligado faz a primeira execução depois do reinício rodar a versão anterior; o script
para o n8n, importa, publica e só então sobe de novo.

Formulário: <http://localhost:5679/form/horas-complementares>. Sem `GEMINI_API_KEY` o fluxo roda em
modo demonstração (classificação por palavras-chave, avisada na página).

Após esta atualização, abra <http://localhost:5679/form/horas-complementares?v=20261031> para evitar
o formulário antigo em cache. Gere uma nova declaração-base no modo de primeiro uso se a anterior
contém a foto inteira: o reuso preserva a assinatura já existente no PDF.

O primeiro build baixa os pesos públicos de um detector treinado de assinaturas, com revisão fixa,
e os converte para ONNX. As fotos não são enviadas ao provedor do modelo. Em runtime, só ONNX Runtime,
NumPy e Pillow são necessários; PyTorch fica no estágio de construção. Detalhes em
[`services/declaracao/MODELO.md`](services/declaracao/MODELO.md).

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
  Os dados da declaração nunca vão ao modelo. Certificado em imagem é lido por OCR dentro do Docker,
  e a imagem não sai da máquina.
- O repositório não tem nenhum certificado, declaração ou assinatura real: só os fictícios de
  [`samples/`](samples).

## Vídeo

_2 min, a gravar depois do piloto._

---

A validação final de cada atividade é da Coordenação do curso. Regras: Resolução CGRAD 05/23,
CGRAD 19/11 e resoluções dos colegiados (CCECOMLP 06/22, CCECA 004/2018); detalhes em
[`regras/README.md`](regras/README.md).
