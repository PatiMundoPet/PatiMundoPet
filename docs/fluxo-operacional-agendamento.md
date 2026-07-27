# Fluxo operacional de pré-solicitação

1. O backend valida allowlist, serviço, contatos, consentimentos, versão, data e horário.
2. Confirma que o slot cabe integralmente em bloco prefixado da agenda de disponibilidade e não colide com a agenda de atendimentos.
3. Adquire lock, verifica idempotência em Calendar e `Solicitações` e repete a disponibilidade.
4. Cria `[PENDENTE] Pet — serviço` exclusivamente em Atendimentos, sem convidados; grava `Solicitações`; cria/atualiza `Clientes`; não toca em `Pagamentos`.
5. Para canal e-mail habilitado, tenta `MailApp` depois das gravações e sincroniza `PENDING`, `SENT` ou `FAILED` no evento e na linha. Falha de e-mail preserva a solicitação. WhatsApp fica `NOT_REQUESTED` e continua sendo link `wa.me` acionado pelo cliente.

A seleção nunca confirma atendimento. O futuro painel privado decidirá entre `PENDENTE`, `CONFIRMADO`, `RECUSADO`, `CANCELADO` e `MAIS_INFORMACOES`. Nesta fase não há painel, conexão Google ou deploy.
