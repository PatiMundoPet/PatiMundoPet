# Modelo futuro de gestão Google

> Arquitetura planejada, **não ativa na Fase 9A**. Nenhuma conta, Calendar ID, Spreadsheet ID, Web App ou implantação foi configurada.

## Google Calendar

Futuramente exibirá somente horários disponibilizados pela Pati e considerará bloqueios pessoais ou operacionais, pré-solicitações pendentes e atendimentos confirmados. Horários recusados ou cancelados poderão voltar a ficar disponíveis quando aplicável. A seleção pública nunca representa confirmação.

## Google Sheets

### Aba Solicitações

`requestId`, `dataRecebimento`, `submissionChannel`, `serviço`, `data`, `horário`, `responsável`, `WhatsApp`, `e-mail`, `pet`, `região`, `observações`, `status`, `notificationStatus`, `dataÚltimaAtualização`.

### Aba Clientes

`clienteId`, `responsável`, `WhatsApp`, `e-mail`, `pets`, `observações`, `dataCadastro`, `últimoAtendimento`.

### Aba Pagamentos

`requestId`, `cliente`, `serviço`, `valor`, `formaPagamento`, `vencimento`, `statusPagamento`, `dataPagamento`, `observações`.

As planilhas serão administrativas; nenhum dado fictício foi criado nesta fase. Pagamentos permanecem separados e sem cobrança automática.
