"""Detecção e recorte local de assinatura, sem gravar nem enviar fotos."""
import base64
import json
import os
import urllib.request
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


def mascara_papel(rgb: Image.Image) -> np.ndarray:
    """Onde está a folha: claro e quase sem cor. Madeira, tecido e mesa ficam de fora.

    Sem isso, os veios de uma mesa de madeira passam no mesmo teste de contraste que a tinta
    e a "assinatura" vira a foto inteira. Em imagem que já é só papel, devolve tudo verdadeiro.
    """
    escala = min(1, 400 / max(rgb.size))
    pequena = rgb.resize((max(1, round(rgb.width * escala)), max(1, round(rgb.height * escala))))
    hsv = np.asarray(pequena.convert('HSV'), dtype=np.float32)
    sat, val = hsv[..., 1], hsv[..., 2]
    claro = val >= np.percentile(val, 90) * .72
    papel = (claro & (sat < 70)).astype(np.uint8) * 255
    # Fecha os buracos dos traços e afasta 2% da borda da folha (sombra, quina da mesa).
    margem = max(3, round(max(pequena.size) * .02)) | 1
    img = Image.fromarray(papel).filter(ImageFilter.MaxFilter(margem)).filter(ImageFilter.MinFilter(margem * 3))
    mascara = np.asarray(img) > 0
    if mascara.mean() < .15:  # não achou folha clara o bastante: não arrisca cortar nada
        return np.ones((rgb.height, rgb.width), dtype=bool)
    # Só a maior região de papel (descarta reflexos soltos na mesa).
    rotulos = np.zeros(mascara.shape, dtype=np.int32)
    altura, largura = mascara.shape
    tamanhos = {}
    atual = 0
    for y0 in range(altura):
        for x0 in range(largura):
            if not mascara[y0, x0] or rotulos[y0, x0]:
                continue
            atual += 1
            fila = [(y0, x0)]
            rotulos[y0, x0] = atual
            n = 0
            while fila:
                y, x = fila.pop()
                n += 1
                for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                    if 0 <= ny < altura and 0 <= nx < largura and mascara[ny, nx] and not rotulos[ny, nx]:
                        rotulos[ny, nx] = atual
                        fila.append((ny, nx))
            tamanhos[atual] = n
    maior = max(tamanhos, key=tamanhos.get)
    folha = Image.fromarray(((rotulos == maior) * 255).astype(np.uint8)).resize(rgb.size, Image.Resampling.NEAREST)
    return np.asarray(folha) > 0


def limpar_tinta(regiao: Image.Image, caixa_assinatura: tuple | None = None) -> Image.Image:
    """Remove luz/fundo na região localizada pelo modelo; funciona com tinta de qualquer cor."""
    branco = Image.new('RGBA', regiao.size, 'white')
    branco.alpha_composite(regiao.convert('RGBA'))
    rgb = branco.convert('RGB')
    pixels = np.asarray(rgb, dtype=np.float32)
    fundo = np.asarray(rgb.filter(ImageFilter.GaussianBlur(max(5, rgb.width / 30))), dtype=np.float32)
    contraste = np.max(fundo - pixels, axis=2)
    folha = mascara_papel(rgb)
    # O ruído é medido só no papel: a textura da mesa não pode subir nem baixar o corte.
    ruido = float(np.median(np.abs(contraste[folha])))
    corte = max(7, ruido * 2.5)
    alfa = (np.clip((contraste - corte) * 10, 0, 255) * folha).astype(np.uint8)
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
    cor_tinta = (15, 15, 15)
    pixels_tinta = pixels[alfa >= 150]
    if len(pixels_tinta) >= 40:
        med = np.median(pixels_tinta, axis=0)
        if med[2] > med[0] + 12 and med[2] > med[1] + 10:
            cor_tinta = (20, 35, 105)
    img = Image.new('RGBA', rgb.size, (*cor_tinta, 0))
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
    alfa = np.asarray(img.getchannel('A'))
    caixa_alfa = img.getchannel('A').getbbox()
    if not caixa_alfa:
        raise ErroAssinatura('Não identifiquei a assinatura. Envie uma imagem nítida com a sua assinatura.')
    x0, y0, x1, y1 = caixa_alfa
    transparente = float((alfa[y0:y1, x0:x1] > 8).mean()) < .6
    img = _recortar_alfa(img) if transparente else limpar_tinta(img)
    saida = BytesIO()
    img.save(saida, 'PNG')
    return {'imagem_base64': base64.b64encode(saida.getvalue()).decode('ascii'),
            'mime_type': 'image/png', 'largura': img.width, 'altura': img.height,
            'metodo': 'processamento_direto', 'confianca': 1.0}


