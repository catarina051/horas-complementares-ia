# Regras e opções do SIGAA

- `base-cgrad-05-23.json`: fórmulas, fatores e tetos da norma geral.
- `cursos.json`: totais por PPC, categorias do colegiado, modelos de declaração e códigos do SIGAA.
- `tipos-sigaa.json`: rótulos visíveis das capturas do usuário, por matriz, categoria e variante.

O modelo escolhe categoria, variante e quantidades. O nó “Validar e calcular” faz as contas e
resolve o código/opção do catálogo. O valor entre parênteses no rótulo do SIGAA é mantido como
texto: não é usado como fórmula, pois pode estar limitado pelo teto da matriz.

## Matrizes confirmadas no SIGAA (3 situações por curso)

| Curso | 1. Ingressou desde 2023.1 (Grade nova) | 2. Ingressou antes e MIGROU para a nova | 3. Ingressou até 2022.2 (Grade antiga, não migrou) |
|---|---|---|---|
| **Computação** | `ECL2023`, 135 h/a | `CL2023T`, 570 h/a | `ECOM32`, 450 h/a |
| **Controle e Automação** | `CAU2023`, 45 h/a | `CA2023T`, 240 h/a | `7878 / ECA2021`, 240 h/a |

Fontes primárias:

- [SIGAA público de Computação](https://www.sig.cefetmg.br/sigaa/public/curso/curriculo.jsf?id=6207540&lc=pt_BR): ECL2023 e ECOM32 ativas; CL2023T matriz de transição dos alunos que migraram.
- [PPC de Computação de 2024](https://www.eng-computacao.leopoldina.cefetmg.br/wp-content/uploads/sites/178/2024/07/PPCEngComp-v20240719.pdf), Quadro 13: AC 135 h/a e extensão 435 h/a para ingressantes novos.
- [Atividades Complementares de Computação, PPC anterior](https://www.eng-computacao.leopoldina.cefetmg.br/aluno/atividades-complementares/): 450 h/a.
- [Deliberação CCECOMLP 06/23](https://www.eng-computacao.leopoldina.cefetmg.br/wp-content/uploads/sites/178/2023/11/DELIBERAO_CCECOMLP__06-23_DE_22_DE_NOVEMBRO_DE_2023_E_ANEXO_II.pdf-1.pdf): ECOM3-2 (2019.2), ECL2023 (2023.1) e transição CL2023T.
- [SIGAA público de Controle](https://sig.cefetmg.br/sigaa/public/curso/curriculo.jsf?id=318&lc=pt_BR): CA2023T transição; CAU2023, ECA2021 e 7878 ativas.
- [Atividades Complementares de Controle](https://www.eng-controleautomacao.leopoldina.cefetmg.br/atividades-complementares/): 240 h/a até 2022.2 e 45 h/a desde 2023.1.
- [Ata da 25ª reunião do Colegiado de Controle](https://www.eng-controleautomacao.leopoldina.cefetmg.br/wp-content/uploads/sites/196/2024/04/ata25.pdf), item 5: ingressantes de 2023 na CAU2023 e critérios de migração.

As matrizes de transição (`CL2023T` e `CA2023T`) aparecem como inativas para novas matrículas
no portal público porque nenhum calouro ingressa diretamente nelas via vestibular/SISU. Porém,
elas estão 100% ativas para os alunos veteranos que migraram para o novo PPC. No SIGAA desses
alunos, as opções de atividades complementares carregam o código da transição (ex.: `(CL2023T)`).

## Tetos em h/a das regras existentes

| Percentual | Computação antiga (450) | Computação transição (570) | Computação nova (135) | Controle antigo/transição (240) | Controle novo (45) |
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
