# Canais futuros de envio

> Preparação técnica da Fase 9A. Com `mode: "demo"` e `webAppUrl: ""`, nenhum registro, WhatsApp ou e-mail é enviado.

## WhatsApp sem API

No modo live futuro, o backend registra primeiro a pré-solicitação `PENDENTE`. Somente após `REQUEST_CREATED` (inclusive resposta idempotente) o navegador monta um link `wa.me`, usando o número centralizado reduzido a dígitos e a ficha sanitizada codificada por `encodeURIComponent`. O WhatsApp apenas abre a conversa: **o cliente precisa tocar em Enviar**. Não há API, token, bot, webhook ou envio automático.

Falha no registro impede a abertura e preserva a ficha. Depois do registro, a ficha também fica copiável como alternativa, sem criar outra solicitação.

## E-mail administrativo

No modo live futuro, após registrar a solicitação, o Apps Script poderá usar `MailApp.sendEmail`. As Script Properties serão `NOTIFICATION_EMAIL` e `EMAIL_NOTIFICATIONS_ENABLED`; nesta fase a habilitação permanece ausente ou falsa e nenhum endereço administrativo real existe no repositório.

O envio ocorrerá somente para `submissionChannel=email`, com endereço administrativo sintaticamente válido e quando o `requestId` ainda não estiver como `SENT`. O `replyTo` será o e-mail válido do cliente, sem limitação de provedor. A caixa de entrada da Pati não será acessada.

## Idempotência e notificação

O mesmo `requestId` não cria novo código, linha, evento ou e-mail. Os estados internos são `NOT_REQUESTED`, `PENDING`, `SENT` e `FAILED`. Uma falha de `MailApp` não remove a solicitação `PENDENTE`; uma repetição idempotente pode reenviar apenas para canal e-mail, configuração válida e status diferente de `SENT`. Respostas públicas não revelam `NOTIFICATION_EMAIL` nem dados pessoais desnecessários.
