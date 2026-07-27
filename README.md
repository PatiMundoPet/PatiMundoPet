# Paty MundoPet — CSS de produção

Instale as dependências fixadas no lockfile com `npm ci` e gere novamente o CSS com
`npm run build:css`.

O arquivo publicado é `assets/css/tailwind.min.css`. Ele é versionado para que o site
estático não dependa de Node.js em produção. O diretório `node_modules/` é apenas de
desenvolvimento e não deve ser versionado.

O workflow **Validate static site** do GitHub Actions executa o build em cada pull
request para `main` e confirma que o CSS compilado versionado continua sincronizado
com os arquivos-fonte.
