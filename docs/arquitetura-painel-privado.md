# Arquitetura do futuro painel privado

O painel **não foi implementado nesta fase**. Uma próxima fase deverá criá-lo como projeto Google Apps Script separado, com deployment próprio e acesso restrito à conta Google autorizada da Patrícia.

## Fronteira obrigatória

O backend público somente consulta disponibilidade e recebe pré-solicitações. Ele não lista dados administrativos, não muda status e não contém ações administrativas. O painel privado usará as mesmas duas agendas e a mesma planilha somente após autenticação Google; suas funções não serão compartilhadas nem roteadas por `doGet`/`doPost` público.

O painel permitirá visualizar pendências; receber início e fim ao confirmar; confirmar, recusar, cancelar ou pedir informações; administrar disponibilidade e bloqueios; consultar clientes e histórico; e registrar pagamentos manualmente. A agenda de disponibilidade representa quando a Pati aceita trabalhar. Somente a confirmação privada cria um evento na agenda **Pati MundoPet — Atendimentos**; recusa e pedido de informações não criam eventos.

O cancelamento de um confirmado removerá/cancelará seu evento vinculado para liberar o período. `requestId`, referência do evento, estado e datas de atualização sustentarão rastreabilidade e reconciliação. O algoritmo transacional detalhado está em `contrato-administrativo.md`.
