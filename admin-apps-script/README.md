# Painel administrativo privado — Fase 10A

## Objetivo e separação

Este diretório contém um **projeto Google Apps Script independente** para o painel privado da Pati MundoPet. Ele não faz parte do site estático e não reutiliza o projeto `apps-script/`, que continua sendo exclusivamente o backend público de pré-solicitações e disponibilidade.

A Fase 10A é estritamente de **leitura**. O navegador conversa somente com funções autenticadas do servidor por `google.script.run`; o servidor lê a planilha e os dois calendários e devolve objetos simples, sem IDs privados.

## Arquivos

- `Code.gs`: acesso, configuração, validação de esquema e consultas somente leitura.
- `Index.html`: estrutura semântica das seis áreas.
- `Styles.html`: identidade visual e responsividade.
- `App.html`: navegação, estados, filtros locais e renderização segura.
- `appsscript.json`: runtime V8 e os quatro escopos autorizados.

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
- [ ] Manifesto contém exatamente `spreadsheets`, `calendar`, `userinfo.email` e `script.send_mail`.
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
- [ ] Sem Q:S, confirmar que as ações permanecem desativadas.
- [ ] Com Q:S corretas e os calendários disponíveis, confirmar que as ações permitidas pelo status ficam habilitadas.
- [ ] Confirmar que solicitações RECUSADAS e CANCELADAS não exibem ações de escrita.
- [ ] Confirmar que solicitações PENDENTES, CANCELADAS e RECUSADAS exibem o botão "Excluir solicitação".
- [ ] Cadastrar e editar um cliente com endereço e horários habituais preenchidos; conferir que aparecem na ficha do cliente.
- [ ] Lançar um pagamento avulso para um cliente já cadastrado (menu Pagamentos → "Novo pagamento") e conferir que ele aparece na lista sem estar vinculado a nenhuma solicitação.

## Limitações preservadas após a Fase 10D-2

- Não cria, edita, pausa ou exclui bloqueios manualmente. Eventos de atendimento são criados ou removidos somente pelas ações explícitas de confirmar e cancelar.
- Não existe criação manual de atendimento nesta fase; confirmar uma solicitação cria somente o evento vinculado, e recorrências continuam fora de escopo.
- Não arquiva clientes e não cria atendimentos a partir do cadastro.
- Não envia mensagens, e-mails ou cobranças automaticamente; links de contato dependem de clique explícito.
- Não oferece gateway de pagamento.
- Relações avançadas de histórico permanecem reservadas para evolução posterior.

Não há fallback fictício nem simulação local de salvamento. Escritas são limitadas às operações administrativas explicitamente documentadas.

## Fase 10B — aprovação manual

As ações de confirmar, pedir informações, voltar a PENDENTE, recusar e cancelar são exclusivas do painel privado e exigem a conta administrativa autorizada. A escrita somente é habilitada quando `Solicitações!Q:S` contém, exatamente, `eventIdAtendimento`, `observaçãoAdministrativa` e `clienteId`, e ambos os calendários configurados estão acessíveis. Sem essa migração, a leitura continua disponível.

A confirmação relê a solicitação sob lock, revalida o intervalo e os dois calendários, cria um único evento privado e só então persiste `CONFIRMADO` e o ID. Se a planilha falhar, o evento recém-criado é removido; falhas de reconciliação nunca são corrigidas automaticamente. Nenhuma ação envia mensagens ou cria pagamentos.

## Fase 10C-1 — bloqueios de disponibilidade

O painel cria bloqueios temporizados, preservando qualquer minuto entre 08:30 e 18:00, e bloqueios de dia inteiro ou de vários dias **somente** no calendário configurado por `AVAILABILITY_CALENDAR_ID`. A data final de um bloqueio de dia inteiro é inclusiva na interface; o servidor converte essa data para o término exclusivo exigido pelo Google Agenda.

Cada bloqueio criado pelo painel recebe um UUID e um marcador privado. Isso torna a criação idempotente e permite que a exclusão confirme a identidade do evento no calendário de Disponibilidade. Bloqueios criados manualmente no Google Agenda continuam visíveis no painel e na Agenda, mas são identificados como gerenciados diretamente no Google Agenda e não podem ser excluídos pelo painel.

Criar ou excluir bloqueios não lê nem altera linhas de planilhas, não cria pagamentos e não envia mensagens. O site público passa a respeitar automaticamente esses períodos porque sua disponibilidade já consulta os calendários configurados. Recorrências continuam fora do escopo desta fase.


## Fase 10C-2 — edição segura

