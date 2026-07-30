# Painel administrativo privado — Fase 10A

## Objetivo e separação

Este diretório contém um **projeto Google Apps Script independente** para o painel privado da Pati MundoPet. Ele não faz parte do site estático e não reutiliza o projeto `apps-script/`, que continua sendo exclusivamente o backend público de pré-solicitações e disponibilidade.

A Fase 10A é estritamente de **leitura**. O navegador conversa somente com funções autenticadas do servidor por `google.script.run`; o servidor lê a planilha e os dois calendários e devolve objetos simples, sem IDs privados.

## Arquivos

- `Code.gs`: acesso, configuração, validação de esquema e consultas somente leitura.
- `Index.html`: estrutura semântica das seis áreas.
- `Styles.html`: identidade visual e responsividade.
- `App.html`: navegação, estados, filtros locais e renderização segura.
- `appsscript.json`: runtime V8 e os três escopos autorizados.

## Escopos e autorização

O manifesto utiliza `https://www.googleapis.com/auth/spreadsheets` porque `SpreadsheetApp.openById()` exigiu essa permissão no teste da implantação real. Esse escopo de serviço mais amplo não muda os limites da Fase 10A: o painel continua estritamente somente leitura e seu código não possui métodos de gravação. Os calendários permanecem protegidos pelo escopo `https://www.googleapis.com/auth/calendar.readonly`.

A implantação permanece exclusiva em `MYSELF`, e toda leitura continua protegida pela comparação da conta ativa com `ADMIN_EMAIL`.

## Criar o projeto separado

1. Entre na conta Google que será a única administradora.
2. Crie um projeto **novo** e independente em Google Apps Script. Não use nem vincule o projeto do backend público.
3. Crie no editor arquivos com os mesmos nomes e tipos deste diretório e copie seus conteúdos.
4. Substitua o manifesto do projeto pelo `appsscript.json` (ative a exibição do manifesto nas configurações do editor, se necessário).
5. Em **Configurações do projeto > Propriedades do script**, cadastre todas as propriedades abaixo.
6. Execute uma consulta no editor para conceder somente as permissões solicitadas no manifesto.
7. Faça a implantação privada descrita abaixo e teste com a conta autorizada.

## Propriedades obrigatórias

Nenhum valor real deve ser versionado. Cadastre diretamente nas propriedades do projeto:

| Propriedade | Finalidade |
|---|---|
| `ADMIN_EMAIL` | Conta única autorizada |
| `SPREADSHEET_ID` | Planilha administrativa |
| `APPOINTMENTS_CALENDAR_ID` | Calendário de atendimentos |
| `AVAILABILITY_CALENDAR_ID` | Calendário de indisponibilidades |
| `TIMEZONE` | Fuso operacional |
| `WORKDAY_START_TIME` | Início da jornada |
| `WORKDAY_END_TIME` | Final da jornada |

Os valores operacionais exigidos pelo código são: fuso `America/Sao_Paulo` e jornada de `08:30` a `18:00`. Início e término podem ocorrer em qualquer minuto dentro desses limites. A agenda é uma lista cronológica baseada exclusivamente nos eventos reais dos dois calendários, sem grade ou duração fixa. O painel permanece somente leitura, e toda solicitação pública continua com status `PENDENTE` até uma aprovação manual futura da Pati.

## Implantação obrigatoriamente privada

1. Escolha **Implantar > Nova implantação > App da Web**.
2. Configure a execução como **usuário que acessa o app**.
3. Restrinja o acesso exclusivamente à conta autorizada (`MYSELF` / somente eu, conforme o texto mostrado pelo Google).
4. Confira que a conta conectada corresponde a `ADMIN_EMAIL`.
5. Nunca selecione acesso público, anônimo, “qualquer pessoa” ou “qualquer pessoa com o link”.
6. Não publique a URL no site, documentação pública, planilha ou repositório.

A restrição da implantação é a primeira camada. Toda função de leitura também compara `Session.getActiveUser().getEmail()` com `ADMIN_EMAIL` e falha de forma segura se a identidade estiver vazia, ausente ou diferente.

## Checklist de segurança

