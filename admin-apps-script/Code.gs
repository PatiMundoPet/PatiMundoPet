/**
 * Pati MundoPet — painel administrativo privado.
 */
var ADMIN = Object.freeze({
  properties: ['ADMIN_EMAIL', 'SPREADSHEET_ID', 'APPOINTMENTS_CALENDAR_ID', 'AVAILABILITY_CALENDAR_ID', 'TIMEZONE', 'WORKDAY_START_TIME', 'WORKDAY_END_TIME'],
  sheets: {
    requests: { name: 'Solicitações', headers: ['requestId', 'dataRecebimento', 'submissionChannel', 'serviço', 'data', 'horário', 'responsável', 'WhatsApp', 'e-mail', 'pet', 'região', 'observações', 'status', 'notificationStatus', 'dataÚltimaAtualização', 'horárioTérmino', 'eventIdAtendimento', 'observaçãoAdministrativa', 'clienteId', 'endereço'] },
    clients: { name: 'Clientes', headers: ['clienteId', 'responsável', 'WhatsApp', 'e-mail', 'pets', 'observações', 'dataCadastro', 'últimoAtendimento', 'observaçõesAdministrativas', 'endereço', 'horáriosHabituais'] },
    payments: { name: 'Pagamentos', headers: ['requestId', 'cliente', 'serviço', 'valor', 'formaPagamento', 'vencimento', 'statusPagamento', 'dataPagamento', 'observações'] }
  },
  requestStatuses: ['PENDENTE', 'CONFIRMADO', 'RECUSADO', 'CANCELADO', 'MAIS_INFORMACOES'],
  paymentStatuses: ['PENDENTE', 'PAGO', 'ISENTO', 'CANCELADO']
});

function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('Pati MundoPet — Painel privado')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function carregarDadosIniciais() {
  return safelyRead_(function (config) {
    var requests = readSheet_(config, ADMIN.sheets.requests, mapRequest_);
    var clients = readSheet_(config, ADMIN.sheets.clients, mapClient_);
    var payments = readSheet_(config, ADMIN.sheets.payments, mapPayment_);
    var today = Utilities.formatDate(new Date(), config.TIMEZONE, 'yyyy-MM-dd');
    var range = dayRange_(today, config.TIMEZONE);
    var end = new Date(range.start.getTime() + 7 * 86400000);
    var appointments = readCalendar_(config.APPOINTMENTS_CALENDAR_ID, range.start, end, config.TIMEZONE, 'atendimento');
    var blocks = readCalendar_(config.AVAILABILITY_CALENDAR_ID, range.start, end, config.TIMEZONE, 'bloqueio');
    return {
      requests: requests,
      clients: clients,
      payments: payments,
      summary: {
        pendingRequests: countStatus_(requests, 'status', ['PENDENTE']),
        appointmentsToday: appointments.filter(function (event) { return overlapsDay_(event, today); }).length,
        nextAppointments: appointments.length,
        pendingPayments: countStatus_(payments, 'status', ['PENDENTE']),
        paymentsDueToday: payments.filter(function (payment) { return payment.status === 'PENDENTE' && payment.dueDate === today; }).length,
        overduePayments: payments.filter(function (payment) { return payment.status === 'PENDENTE' && payment.dueDate && payment.dueDate < today; }).length,
        agenda: appointments.slice(0, 8),
        blocksNextSevenDays: blocks.length
      },
      settings: publicSettings_(config),
      today: today,
      writesConfigured: writesConfigured_(config)
    };
  });
}

function listarSolicitacoes() {
  return safelyRead_(function (config) { return readSheet_(config, ADMIN.sheets.requests, mapRequest_); });
}

function listarClientes() {
  return safelyRead_(function (config) { return readSheet_(config, ADMIN.sheets.clients, mapClient_); });
}

function listarProximosAgendamentosCliente(clientId) {
  var config;
  try { config = getConfig_(); authorize_(config); validateUuid_(clientId); clientId = clientId.trim(); }
  catch (error) { if (error && error.safeCode) throw error; throw safeError_('INVALID_REQUEST', 'O cliente informado é inválido.'); }
  try {
    var source = clientSheet_(config), matches = clientMatches_(source, { clientId: clientId, whatsapp: '', email: '' });
    if (!matches.byId) throw safeError_('CLIENT_NOT_FOUND', 'O cliente não foi encontrado. Atualize os dados e tente novamente.');
    if (matches.idCount !== 1) throw safeError_('RECONCILIATION_REQUIRED', 'O cadastro precisa de revisão antes de continuar.');
    return { ok: true, data: futureClientAppointments_(config, matches.byId, source.headers).map(function (link) {
      return {
        requestId: link.requestId,
        date: Utilities.formatDate(link.interval.start, config.TIMEZONE, 'yyyy-MM-dd'),
        startTime: Utilities.formatDate(link.interval.start, config.TIMEZONE, 'HH:mm'),
        endTime: Utilities.formatDate(link.interval.end, config.TIMEZONE, 'HH:mm'),
        service: serviceLabel_(link.values[link.headers.indexOf('serviço')]),
        pet: text_(link.values[link.headers.indexOf('pet')])
      };
    }).sort(function (a, b) { return (a.date + 'T' + a.startTime).localeCompare(b.date + 'T' + b.startTime); }) };
  } catch (error) {
    if (error && error.safeCode) throw error;
    console.error('ADMIN_CLIENT_APPOINTMENTS_READ_FAILED');
    throw safeError_('READ_ERROR', 'Não foi possível consultar os agendamentos agora.');
  }
}

function cadastrarCliente(payload) { return saveClient_(payload, false); }
function editarCliente(payload) { return saveClient_(payload, true); }

function excluirCliente(clientId) {
  var config;
  try { config = getConfig_(); authorize_(config); validateUuid_(clientId); clientId = clientId.trim(); }
  catch (error) { if (error && error.safeCode) throw error; throw safeError_('INVALID_CLIENT', 'O cliente informado é inválido.'); }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw safeError_('LOCK_TIMEOUT', 'O painel está ocupado. Tente novamente.');
  try {
    var source = clientSheet_(config), matches = clientMatches_(source, { clientId: clientId, whatsapp: '', email: '' });
    if (!matches.byId) throw safeError_('CLIENT_NOT_FOUND', 'O cliente não foi encontrado. Atualize os dados e tente novamente.');
    if (matches.idCount !== 1) throw safeError_('RECONCILIATION_REQUIRED', 'O cadastro precisa de revisão antes de continuar.');
    var target = matches.byId, links = futureClientAppointments_(config, target, source.headers);
    cancelClientAppointments_(links);
    try { source.sheet.deleteRow(target.rowNumber); SpreadsheetApp.flush(); }
    catch (deleteError) {
      if (!restoreClientAppointments_(links)) throw safeError_('RECONCILIATION_REQUIRED', 'A operação precisa de revisão administrativa.');
      throw safeError_('WRITE_ERROR', 'Não foi possível excluir o cliente. Os dados foram preservados.');
    }
    return { ok: true, data: { deleted: true, canceledAppointments: links.length } };
  } catch (error) {
    if (error && error.safeCode) throw error;
    console.error('ADMIN_CLIENT_DELETE_FAILED');
    throw safeError_('WRITE_ERROR', 'Não foi possível excluir o cliente. Os dados foram preservados.');
  } finally { lock.releaseLock(); }
}

function futureClientAppointments_(config, client, clientHeaders) {
  validateUuid_(client.clientId);
  var phone = normalizeStoredWhatsapp_(client.values[clientHeaders.indexOf('WhatsApp')]);
  var email = clientEmailKey_(client.values[clientHeaders.indexOf('e-mail')]);
  var clientRows = clientSheet_(config).rows;
  var source = requestSheet_(config), count = source.sheet.getLastRow() - 1;
  var rows = count > 0 ? source.sheet.getRange(2, 1, count, source.headers.length).getValues() : [];
  var indexes = {}; source.headers.forEach(function (header, index) { indexes[header] = index; });
  ['requestId', 'status', 'data', 'horário', 'horárioTérmino', 'eventIdAtendimento', 'clienteId', 'WhatsApp', 'e-mail'].forEach(function (header) { if (indexes[header] === undefined) throw safeError_('CONFIG_ERROR', 'Os dados dos agendamentos precisam ser revisados.'); });
  var calendar = CalendarApp.getCalendarById(config.APPOINTMENTS_CALENDAR_ID);
  if (!calendar) throw safeError_('CONFIG_ERROR', 'A agenda de atendimentos precisa ser revisada.');
  var now = new Date().getTime(), links = [];
  rows.forEach(function (row, index) {
    if (String(row[indexes.status] || '').trim().toUpperCase() !== 'CONFIRMADO') return;
    var context = { config: config, record: {}, values: row, headers: source.headers };
    source.headers.forEach(function (header, column) { context.record[header] = row[column]; });
    var interval; try { interval = interval_(context); } catch (error) { if (error.safeCode === 'INTERVAL_UNAVAILABLE') return; throw safeError_('RECONCILIATION_REQUIRED', 'Um agendamento futuro precisa de revisão.'); }
    if (interval.start.getTime() <= now) return;
    var linkedId = String(row[indexes.clienteId] || '').trim(), belongs = false;
    if (linkedId) { validateUuid_(linkedId); belongs = linkedId === client.clientId; }
    else {
      var requestPhone = normalizeStoredWhatsapp_(row[indexes.WhatsApp]), requestEmail = clientEmailKey_(row[indexes['e-mail']]);
      if (!((phone && requestPhone === phone) || (email && requestEmail === email))) return;
      var ownerIds = [];
      clientRows.forEach(function (clientRow) { var ownerId = String(clientRow[clientHeaders.indexOf('clienteId')] || '').trim(); if ((requestPhone && normalizeStoredWhatsapp_(clientRow[clientHeaders.indexOf('WhatsApp')]) === requestPhone) || (requestEmail && clientEmailKey_(clientRow[clientHeaders.indexOf('e-mail')]) === requestEmail)) if (ownerIds.indexOf(ownerId) < 0) ownerIds.push(ownerId); });
      if (ownerIds.length !== 1) throw safeError_('RECONCILIATION_REQUIRED', 'O vínculo do agendamento precisa de revisão.');
      belongs = ownerIds[0] === client.clientId;
    }
    if (!belongs) return;
    var requestId = String(row[indexes.requestId] || '').trim(); validateUuid_(requestId);
    var eventId = String(row[indexes.eventIdAtendimento] || '').trim(), event = eventId && calendar.getEventById(eventId);
    if (!eventMatches_(event, requestId)) throw safeError_('RECONCILIATION_REQUIRED', 'Um agendamento futuro precisa de revisão.');
    links.push({ sheet: source.sheet, rowNumber: index + 2, headers: source.headers, values: row.slice(), event: event, calendar: calendar, requestId: requestId, interval: interval, title: event.getTitle(), description: event.getDescription() });
  });
  return links;
}
function cancelClientAppointments_(links) {
  var completed = [];
  try {
    links.forEach(function (link) {
      link.event.deleteEvent(); completed.push(link);
      var canceled = link.values.slice(); canceled[link.headers.indexOf('status')] = 'CANCELADO'; canceled[link.headers.indexOf('eventIdAtendimento')] = ''; canceled[link.headers.indexOf('dataÚltimaAtualização')] = new Date();
      link.sheet.getRange(link.rowNumber, 1, 1, link.headers.length).setValues([canceled]); SpreadsheetApp.flush();
    });
  } catch (error) {
    if (!completed.length || restoreClientAppointments_(completed)) throw safeError_('WRITE_ERROR', 'Não foi possível excluir o cliente. Os dados foram preservados.');
    throw safeError_('RECONCILIATION_REQUIRED', 'A operação precisa de revisão administrativa.');
  }
}
function restoreClientAppointments_(links) {
  try {
    links.slice().reverse().forEach(function (link) {
      var restored = link.calendar.createEvent(link.title, link.interval.start, link.interval.end, { description: link.description });
      if (!eventMatches_(restored, link.requestId)) { try { restored.deleteEvent(); } catch (ignored) {} throw new Error('invalid restored marker'); }
      var values = link.values.slice(); values[link.headers.indexOf('eventIdAtendimento')] = restored.getId();
      try { link.sheet.getRange(link.rowNumber, 1, 1, link.headers.length).setValues([values]); SpreadsheetApp.flush(); }
      catch (writeError) { try { restored.deleteEvent(); } catch (ignored) {} throw writeError; }
    });
    return true;
  } catch (error) { console.error('ADMIN_CLIENT_RESTORE_FAILED'); return false; }
}