Bloqueios gerenciados podem ser editados no próprio evento, inclusive convertendo entre horário específico e dia inteiro. O painel preserva `eventId`, UUID e marcador, ignora somente o próprio evento ao procurar conflitos e aceita períodos adjacentes. Uma repetição com os mesmos dados é idempotente.

Antes da escrita, o servidor guarda período, tipo, título e descrição. Se uma alteração parcial falhar, ele tenta restaurar integralmente o mesmo evento; uma restauração impossível exige reconciliação manual. Eventos manuais permanecem somente leitura e nunca exibem ações de edição ou exclusão.

## Fase 10D-1 — clientes e pets

O módulo Clientes permite cadastrar e editar responsável, WhatsApp, e-mail, pets e observações. Cada criação recebe um UUID gerado no servidor e uma chave de operação por abertura do formulário, usada para tornar repetições idempotentes. Toda escrita exige a conta administrativa, adquire `LockService` e relê a aba completa dentro do lock antes de verificar identidade e duplicidades.

Na confirmação, a releitura do cliente compara o contrato lógico de cada campo. Em particular, o WhatsApp é normalizado porque o Google Sheets pode devolver como número uma sequência gravada como texto; UUID, unicidade, largura integral, demais campos e colunas internas continuam verificados antes de criar qualquer evento.

WhatsApp e e-mail são comparados em formato normalizado. Na edição, o próprio UUID é desconsiderado, enquanto `clienteId`, `dataCadastro`, `últimoAtendimento` e eventuais colunas internas permanecem inalterados. Textos e e-mails iniciados por caracteres interpretáveis como fórmula são neutralizados antes da gravação, sem exibir o marcador de segurança nem prejudicar o link de contato. Erros seguros aparecem dentro do formulário, preservando os valores para correção e nova tentativa. Após qualquer sucesso, o painel relê os dados iniciais, a agenda e os bloqueios antes de liberar novas escritas.

Arquivamento, histórico detalhado, atendimentos manuais, pagamentos e recorrências permanecem fora do escopo.

## Fase 10D-2 — exclusão de clientes

A exclusão fica disponível somente no formulário de edição e exige uma confirmação que identifica o cliente e explica o cancelamento dos horários futuros. Durante a operação, o modal bloqueia todos os controles; falhas mantêm o formulário aberto com uma mensagem segura. Após o sucesso, uma nova leitura atualiza clientes, contadores, agenda e bloqueios.

Sob `LockService`, o servidor relê o cliente pelo `clienteId` UUID e localiza solicitações `CONFIRMADO` futuras por WhatsApp ou e-mail normalizados. Cada horário só é liberado depois de confirmar o vínculo forte entre o `requestId`, a coluna `eventIdAtendimento` e o marcador privado do evento. O nome do cliente nunca é usado como identidade. Solicitações passadas, pagamentos e registros de outros contatos permanecem inalterados. Se a operação parcial falhar, os agendamentos já processados são compensados antes de retornar erro. A confirmação de preservação só é usada quando evento e solicitação foram restaurados; uma compensação incerta exige reconciliação administrativa e nunca permite excluir o cliente.


## Fase corretiva 10D-3A — vínculo definitivo e próximos agendamentos

Adicione manualmente `clienteId` em `Solicitações!S1`, imediatamente depois de `observaçãoAdministrativa`, sem remover ou reordenar linhas existentes. A aba passa a ter 19 colunas (A:S). Pré-solicitações públicas deixam S vazia; somente a confirmação administrativa grava ali um UUID definitivo.

Sob o lock administrativo, a confirmação compara WhatsApp e e-mail normalizados contra todos os clientes. Nenhuma correspondência cria um cliente; uma correspondência inequívoca reutiliza-o; contatos duplicados ou apontando para clientes diferentes exigem reconciliação antes de qualquer escrita. Cliente, evento marcado pelo `requestId` e solicitação confirmada são persistidos como uma unidade compensável: falhas removem o evento novo e restauram ou removem com verificação o cliente afetado.

A tela principal **Cliente**, aberta pelo cartão, consulta todos os próximos horários confirmados. O vínculo por `clienteId` tem prioridade; registros antigos sem vínculo usam contatos somente quando há um único proprietário seguro. A resposta expõe apenas data, início, término, serviço e pet.

## Notificações de decisão

