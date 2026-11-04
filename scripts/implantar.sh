#!/usr/bin/env sh
# Gera o workflow a partir de n8n/codigo/ e implanta no n8n do docker compose.
# Importa e publica com o n8n PARADO: com ele ligado, a primeira execução depois do
# reinício ainda roda a versão anterior.
set -e
cd "$(dirname "$0")/.."
export MSYS_NO_PATHCONV=1  # Git Bash no Windows: não converter /data/... em caminho do Windows

node n8n/montar-workflow.mjs

# n8n/patches/utils.js é cópia de um arquivo interno do n8n 2.45.7; em outra versão quebraria o formulário.
versao=$(docker compose run --rm --no-deps --entrypoint n8n n8n --version 2>/dev/null | tr -d '\r' | tail -1)
if [ "$versao" != "2.45.7" ]; then
  echo "n8n $versao no compose, mas o patch do formulário é da 2.45.7. Refaça n8n/patches/utils.js antes de implantar."
  exit 1
fi
docker compose up -d --build gotenberg declaracao
docker compose stop n8n
docker compose run --rm --no-deps n8n import:workflow --input=/data/workflows/horas-complementares.json
docker compose run --rm --no-deps n8n publish:workflow --id=hcIaHorasCompl01
docker compose up -d n8n

printf 'Aguardando o formulário responder'
tentativas=0
# -m 5: durante a subida a conexão pode ficar pendurada sem resposta.
until curl -fs -m 5 -o /dev/null http://localhost:"${N8N_PORTA:-5679}"/form/horas-complementares; do
  tentativas=$((tentativas + 1))
  if [ "$tentativas" -ge 120 ]; then echo ' o n8n não subiu em 4 min; veja: docker compose logs n8n'; exit 1; fi
  printf '.'; sleep 2
done
echo ' pronto.'
