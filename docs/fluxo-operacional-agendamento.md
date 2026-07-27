# Fluxo operacional de pré-solicitação

> **Fase 9A:** este documento define o processo futuro. Nenhuma integração Google, notificação real ou aprovação automática está ativa.

## Regras definitivas

O site recebe somente **pré-solicitações**. Escolher dia e horário não confirma nem garante atendimento. Toda solicitação nasce como **PENDENTE**, deve ser registrada na base administrativa antes de qualquer confirmação e guarda o canal escolhido (`whatsapp` ou `email`). Somente a Pati decide manualmente se deseja confirmar. Não há aprovação ou cobrança automática; valores e pagamentos são tratados depois.

O cliente preenche uma única ficha. A Pati recebe um resumo efetivo e pode confirmar apenas o que desejar, recusar, cancelar ou pedir mais informações.

## Estados administrativos oficiais

- `PENDENTE`: registrada e aguardando análise;
- `CONFIRMADO`: aceita manualmente pela Pati;
- `RECUSADO`: não aceita pela Pati;
- `CANCELADO`: encerrada após cancelamento;
- `MAIS_INFORMACOES`: depende de esclarecimentos do cliente.

## Rotina futura da Pati

1. Visualizar as solicitações resumidas.
2. Analisar serviço, região, pet, data, horário e observações.
3. Confirmar, recusar, cancelar ou pedir mais informações.
4. Contatar o cliente pelo canal informado.
5. Registrar pagamento separadamente.
6. Administrar disponibilidade no Google Calendar.
7. Administrar solicitações, clientes e pagamentos no Google Sheets.

Não haverá painel próprio, e a operação diária não exigirá editar o site ou o código.
