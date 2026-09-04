# Backend Tuya para o viveiro

O frontend em GitHub Pages não deve armazenar o Access Secret da Tuya. Este repositório inclui duas funções serverless compatíveis com Vercel:

- `GET /api/status`: consulta o estado atual do EKAZA.
- `POST /api/switch`: envia `switch_1` com `{"on": true}` ou `{"on": false}`.

## Variáveis de ambiente

Configure no provedor do backend:

- `TUYA_BASE_URL=https://openapi.tuyaus.com`
- `TUYA_ACCESS_ID=<Access ID do projeto Tuya>`
- `TUYA_ACCESS_SECRET=<Access Secret do projeto Tuya>`
- `TUYA_DEVICE_ID=<Device ID do EKAZA>`
- `APP_CONTROL_TOKEN=<token longo e aleatório criado pelo proprietário>`

Nunca publique `TUYA_ACCESS_SECRET` ou `APP_CONTROL_TOKEN` no repositório.

## Deploy sugerido

1. Importe este repositório na Vercel.
2. Adicione as variáveis de ambiente acima.
3. Faça o deploy.
4. No painel do viveiro, abra **Configurar**.
5. Informe a URL do deploy e o mesmo `APP_CONTROL_TOKEN`.
6. Use **Atualizar** primeiro para confirmar a leitura do estado real.

O ciclo `cycle_time` existente no EKAZA não é alterado nesta versão.
