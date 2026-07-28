/**
 * Pati MundoPet — painel administrativo privado (Fase 10A, somente leitura).
 */
var ADMIN = Object.freeze({
  properties: ['ADMIN_EMAIL', 'SPREADSHEET_ID', 'APPOINTMENTS_CALENDAR_ID', 'AVAILABILITY_CALENDAR_ID', 'TIMEZONE', 'SLOT_INTERVAL_MINUTES', 'WORKDAY_START_TIME', 'WORKDAY_END_TIME'],
  sheets: {
    requests: { name: 'Solicitações', headers: ['requestId', 'dataRecebimento', 'submissionChannel', 'serviço', 'data', 'horário', 'responsável', 'WhatsApp', 'e-mail', 'pet', 'região', 'observações', 'status', 'notificationStatus', 'dataÚltimaAtualização'] },
    clients: { name: 'Clientes', headers: ['clienteId', 'responsável', 'WhatsApp', 'e-mail', 'pets', 'observações', 'dataCadastro', 'últimoAtendimento'] },
    payments: { name: 'Pagamentos', headers: ['requestId', 'cliente', 'serviço', 'valor', 'formaPagamento', 'vencimento', 'statusPagamento', 'dataPagamento', 'observações'] }
  },
  requestStatuses: ['PENDENTE', 'CONFIRMADO', 'RECUSADO', 'CANCELADO', 'MAIS_INFORMACOES'],
  paymentStatuses: ['PENDENTE', 'PAGO', 'ATRASADO', 'CANCELADO', 'ISENTO']
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
        pendingPayments: countStatus_(payments, 'status', ['PENDENTE', 'ATRASADO']),
        agenda: appointments.slice(0, 8),
        blocksNextSevenDays: blocks.length
      },
      settings: publicSettings_(config),
      today: today
    };
  });
}

function listarSolicitacoes() {
  return safelyRead_(function (config) { return readSheet_(config, ADMIN.sheets.requests, mapRequest_); });
}

function listarClientes() {
  return safelyRead_(function (config) { return readSheet_(config, ADMIN.sheets.clients, mapClient_); });
}

function listarPagamentos() {
  return safelyRead_(function (config) { return readSheet_(config, ADMIN.sheets.payments, mapPayment_); });
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
  var interval = Number(values.SLOT_INTERVAL_MINUTES);
  if (values.TIMEZONE !== 'America/Sao_Paulo' || interval !== 30 || values.WORKDAY_START_TIME !== '08:30' || values.WORKDAY_END_TIME !== '18:00') {
    throw safeError_('CONFIG_ERROR', 'Os horários operacionais do painel precisam ser revisados.');
  }
  values.SLOT_INTERVAL_MINUTES = interval;
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
    service: text_(row['serviço']), date: date_(row.data, timezone), time: time_(row['horário'], timezone), responsible: text_(row['responsável']),
    whatsapp: text_(row.WhatsApp), email: text_(row['e-mail']), pet: text_(row.pet), region: text_(row['região']), notes: text_(row['observações']),
    status: officialStatus_(row.status, ADMIN.requestStatuses), notificationStatus: text_(row.notificationStatus), updatedAt: dateTime_(row['dataÚltimaAtualização'], timezone)
  };
}

function mapClient_(row, timezone) {
  return { clientId: text_(row.clienteId), responsible: text_(row['responsável']), whatsapp: text_(row.WhatsApp), email: text_(row['e-mail']), pets: text_(row.pets), notes: text_(row['observações']), registeredAt: dateTime_(row.dataCadastro, timezone), lastAppointment: dateTime_(row['últimoAtendimento'], timezone) };
}

function mapPayment_(row, timezone) {
  return { requestId: text_(row.requestId), client: text_(row.cliente), service: text_(row['serviço']), amount: number_(row.valor), paymentMethod: text_(row.formaPagamento), dueDate: date_(row.vencimento, timezone), status: officialStatus_(row.statusPagamento, ADMIN.paymentStatuses), paidAt: dateTime_(row.dataPagamento, timezone), notes: text_(row['observações']) };
}

function officialStatus_(value, allowed) {
  var status = text_(value).toUpperCase();
  return allowed.indexOf(status) >= 0 ? status : '';
}
function text_(value) { return value === null || value === undefined ? '' : String(value).trim(); }
function number_(value) { var number = Number(value); return isFinite(number) ? number : null; }
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
    return {
      type: type, title: text_(event.getTitle()), allDay: event.isAllDayEvent(),
      start: Utilities.formatDate(eventStart, timezone, "yyyy-MM-dd'T'HH:mm:ss"),
      end: Utilities.formatDate(eventEnd, timezone, "yyyy-MM-dd'T'HH:mm:ss")
    };
  }).sort(function (a, b) { return a.start.localeCompare(b.start); });
}

function publicSettings_(config) {
  return { timezone: config.TIMEZONE, slotIntervalMinutes: config.SLOT_INTERVAL_MINUTES, workdayStart: config.WORKDAY_START_TIME, workdayEnd: config.WORKDAY_END_TIME, firstSlot: '08:30', lastSlot: '17:30' };
}
function countStatus_(rows, key, statuses) { return rows.filter(function (row) { return statuses.indexOf(row[key]) >= 0; }).length; }
function overlapsPeriod_(event, periodStart, periodEnd) { return event.start < periodEnd && event.end > periodStart; }
function nextIsoDate_(iso) {
  var parts = iso.split('-').map(Number);
  var next = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + 1));
  return next.getUTCFullYear() + '-' + String(next.getUTCMonth() + 1).padStart(2, '0') + '-' + String(next.getUTCDate()).padStart(2, '0');
}
function overlapsDay_(event, iso) { return overlapsPeriod_(event, iso + 'T00:00:00', nextIsoDate_(iso) + 'T00:00:00'); }
