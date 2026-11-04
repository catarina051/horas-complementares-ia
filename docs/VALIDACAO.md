# Validação e demonstração

## Evidências registradas em 31/10/2026

- 34 testes JavaScript passaram com `node --test tests/*.test.mjs`.
- 27 testes Python passaram no container, incluindo o Tesseract em português.
- O primeiro uso e o reuso foram exercitados pelo formulário com um certificado real. Os arquivos
  pessoais desse teste não fazem parte do repositório.
- Os PDFs dos dois modelos de declaração foram renderizados e conferidos visualmente.
- O exemplo público de Docker é fictício e foi classificado pela API v2 com `simulado: false`:
  categoria na área, código ECL2023, 24 h/a. O registro está em [`exemplos/curso-docker.json`](exemplos/curso-docker.json).
- A captura em [`imagens/resultado-exemplo.png`](imagens/resultado-exemplo.png) usa essa resposta e o
  código de `montar-pagina.js` para apresentar a interface. É uma ilustração da classificação com
  dados fictícios; não documenta uma nova execução completa de primeiro uso nem homologação acadêmica.

## Testes de software

Na raiz do repositório:

```bash
node --test tests/*.test.mjs
```

Para repetir todos os testes Python no ambiente do serviço, com OCR disponível, use Bash/Git Bash:

```bash
MSYS_NO_PATHCONV=1 docker compose run --rm --no-deps --user root \
  -e PYTHONDONTWRITEBYTECODE=1 \
  -v "$PWD/services/declaracao:/app:ro" \
  declaracao sh -c 'pip install --quiet pytest && python -m pytest /app/tests -q -p no:cacheprovider'
```

Esse comando instala o pytest apenas no container descartável de teste. A imagem do serviço deve
ter sido construída antes com `docker compose build declaracao`.

Também é possível usar Python no computador:

```bash
python -m pip install -r services/declaracao/requirements.txt pytest
python -m pytest services/declaracao -q
```

Sem Tesseract com o idioma português no host, o teste de OCR é ignorado. Os demais testes cobrem
rotas HTTP, datas e a limpeza das imagens de assinatura (incluindo foto sobre mesa de madeira).
Testes de unidades isoladas não substituem a verificação visual com fotografias diferentes.

## Avaliação da classificação por LLM

Com o workflow em execução e `GEMINI_API_KEY` configurada:

```bash
python evals/run_eval.py --versao v2 --gabarito evals/gabarito.example.csv
```

As amostras desse CSV são fictícias. Esse comando verifica a avaliação e a integração; não mede o
desempenho em uma população de documentos reais. Sem chave, o script avisa que as respostas são simuladas.

Para medir qualidade no piloto, monte um gabarito consentido de certificados homologados, com
curso, matriz, categoria e horas confirmados. Use o mesmo conjunto para comparar versões. Não
publique arquivos pessoais; leve para o README apenas os números agregados e o tamanho da amostra.
Instruções completas em [`evals/README.md`](../evals/README.md).

## Roteiro de demonstração em dois minutos

1. **Problema:** mostrar que o aluno precisa classificar o certificado, conferir horas e montar o PDF.
2. **Entrada:** abrir o formulário, selecionar curso/matriz e enviar um certificado fictício.
3. **Saída:** mostrar código/opção do SIGAA, cálculo, teto, fonte e PDF com declaração antes do certificado.
4. **Reuso:** mostrar a declaração-base e explicar que os dados e a foto não precisam ser reenviados.
5. **Decisões:** explicar que o LLM interpreta, o código calcula e a assinatura só vai para a IA se o aluno escolher.
6. **Evidência e limite:** mostrar testes e um caso real validado sem dados pessoais; informar que
   tempo economizado e acurácia em amostra ampla ainda serão medidos no piloto.

O vídeo não está publicado. Ao gravá-lo, use dados fictícios e evite mostrar `.env`, chaves ou documentos reais.

## Compartilhar para um piloto

O projeto inclui um perfil de Cloudflare Tunnel:

```bash
docker compose --profile tunnel up -d cloudflared
docker compose logs cloudflared
```

Copie a URL `https://...trycloudflare.com` dos logs para `WEBHOOK_URL` no `.env`. Ao publicar atrás de
proxy, configure `N8N_PROXY_HOPS: "1"` no ambiente do serviço n8n, conforme a
[documentação](https://docs.n8n.io/hosting/configuration/configuration-examples/webhook-url/).
Recrie o n8n com `docker compose up -d n8n` e compartilhe a URL pública terminada em
`/form/horas-complementares?v=20261031`.

O computador e o Docker precisam permanecer ligados. O
[túnel temporário](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) é destinado
a testes, não oferece garantia de disponibilidade e recebe outro endereço quando um novo túnel é criado.
