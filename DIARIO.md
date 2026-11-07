# DIARIO — Horas Complementares com IA

Registro de autoria: o que a Catarina decidiu e fez, e o que a IA fez. Uma entrada por sessão de trabalho.
As entradas de 31/10 a 05/11/2026 foram reconstruídas em 07/11/2026 a partir das conversas daqueles dias, e cada
decisão tem uma frase dela como evidência. Os trechos de "Aprendizado" foram redigidos a partir das conversas.

## 2026-10-31 · 12:25 a 15:12 (trecho recuperado das conversas)
**Catarina decidiu:**
- Comecei pelo plano de portfólio e escolhi o Gemini Flash gratuito, com o resultado na tela do formulário.
- Rejeitei o primeiro plano e ampliei o escopo: a IA também deveria preencher a declaração com os dados do aluno, anexar a assinatura e devolver o resultado final ("seria legal se a IA tambem preenchesse o comprovante com os dados do aluno, anexasse a assinatura"). Rejeitei de novo para exigir que o sistema devolvesse as horas abatidas pela categoria e qual categoria marcar no SIGAA.
- Escolhi o "kit pessoal, sem guardar nada" para a declaração, a norma CGRAD 05/23, OCR local com anonimização e o modelo de declaração 04/22 da página do curso.
- Aprovei criar o repositório público e subir os commits.
- Trouxe um caso real já homologado ("esse pdf ja foi valido e foi cadastrado em: OUTRAS ATIVIDADES COMPLEMENTARES/(CL2023T) CURSO EXTRACURRICULAR NA ÁREA DE CONCENTRAÇÃO DO CURSO (1.2h)").
- Dei dois retornos de produto: faltava dizer o código da opção do SIGAA ("tem varios codigos de opções no sigaa") e a assinatura precisava de recorte.
**Catarina fez:** Entrei no GitHub no navegador embutido para a IA criar o repositório. Criei e colei a chave do Gemini no `.env` (a primeira falhou porque o projeto do Google Cloud estava suspenso; a segunda funcionou). Enviei o PDF real homologado, baixei de novo o que veio com 0 bytes e enviei a declaração original. Testei o formulário, relatei o erro (era um bloqueio do navegador embutido) e abri a tela do SIGAA para a IA ler a lista de tipos.
**A IA fez:** Implementou o piloto: workflow n8n com classificação por Gemini, OCR local com Tesseract antes da anonimização, tabela de categorias do CL2023T, declaração preenchida com a assinatura recortada e subida em commits pequenos.
**Onde a IA errou e como foi corrigido:**
- A IA recomendou a matriz antiga de 450 h/a, e eu aceitei a recomendação. O certificado real mostrou o erro: 228 h aceitas são 40% de 570 h/a. O total foi corrigido para 570, a tabela passou a se chamar `categorias-cl2023t.json` e entrou um teste de regressão com o caso real (400 h de curso viram 228 h/a).
- O sistema respondia "não é certificado" porque o certificado do PDF estava colado como figura; foi corrigido com OCR.
- O anonimizador trocava o nome da instituição por `[ALUNO]` quando ele continha uma palavra igual a um sobrenome; passou a trocar só o nome completo.
- O modelo `gemini-flash-latest` ficou mais de 110 s sem responder; foi fixado `gemini-3.5-flash-lite` e o tempo limite caiu de 90 s para 45 s.
**Aprendizado:** Aprendi a trazer um caso real cedo: o certificado já homologado mostrou que a norma tinha 570 h/a, e não 450. E aprendi a não aceitar a opção recomendada sem conferir contra um dado meu.

## 2026-11-04 · 15:26 a 20:55 (trecho recuperado das conversas)
**Catarina decidiu:**
- Pedi uma revisão do GitHub e dos commits e um roteiro de vídeo de demonstração.
- Mantive o Gemini, mas pedi uma explicação de segurança para o usuário e uma opção manual para quem não quisesse enviar a assinatura a um modelo de IA ("mantenha o germini mas adicione uma explicação de segurança").
- Mandei apagar o detector que não era usado, quebrar o commit grande em commits menores e resolver o que pudesse quebrar o sistema, e pedi uma auditoria de segurança com um agente.
- Aprovei reescrever o histórico (push forçado), pedi para atualizar o README e pedi um teleprompter para ler o roteiro enquanto gravo.
**Catarina fez:** Rodei o deploy na VM da AWS (`deploy/atualizar.sh`); a IA conferiu a produção só com leituras.
**A IA fez:** Corrigiu o recorte da assinatura, criou a escolha "Com IA (Gemini)" ou "Manual, sem IA", removeu o detector, reorganizou o histórico em 16 commits, fez a auditoria de segurança, atualizou o README e montou o teleprompter.
**Onde a IA errou e como foi corrigido:**
- O recorte da assinatura incluía a mesa de madeira da foto; foi corrigido recortando a folha primeiro.
- O README dizia que a assinatura e a declaração eram processadas localmente, mas o workflow chamava a IA; o texto foi corrigido e nasceu a escolha Com IA/Manual.
- A auditoria achou que a produção rodava uma versão em que a foto da assinatura ia ao Gemini sem opção e sem anonimizar, e que restos de CPF e RG ficavam em linhas apagadas do banco do n8n. Os arquivos de execução passaram a ficar em memória, o banco é compactado a cada subida e os backups do volume são apagados depois do deploy.
- Os scripts de implantação falharam várias vezes por um caractere `\r` invisível e por um problema do `curl` dentro do `sh`.
- Pendência declarada: as rotas públicas ainda não têm limite de taxa, e a IA não testou um envio completo em produção para não mandar dados ao Gemini por mim.
**Aprendizado:** Aprendi a tratar privacidade como requisito e não como detalhe: anonimizar, tornar a assinatura opcional e escrever no README só o que de fato acontece com os dados. Aprendi a auditar antes de pôr em produção, porque a auditoria achou o que eu não tinha visto.

