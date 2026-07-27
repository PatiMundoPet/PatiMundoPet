# Cabeçalhos de segurança (preparação)

Este documento é orientação para uma hospedagem futura; nenhum cabeçalho foi aplicado e nenhum provedor foi escolhido.

- **Content-Security-Policy (CSP):** iniciar com `default-src 'self'`; permitir estilos/fontes somente nas origens necessárias. `frame-ancestors 'none'` deve impedir enquadramento. Ao ativar a integração, revisar `connect-src` e redirecionamentos para `https://script.google.com` e `https://script.googleusercontent.com`.
- **Referrer-Policy:** considerar `strict-origin-when-cross-origin`.
- **X-Content-Type-Options:** usar `nosniff`.
- **Permissions-Policy:** desabilitar recursos não usados, como câmera, microfone e geolocalização.
- **Strict-Transport-Security:** habilitar somente depois que toda a hospedagem e subdomínios estiverem confirmados em HTTPS.

O site usa atualmente Google Fonts em `https://fonts.googleapis.com` (CSS) e `https://fonts.gstatic.com` (arquivos de fonte); essas origens precisam ser previstas em `style-src` e `font-src`. A abertura por `file://` não recebe cabeçalhos HTTP e tem regras de origem diferentes; a validação real de CSP deve ocorrer em hospedagem HTTPS. Scripts JSON `type="application/json"` são configuração não executável, escapada pelo build. Não adicione `'unsafe-inline'`: o JavaScript executável está em arquivos externos.
