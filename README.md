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

## Fase 11A — verdade do site público

O site apresenta somente os serviços confirmados:

- **Passeios**, com pré-solicitação pelo formulário integrado;
- **Dog sitter**, combinado diretamente com a Pati pelo WhatsApp.

O formulário envia exclusivamente o serviço estável
`passeio-individual` com o rótulo público `Passeios`. Dog sitter permanece
visível no site, mas não é uma opção do formulário e ainda não integra o
contrato funcional do backend.

Toda solicitação está sujeita à análise e à confirmação manual da Pati. Valores
e disponibilidade são combinados diretamente, e o pagamento é feito via Pix;
o site não possui checkout nem pagamento automático.

A Fase 11A altera somente conteúdo, estrutura, validações de build, testes
estáticos e artefatos gerados do site público. Ela não modifica:

- `apps-script/` ou o contrato do backend;
- `admin-apps-script/` ou o Painel Privado;
- `assets/js/scheduling.js` e `assets/js/scheduling-api.js`;
- `content/integration.json`, APIs, payloads, autenticação ou autorização;
- Google Sheets, Google Calendar ou workflows.

Os detalhes e limites funcionais estão registrados em
[`docs/fase-11a-verdade-site-publico.md`](docs/fase-11a-verdade-site-publico.md).

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
