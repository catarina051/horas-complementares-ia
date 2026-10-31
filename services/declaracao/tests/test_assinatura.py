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


def test_detector_converte_coordenadas_e_elimina_caixas_duplicadas():
    import numpy as np
    from detector_assinatura import selecionar_caixa
    logits = np.array([[5., -5.], [4., -4.], [-5., 5.]])
    caixas = np.array([[.5, .6, .4, .2], [.5, .6, .39, .19], [.1, .1, .1, .1]])
    caixa, confianca = selecionar_caixa(logits, caixas, (1000, 500))
    assert caixa == (300, 250, 700, 350)
    assert confianca > .99


def test_detector_recusa_duas_assinaturas_e_ausencia_de_assinatura():
    import numpy as np
    from detector_assinatura import selecionar_caixa
    from assinatura import ErroAssinatura
    with pytest.raises(ErroAssinatura, match='mais de uma'):
        selecionar_caixa(np.array([[5., -5.], [5., -5.]]),
                         np.array([[.2, .2, .2, .1], [.8, .8, .2, .1]]), (1000, 500))
    assert selecionar_caixa(np.array([[-5., 5.]]), np.array([[.5, .5, .1, .1]]), (1000, 500)) is None


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


def test_detector_preserva_proporcao_e_reverte_coordenadas_do_preenchimento(monkeypatch):
    import numpy as np
    import detector_assinatura as detector
    class Sessao:
        def run(self, _nomes, dados):
            assert dados['pixel_values'].shape == (1, 3, 640, 640)
            # A foto 4:1 ocupa só a faixa central; os demais pixels são brancos.
            assert dados['pixel_values'][0, 0, 0, 0] > 2
            return np.array([[[5., -5.]]]), np.array([[[.5, .5, 1., .25]]])
    monkeypatch.setattr(detector, '_sessao', lambda: Sessao())
    _, caixa, _ = detector.localizar_assinatura(Image.new('RGBA', (1000,250), 'black'))
    assert caixa == (0, 0, 1000, 250)


def test_regioes_de_nome_e_sobrenome_alinhadas_formam_uma_assinatura():
    import numpy as np
    from detector_assinatura import selecionar_caixa
    caixa, _ = selecionar_caixa(np.array([[5.,-5.],[5.,-5.]]),
                                np.array([[.3,.5,.3,.2],[.65,.5,.3,.2]]), (1000,500))
    assert caixa == (150,200,800,300)


def test_png_transparente_validado_nao_perde_trechos_fora_da_caixa_do_detector(monkeypatch):
    import detector_assinatura as detector
    monkeypatch.setattr(detector, 'localizar_assinatura', lambda img: (img,(300,550,575,755),.9))
    r = app.recortar_assinatura(foto(transparente=True))
    assert r['largura'] >= 350


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


def test_png_com_margem_transparente_remove_papel_da_fotografia(monkeypatch):
    import detector_assinatura as detector
    img = Image.new('RGBA', (1000,1000), (0,0,0,0))
    d = ImageDraw.Draw(img)
    d.rectangle((200,300,599,499), fill=(180,180,180,255))
    d.line([(235,440),(300,330),(310,450),(400,350),(540,420)], fill='black', width=4)
    monkeypatch.setattr(detector, 'localizar_assinatura', lambda im: (im,(0,0,im.width,im.height),.9))
    buf = BytesIO(); img.save(buf,'PNG')
    r = app.recortar_assinatura(buf.getvalue())
    saida = Image.open(BytesIO(base64.b64decode(r['imagem_base64'])))
    assert saida.width < 360 and saida.height < 160
    assert saida.getpixel((0,0))[3] == 0
