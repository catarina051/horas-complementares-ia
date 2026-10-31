#!/usr/bin/env python3
"""Gera uma cópia da Declaração de Autenticidade com a data atualizada.

A declaração assinada em `assets/` é o arquivo permanente e nunca é modificada:
o script lê esse arquivo, reescreve apenas a linha "Cidade, DD de mês de AAAA"
dentro do fluxo de conteúdo do PDF e grava o resultado em outro caminho. A
assinatura, a matrícula e o restante do layout ficam intactos, e a data antiga
some também da camada de texto (não é apenas coberta por um retângulo branco).

Uso típico (data de hoje):

    python scripts/atualizar_data_declaracao.py \
      --entrada assets/declaracao_autenticidade_assinada.pdf \
      --saida /tmp/declaracao_hoje.pdf

Para forçar uma data específica, use --data com uma data ISO (2026-08-11) ou já
no formato final ("11 de agosto de 2026").
"""
from __future__ import annotations

import argparse
import re
from datetime import date, datetime
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import DecodedStreamObject
from reportlab.pdfbase.pdfmetrics import stringWidth

MESES = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

# Bloco de texto do PDF: posição (Tm), espaçamento opcional entre caracteres
# (Tc) e o array de strings desenhado (TJ), que pode vir fatiado por kerning.
BLOCO_TEXTO = re.compile(
    rb'/F\d+ (?P<tamanho>[\d.]+) Tf\r?\n'
    rb'1 0 0 1 (?P<x>[\d.]+) (?P<y>[\d.]+) Tm\r?\n'
    rb'0 g\r?\n0 G\r?\n'
    rb'(?: (?P<tc>[-\d.]+) Tc)?'
    rb'\[(?P<texto>[^\]]*)\] TJ'
)

# "Leopoldina, 18 de junho de 2025" — cidade livre, dia e ano numéricos.
LINHA_DATA = re.compile(r'^(?P<cidade>[^,\d]{3,40}),\s*\d{1,2}\s+de\s+\S+\s+de\s+\d{4}\s*$')


def data_por_extenso(quando: date) -> str:
    """15/03/2026 -> '15 de março de 2026' (sem zero à esquerda no dia)."""
    return f'{quando.day} de {MESES[quando.month - 1]} de {quando.year}'


def interpretar_data(valor: str | None) -> str:
    """Aceita None (hoje), ISO (2026-08-11) ou o texto já por extenso."""
    if valor is None:
        return data_por_extenso(date.today())
    valor = valor.strip()
    try:
        return data_por_extenso(datetime.strptime(valor, '%Y-%m-%d').date())
    except ValueError:
        pass
    for formato in ('%d/%m/%Y', '%d-%m-%Y'):
        try:
            return data_por_extenso(datetime.strptime(valor, formato).date())
        except ValueError:
            continue
    return valor


def texto_puro(bruto: bytes) -> str:
    """Remove o kerning do array TJ e devolve o texto legível.

    '(Leopoldi)19(na,)14( )14(18 )' -> 'Leopoldina, 18 '
    """
    partes = re.findall(rb'\((?:\\.|[^()\\])*\)', bruto)
    juntado = b''.join(p[1:-1] for p in partes)
    juntado = re.sub(rb'\\([()\\])', rb'\1', juntado)
    return juntado.decode('latin-1')


def largura(texto: str, tamanho: float, tc: float) -> float:
    """Largura renderizada em pontos, somando o espaçamento entre caracteres."""
    base = stringWidth(texto, 'Helvetica', tamanho)
    return base + tc * max(len(texto) - 1, 0)


def substituir_data(fluxo: bytes, nova_data: str) -> tuple[bytes, str, str]:
    """Troca a linha de data mantendo a centralização original."""
    for bloco in BLOCO_TEXTO.finditer(fluxo):
        antigo = texto_puro(bloco.group('texto')).strip()
        achado = LINHA_DATA.match(antigo)
        if not achado:
            continue

        cidade = achado.group('cidade').strip()
        novo = f'{cidade}, {nova_data}'
        tamanho = float(bloco.group('tamanho'))
        tc = float(bloco.group('tc') or 0)
        x = float(bloco.group('x'))

        # Mantém o mesmo centro horizontal da linha original.
        centro = x + largura(antigo, tamanho, tc) / 2
        novo_x = round(centro - largura(novo, tamanho, tc) / 2, 2)

        prefixo = fluxo[bloco.start():bloco.start('x')]
        tc_txt = f' {tc:g} Tc'.encode('latin-1') if bloco.group('tc') else b''
        escapado = novo.replace('\\', r'\\').replace('(', r'\(').replace(')', r'\)')
        substituto = (
            prefixo
            + f'{novo_x} {bloco.group("y").decode()} Tm'.encode('latin-1')
            + b'\r\n0 g\r\n0 G\r\n'
            + tc_txt
            + b'[(' + escapado.encode('latin-1') + b')] TJ'
        )
        return fluxo[:bloco.start()] + substituto + fluxo[bloco.end():], antigo, novo

    raise SystemExit(
        'Nenhuma linha de data no formato "Cidade, DD de mês de AAAA" foi '
        'encontrada no PDF. Confirme se o arquivo é a declaração correta.'
    )


def main() -> int:
    p = argparse.ArgumentParser(
        description='Copia a Declaração de Autenticidade trocando a data pela data de hoje.'
    )
    p.add_argument('--entrada', required=True, type=Path,
                   help='Declaração assinada de origem (não é modificada).')
    p.add_argument('--saida', required=True, type=Path,
                   help='Caminho do PDF gerado com a data nova.')
    p.add_argument('--data', default=None,
                   help='Opcional. ISO (2026-08-11), 11/08/2026 ou "11 de agosto de 2026". Padrão: hoje.')
    args = p.parse_args()

    if not args.entrada.is_file():
        p.error(f'Arquivo não encontrado: {args.entrada}')
    if args.entrada.resolve() == args.saida.resolve():
        p.error('--saida deve ser diferente de --entrada: a declaração assinada não é sobrescrita.')

    reader = PdfReader(str(args.entrada))
    if len(reader.pages) != 1:
        print(f'Aviso: a declaração tem {len(reader.pages)} páginas; a data será '
              'procurada apenas na primeira.')

    pagina = reader.pages[0]
    fluxo = pagina.get_contents().get_data()
    novo_fluxo, antigo, novo = substituir_data(fluxo, interpretar_data(args.data))

    stream = DecodedStreamObject()
    stream.set_data(novo_fluxo)
    pagina.replace_contents(stream)

    args.saida.parent.mkdir(parents=True, exist_ok=True)
    writer = PdfWriter()
    writer.add_page(pagina)
    with args.saida.open('wb') as fh:
        writer.write(fh)

    print(f'Data atualizada: "{antigo}" -> "{novo}"')
    print(f'PDF gerado em: {args.saida}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
