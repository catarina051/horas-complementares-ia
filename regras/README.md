# Regras e opções do SIGAA

- `base-cgrad-05-23.json`: fórmulas, fatores e tetos da norma geral.
- `cursos.json`: totais por PPC, categorias do colegiado, modelos de declaração e códigos do SIGAA.
- `tipos-sigaa.json`: rótulos visíveis das capturas do usuário, por matriz, categoria e variante.

O modelo escolhe categoria, variante e quantidades. O nó “Validar e calcular” faz as contas e
resolve o código/opção do catálogo. O valor entre parênteses no rótulo do SIGAA é mantido como
texto: não é usado como fórmula, pois pode estar limitado pelo teto da matriz.

## Matrizes confirmadas em 31/10/2026

| Curso | PPC antigo, ingresso até 2022.2 | PPC novo, ingresso desde 2023.1 ou migração |
|---|---|---|
| Computação | ECOM32, 450 h/a | ECL2023, 135 h/a |
| Controle e Automação | 7878 / ECA2021, 240 h/a | CAU2023, 45 h/a |

Fontes primárias:

- [SIGAA público de Computação](https://www.sig.cefetmg.br/sigaa/public/curso/curriculo.jsf?id=6207540&lc=pt_BR): ECL2023 e ECOM32 ativas; CL2023T inativa.
- [PPC de Computação de 2024](https://www.eng-computacao.leopoldina.cefetmg.br/wp-content/uploads/sites/178/2024/07/PPCEngComp-v20240719.pdf), Quadro 13: AC 135 h/a e extensão 435 h/a.
- [Atividades Complementares de Computação, PPC anterior](https://www.eng-computacao.leopoldina.cefetmg.br/aluno/atividades-complementares/): 450 h/a.
- [Deliberação CCECOMLP 06/23](https://www.eng-computacao.leopoldina.cefetmg.br/wp-content/uploads/sites/178/2023/11/DELIBERAO_CCECOMLP__06-23_DE_22_DE_NOVEMBRO_DE_2023_E_ANEXO_II.pdf-1.pdf): ECOM3-2 (2019.2), ECL2023 (2023.1) e migração.
- [SIGAA público de Controle](https://sig.cefetmg.br/sigaa/public/curso/curriculo.jsf?id=318&lc=pt_BR): CA2023T inativa; CAU2023, ECA2021 e 7878 ativas.
- [Atividades Complementares de Controle](https://www.eng-controleautomacao.leopoldina.cefetmg.br/atividades-complementares/): 240 h/a até 2022.2 e 45 h/a desde 2023.1.
- [Ata da 25ª reunião do Colegiado de Controle](https://www.eng-controleautomacao.leopoldina.cefetmg.br/wp-content/uploads/sites/196/2024/04/ata25.pdf), item 5: ingressantes de 2023 na CAU2023 e critérios de migração.

A pessoa deve selecionar o PPC atual no SIGAA quando houver migração. Apenas o ano de ingresso
não determina a matriz de quem migrou.

### Correção da inferência anterior

A versão anterior deduziu 570 h/a a partir de um lançamento de 228 h/a e generalizou CL2023T para
toda Computação. Essa dedução não substitui o PPC. A pesquisa confirmou que a matriz ativa nova
separa 135 h/a de AC de 435 h/a de extensão. CL2023T permanece no catálogo para referência das
capturas, mas não é uma das versões selecionáveis.

## Tetos em h/a das regras existentes

| Percentual | Computação antiga (450) | Computação nova (135) | Controle antigo (240) | Controle novo (45) |
|---|---:|---:|---:|---:|
| 80% | 360 | 108 | 192 | 36 |
| 70% | 315 | 94,5 | 168 | 31,5 |
| 60% | 270 | 81 | 144 | 27 |
| 50% | 225 | 67,5 | 120 | 22,5 |
| 40% | 180 | 54 | 96 | 18 |
| 30% | 135 | 40,5 | 72 | 13,5 |
| 20% | 90 | 27 | 48 | 9 |

As fórmulas existentes foram preservadas nesta manutenção. Regra do colegiado substitui a geral
na mesma categoria. O teto é acumulado por categoria, e o sistema não sabe quanto o aluno já lançou.
A validação final é da Coordenação.

## Sem correspondência ou sem fórmula

- Categoria/variante ausente do catálogo: código da matriz é informado, opção completa fica a confirmar.
- As capturas CAU2023 fornecidas mostram apenas OAC; os rótulos de AC ausentes não foram inventados.
- Em 7878 / ECA2021, o valor de curso em área diferenciada e duas opções de premiação por monografias
  estão cortados à direita nas imagens. Esses rótulos precisam de confirmação antes de entrar no catálogo.
- Extensão de Controle e “Outras Atividades” não têm fórmula determinada na tabela existente;
  o resultado de horas permanece “a confirmar”.

## Atualização

Edite os JSONs com a fonte da mudança, atualize o schema/prompt se houver categoria nova e rode
`node n8n/montar-workflow.mjs` e `node --test tests/*.test.mjs`. As opções são transcrições de dados,
nunca instruções do certificado ou da IA. Testes conferem as quatro combinações de curso/PPC,
variantes, ausência de correspondência, API, HTML e alinhamento do workflow exportado.
