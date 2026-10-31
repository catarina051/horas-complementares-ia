# Regras de aproveitamento

Estes dois arquivos são a única fonte das horas que a ferramenta diz que serão abatidas:

- [`base-cgrad-05-23.json`](base-cgrad-05-23.json): as 25 categorias da norma geral do CEFET-MG, com
  fórmula, fator K e teto em % do total. Valem para todos os cursos.
- [`cursos.json`](cursos.json): por curso, o total de horas de cada matriz, as categorias criadas pelo
  colegiado (que podem substituir uma geral), a área de concentração usada pelo modelo, o modelo de
  declaração e a marca do kit.

O modelo nunca calcula horas: ele só devolve a categoria do SIGAA, a variante (ex.: evento nacional,
titular) e as quantidades lidas no certificado (horas, dias, meses, semestres, anos, quantidade). O nó
"Validar e calcular" do workflow aplica a fórmula e o teto daqui. Regra do colegiado vale no lugar da
geral quando as duas tratam da mesma categoria.

## De onde vêm os números

| O quê | Norma | Observação |
|---|---|---|
| Fator, fórmula e teto de cada categoria geral | Resolução CGRAD 05/23, art. 3º e Anexo III | Em vigor desde 14/11/2023 |
| Prática Profissional: 60 h = 15 h/a | Resolução CGRAD 19/11, art. 15 | Teto de 50% pela CGRAD 05/23, art. 3º, IV |
| Arredondamento | CGRAD 05/23, art. 9º | Soma em h/a arredondada para o próximo inteiro |
| Eng. de Computação: total de 570 h/a | Matriz CL2023T no SIGAA | Confirmado por lançamento real (abaixo) |
| Eng. de Computação: 6 categorias próprias | Resolução CCECOMLP 06/22 | Extensão, visita técnica, monitor, avaliador, atlética, esporte |
| Controle e Automação: 240 ou 45 h/a | Página de Atividades Complementares do curso | 240 até o ingresso 2022.2; 45 a partir de 2023.1 |
| Controle e Automação: núcleo estudantil | Resolução CCECA 004/2018 | Núcleos credenciados: NRL, CREA Júnior, NUMPAI, AEE |

### Por que a CGRAD 05/23 e não a 17/11

A skill original seguia a CGRAD 17/11, que a página do curso em Leopoldina ainda lista. Mas a
CGRAD 05/23 revogou expressamente a 17/11 e a CEPE 39/10 a partir de 14/11/2023 e não tem regra de
transição que preserve a tabela antiga para quem entrou antes. A página de Controle e Automação já
marca a 17/11 como revogada. Os tipos que o SIGAA mostra hoje (Livro/Capítulo, Liga Universitária,
Projetos de Ensino, Empresa Júnior como itens próprios) são os da 05/23, com o prefixo da matriz:
`OUTRAS ATIVIDADES COMPLEMENTARES/(CL2023T) CURSO EXTRACURRICULAR NA ÁREA DE CONCENTRAÇÃO DO CURSO (1.2h)`,
em que "1.2h" é o fator K 1 × 1,2.

Onde as duas diferem (útil se a Coordenação questionar um lançamento antigo):

| Categoria | CGRAD 17/11 | CGRAD 05/23 |
|---|---|---|
| Congresso/encontro científico | 0,5 × 8 × dias × 1,2; teto 30% | K (1,5 / 1 / 0,5) × 9,6 × dias; teto 50% |
| Apresentação de trabalho | 12 h/a; teto 30% | K (1,5 / 1 / 0,5) × 12; teto 70% |
| Produção científica: resumo | K = 0,5 | K = 0,1 |
| Empresa Júnior | 0,36 h/a por hora, até 80 h/semestre (CGRAD 02/19) | 96 h/a por semestre |
| Lançamento no histórico | Múltiplos de 15 h/a | Próximo inteiro |

Cursos, palestras, línguas e intercâmbio de línguas têm a mesma conta nas duas.

### Por que 570 h/a em Eng. de Computação, e não 450

A skill e o PPC v2 (2019) falam em 450 h/a para quem entrou em 2022.1. Mas um lançamento real
mostrou outra coisa: um curso de 400 h na área foi aceito com **228 h/a**. Pela regra seriam
400 × 1 × 1,2 = 480 h/a, cortados no teto de 40% da categoria, e 228 é exatamente 40% de **570**
(com 450, o teto seria 180). A matriz que vale no SIGAA é a CL2023T, com 570 h/a.

## Tetos em h/a por matriz

| % | Eng. de Computação (570) | Controle e Automação até 2022.2 (240) | a partir de 2023.1 (45) | Categorias gerais |
|---|---|---|---|---|
| 80% | 456 | 192 | 36 | Iniciação Científica, Monitoria, Liga Universitária, PET com certificado final |
| 70% | 399 | 168 | 31,5 | Produção Científica, Apresentação de Trabalhos, Patente/software, Livro/Capítulo |
| 60% | 342 | 144 | 27 | Intercâmbio cultural/estudantil |
| 50% | 285 | 120 | 22,5 | Extensão, Prática Profissional, Congresso, PET sem certificado final |
| 40% | 228 | 96 | 18 | Premiação, Visita Técnica, Curso na área, Intercâmbio de línguas |
| 30% | 171 | 72 | 13,5 | Organização de eventos, Representação, Gestão estudantil, Línguas, Palestra, Projetos de Ensino, Empresa Júnior, Outras |
| 20% | 114 | 48 | 9 | Curso fora da área |

Categorias dos colegiados: em Eng. de Computação, extensão 50%, esporte 20% e as demais 30%; em
Controle e Automação, núcleo estudantil 30%.

O teto é **acumulado** por categoria. A ferramenta não guarda nada, então não sabe quanto a pessoa
já lançou: a página avisa o teto para ela conferir no SIGAA.

## Sem número na norma (`status: nao_encontrado`)

- **Atividade de Extensão (Controle e Automação):** a 05/23 dá só o teto (50%) e diz que conta apenas
  o que exceder a carga obrigatória de extensão do PPC. Em Eng. de Computação o colegiado definiu
  120 h/a por semestre.
- **Outras Atividades:** "a definir" pela Coordenação do eixo e homologado pelo Colegiado.

Nesses casos a página mostra "a confirmar com a Coordenação" em vez de um número.

## Como atualizar

1. Mudou a norma geral? Edite a linha em `base-cgrad-05-23.json`. Mudou algo do curso (total, nova
   resolução do colegiado)? Edite `cursos.json`. Sempre citando `norma` e `artigo`.
2. Categoria nova? Rode `python` com o trecho de geração do schema, ou acrescente o rótulo ao enum de
   `prompts/classificacao/schema.json`, e descreva-a no prompt.
3. Rode `node --test tests/*.test.mjs`: os testes conferem schema × regras, fontes e os totais.
4. Registre a mudança no README principal ("Onde errei e o que mudei").
