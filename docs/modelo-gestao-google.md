# Modelo de gestão Google — Fase 9B-0A

A arquitetura preparada usa duas agendas. **Disponibilidade** contém exclusivamente blocos oferecidos e prefixados; **Atendimentos** contém toda ocupação, incluindo pendentes, confirmados e bloqueios. Disponibilidade pública = slots inteiros oferecidos menos qualquer sobreposição em Atendimentos.

## Planilha administrativa

Os cabeçalhos são validados literalmente e nesta ordem:

- **Solicitações:** `requestId`, `dataRecebimento`, `submissionChannel`, `serviço`, `data`, `horário`, `responsável`, `WhatsApp`, `e-mail`, `pet`, `região`, `observações`, `status`, `notificationStatus`, `dataÚltimaAtualização`.
- **Clientes:** `clienteId`, `responsável`, `WhatsApp`, `e-mail`, `pets`, `observações`, `dataCadastro`, `últimoAtendimento`.
- **Pagamentos:** `requestId`, `cliente`, `serviço`, `valor`, `formaPagamento`, `vencimento`, `statusPagamento`, `dataPagamento`, `observações`.

Uma solicitação nasce `PENDENTE`. Clientes são localizados primeiro por WhatsApp normalizado, senão por e-mail sem diferença de caixa; pets não são duplicados, observações administrativas e `últimoAtendimento` são preservados. Observações da solicitação não viram observações permanentes. `Pagamentos` é apenas validada e dispõe de helpers internos para a fase privada; nenhuma linha, preço ou cobrança é criada.

Calendar e Sheets formam a chave idempotente por `requestId`. Existência nos dois retorna o registro original e `SENT` não reenvia. Existência em somente um retorna estado inconsistente. Se a planilha falhar após criar o evento, o backend tenta excluí-lo e retorna falha, sem sucesso silencioso.
