# Fazenda 2E — suíte de produção minimalista
A interface antiga foi aposentada em 2026-09-28. Testes que validavam menus, painéis e módulos removidos permanecem no histórico do repositório, mas não definem o contrato da UI atual.
Contrato atual: tests/minimal-ui-v1.test.js.
A segurança física continua validada pelos testes de backend, interlocks, watchdog, chuva, sessão e RBAC.
Testes físicos de relés, válvulas e bomba exigem execução controlada no campo e não fazem parte do deploy remoto.