## 2026-11-04 a 2026-11-05 · 20:56 a 00:41 (vídeo de demonstração, trecho recuperado das conversas)
**Catarina decidiu:** Pedi um vídeo com motion design a partir do roteiro, em 16:9, com os takes que gravei. Mandei fazer um certificado de teste e gravar a tela do n8n. Quando o vídeo travou e as cenas não tinham transição, mandei apagar tudo e reconstruir ("apaga tudo e faz de novo. o fps esta baixissimo") e aprovei o render ("Pode renderizar").
**Catarina fez:** Gravei os sete blocos de fala e a demonstração em tela (1 min 42 s), fiz a assinatura fictícia, criei a conta de dono do n8n local e deixei uma janela do Edge logada para a gravação do canvas.
**A IA fez:** Montou o vídeo e gerou `horas-complementares-ia-1080p.mp4` (1920x1080, 30 fps, 1 min 51 s) e a capa.
**Onde a IA errou e como foi corrigido:** A primeira gravação do canvas saiu parada; o canvas do n8n perdeu e repetiu quadros; a conversão de 29,4 para 30 fps repetia um quadro a cada 1,77 s; as transições de 0,3 s passavam despercebidas e foram para 0,7 s. A IA atribuiu o fps baixo ao upscaling de 720p para 1080p e reconstruiu as mídias dos originais; depois, ao meu "o fps continua ruim", atribuiu a lentidão ao editor. Não confirmei por escrito que o vídeo final saiu fluido.
**Aprendizado:** Aprendi que fluidez de vídeo só se confirma assistindo, e que reconstruir a partir dos originais resolve mais do que remendar. Também aprendi a pedir revisão minha em vez de varredura quadro a quadro.

## 2026-11-07 · mesma sessão do Termômetro (13:45 a 17:01)
**Catarina decidiu:** usar "menos de 2 minutos" como teto do tempo na ferramenta, já que os 5 certificados não foram cronometrados um a um; mostrar a projeção de economia como estimativa, com a conta visível, e não como medição.
**Catarina fez:** testou 5 certificados reais e conferiu a categoria de cada um (5 de 5 corretas). Informou os dados que sustentam a projeção: cerca de 300 pedidos de atividade complementar por semestre, cerca de 560 alunos ativos, e os links dos vídeos.
**A IA fez:** reescreveu no `README.md` o estado atual (5 certificados, menos de 2 min, 5 de 5), acrescentou o link do vídeo no topo e uma seção com a tabela de medidas, a fonte de cada número e a conta da projeção (19 min 49 s por pedido, cerca de 99 h por semestre, cerca de 198 h por ano como teto teórico). Substituiu a frase "Ainda não há taxa de acerto nem volume de usuários publicados" por números e pela ressalva de que a adesão real ainda não foi medida. Acrescentou, no fim do README, a linha com o histórico de commits do código (26 commits, de 31/10/2026 a 04/11/2026, 5 dias corridos), contada com `git log` antes da atualização de 07/11.
**Onde a IA errou e como foi corrigido:** a IA leu "entorno de 300 para entorno de 560 alunos ativos" como 300 pedidos por *ano* e calculou cerca de 99 h por ano. A Catarina explicou que são 300 pedidos por *semestre*; a projeção foi refeita (cerca de 99 h por semestre, cerca de 198 h por ano). Observação de cautela da IA: só foi informado que a Catarina conferiu a categoria, não que a Coordenação homologou; por isso o README diz "conferida pela autora" e "amostra pequena, testes da autora". A afirmação de que o PDF e a assinatura também estavam corretos nos 5 não foi repetida na resposta de hoje e ficou de fora.
**Aprendizado:** Aprendi a calcular uma projeção com limite conservador (2 minutos como teto do tempo na ferramenta, o que dá um piso de economia) e a dizer que ela é um teto teórico porque supõe adesão de 100%. Aprendi a conferir o que cada número significa antes de calcular: "300 para 560" eram 300 pedidos por semestre, e não por ano, o que dobrava a conta anual. E aprendi a não chamar de "acerto" o que só eu conferi: o README diz que as 5 categorias foram conferidas pela autora, numa amostra pequena.

**O que não está registrado aqui:** entre 31/10 às 15:12 e 04/11 às 15:26 (escolha da AWS e implantação do piloto, suporte ao curso de Controle e Automação, mapeamento dos códigos do SIGAA, testes com 4 certificados e 3 fotos de assinatura, medição do tempo manual e convite aos colegas) não recuperei as conversas. Depois de 05/11 às 00:41, também não.
