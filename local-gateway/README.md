# Fazenda 2E — Gateway Local

Objetivo: controlar e ler os dispositivos Tuya da Fazenda 2E pela rede local, sem depender do plano pago do IoT Core.

## Etapa 1 — descobrir IP e protocolo

No computador conectado ao mesmo Wi‑Fi dos equipamentos:

1. Instale Python 3.
2. Abra o terminal nesta pasta.
3. Execute:

   pip install -r requirements.txt
   python discover.py

O script é somente leitura e não aciona irrigação.

## Etapa 2 — obter Local Key

Para controle local são necessários:
- Device ID
- IP local
- Local Key
- versão do protocolo (3.1 a 3.5)

A Local Key pode ser obtida uma vez e depois guardada somente no gateway local. Não salve chaves reais no GitHub.

Se o projeto Tuya Developer estiver sem IoT Core, uma alternativa é usar um utilitário local com login por QR do Smart Life para obter as chaves. Faça isso somente no computador da fazenda.

## Etapa 3 — testar leitura local

Copie config.example.json para config.json e preencha os dados reais localmente.

Nunca envie config.json para o GitHub.

Execute:

   python probe.py

Se os três equipamentos responderem, podemos avançar para o gateway definitivo.

## Arquitetura final

App Fazenda 2E / Railway
        |
        | HTTPS autenticado
        v
Gateway local na fazenda
        |
        | LAN / Wi‑Fi (protocolo Tuya local)
        +--> EKAZA Viveiro
        +--> INKBIRD Café
        +--> Weather2-2

O gateway fará conexão de saída com o servidor, evitando abrir portas no roteador.

## Segurança

- O gateway deve funcionar por leitura local antes de qualquer comando físico.
- Local Keys ficam apenas no equipamento local.
- Nunca armazenar Local Keys, tokens ou senhas no repositório.
- O primeiro teste de comando será feito em modo controlado e com confirmação explícita.
