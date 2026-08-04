# Paty MundoPet — site estático

## Conteúdo configurável

O arquivo `content/site.json` centraliza o nome do projeto e da profissional, os
dados de WhatsApp e telefone, a mensagem padrão, o e-mail, o Instagram, a área de
atendimento e o ano do rodapé. **Os valores atuais são PLACEHOLDERS de
pré-integração e devem ser substituídos antes da publicação oficial.** Não publique
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

## Cliente de agenda — Fase 6B

A seção **Agendamento** possui dois modos. No modo `demo` atual, ela continua sendo
somente uma interface visual e local: nenhum `fetch` ocorre e os dias e horários
locais não representam disponibilidade real. No modo `live`, que exige
ativação explícita futura, o cliente consulta horários e registra apenas uma
**solicitação pendente**; nenhuma confirmação é automática.

Edite títulos, avisos, serviços já existentes, opções locais, estados e
campos em `content/scheduling.json`. Depois, execute `npm run build:site` (ou o
build completo) para atualizar o `index.html` estático. O comportamento local e os
cliente HTTP, comportamento da interface e estilos ficam, respectivamente, em
`assets/js/scheduling-api.js`, `assets/js/scheduling.js` e
`assets/css/styles.css`.

`content/integration.json` permanece obrigatoriamente com `mode: "demo"` e
`webAppUrl: ""`. Após uma implantação real, somente a URL HTTPS de produção
terminada em `/exec` poderá ser inserida. URLs `/dev` são restritas a testes de
usuários autorizados e não devem ser publicadas. O POST usa parâmetros de
formulário (`URLSearchParams`), não JSON. Depois do deploy, respostas e CORS ainda
precisarão ser validados manualmente no navegador antes da ativação.

Os IDs estáveis que deverão compor `ALLOWED_SERVICE_IDS_JSON` são
`passeio-individual`, `passeio-grupo` e `planos-semanais`. Após uma
resposta `REQUEST_CREATED`, o WhatsApp não abre sozinho: o cliente precisa clicar
em **Avisar a Paty pelo WhatsApp**, e a Paty ainda revisará a solicitação.

## Backend preparado — Fase 6A

O diretório [`apps-script/`](apps-script/) contém o backend de agendamento para uma implantação **manual e futura** no Google Apps Script. Ele inclui diagnóstico, consulta segura de disponibilidade e registro de linhas pendentes com trava e idempotência por `requestId`, mas não contém URL, credencial, ID de agenda nem dados reais.

`content/integration.json` controla a integração gerada no HTML. Nesta fase ele permanece em `mode: "demo"`, com `webAppUrl` vazio; portanto, o site não faz consultas nem envia solicitações. Consulte [`apps-script/README.md`](apps-script/README.md) antes de qualquer implantação ou ativação. Os testes locais com mocks podem ser executados com `npm run test:apps-script` e nunca acessam uma conta Google.

## Fase 7 — segurança e privacidade

O aviso em `privacy.html` é gerado de `content/privacy.json`, com versão e dados da responsável centralizados. O formulário possui consentimento de privacidade separado da confirmação de revisão, e nenhum deles confirma automaticamente uma reserva.

O backend preparado valida tamanho, tipo e campos do POST, aplica limitação de frequência por hash com sal e mantém idempotência por `requestId`. Eventos pendentes expirados podem ser apenas inspecionados com `previewExpiredPendingEvents()` e removidos manualmente com `cleanupExpiredPendingEvents(true)`, sempre após revisão; nenhum gatilho automático foi criado. Não houve deploy, conexão com Calendar ou ativação: `content/integration.json` continua em `demo`, sem URL. Veja `docs/security-headers.md` antes de escolher uma hospedagem HTTPS.

## Fase 8 — SEO técnico, acessibilidade e performance

`content/seo.json` centraliza metadados públicos e não sensíveis. O SEO técnico está preparado, porém `indexingEnabled` permanece `false`, `siteUrl` e `socialImage` permanecem vazios, e `robots.txt` bloqueia rastreamento. O build só criará `sitemap.xml` depois que a indexação for explicitamente ativada com uma URL HTTPS real; ele nunca gera URLs fictícias.

Dados estruturados de empresa (`LocalBusiness`, endereço e informações equivalentes) foram adiados porque ainda não há dados reais validados. A Fase 8 acrescentou semântica, navegação por teclado, foco visível, redução de movimento e testes estáticos sem redesenhar a interface: cores, fontes Fraunces e Karla, cards, seções e identidade visual foram preservados. Nenhum deploy, analytics, cookie, conexão com Apps Script ou Calendar foi realizado; o modo continua inativo e a URL do Web App permanece vazia.

## Fase 9B-0A — base Google separada

O backend público agora está preparado para derivar slots de uma agenda exclusiva de disponibilidade, subtrair toda ocupação de uma agenda exclusiva de atendimentos e persistir de forma idempotente nas abas `Solicitações` e `Clientes`, validando também `Pagamentos` sem gravá-la. A configuração usa somente Script Properties e placeholders; `CALENDAR_ID` e a lista estática `ALLOWED_START_TIMES_JSON` foram removidos do contrato.

O futuro painel administrativo está apenas especificado em `docs/arquitetura-painel-privado.md` e `docs/contrato-administrativo.md`: será outro projeto Apps Script, outro deployment e acesso Google privado. Nenhuma ação administrativa foi exposta. Nenhum ID real, deploy ou e-mail foi usado; `content/integration.json` permanece com `mode: "demo"` e `webAppUrl: ""`.
