# Fluxo operacional de pré-solicitação

1. O backend valida allowlist, serviço, contatos, consentimentos, versão, data e horário.
2. Confirma que o horário pertence a um bloco prefixado da agenda de disponibilidade e não colide, na granularidade exibida, com evento real da agenda de atendimentos.
3. Adquire lock, procura o `requestId` em `Solicitações` e repete a disponibilidade para uma nova solicitação.
4. Grava a linha com status `PENDENTE`, cria/atualiza `Clientes` e não cria evento nem altera `Pagamentos`.
5. Para canal e-mail habilitado, tenta `MailApp` depois da gravação e registra `PENDING`, `SENT` ou `FAILED` somente na linha. Falha de e-mail preserva a solicitação. WhatsApp fica `NOT_REQUESTED`.

Uma repetição do mesmo `requestId` devolve sucesso sem criar outra linha e ignora todos os demais campos do novo payload. Ela nunca altera a solicitação ou o cliente com dados do replay; se for preciso recuperar uma notificação `PENDING` ou `FAILED`, cliente e mensagem são reconstruídos somente da linha já armazenada. RequestIds diferentes podem solicitar o mesmo horário. Linhas pendentes nunca ocupam o período. `SLOT_INTERVAL_MINUTES` define apenas de quantos em quantos minutos horários são exibidos, e não a duração do serviço.

A seleção nunca confirma atendimento. O futuro painel privado decidirá entre `PENDENTE`, `CONFIRMADO`, `RECUSADO`, `CANCELADO` e `MAIS_INFORMACOES`. Nesta fase não há painel, conexão Google ou deploy.
