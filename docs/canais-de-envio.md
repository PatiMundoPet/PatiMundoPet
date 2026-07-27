# Canais de envio

Com `mode: "demo"` e `webAppUrl: ""`, nenhum canal é acionado.

## WhatsApp

Após `REQUEST_CREATED`, o navegador oferece `wa.me` e fallback copiável usando a configuração centralizada; o cliente ainda precisa clicar em **Enviar**. Não há API, bot, webhook ou envio automático.

## E-mail

Somente `submissionChannel=email`, `EMAIL_NOTIFICATIONS_ENABLED=true` e `NOTIFICATION_EMAIL` válido permitem uma tentativa, sempre após evento e linha. `replyTo` usa o e-mail válido informado, qualquer domínio é aceito e o endereço legítimo não é alterado. `SENT` nunca reenvia; falha marca `FAILED` no evento e na planilha sem remover a pendência. Testes usam `MailApp` mockado e respostas nunca revelam o destinatário administrativo.
