# Produção

A ferramenta roda numa VM da AWS com Docker. O Caddy faz o HTTPS e só deixa passar o formulário e a
prévia do recorte com IA. Este diretório versiona a configuração de produção (sem segredos), para
que um deploy limpo não perca proteções feitas à mão no servidor.

| Arquivo | Para quê |
|---|---|
| `Caddyfile` | Proxy público: formulário e `POST /webhook/assinatura-ia`; todo o resto responde 404 |
| `compose.producao.yml` | Acréscimos ao `docker-compose.yml`: Caddy, cookies seguros e o n8n atrás de proxy |
| `atualizar.sh` | Atualiza para um commit com backup, checagem de versão do n8n e volta automática |

## Atualizar

```bash
sudo bash deploy/atualizar.sh <commit>
```

O `.env` da VM precisa de `DOMINIO`, `GEMINI_API_KEY`, `GEMINI_MODEL` e `N8N_ENCRYPTION_KEY`.

## Dados pessoais

- Arquivos de cada execução ficam no volume em memória `n8n_binarios`; o serviço `limpeza` apaga o
  que tiver mais de 30 minutos, e reiniciar a VM apaga tudo.
- O SQLite do n8n recebe `VACUUM` a cada subida, o que remove restos de linhas apagadas. Para que isso
  aconteça com frequência, agende uma reinicialização noturna do n8n (cerca de 20 s fora do ar):

  ```bash
  echo '30 4 * * * root cd /opt/horas-complementares-ia && docker compose -f docker-compose.yml -f deploy/compose.producao.yml restart n8n' | sudo tee /etc/cron.d/horas-vacuum
  ```

- O `atualizar.sh` apaga os backups `n8n-data.tgz` depois de um deploy bem-sucedido.

## Pendente

- Limite de taxa nas rotas públicas (regra rate-based do AWS WAF ou o plugin `caddy-ratelimit`):
  hoje alguém com o link pode gastar a cota do Gemini enviando muitos pedidos.
