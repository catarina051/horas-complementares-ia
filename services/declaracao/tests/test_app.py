import base64
import json
import shutil
import sys
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from io import BytesIO
from pathlib import Path

import pytest
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DecodedStreamObject
from reportlab.pdfgen import canvas

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import app  # noqa: E402

CORPO = [
    'Eu, Fulana de Tal Exemplo, matriculado(a) no curso Engenharia de Computação,',
    'número de matrícula 20240000001, portador(a) da carteira de identidade MG1234567,',
    'inscrito(a) no CPF sob o número 123.456.789-09, DECLARO que o documento é autêntico.',
]


def _texto(pdf: bytes) -> str:
    return ' '.join((PdfReader(BytesIO(pdf)).pages[0].extract_text() or '').split())


def kit_pdf(marcado: bool = True) -> bytes:
    """Imita a declaração-base gerada pelo Gotenberg: sem data, com a marca nos metadados."""
    buf = BytesIO()
    c = canvas.Canvas(buf)
    if marcado:
        c.setSubject(app.KIT_MARCA)
    c.setFont('Helvetica', 10)
    for i, linha in enumerate(CORPO):
        c.drawString(40, 700 - 14 * i, linha)
    c.drawCentredString(297, 300, 'Local e Data')
    c.save()
    return buf.getvalue()


def declaracao_word_pdf() -> bytes:
    """Imita a declaração assinada exportada do Word, no formato de fluxo que o script da skill lê."""
    buf = BytesIO()
    c = canvas.Canvas(buf)
    c.setFont('Helvetica', 12)  # registra /F1 nos recursos da página
    c.drawString(40, 700, 'x')
    c.save()
    w = PdfWriter()
    pagina = w.add_page(PdfReader(BytesIO(buf.getvalue())).pages[0])
    linhas = b''.join(
        b'BT\r\n/F1 10 Tf\r\n1 0 0 1 40 %d Tm\r\n(%s) Tj\r\nET\r\n' % (700 - 14 * i, l.encode('latin-1'))
        for i, l in enumerate(CORPO)
    )
    data = (
        b'BT\r\n/F1 12 Tf\r\n1 0 0 1 220.5 300 Tm\r\n0 g\r\n0 G\r\n'
        b'[(Leopoldi)19(na, 11 de agosto de 2026)] TJ\r\nET\r\n'
    )
    stream = DecodedStreamObject()
    stream.set_data(linhas + data)
    pagina.replace_contents(stream)
    out = BytesIO()
    w.write(out)
    return out.getvalue()


def test_carimba_data_na_declaracao_base_do_kit():
    r = app.processar(kit_pdf(), '2026-03-01')
    assert r['metodo'] == 'carimbo_kit'
    assert r['linha_data'] == 'Leopoldina, 1 de março de 2026'
    pdf = base64.b64decode(r['pdf_base64'])
    assert 'Leopoldina, 1 de março de 2026' in _texto(pdf)
    # o PDF datado perde a marca de kit
    assert app.KIT_MARCA not in str(PdfReader(BytesIO(pdf)).metadata or {})


def test_reescreve_a_linha_de_uma_declaracao_existente():
    r = app.processar(declaracao_word_pdf(), '2026-03-01')
    assert r['metodo'] == 'reescrita_linha'
    texto = _texto(base64.b64decode(r['pdf_base64']))
    assert 'Leopoldina, 1 de março de 2026' in texto
    assert '11 de agosto' not in texto


def test_extrai_dados_do_aluno():
    r = app.processar(kit_pdf())
    assert r['nome'] == 'Fulana de Tal Exemplo'
    assert r['matricula'] == '20240000001'
    assert r['rg'] == 'MG1234567'
    assert r['cpf'] == '123.456.789-09'


def test_cpf_quebrado_no_hifen():
    texto = 'inscrito(a) no CPF sob o número 123.456.789- 09, DECLARO'
    assert app.extrair_dados(texto)['cpf'] == '123.456.789-09'


def test_pdf_sem_data_e_sem_marca_vira_erro_claro():
    with pytest.raises(app.ErroDeclaracao, match='declaração-base'):
        app.processar(kit_pdf(marcado=False))


def test_arquivo_que_nao_e_pdf():
    with pytest.raises(app.ErroDeclaracao, match='PDF válido'):
        app.processar(b'isto nao e um pdf')


@pytest.fixture
def servidor():
    srv = ThreadingHTTPServer(('127.0.0.1', 0), app.Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield f'http://127.0.0.1:{srv.server_port}'
    srv.shutdown()


def _post(url: str, corpo: bytes):
    req = urllib.request.Request(url, data=corpo, headers={'Content-Type': 'application/pdf'})
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.load(resp)
    except urllib.error.HTTPError as e:
        return e.code, json.load(e)


def test_http_redatar_e_health(servidor):
    with urllib.request.urlopen(servidor + '/health') as resp:
        assert json.load(resp) == {'status': 'ok'}
    status, corpo = _post(servidor + '/redatar?data=2026-03-01', kit_pdf())
    assert status == 200 and corpo['metodo'] == 'carimbo_kit'
    status, corpo = _post(servidor + '/redatar', kit_pdf(marcado=False))
    assert status == 422 and 'declaração-base' in corpo['erro']


def certificado_como_imagem() -> bytes:
    """Certificado sem texto selecionável: a página é só uma figura, como quando o aluno cola o
    certificado no modelo do curso. Mantém um cabeçalho de texto curto, como o do CEFET."""
    import pymupdf
    buf = BytesIO()
    c = canvas.Canvas(buf)
    c.setFont('Helvetica-Bold', 28)
    c.drawString(60, 700, 'CERTIFICADO')
    c.setFont('Helvetica', 16)
    c.drawString(60, 650, 'Certificamos que Fulana de Tal Exemplo concluiu o curso')
    c.drawString(60, 625, 'Novos Negocios em TIC com carga horaria de 400 horas.')
    c.save()
    figura = pymupdf.open(stream=buf.getvalue(), filetype='pdf')[0].get_pixmap(dpi=150).tobytes('png')
    doc = pymupdf.open()
    pagina = doc.new_page()
    pagina.insert_text((60, 40), 'CENTRO FEDERAL DE EDUCACAO TECNOLOGICA DE MINAS GERAIS', fontsize=9)
    pagina.insert_image(pymupdf.Rect(30, 60, 565, 800), stream=figura)
    return doc.tobytes()


@pytest.mark.skipif(not shutil.which('tesseract'), reason='Tesseract não instalado (roda no container)')
def test_ocr_le_certificado_colado_como_imagem():
    r = app.extrair_texto(certificado_como_imagem())
    assert r['paginas_ocr'] == [1]
    texto = ' '.join(r['texto'].split())
    assert 'CERTIFICADO' in texto
    assert '400 horas' in texto
    assert 'CENTRO FEDERAL' in texto  # o texto selecionável continua


def test_pdf_com_texto_nao_passa_por_ocr():
    assert app.extrair_texto(kit_pdf())['paginas_ocr'] == []


def test_http_texto(servidor):
    status, corpo = _post(servidor + '/texto', kit_pdf())
    assert status == 200 and corpo['paginas'] == 1
    assert 'Fulana de Tal Exemplo' in corpo['texto']
    status, corpo = _post(servidor + '/texto', b'nao e pdf')
    assert status == 422
