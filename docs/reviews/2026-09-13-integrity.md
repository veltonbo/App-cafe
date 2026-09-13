# Revisão de integridade — Viveiro / Fazenda 2E

Base: main 992550c, Automático 4.0, 13/09/2026.

## Evidência de produção (somente leitura)

- Oracle respondeu; um container ativo `fazenda2e-irrigacao:20260913-120735`, com processo Node e motor Python. A presença de Python é parte da autorização e proteção dos pulsos, não um segundo controlador climático.
- `/api/viveiro/seconds`: HTTP 200 em 48 ms, `enabled=false`, `phase=emergency_stopped`, relé desligado.
- `/api/viveiro/dashboard`: HTTP 200 em 1455 ms; emergência confirmada. Leitura climática exibida com 56 minutos de idade, embora serviço aparecesse online; alerta ainda citava o Automático 2.0.
- Seleção persistida: Viveiro 2E, `eb989d2fa3ffb1576f99jm`.
- Não houve comando de ligar, liberação da emergência, troca do aparelho nem alteração de configuração de produção nesta revisão.

## Problemas corrigidos nesta branch

| Área | Problema | Correção |
|---|---|---|
| Build | main falhava em 1 dos 81 testes originais; servidor compactado incompatível com patches e script com template inválido | Fonte patchável restaurada preservando rota de preview; script corrigido; validação sintática de todos os scripts |
| Memória | Cache histórico sem limite e criação repetida de formatadores de data | Cache limitado e formatadores reutilizados |
| Conexão | Dados antigos podiam manter indicação positiva de conexão | Expiração, falha e recuperação explícitas, sem apagar o último dado |
| Informação | Valores nulos convertidos em zero e horário do celular usado na exibição | Ausência de leitura preservada; horário da fazenda |
| Clima 4.0 | Sensor offline, valores vazios e relógio futuro podiam ser considerados leitura utilizável | Decisão aguarda dados válidos; confiança usa o instante da avaliação |
| Concorrência | Consulta climática assíncrona podia continuar a atualizar a fase após desativação | Revalidação de `enabled` após a consulta; teste com emergência durante o await |
| Seletor EKAZA | Rotina adicionada fora do escopo de autenticação/toast; URL separada da conexão configurada | Inserção no escopo principal e reutilização da função comum de API |
| Seleção do relé | Configuração corrompida caía silenciosamente na seleção automática; ID por ambiente ignorado; relés sem relação com viveiro eram candidatos | Falha explícita; ID respeitado; candidatos restritos; nomes escapados no HTML |
| Troca de aparelho | Endpoint permitia selecionar/limpar vínculo com automático ativo | Exige emergência persistida e controlador desativado; consulta de teste continua somente leitura |
| Dashboard | Snapshot persistido não acompanhava o monitor durante emergência; serviço online com dado antigo; alerta do controlador aposentado | Reutiliza cache climático já coletado pelo monitor, sem nova chamada; estado stale explícito; saúde considera 4.0 e pausa legítima |
| Interface | Textos de modo sombra, espera climática sem rótulo e horário interno tratado como confirmação do relé | Textos atualizados, fase de espera identificada e confirmação baseada em evidência |
| Duplicidade | 368 arquivos de node_modules versionados, seis arquivos de frontend antigo e patch v8 substituído | Removidos do repositório; frontend canônico em public/irrigacao; npm ci com lockfile |
| Empacotamento | Arquivos de ambiente podiam entrar no contexto Docker | Exclusões de ambiente, builds, caches e bytecode |
| CI | Workflow não executava em PR e testes não cobriam interface final | CI em PR; testes do artefato final incorporados ao Dockerfile |

## Validação

- 115 testes do código-fonte aprovados.
- 25 testes da interface e runtime gerados aprovados: 20 de conexão/fases e cinco de integridade dos artefatos.
- Pipeline completo de transformações runtime/UI e build Vite executado em diretório isolado, com instalação limpa por lockfile.
- Sintaxe dos quatro módulos Python verificada.
- npm audit: zero vulnerabilidades reportadas.
- IDs do HTML final sem duplicação; uma navegação principal; apenas chamada do controlador climático 4.0 no loop final.
- Build local executado com Node 24; CI/Docker usam Node 22. A imagem Docker completa e execução física não foram validadas nesta branch.

## Limites e acompanhamento

- Correções preparadas no repositório; produção não alterada. O host tem mudanças locais e uma imagem recente: reconciliar esse estado antes de publicar, sem sobrescrever o trabalho existente.
- O preview React continua separado do caminho de produção e não foi submetido nesta rodada à mesma cobertura da interface publicada. As melhorias de React da PR #56 não devem ser confundidas com publicação da interface atual.
- A aplicação Café na raiz, Firebase externo, entrega real de notificações, todos os navegadores e perda real de rede/energia exigem validação própria. Estes testes não certificam todas essas condições.
- O vercel.json ainda contém destino Railway legado; confirmar se existe frontend Vercel ativo antes de trocar o destino.
- Permanecem scripts de transformação utilizados pelo Docker. Removê-los em massa impediria gerar o controlador. A consolidação em fonte única deve ser uma migração separada, preservando as verificações do artefato.
- Emergência permanece ativa. Qualquer teste físico posterior precisa de acompanhamento junto à bomba.
