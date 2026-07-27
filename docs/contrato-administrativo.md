# Contrato administrativo futuro

Contrato interno para o projeto privado da próxima fase; **nenhuma operação abaixo existe no endpoint público**.

## Operações previstas

`getDashboardSummary`, `listRequests`, `getRequest`, `updateRequestStatus`, `requestMoreInformation`, `createAvailabilityBlock`, `deleteAvailabilityBlock`, `createOperationalBlock`, `listClients`, `getClientHistory`, `listPayments` e `savePayment`.

Todas exigirão sessão Google autorizada da Patrícia, validação de entrada, respostas mínimas e auditoria sem dados pessoais em logs. Pagamentos serão incluídos manualmente; não há preço ou cobrança automática.

## Estados e transições

Estados oficiais: `PENDENTE`, `CONFIRMADO`, `RECUSADO`, `CANCELADO` e `MAIS_INFORMACOES`.

- `PENDENTE` → `CONFIRMADO`, `RECUSADO`, `CANCELADO` ou `MAIS_INFORMACOES`;
- `MAIS_INFORMACOES` → `PENDENTE`, `CONFIRMADO`, `RECUSADO` ou `CANCELADO`;
- `CONFIRMADO` → `CANCELADO`;
- `RECUSADO` e `CANCELADO` são finais nesta versão do contrato.

A transição deve atualizar a linha e o evento de forma coordenada. Recusa/cancelamento só libera o slot quando o painel remover ou mover o evento (ou executar outra estratégia administrativa explicitamente revisada). Inconsistências não serão corrigidas por duplicação automática: irão para reconciliação administrativa.