Depois de comprovar a persistência de `CONFIRMADO`, `RECUSADO` ou `CANCELADO`, o painel grava `EMAIL_EM_PROCESSAMENTO`, comprova essa gravação e só então tenta enviar com `MailApp`. Em seguida registra e relê o resultado em `notificationStatus`, sem alterar A:S. `EMAIL_ENVIADO`, `EMAIL_FALHOU` e `EMAIL_NAO_INFORMADO` só são retornados como persistidos depois da releitura. Se o resultado final não puder ser comprovado, o estado intermediário bloqueia qualquer reenvio e o painel exige revisão administrativa. Falha ou ausência de e-mail nunca desfaz a decisão. Um reenvio explícito só fica disponível para o último resultado comprovado `EMAIL_FALHOU`; envio concluído, estado incerto, estado não terminal e repetição são recusados. O link “Avisar também pelo WhatsApp” apenas abre `wa.me` com texto preparado e nunca marca envio automático.

## Fase 11C-2B — rótulos de serviço

O Painel preserva os IDs técnicos na planilha e apresenta `Passeios` e `Dog Day Care` nas telas e nos eventos confirmados. Valores desconhecidos são mantidos como texto. A descrição do evento conserva o `requestId` e o `serviceId` para rastreabilidade; solicitações pendentes continuam sem evento.

## Correção — clientes recorrentes e pagamentos manuais

Antes de copiar esta versão para o projeto privado, adicione ao fim da aba `Clientes` o cabeçalho `observaçõesAdministrativas` (coluna I). Migre para essa coluna qualquer anotação manual que esteja hoje misturada em `observações`; a coluna `observações` passa a representar exclusivamente a observação da solicitação mais recentemente confirmada. Não é necessária nenhuma coluna nova em `Pagamentos`: o contrato continua exatamente `requestId`, `cliente`, `serviço`, `valor`, `formaPagamento`, `vencimento`, `statusPagamento`, `dataPagamento` e `observações`.

Uma confirmação com `clienteId` válido reutiliza esse UUID. Sem o vínculo, WhatsApp e e-mail normalizados só são aceitos quando indicam inequivocamente o mesmo cadastro. Responsável e contatos são atualizados, enquanto pets e observação da solicitação são substituídos (inclusive por observação vazia); cadastro, último atendimento, campos internos e `observaçõesAdministrativas` permanecem intactos.

A confirmação também cria, sob o mesmo lock e com releitura, um único pagamento `PIX`/`PENDENTE`, sem valor nem data de pagamento e com vencimento inicial na data do atendimento. O painel permite editar manualmente valor, vencimento, status e observações, sem editar `requestId`. `PAGO` registra a data da transição e `PENDENTE` a limpa. Os lembretes de vencimento usam `America/Sao_Paulo` e não enviam mensagens. Ao cancelar, `PENDENTE` vira `CANCELADO`, `ISENTO` é preservado e `PAGO` é preservado com sinalização para revisão; nenhum histórico é excluído.

## Correção — endereço completo, exclusão de recusadas e pagamento avulso

Antes de copiar esta versão para o projeto privado, migre a planilha (mesmo procedimento de sempre: colunas primeiro, código depois, sem reordenar ou remover colunas existentes):

1. Em `Solicitações`, adicione `endereço` na coluna **T** (imediatamente depois de `clienteId`, em S). A aba passa a ter 20 colunas (A:T). O backend público (`apps-script/Code.gs`) passa a aceitar e gravar esse campo automaticamente quando a coluna existir; enquanto ela não existir, o valor enviado pelo formulário é apenas descartado com segurança, sem quebrar o registro da pré-solicitação.
2. Em `Clientes`, adicione `endereço` na coluna **J** e `horáriosHabituais` na coluna **K** (depois de `observaçõesAdministrativas`, em I). A aba passa a ter 11 colunas (A:K). Ambos os campos são opcionais e editáveis a qualquer momento pelo formulário de cliente; não há sincronização automática entre o endereço da pré-ficha e o endereço do cadastro de cliente — a Pati decide se e quando quer levar um endereço recebido numa solicitação para a ficha do cliente.

Em vez de digitar esses cabeçalhos manualmente (risco de erro de acento/maiúscula que bloqueia a leitura do painel inteiro com `CONFIG_ERROR`), execute uma vez, pelo editor do Apps Script, a função `migrarColunasEnderecoEHorarios()` (selecione-a no seletor ao lado de "Executar" e clique em Executar). Ela cria as duas colunas automaticamente, sem nunca sobrescrever conteúdo existente, e reporta o resultado no Registro de execução.

Três correções de comportamento administrativo, sem mudança nos demais contratos:

