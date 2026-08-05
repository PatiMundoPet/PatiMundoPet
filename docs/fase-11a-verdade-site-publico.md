# Fase 11A — verdade do site público

## Objetivo

Manter o site público fiel ao funcionamento atual da Pati MundoPet, sem publicar
serviços, horários, números, avaliações ou recursos que não tenham sido
confirmados.

## Serviços públicos

O site apresenta somente:

1. **Passeios** — podem ser enviados como pré-solicitação pelo formulário;
2. **Dog sitter** — detalhes, disponibilidade e valores são combinados
   diretamente com a Pati pelo WhatsApp.

Dog sitter não aparece como opção do formulário, não utiliza o valor
`dog-sitter` e ainda não faz parte do contrato funcional aceito pelo backend.
O formulário integrado envia exatamente:

```text
id: passeio-individual
label: Passeios
```

## Fluxo comercial

O envio do formulário não confirma o atendimento. A Pati analisa a solicitação e
entra em contato pelo WhatsApp informado. Disponibilidade e valores são
combinados nessa conversa. O pagamento é via Pix, sem checkout ou cobrança
automática no site.

## Estrutura pública

A ordem da página é:

1. Início;
2. Quem é a Pati;
3. Serviços;
4. O caminho do passeio;
5. Projetos e colaborações;
6. Agendar;
7. CTA final;
8. Rodapé.

Menu desktop, menu mobile e navegação do rodapé usam os mesmos destinos.

## Compatibilidade preservada

O rótulo público `Nome do cão` preserva o identificador interno `pet` e não
altera `petName`, colunas ou payloads. O WhatsApp permanece obrigatório para o
contato da Pati.

Esta fase não modifica backend, APIs, autenticação, autorização, Painel Privado,
Google Sheets, Google Calendar, configuração de integração ou scripts do cliente
de agendamento. As áreas `apps-script/`, `admin-apps-script/`,
`assets/js/scheduling.js`, `assets/js/scheduling-api.js` e
`content/integration.json` permanecem intactas.
