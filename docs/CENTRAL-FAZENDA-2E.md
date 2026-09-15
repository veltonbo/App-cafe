# Fazenda 2E — Central da Fazenda

## Objetivo
Evoluir o Fazenda 2E para uma central única de gestão da propriedade sem substituir nem enfraquecer o sistema operacional existente.

## Regra de segurança
O **Automático 4.0 continua sendo o único controlador físico da irrigação**. Os novos módulos são de gestão, visualização, histórico, diagnóstico e inteligência consultiva, salvo uma mudança futura explicitamente validada.

## Estrutura planejada

### Central
Painel inicial com clima, irrigação, alertas, tarefas, situação das áreas e ocorrências.

### Mapa da propriedade
Talhões e setores clicáveis, com variedade, quantidade de plantas, idade, irrigação, aplicações, custos, fotos e tarefas.

### Irrigação
Preserva Automático 4.0, Histórico 3.x, Inteligência 4.2, diagnóstico, auditoria e integrações existentes.

### Viveiro
Canteiros, clones, capacidade, plantio, perdas, estoque e saída de mudas.

### Manejo
Adubação, fertirrigação, pulverizações, produtos, doses, custos e histórico por área.

### Pragas e doenças
Ocorrências por área/data, fotos, acompanhamento e histórico de manejo.

### Financeiro rural
Receitas, despesas, estoque de café, custos por área e indicadores de produção.

### Máquinas e equipamentos
Bombas, motores, filtros, veículos, manutenção e ocorrências.

### Câmeras
Central de visualização independente da irrigação, preservando o trabalho experimental já existente para Yoosee/iCSee.

### Assistente Fazenda 2E
Entrada em linguagem natural para ajudar a consultar e registrar operações, sempre exigindo confirmação apropriada antes de ações críticas.

## Estratégia de implantação
1. Não alterar produção diretamente.
2. Desenvolver em branch isolada.
3. Preservar os módulos atuais antes de reorganizar a navegação.
4. Implantar primeiro a Central e o modelo de Talhões/Setores.
5. Conectar módulos existentes gradualmente.
6. Validar regressão do Automático 4.0 e Histórico antes de publicação.

## Estado de partida
A branch foi criada a partir do commit `a5dd72fa52ba5169e95f4bd32d81588f7481575c`, versão Fazenda 2E 4.2 validada e integrada à `main` em 14/09/2026.
