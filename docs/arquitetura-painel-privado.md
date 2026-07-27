# Arquitetura do futuro painel privado

O painel **não foi implementado nesta fase**. A próxima fase deverá criá-lo como segundo projeto Google Apps Script, com deployment separado e acesso restrito à conta Google da Patrícia.

## Fronteira obrigatória

O backend público somente consulta disponibilidade e recebe pré-solicitações. Ele não lista clientes ou pagamentos, não muda status e não contém ações administrativas. O painel privado usará as mesmas duas agendas e a mesma planilha somente após autenticação Google; funções administrativas não serão compartilhadas nem roteadas por `doGet`/`doPost` público.

## Capacidades previstas

O painel permitirá criar/excluir blocos de disponibilidade, inclusive recorrentes; visualizar solicitações pendentes; confirmar, recusar, cancelar ou pedir informações; criar bloqueios; abrir WhatsApp; responder por e-mail; consultar clientes, pets e histórico; registrar pagamentos manualmente; e consultar resumo diário.

Excluir ou mover o evento correspondente na agenda de atendimentos será parte da estratégia administrativa para liberar um horário recusado/cancelado. A agenda de disponibilidade não é alterada ao criar uma pré-solicitação. Uma tela futura de reconciliação deverá tratar casos em que Calendar e Sheets divergirem.
