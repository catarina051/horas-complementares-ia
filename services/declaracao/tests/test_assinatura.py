import base64
import sys
from io import BytesIO
from pathlib import Path

import pytest
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import app
import assinatura


def foto(caneta=(40, 40, 100), transparente=False):
    img = Image.new('RGBA' if transparente else 'RGB', (720, 1280), (0, 0, 0, 0) if transparente else (180, 175, 170))
    d = ImageDraw.Draw(img)
    if not transparente:
        d.rectangle((0, 0, 720, 380), fill=(120, 85, 45))
        for x in range(0, 720, 20):
            d.line((x, 0, x + 150, 380), fill=(65, 40, 15), width=3)
    d.line([(220, 750), (380, 570), (340, 720), (300, 640), (450, 620), (400, 680), (570, 550)], fill=caneta, width=4)
    buf = BytesIO()
    img.save(buf, 'PNG' if transparente else 'JPEG')
    return buf.getvalue()


@pytest.mark.parametrize('caneta', [(40, 40, 100), (30, 30, 30), (140, 20, 20), (15, 90, 25)])
def test_limpeza_preserva_tinta_de_cores_distintas(caneta):
    # A detecção escolhe a região; esta etapa só remove papel/sombra, sem depender de azul.
    regiao = Image.open(BytesIO(foto(caneta))).convert('RGBA').crop((180, 510, 610, 790))
    img = assinatura.limpar_tinta(regiao)
    assert img.mode == 'RGBA'
    assert 340 <= img.width <= 400 and 195 <= img.height <= 250
    assert img.getpixel((0, 0))[3] == 0
    assert img.getchannel('A').getextrema()[1] > 200


def test_png_transparente_preserva_traco():
    img = assinatura.limpar_tinta(Image.open(BytesIO(foto(transparente=True))))
    assert 340 <= img.width <= 400 and 195 <= img.height <= 250
    assert img.getpixel((0, 0))[3] == 0


def test_assinatura_vazia_ou_invalida_vira_erro_legivel():
    buf = BytesIO()
    Image.new('RGB', (200, 200), 'white').save(buf, 'PNG')
    for dados in [buf.getvalue(), b'nao e imagem']:
        with pytest.raises(app.ErroDeclaracao, match='assinatura|imagem'):
            app.recortar_assinatura(dados)


def test_limpeza_nao_apaga_assinatura_que_encosta_na_borda():
    regiao = Image.open(BytesIO(foto())).convert('RGBA').crop((220, 550, 571, 751))
    img = assinatura.limpar_tinta(regiao)
    assert img.width >= 340 and img.height >= 195




def test_limpeza_preserva_pontos_e_acentos_pequenos_proximos_do_traco():
    img = Image.new('RGB', (700, 250), 'white')
    d = ImageDraw.Draw(img)
    d.line([(10,150),(100,60),(90,200),(180,60),(170,200),(260,60),(250,200),(340,60),
            (330,200),(420,60),(410,200),(500,60),(490,200),(580,60),(570,200),(680,150)], fill='black', width=5)
    d.ellipse((349,18,351,20), fill='black')
    resultado = assinatura.limpar_tinta(img)
    assert resultado.height >= 200  # o ponto acima do corpo faz parte do recorte


def test_png_branco_com_cantos_transparentes_nao_e_assinatura():
    img = Image.new('RGBA', (700, 250), 'white')
    for p in [(0,0), (699,0), (0,249), (699,249)]:
        img.putpixel(p, (0,0,0,0))
    buf = BytesIO()
    img.save(buf, 'PNG')
    with pytest.raises(app.ErroDeclaracao, match='Não identifiquei|Não consegui localizar'):
        app.recortar_assinatura(buf.getvalue())




def test_png_transparente_validado_nao_perde_trechos_do_traco():
    r = app.recortar_assinatura(foto(transparente=True))
    assert r['largura'] >= 350
    assert r['metodo'] == 'processamento_direto'


def test_recortar_assinatura_cortada_e_sem_fundo_pelo_usuario():
    # Quando o usuário corta e remove o fundo na interface, o backend recebe o PNG
    # e preserva a assinatura como está.
    dados = foto(transparente=True)
    r = app.recortar_assinatura(dados)
    assert r['mime_type'] == 'image/png'
    assert r['metodo'] == 'processamento_direto'


def test_recorte_expande_da_regiao_detectada_para_os_tracos_proximos_no_papel():
    img = Image.new('RGB', (1200,800), (180,175,170))
    d = ImageDraw.Draw(img)
    d.rectangle((0,0,1200,200), fill=(120,80,30))
    for x in range(0,1200,20):
        d.line((x,0,x+150,200), fill=(50,30,10), width=4)
    d.line([(200,550),(280,400),(300,600),(450,450),(550,550)], fill='black', width=5)
    d.line([(620,550),(680,420),(750,540),(900,500)], fill='black', width=5)
    resultado = assinatura.limpar_tinta(img, caixa_assinatura=(600,390,920,570))
    assert resultado.width >= 700  # o primeiro nome também entra
    assert 200 <= resultado.height <= 250  # mesa não entra


