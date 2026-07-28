# Backend público de agendamento — Fase 9B-3

Base **não publicada** para consultar duas agendas e persistir pré-solicitações na planilha administrativa. Não há IDs, credenciais, URL `/exec` ou contatos reais no repositório; o site permanece em demonstração.

## Script Properties

As propriedades obrigatórias são `AVAILABILITY_CALENDAR_ID`, `APPOINTMENTS_CALENDAR_ID`, `SPREADSHEET_ID`, `TIMEZONE`, `WORKDAY_START_TIME`, `WORKDAY_END_TIME`, `SLOT_INTERVAL_MINUTES`, `ALLOWED_SERVICE_IDS_JSON`, `WHATSAPP_NUMBER`, `PRIVACY_POLICY_VERSION`, `MAX_REQUEST_BYTES`, `RATE_LIMIT_WINDOW_MINUTES`, `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_SALT`, `NOTIFICATION_EMAIL` e `EMAIL_NOTIFICATIONS_ENABLED`. Use exclusivamente Script Properties; veja `script-properties.example.json`, que contém apenas placeholders.

`WORKDAY_START_TIME=08:30` é inclusivo e `WORKDAY_END_TIME=18:00` é apenas o encerramento: 18:00 nunca é oferecido como início. A jornada automática vale de segunda-feira a domingo. `SLOT_INTERVAL_MINUTES=30` é a granularidade dos horários publicados, não uma regra de duração comercial. A jornada deve ser divisível pelo intervalo. `AVAILABILITY_EVENT_PREFIX`, `SLOT_DURATION_MINUTES`, `CALENDAR_ID`, `PENDING_EVENT_PREFIX`, `PENDING_RETENTION_DAYS` e `ALLOWED_START_TIMES_JSON` não fazem parte deste contrato.

## Superfície pública

- `GET action=health`: flags booleanas de configuração, sem valores.
- `GET action=availability&date=YYYY-MM-DD`: somente data e horários livres.
- `POST action=request`: grava uma linha `PENDENTE`, atualiza `Clientes` e, quando habilitado, notifica por e-mail.

O `requestId` da linha controla a idempotência. Em um replay, o payload recebido é ignorado: nenhuma informação original ou de cliente é alterada e uma eventual recuperação de notificação usa exclusivamente os dados persistidos em `Solicitações`. Solicitações distintas podem compartilhar data e horário. Linhas `PENDENTE` não criam eventos e não participam da disponibilidade. Eventos não cancelados em `APPOINTMENTS_CALENDAR_ID` (atendimentos reais) e em `AVAILABILITY_CALENDAR_ID` (bloqueios e exceções operacionais) retiram qualquer slot sobreposto, inclusive eventos recorrentes e de dia inteiro. Eventos `[DISPONÍVEL]` não são mais usados; se ainda existirem, bloqueiam como qualquer outro evento. O futuro painel privado controlará esses bloqueios no calendário de disponibilidade. O POST mantém verificação antes e depois do lock, rate limit, validação e respostas compatíveis e nunca toca em `Pagamentos`.

Não há operação administrativa em `doGet` ou `doPost`. Antes de publicar, configure valores fora do Git, revise permissões Calendar/Sheets/Mail e faça testes restritos. Esta fase não criou projeto, gatilho, painel ou deployment.
