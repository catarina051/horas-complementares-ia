"""Detecção e recorte local de assinatura, sem gravar nem enviar fotos."""
import base64
from io import BytesIO
import warnings

import numpy as np
from PIL import Image, ImageFilter, ImageOps, UnidentifiedImageError


class ErroAssinatura(ValueError):
    pass


def _recortar_alfa(img: Image.Image) -> Image.Image:
    caixa = img.getchannel('A').getbbox()
    if not caixa or caixa[2] - caixa[0] < 10 or caixa[3] - caixa[1] < 5:
        raise ErroAssinatura('Não identifiquei a assinatura. Envie uma foto nítida, com uma única assinatura em papel branco.')
    margem = max(4, round(max(caixa[2] - caixa[0], caixa[3] - caixa[1]) * .02))
    return ImageOps.expand(img.crop(caixa), border=margem, fill=(0, 0, 0, 0))


def limpar_tinta(regiao: Image.Image, caixa_assinatura: tuple | None = None) -> Image.Image:
    """Remove luz/fundo na região localizada pelo modelo; funciona com tinta de qualquer cor."""
    branco = Image.new('RGBA', regiao.size, 'white')
    branco.alpha_composite(regiao.convert('RGBA'))
    rgb = branco.convert('RGB')
    pixels = np.asarray(rgb, dtype=np.float32)
    fundo = np.asarray(rgb.filter(ImageFilter.GaussianBlur(max(5, rgb.width / 30))), dtype=np.float32)
    contraste = np.max(fundo - pixels, axis=2)
    ruido = float(np.median(np.abs(contraste)))
    corte = max(7, ruido * 2.5)
    alfa = np.clip((contraste - corte) * 10, 0, 255).astype(np.uint8)
    largura, altura = rgb.size
    if caixa_assinatura:
        bx0, by0, bx1, by1 = caixa_assinatura
        cromaticidade = fundo / np.maximum(fundo.sum(axis=2, keepdims=True), 1)
        cor_papel = np.median(cromaticidade[by0:by1, bx0:bx1].reshape(-1, 3), axis=0)
        papel = np.max(np.abs(cromaticidade - cor_papel), axis=2) < .045
        alfa *= papel.astype(np.uint8)
    grupos = bytearray(Image.fromarray(alfa).point(lambda x: 255 if x >= 48 else 0)
                       .filter(ImageFilter.MaxFilter(5)).tobytes())
    componentes = []
    for i in range(len(grupos)):
        if not grupos[i]:
            continue
        grupos[i] = 0
        fila, pontos = [i], []
        while fila:
            p = fila.pop()
            pontos.append(p)
            x, y = p % largura, p // largura
            for vizinho in (p - 1 if x else -1, p + 1 if x < largura - 1 else -1,
                            p - largura if y else -1, p + largura if y < altura - 1 else -1):
                if vizinho >= 0 and grupos[vizinho]:
                    grupos[vizinho] = 0
                    fila.append(vizinho)
        xs, ys = [p % largura for p in pontos], [p // largura for p in pontos]
        cw, ch = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
        # Bordas verticais de papel/mesa não são traços da assinatura.
        if caixa_assinatura and ch > max(40, cw * 15) and ch > (by1 - by0) * .8:
            continue
        if caixa_assinatura and cw > max(40, ch * 15, (bx1 - bx0) * 1.6) and (max(ys) < by0 or min(ys) > by1):
            continue
        componentes.append(pontos)
    maior = max((len(p) for p in componentes), default=0)
    corpos = [pontos for pontos in componentes if len(pontos) >= max(12, maior * .05)]
    if caixa_assinatura:
        # A caixa da IA é uma semente, não um limite que possa amputar um nome/floreio.
        proximos = []
        alcance_corpo = (by1 - by0) * .65
        for pontos in corpos:
            distancia = min(max(bx0 - p % largura, 0, p % largura - bx1) ** 2 +
                            max(by0 - p // largura, 0, p // largura - by1) ** 2 for p in pontos)
            if distancia <= alcance_corpo ** 2:
                proximos.append(pontos)
        corpos = proximos
    principais = [p for pontos in corpos for p in pontos]
    if not principais:
        raise ErroAssinatura('Não identifiquei a assinatura na região detectada. Envie uma foto mais nítida.')
    xs, ys = [p % largura for p in principais], [p // largura for p in principais]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    alcance = max(10, (y1 - y0) * .4)
    preservar = np.zeros(largura * altura, dtype=np.uint8)
    for pontos in componentes:
        # Pontos, acentos e traços separados perto do corpo são preservados,
        # mesmo quando muito menores que os outros componentes.
        perto = any(x0 - alcance <= p % largura <= x1 + alcance and
                    y0 - alcance <= p // largura <= y1 + alcance for p in pontos)
        forte = any(alfa.flat[p] >= 160 for p in pontos)
        if perto and (len(pontos) >= max(12, maior * .05) or forte):
            preservar[pontos] = 1
    alfa *= preservar.reshape(altura, largura)
    img = Image.new('RGBA', rgb.size, (0, 0, 0, 0))
    img.putalpha(Image.fromarray(alfa))
    return _recortar_alfa(img)


def recortar_assinatura(dados: bytes) -> dict:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(BytesIO(dados)) as origem:
                if origem.format not in ('JPEG', 'PNG') or origem.width * origem.height > 20_000_000:
                    raise ErroAssinatura('Envie uma imagem da assinatura em JPG ou PNG de até 20 megapixels.')
                img = ImageOps.exif_transpose(origem).convert('RGBA')
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ErroAssinatura('Não consegui ler a imagem da assinatura. Envie uma foto em JPG ou PNG.') from None
    img.thumbnail((1800, 1800))
    caixa_alfa = img.getchannel('A').getbbox()
    if caixa_alfa:
        ocupado = np.asarray(img.getchannel('A').crop(caixa_alfa)) > 8
        # Margens transparentes em volta de uma fotografia não são fundo removido.
        if float(ocupado.mean()) > .9:
            img = img.crop(caixa_alfa)
    branco = Image.new('RGBA', img.size, 'white')
    branco.alpha_composite(img)
    if all(hi - lo < 3 for lo, hi in branco.convert('RGB').getextrema()):
        raise ErroAssinatura('Não identifiquei a assinatura. Envie uma foto nítida em papel branco.')
    from detector_assinatura import localizar_assinatura
    img, caixa, confianca = localizar_assinatura(img)
    # PNGs realmente recortados têm poucos pixels opacos. Depois da validação
    # pelo detector, preserva todos os traços para não cortar nome ou floreios.
    alfa = np.asarray(img.getchannel('A'))
    caixa_alfa = img.getchannel('A').getbbox()
    x0, y0, x1, y1 = caixa_alfa
    transparente = float((alfa[y0:y1, x0:x1] > 8).mean()) < .4
    img = _recortar_alfa(img) if transparente else limpar_tinta(img, caixa_assinatura=caixa)
    if not transparente and (img.width > (caixa[2] - caixa[0]) * 2.3 or img.height > (caixa[3] - caixa[1]) * 2.3):
        raise ErroAssinatura('O fundo da foto se confundiu com a assinatura. Envie outra foto mais próxima, com a assinatura inteira em papel branco.')
    saida = BytesIO()
    img.save(saida, 'PNG')
    return {'imagem_base64': base64.b64encode(saida.getvalue()).decode('ascii'),
            'mime_type': 'image/png', 'largura': img.width, 'altura': img.height,
            'metodo': 'detector_local', 'confianca': confianca}
