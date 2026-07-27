# Backend público de agendamento — Fase 9B-0B

Base **não publicada** para consultar duas agendas e persistir pré-solicitações na planilha administrativa. Não há IDs, credenciais, URL `/exec` ou contatos reais no repositório; o site permanece em demonstração.

## Script Properties

As propriedades obrigatórias são `AVAILABILITY_CALENDAR_ID`, `APPOINTMENTS_CALENDAR_ID`, `SPREADSHEET_ID`, `TIMEZONE`, `SLOT_INTERVAL_MINUTES`, `AVAILABILITY_EVENT_PREFIX`, `ALLOWED_SERVICE_IDS_JSON`, `WHATSAPP_NUMBER`, `PRIVACY_POLICY_VERSION`, `MAX_REQUEST_BYTES`, `RATE_LIMIT_WINDOW_MINUTES`, `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_SALT`, `NOTIFICATION_EMAIL` e `EMAIL_NOTIFICATIONS_ENABLED`. Use exclusivamente Script Properties; veja `script-properties.example.json`, que contém apenas placeholders.

`SLOT_INTERVAL_MINUTES` é somente a granularidade dos horários publicados (por exemplo, 30 em 30 minutos), não a duração de nenhum serviço. A duração real será informada como início e fim na confirmação privada. `SLOT_DURATION_MINUTES`, `CALENDAR_ID`, `PENDING_EVENT_PREFIX`, `PENDING_RETENTION_DAYS` e `ALLOWED_START_TIMES_JSON` não fazem parte deste contrato.

## Superfície pública

- `GET action=health`: flags booleanas de configuração, sem valores.
- `GET action=availability&date=YYYY-MM-DD`: somente data e horários livres.
- `POST action=request`: grava uma linha `PENDENTE`, atualiza `Clientes` e, quando habilitado, notifica por e-mail.

O `requestId` da linha controla a idempotência. Em um replay, o payload recebido é ignorado: nenhuma informação original ou de cliente é alterada e uma eventual recuperação de notificação usa exclusivamente os dados persistidos em `Solicitações`. Solicitações distintas podem compartilhar data e horário. Linhas `PENDENTE` não criam eventos e não participam da disponibilidade; somente eventos reais da agenda de atendimentos são subtraídos dos períodos oferecidos. O POST mantém lock, rate limit, validação e respostas compatíveis e nunca toca em `Pagamentos`.

Não há operação administrativa em `doGet` ou `doPost`. Antes de publicar, configure valores fora do Git, revise permissões Calendar/Sheets/Mail e faça testes restritos. Esta fase não criou projeto, gatilho, painel ou deployment.