def test_png_com_margem_transparente_remove_papel_da_fotografia():
    img = Image.new('RGBA', (1000,1000), (0,0,0,0))
    d = ImageDraw.Draw(img)
    d.rectangle((200,300,599,499), fill=(180,180,180,255))
    d.line([(235,440),(300,330),(310,450),(400,350),(540,420)], fill='black', width=4)
    buf = BytesIO(); img.save(buf,'PNG')
    r = app.recortar_assinatura(buf.getvalue())
    saida = Image.open(BytesIO(base64.b64decode(r['imagem_base64'])))
    assert saida.width < 360 and saida.height < 160
    assert saida.getpixel((0,0))[3] == 0


def test_recortar_assinatura_ia_com_transparencia_previa():
    dados_transp = foto(transparente=True)
    r = assinatura.recortar_assinatura_com_ia(dados_transp)
    assert r['metodo'] == 'transparencia_existente'
    assert r['confianca'] == 1.0
    img = Image.open(BytesIO(base64.b64decode(r['imagem_base64'])))
    assert img.mode == 'RGBA'
    assert img.getpixel((0, 0))[3] == 0


def test_recortar_assinatura_ia_sem_chave_faz_fallback(monkeypatch):
    monkeypatch.delenv('GEMINI_API_KEY', raising=False)
    dados = foto()
    r = assinatura.recortar_assinatura_com_ia(dados, api_key=None)
    assert 'aviso' in r or r['metodo'] == 'processamento_direto'


def test_recortar_assinatura_ia_com_resposta_gemini(monkeypatch):
    class MockResponse:
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def read(self):
            import json
            conteudo = {
                'candidates': [{
                    'content': {
                        'parts': [{
                            'text': json.dumps({
                                'box_2d': [400, 250, 650, 800],
                                'confianca': 'alta',
                                'descricao': 'assinatura em caneta azul'
                            })
                        }]
                    }
                }]
            }
            return json.dumps(conteudo).encode('utf-8')

    import urllib.request
    monkeypatch.setattr(urllib.request, 'urlopen', lambda *args, **kwargs: MockResponse())

    dados = foto()
    r = assinatura.recortar_assinatura_com_ia(dados, api_key='fake-key')
    assert r['metodo'] == 'ia_gemini'
    assert r['box_2d'] == [400, 250, 650, 800]
    img = Image.open(BytesIO(base64.b64decode(r['imagem_base64'])))
    assert img.mode == 'RGBA'
    assert img.getpixel((0, 0))[3] == 0


def foto_sobre_mesa_de_madeira() -> bytes:
    """Como a foto real que quebrou: folha clara em cima de uma mesa de madeira com veios escuros."""
    import random
    random.seed(3)
    img = Image.new('RGB', (720, 1280), (176, 128, 84))
    d = ImageDraw.Draw(img)
    for i in range(-1280, 720, 9):  # veios diagonais escuros, como os da mesa
        tom = random.randint(70, 130)
        d.line([(i, 0), (i + 900, 520)], fill=(tom, tom - 35, tom - 70), width=random.randint(2, 5))
    d.rectangle([0, 380, 720, 1280], fill=(226, 222, 218))  # a folha ocupa a parte de baixo
    d.line([(250, 660), (330, 600), (360, 700), (430, 610), (560, 560)], fill=(40, 45, 120), width=5)
    d.line([(230, 750), (380, 620)], fill=(40, 45, 120), width=4)
    saida = BytesIO()
    img.save(saida, 'JPEG', quality=90)
    return saida.getvalue()


def test_veios_da_mesa_nao_entram_na_assinatura():
    r = assinatura.recortar_assinatura(foto_sobre_mesa_de_madeira())
    # A caixa fica só em volta dos traços (~330 x 190 px), não da foto inteira (720 x 1280).
    assert r['largura'] < 420 and r['altura'] < 260, (r['largura'], r['altura'])
    img = Image.open(BytesIO(base64.b64decode(r['imagem_base64'])))
    tinta = [px for px in img.getdata() if px[3] > 150]
    assert tinta and sum(px[2] for px in tinta) / len(tinta) > 80  # tinta azul preservada


def test_imagem_que_ja_e_so_papel_nao_perde_nada():
    papel = Image.new('RGB', (400, 200), 'white')
    assert assinatura.mascara_papel(papel).all()