function saveClient_(payload, editing) {
  var config, input;
  try {
    config = getConfig_(); authorize_(config); input = validateClientInput_(payload, editing);
  } catch (error) {
    if (error && error.safeCode) throw error;
    throw safeError_('INVALID_CLIENT', 'Revise os dados do cliente.');
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw safeError_('LOCK_TIMEOUT', 'O painel está ocupado. Tente novamente.');
  try {
    var source = clientSheet_(config), matches = clientMatches_(source, input), target;
    if (editing) {
      target = matches.byId;
      if (!target) throw safeError_('CLIENT_NOT_FOUND', 'O cliente não foi encontrado. Atualize os dados e tente novamente.');
      if (matches.idCount !== 1) throw safeError_('RECONCILIATION_REQUIRED', 'O cadastro precisa de revisão antes de continuar.');
    } else {
      var rememberedId = PropertiesService.getScriptProperties().getProperty(clientOperationKey_(input.operationId));
      var remembered = rememberedId && matches.rows.filter(function (item) { return item.clientId === rememberedId; })[0];
      if (remembered) return { ok: true, data: { clientId: remembered.clientId, idempotent: true } };
    }
    if (matches.phoneDuplicate) throw safeError_('DUPLICATE_WHATSAPP', 'Já existe um cliente com este WhatsApp.');
    if (matches.emailDuplicate) throw safeError_('DUPLICATE_EMAIL', 'Já existe um cliente com este e-mail.');
    if (editing) {
      var updated = target.values.slice();
      setClientFormFields_(updated, source.headers, input);
      source.sheet.getRange(target.rowNumber, 1, 1, source.headers.length).setValues([updated]);
      SpreadsheetApp.flush();
      return { ok: true, data: { clientId: target.clientId, updated: true } };
    }
    var clientId = Utilities.getUuid(); validateUuid_(clientId);
    var row = source.headers.map(function () { return ''; });
    row[source.headers.indexOf('clienteId')] = clientId;
    setClientFormFields_(row, source.headers, input);
    row[source.headers.indexOf('dataCadastro')] = new Date();
    source.sheet.appendRow(row); SpreadsheetApp.flush();
    PropertiesService.getScriptProperties().setProperty(clientOperationKey_(input.operationId), clientId);
    return { ok: true, data: { clientId: clientId, created: true } };
  } catch (error) {
    if (error && error.safeCode) throw error;
    console.error('ADMIN_CLIENT_WRITE_FAILED');
    throw safeError_('WRITE_ERROR', 'Não foi possível salvar o cliente. Os demais dados foram preservados.');
  } finally { lock.releaseLock(); }
}

function validateClientInput_(payload, editing) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw safeError_('INVALID_CLIENT', 'Revise os dados do cliente.');
  var operationId = String(payload.operationId || '').trim(); validateUuid_(operationId);
  var clientId = String(payload.clientId || '').trim();
  if (editing) validateUuid_(clientId); else if (clientId) throw safeError_('INVALID_CLIENT', 'Revise os dados do cliente.');
  var responsible = cleanClientText_(payload.responsible, 120, true, 'responsável');
  var whatsapp = normalizeClientWhatsapp_(payload.whatsapp);
  var email = normalizeClientEmail_(payload.email);
  if (!whatsapp && !email) throw safeError_('INVALID_CLIENT', 'Informe um WhatsApp ou e-mail válido.');
  if (!Array.isArray(payload.pets) || !payload.pets.length || payload.pets.length > 20) throw safeError_('INVALID_CLIENT', 'Informe ao menos um pet válido.');
  var pets = payload.pets.map(function (pet) { var clean = cleanClientText_(pet, 80, true, 'pet'); if (clean.indexOf(',') >= 0) throw safeError_('INVALID_CLIENT', 'Os nomes dos pets não podem conter vírgulas.'); return clean; });
  var seen = {}; pets = pets.filter(function (pet) { var key = comparisonText_(pet); if (seen[key]) return false; seen[key] = true; return true; });
  return { operationId: operationId, clientId: clientId, responsible: responsible, whatsapp: whatsapp, email: email, pets: pets, notes: cleanClientText_(payload.notes, 1000, false, 'observações'), address: cleanClientText_(payload.address, 250, false, 'endereço'), schedule: cleanClientText_(payload.schedule, 200, false, 'horários habituais') };
}
function cleanClientText_(value, limit, required, label) { var clean = String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim(); if (required && !clean) throw safeError_('INVALID_CLIENT', 'Informe ' + label + '.'); if (clean.length > limit) throw safeError_('INVALID_CLIENT', 'Revise o tamanho dos campos informados.'); return /^[=+\-@]/.test(clean) ? "'" + clean : clean; }
function comparisonText_(value) { return String(value || '').replace(/^'/, '').trim().toLocaleLowerCase('pt-BR'); }
function normalizeClientWhatsapp_(value) { var raw = String(value || '').trim(), digits = raw.replace(/\D/g, ''); if (!raw) return ''; if (digits.length < 10 || digits.length > 13) throw safeError_('INVALID_CLIENT', 'Informe um WhatsApp válido.'); if (digits.length <= 11) digits = '55' + digits; return digits; }
function normalizeClientEmail_(value) { var email = displayClientEmail_(value); if (!email) return ''; if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw safeError_('INVALID_CLIENT', 'Informe um e-mail válido.'); return email; }
function safeClientEmail_(value) { var email = normalizeClientEmail_(value); return /^[=+\-@]/.test(email) ? "'" + email : email; }
function displayClientEmail_(value) { var email = String(value || '').trim(); return /^'[=+\-@]/.test(email) ? email.slice(1) : email; }
function clientEmailKey_(value) { return displayClientEmail_(value).toLowerCase(); }
function clientSheet_(config) { var sheet = SpreadsheetApp.openById(config.SPREADSHEET_ID).getSheetByName(ADMIN.sheets.clients.name); if (!sheet) throw safeError_('CONFIG_ERROR', 'O cadastro de clientes precisa ser revisado.'); var columns = sheet.getLastColumn(), headers = columns ? sheet.getRange(1, 1, 1, columns).getValues()[0].map(function (value) { return String(value).trim(); }) : []; if (ADMIN.sheets.clients.headers.some(function (header) { return headers.indexOf(header) < 0; })) throw safeError_('CONFIG_ERROR', 'O cadastro de clientes precisa ser revisado.'); var count = sheet.getLastRow() - 1, rows = count > 0 ? sheet.getRange(2, 1, count, columns).getValues() : []; return { sheet: sheet, headers: headers, rows: rows }; }
function clientMatches_(source, input) { var id = source.headers.indexOf('clienteId'), phone = source.headers.indexOf('WhatsApp'), email = source.headers.indexOf('e-mail'), result = { byId: null, idCount: 0, phoneDuplicate: null, emailDuplicate: null, rows: [] }; source.rows.forEach(function (row, index) { var item = { values: row, rowNumber: index + 2, clientId: String(row[id] || '').trim() }; result.rows.push(item); if (input.clientId && item.clientId === input.clientId) { result.idCount++; if (!result.byId) result.byId = item; } var own = input.clientId && item.clientId === input.clientId; if (!own && input.whatsapp && normalizeStoredWhatsapp_(row[phone]) === input.whatsapp) result.phoneDuplicate = item; if (!own && input.email && clientEmailKey_(row[email]) === clientEmailKey_(input.email)) result.emailDuplicate = item; }); return result; }
function normalizeStoredWhatsapp_(value) { var digits = String(value || '').replace(/\D/g, ''); return digits && digits.length <= 11 ? '55' + digits : digits; }
function clientOperationKey_(operationId) { return 'CLIENT_CREATE_' + operationId; }
function setClientFormFields_(row, headers, input) { row[headers.indexOf('responsável')] = input.responsible; row[headers.indexOf('WhatsApp')] = input.whatsapp; row[headers.indexOf('e-mail')] = safeClientEmail_(input.email); row[headers.indexOf('pets')] = input.pets.join(', '); row[headers.indexOf('observaçõesAdministrativas')] = input.notes; row[headers.indexOf('endereço')] = input.address; row[headers.indexOf('horáriosHabituais')] = input.schedule; }

function listarPagamentos() {
  return safelyRead_(function (config) { return readSheet_(config, ADMIN.sheets.payments, mapPayment_); });
}

function editarPagamento(payload) {
  var config, input;
  try { config = getConfig_(); authorize_(config); input = validatePaymentInput_(payload); }
  catch (error) { if (error && error.safeCode) throw error; throw safeError_('INVALID_PAYMENT', 'Revise os dados do pagamento.'); }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw safeError_('LOCK_TIMEOUT', 'O painel está ocupado. Tente novamente.');
  try {
    var source = paymentSheet_(config), matches = paymentMatches_(source, input.requestId);
    if (matches.length !== 1) throw safeError_(matches.length ? 'RECONCILIATION_REQUIRED' : 'PAYMENT_NOT_FOUND', 'O pagamento precisa de revisão antes de continuar.');
    var target = matches[0], snapshot = target.values.slice(), updated = snapshot.slice(), h = source.headers;
    updated[h.indexOf('valor')] = input.amount;
    updated[h.indexOf('vencimento')] = input.dueDate;
    updated[h.indexOf('observações')] = input.notes;
    updated[h.indexOf('statusPagamento')] = input.status;
    if (input.status === 'PAGO' && String(snapshot[h.indexOf('statusPagamento')] || '').trim().toUpperCase() !== 'PAGO') updated[h.indexOf('dataPagamento')] = new Date();
    if (input.status !== 'PAGO') updated[h.indexOf('dataPagamento')] = '';
    try { writeAndVerifyPayment_(source, target.rowNumber, updated); }
    catch (writeError) {
      if (!restorePayment_(source, target.rowNumber, snapshot)) throw safeError_('RECONCILIATION_REQUIRED', 'O pagamento precisa de revisão administrativa.');
      throw safeError_('WRITE_ERROR', 'Não foi possível salvar o pagamento. Os dados anteriores foram preservados.');
    }
    return { ok: true, data: mapPaymentRecord_(h, updated, config.TIMEZONE) };
  } finally { lock.releaseLock(); }
}

// Pagamento avulso: lançado diretamente para um cliente já cadastrado, sem vínculo com uma
// solicitação real. A aba Pagamentos continua com exatamente 9 colunas (contrato inalterado);
// o "requestId" passa a ser apenas um identificador único gerado aqui, nunca reaproveitado
// por confirmarSolicitacao/cancelarSolicitacao/excluirSolicitacao, que só agem sobre pagamentos
// cujo requestId corresponda a uma linha real de Solicitações.
function criarPagamento(payload) {
  var config, input;
  try { config = getConfig_(); authorize_(config); input = validateStandalonePaymentInput_(payload); }
  catch (error) { if (error && error.safeCode) throw error; throw safeError_('INVALID_PAYMENT', 'Revise os dados do pagamento.'); }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw safeError_('LOCK_TIMEOUT', 'O painel está ocupado. Tente novamente.');
  try {
    var clientSource = clientSheet_(config), clientMatch = clientMatches_(clientSource, { clientId: input.clientId, whatsapp: '', email: '' });
    if (!clientMatch.byId) throw safeError_('CLIENT_NOT_FOUND', 'O cliente não foi encontrado. Atualize os dados e tente novamente.');
    if (clientMatch.idCount !== 1) throw safeError_('RECONCILIATION_REQUIRED', 'O cadastro precisa de revisão antes de continuar.');
    var clientName = cleanClientText_(clientMatch.byId.values[clientSource.headers.indexOf('responsável')], 120, true, 'responsável');
    var plan = prepareStandalonePayment_(config, input, clientName);
    plan.source.pendingRequestId = plan.requestId;
    try { writeAndVerifyPayment_(plan.source, plan.rowNumber, plan.expected); }
    catch (writeError) {
      if (!restorePayment_(plan.source, plan.rowNumber, null)) throw safeError_('RECONCILIATION_REQUIRED', 'O pagamento precisa de revisão administrativa.');
      throw safeError_('WRITE_ERROR', 'Não foi possível criar o pagamento. Nenhuma alteração foi realizada.');
    }
    return { ok: true, data: mapPaymentRecord_(plan.source.headers, plan.expected, config.TIMEZONE) };
  } catch (error) {
    if (error && error.safeCode) throw error;
    console.error('ADMIN_PAYMENT_CREATE_FAILED');
    throw safeError_('WRITE_ERROR', 'Não foi possível criar o pagamento. Nenhuma alteração foi realizada.');
  } finally { lock.releaseLock(); }
}

function prepareStandalonePayment_(config, input, clientName) {
  var source = paymentSheet_(config), requestId = Utilities.getUuid();
  if (paymentMatches_(source, requestId).length) throw safeError_('RECONCILIATION_REQUIRED', 'Não foi possível gerar um identificador único para o pagamento. Tente novamente.');
  var h = source.headers, row = new Array(h.length).fill('');
  row[h.indexOf('requestId')] = requestId;
  row[h.indexOf('cliente')] = clientName;
  row[h.indexOf('serviço')] = input.service;
  row[h.indexOf('valor')] = input.amount;
  row[h.indexOf('formaPagamento')] = input.paymentMethod;
  row[h.indexOf('vencimento')] = input.dueDate;
  row[h.indexOf('statusPagamento')] = input.status;
  row[h.indexOf('observações')] = input.notes;
  if (input.status === 'PAGO') row[h.indexOf('dataPagamento')] = new Date();
  return { source: source, rowNumber: source.rows.length + 2, expected: row, requestId: requestId };
}

function validateStandalonePaymentInput_(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw safeError_('INVALID_PAYMENT', 'Revise os dados do pagamento.');
  var clientId = String(payload.clientId || '').trim();
  try { validateUuid_(clientId); } catch (error) { throw safeError_('INVALID_CLIENT', 'O cliente informado é inválido.'); }
  var status = String(payload.status || '').trim().toUpperCase();
  if (ADMIN.paymentStatuses.indexOf(status) < 0) throw safeError_('INVALID_PAYMENT', 'Selecione um status de pagamento válido.');
  var amount = '';
  if (payload.amount !== '' && payload.amount !== null && payload.amount !== undefined) { amount = Number(String(payload.amount).replace(',', '.')); if (!isFinite(amount) || amount < 0 || amount > 9999999.99) throw safeError_('INVALID_PAYMENT', 'Informe um valor válido.'); amount = Math.round(amount * 100) / 100; }
  var dueDate = validateIsoDate_(payload.dueDate);
  var notes = cleanClientText_(payload.notes, 1000, false, 'observações');
  var service = cleanClientText_(payload.service, 80, false, 'serviço');
  var paymentMethod = cleanClientText_(payload.paymentMethod, 40, false, 'forma de pagamento') || 'PIX';
  return { clientId: clientId, status: status, amount: amount, dueDate: dueDate, notes: notes, service: service, paymentMethod: paymentMethod };
}

function validatePaymentInput_(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw safeError_('INVALID_PAYMENT', 'Revise os dados do pagamento.');
  var requestId = String(payload.requestId || '').trim(); validateUuid_(requestId);
  var status = String(payload.status || '').trim().toUpperCase();
  if (ADMIN.paymentStatuses.indexOf(status) < 0) throw safeError_('INVALID_PAYMENT', 'Selecione um status de pagamento válido.');
  var amount = '';
  if (payload.amount !== '' && payload.amount !== null && payload.amount !== undefined) { amount = Number(String(payload.amount).replace(',', '.')); if (!isFinite(amount) || amount < 0 || amount > 9999999.99) throw safeError_('INVALID_PAYMENT', 'Informe um valor válido.'); amount = Math.round(amount * 100) / 100; }
  var dueDate = validateIsoDate_(payload.dueDate);
  var notes = cleanClientText_(payload.notes, 1000, false, 'observações');
  return { requestId: requestId, amount: amount, dueDate: dueDate, status: status, notes: notes };
}

function consultarAgendaDia(dateIso) {
  return safelyRead_(function (config) {
    var range = dayRange_(validateIsoDate_(dateIso), config.TIMEZONE);
    return agendaPayload_(config, range.start, range.end);
  });
}

function consultarAgendaSemana(dateIso) {
  return safelyRead_(function (config) {
    var selected = dayRange_(validateIsoDate_(dateIso), config.TIMEZONE).start;
    var weekday = Number(Utilities.formatDate(selected, config.TIMEZONE, 'u'));
    var start = new Date(selected.getTime() - (weekday - 1) * 86400000);
    var end = new Date(start.getTime() + 7 * 86400000);
    return agendaPayload_(config, start, end);
  });
}

function listarBloqueios(dataInicial, dataFinal) {
  return safelyRead_(function (config) {
    var start = dayRange_(validateIsoDate_(dataInicial), config.TIMEZONE).start;
    var end = dayRange_(validateIsoDate_(dataFinal), config.TIMEZONE).end;
    if (end.getTime() - start.getTime() > 366 * 86400000) throw safeError_('INVALID_RANGE', 'O intervalo solicitado é muito extenso.');
    return readCalendar_(config.AVAILABILITY_CALENDAR_ID, start, end, config.TIMEZONE, 'bloqueio');
  });
}

function safelyRead_(reader) {
  try {
    var config = getConfig_();
    authorize_(config);
    return { ok: true, data: reader(config) };
  } catch (error) {
    if (error && error.safeCode) throw error;
    console.error('Falha de leitura administrativa: %s', error && error.message ? error.message : error);
    throw safeError_('READ_ERROR', 'Não foi possível ler os dados agora. Tente novamente mais tarde.');
  }
}

function getConfig_() {
  var values = PropertiesService.getScriptProperties().getProperties();
  var missing = ADMIN.properties.filter(function (key) { return !String(values[key] || '').trim(); });
  if (missing.length) throw safeError_('CONFIG_ERROR', 'A configuração privada do painel está incompleta.');
  if (values.TIMEZONE !== 'America/Sao_Paulo' || values.WORKDAY_START_TIME !== '08:30' || values.WORKDAY_END_TIME !== '18:00') {
    throw safeError_('CONFIG_ERROR', 'Os horários operacionais do painel precisam ser revisados.');
  }
  return values;
}

function authorize_(config) {
  var expected = String(config.ADMIN_EMAIL || '').trim().toLowerCase();
  var active = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (!expected || !active || active !== expected) throw safeError_('ACCESS_DENIED', 'Acesso negado. Entre com a conta autorizada.');
}

function safeError_(code, message) {
  var error = new Error(code + ': ' + message);
  error.safeCode = code;
  return error;
}

function readSheet_(config, schema, mapper) {
  var spreadsheet = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  var sheet = spreadsheet.getSheetByName(schema.name);
  if (!sheet) throw safeError_('CONFIG_ERROR', 'A aba “' + schema.name + '” não foi encontrada.');
  var values = sheet.getDataRange().getValues();
  if (!values.length) throw safeError_('CONFIG_ERROR', 'A aba “' + schema.name + '” não possui cabeçalhos.');
  var headers = values[0].map(function (value) { return String(value).trim(); });
  var missing = schema.headers.filter(function (header) { return headers.indexOf(header) < 0; });
  if (missing.length) throw safeError_('CONFIG_ERROR', 'Os cabeçalhos da aba “' + schema.name + '” precisam ser revisados.');
  return values.slice(1).filter(function (row) {
    return row.some(function (value) { return value !== '' && value !== null; });
  }).map(function (row) {
    var record = {};
    headers.forEach(function (header, index) { record[header] = row[index]; });
    return mapper(record, config.TIMEZONE);
  });
}

function mapRequest_(row, timezone) {
  return {
    requestId: text_(row.requestId), receivedAt: dateTime_(row.dataRecebimento, timezone), channel: text_(row.submissionChannel),
    service: serviceLabel_(row['serviço']), date: date_(row.data, timezone), time: time_(row['horário'], timezone), endTime: time_(row['horárioTérmino'], timezone), responsible: text_(row['responsável']),
    whatsapp: text_(row.WhatsApp), email: text_(row['e-mail']), pet: text_(row.pet), region: text_(row['região']), address: text_(row['endereço']), notes: text_(row['observações']),
    status: officialStatus_(row.status, ADMIN.requestStatuses), notificationStatus: text_(row.notificationStatus), updatedAt: dateTime_(row['dataÚltimaAtualização'], timezone), adminNote: text_(row['observaçãoAdministrativa'])
  };
}

function mapClient_(row, timezone) {
  return { clientId: text_(row.clienteId), responsible: text_(row['responsável']), whatsapp: text_(row.WhatsApp), email: displayClientEmail_(row['e-mail']), pets: text_(row.pets), notes: text_(row['observações']), adminNotes: text_(row['observaçõesAdministrativas']), address: text_(row['endereço']), schedule: text_(row['horáriosHabituais']), registeredAt: dateTime_(row.dataCadastro, timezone), lastAppointment: dateTime_(row['últimoAtendimento'], timezone) };
}

function mapPayment_(row, timezone) {
  return { requestId: text_(row.requestId), client: text_(row.cliente), service: serviceLabel_(row['serviço']), amount: number_(row.valor), paymentMethod: text_(row.formaPagamento), dueDate: date_(row.vencimento, timezone), status: officialStatus_(row.statusPagamento, ADMIN.paymentStatuses), paidAt: dateTime_(row.dataPagamento, timezone), notes: text_(row['observações']) };
}
function mapPaymentRecord_(headers, values, timezone) { var row = {}; headers.forEach(function (header, index) { row[header] = values[index]; }); return mapPayment_(row, timezone); }

function serviceLabel_(value) { var id = text_(value); return ({ 'passeio-individual': 'Passeios', 'dog-day-care': 'Dog Day Care' })[id] || id; }

function officialStatus_(value, allowed) {
  var status = text_(value).toUpperCase();
  return allowed.indexOf(status) >= 0 ? status : '';
}
function text_(value) { return value === null || value === undefined ? '' : String(value).trim(); }
function number_(value) { if (value === '' || value === null || value === undefined) return null; var number = Number(value); return isFinite(number) ? number : null; }
function date_(value, timezone) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) return Utilities.formatDate(value, timezone, 'yyyy-MM-dd');
  var text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return text;
}
function time_(value, timezone) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) return Utilities.formatDate(value, timezone, 'HH:mm');
  var match = String(value).match(/\b([01]\d|2[0-3]):([0-5]\d)\b/);
  return match ? match[1] + ':' + match[2] : text_(value);
}
function dateTime_(value, timezone) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) return Utilities.formatDate(value, timezone, "yyyy-MM-dd'T'HH:mm:ss");
  return text_(value);
}