- [ ] Projeto administrativo separado do backend público.
- [ ] Web App acessível somente pela conta administradora.
- [ ] `ADMIN_EMAIL` definido apenas em Script Properties.
- [ ] IDs definidos apenas em Script Properties.
- [ ] Nenhuma propriedade ou URL privada inserida nos arquivos.
- [ ] Manifesto contém exatamente `spreadsheets`, `calendar.readonly` e `userinfo.email`.
- [ ] Código administrativo permanece sem métodos de gravação, apesar do escopo `spreadsheets` exigido por `SpreadsheetApp.openById()`.
- [ ] Implantação não permite acesso público ou anônimo.
- [ ] Conta sem autorização recebe “Acesso negado”.
- [ ] Valores das fontes são apresentados como texto, nunca executados como HTML ou URL.

## Checklist de teste manual

- [ ] Abrir o Web App com a conta autorizada e conferir o carregamento inicial.
- [ ] Abrir com outra conta e confirmar o acesso negado.
- [ ] Remover temporariamente uma propriedade e confirmar o erro seguro de configuração.
- [ ] Conferir as seis áreas no menu desktop e no menu móvel.
- [ ] Testar busca e filtros de Solicitações, Clientes e Pagamentos.
- [ ] Conferir estados vazios nas três listas.
- [ ] Alternar Agenda entre Dia e Semana e mudar a data.
- [ ] Confirmar a lista cronológica com início e término reais.
- [ ] Conferir eventos temporizados e de dia inteiro sem duplicação.
- [ ] Confirmar que solicitações pendentes não aparecem como ocupação na agenda.
- [ ] Consultar intervalos sem bloqueios e com bloqueios.
- [ ] Abrir e fechar detalhes por teclado; testar Escape e retenção/retorno do foco.
- [ ] Confirmar que WhatsApp/e-mail abrem somente após clique e apenas com dados válidos.
- [ ] Sem Q:R, confirmar que as ações permanecem desativadas.
- [ ] Com Q:R corretas e os calendários disponíveis, confirmar que as ações permitidas pelo status ficam habilitadas.
- [ ] Confirmar que solicitações RECUSADAS e CANCELADAS não exibem ações de escrita.

## Limitações preservadas após a Fase 10B

- Não cria, edita, pausa ou exclui bloqueios manualmente. Eventos de atendimento são criados ou removidos somente pelas ações explícitas de confirmar e cancelar.
- Não existe criação manual de atendimento nesta fase; confirmar uma solicitação cria somente o evento vinculado, e recorrências continuam fora de escopo.
- Não edita clientes nem adiciona pets.
- Não registra, edita ou altera pagamentos.
- Não envia mensagens, e-mails ou cobranças automaticamente; links de contato dependem de clique explícito.
- Não oferece gateway de pagamento.
- Relações avançadas de histórico permanecem reservadas para evolução posterior.

Não há fallback fictício nem simulação local de salvamento. As únicas escritas desta fase são as transições explícitas de solicitações.

## Fase 10B — aprovação manual

As ações de confirmar, pedir informações, voltar a PENDENTE, recusar e cancelar são exclusivas do painel privado e exigem a conta administrativa autorizada. A escrita somente é habilitada quando `Solicitações!Q:R` contém, exatamente, `eventIdAtendimento` e `observaçãoAdministrativa`, e ambos os calendários configurados estão acessíveis. Sem essa migração, a leitura continua disponível.

A confirmação relê a solicitação sob lock, revalida o intervalo e os dois calendários, cria um único evento privado e só então persiste `CONFIRMADO` e o ID. Se a planilha falhar, o evento recém-criado é removido; falhas de reconciliação nunca são corrigidas automaticamente. Nenhuma ação envia mensagens ou cria pagamentos.

## Fase 10C-1 — bloqueios de disponibilidade

O painel cria bloqueios temporizados, preservando qualquer minuto entre 08:30 e 18:00, e bloqueios de dia inteiro ou de vários dias **somente** no calendário configurado por `AVAILABILITY_CALENDAR_ID`. A data final de um bloqueio de dia inteiro é inclusiva na interface; o servidor converte essa data para o término exclusivo exigido pelo Google Agenda.

Cada bloqueio criado pelo painel recebe um UUID e um marcador privado. Isso torna a criação idempotente e permite que a exclusão confirme a identidade do evento no calendário de Disponibilidade. Bloqueios criados manualmente no Google Agenda continuam visíveis no painel e na Agenda, mas são identificados como gerenciados diretamente no Google Agenda e não podem ser excluídos pelo painel.

Criar ou excluir bloqueios não lê nem altera linhas de planilhas, não cria pagamentos e não envia mensagens. O site público passa a respeitar automaticamente esses períodos porque sua disponibilidade já consulta os calendários configurados. Edição e recorrências continuam fora do escopo desta fase.
