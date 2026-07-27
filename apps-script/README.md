# Backend de agendamento — Google Apps Script

Este diretório prepara o backend gratuito de solicitações de agendamento. Ele **não está publicado**, não contém credenciais e não está ligado a uma agenda real. A implantação e a ativação do site serão etapas manuais posteriores.

## Arquivos

- `Code.gs`: endpoints de diagnóstico, disponibilidade e criação de evento pendente, além das validações, trava e proteção contra duplicidade.
- `appsscript.json`: manifesto V8 com os escopos mínimos de Calendar e Script Properties. O `timeZone` é apenas um placeholder e deve ser revisado.
- `../content/integration.json`: chave de ativação do site. Ela permanece com `mode: "demo"` e sem URL nesta fase.
- `../scripts/test-apps-script.mjs`: testes locais com mocks; não acessa Google.

## Script Properties obrigatórias

Todos os valores operacionais devem ser cadastrados em **Configurações do projeto → Propriedades do script** no editor do Apps Script:

| Propriedade | Formato |
| --- | --- |
| `CALENDAR_ID` | ID da agenda selecionada manualmente |
| `TIMEZONE` | fuso IANA, igual ao usado pela agenda, por exemplo `America/Sao_Paulo` |
| `SLOT_DURATION_MINUTES` | duração inteira, de 1 a 1440 minutos |
| `ALLOWED_START_TIMES_JSON` | array JSON de horários `HH:mm` |
| `ALLOWED_SERVICE_IDS_JSON` | array JSON de IDs de serviços permitidos |
| `PENDING_EVENT_PREFIX` | prefixo visível, normalmente `[PENDENTE]` |
| `WHATSAPP_NUMBER` | número com código do país, de 10 a 15 dígitos |

`setupExampleProperties()` somente retorna e registra um modelo **fictício**; ela nunca grava propriedades. Não copie placeholders como se fossem dados reais.

Para o conteúdo atual, configure futuramente `ALLOWED_SERVICE_IDS_JSON` com
`["dog-walker","passeio-individual","passeio-grupo","planos-semanais"]`.

## Cópia, configuração e autorização futura

1. Crie manualmente um projeto em script.google.com.
2. Copie `Code.gs` e substitua o manifesto pelo conteúdo de `appsscript.json`.
3. Ajuste `timeZone` no manifesto e `TIMEZONE` nas Script Properties para o mesmo fuso IANA da agenda escolhida.
4. No Google Calendar, escolha uma agenda apropriada e copie o ID exibido nas configurações dela para `CALENDAR_ID`. Não publique esse ID no repositório.
5. Cadastre todas as outras propriedades na interface do Apps Script.
6. Execute manualmente uma função que use Calendar e revise a tela de autorização. Autorize somente o acesso solicitado ao Calendar e às propriedades do script.
7. Em uma etapa posterior, use **Implantar → Nova implantação → App da Web**, defina conscientemente quem executa e quem pode acessar, e revise os riscos.
8. Somente depois de obter a URL real de produção terminada em `/exec`, registre-a e altere deliberadamente `content/integration.json` para `mode: "live"`. A URL `/dev` serve apenas a testes restritos no editor e não deve ser publicada.
9. Valide manualmente no navegador, após o deploy, CORS, diagnóstico, disponibilidade e todas as respostas antes de ativar o site.

Não invente uma URL de Web App, um ID de agenda ou qualquer dado da Paty. A URL depende de uma implantação real. Enquanto `mode` for `demo` — ou a URL estiver vazia — o navegador não consulta nem envia dados. Mesmo com configuração futura, um evento nasce apenas como **pendente**: não há confirmação automática, convite, e-mail, pagamento, WhatsApp automático, planilha ou banco de dados.

## Endpoints preparados

- `GET ?action=health`: diagnóstico sem revelar configuração.
- `GET ?action=availability&date=YYYY-MM-DD`: listas de horários disponíveis e indisponíveis, sem detalhes de eventos.
- `POST` com parâmetros de formulário (`URLSearchParams`) e `action=request`: valida, trava a seção crítica, verifica novamente conflitos e cria um evento pendente. Em uma repetição, o cliente reenvia o mesmo `requestId` para evitar outro evento.

Erros são respostas JSON seguras. Logs não incluem payloads, IDs, descrições de eventos ou stack traces. Nenhuma confirmação é automática e o botão de WhatsApp somente abre após clique explícito do cliente.

## Segurança, consentimento e retenção (Fase 7)

Além das propriedades anteriores, uma ativação futura exige `PRIVACY_POLICY_VERSION`, `MAX_REQUEST_BYTES`, `RATE_LIMIT_WINDOW_MINUTES`, `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_SALT` e `PENDING_RETENTION_DAYS`. Valores e o sal devem ser definidos manualmente; nenhum segredo verdadeiro pertence ao repositório. `setupExampleProperties()` apenas **retorna** exemplos fictícios e não salva nem registra valores.

O POST exige consentimento de privacidade separado, a versão vigente e formulário `application/x-www-form-urlencoded`. A limitação usa `CacheService` e uma chave SHA-256 do sal com o WhatsApp normalizado, nunca o telefone bruto. Repetições do mesmo `requestId` são verificadas antes da contagem e não criam duplicidade. `RATE_LIMITED` não revela limite, janela ou chave.

A retenção é exclusivamente manual: execute `previewExpiredPendingEvents()` para revisar totais e IDs técnicos e, somente depois, `cleanupExpiredPendingEvents(true)`. Sem `true`, nada é removido. Apenas eventos expirados cujo título começa com o prefixo pendente são elegíveis; eventos confirmados não são removidos. Não crie gatilho automático nesta fase.

O aviso de privacidade permanece em rascunho. A Paty deve revisar textos, versão, responsável e prazos antes da publicação. Nenhum envio confirma horário, nenhum deploy foi realizado e nenhuma agenda foi conectada.