- **Solicitações recusadas voltam a ser excluíveis.** `excluirSolicitacao` aceita `RECUSADO` junto de `PENDENTE` e `CANCELADO`; um pagamento vinculado (se existir) é removido junto, do mesmo jeito que já acontecia para os outros dois status.
- **Exclusão de cliente, de recusada e de qualquer solicitação continua sem depender de pagamento.** Isso já era verdade desde a Fase 12A (a exclusão de solicitação remove o pagamento vinculado em vez de bloquear) e desde a Fase 10D-2 (a exclusão de cliente nunca consultou pagamentos); nenhuma mudança adicional foi necessária além do item anterior.
- **Pagamento avulso.** A nova função `criarPagamento` lança um pagamento para qualquer cliente já cadastrado, sem depender de uma solicitação confirmada. Ela reutiliza o contrato de 9 colunas de `Pagamentos` sem alterá-lo: gera um identificador único no lugar de `requestId` (nunca reaproveitado pelas ações de confirmar, cancelar ou excluir solicitação, que só agem quando esse identificador corresponde a uma linha real de `Solicitações`) e copia o nome do responsável do cadastro selecionado para a coluna `cliente`, do mesmo jeito que a confirmação automática já faz hoje. Forma de pagamento é opcional e assume `PIX` quando não informada; valor, vencimento, status e observações seguem as mesmas regras de `editarPagamento`.

## Correção — reagendamento com atualização automática do calendário

Solicitações **confirmadas** agora podem ter data e horário alterados diretamente pelo painel, com o evento real do calendário de Atendimentos sendo movido junto — sem excluir e recriar o compromisso. O botão "Reagendar" aparece em dois lugares equivalentes: nos detalhes da própria solicitação (quando `CONFIRMADO`) e na lista de "Próximos agendamentos confirmados" dentro da ficha do cliente.

A nova função `reagendarSolicitacao` segue exatamente o mesmo padrão já usado em `editarBloqueio`: sob lock, relê a solicitação, confirma que o evento na agenda corresponde ao marcador do `requestId`, verifica que o novo período (08:30–18:00, término após o início, sem passado) não conflita com nenhum outro evento em nenhum dos dois calendários — ignorando apenas o próprio evento que está sendo movido — move o evento (`setTime`, mesmo `eventId`, sem criar um novo) e só então atualiza `data`, `horário` e `horárioTérmino` na planilha. Qualquer falha depois de mover o evento restaura o horário original antes de reportar erro; uma restauração que não pode ser comprovada exige revisão administrativa, nunca é ocultada como bem-sucedida.

Para que o cliente veja essa opção também na própria ficha, `listarProximosAgendamentosCliente` passou a expor `requestId` no retorno (antes só devolvia data, horários, serviço e pet) — os demais identificadores internos (`eventId`, `clienteId`) continuam fora da resposta.

## Correção — confirmação em grupo (exceção deliberada de sobreposição de horário)

Por padrão, o painel continua recusando qualquer confirmação cujo período conflite com um
atendimento já confirmado ou com um bloqueio de disponibilidade — exatamente como antes. A
única mudança é uma exceção estritamente manual: para o serviço **Passeios**, quando a
confirmação normal é recusada por já existir outro atendimento confirmado no mesmo horário, o
painel oferece uma segunda ação, distinta e claramente rotulada ("Confirmar em grupo"), que
confirma a solicitação mesmo assim — para quando a Pati decide, conscientemente, atender mais
de um cliente/pet no mesmo horário.

Essa exceção nunca se aplica a Dog Day Care (validado a partir do `serviço` da própria linha da
planilha, não da interface) e nunca ignora um bloqueio de disponibilidade. Reaproveita
integralmente `confirmRequest_` (mesmo lock, snapshot, compensação e verificação por releitura
em cada etapa); a única diferença é que o conflito contra `APPOINTMENTS_CALENDAR_ID` deixa de
bloquear, e a observação administrativa passa a ser obrigatória, garantindo rastreabilidade.

Também desde esta correção, o **site público** deixou de recusar o envio de uma pré-solicitação
só porque o horário já tem um atendimento confirmado — passa a recusar apenas quando o horário
tem um bloqueio de disponibilidade. A exclusividade de horário deixou de ser decidida no
envio; passou a ser decidida inteiramente na confirmação, pela Pati.

`reagendarSolicitacao` não foi alterada: mover uma solicitação já confirmada continua exigindo
um período totalmente livre, mesmo que a confirmação original tenha usado a exceção de grupo.

## Correções — testes reais da Pati: pagamento órfão, ordenação e pet por pagamento

Três ajustes feitos a partir de problemas encontrados pela própria Pati usando o painel:

