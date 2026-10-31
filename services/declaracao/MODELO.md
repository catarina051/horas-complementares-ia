# Detector local de assinaturas

- Modelo: [mdefrance/yolos-tiny-signature-detection](https://huggingface.co/mdefrance/yolos-tiny-signature-detection).
- Revisão fixa: `b788cf7376464453c3dea1e5ee8589adcaa0c634`.
- Licença dos pesos: [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0).
- `exportar_detector.py` baixa somente configuração e safetensors e exporta o modelo para ONNX no build.
- O runtime carrega os pesos locais uma vez e executa inferência em CPU, com telemetria desabilitada.
- Entradas são normalizadas e preenchidas em branco até 640x640, preservando proporção; as caixas
  são convertidas para coordenadas da foto. EXIF é aplicado antes da detecção.
- A detecção usa limiar de 0,60, remove caixas duplicadas e une regiões alinhadas de nome/sobrenome.
  Se necessário, tenta rotações. Regiões independentes ou ausência de confiança geram erro para o aluno.
- A caixa é uma semente para agrupar traços próximos no mesmo papel, incluindo pontos e acentos;
  não é um recorte com coordenadas fixas. PNGs transparentes também passam pela detecção.
- A detecção identifica a região da assinatura; não verifica identidade ou autenticidade.

Não existe garantia para toda fotografia: desfoque, fundos complexos, múltiplas assinaturas e texto
misturado podem exigir uma foto mais próxima. O sistema rejeita casos sem confiança suficiente em
vez de inserir a fotografia inteira. A declaração-base reutilizada preserva o recorte de quando foi
gerada; para corrigir uma base antiga, gere uma nova no modo de primeiro uso.

Validação de 31/10/2026: testes sintéticos de cores, transparência, pontos/acentos e bordas; foto
enviada pelo usuário com sombra/inclinação/rotação; e duas assinaturas públicas diferentes usadas
apenas como QA, fora do repositório:
[AH-Signature (CC0)](https://commons.wikimedia.org/wiki/File:AH-Signature.png) e
[PWSig por Kappasi (CC BY-SA 4.0)](https://commons.wikimedia.org/wiki/File:PWSig.png).
