"""YOLOS Tiny treinado para localizar assinaturas. Inferência ONNX apenas em CPU."""
from functools import lru_cache
import os
from pathlib import Path

import numpy as np
from PIL import Image

from assinatura import ErroAssinatura


def selecionar_caixa(logits: np.ndarray, caixas: np.ndarray, tamanho: tuple[int, int]):
    exp = np.exp(logits - logits.max(axis=-1, keepdims=True))
    scores = (exp / exp.sum(axis=-1, keepdims=True))[:, 0]
    selecionadas = []
    for i in np.argsort(-scores):
        if scores[i] < .60:
            continue
        cx, cy, w, h = caixas[i]
        caixa = np.clip([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], 0, 1)
        if not np.isfinite(caixa).all() or caixa[2] <= caixa[0] or caixa[3] <= caixa[1]:
            continue
        duplicada = False
        for outra, _ in selecionadas:
            inter = max(0, min(caixa[2], outra[2]) - max(caixa[0], outra[0])) * max(0, min(caixa[3], outra[3]) - max(caixa[1], outra[1]))
            area = (caixa[2] - caixa[0]) * (caixa[3] - caixa[1])
            outra_area = (outra[2] - outra[0]) * (outra[3] - outra[1])
            if inter / (area + outra_area - inter) > .3:
                duplicada = True
        if not duplicada:
            selecionadas.append((caixa, float(scores[i])))
    # O modelo pode separar nome e sobrenome de uma única assinatura.
    # Une apenas regiões próximas na mesma linha; regiões em outras linhas são ambíguas.
    unidas = []
    for caixa, score in sorted(selecionadas, key=lambda c: c[0][0]):
        if unidas:
            anterior, antes_score = unidas[-1]
            h1, h2 = caixa[3] - caixa[1], anterior[3] - anterior[1]
            sobreposicao = max(0, min(caixa[3], anterior[3]) - max(caixa[1], anterior[1]))
            # As coordenadas normalizadas têm escalas x/y diferentes; comparar em pixels.
            distancia = max(0, caixa[0] - anterior[2]) * tamanho[0]
            if sobreposicao > min(h1, h2) * .5 and distancia < max(h1, h2) * tamanho[1] * .8:
                unidas[-1] = (np.array([min(anterior[0], caixa[0]), min(anterior[1], caixa[1]),
                                       max(anterior[2], caixa[2]), max(anterior[3], caixa[3])]), max(score, antes_score))
                continue
        unidas.append((caixa, score))
    selecionadas = unidas
    if len(selecionadas) > 1:
        raise ErroAssinatura('Encontrei mais de uma assinatura na foto. Envie uma foto com somente a sua assinatura.')
    if not selecionadas:
        return None
    caixa, score = selecionadas[0]
    largura, altura = tamanho
    return tuple(round(float(v) * escala) for v, escala in zip(caixa, [largura, altura, largura, altura])), score


@lru_cache(maxsize=1)
def _sessao():
    modelo = Path(os.environ.get('ASSINATURA_MODELO', '/modelo/assinatura.onnx'))
    if not modelo.is_file():
        raise ErroAssinatura('O detector local de assinatura está indisponível. Reinicie o serviço com docker compose up -d --build declaracao.')
    import onnxruntime as ort
    ort.disable_telemetry_events()
    opcoes = ort.SessionOptions()
    opcoes.intra_op_num_threads = 2
    opcoes.inter_op_num_threads = 1
    return ort.InferenceSession(str(modelo), sess_options=opcoes, providers=['CPUExecutionProvider'])


def localizar_assinatura(img: Image.Image):
    sessao = _sessao()
    verticais = []
    for angulo in (0, 270, 90, 180):
        orientada = img.rotate(angulo, expand=True) if angulo else img
        rgb = Image.new('RGBA', orientada.size, 'white')
        rgb.alpha_composite(orientada)
        escala = min(640 / rgb.width, 640 / rgb.height)
        w, h = round(rgb.width * escala), round(rgb.height * escala)
        ox, oy = (640 - w) // 2, (640 - h) // 2
        quadro = Image.new('RGB', (640, 640), 'white')
        quadro.paste(rgb.convert('RGB').resize((w, h), Image.Resampling.BILINEAR), (ox, oy))
        dados = np.asarray(quadro, dtype=np.float32) / 255
        dados = (dados - np.array([.485, .456, .406], dtype=np.float32)) / np.array([.229, .224, .225], dtype=np.float32)
        dados = np.ascontiguousarray(dados.transpose(2, 0, 1)[None])
        logits, caixas = sessao.run(['logits', 'pred_boxes'], {'pixel_values': dados})
        caixas = caixas[0].copy()
        caixas[:, 0] = (caixas[:, 0] * 640 - ox) / w
        caixas[:, 1] = (caixas[:, 1] * 640 - oy) / h
        caixas[:, 2] *= 640 / w
        caixas[:, 3] *= 640 / h
        resultado = selecionar_caixa(logits[0], caixas, orientada.size)
        if resultado:
            caixa, score = resultado
            if caixa[3] - caixa[1] <= (caixa[2] - caixa[0]) * 1.2:
                return orientada, caixa, score
            verticais.append((orientada, caixa, score))
    if verticais:
        return max(verticais, key=lambda c: c[2])
    raise ErroAssinatura('Não consegui localizar uma assinatura com confiança. Envie uma foto nítida, com uma única assinatura em papel branco e sem outros textos.')
