# Paty MundoPet — site estático

## Conteúdo configurável

O arquivo `content/site.json` centraliza o nome do projeto e da profissional, os
dados de WhatsApp e telefone, a mensagem padrão, o e-mail, o Instagram, a área de
atendimento e o ano do rodapé. **Os valores atuais são PLACEHOLDERS de
demonstração e devem ser substituídos antes da publicação oficial.** Não publique
o site sem revisar todos esses campos.

`src/index.template.html` é o HTML-fonte e contém tokens preenchidos durante o
build. O `index.html` na raiz é gerado, permanece versionado e é o arquivo estático
publicado. As informações já ficam gravadas no HTML final e, portanto, são exibidas
normalmente mesmo quando JavaScript está desativado.

## Build

Execute o build completo para atualizar tanto o HTML quanto o CSS:

```sh
npm run build
```

Também é possível executar separadamente `npm run build:site` para gerar o HTML e
`npm run build:css` para compilar `assets/css/tailwind.min.css`. O comando de CSS
baixa e executa temporariamente a versão exata `3.4.17` do Tailwind por meio do
`npx`; nenhuma dependência Node.js é necessária em produção.

O workflow **Validate static site** executa o build em pull requests para `main` e
confirma que `index.html` e `assets/css/tailwind.min.css` continuam sincronizados
com seus arquivos-fonte.

## Agenda demonstrativa — Fase 5

A seção **Agendamento** é somente uma interface visual e local. Ela permite montar
e revisar um resumo no navegador, mas **nenhuma solicitação é enviada, salva ou
transformada em reserva**. Os dias e horários são placeholders identificados como
demonstração e não representam a disponibilidade real da Paty. A integração com a
disponibilidade real e o fluxo de envio ocorrerá em fases futuras.

Edite títulos, avisos, serviços já existentes, opções demonstrativas, estados e
campos em `content/scheduling.json`. Depois, execute `npm run build:site` (ou o
build completo) para atualizar o `index.html` estático. O comportamento local e os
estilos ficam, respectivamente, em `assets/js/scheduling.js` e
`assets/css/styles.css`.

## Backend preparado — Fase 6A

O diretório [`apps-script/`](apps-script/) contém o backend de agendamento para uma implantação **manual e futura** no Google Apps Script. Ele inclui diagnóstico, consulta segura de disponibilidade e criação de eventos pendentes com trava e idempotência, mas não contém URL, credencial, ID de agenda nem dados reais.

`content/integration.json` controla a integração gerada no HTML. Nesta fase ele permanece em `mode: "demo"`, com `webAppUrl` vazio; portanto, o site não faz consultas nem envia solicitações. Consulte [`apps-script/README.md`](apps-script/README.md) antes de qualquer implantação ou ativação. Os testes locais com mocks podem ser executados com `npm run test:apps-script` e nunca acessam uma conta Google.
