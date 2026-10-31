FROM python:3.12-slim AS detector
RUN pip install --no-cache-dir torch==2.6.0 --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir transformers==4.52.4 onnx==1.17.0
COPY exportar_detector.py /exportar_detector.py
RUN python /exportar_detector.py

FROM python:3.12-slim
# OCR local para certificados que chegam como imagem.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-por \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py atualizar_data_declaracao.py assinatura.py detector_assinatura.py ./
COPY --from=detector /modelo/assinatura.onnx /modelo/origem.json /modelo/
ENV ASSINATURA_MODELO=/modelo/assinatura.onnx
USER nobody
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"
CMD ["python", "-u", "app.py"]
