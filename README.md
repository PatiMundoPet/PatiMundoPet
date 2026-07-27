# Paty MundoPet — CSS de produção

Gere novamente o CSS com `npm run build:css`. O comando baixa e executa
temporariamente a versão exata `3.4.17` do Tailwind por meio do `npx`.

O arquivo compilado `assets/css/tailwind.min.css` continua versionado e é o arquivo
publicado. Nenhuma dependência Node.js é necessária em produção: o site entregue é
composto apenas por arquivos HTML, CSS e JavaScript estáticos.

O workflow **Validate static site** do GitHub Actions executa o build em cada pull
request para `main` e confirma que o CSS compilado versionado continua sincronizado
com os arquivos-fonte.