function validateIsoDate_(value) {
  var text = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw safeError_('INVALID_DATE', 'A data informada é inválida.');
  return text;
}

function dayRange_(iso, timezone) {
  var start = Utilities.parseDate(iso + ' 00:00', timezone, 'yyyy-MM-dd HH:mm');
  return { start: start, end: new Date(start.getTime() + 86400000) };
}

function agendaPayload_(config, start, end) {
  return {
    range: { start: Utilities.formatDate(start, config.TIMEZONE, 'yyyy-MM-dd'), end: Utilities.formatDate(new Date(end.getTime() - 1), config.TIMEZONE, 'yyyy-MM-dd') },
    appointments: readCalendar_(config.APPOINTMENTS_CALENDAR_ID, start, end, config.TIMEZONE, 'atendimento'),
    blocks: readCalendar_(config.AVAILABILITY_CALENDAR_ID, start, end, config.TIMEZONE, 'bloqueio'),
    settings: publicSettings_(config)
  };
}

function readCalendar_(calendarId, start, end, timezone, type) {
  var calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) throw safeError_('CONFIG_ERROR', 'Um calendário necessário não está disponível para esta conta.');
  return calendar.getEvents(start, end).map(function (event) {
    var eventStart = event.getStartTime();
    var eventEnd = event.getEndTime();
    var result = {
      type: type, title: text_(event.getTitle()), allDay: event.isAllDayEvent(),
      start: Utilities.formatDate(eventStart, timezone, "yyyy-MM-dd'T'HH:mm:ss"),
      end: Utilities.formatDate(eventEnd, timezone, "yyyy-MM-dd'T'HH:mm:ss")
    };
    if (type === 'bloqueio') { var identity = blockIdentity_(event.getDescription()); result.eventId = text_(event.getId()); result.blockId = identity.blockId; result.managed = identity.managed; result.reason = identity.managed ? blockReasonFromDescription_(event.getDescription()) : ''; result.motivo = result.reason; }
    return result;
  }).sort(function (a, b) { return a.start.localeCompare(b.start); });
}

function publicSettings_(config) {
  return { timezone: config.TIMEZONE, workdayStart: config.WORKDAY_START_TIME, workdayEnd: config.WORKDAY_END_TIME };
}
function countStatus_(rows, key, statuses) { return rows.filter(function (row) { return statuses.indexOf(row[key]) >= 0; }).length; }
function overlapsPeriod_(event, periodStart, periodEnd) { return event.start < periodEnd && event.end > periodStart; }
function nextIsoDate_(iso) {
  var parts = iso.split('-').map(Number);
  var next = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + 1));
  return next.getUTCFullYear() + '-' + String(next.getUTCMonth() + 1).padStart(2, '0') + '-' + String(next.getUTCDate()).padStart(2, '0');
}
function overlapsDay_(event, iso) { return overlapsPeriod_(event, iso + 'T00:00:00', nextIsoDate_(iso) + 'T00:00:00'); }

function confirmarSolicitacao(requestId) { return safelyWrite_(requestId, null, false, decisionWriter_(confirmRequest_)); }
function pedirMaisInformacoes(requestId, observacao) { return safelyWrite_(requestId, observacao, true, function (context) { return changeStatus_(context, ['PENDENTE'], 'MAIS_INFORMACOES'); }); }
function voltarSolicitacaoParaPendente(requestId, observacao) { return safelyWrite_(requestId, observacao, false, function (context) { return changeStatus_(context, ['MAIS_INFORMACOES'], 'PENDENTE'); }); }
function recusarSolicitacao(requestId, observacao) { return safelyWrite_(requestId, observacao, true, decisionWriter_(function (context) { return changeStatus_(context, ['PENDENTE', 'MAIS_INFORMACOES'], 'RECUSADO'); })); }
function cancelarSolicitacao(requestId, observacao) { return safelyWrite_(requestId, observacao, false, decisionWriter_(cancelRequest_)); }

