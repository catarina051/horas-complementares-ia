"""Mede o acerto de uma versão do prompt contra um gabarito de certificados já homologados.

Envia cada PDF para a API do workflow (POST /webhook/classificar) e compara:
- a categoria do SIGAA (tipo_sigaa) com a homologada;
- as h/a abatidas com as homologadas, quando o gabarito tiver a coluna;
- o alerta de instrução escondida, quando o gabarito tiver a coluna.

Uso:
    python evals/run_eval.py --versao v1
    python evals/run_eval.py --versao v1 --gabarito evals/gabarito.example.csv

O gabarito é um CSV com: arquivo, tipo_esperado, nome, matricula[, curso, matriz][, ha_homologadas][, alerta_esperado]
Caminhos de arquivo são relativos à pasta do CSV. Só biblioteca padrão.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
import time
import urllib.error
import urllib.request
import uuid
from collections import Counter
from pathlib import Path

RAIZ = Path(__file__).resolve().parent


def multipart(campos: dict[str, str], arquivo: Path) -> tuple[bytes, str]:
    fronteira = uuid.uuid4().hex
    partes = []
    for nome, valor in campos.items():
        partes.append(f'--{fronteira}\r\nContent-Disposition: form-data; name="{nome}"\r\n\r\n{valor}\r\n'.encode())
    partes.append(
        f'--{fronteira}\r\nContent-Disposition: form-data; name="certificado"; filename="{arquivo.name}"\r\n'
        'Content-Type: application/pdf\r\n\r\n'.encode()
        + arquivo.read_bytes() + b'\r\n'
    )
    partes.append(f'--{fronteira}--\r\n'.encode())
    return b''.join(partes), f'multipart/form-data; boundary={fronteira}'


def classificar(url: str, arquivo: Path, versao: str, campos: dict[str, str]) -> dict:
    corpo, tipo = multipart({'versao': versao, **campos}, arquivo)
    req = urllib.request.Request(url, data=corpo, headers={'Content-Type': tipo}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        return {'erro': json.load(e).get('erro', f'HTTP {e.code}')}


def main() -> int:
    sys.stdout.reconfigure(encoding='utf-8')  # console do Windows usa cp1252
    p = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    p.add_argument('--versao', required=True, help='Versão do prompt (prompts/classificacao/<versao>.md)')
    p.add_argument('--gabarito', type=Path, default=RAIZ / 'gabarito.csv')
    p.add_argument('--url', default='http://localhost:5679/webhook/classificar')
    p.add_argument('--pausa', type=float, default=4.0, help='Segundos entre chamadas (limite do plano gratuito)')
    p.add_argument('--preco-entrada', type=float, default=0.0, help='US$ por 1 milhão de tokens de entrada')
    p.add_argument('--preco-saida', type=float, default=0.0, help='US$ por 1 milhão de tokens de saída')
    args = p.parse_args()

    linhas = list(csv.DictReader(args.gabarito.open(encoding='utf-8')))
    resultados = []
    for i, linha in enumerate(linhas):
        if i:
            time.sleep(args.pausa)
        arquivo = (args.gabarito.parent / linha['arquivo']).resolve()
        campos = {k: linha[k] for k in ('nome', 'matricula', 'curso', 'matriz') if linha.get(k)}
        r = classificar(args.url, arquivo, args.versao, campos)
        res = {
            'arquivo': linha['arquivo'],
            'esperado': linha['tipo_esperado'],
            'obtido': r.get('tipo_sigaa'),
            'erro': r.get('erro'),
            'simulado': r.get('simulado'),
            'confianca': (r.get('classificacao') or {}).get('confianca'),
            'tokens': r.get('tokens', {}),
        }
        res['acertou_tipo'] = res['obtido'] == res['esperado']
        if linha.get('ha_homologadas'):
            res['ha_esperadas'] = float(linha['ha_homologadas'])
            res['ha_obtidas'] = r.get('ha_abatidas')
            res['acertou_horas'] = res['ha_obtidas'] is not None and abs(res['ha_obtidas'] - res['ha_esperadas']) < 0.05
        if linha.get('alerta_esperado'):
            esperado = linha['alerta_esperado'].strip().lower() in ('sim', 's', 'true', '1')
            res['acertou_alerta'] = bool((r.get('classificacao') or {}).get('alerta_instrucao_suspeita')) == esperado
        resultados.append(res)
        marca = 'ok ' if res['acertou_tipo'] else 'ERR'
        print(f"{marca} {linha['arquivo']}: {res['obtido'] or res['erro']}")

    n = len(resultados)
    taxa = lambda chave: [r[chave] for r in resultados if chave in r]
    tipo = taxa('acertou_tipo')
    horas = taxa('acertou_horas')
    alerta = taxa('acertou_alerta')
    entrada = sum(r['tokens'].get('entrada', 0) for r in resultados)
    saida = sum(r['tokens'].get('saida', 0) for r in resultados)
    custo = (entrada * args.preco_entrada + saida * args.preco_saida) / 1e6
    erros = Counter((r['esperado'], r['obtido']) for r in resultados if not r['acertou_tipo'])

    print(f'\nVersão {args.versao}: {n} certificados')
    if any(r['simulado'] for r in resultados):
        print('ATENÇÃO: respostas simuladas (sem GEMINI_API_KEY). O acerto abaixo não mede o prompt.')
    print(f'Categoria correta: {sum(tipo)}/{len(tipo)} ({100 * sum(tipo) / max(len(tipo), 1):.0f}%)')
    if horas:
        print(f'Horas corretas:    {sum(horas)}/{len(horas)} ({100 * sum(horas) / len(horas):.0f}%)')
    if alerta:
        print(f'Alerta de injeção: {sum(alerta)}/{len(alerta)}')
    print(f'Tokens: {entrada} entrada + {saida} saída; custo estimado US$ {custo:.4f} '
          f'(US$ {custo / max(n, 1):.5f} por certificado)')
    if erros:
        print('\nErros (esperado → obtido):')
        for (esp, obt), qtd in erros.most_common():
            print(f'  {qtd}× {esp} → {obt}')

    destino = RAIZ / 'resultados' / f'{args.versao}.json'
    destino.parent.mkdir(exist_ok=True)
    destino.write_text(json.dumps({'versao': args.versao, 'resultados': resultados}, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'\nDetalhes em {destino}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
