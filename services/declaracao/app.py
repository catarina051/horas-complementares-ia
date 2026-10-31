"""Serviço interno que coloca a data de hoje na Declaração de Autenticidade.

Dois caminhos, escolhidos pelo próprio PDF:

- Declaração-base do kit (gerada por esta ferramenta, sem data, marcada nos
  metadados): a data é carimbada por cima, na posição fixa do template.
- Declaração assinada de outra origem (ex.: Word exportado): a linha
  "Cidade, DD de mês de AAAA" existente é reescrita pelo script da skill
  cefetmg-horas-complementares (atualizar_data_declaracao.py).

Também devolve nome, matrícula, RG e CPF lidos do texto, que o n8n usa só para
anonimizar o certificado antes de chamar o modelo. Nada é gravado em disco nem
registrado em log.

POST /redatar[?data=AAAA-MM-DD]  corpo: application/pdf  ->  JSON
POST /texto                      corpo: application/pdf  ->  {texto, paginas, paginas_ocr}
GET  /health
"""
from __future__ import annotations

import base64
import json
import re
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from urllib.parse import parse_qs, urlparse

import pymupdf  # renderiza a página para o OCR
from pypdf import PdfReader, PdfWriter
from pypdf.errors import PdfReadError
from pypdf.generic import DecodedStreamObject
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from atualizar_data_declaracao import interpretar_data, substituir_data

# Marca gravada pelo Gotenberg nos metadados da declaração-base (campo Subject).
KIT_MARCA = 'horas-complementares-ia/declaracao-base/v1'
# Linha de base da data, em mm a partir do topo. Igual ao .data de templates/declaracao.html.
KIT_DATA_TOPO_MM = 175
KIT_CIDADE = 'Leopoldina'
TAMANHO_MAXIMO = 10 * 1024 * 1024
# Abaixo disso, uma página com imagem é tratada como imagem (só cabeçalho/rodapé selecionáveis).
OCR_LIMITE_TEXTO = 300


class ErroDeclaracao(Exception):
    """Problema no PDF enviado, com mensagem pronta para mostrar ao aluno."""


def _texto(reader: PdfReader) -> str:
    return re.sub(r'\s+', ' ', reader.pages[0].extract_text() or '').strip()


def extrair_dados(texto: str) -> dict:
    """Lê os dados do aluno no texto padrão do Anexo I. Campos ausentes viram None."""
    def achar(padrao: str) -> str | None:
        m = re.search(padrao, texto, re.IGNORECASE)
        return m.group(1).strip() if m else None

    cpf = achar(r'CPF\s*(?:sob\s*o\s*n[úu]mero\s*)?(\d{3}\.?\d{3}\.?\d{3}-? ?\d{2})')
    return {
        'nome': achar(r'\bEu,\s*(.+?),\s*matriculad'),
        'matricula': achar(r'matr[íi]cula\s*(?:n[º°o.]*\s*)?(\d{6,})'),
        'rg': achar(r'identidade\s*(?:n[º°o.]*\s*)?([\w.\-/]{5,20})'),
        # Uma quebra de linha no hífen vira espaço no texto extraído.
        'cpf': cpf.replace(' ', '') if cpf else None,
    }


def _e_kit(reader: PdfReader) -> bool:
    meta = reader.metadata or {}
    return KIT_MARCA in str(meta.get('/Subject', ''))


def carimbar_data(reader: PdfReader, texto_data: str) -> tuple[PdfWriter, str]:
    # Só a página vai para o writer: a marca de kit não passa para o PDF datado,
    # para ele não ser carimbado de novo se for reenviado por engano.
    writer = PdfWriter()
    pagina = writer.add_page(reader.pages[0])
    largura = float(pagina.mediabox.width)
    altura = float(pagina.mediabox.height)
    linha = f'{KIT_CIDADE}, {texto_data}'

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=(largura, altura))
    c.setFont('Helvetica', 12)
    c.drawCentredString(largura / 2, altura - KIT_DATA_TOPO_MM * mm, linha)
    c.save()
    pagina.merge_page(PdfReader(buf).pages[0])
    return writer, linha


