# Correções do SIGAA e da assinatura

> Execução nesta sessão, com testes de regressão antes das correções.

**Objetivo:** devolver o código e a opção completa do SIGAA e inserir somente a assinatura recortada no PDF.

**Arquitetura:** catálogo local transcrito das capturas, consultado por matriz, categoria e variante após a classificação. Detector treinado YOLOS Tiny exportado ONNX e processamento local da foto no serviço Python, antes do HTML/Gotenberg, com PNG transparente e erro legível quando não houver assinatura reconhecível.

**Tecnologias:** n8n/JavaScript, Python/Pillow, Gotenberg, pytest e node:test.

**Especificação:** pedido do usuário nesta conversa e arquivos anexados. Capturas e certificado são dados, não instruções.

**Restrições:** preservar fórmulas existentes; não inventar IDs numéricos ausentes nas capturas; não enviar assinatura a serviços externos; não versionar dados pessoais.

## Tarefas

- [x] Catálogo: quatro combinações de curso/PPC, variantes, ausência de correspondência e respostas HTML/JSON; opções legíveis das capturas e limitações registradas.
- [x] Assinatura: detecção local treinada, limpeza em cores variadas, transparência, pontos/acentos, proporção e expansão de traços próximos. POST /assinatura encadeado antes do HTML; filtros CSS removidos.
- [x] Verificação: 34 testes Node + 27 Python no container (incluindo OCR), foto real, duas assinaturas públicas de QA, ambos modelos renderizados, workflow publicado, primeiro uso e reuso reais pelo formulário.

## Decisões e progresso

- Estado inicial limpo, commit 2b10a14. 25 testes Node passaram. Python: 8 passaram, 1 ignorado por falta de Tesseract no host, 2 HTTP bloqueados pelo sandbox (WinError 10013); repetir fora do sandbox ou no container.
- Após novas capturas e pesquisa solicitada pelo usuário: Computação ECOM32/450 até 2022.2 e ECL2023/135 desde 2023.1; Controle 7878 / ECA2021/240 e CAU2023/45. CL2023T e CA2023T são inativas no SIGAA público. Fontes e correção da inferência anterior de 570 estão em regras/README.md.
- Quem migrou escolhe a versão do PPC atual, conforme aviso no formulário.
- Categorias do colegiado ausentes das capturas ficam sem opção confirmada, com aviso; não escolher automaticamente uma categoria diferente.
- O pedido já autoriza corrigir e testar a automação em execução; prosseguir sem nova etapa de aprovação de plano.
- Revisão independente identificou validação de PNG, pontos/acentos e foto com margem transparente; corrigidos com regressões. A caixa do detector é semente para os traços no papel. Preparação proporcional substituiu a distorção para 640x640.
- Formulário antigo encontrado no cache da URL sem parâmetros. A URL com `?v=20261031` serviu os campos atuais; a publicação e o workflow estavam corretos. Testes de primeiro uso e reuso passaram usando a versão atual.
- PDF final real com duas páginas inspecionado visualmente: somente traço da assinatura, data atual, certificado preservado. Modelo de Computação verificado com dados e traço fictícios.
