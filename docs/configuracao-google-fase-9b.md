# Configuração Google — Fase 9B-3

Esta é documentação de preparação; nenhum recurso foi conectado e nenhum deploy foi realizado.

## Recursos e propriedades

`AVAILABILITY_CALENDAR_ID` identifica o calendário de bloqueios e exceções operacionais da Pati. O futuro painel privado criará, editará, cancelará e excluirá ali bloqueios pontuais, intervalos, dias inteiros e recorrências. `APPOINTMENTS_CALENDAR_ID` identifica o calendário de atendimentos reais confirmados, clientes fixos e demais compromissos operacionais. `SPREADSHEET_ID` aponta para a planilha administrativa. IDs reais ficam somente em Script Properties.

Também são obrigatórias: `TIMEZONE`, `WORKDAY_START_TIME`, `WORKDAY_END_TIME`, `SLOT_INTERVAL_MINUTES`, `ALLOWED_SERVICE_IDS_JSON`, `WHATSAPP_NUMBER`, `PRIVACY_POLICY_VERSION`, `MAX_REQUEST_BYTES`, `RATE_LIMIT_WINDOW_MINUTES`, `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_SALT`, `NOTIFICATION_EMAIL` e `EMAIL_NOTIFICATIONS_ENABLED`. O exemplo seguro está em `apps-script/script-properties.example.json`.

Configure `WORKDAY_START_TIME=08:30`, `WORKDAY_END_TIME=18:00` e `SLOT_INTERVAL_MINUTES=30`. O início é inclusivo; o encerramento é exclusivo e nunca pode ser selecionado como início. O intervalo controla a granularidade dos horários, sem introduzir almoço, folgas ou regras de serviço. A jornada deve ser divisível pelo intervalo. `AVAILABILITY_EVENT_PREFIX` foi removida; as propriedades legadas `SLOT_DURATION_MINUTES`, `CALENDAR_ID`, `PENDING_EVENT_PREFIX`, `PENDING_RETENTION_DAYS` e `ALLOWED_START_TIMES_JSON` também não são aceitas.

## Cálculo

Todos os dias, de segunda-feira a domingo, começam automaticamente com os 19 horários entre 08:30 e 17:30. A ausência de evento significa disponibilidade. Qualquer evento não cancelado de qualquer título nos dois calendários remove os slots sobrepostos; isso inclui compromissos recorrentes e eventos de dia inteiro. Eventos cancelados e removidos deixam de bloquear. O prefixo `[DISPONÍVEL]` não oferece mais horários e um evento legado com esse nome é tratado como bloqueio normal. Horários já iniciados e datas fora de 90 dias não são publicados.

Linhas da planilha, inclusive `PENDENTE`, jamais entram no cálculo. Portanto, requestIds diferentes podem pedir o mesmo horário enquanto não houver confirmação ou bloqueio no calendário. As respostas apresentam somente `HH:mm`, nunca títulos, descrições, IDs ou outros metadados privados dos eventos.

A planilha deve conter exatamente `Solicitações`, `Clientes` e `Pagamentos`, com os cabeçalhos documentados em `modelo-gestao-google.md`. O backend valida tudo, não cria/reordena colunas nem apaga dados. A estrutura deve ser preparada manualmente antes de uma ativação futura.
