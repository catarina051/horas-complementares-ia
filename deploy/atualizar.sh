#!/bin/bash
# Atualiza a produção para um commit do GitHub, sem editar arquivos no servidor.
#   sudo bash deploy/atualizar.sh <commit>
# Faz backup, importa o workflow com o n8n parado, valida o Caddy e volta à versão anterior se algo
# falhar. Depois do sucesso, apaga o backup do volume do n8n: ele pode conter restos de dados de alunos.
set -Eeuo pipefail
umask 022
cd /opt/horas-complementares-ia
alvo=${1:?informe o commit a publicar}
anterior=$(git rev-parse HEAD)
backup=/opt/horas-backups/$(date -u +%Y%m%dT%H%M%SZ)
install -d -m 700 "$backup"
printf '%s\n' "$anterior" > "$backup/commit-anterior"
dc() { docker compose -f docker-compose.yml -f deploy/compose.producao.yml "$@"; }
volume_n8n() { docker volume inspect horas-complementares_n8n_data --format '{{.Mountpoint}}'; }

docker image tag horas-complementares-declaracao "horas-complementares-declaracao:rollback-$anterior"
banco_salvo=0
voltar() {
  trap - ERR
  echo 'FALHA: restaurando a versao anterior.'
  dc stop n8n declaracao || true
  git checkout --detach "$anterior"
  docker image tag "horas-complementares-declaracao:rollback-$anterior" horas-complementares-declaracao
  if [ "$banco_salvo" = 1 ]; then tar -xzf "$backup/n8n-data.tgz" -C "$(volume_n8n)"; fi
  # Commits antigos usam o Caddyfile e o compose da raiz (anteriores à pasta deploy/).
  if [ -f deploy/compose.producao.yml ]; then
    dc up -d --force-recreate declaracao n8n caddy
  else
    docker compose -f docker-compose.yml -f compose.publico.yml up -d --force-recreate declaracao n8n caddy
  fi
  echo "ROLLBACK_CONCLUIDO backup=$backup"
  exit 1
}
trap voltar ERR

git fetch origin main
git cat-file -e "$alvo^{commit}"
git checkout --detach "$alvo"

# O patch do formulário (n8n/patches/utils.js) é da 2.45.7: outra versão quebraria o formulário.
versao=$(dc run --rm --no-deps --entrypoint n8n n8n --version | tr -d '\r' | tail -1)
[ "$versao" = "2.45.7" ] || { echo "n8n $versao: refaça n8n/patches/utils.js"; false; }

node n8n/montar-workflow.mjs
dc config --quiet
dc build declaracao
dc up -d limpeza
dc stop n8n
tar -czf "$backup/n8n-data.tgz" -C "$(volume_n8n)" .
chmod 600 "$backup/n8n-data.tgz"
banco_salvo=1
# Arquivos de execução gravados em disco por versões anteriores (antes do volume em memória).
rm -rf "$(volume_n8n)"/storage/workflows/*/executions
dc up -d --force-recreate declaracao
dc run --rm --no-deps n8n import:workflow --input=/data/workflows/horas-complementares.json
dc run --rm --no-deps n8n publish:workflow --id=hcIaHorasCompl01
# Recria o Caddy para ler deploy/Caddyfile (o arquivo montado mudou de caminho).
dc up -d --force-recreate n8n caddy
dc exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

for tentativa in $(seq 1 80); do
  if curl -fsS --max-time 5 http://127.0.0.1:5679/form/horas-complementares -o /dev/null; then
    printf '%s\n' "$alvo" > VERSAO-PRODUCAO.txt
    # Backups do volume do n8n guardam restos do SQLite (inclusive CPF e RG de linhas apagadas).
    rm -f "$backup/n8n-data.tgz"
    find /opt/horas-backups -name 'n8n-data.tgz' -delete
    printf 'PUBLICACAO_CONCLUIDA commit=%s backup=%s\n' "$alvo" "$backup"
    dc ps
    exit 0
  fi
  sleep 3
done
false
