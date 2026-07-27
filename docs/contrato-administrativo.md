# Contrato administrativo futuro

Contrato interno para o projeto privado de uma próxima fase; **nenhuma operação abaixo existe ou deve ser roteada pelo endpoint público**.

## Estados e transições

Estados oficiais: `PENDENTE`, `CONFIRMADO`, `RECUSADO`, `CANCELADO` e `MAIS_INFORMACOES`.

- `PENDENTE` → `CONFIRMADO`, `RECUSADO`, `CANCELADO` ou `MAIS_INFORMACOES`;
- `MAIS_INFORMACOES` → `PENDENTE`, `CONFIRMADO`, `RECUSADO` ou `CANCELADO`;
- `CONFIRMADO` → `CANCELADO`;
- `RECUSADO` e `CANCELADO` são finais neste contrato.

## Confirmação segura

A operação privada receberá `requestId`, horário inicial e horário final explícitos, validará que o fim é posterior ao início e adquirirá lock antes de ler novamente a linha e as agendas. Dentro do lock deverá:

1. exigir que a linha esteja em `PENDENTE` ou `MAIS_INFORMACOES` e recusar dupla confirmação;
2. verificar que o período completo ainda está contido na disponibilidade oferecida;
3. verificar que nenhum evento real da agenda de atendimentos se sobrepõe ao período;
4. criar exatamente um evento confirmado em **Pati MundoPet — Atendimentos**, incluindo o `requestId` como chave de rastreabilidade;
5. atualizar a linha para `CONFIRMADO`, armazenando a referência do evento e a data de atualização.

Se o período tiver sido ocupado, a operação termina sem criar nem sobrescrever evento. Se a escrita da planilha falhar após a criação, deverá compensar removendo o evento recém-criado ou registrar estado de reconciliação sem tentar duplicação automática. A idempotência deve conferir estado, `requestId` e referência do evento.

`RECUSADO` e `MAIS_INFORMACOES` atualizam somente a linha e a auditoria, pois uma pré-solicitação não possui evento. Ao cancelar `CONFIRMADO`, o fluxo privado adquire lock, localiza pelo vínculo persistido e `requestId`, cancela/remove o evento correto e somente então marca `CANCELADO`; assim o período volta ao cálculo público. Falhas parciais vão para reconciliação segura.

Todas as operações exigirão sessão Google autorizada da Patrícia, validação de entrada, respostas mínimas e auditoria sem dados pessoais em logs. Pagamentos serão manuais; não há preço ou cobrança automática.
