# Configuração Google — Fase 9B-0A

Esta é documentação de preparação; nenhum recurso foi conectado e nenhum deploy foi realizado.

## Recursos e propriedades

A agenda de disponibilidade é indicada por `AVAILABILITY_CALENDAR_ID`; somente eventos cujo título começa com `AVAILABILITY_EVENT_PREFIX` (valor futuro sugerido: `[DISPONÍVEL]`) oferecem períodos. A agenda indicada por `APPOINTMENTS_CALENDAR_ID` concentra pré-solicitações, atendimentos, bloqueios e demais compromissos. `SPREADSHEET_ID` aponta para a planilha administrativa. IDs reais ficam somente em Script Properties.

Também são obrigatórias: `TIMEZONE`, `SLOT_DURATION_MINUTES`, `ALLOWED_SERVICE_IDS_JSON`, `PENDING_EVENT_PREFIX`, `WHATSAPP_NUMBER`, `PRIVACY_POLICY_VERSION`, `MAX_REQUEST_BYTES`, `RATE_LIMIT_WINDOW_MINUTES`, `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_SALT`, `PENDING_RETENTION_DAYS`, `NOTIFICATION_EMAIL` e `EMAIL_NOTIFICATIONS_ENABLED`. O exemplo seguro está em `apps-script/script-properties.example.json`. As propriedades legadas `CALENDAR_ID` e `ALLOWED_START_TIMES_JSON` não são aceitas como configuração.

## Cálculo

Cada bloco prefixado é dividido em slots inteiros; sobras menores são descartadas. Blocos múltiplos ou sobrepostos são unidos sem duplicação. Eventos cancelados, sem prefixo, horários iniciados e datas fora de 90 dias são ignorados. Qualquer evento sobreposto na agenda de atendimentos remove o slot. As respostas apresentam somente `HH:mm`, nunca metadados dos eventos.

A planilha deve conter exatamente `Solicitações`, `Clientes` e `Pagamentos`, com os cabeçalhos documentados em `modelo-gestao-google.md`. O backend valida tudo, não cria/reordena colunas nem apaga dados. A estrutura deve ser preparada manualmente antes de uma ativação futura.