**Excluir cliente não deixa mais pagamento pendente órfão.** `excluirCliente` já cancelava os
agendamentos futuros do cliente (evento excluído, solicitação levada a `CANCELADO`), mas o
pagamento vinculado a cada um permanecia `PENDENTE` para sempre — mesmo o atendimento nunca mais
acontecendo. Agora, ao cancelar cada agendamento, o painel também cancela o pagamento vinculado
exatamente quando o caso é inequívoco (um único pagamento vinculado a esse `requestId`, ainda
`PENDENTE`); pagamento já `PAGO`/`ISENTO`, ou duplicado, fica intocado para revisão manual em vez
de uma decisão arriscada. Segue o mesmo padrão de snapshot/compensação já usado no resto de
`excluirCliente`: se qualquer etapa posterior falhar, o pagamento cancelado volta a `PENDENTE`
junto com o resto da reversão.

**Lista de clientes em ordem alfabética.** A aba Clientes exibia os cadastros na ordem bruta da
planilha; agora aparecem ordenados pelo nome do responsável (`localeCompare` em pt-BR, mesmo
critério já usado no seletor de cliente do pagamento avulso).

**Pagamentos agora identificam a qual pet se referem.** Uma cliente pode ter mais de um pet com
formas de cobrança diferentes (ex.: um mensal, outro semanal) — sem precisar de um segundo
cadastro para o mesmo contato (que o painel recusa de propósito, para não duplicar WhatsApp/e-mail
e quebrar a exclusão e os "próximos agendamentos" do cliente). A aba Pagamentos ganhou uma 10ª
coluna, `pet` (criada por `migrarColunasEnderecoEHorarios`, que agora cuida das três abas):
- Ao confirmar uma solicitação (inclusive pelo caminho de confirmação em grupo) ou ao cancelar um
  atendimento sem pagamento prévio, o pet vem automaticamente da própria solicitação.
- Ao lançar um pagamento avulso (`criarPagamento`), a Pati escolhe o pet num seletor preenchido a
  partir dos pets já cadastrados do cliente selecionado — campo obrigatório.
- Ao editar qualquer pagamento (`editarPagamento`), o pet pode ser corrigido livremente.
- O card de pagamento passa a mostrar o pet ao lado do serviço quando informado.

## Correção — pagamento mensal (etiqueta de periodicidade)

A Pati pediu uma forma de marcar um pagamento como recorrente mensal. A aba Pagamentos ganhou
uma 11ª coluna opcional, `periodicidade` (também criada por `migrarColunasEnderecoEHorarios`),
com um único valor possível hoje: `Mensal` (ou vazio, o padrão). É só uma etiqueta manual — não
gera nada sozinha; a Pati continua lançando o pagamento avulso novo a cada mês, só que agora
pode marcar visualmente quais clientes/pets são recorrentes.

O checkbox "Pagamento mensal (recorrente)" aparece tanto ao lançar um pagamento avulso
(`criarPagamento`) quanto ao editar qualquer pagamento existente (`editarPagamento`), e o card de
pagamento mostra "Mensal" ao lado do pet quando marcado. Pagamentos criados automaticamente (pela
confirmação de uma solicitação, inclusive em grupo, ou pelo cancelamento legado) nascem sempre
sem essa marcação — só é ativada manualmente.

## Correção — editar horário direto da Agenda, e reagendar também nos detalhes da solicitação

Antes, mudar o horário de um atendimento só era possível a partir da ficha do cliente
("Próximos agendamentos confirmados") — a Pati pediu para conseguir alterar o horário de
qualquer lugar que mostre o atendimento, incluindo a própria aba Agenda.

`consultarAgendaDia`/`consultarAgendaSemana` (e o resumo da aba Início, que usa a mesma leitura)
passam a expor o `requestId` de cada atendimento, extraído do marcador já gravado na descrição do
evento (`requestIdFromDescription_`, mesmo padrão de `blockIdentity_` já usado para bloqueios).
Bloqueios nunca expõem `requestId` — a extração só acontece para eventos do calendário de
Atendimentos.

Com isso, qualquer card de atendimento na Agenda (visão Dia, Semana, ou no resumo da tela
Início) fica clicável e abre exatamente os mesmos detalhes e as mesmas ações já disponíveis na
aba Solicitações (reagendar, cancelar, etc.) — a mesma solicitação carregada em memória, casada
pelo `requestId`, sem nenhuma consulta nova ao servidor. Se por algum motivo a solicitação
correspondente não for encontrada na lista carregada, o painel avisa e pede para atualizar os
dados, em vez de falhar silenciosamente.

Além disso, o botão **Reagendar** passou a aparecer também nos detalhes de uma solicitação
`CONFIRMADO` (antes só existia na ficha do cliente) — reaproveita integralmente `showReschedule`
e `reagendarSolicitacao`, sem nenhuma lógica nova de escrita.
