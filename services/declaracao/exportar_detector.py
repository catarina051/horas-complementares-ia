"""Prepara o detector treinado na construção da imagem, nunca durante uma requisição."""
import json
from pathlib import Path
from urllib.request import urlopen

import torch
from transformers import YolosForObjectDetection

MODELO = 'mdefrance/yolos-tiny-signature-detection'
REVISAO = 'b788cf7376464453c3dea1e5ee8589adcaa0c634'
destino = Path('/modelo')
destino.mkdir(exist_ok=True)
for nome in ('config.json', 'model.safetensors', 'preprocessor_config.json'):
    with urlopen(f'https://huggingface.co/{MODELO}/resolve/{REVISAO}/{nome}', timeout=120) as resposta:
        (destino / nome).write_bytes(resposta.read())


class Detector(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.modelo = YolosForObjectDetection.from_pretrained(destino, local_files_only=True).eval()

    def forward(self, pixel_values):
        saida = self.modelo(pixel_values=pixel_values)
        return saida.logits, saida.pred_boxes


torch.set_num_threads(2)
torch.onnx.export(Detector().eval(), (torch.zeros(1, 3, 640, 640),), destino / 'assinatura.onnx',
                  input_names=['pixel_values'], output_names=['logits', 'pred_boxes'], opset_version=17,
                  dynamo=False)
(destino / 'origem.json').write_text(json.dumps({'modelo': MODELO, 'revisao': REVISAO, 'licenca': 'Apache-2.0'}))
