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
