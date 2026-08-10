# Fase 11D — diagnóstico seguro do Painel Privado

## Resultado da investigação com a evidência da Versão 13

A execução da implantação Versão 13 retornou `PERSISTENCE_FAILED` com a mensagem
“Não foi possível salvar o cliente”, mantendo a solicitação `PENDENTE`. Isso
localiza a falha antes da criação do evento: `writeConfirmationClient_` gravou o
cliente, executou `SpreadsheetApp.flush()` e não conseguiu comprovar a linha na
releitura, ou a própria gravação/flush falhou.

A condição foi reproduzida fazendo o mock se comportar como a Planilha: uma
sequência numérica escrita no campo WhatsApp pode ser relida por `getValues()`
como `Number`. O verificador anterior comparava toda a linha com igualdade estrita;
portanto `"5500000000000" !== 5500000000000`, apesar de ambos representarem o
mesmo WhatsApp normalizado. Ele tratava uma gravação válida como falha, removia o
cliente pela compensação e retornava exatamente o erro observado na Versão 13.

A correção mantém a releitura e a exigência de exatamente um UUID. A linha inteira
continua validada, mas campos com representação legítima da Planilha são comparados
pelo contrato: UUID aparado sem diferença de caixa, WhatsApp normalizado, e-mail
normalizado, datas com precisão de segundos e demais campos integralmente como
texto. UUID ausente/divergente, duplicado, coluna extra divergente ou qualquer
outro dado alterado continuam falhando e acionando compensação/reconciliação.

A comparação entre `723ad9b` (imediatamente anterior ao PR #41) e `f7e6ab8`
encontrou somente quatro alterações no caminho de confirmação: rótulo do serviço
na resposta de leitura, rótulo em agendamentos do cliente, título legível do
evento e a linha `serviceId` na descrição. O RPC continua enviando apenas o
`requestId`; o serviço exibido não volta ao servidor. Todas as quatro alterações
passam no cenário Dog Day Care e nenhuma reproduz uma confirmação interrompida.

## Caminho auditado

1. `App.html` impede uma segunda escrita com `state.writing`, chama
   `confirmarSolicitacao(requestId)` e separa falha da escrita de falha do refresh.
2. `safelyWrite_` lê e valida propriedades, autoriza o usuário, valida UUID e nota,
   obtém lock, valida estrutura/agendas e sempre libera o lock.
3. `requestContext_` relê a aba sob lock, localiza o código e agora exige exatamente
   uma linha antes de qualquer ação.
4. `confirmRequest_` valida transição e vínculos inesperados, resolve/cria/vincula
   exatamente um cliente, valida intervalo e conflitos nas duas agendas, cria e
   relê o evento, persiste e relê solicitação/cliente/evento.
5. Em falha parcial, as compensações tentam remover evento, restaurar/criar cliente
   e restaurar a linha; uma compensação não comprovada vira
   `RECONCILIATION_REQUIRED`.
6. O RPC retorna `{ok,data}`. Só depois o frontend recarrega solicitações, clientes,
   pagamentos e resumo. Se esse refresh falhar, a escrita é tratada como concluída,
   novas ações ficam bloqueadas e o painel exige atualização.

## Barreiras cobertas pelos testes

- autorização e propriedades obrigatórias;
- contrato nominal e posicional completo de A:S, inclusive alteração de qualquer
  um dos 19 cabeçalhos;
- calendários configurados e `writesConfigured_`;
- UUID inválido, solicitação ausente e `requestId` duplicado;
- status, transições e vínculos inesperados de evento/cliente;
- data/hora literal ou `Date`, passado, limites 08:30–18:00 e conflitos nas agendas
  de atendimentos e disponibilidade;
- cliente inexistente, encontrado por WhatsApp, por e-mail ou pelos dois;
- WhatsApp duplicado (`DUPLICATE_WHATSAPP`), e-mail duplicado
  (`DUPLICATE_EMAIL`) e contatos em clientes diferentes
  (`CLIENT_IDENTITY_CONFLICT`);
- falhas de criação, escrita, flush e releitura de cliente/evento/solicitação;
- compensação comprovada e estado que exige reconciliação;
- idempotência, lock, duplo clique, resposta RPC e refresh pós-escrita;
- demais transições, cancelamento com remoção do evento e exclusão segura.

## Defeito independente comprovado e corrigido

Foi reproduzida uma fragilidade anterior: escritas comuns interrompiam a busca na
primeira ocorrência do `requestId`; assim, duas linhas iguais não eram detectadas
e a primeira podia ser alterada. O novo teste falha no código anterior porque um
cliente e um evento são criados. A correção percorre todas as linhas e bloqueia a
ação sem efeitos com `RECONCILIATION_REQUIRED`. Isso melhora segurança e
diagnóstico, mas **não é apresentado como a causa do incidente real**, pois não
há evidência de que o código real esteja duplicado.

A validação de A:S também deixou de conferir apenas quantidade e quatro posições:
ela agora compara explicitamente nome e posição de todos os 19 cabeçalhos. A
estrutura não foi alterada; uma linha pública A:P com Q:S vazias continua aceita.

## Verificação manual necessária após o merge

Sem alterar dados manualmente, a nova versão deve ser implantada e a mesma ação
deve ser executada uma vez no ambiente autorizado, conferindo somente:

- o código seguro retornado pelo RPC;
- se o painel mostrou a mensagem de “operação concluída, atualização falhou”;
- nomes (não valores) das Script Properties ausentes, se `CONFIG_ERROR`;
- para a linha afetada: quais destes campos estão vazios/preenchidos e se o formato
  é válido, sem conteúdo: `requestId`, `status`, `serviço`, `data`, `horário`,
  `horárioTérmino`, `eventIdAtendimento`, `clienteId`;
- quantidade de linhas com o mesmo `requestId`, WhatsApp normalizado e e-mail
  normalizado, sem revelar os valores;
- existência de conflito em cada calendário no intervalo, sem título, descrição
  ou ID do evento;
- em caso de reconciliação, apenas quais releituras divergiram: solicitação,
  cliente e/ou evento.

Não são necessários nem devem ser compartilhados IDs de planilha/calendário,
e-mails, telefones, credenciais, stack trace ou conteúdo integral de linhas.