function decisionWriter_(writer) {
  return function (context) {
    var decision = writer(context);
    if (decision.idempotent) return decision;
    var persisted = requestContext_(context.config, context.requestId);
    var notification = notifyDecision_(persisted, decision.status);
    decision.notification = notification;
    decision.whatsappUrl = decisionWhatsappUrl_(persisted, decision.status);
    return decision;
  };
}

function reenviarEmailSolicitacao(requestId) {
  var config;
  try { config = getConfig_(); authorize_(config); validateUuid_(requestId); requestId = requestId.trim(); }
  catch (error) { if (error && error.safeCode) throw error; throw safeError_('INVALID_REQUEST', 'A solicitação informada é inválida.'); }
  var lock = LockService.getScriptLock(); if (!lock.tryLock(5000)) throw safeError_('LOCK_TIMEOUT', 'O painel está ocupado. Tente novamente.');
  try {
    if (!writesConfigured_(config)) throw safeError_('CONFIG_ERROR', 'As ações aguardam a configuração administrativa.');
    var context = requestContext_(config, requestId), status = status_(context), previous = String(context.record.notificationStatus || '');
    if (['CONFIRMADO', 'RECUSADO', 'CANCELADO'].indexOf(status) < 0) throw safeError_('INVALID_TRANSITION', 'O e-mail só pode ser reenviado para uma decisão concluída.');
    if (previous.indexOf('EMAIL_ENVIADO|' + status + '|') === 0) throw safeError_('INVALID_TRANSITION', 'Este e-mail já foi enviado.');
    if (previous.indexOf('EMAIL_FALHOU|' + status + '|') !== 0) throw safeError_('INVALID_TRANSITION', 'Não há falha de e-mail disponível para reenvio.');
    var notification = notifyDecision_(context, status); return { ok: true, data: { requestId: requestId, status: status, notification: notification, whatsappUrl: decisionWhatsappUrl_(context, status) } };
  } finally { lock.releaseLock(); }
}

function excluirSolicitacao(requestId) {
  var config;
  try { config = getConfig_(); authorize_(config); validateUuid_(requestId); requestId = requestId.trim(); }
  catch (error) { if (error && error.safeCode) throw error; throw safeError_('INVALID_REQUEST', 'A solicitação informada é inválida.'); }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw safeError_('LOCK_TIMEOUT', 'O painel está ocupado. Tente novamente.');
  try {
    if (!writesConfigured_(config)) throw safeError_('CONFIG_ERROR', 'As ações aguardam a configuração administrativa.');
    var context = requestContext_(config, requestId, true), current = status_(context);
    // RECUSADO é um estado final (não pode ser confirmada nem cancelada a partir dele — ver
    // cancelRequest_) e nunca tem evento na agenda, então a exclusão direta é segura aqui.
    if (['PENDENTE', 'CANCELADO', 'RECUSADO'].indexOf(current) < 0) throw safeError_('INVALID_TRANSITION', 'Esta solicitação precisa ser cancelada antes da exclusão.');
    if (String(context.record.eventIdAtendimento || '').trim() || hasRequestCalendarLink_(context)) throw safeError_('CALENDAR_LINKED', 'Existe vínculo com a agenda e ele precisa ser revisado.');
    // A administradora é a única usuária do painel e a decisão de excluir é dela: um pagamento
    // vinculado não bloqueia mais a exclusão, apenas é removido junto (Fase 12A). Duplicidade de
    // pagamento continua exigindo revisão, para não escolher qual linha apagar arbitrariamente.
    var paymentSource = paymentSheet_(config), paymentMatches = paymentMatches_(paymentSource, requestId);
    if (paymentMatches.length > 1) throw safeError_('RECONCILIATION_REQUIRED', 'Há pagamentos duplicados para esta solicitação. Nenhuma alteração foi realizada.');
    var payment = paymentMatches[0] || null, paymentDeleted = false;
    if (payment) {
      try {
        paymentSource.sheet.deleteRow(payment.rowNumber);
        SpreadsheetApp.flush();
        if (paymentMatches_(paymentSheet_(config), requestId).length) throw new Error('payment delete not verified');
        paymentDeleted = true;
      } catch (paymentError) {
        console.error('ADMIN_REQUEST_DELETE_PAYMENT_FAILED requestId=%s', requestId);
        throw safeError_('WRITE_ERROR', 'Não foi possível excluir o pagamento vinculado. A solicitação não foi excluída.');
      }
    }
    try {
      context.sheet.deleteRow(context.rowNumber);
    } catch (requestError) {
      console.error('ADMIN_REQUEST_DELETE_FAILED requestId=%s', requestId);
      throw safeError_('WRITE_ERROR', paymentDeleted ? 'O pagamento vinculado foi excluído, mas a solicitação não pôde ser excluída. Tente excluir novamente.' : 'Não foi possível excluir a solicitação. Os dados foram preservados.');
    }
    return { ok: true, data: { requestId: requestId, deleted: true, paymentDeleted: paymentDeleted } };
  } catch (error) {
    if (error && error.safeCode) throw error;
    console.error('ADMIN_REQUEST_DELETE_FAILED requestId=%s', requestId);
    throw safeError_('WRITE_ERROR', 'Não foi possível excluir a solicitação. Os dados foram preservados.');
  } finally { lock.releaseLock(); }
}

// Reagendamento: move a data/horário de uma solicitação já CONFIRMADA, movendo também o evento
// real no calendário de Atendimentos (o mesmo evento, sem excluir e recriar). Usa exatamente o
// mesmo padrão já comprovado em editarBloqueio — checar conflito ignorando o próprio evento,
// mover, verificar por releitura e restaurar tudo se qualquer etapa falhar.
function validateReschedule_(payload, config) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw safeError_('INVALID_REQUEST', 'Revise os dados do reagendamento.');
  var requestId = String(payload.requestId || '').trim(); validateUuid_(requestId);
  var date = validateIsoDate_(payload.date);
  var startTime = strictBlockTime_(payload.startTime), endTime = strictBlockTime_(payload.endTime);
  if (startTime < '08:30' || startTime >= endTime || endTime > '18:00') throw safeError_('INVALID_INTERVAL', 'O horário deve ficar entre 08:30 e 18:00, com término posterior ao início.');
  strictBlockDate_(date, config.TIMEZONE);
  var start, end;
  try {
    start = Utilities.parseDate(date + ' ' + startTime, config.TIMEZONE, 'yyyy-MM-dd HH:mm');
    end = Utilities.parseDate(date + ' ' + endTime, config.TIMEZONE, 'yyyy-MM-dd HH:mm');
    if (Utilities.formatDate(start, config.TIMEZONE, 'yyyy-MM-dd HH:mm') !== date + ' ' + startTime || Utilities.formatDate(end, config.TIMEZONE, 'yyyy-MM-dd HH:mm') !== date + ' ' + endTime) throw new Error('round trip');
  } catch (error) { throw safeError_('INVALID_DATE', 'A data informada é inválida.'); }
  if (start.getTime() < new Date().getTime()) throw safeError_('INVALID_INTERVAL', 'O novo horário não pode estar no passado.');
  return { requestId: requestId, date: date, startTime: startTime, endTime: endTime, start: start, end: end };
}
function reagendarSolicitacao(payload) {
  var config, input;
  try { config = getConfig_(); authorize_(config); input = validateReschedule_(payload, config); }
  catch (error) { if (error && error.safeCode) throw error; throw safeError_('INVALID_REQUEST', 'Revise os dados do reagendamento.'); }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw safeError_('LOCK_TIMEOUT', 'O painel está ocupado. Tente novamente.');
  try {
    if (!writesConfigured_(config)) throw safeError_('CONFIG_ERROR', 'As ações aguardam a configuração administrativa.');
    var context = requestContext_(config, input.requestId, true);
    if (status_(context) !== 'CONFIRMADO') throw safeError_('INVALID_TRANSITION', 'Somente solicitações confirmadas podem ser reagendadas.');
    var eventId = String(context.record.eventIdAtendimento || '').trim();
    var event = eventId && context.appointments.getEventById(eventId);
    if (!eventMatches_(event, input.requestId)) throw safeError_('RECONCILIATION_REQUIRED', 'A solicitação precisa de revisão antes de continuar.');
    if (hasConflictExcept_(context.appointments, input, eventId) || hasConflictExcept_(context.availability, input, eventId)) throw safeError_('INTERVAL_UNAVAILABLE', 'O novo período não está disponível.');
    var eventSnapshot = { start: new Date(event.getStartTime().getTime()), end: new Date(event.getEndTime().getTime()) };
    var rowSnapshot = context.values.slice();
    try {
      event.setTime(input.start, input.end);
      if (event.getStartTime().getTime() !== input.start.getTime() || event.getEndTime().getTime() !== input.end.getTime()) throw new Error('event move not verified');
    } catch (eventError) {
      try { event.setTime(eventSnapshot.start, eventSnapshot.end); } catch (ignored) {}
      throw safeError_('WRITE_ERROR', 'Não foi possível mover o atendimento na agenda. Nenhuma alteração foi realizada.');
    }
    var updated = rowSnapshot.slice();
    updated[column_(context, 'data')] = input.date;
    updated[column_(context, 'horário')] = input.startTime;
    updated[column_(context, 'horárioTérmino')] = input.endTime;
    updated[column_(context, 'dataÚltimaAtualização')] = new Date();
    try {
      context.sheet.getRange(context.rowNumber, 1, 1, context.headers.length).setValues([updated]);
      SpreadsheetApp.flush();
      var reread = context.sheet.getRange(context.rowNumber, 1, 1, context.headers.length).getValues()[0];
      // A Planilha pode reler "horário"/"horárioTérmino" como um valor de hora (Date ancorada em
      // 1899-12-30), não como o texto HH:mm gravado — mesmo princípio já usado para "vencimento"
      // em Pagamentos, mas aqui aplicado com os leitores robustos que interval_() já usa para ler
      // data/horário de uma solicitação confirmada.
      var rereadDate = strictSheetDate_(reread[column_(context, 'data')], config.TIMEZONE);
      var rereadStart = strictSheetTime_(reread[column_(context, 'horário')], config.TIMEZONE);
      var rereadEnd = strictSheetTime_(reread[column_(context, 'horárioTérmino')], config.TIMEZONE);
      if (rereadDate !== input.date || rereadStart !== input.startTime || rereadEnd !== input.endTime) throw new Error('reschedule not verified');
    } catch (writeError) {
      var restored = false;
      try { event.setTime(eventSnapshot.start, eventSnapshot.end); restored = event.getStartTime().getTime() === eventSnapshot.start.getTime() && event.getEndTime().getTime() === eventSnapshot.end.getTime(); } catch (ignored) {}
      if (!restored) throw safeError_('RECONCILIATION_REQUIRED', 'A solicitação precisa de revisão antes de continuar.');
      throw safeError_('WRITE_ERROR', 'Não foi possível salvar o novo horário. A agenda foi restaurada ao horário anterior.');
    }
    return { ok: true, data: { requestId: input.requestId, date: input.date, startTime: input.startTime, endTime: input.endTime } };
  } catch (error) {
    if (error && error.safeCode) throw error;
    console.error('ADMIN_RESCHEDULE_FAILED requestId=%s', input && input.requestId);
    throw safeError_('WRITE_ERROR', 'Não foi possível reagendar. Os dados anteriores foram preservados.');
  } finally { lock.releaseLock(); }
}

function safelyWrite_(requestId, note, noteRequired, writer) {
  var config;
  try { config = getConfig_(); authorize_(config); validateUuid_(requestId); note = adminNote_(note, noteRequired); }
  catch (error) { if (error && error.safeCode) throw error; throw safeError_('INVALID_REQUEST', 'Os dados da ação são inválidos.'); }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw safeError_('LOCK_TIMEOUT', 'O painel está ocupado. Tente novamente.');
  try {
    if (!writesConfigured_(config)) throw safeError_('CONFIG_ERROR', 'As ações aguardam a configuração das colunas e agendas.');
    var context = requestContext_(config, requestId); context.note = note;
    return { ok: true, data: writer(context) };
  } catch (error) {
    if (error && error.safeCode) throw error;
    console.error('ADMIN_WRITE_FAILED requestId=%s', requestId);
    throw safeError_('WRITE_ERROR', 'Não foi possível concluir a ação. Os dados não foram considerados alterados.');
  } finally { lock.releaseLock(); }
}

