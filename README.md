# Pati MundoPet — site público e agendamento

Site estático da Pati MundoPet com formulário público de pré-solicitação, backend
Google Apps Script separado e Painel Privado administrativo independente.

## Conteúdo configurável

`content/site.json` centraliza identidade, contatos públicos confirmados, área de
atendimento e projetos com os quais a Pati já colaborou. O HTML-fonte fica em
`src/index.template.html`; `index.html`, `privacy.html` e `robots.txt` são
artefatos gerados e permanecem versionados.

`content/scheduling.json` centraliza textos e campos públicos do formulário.
`content/integration.json` contém somente a configuração do cliente de
agendamento já existente. Credenciais e IDs privados não devem ser incluídos
nesses arquivos.

## Fase 11C-2B — fluxo público definitivo

O site apresenta os três serviços confirmados:

- **Passeios** e **Dog Day Care**, com pré-solicitação pelo formulário integrado;
- **Dog sitter**, combinado diretamente com a Pati pelo WhatsApp.

O formulário envia os IDs técnicos `passeio-individual` e `dog-day-care` em
um único canal de registro. A continuação pelo WhatsApp aparece somente após a
confirmação do registro, e falhas ambíguas acionam a recuperação somente leitura
por `requestId`, sem repetir o POST automaticamente. Dog sitter permanece
visível, mas fora do formulário e do contrato do backend.

Toda solicitação está sujeita à análise e à confirmação manual da Pati. Valores
e disponibilidade são combinados diretamente, e o pagamento é feito via Pix;
o site não possui checkout nem pagamento automático.

Nenhum evento é criado enquanto a solicitação está `PENDENTE`; a criação continua exclusiva da confirmação manual no Painel Privado.

## Build

Execute o build completo para atualizar HTML e CSS:

```sh
npm run build
```

O script de CSS usa temporariamente a versão exata `3.4.17` do Tailwind por
meio do `npx`. Também é possível executar `npm run build:site` e
`npm run build:css` separadamente. A CI repete o build e rejeita artefatos
gerados que não estejam sincronizados com as fontes.

## Integração de agendamento

O cliente público consulta a disponibilidade pelo Web App configurado e registra
somente solicitações `PENDENTE`. Nenhuma reserva é confirmada automaticamente.
O POST usa o contrato existente e os mesmos IDs internos; a mudança do rótulo
`Nome do pet` para `Nome do cão` não altera `id="pet"`, `name="pet"`,
`petName`, colunas ou payloads.

O backend público está em `apps-script/`. O painel administrativo, mantido em
`admin-apps-script/`, é outro projeto Apps Script e continua privado. Consulte os
READMEs desses diretórios antes de qualquer implantação ou alteração operacional.

## Segurança, privacidade e SEO

O aviso de privacidade é gerado de `content/privacy.json`. O formulário mantém
consentimento de privacidade separado da confirmação de revisão. O backend aplica
validação, trava, limitação de frequência e idempotência por `requestId`.

`content/seo.json` centraliza os metadados. Enquanto `indexingEnabled` for
`false`, `robots.txt` bloqueia rastreamento e `sitemap.xml` não é gerado.

## Testes

```sh
npm run test:apps-script
npm run test:admin-apps-script
npm run test:scheduling-api
npm run test:security
npm run test:quality
```

Os testes são locais, usam mocks para as integrações Google e não acessam contas
reais.

## Fase 11B — publicação controlada no GitHub Pages

A hospedagem escolhida para o site público V2 é o GitHub Pages com GitHub
Actions, mantendo custo zero para este repositório público e publicação
exclusiva a partir da branch `main`. Pull requests continuam executando build,
testes e validação do pacote público, mas não configuram Pages, não enviam
artefato de implantação e não publicam o site.

O pacote público é fechado e gerado em `.pages-dist` com exatamente nove
arquivos: `index.html`, `privacy.html`, `robots.txt`, `assets/css/styles.css`,
`assets/css/tailwind.min.css`, `assets/js/boot.js`, `assets/js/main.js`,
`assets/js/scheduling-api.js` e `assets/js/scheduling.js`. Backend, Painel
Privado, fontes, documentação, workflows, configurações internas e
`sitemap.xml` não fazem parte do artefato.

A integração pública com o Google Apps Script permanece preservada no modo
`live`, com URL HTTPS de `script.google.com` terminada em `/exec`. A indexação
continua desativada: `content/seo.json` mantém `indexingEnabled: false`,
`siteUrl: ""` e `socialImage: ""`; `robots.txt` bloqueia rastreamento; as páginas
mantêm `noindex, nofollow`; e não há `CNAME` nem domínio personalizado nesta
fase. O endereço de produção deve ser obtido pelo `page_url` retornado pelo job
do GitHub Pages depois de um merge futuro na `main`, e o link ainda não deve ser
colocado na bio.

Use os scripts abaixo para preparar e validar o mesmo pacote entregue ao Pages:

```sh
npm run pages:prepare
npm run pages:test
npm run build:pages
```

A ativação de SEO, indexação e divulgação do endereço pertence a uma fase
posterior. O GitHub Pages também não deve ser usado para inventar configurações
de cabeçalhos HTTP incompatíveis com a plataforma.

Mais detalhes operacionais estão em
[`docs/fase-11b-publicacao-controlada.md`](docs/fase-11b-publicacao-controlada.md).