def reescrever_linha(reader: PdfReader, texto_data: str) -> tuple[PdfWriter, str]:
    writer = PdfWriter()
    pagina = writer.add_page(reader.pages[0])
    try:
        fluxo, _antigo, novo = substituir_data(pagina.get_contents().get_data(), texto_data)
    except SystemExit:  # o script da skill sinaliza "linha não encontrada" assim
        raise ErroDeclaracao(
            'Não achei a linha "Leopoldina, DD de mês de AAAA" na declaração. '
            'Envie a declaração-base que a ferramenta gerou no seu primeiro uso, '
            'e não o PDF final já com data.'
        ) from None
    stream = DecodedStreamObject()
    stream.set_data(fluxo)
    pagina.replace_contents(stream)
    return writer, novo


def processar(pdf: bytes, data: str | None = None) -> dict:
    try:
        reader = PdfReader(BytesIO(pdf))
        if not reader.pages:
            raise ErroDeclaracao('A declaração enviada não tem páginas.')
    except PdfReadError:
        raise ErroDeclaracao('O arquivo da declaração não é um PDF válido.') from None

    dados = extrair_dados(_texto(reader))
    texto_data = interpretar_data(data)
    if _e_kit(reader):
        writer, linha = carimbar_data(reader, texto_data)
        metodo = 'carimbo_kit'
    else:
        writer, linha = reescrever_linha(reader, texto_data)
        metodo = 'reescrita_linha'

    saida = BytesIO()
    writer.write(saida)
    return {
        'pdf_base64': base64.b64encode(saida.getvalue()).decode('ascii'),
        'metodo': metodo,
        'linha_data': linha,
        **dados,
    }


def ocr(imagem_png: bytes) -> str:
    """Tesseract em português, local: a imagem nunca sai do container."""
    r = subprocess.run(
        ['tesseract', 'stdin', 'stdout', '-l', 'por', '--psm', '3'],
        input=imagem_png, capture_output=True, timeout=60,
    )
    return r.stdout.decode('utf-8', 'replace') if r.returncode == 0 else ''


def extrair_texto(pdf: bytes, max_paginas: int = 10) -> dict:
    """Texto do certificado para o classificador.

    Página com imagem e quase nenhum texto selecionável (certificado colado como figura
    no modelo do curso, ou digitalizado) passa por OCR. O texto selecionável é mantido.
    """
    try:
        doc = pymupdf.open(stream=pdf, filetype='pdf')
    except (pymupdf.FileDataError, RuntimeError):
        raise ErroDeclaracao('O certificado não é um PDF válido.') from None
    partes, paginas_ocr = [], []
    for i, pagina in enumerate(doc):
        if i >= max_paginas:
            break
        texto = pagina.get_text().strip()
        if pagina.get_images() and len(texto) < OCR_LIMITE_TEXTO:
            lido = ocr(pagina.get_pixmap(dpi=300, colorspace=pymupdf.csGRAY).tobytes('png')).strip()
            if lido:
                texto = f'{texto}\n{lido}'.strip()
                paginas_ocr.append(i + 1)
        partes.append(texto)
    return {'texto': '\n'.join(partes).strip(), 'paginas': doc.page_count, 'paginas_ocr': paginas_ocr}


class Handler(BaseHTTPRequestHandler):
    def _json(self, status: int, corpo: dict) -> None:
        dados = json.dumps(corpo, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(dados)))
        self.end_headers()
        self.wfile.write(dados)

    def do_GET(self) -> None:
        if urlparse(self.path).path == '/health':
            self._json(200, {'status': 'ok'})
        else:
            self._json(404, {'erro': 'rota inexistente'})

    def do_POST(self) -> None:
        url = urlparse(self.path)
        if url.path not in ('/redatar', '/texto'):
            self._json(404, {'erro': 'rota inexistente'})
            return
        tamanho = int(self.headers.get('Content-Length') or 0)
        if not 0 < tamanho <= TAMANHO_MAXIMO:
            self._json(413, {'erro': 'Envie um PDF de até 10 MB.'})
            return
        corpo = self.rfile.read(tamanho)
        try:
            if url.path == '/texto':
                self._json(200, extrair_texto(corpo))
            else:
                self._json(200, processar(corpo, parse_qs(url.query).get('data', [None])[0]))
        except ErroDeclaracao as e:
            self._json(422, {'erro': str(e)})

    def log_message(self, formato: str, *args) -> None:
        # Só método, rota e status; nunca o conteúdo.
        print(f'{self.command} {urlparse(self.path).path} {args[1] if len(args) > 1 else ""}', flush=True)


if __name__ == '__main__':
    ThreadingHTTPServer(('0.0.0.0', 8000), Handler).serve_forever()