function validateUuid_(value) { if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim())) throw safeError_('INVALID_REQUEST', 'A solicitação informada é inválida.'); }
function adminNote_(value, required) { var note = String(value || '').replace(/[\u0000-\u001F\u007F]/g, '').trim(); if (required && !note) throw safeError_('INVALID_REQUEST', 'Informe uma observação para concluir a ação.'); if (note.length > 500) throw safeError_('INVALID_REQUEST', 'A observação deve ter no máximo 500 caracteres.'); return /^[=+\-@]/.test(note) ? "'" + note : note; }
function requestSheet_(config) { var sheet = SpreadsheetApp.openById(config.SPREADSHEET_ID).getSheetByName('Solicitações'); if (!sheet) throw safeError_('CONFIG_ERROR', 'A aba Solicitações não foi encontrada.'); var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (x) { return String(x).trim(); }); return { sheet: sheet, headers: headers }; }
function requestHeadersMatch_(headers) { var expected = ADMIN.sheets.requests.headers; return headers.length === expected.length && expected.every(function (header, index) { return headers[index] === header; }); }
function writesConfigured_(config) { try { var source = requestSheet_(config); clientSheet_(config); paymentSheet_(config); return requestHeadersMatch_(source.headers) && Boolean(CalendarApp.getCalendarById(config.APPOINTMENTS_CALENDAR_ID)) && Boolean(CalendarApp.getCalendarById(config.AVAILABILITY_CALENDAR_ID)); } catch (error) { return false; } }
function requestContext_(config, requestId, requireUnique) {
  var source = requestSheet_(config), idIndex = source.headers.indexOf('requestId');
  if (idIndex < 0) throw safeError_('CONFIG_ERROR', 'Os cabeçalhos precisam ser revisados.');
  var count = source.sheet.getLastRow() - 1, rows = count > 0 ? source.sheet.getRange(2, 1, count, source.headers.length).getValues() : [], match = null, matches = 0;
  for (var i = 0; i < rows.length; i++) if (String(rows[i][idIndex]).trim() === requestId) { matches++; if (!match) match = { rowNumber: i + 2, values: rows[i] }; }
  if (!match) throw safeError_('NOT_FOUND', 'A solicitação não foi encontrada.');
  if (matches !== 1) throw safeError_('RECONCILIATION_REQUIRED', 'Há mais de uma solicitação com o mesmo código. Nenhuma alteração foi realizada.');
  var record = {}; source.headers.forEach(function (header, index) { record[header] = match.values[index]; });
  return { config: config, sheet: source.sheet, headers: source.headers, rowNumber: match.rowNumber, values: match.values, record: record, requestId: requestId, appointments: CalendarApp.getCalendarById(config.APPOINTMENTS_CALENDAR_ID), availability: CalendarApp.getCalendarById(config.AVAILABILITY_CALENDAR_ID) };
}
function status_(context) { return String(context.record.status || '').trim().toUpperCase(); }
function column_(context, name) { var index = context.headers.indexOf(name); if (index < 0) throw safeError_('CONFIG_ERROR', 'Os cabeçalhos precisam ser revisados.'); return index; }
function persist_(context, status, eventId, clientId) { var row = context.values.slice(); row[column_(context, 'status')] = status; row[column_(context, 'eventIdAtendimento')] = eventId === undefined ? row[column_(context, 'eventIdAtendimento')] : eventId; row[column_(context, 'clienteId')] = clientId === undefined ? row[column_(context, 'clienteId')] : clientId; if (context.note) row[column_(context, 'observaçãoAdministrativa')] = context.note; row[column_(context, 'dataÚltimaAtualização')] = new Date(); context.sheet.getRange(context.rowNumber, 1, 1, context.headers.length).setValues([row]); SpreadsheetApp.flush(); return { requestId: context.requestId, status: status }; }
function changeStatus_(context, allowed, target) { var current = status_(context); assertNoUnexpectedEvent_(context, current); if (current === target) return { requestId: context.requestId, status: target, idempotent: true }; if (allowed.indexOf(current) < 0) throw safeError_('INVALID_TRANSITION', 'Esta ação não é permitida para o status atual.'); return persist_(context, target); }
function marker_(requestId) { return 'PATI_MUNDOPET_REQUEST\nrequestId: ' + requestId; }
function eventMatches_(event, requestId) { return Boolean(event) && String(event.getDescription() || '').indexOf(marker_(requestId)) >= 0; }
function hasRequestCalendarLink_(context) { var date; try { date = strictSheetDate_(context.record.data, context.config.TIMEZONE); } catch (error) { throw safeError_('RECONCILIATION_REQUIRED', 'A solicitação precisa de revisão antes de continuar.'); } var range = dayRange_(date, context.config.TIMEZONE); return context.appointments.getEvents(range.start, range.end).some(function (event) { return eventMatches_(event, context.requestId); }); }
function paymentSheet_(config) { var sheet = SpreadsheetApp.openById(config.SPREADSHEET_ID).getSheetByName(ADMIN.sheets.payments.name); if (!sheet) throw safeError_('CONFIG_ERROR', 'A aba Pagamentos não foi encontrada.'); var columns = sheet.getLastColumn(); if (columns < 1) throw safeError_('CONFIG_ERROR', 'A aba Pagamentos precisa ser revisada.'); var headers = sheet.getRange(1, 1, 1, columns).getValues()[0].map(function (value) { return String(value).trim(); }); if (ADMIN.sheets.payments.headers.some(function (header) { return headers.indexOf(header) < 0; })) throw safeError_('CONFIG_ERROR', 'Os cabeçalhos da aba Pagamentos precisam ser revisados.'); var count = sheet.getLastRow() - 1, rows = count > 0 ? sheet.getRange(2, 1, count, columns).getValues() : []; return { sheet: sheet, headers: headers, rows: rows, config: config }; }
function paymentMatches_(source, requestId) { var id = source.headers.indexOf('requestId'), result = []; source.rows.forEach(function (row, index) { if (String(row[id] || '').trim() === requestId) result.push({ rowNumber: index + 2, values: row.slice() }); }); return result; }
function paymentRowsEqual_(left, right, timezone) { return confirmationRowsEqual_(left, right, timezone); }
function writeAndVerifyPayment_(source, rowNumber, values) { source.sheet.getRange(rowNumber, 1, 1, source.headers.length).setValues([values]); SpreadsheetApp.flush(); var reread = source.sheet.getRange(rowNumber, 1, 1, source.headers.length).getValues()[0]; if (!paymentRowsEqual_(reread, values, source.config.TIMEZONE)) throw new Error('payment write not verified'); }
function restorePayment_(source, rowNumber, snapshot) { try { if (snapshot === null) source.sheet.deleteRow(rowNumber); else source.sheet.getRange(rowNumber, 1, 1, source.headers.length).setValues([snapshot]); SpreadsheetApp.flush(); var refreshed = paymentSheet_(source.config), matches = paymentMatches_(refreshed, snapshot === null ? source.pendingRequestId : String(snapshot[source.headers.indexOf('requestId')] || '').trim()); return snapshot === null ? matches.length === 0 : matches.length === 1 && paymentRowsEqual_(matches[0].values, snapshot, source.config.TIMEZONE); } catch (error) { return false; } }
function prepareConfirmationPayment_(context) { var source = paymentSheet_(context.config), matches = paymentMatches_(source, context.requestId); if (matches.length > 1) throw safeError_('RECONCILIATION_REQUIRED', 'Há pagamentos duplicados para esta solicitação. Nenhuma alteração foi realizada.'); if (matches.length === 1) return { source: source, rowNumber: matches[0].rowNumber, original: matches[0].values, expected: matches[0].values, created: false }; var row = new Array(source.headers.length).fill(''); row[source.headers.indexOf('requestId')] = context.requestId; row[source.headers.indexOf('cliente')] = cleanClientText_(context.record['responsável'], 120, true, 'responsável'); row[source.headers.indexOf('serviço')] = text_(context.record['serviço']); row[source.headers.indexOf('formaPagamento')] = 'PIX'; row[source.headers.indexOf('vencimento')] = strictSheetDate_(context.record.data, context.config.TIMEZONE); row[source.headers.indexOf('statusPagamento')] = 'PENDENTE'; return { source: source, rowNumber: source.rows.length + 2, original: null, expected: row, created: true }; }
function writeConfirmationPayment_(plan) { if (plan.created) { plan.source.pendingRequestId = String(plan.expected[plan.source.headers.indexOf('requestId')]); writeAndVerifyPayment_(plan.source, plan.rowNumber, plan.expected); } }
function compensateConfirmationPayment_(plan) { if (!plan) return true; if (!plan.created) return true; plan.source.pendingRequestId = String(plan.expected[plan.source.headers.indexOf('requestId')]); return restorePayment_(plan.source, plan.rowNumber, null); }
function confirmationPaymentMatches_(plan) { var source = paymentSheet_(plan.source.config), matches = paymentMatches_(source, String(plan.expected[plan.source.headers.indexOf('requestId')])); return matches.length === 1 && paymentRowsEqual_(matches[0].values, plan.expected, plan.source.config.TIMEZONE); }
function assertNoUnexpectedEvent_(context, current) { if (current !== 'CONFIRMADO' && String(context.record.eventIdAtendimento || '').trim()) throw safeError_('RECONCILIATION_REQUIRED', 'A solicitação precisa de revisão antes de continuar.'); }
function nativeDate_(value) { return Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime()); }
function strictSheetDate_(value, timezone) { if (nativeDate_(value)) return Utilities.formatDate(value, timezone, 'yyyy-MM-dd'); if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value; throw safeError_('INVALID_INTERVAL', 'O horário da solicitação é inválido ou legado.'); }
function strictSheetTime_(value, timezone) { if (nativeDate_(value)) return Utilities.formatDate(value, timezone, 'HH:mm'); if (typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return value; throw safeError_('INVALID_INTERVAL', 'O horário da solicitação é inválido ou legado.'); }
function interval_(context) { var date = strictSheetDate_(context.record.data, context.config.TIMEZONE), start = strictSheetTime_(context.record['horário'], context.config.TIMEZONE), end = strictSheetTime_(context.record['horárioTérmino'], context.config.TIMEZONE); if (start < '08:30' || start >= end || end > '18:00') throw safeError_('INVALID_INTERVAL', 'O horário da solicitação é inválido ou legado.'); var a, b; try { a = Utilities.parseDate(date + ' ' + start, context.config.TIMEZONE, 'yyyy-MM-dd HH:mm'); b = Utilities.parseDate(date + ' ' + end, context.config.TIMEZONE, 'yyyy-MM-dd HH:mm'); if (Utilities.formatDate(a, context.config.TIMEZONE, 'yyyy-MM-dd HH:mm') !== date + ' ' + start || Utilities.formatDate(b, context.config.TIMEZONE, 'yyyy-MM-dd HH:mm') !== date + ' ' + end) throw new Error('round trip'); } catch (error) { throw safeError_('INVALID_INTERVAL', 'O horário da solicitação é inválido ou legado.'); } if (a.getTime() <= new Date().getTime()) throw safeError_('INTERVAL_UNAVAILABLE', 'O período solicitado não está disponível.'); return { start: a, end: b }; }
function hasConflict_(calendar, interval) { return calendar.getEvents(interval.start, interval.end).some(function (event) { return !(typeof event.getEventStatus === 'function' && String(event.getEventStatus()).toLowerCase() === 'canceled') && event.getStartTime().getTime() < interval.end.getTime() && event.getEndTime().getTime() > interval.start.getTime(); }); }
function dateTextMatches_(dateValue, textValue, timezone) { return Boolean(timezone) && typeof textValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(textValue) && Utilities.formatDate(dateValue, timezone, 'yyyy-MM-dd') === textValue; }
function confirmationRowsEqual_(left, right, timezone) {
  if (!left || !right || left.length !== right.length) return false;
  for (var i = 0; i < left.length; i++) {
    var a = left[i], b = right[i];
    if (nativeDate_(a) || nativeDate_(b)) {
      if (nativeDate_(a) && nativeDate_(b)) { if (a.getTime() !== b.getTime()) return false; continue; }
      // A Planilha pode reler um texto de data (ex.: "vencimento") como um valor de data
      // equivalente. Mesmo princípio já usado para outros campos: comparar pelo dia
      // representado, não pelo tipo bruto do valor.
      if (nativeDate_(a) && dateTextMatches_(a, b, timezone)) continue;
      if (nativeDate_(b) && dateTextMatches_(b, a, timezone)) continue;
      return false;
    }
    if (a !== b) return false;
  }
  return true;
}
function confirmationClientRowsEqual_(headers, left, right) {
  if (!left || !right || left.length !== right.length || left.length !== headers.length) return false;
  for (var i = 0; i < headers.length; i++) {
    var header = headers[i], a = left[i], b = right[i];
    if (header === 'clienteId') { if (String(a || '').trim().toLowerCase() !== String(b || '').trim().toLowerCase()) return false; continue; }
    if (header === 'WhatsApp') { if (normalizeStoredWhatsapp_(a) !== normalizeStoredWhatsapp_(b)) return false; continue; }
    if (header === 'e-mail') { if (clientEmailKey_(a) !== clientEmailKey_(b)) return false; continue; }
    if (nativeDate_(a) || nativeDate_(b)) { if (!nativeDate_(a) || !nativeDate_(b) || Math.floor(a.getTime() / 1000) !== Math.floor(b.getTime() / 1000)) return false; continue; }
    if (String(a === null || a === undefined ? '' : a) !== String(b === null || b === undefined ? '' : b)) return false;
  }
  return true;
}
function resolveConfirmationClient_(context) {
  var source = clientSheet_(context.config), linkedId = String(context.record.clienteId || '').trim(), phone = String(context.record.WhatsApp || '').trim() ? normalizeClientWhatsapp_(context.record.WhatsApp) : '', email = String(context.record['e-mail'] || '').trim() ? normalizeClientEmail_(context.record['e-mail']) : '', phoneMatches = [], emailMatches = [];
  if (linkedId) { validateUuid_(linkedId); var linked = clientMatches_(source, { clientId: linkedId, whatsapp: '', email: '' }); if (!linked.byId || linked.idCount !== 1) throw safeError_('RECONCILIATION_REQUIRED', 'O cliente vinculado precisa de revisão antes de continuar.'); return { source: source, target: linked.byId, phone: phone, email: email }; }
  if (!phone && !email) throw safeError_('INVALID_CLIENT', 'A solicitação não possui contato válido.');
  source.rows.forEach(function (row, index) { var item = { values: row.slice(), rowNumber: index + 2, clientId: String(row[source.headers.indexOf('clienteId')] || '').trim() }; if (phone && normalizeStoredWhatsapp_(row[source.headers.indexOf('WhatsApp')]) === phone) phoneMatches.push(item); if (email && clientEmailKey_(row[source.headers.indexOf('e-mail')]) === email) emailMatches.push(item); });
  if (phoneMatches.length > 1) throw safeError_('DUPLICATE_WHATSAPP', 'O WhatsApp está associado a mais de um cliente. Nenhuma alteração foi realizada.');
  if (emailMatches.length > 1) throw safeError_('DUPLICATE_EMAIL', 'O e-mail está associado a mais de um cliente. Nenhuma alteração foi realizada.');
  var phoneClient = phoneMatches[0], emailClient = emailMatches[0];
  if (phoneClient && emailClient && phoneClient.clientId !== emailClient.clientId) throw safeError_('RECONCILIATION_REQUIRED', 'O WhatsApp e o e-mail pertencem a clientes diferentes. Nenhuma alteração foi realizada.');
  var target = phoneClient || emailClient || null; if (target) validateUuid_(target.clientId);
  return { source: source, target: target, phone: phone, email: email };
}
function prepareConfirmationClient_(context, resolution) {
  var h = resolution.source.headers, pet = cleanClientText_(text_(context.record.pet), 80, true, 'pet'), requestNotes = cleanClientText_(context.record['observações'], 1000, false, 'observações'), target = resolution.target, updated, clientId;
  if (!target) { clientId = Utilities.getUuid(); validateUuid_(clientId); updated = new Array(h.length).fill(''); updated[h.indexOf('clienteId')] = clientId; updated[h.indexOf('responsável')] = cleanClientText_(text_(context.record['responsável']), 120, true, 'responsável'); updated[h.indexOf('WhatsApp')] = resolution.phone; updated[h.indexOf('e-mail')] = safeClientEmail_(resolution.email); updated[h.indexOf('pets')] = pet; updated[h.indexOf('observações')] = requestNotes; updated[h.indexOf('dataCadastro')] = new Date(); return { clientId: clientId, created: true, rowNumber: resolution.source.rows.length + 2, original: null, expected: updated }; }
  updated = target.values.slice();
  updated[h.indexOf('responsável')] = cleanClientText_(text_(context.record['responsável']), 120, true, 'responsável'); updated[h.indexOf('WhatsApp')] = resolution.phone; updated[h.indexOf('e-mail')] = safeClientEmail_(resolution.email); updated[h.indexOf('pets')] = pet; updated[h.indexOf('observações')] = requestNotes;
  return { clientId: target.clientId, created: false, rowNumber: target.rowNumber, original: target.values.slice(), expected: updated };
}
function clientPlanMatches_(resolution, plan, expected) {
  var currentSource = clientSheet_(resolution.config), idIndex = currentSource.headers.indexOf('clienteId'), matches = [];
  currentSource.rows.forEach(function (row, index) { if (String(row[idIndex] || '').trim() === plan.clientId) matches.push({ rowNumber: index + 2, values: row }); });
  return matches.length === 1 && confirmationClientRowsEqual_(currentSource.headers, matches[0].values, expected);
}
function writeConfirmationClient_(resolution, plan) {
  resolution.source.sheet.getRange(plan.rowNumber, 1, 1, resolution.source.headers.length).setValues([plan.expected]);
  SpreadsheetApp.flush(); if (!clientPlanMatches_(resolution, plan, plan.expected)) throw new Error('client write not verified');
}
function compensateConfirmationClient_(resolution, plan) {
  try {
    var source = clientSheet_(resolution.config), idIndex = source.headers.indexOf('clienteId'), matches = [];
    source.rows.forEach(function (row, index) { if (String(row[idIndex] || '').trim() === plan.clientId) matches.push({ rowNumber: index + 2, values: row }); });
    try { if (plan.created) { if (matches.length > 1) return false; if (source.sheet.getLastRow() >= plan.rowNumber) source.sheet.deleteRow(plan.rowNumber); } else if (matches.length === 1) source.sheet.getRange(matches[0].rowNumber, 1, 1, source.headers.length).setValues([plan.original]); } catch (ignored) {}
    try { SpreadsheetApp.flush(); } catch (ignored) {}
    source = clientSheet_(resolution.config); matches = source.rows.filter(function (row) { return String(row[source.headers.indexOf('clienteId')] || '').trim() === plan.clientId; });
    return plan.created ? matches.length === 0 : matches.length === 1 && confirmationClientRowsEqual_(source.headers, matches[0], plan.original);
  } catch (error) { return false; }
}
function restoreConfirmationRequest_(context, snapshot) {
  try { try { context.sheet.getRange(context.rowNumber, 1, 1, context.headers.length).setValues([snapshot]); SpreadsheetApp.flush(); } catch (ignored) {} var current = context.sheet.getRange(context.rowNumber, 1, 1, context.headers.length).getValues()[0]; return confirmationRowsEqual_(current, snapshot); } catch (error) { return false; }
}
function removeConfirmationEvent_(context, event) {
  if (!event) return true; try { event.deleteEvent(); } catch (ignored) {} try { return !context.appointments.getEventById(event.getId()); } catch (error) { return false; }
}
function compensateConfirmation_(context, snapshot, resolution, plan, event, paymentPlan) {
  var paymentOk = compensateConfirmationPayment_(paymentPlan); var eventOk = removeConfirmationEvent_(context, event); var clientOk = compensateConfirmationClient_(resolution, plan); var requestOk = restoreConfirmationRequest_(context, snapshot); return { paymentOk: paymentOk, eventOk: eventOk, clientOk: clientOk, requestOk: requestOk, ok: paymentOk && eventOk && clientOk && requestOk };
}
function confirmationRequestMatches_(context, clientId, eventId) {
  var row = context.sheet.getRange(context.rowNumber, 1, 1, context.headers.length).getValues()[0]; return String(row[column_(context, 'status')] || '').trim() === 'CONFIRMADO' && String(row[column_(context, 'clienteId')] || '').trim() === clientId && String(row[column_(context, 'eventIdAtendimento')] || '').trim() === eventId;
}
function confirmRequest_(context) {
  var current = status_(context), eventId = String(context.record.eventIdAtendimento || '').trim(), linkedId = String(context.record.clienteId || '').trim();
  if (current === 'CONFIRMADO') { if (!linkedId) throw safeError_('RECONCILIATION_REQUIRED', 'A solicitação precisa de revisão antes de continuar.'); validateUuid_(linkedId); if (!eventId || !eventMatches_(context.appointments.getEventById(eventId), context.requestId)) throw safeError_('RECONCILIATION_REQUIRED', 'A solicitação precisa de revisão antes de continuar.'); var existing = clientMatches_(clientSheet_(context.config), { clientId: linkedId, whatsapp: '', email: '' }); if (!existing.byId || existing.idCount !== 1) throw safeError_('RECONCILIATION_REQUIRED', 'A solicitação precisa de revisão antes de continuar.'); var existingPayment = prepareConfirmationPayment_(context); if (existingPayment.created) { try { writeConfirmationPayment_(existingPayment); } catch (paymentError) { if (!compensateConfirmationPayment_(existingPayment)) throw safeError_('RECONCILIATION_REQUIRED', 'O pagamento precisa de revisão antes de continuar.'); throw safeError_('PERSISTENCE_FAILED', 'PAYMENT_SAVE_FAILED: Não foi possível criar o pagamento.'); } } return { requestId: context.requestId, status: current, idempotent: true }; }
  if (eventId) throw safeError_('RECONCILIATION_REQUIRED', 'A solicitação precisa de revisão antes de continuar.'); if (linkedId) validateUuid_(linkedId); if (['PENDENTE', 'MAIS_INFORMACOES'].indexOf(current) < 0) throw safeError_('INVALID_TRANSITION', 'Esta ação não é permitida para o status atual.');
  var snapshot = context.values.slice(), resolution = resolveConfirmationClient_(context); resolution.config = context.config; var plan = prepareConfirmationClient_(context, resolution), interval = interval_(context); if (hasConflict_(context.appointments, interval) || hasConflict_(context.availability, interval)) throw safeError_('INTERVAL_UNAVAILABLE', 'O período solicitado não está disponível.');
  try { writeConfirmationClient_(resolution, plan); } catch (error) { var clientFailure = compensateConfirmation_(context, snapshot, resolution, plan, null); if (!clientFailure.ok) throw safeError_('RECONCILIATION_REQUIRED', 'A solicitação precisa de revisão antes de continuar.'); throw safeError_('PERSISTENCE_FAILED', 'CLIENT_SAVE_FAILED: Não foi possível salvar ou validar o cadastro do cliente. A solicitação não foi confirmada e nenhum agendamento foi concluído.'); }
  var event, serviceId = text_(context.record['serviço']), serviceLabel = serviceLabel_(serviceId), description = marker_(context.requestId) + '\nserviço: ' + serviceLabel + '\nserviceId: ' + serviceId + '\nresponsável: ' + text_(context.record['responsável']) + '\npet: ' + text_(context.record.pet) + '\nWhatsApp: ' + text_(context.record.WhatsApp) + '\ne-mail: ' + text_(context.record['e-mail']) + '\nregião: ' + text_(context.record['região']) + '\nobservações: ' + text_(context.record['observações']);
  try { event = context.appointments.createEvent(serviceLabel + ' — ' + text_(context.record.pet) + ' — ' + text_(context.record['responsável']), interval.start, interval.end, { description: description }); if (!eventMatches_(event, context.requestId)) throw new Error('marker'); }
  catch (error) { var eventFailure = compensateConfirmation_(context, snapshot, resolution, plan, event); if (!eventFailure.ok) throw safeError_('RECONCILIATION_REQUIRED', 'A solicitação precisa de revisão antes de continuar.'); throw safeError_('PERSISTENCE_FAILED', 'EVENT_CREATE_FAILED: Não foi possível criar ou validar o agendamento. A solicitação não foi confirmada.'); }
  var paymentPlan;
  try { paymentPlan = prepareConfirmationPayment_(context); writeConfirmationPayment_(paymentPlan); if (!confirmationPaymentMatches_(paymentPlan)) throw new Error('payment not verified'); }
  catch (error) { var paymentFailure = compensateConfirmation_(context, snapshot, resolution, plan, event, paymentPlan); if (!paymentFailure.ok) throw safeError_('RECONCILIATION_REQUIRED', 'A solicitação precisa de revisão antes de continuar.'); throw safeError_('PERSISTENCE_FAILED', 'PAYMENT_SAVE_FAILED: Não foi possível criar ou validar o pagamento. A confirmação foi revertida.'); }
  try { var result = persist_(context, 'CONFIRMADO', event.getId(), plan.clientId); if (!confirmationRequestMatches_(context, plan.clientId, event.getId()) || !eventMatches_(context.appointments.getEventById(event.getId()), context.requestId) || !clientPlanMatches_(resolution, plan, plan.expected) || !confirmationPaymentMatches_(paymentPlan)) throw new Error('confirmation not verified'); return result; }
  catch (error) { var persistFailure = compensateConfirmation_(context, snapshot, resolution, plan, event, paymentPlan); if (!persistFailure.ok) throw safeError_('RECONCILIATION_REQUIRED', 'A solicitação precisa de revisão antes de continuar.'); throw safeError_('PERSISTENCE_FAILED', 'REQUEST_SAVE_FAILED: Não foi possível salvar ou validar a confirmação. Cliente, pagamento e agendamento foram revertidos.'); }
}
function cancellationPaymentPlan_(context) { var source = paymentSheet_(context.config), matches = paymentMatches_(source, context.requestId), h = source.headers; if (matches.length > 1) throw safeError_('RECONCILIATION_REQUIRED', 'O pagamento vinculado precisa de revisão antes do cancelamento.'); if (!matches.length) { var legacy = new Array(h.length).fill(''); legacy[h.indexOf('requestId')] = context.requestId; legacy[h.indexOf('cliente')] = cleanClientText_(context.record['responsável'], 120, true, 'responsável'); legacy[h.indexOf('serviço')] = text_(context.record['serviço']); legacy[h.indexOf('formaPagamento')] = 'PIX'; legacy[h.indexOf('vencimento')] = strictSheetDate_(context.record.data, context.config.TIMEZONE); legacy[h.indexOf('statusPagamento')] = 'CANCELADO'; source.pendingRequestId = context.requestId; return { source: source, rowNumber: source.rows.length + 2, original: null, expected: legacy, created: true }; } var target = matches[0], updated = target.values.slice(), status = String(updated[h.indexOf('statusPagamento')] || '').trim().toUpperCase(); if (status === 'PENDENTE') updated[h.indexOf('statusPagamento')] = 'CANCELADO'; else if (status === 'PAGO') { var marker = '[REVISAR: solicitação cancelada com pagamento pago]', notes = String(updated[h.indexOf('observações')] || '').trim(); if (notes.indexOf(marker) < 0) updated[h.indexOf('observações')] = notes ? notes + '\n' + marker : marker; } else if (status !== 'ISENTO' && status !== 'CANCELADO') throw safeError_('RECONCILIATION_REQUIRED', 'O status do pagamento precisa de revisão.'); return { source: source, rowNumber: target.rowNumber, original: target.values.slice(), expected: updated, created: false }; }
function cancelRequest_(context) { var current = status_(context); assertNoUnexpectedEvent_(context, current); if (current === 'CANCELADO') return { requestId: context.requestId, status: current, idempotent: true }; if (current === 'RECUSADO') throw safeError_('INVALID_TRANSITION', 'Esta ação não é permitida para o status atual.'); if (current !== 'CONFIRMADO') return changeStatus_(context, ['PENDENTE', 'MAIS_INFORMACOES'], 'CANCELADO'); var eventId = String(context.record.eventIdAtendimento || '').trim(), event = eventId && context.appointments.getEventById(eventId); if (!eventMatches_(event, context.requestId)) throw safeError_('RECONCILIATION_REQUIRED', 'A solicitação precisa de revisão antes de continuar.'); var payment = cancellationPaymentPlan_(context); try { writeAndVerifyPayment_(payment.source, payment.rowNumber, payment.expected); } catch (paymentError) { if (!restorePayment_(payment.source, payment.rowNumber, payment.original)) throw safeError_('RECONCILIATION_REQUIRED', 'O pagamento precisa de revisão administrativa.'); throw safeError_('WRITE_ERROR', 'Não foi possível cancelar a solicitação. O pagamento foi preservado.'); } try { event.deleteEvent(); } catch (eventError) { if (!restorePayment_(payment.source, payment.rowNumber, payment.original)) throw safeError_('RECONCILIATION_REQUIRED', 'O cancelamento precisa de revisão administrativa.'); throw safeError_('WRITE_ERROR', 'Não foi possível cancelar o agendamento. O pagamento foi preservado.'); } try { return persist_(context, 'CANCELADO', ''); } catch (error) { var paymentRestored = restorePayment_(payment.source, payment.rowNumber, payment.original), restoredEvent = null, requestRestored = false; try { var interval = interval_(context); restoredEvent = context.appointments.createEvent(event.getTitle(), interval.start, interval.end, { description: event.getDescription() }); if (!eventMatches_(restoredEvent, context.requestId)) throw new Error('invalid restored event'); persist_(context, 'CONFIRMADO', restoredEvent.getId(), String(context.record.clienteId || '').trim()); requestRestored = confirmationRequestMatches_(context, String(context.record.clienteId || '').trim(), restoredEvent.getId()); } catch (restoreError) { if (restoredEvent) try { restoredEvent.deleteEvent(); } catch (ignored) {} } if (paymentRestored && requestRestored) throw safeError_('WRITE_ERROR', 'Não foi possível cancelar a solicitação. Os dados anteriores foram restaurados.'); throw safeError_('RECONCILIATION_REQUIRED', 'O cancelamento precisa de revisão administrativa.'); } }

function notificationTimestamp_(config) { return Utilities.formatDate(new Date(), config.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss"); }
function validDecisionEmail_(value) { var email = displayClientEmail_(value).trim(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ''; }
function notificationStatus_(status, decision, config) { return status + '|' + decision + '|' + notificationTimestamp_(config); }
function persistNotification_(context, value) { var index = column_(context, 'notificationStatus'), row = context.sheet.getRange(context.rowNumber, 1, 1, context.headers.length).getValues()[0]; row[index] = value; row[column_(context, 'dataÚltimaAtualização')] = new Date(); context.sheet.getRange(context.rowNumber, 1, 1, context.headers.length).setValues([row]); SpreadsheetApp.flush(); var reread = context.sheet.getRange(context.rowNumber, 1, 1, context.headers.length).getValues()[0]; if (String(reread[index]) !== value) throw new Error('notification not verified'); }
function htmlEscape_(value) { return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function decisionContent_(context, status) {
  var r = context.record, service = serviceLabel_(r['serviço']), date = text_(r.data), start = text_(r['horário']), end = text_(r['horárioTérmino']), note = text_(r['observaçãoAdministrativa']);
  var subject = status === 'CONFIRMADO' ? 'Sua solicitação foi confirmada — Pati MundoPet' : status === 'RECUSADO' ? 'Atualização da sua solicitação — Pati MundoPet' : 'Agendamento cancelado — Pati MundoPet';
  var decision = status === 'CONFIRMADO' ? 'Sua solicitação foi confirmada.' : status === 'RECUSADO' ? 'Não foi possível confirmar esta solicitação. Fale conosco para consultar outra disponibilidade.' : 'Seu agendamento foi cancelado.';
  var lines = ['Olá, ' + text_(r['responsável']) + '.', '', decision, 'Pet: ' + text_(r.pet), 'Serviço: ' + service, 'Data: ' + date, 'Horário: ' + start + '–' + end, 'Código: ' + context.requestId];
  if (note && status !== 'CONFIRMADO') lines.push('Observação: ' + note.replace(/^'(?=[=+\-@])/, ''));
  if (status === 'CONFIRMADO') lines.push('', 'Valores e Pix permanecem os combinados diretamente com a Pati.');
  lines.push('', 'Contato: responda a este e-mail ou fale com a Pati MundoPet.');
  var body = lines.join('\n'), html = '<p>' + lines.map(htmlEscape_).join('</p><p>') + '</p>';
  return { subject: subject, body: body, htmlBody: html };
}
function notifyDecision_(context, decision) {
  var email = validDecisionEmail_(context.record['e-mail']), value, content, started;
  if (!email) {
    value = notificationStatus_('EMAIL_NAO_INFORMADO', decision, context.config);
    try { persistNotification_(context, value); return { status: value, persisted: true, sent: false, uncertain: false, retryAllowed: false }; }
    catch (error) { console.error('ADMIN_NOTIFICATION_STATUS_UNCERTAIN decision=%s mailAttempted=false', decision); return { status: 'EMAIL_RESULTADO_INCERTO', persisted: false, sent: false, uncertain: true, retryAllowed: false, mailAttempted: false }; }
  }
  started = notificationStatus_('EMAIL_EM_PROCESSAMENTO', decision, context.config);
  try { persistNotification_(context, started); }
  catch (error) { console.error('ADMIN_NOTIFICATION_STATUS_UNCERTAIN decision=%s mailAttempted=false', decision); return { status: 'EMAIL_RESULTADO_INCERTO', persisted: false, sent: false, uncertain: true, retryAllowed: false, mailAttempted: false }; }
  try {
    content = decisionContent_(context, decision); var options = { to: email, subject: content.subject, body: content.body, htmlBody: content.htmlBody, name: 'Pati MundoPet' }, replyTo = validDecisionEmail_(context.config.ADMIN_EMAIL); if (replyTo) options.replyTo = replyTo; MailApp.sendEmail(options); value = notificationStatus_('EMAIL_ENVIADO', decision, context.config);
  } catch (error) { value = notificationStatus_('EMAIL_FALHOU', decision, context.config); }
  try { persistNotification_(context, value); return { status: value, persisted: true, sent: value.indexOf('EMAIL_ENVIADO|') === 0, uncertain: false, retryAllowed: value.indexOf('EMAIL_FALHOU|') === 0, mailAttempted: true }; }
  catch (error) { console.error('ADMIN_NOTIFICATION_STATUS_UNCERTAIN decision=%s mailAttempted=true', decision); return { status: 'EMAIL_RESULTADO_INCERTO', persisted: false, sent: false, uncertain: true, retryAllowed: false, mailAttempted: true, persistedStatus: started }; }
}
function decisionWhatsappUrl_(context, status) { var phone; try { phone = normalizeClientWhatsapp_(context.record.WhatsApp); } catch (error) { return ''; } var r = context.record, note = text_(r['observaçãoAdministrativa']), decision = status === 'CONFIRMADO' ? 'confirmada' : status === 'RECUSADO' ? 'recusada' : 'cancelada', message = 'Olá, ' + text_(r['responsável']) + '. A solicitação de ' + serviceLabel_(r['serviço']) + ' para ' + text_(r.pet) + ', em ' + text_(r.data) + ' das ' + text_(r['horário']) + ' às ' + text_(r['horárioTérmino']) + ', foi ' + decision + '. Código: ' + context.requestId + (note && status !== 'CONFIRMADO' ? '. Observação: ' + note.replace(/^'(?=[=+\-@])/, '') : ''); return 'https://wa.me/' + phone + '?text=' + encodeURIComponent(message); }

var BLOCK_MARKER_ = 'PATI_MUNDOPET_BLOCK';

function criarBloqueio(payload) {
  var config, input;
  try { config = getConfig_(); authorize_(config); input = validateBlock_(payload, config); }
  catch (error) { if (error && error.safeCode) throw error; throw safeError_('INVALID_REQUEST', 'Revise os dados do bloqueio.'); }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw safeError_('LOCK_TIMEOUT', 'O painel está ocupado. Tente novamente.');
  try {
    var appointments = CalendarApp.getCalendarById(config.APPOINTMENTS_CALENDAR_ID);
    var availability = CalendarApp.getCalendarById(config.AVAILABILITY_CALENDAR_ID);
    if (!appointments || !availability) throw safeError_('CONFIG_ERROR', 'Os calendários privados precisam ser revisados.');
    var existing = findBlock_(availability, input);
    if (existing) return { ok: true, data: blockResult_(existing, input, true, config.TIMEZONE) };
    if (hasConflict_(appointments, input) || hasConflict_(availability, input)) throw safeError_('INTERVAL_UNAVAILABLE', 'O período já possui atendimento ou indisponibilidade.');
    var options = { description: blockDescription_(input.blockId, input.reason) };
    var event = input.allDay
      ? availability.createAllDayEvent(input.title, input.start, input.end, options)
      : availability.createEvent(input.title, input.start, input.end, options);
    return { ok: true, data: blockResult_(event, input, false, config.TIMEZONE) };
  } catch (error) {
    if (error && error.safeCode) throw error;
    console.error('ADMIN_BLOCK_WRITE_FAILED');
    throw safeError_('WRITE_ERROR', 'Não foi possível criar o bloqueio. Os dados não foram considerados alterados.');
  } finally { lock.releaseLock(); }
}

function excluirBloqueio(eventId, blockId) {
  var config;
  try { config = getConfig_(); authorize_(config); validateUuid_(blockId); if (typeof eventId !== 'string' || !eventId.trim() || eventId.trim().length > 512) throw safeError_('INVALID_REQUEST', 'O bloqueio informado é inválido.'); }
  catch (error) { if (error && error.safeCode) throw error; throw safeError_('INVALID_REQUEST', 'O bloqueio informado é inválido.'); }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw safeError_('LOCK_TIMEOUT', 'O painel está ocupado. Tente novamente.');
  try {
    var calendar = CalendarApp.getCalendarById(config.AVAILABILITY_CALENDAR_ID);
    if (!calendar) throw safeError_('CONFIG_ERROR', 'O calendário de disponibilidade precisa ser revisado.');
    var event = calendar.getEventById(eventId.trim());
    var identity = event && blockIdentity_(event.getDescription());
    if (!event || !identity.managed || identity.blockId !== blockId.trim()) throw safeError_('RECONCILIATION_REQUIRED', 'Não repita a ação. Revise o bloqueio no Google Agenda.');
    event.deleteEvent();
    return { ok: true, data: { blockId: blockId.trim(), deleted: true } };
  } catch (error) {
    if (error && error.safeCode) throw error;
    console.error('ADMIN_BLOCK_DELETE_FAILED');
    throw safeError_('RECONCILIATION_REQUIRED', 'Não repita a ação. Revise o bloqueio no Google Agenda.');
  } finally { lock.releaseLock(); }
}

function editarBloqueio(eventId, blockId, payload) {
  var config, input, cleanEventId;
  try {
    config = getConfig_(); authorize_(config);
    cleanEventId = validateEventId_(eventId); validateUuid_(blockId);
    input = validateBlock_(payload, config);
    if (input.blockId !== blockId.trim()) throw safeError_('INVALID_REQUEST', 'A identidade do bloqueio é inválida.');
  } catch (error) { if (error && error.safeCode) throw error; throw safeError_('INVALID_REQUEST', 'Revise os dados do bloqueio.'); }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw safeError_('LOCK_TIMEOUT', 'O painel está ocupado. Tente novamente.');
  try {
    var appointments = CalendarApp.getCalendarById(config.APPOINTMENTS_CALENDAR_ID);
    var availability = CalendarApp.getCalendarById(config.AVAILABILITY_CALENDAR_ID);
    if (!appointments || !availability) throw safeError_('CONFIG_ERROR', 'Os calendários privados precisam ser revisados.');
    if (appointments.getEventById(cleanEventId)) throw safeError_('RECONCILIATION_REQUIRED', 'O evento informado não é um bloqueio de disponibilidade.');
    var event = availability.getEventById(cleanEventId), identity = event && blockIdentity_(event.getDescription());
    if (!event) throw safeError_('NOT_FOUND', 'O bloqueio não foi encontrado.');
    if (!identity.managed || identity.blockId !== blockId.trim()) throw safeError_('RECONCILIATION_REQUIRED', 'Não repita a ação. Revise o bloqueio no Google Agenda.');
    if (blockEventEquals_(event, input)) return { ok: true, data: blockResult_(event, input, true, config.TIMEZONE) };
    if (hasConflict_(appointments, input) || hasConflictExcept_(availability, input, cleanEventId)) throw safeError_('INTERVAL_UNAVAILABLE', 'O período já possui atendimento ou indisponibilidade.');
    var snapshot = snapshotBlock_(event);
    try {
      setBlockPeriod_(event, input.allDay, input.start, input.end);
      event.setTitle(input.title);
      event.setDescription(blockDescription_(input.blockId, input.reason));
      if (!blockEventEquals_(event, input)) throw new Error('final state mismatch');
      var result = blockResult_(event, input, false, config.TIMEZONE);
    } catch (writeError) {
      try { restoreBlock_(event, snapshot); if (!blockSnapshotEquals_(event, snapshot)) throw new Error('restore mismatch'); }
      catch (restoreError) { console.error('ADMIN_BLOCK_EDIT_RESTORE_FAILED'); throw safeError_('RECONCILIATION_REQUIRED', 'O bloqueio precisa de revisão no Google Agenda.'); }
      throw safeError_('WRITE_ERROR', 'Não foi possível editar o bloqueio. O estado anterior foi restaurado.');
    }
    return { ok: true, data: result };
  } catch (error) {
    if (error && error.safeCode) throw error;
    console.error('ADMIN_BLOCK_EDIT_FAILED');
    throw safeError_('WRITE_ERROR', 'Não foi possível editar o bloqueio. Tente novamente.');
  } finally { lock.releaseLock(); }
}

function validateEventId_(eventId) { if (typeof eventId !== 'string' || !eventId.trim() || eventId.trim().length > 512) throw safeError_('INVALID_REQUEST', 'O bloqueio informado é inválido.'); return eventId.trim(); }
function hasConflictExcept_(calendar, interval, eventId) { return calendar.getEvents(interval.start, interval.end).some(function (event) { return text_(event.getId()) !== eventId && !(typeof event.getEventStatus === 'function' && String(event.getEventStatus()).toLowerCase() === 'canceled') && event.getStartTime().getTime() < interval.end.getTime() && event.getEndTime().getTime() > interval.start.getTime(); }); }
function blockEventEquals_(event, input) { return event.isAllDayEvent() === input.allDay && event.getStartTime().getTime() === input.start.getTime() && event.getEndTime().getTime() === input.end.getTime() && String(event.getTitle()) === input.title && String(event.getDescription()) === blockDescription_(input.blockId, input.reason); }
function snapshotBlock_(event) { return { allDay: event.isAllDayEvent(), start: new Date(event.getStartTime().getTime()), end: new Date(event.getEndTime().getTime()), title: String(event.getTitle()), description: String(event.getDescription()) }; }
function blockSnapshotEquals_(event, snapshot) { return event.isAllDayEvent() === snapshot.allDay && event.getStartTime().getTime() === snapshot.start.getTime() && event.getEndTime().getTime() === snapshot.end.getTime() && String(event.getTitle()) === snapshot.title && String(event.getDescription()) === snapshot.description; }
function setBlockPeriod_(event, allDay, start, end) { if (allDay) event.setAllDayDates(start, end); else event.setTime(start, end); }
function restoreBlock_(event, snapshot) { setBlockPeriod_(event, snapshot.allDay, snapshot.start, snapshot.end); event.setTitle(snapshot.title); event.setDescription(snapshot.description); }

function blockIdentity_(description) {
  var match = /^PATI_MUNDOPET_BLOCK\nblockId: ([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\n|$)/i.exec(String(description || ''));
  return { managed: Boolean(match), blockId: match ? match[1] : '' };
}
function blockReasonFromDescription_(description) { var match = /(?:^|\n)motivo: ([^\n]*)/.exec(String(description || '')); return match ? match[1] : ''; }
function blockDescription_(blockId, reason) { return BLOCK_MARKER_ + '\nblockId: ' + blockId + '\nmotivo: ' + reason; }
function blockReason_(value) { var reason = String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim(); if (!reason || reason.length > 120) throw safeError_('INVALID_REQUEST', 'Informe um motivo com até 120 caracteres.'); return reason; }
function strictBlockDate_(value, timezone) { var iso = validateIsoDate_(value), parsed; try { parsed = Utilities.parseDate(iso + ' 00:00', timezone, 'yyyy-MM-dd HH:mm'); if (Utilities.formatDate(parsed, timezone, 'yyyy-MM-dd') !== iso) throw new Error('round trip'); } catch (error) { throw safeError_('INVALID_DATE', 'A data informada é inválida.'); } return parsed; }
function strictBlockTime_(value) { if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) throw safeError_('INVALID_INTERVAL', 'Informe horários válidos.'); return value; }
function validateBlock_(payload, config) {
  if (!payload || Object.prototype.toString.call(payload) !== '[object Object]') throw safeError_('INVALID_REQUEST', 'Revise os dados do bloqueio.');
  validateUuid_(payload.blockId); var reason = blockReason_(payload.motivo), type = payload.tipo;
  if (type === 'horario') {
    var date = validateIsoDate_(payload.data), startTime = strictBlockTime_(payload.inicio), endTime = strictBlockTime_(payload.termino);
    if (startTime < '08:30' || startTime >= endTime || endTime > '18:00') throw safeError_('INVALID_INTERVAL', 'O horário deve ficar entre 08:30 e 18:00.');
    strictBlockDate_(date, config.TIMEZONE); var start, end;
    try { start = Utilities.parseDate(date + ' ' + startTime, config.TIMEZONE, 'yyyy-MM-dd HH:mm'); end = Utilities.parseDate(date + ' ' + endTime, config.TIMEZONE, 'yyyy-MM-dd HH:mm'); if (Utilities.formatDate(start, config.TIMEZONE, 'yyyy-MM-dd HH:mm') !== date + ' ' + startTime || Utilities.formatDate(end, config.TIMEZONE, 'yyyy-MM-dd HH:mm') !== date + ' ' + endTime) throw new Error('round trip'); } catch (error) { throw safeError_('INVALID_DATE', 'A data informada é inválida.'); }
    if (start.getTime() < new Date().getTime()) throw safeError_('INVALID_INTERVAL', 'O início do bloqueio não pode estar no passado.');
    return { blockId: payload.blockId.trim(), type: type, allDay: false, start: start, end: end, reason: reason, title: 'Bloqueio — ' + reason };
  }
  if (type === 'dia_inteiro') {
    var startDay = strictBlockDate_(payload.dataInicial, config.TIMEZONE), inclusiveEnd = strictBlockDate_(payload.dataFinal, config.TIMEZONE);
    if (inclusiveEnd.getTime() < startDay.getTime()) throw safeError_('INVALID_RANGE', 'A data final não pode ser anterior à inicial.');
    var exclusiveEnd = new Date(inclusiveEnd.getTime() + 86400000), days = (exclusiveEnd.getTime() - startDay.getTime()) / 86400000;
    if (days > 366) throw safeError_('INVALID_RANGE', 'O bloqueio pode ter no máximo 366 dias.');
    var today = dayRange_(Utilities.formatDate(new Date(), config.TIMEZONE, 'yyyy-MM-dd'), config.TIMEZONE).start;
    if (exclusiveEnd.getTime() <= today.getTime()) throw safeError_('INVALID_RANGE', 'O período não pode estar completamente no passado.');
    return { blockId: payload.blockId.trim(), type: type, allDay: true, start: startDay, end: exclusiveEnd, reason: reason, title: 'Bloqueio — ' + reason };
  }
  throw safeError_('INVALID_REQUEST', 'Escolha um tipo de bloqueio válido.');
}
function findBlock_(calendar, input) { var events = calendar.getEvents(input.start, input.end); for (var i = 0; i < events.length; i++) { var event = events[i], identity = blockIdentity_(event.getDescription()); if (identity.managed && identity.blockId === input.blockId) { if (event.getStartTime().getTime() === input.start.getTime() && event.getEndTime().getTime() === input.end.getTime() && event.isAllDayEvent() === input.allDay && String(event.getTitle()) === input.title && String(event.getDescription()) === blockDescription_(input.blockId, input.reason)) return event; throw safeError_('RECONCILIATION_REQUIRED', 'Não repita a ação. Revise o bloqueio no Google Agenda.'); } } return null; }
function blockResult_(event, input, idempotent, timezone) { return { blockId: input.blockId, eventId: text_(event.getId()), tipo: input.type, inicio: Utilities.formatDate(event.getStartTime(), timezone, "yyyy-MM-dd'T'HH:mm:ss"), termino: Utilities.formatDate(event.getEndTime(), timezone, "yyyy-MM-dd'T'HH:mm:ss"), allDay: input.allDay, titulo: input.title, motivo: input.reason, idempotent: Boolean(idempotent) }; }

/**
 * Utilitário de migração de colunas — execute manualmente UMA VEZ pelo editor do Apps Script
 * (selecione esta função no seletor ao lado de "Executar"). Não é chamada pela interface nem
 * por nenhuma outra função do painel. Garante "endereço" em Solicitações e "endereço" +
 * "horáriosHabituais" em Clientes, sempre adicionando ao final das colunas existentes e nunca
 * sobrescrevendo uma célula que já tenha conteúdo. Repetir a execução depois de já migrado não
 * altera nada; um contrato inesperado (colunas fora do esperado) é reportado no log em vez de
 * alterado às cegas.
 */
function migrarColunasEnderecoEHorarios() {
  var config;
  try { config = getConfig_(); } catch (error) { console.error('Configuração do painel incompleta ou inválida — corrija as Propriedades do Script antes de migrar.'); return; }
  var spreadsheet = SpreadsheetApp.openById(config.SPREADSHEET_ID);

  var requests = spreadsheet.getSheetByName('Solicitações');
  if (!requests) { console.error('Aba "Solicitações" não encontrada.'); }
  else {
    var reqColumns = requests.getLastColumn();
    var reqHeaders = requests.getRange(1, 1, 1, reqColumns).getValues()[0].map(function (v) { return String(v).trim(); });
    if (reqHeaders.indexOf('endereço') >= 0) console.log('Solicitações: coluna "endereço" já existe, nada a fazer.');
    else if (reqColumns === 19) { requests.getRange(1, 20, 1, 1).setValues([['endereço']]); console.log('Solicitações: coluna T ("endereço") criada com sucesso.'); }
    else console.error('Solicitações tem ' + reqColumns + ' colunas (esperado 19 antes da migração) e não encontrei "endereço". Nada foi alterado — confira manualmente.');
  }

  var clients = spreadsheet.getSheetByName('Clientes');
  if (!clients) { console.error('Aba "Clientes" não encontrada.'); }
  else {
    var cliColumns = clients.getLastColumn();
    var cliHeaders = clients.getRange(1, 1, 1, cliColumns).getValues()[0].map(function (v) { return String(v).trim(); });
    var toAdd = ['endereço', 'horáriosHabituais'].filter(function (h) { return cliHeaders.indexOf(h) < 0; });
    if (!toAdd.length) console.log('Clientes: colunas "endereço" e "horáriosHabituais" já existem, nada a fazer.');
    else { clients.getRange(1, cliColumns + 1, 1, toAdd.length).setValues([toAdd]); console.log('Clientes: coluna(s) criada(s) com sucesso: ' + toAdd.join(', ')); }
  }

  console.log('Migração concluída — confira as mensagens acima (Registro de execução) para o resultado de cada aba.');
}
