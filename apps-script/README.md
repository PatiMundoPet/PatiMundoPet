# Backend público de agendamento — Fase 9B-3

Backend com implantação configurada externamente para consultar duas agendas e persistir pré-solicitações na planilha administrativa. O site usa a integração `live`; IDs, credenciais, URL `/exec`, propriedades e contatos reais permanecem configurados fora do repositório e desta documentação.

## Script Properties

As propriedades obrigatórias são `AVAILABILITY_CALENDAR_ID`, `APPOINTMENTS_CALENDAR_ID`, `SPREADSHEET_ID`, `TIMEZONE`, `WORKDAY_START_TIME`, `WORKDAY_END_TIME`, `SLOT_INTERVAL_MINUTES`, `ALLOWED_SERVICE_IDS_JSON`, `WHATSAPP_NUMBER`, `PRIVACY_POLICY_VERSION`, `MAX_REQUEST_BYTES`, `RATE_LIMIT_WINDOW_MINUTES`, `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_SALT`, `NOTIFICATION_EMAIL` e `EMAIL_NOTIFICATIONS_ENABLED`. Use exclusivamente Script Properties; veja `script-properties.example.json`, que contém apenas placeholders.

`WORKDAY_START_TIME=08:30` é inclusivo e `WORKDAY_END_TIME=18:00` é apenas o encerramento: 18:00 nunca é oferecido como início. A jornada automática vale de segunda-feira a domingo. `SLOT_INTERVAL_MINUTES=30` existe apenas para a compatibilidade temporária do contrato legado baseado em `time`; o contrato novo usa `startTime` e `endTime` literais e não depende dessa propriedade. `AVAILABILITY_EVENT_PREFIX`, `SLOT_DURATION_MINUTES`, `CALENDAR_ID`, `PENDING_EVENT_PREFIX`, `PENDING_RETENTION_DAYS` e `ALLOWED_START_TIMES_JSON` não fazem parte deste contrato.

## Superfície pública

- `GET action=health`: flags booleanas de configuração, sem valores.
- `GET action=availability&date=YYYY-MM-DD&startTime=HH:mm&endTime=HH:mm`: valida o intervalo exato. A consulta somente com `date` permanece temporariamente compatível com o site legado.
- `POST action=request`: grava uma linha `PENDENTE`, atualiza `Clientes` e, quando habilitado, notifica por e-mail.

O `requestId` da linha controla a idempotência. Em um replay, o payload recebido é ignorado: nenhuma informação original ou de cliente é alterada e uma eventual recuperação de notificação usa exclusivamente os dados persistidos em `Solicitações`. Solicitações distintas podem compartilhar data e horário. Linhas `PENDENTE` não criam eventos e não participam da disponibilidade. Eventos não cancelados em `APPOINTMENTS_CALENDAR_ID` (atendimentos reais) e em `AVAILABILITY_CALENDAR_ID` (bloqueios e exceções operacionais) retiram qualquer slot sobreposto, inclusive eventos recorrentes e de dia inteiro. Eventos `[DISPONÍVEL]` não são mais usados; se ainda existirem, bloqueiam como qualquer outro evento. O futuro painel privado controlará esses bloqueios no calendário de disponibilidade. O POST mantém verificação antes e depois do lock, rate limit, validação e respostas compatíveis e nunca toca em `Pagamentos`.

Não há operação administrativa em `doGet` ou `doPost`. A implantação e seus valores reais são administrados externamente; ao atualizar o código, revise permissões Calendar/Sheets/Mail e faça testes restritos sem registrar dados privados no Git.

A aba `Solicitações` aceita durante a migração os 15 cabeçalhos atuais ou uma 16ª coluna `horárioTérmino`, exclusivamente no final. Solicitações no contrato novo só são gravadas quando essa coluna final existe; assim, uma implantação intermediária não produz linha parcial. O campo `horário` preserva o início e `horárioTérmino` preserva o término literal.

A consulta pública é apenas informativa e reflete os eventos reais dos dois calendários no instante da consulta: não reserva, não confirma, não cria evento e não bloqueia a agenda. O POST também nunca cria eventos; grava exclusivamente uma pré-solicitação `PENDENTE`, e pedidos distintos podem solicitar o mesmo intervalo enquanto permanecem pendentes. A segunda consulta sob `LockService` apenas evita registrar um pedido depois que um evento real passou a ocupar o período.

## Compatibilidade e segurança da Fase 10B

O backend público aceita a aba `Solicitações` com A:P, A:Q ou A:R, desde que as colunas opcionais finais sejam, nessa ordem, `eventIdAtendimento` e `observaçãoAdministrativa`. Pré-solicitações permanecem `PENDENTE`, escrevem somente dados públicos em A:P e deixam Q:R vazias. Textos controlados pelo usuário são neutralizados antes da escrita quando começam com `=`, `+`, `-` ou `@`.

Se o cadastro do cliente falhar após o append, somente a linha recém-criada e identificada pelo mesmo `requestId` é removida e a planilha é sincronizada. O backend público não cria eventos de calendário.

A versão pública `2.4.0` identifica o endurecimento de persistência e a compatibilidade A:P/A:Q/A:R desta revisão.
