# Fase 11B — publicação controlada no GitHub Pages

## Decisões desta fase

- A hospedagem escolhida para o site público V2 é o GitHub Pages com GitHub Actions.
- Para este repositório público, a publicação pelo GitHub Pages mantém custo zero.
- A publicação é exclusiva a partir da branch `main`.
- Pull requests executam build, testes e validação do pacote público, mas não publicam.
- O deployment só pode ocorrer em `push` para `main` ou `workflow_dispatch` executado na própria `main`.
- O endereço do deployment deve ser obtido pelo `page_url` retornado pelo GitHub Pages.
- O link publicado ainda não deve ser colocado na bio.
- Não há domínio personalizado nesta fase e nenhum arquivo `CNAME` deve ser criado.
- A ativação de SEO, indexação e divulgação pública pertence a uma fase posterior.
- O GitHub Pages não deve ser usado para inventar configurações de cabeçalhos HTTP incompatíveis com a plataforma.

## Pacote público fechado

O artefato de publicação é preparado em `.pages-dist` e contém exatamente estes nove arquivos:

1. `index.html`
2. `privacy.html`
3. `robots.txt`
4. `assets/css/styles.css`
5. `assets/css/tailwind.min.css`
6. `assets/js/boot.js`
7. `assets/js/main.js`
8. `assets/js/scheduling-api.js`
9. `assets/js/scheduling.js`

Backend, Painel Privado, fontes, documentação, workflows, configurações internas, testes, credenciais, `package.json` e `sitemap.xml` não fazem parte do artefato.

## Integração preservada

A integração pública existente com Google Apps Script permanece no modo `live`, usando a URL HTTPS de `script.google.com` terminada em `/exec` já incorporada ao HTML gerado. Esta fase não altera Apps Script, Google Sheets, Google Calendar, APIs, payloads, autenticação ou autorização.

## SEO e indexação

O site continua não indexável:

- `content/seo.json` mantém `indexingEnabled: false`, `siteUrl: ""` e `socialImage: ""`.
- `robots.txt` mantém bloqueio de rastreamento com `Disallow: /`.
- `index.html` e `privacy.html` mantêm `noindex, nofollow`.
- `sitemap.xml` permanece ausente.
- `CNAME` permanece ausente.

## Lista operacional pós-merge, ainda não executada

Esta lista depende do merge futuro na `main` e do deployment de produção. Ela não deve ser executada durante esta tarefa.

1. Abrir o endereço HTTPS publicado.
2. Testar carregamento em desktop e mobile.
3. Testar menus e navegação.
4. Testar página de privacidade.
5. Testar links do Instagram e WhatsApp.
6. Confirmar que Dog sitter continua apenas no WhatsApp.
7. Confirmar que o formulário oferece somente Passeios.
8. Consultar disponibilidade real.
9. Enviar uma única pré-solicitação controlada.
10. Confirmar que aparece como `PENDENTE` no Painel Privado.
11. Conferir os dados recebidos.
12. Excluir a solicitação de teste sem confirmá-la.
13. Confirmar que nenhum evento de atendimento foi criado.
14. Somente depois avaliar indexação e link na bio.
