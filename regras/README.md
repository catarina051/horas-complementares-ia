# Regras de aproveitamento

`categorias-cl2023t.json` é a única fonte das horas que a ferramenta diz que serão abatidas.
O modelo nunca calcula horas: ele só devolve a categoria do SIGAA, a variante (ex.: evento nacional,
titular) e as quantidades lidas no certificado (horas, dias, meses, semestres, anos). O nó
"Validar e calcular" do workflow aplica a fórmula e o teto daqui.

## De onde vêm os números

| O quê | Norma | Observação |
|---|---|---|
| Total de 570 h/a, 1 h/a = 50 min | Matriz CL2023T no SIGAA | Confirmado por lançamento real (abaixo); os tetos são % deste total |
| Fator, fórmula e teto de cada categoria | Resolução CGRAD 05/23, art. 3º e Anexo III | Em vigor desde 14/11/2023 |
| Prática Profissional: 60 h = 15 h/a | Resolução CGRAD 19/11, art. 15 | Teto de 50% pela CGRAD 05/23, art. 3º, IV |
| Arredondamento | CGRAD 05/23, art. 9º | Soma em h/a arredondada para o próximo inteiro |

### Por que a CGRAD 05/23 e não a 17/11

A skill original seguia a CGRAD 17/11, que a página do curso em Leopoldina ainda lista. Mas a
CGRAD 05/23 revogou expressamente a 17/11 e a CEPE 39/10 a partir de 14/11/2023 e não tem regra de
transição que preserve a tabela antiga para quem entrou antes. Os tipos que o SIGAA mostra hoje
(Livro/Capítulo, Liga Universitária, Projetos de Ensino, Empresa Júnior como itens próprios) são os
da 05/23, com o prefixo da matriz: `OUTRAS ATIVIDADES COMPLEMENTARES/(CL2023T) CURSO EXTRACURRICULAR
NA ÁREA DE CONCENTRAÇÃO DO CURSO (1.2h)`, em que "1.2h" é o fator K 1 × 1,2.

### Por que 570 h/a e não 450

A skill e o PPC v2 (2019) falam em 450 h/a para quem entrou em 2022.1. Mas um lançamento real
mostrou outra coisa: um curso de 400 h na área foi aceito com **228 h/a**. Pela regra seriam
400 × 1 × 1,2 = 480 h/a, cortados no teto de 40% da categoria, e 228 é exatamente 40% de **570**
(com 450, o teto seria 180). A matriz que vale no SIGAA é a CL2023T, com 570 h/a.

Onde as duas diferem (útil se a Coordenação questionar um lançamento antigo):

| Categoria | CGRAD 17/11 | CGRAD 05/23 |
|---|---|---|
| Congresso/encontro científico | 0,5 × 8 × dias × 1,2; teto 30% | K (1,5 / 1 / 0,5) × 9,6 × dias; teto 50% |
| Apresentação de trabalho | 12 h/a; teto 30% | K (1,5 / 1 / 0,5) × 12; teto 70% |
| Produção científica: resumo | K = 0,5 | K = 0,1 |
| Empresa Júnior | 0,36 h/a por hora, até 80 h/semestre (CGRAD 02/19) | 96 h/a por semestre |
| Lançamento no histórico | Múltiplos de 15 h/a | Próximo inteiro |

Cursos, palestras, línguas e intercâmbio de línguas têm a mesma conta nas duas.

## Tetos em h/a (570 × %)

| Teto | Categorias |
|---|---|
| 456 h/a (80%) | Iniciação Científica, Monitoria, Liga Universitária, PET com certificado final |
| 399 h/a (70%) | Produção Científica, Apresentação de Trabalhos, Patente/software, Livro/Capítulo |
| 342 h/a (60%) | Intercâmbio cultural/estudantil |
| 285 h/a (50%) | Extensão (excedente), Prática Profissional, Congresso, PET sem certificado final |
| 228 h/a (40%) | Premiação, Visita Técnica, Curso na área, Intercâmbio de línguas |
| 171 h/a (30%) | Organização de eventos, Representação, Gestão estudantil, Línguas, Palestra, Projetos de Ensino, Empresa Júnior, Outras |
| 114 h/a (20%) | Curso fora da área |

O teto é **acumulado** por categoria. A ferramenta não guarda nada, então não sabe quanto a pessoa
já lançou: a página avisa o teto para ela conferir no SIGAA.

## Sem número na norma (`status: nao_encontrado`)

- **Atividade de Extensão:** a 05/23 dá só o teto (50%) e diz que conta apenas o que exceder a carga
  obrigatória de extensão do PPC. Sem fórmula de horas.
- **Outras Atividades:** "a definir" pela Coordenação do eixo e homologado pelo Colegiado.

Nesses casos a página mostra "a confirmar com a Coordenação" em vez de um número.

## Como atualizar

1. Mudou a norma? Edite a linha da categoria, citando `norma` e `artigo`.
2. Rode `node --test tests/`: o teste confere que toda categoria do schema tem regra e que toda
   regra `confirmado` tem fonte.
3. Registre a mudança no README principal ("Onde errei e o que mudei").
