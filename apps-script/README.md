# Backend público de agendamento — Fase 11C-2A

Backend público para consultar disponibilidade, registrar pré-solicitações na planilha administrativa e recuperar o resultado de um envio pelo `requestId`. A implantação, os IDs, as credenciais, a URL `/exec`, os contatos e todos os demais valores reais são administrados fora do repositório.

## Script Properties

São obrigatórias `AVAILABILITY_CALENDAR_ID`, `APPOINTMENTS_CALENDAR_ID`, `SPREADSHEET_ID`, `TIMEZONE`, `WORKDAY_START_TIME`, `WORKDAY_END_TIME`, `SLOT_INTERVAL_MINUTES`, `ALLOWED_SERVICE_IDS_JSON`, `WHATSAPP_NUMBER`, `PRIVACY_POLICY_VERSION`, `MAX_REQUEST_BYTES`, `RATE_LIMIT_WINDOW_MINUTES`, `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_SALT`, `NOTIFICATION_EMAIL` e `EMAIL_NOTIFICATIONS_ENABLED`. Use exclusivamente Script Properties e placeholders como os de `script-properties.example.json`.

O `SPREADSHEET_ID` do Backend Público deve apontar para a mesma planilha administrativa usada pelo Painel Privado. Não registre o ID real no repositório. `WORKDAY_START_TIME=08:30` é inclusivo e `WORKDAY_END_TIME=18:00` é somente o encerramento. `SLOT_INTERVAL_MINUTES=30` mantém o contrato legado com `time`; o contrato moderno usa os valores literais `startTime` e `endTime`. O exemplo de `ALLOWED_SERVICE_IDS_JSON` pode preparar `passeio-individual` e `dog-day-care`, mas isso não publica nem configura o serviço no site.

## Operações públicas e prontidão

As três responsabilidades são independentes:

- `GET action=availability&date=YYYY-MM-DD&startTime=HH:mm&endTime=HH:mm` consulta os dois calendários. A forma temporariamente legada apenas com `date` continua aceita. Não reserva, confirma, persiste ou cria eventos.
- `POST action=request` exige calendários acessíveis e uma aba `Solicitações` válida com `horárioTérmino` para o contrato moderno. Grava exclusivamente uma linha `PENDENTE`; nunca cria clientes, pagamentos ou eventos de Calendar.
- `GET action=request-status&requestId=<UUID>` depende somente de `SPREADSHEET_ID`, do acesso à planilha e da estrutura válida de `Solicitações`. Uma ocorrência retorna `REQUEST_FOUND` com apenas `requestId` e `status`; zero retorna `REQUEST_NOT_FOUND`; duplicidade retorna `INCONSISTENT_STATE`. A operação continua disponível mesmo que propriedades de Calendar, serviços, e-mail ou rate limit estejam ausentes ou inválidas; não escreve, notifica, limita taxa, adquire lock nem acessa Calendar. Quando a consulta à planilha falha, a resposta informa apenas que não foi possível confirmar o registro naquele momento, sem afirmar se o POST anterior gravou ou não a linha.

`GET action=health` preserva as flags anteriores. `configured` significa somente que todas as Script Properties são válidas. `availabilityReady` também exige acesso aos dois calendários; de forma independente, `requestSheetReady` depende somente de `SPREADSHEET_ID`, acesso à planilha e estrutura válida de `Solicitações`; `requestEndTimeReady` exige essa estrutura e `horárioTérmino` na posição correta; e `requestReady` reúne configuração completa, calendários, planilha válida e a coluna de término exigidos pelo POST moderno. As verificações são somente leitura e não expõem valores, cabeçalhos recebidos, dados pessoais ou detalhes técnicos.

## Contrato da aba Solicitações

A validação de `Solicitações` é estrita. A base A:O mantém os cabeçalhos documentados; as formas operacionais A:P, A:Q, A:R e A:S acrescentam, nesta ordem, `horárioTérmino`, `eventIdAtendimento`, `observaçãoAdministrativa` e `clienteId`. O início permanece em `horário`, o término literal em `horárioTérmino`, e Q:S ficam vazias na criação pública.

As abas `Clientes` e `Pagamentos` **não são dependências do Backend Público**. Elas não são abertas, validadas, lidas ou escritas por disponibilidade, criação ou recuperação. Cabeçalhos ausentes, diferentes ou adicionais nessas abas não podem bloquear uma pré-solicitação.

O `requestId` controla idempotência. Exatamente uma linha existente preserva integralmente o conteúdo gravado e permite recuperar uma notificação pendente; mais de uma linha retorna `INCONSISTENT_STATE` sem efeitos colaterais. Solicitações distintas podem compartilhar período enquanto estão pendentes. Textos iniciados por `=`, `+`, `-` ou `@` são neutralizados antes da escrita.

Eventos não cancelados de `APPOINTMENTS_CALENDAR_ID` e `AVAILABILITY_CALENDAR_ID` bloqueiam qualquer intervalo sobreposto, inclusive recorrências e eventos de dia inteiro. Linhas `PENDENTE` não participam da disponibilidade. O backend nunca cria eventos de Calendar; a confirmação continua sendo administrativa.

A versão pública `2.5.0` identifica a prontidão operacional separada, o desacoplamento de Clientes/Pagamentos e a recuperação segura por `requestId`.