def recortar_assinatura_com_ia(dados: bytes, api_key: str | None = None, modelo: str | None = None) -> dict:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(BytesIO(dados)) as origem:
                if origem.format not in ('JPEG', 'PNG') or origem.width * origem.height > 20_000_000:
                    raise ErroAssinatura('Envie uma imagem da assinatura em JPG ou PNG de até 20 megapixels.')
                img_rgba = ImageOps.exif_transpose(origem).convert('RGBA')
                caixa_alfa = img_rgba.getchannel('A').getbbox()
                if caixa_alfa:
                    alfa = np.asarray(img_rgba.getchannel('A'))
                    x0, y0, x1, y1 = caixa_alfa
                    if float((alfa[y0:y1, x0:x1] > 8).mean()) < .6:
                        final = _recortar_alfa(img_rgba)
                        saida = BytesIO()
                        final.save(saida, 'PNG')
                        return {
                            'imagem_base64': base64.b64encode(saida.getvalue()).decode('ascii'),
                            'mime_type': 'image/png',
                            'largura': final.width,
                            'altura': final.height,
                            'metodo': 'transparencia_existente',
                            'confianca': 1.0,
                        }
                img = img_rgba.convert('RGB')
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ErroAssinatura('Não consegui ler a imagem da assinatura. Envie uma foto em JPG ou PNG.') from None

    chave = api_key or os.environ.get('GEMINI_API_KEY')
    mod = modelo or os.environ.get('GEMINI_MODEL', 'gemini-3.5-flash-lite')
    if not chave:
        resultado = recortar_assinatura(dados)
        resultado['aviso'] = 'Chave GEMINI_API_KEY não configurada; processamento local executado.'
        return resultado

    copia = img.copy()
    copia.thumbnail((1200, 1200))
    buf_envio = BytesIO()
    copia.save(buf_envio, 'JPEG', quality=85)
    bytes_envio = buf_envio.getvalue()

    url = f'https://generativelanguage.googleapis.com/v1beta/models/{mod}:generateContent'
    prompt = (
        "Você é um especialista em visão computacional e análise de documentos.\n"
        "Localize a assinatura manuscrita (ou rubrica) presente nesta foto.\n"
        "Retorne o bounding box [ymin, xmin, ymax, xmax] normalizado na escala de 0 a 1000 que engloba toda a assinatura manuscrita, com margem de segurança de cerca de 2%.\n"
        "Responda APENAS em formato JSON:\n"
        "{\n"
        '  "box_2d": [ymin, xmin, ymax, xmax],\n'
        '  "confianca": "alta",\n'
        '  "descricao": "assinatura detectada"\n'
        "}"
    )

    payload = {
        'contents': [{
            'parts': [
                {'text': prompt},
                {'inline_data': {'mime_type': 'image/jpeg', 'data': base64.b64encode(bytes_envio).decode('ascii')}}
            ]
        }],
        'generationConfig': {'responseMimeType': 'application/json'}
    }

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={'x-goog-api-key': chave, 'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            corpo_resposta = json.loads(r.read().decode('utf-8'))
            texto_json = corpo_resposta['candidates'][0]['content']['parts'][0]['text']
            ia_dados = json.loads(texto_json)
    except Exception as e:
        resultado = recortar_assinatura(dados)
        resultado['aviso'] = f'IA indisponível ({e}); processamento local executado.'
        return resultado

    box = ia_dados.get('box_2d')
    if not box or len(box) != 4:
        return recortar_assinatura(dados)

    w, h = img.size
    margem_y = max(20, int((box[2] - box[0]) / 1000 * h * 0.15))
    margem_x = max(25, int((box[3] - box[1]) / 1000 * w * 0.15))

    ymin = max(0, int(box[0] / 1000 * h) - margem_y)
    xmin = max(0, int(box[1] / 1000 * w) - margem_x)
    ymax = min(h, int(box[2] / 1000 * h) + margem_y)
    xmax = min(w, int(box[3] / 1000 * w) + margem_x)

    if xmax - xmin < 15 or ymax - ymin < 10:
        return recortar_assinatura(dados)

    recorte = img.crop((xmin, ymin, xmax, ymax))

    try:
        final = limpar_tinta(recorte)
    except ErroAssinatura:
        final = limpar_tinta(img)

    saida = BytesIO()
    final.save(saida, 'PNG')

    return {
        'imagem_base64': base64.b64encode(saida.getvalue()).decode('ascii'),
        'mime_type': 'image/png',
        'largura': final.width,
        'altura': final.height,
        'metodo': 'ia_gemini',
        'box_2d': box,
        'confianca': ia_dados.get('confianca', 'alta'),
        'descricao': ia_dados.get('descricao', 'assinatura detectada por IA')
    }
