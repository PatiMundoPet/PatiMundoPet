# Configuração Google — Fase 9B-0B

Esta é documentação de preparação; nenhum recurso foi conectado e nenhum deploy foi realizado.

## Recursos e propriedades

`AVAILABILITY_CALENDAR_ID` identifica **Pati MundoPet — Disponibilidade**; somente eventos cujo título começa com `AVAILABILITY_EVENT_PREFIX` oferecem períodos. `APPOINTMENTS_CALENDAR_ID` identifica **Pati MundoPet — Atendimentos**, onde somente atendimentos reais confirmados e bloqueios operacionais devem existir. `SPREADSHEET_ID` aponta para a planilha administrativa. IDs reais ficam somente em Script Properties.

Também são obrigatórias: `TIMEZONE`, `SLOT_INTERVAL_MINUTES`, `ALLOWED_SERVICE_IDS_JSON`, `WHATSAPP_NUMBER`, `PRIVACY_POLICY_VERSION`, `MAX_REQUEST_BYTES`, `RATE_LIMIT_WINDOW_MINUTES`, `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_SALT`, `NOTIFICATION_EMAIL` e `EMAIL_NOTIFICATIONS_ENABLED`. O exemplo seguro está em `apps-script/script-properties.example.json`.

`SLOT_INTERVAL_MINUTES` controla somente a granularidade dos horários apresentados. Não representa a duração de atendimento, que será definida por início e fim durante a confirmação privada. As propriedades legadas `SLOT_DURATION_MINUTES`, `CALENDAR_ID`, `PENDING_EVENT_PREFIX`, `PENDING_RETENTION_DAYS` e `ALLOWED_START_TIMES_JSON` não são aceitas.

## Cálculo

Cada bloco prefixado gera inícios na granularidade configurada; blocos múltiplos ou sobrepostos são unidos sem duplicação. Eventos cancelados, blocos sem prefixo, horários iniciados e datas fora de 90 dias são ignorados. Qualquer sobreposição com evento real na agenda de atendimentos remove o horário. Linhas da planilha, inclusive `PENDENTE`, jamais entram nesse cálculo. As respostas apresentam somente `HH:mm`, nunca metadados dos eventos.

A planilha deve conter exatamente `Solicitações`, `Clientes` e `Pagamentos`, com os cabeçalhos documentados em `modelo-gestao-google.md`. O backend valida tudo, não cria/reordena colunas nem apaga dados. A estrutura deve ser preparada manualmente antes de uma ativação futura.
