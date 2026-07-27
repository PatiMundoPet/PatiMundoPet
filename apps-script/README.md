# Backend público de agendamento — Fase 9B-0A

Base preparada, mas **não publicada**, para consultar duas agendas e persistir na planilha administrativa. Não há IDs, credenciais, URL `/exec` ou contatos reais no repositório; o site permanece em demonstração.

## Script Properties

As propriedades obrigatórias são `AVAILABILITY_CALENDAR_ID`, `APPOINTMENTS_CALENDAR_ID`, `SPREADSHEET_ID`, `TIMEZONE`, `SLOT_DURATION_MINUTES`, `AVAILABILITY_EVENT_PREFIX`, `ALLOWED_SERVICE_IDS_JSON`, `PENDING_EVENT_PREFIX`, `WHATSAPP_NUMBER`, `PRIVACY_POLICY_VERSION`, `MAX_REQUEST_BYTES`, `RATE_LIMIT_WINDOW_MINUTES`, `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_SALT`, `PENDING_RETENTION_DAYS`, `NOTIFICATION_EMAIL` e `EMAIL_NOTIFICATIONS_ENABLED`. Use exclusivamente Script Properties; veja `script-properties.example.json`, que contém apenas placeholders.

`CALENDAR_ID` e `ALLOWED_START_TIMES_JSON` não fazem parte do contrato. Os horários são derivados de eventos prefixados na agenda de disponibilidade, em intervalos de `SLOT_DURATION_MINUTES`, e subtraídos por qualquer sobreposição na agenda de atendimentos.

## Superfície pública

- `GET action=health`: flags booleanas de configuração, sem valores.
- `GET action=availability&date=YYYY-MM-DD`: somente data e horários livres.
- `POST action=request`: pré-solicitação validada, com lock e idempotência.

Não há operações administrativas públicas. O POST cria o evento apenas em atendimentos, grava `Solicitações`, atualiza `Clientes` e nunca cria `Pagamentos`. Uma falha obrigatória da planilha tenta apagar o evento recém-criado. Estado presente em apenas um dos dois armazenamentos retorna `INCONSISTENT_STATE` e exige reconciliação futura.

## Operação futura

Antes de qualquer publicação, copie manualmente os arquivos para um projeto Apps Script público, configure as propriedades com valores guardados fora do Git, revise permissões Calendar/Sheets/Mail e faça testes restritos. Esta fase não criou projeto, gatilho ou deployment, não autorizou conta Google e não enviou e-mail. O painel privado será outro projeto e outro deployment.
