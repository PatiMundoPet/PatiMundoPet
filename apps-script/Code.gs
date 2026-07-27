/**
 * Backend de solicitações de agenda da Paty MundoPet.
 * Valores operacionais são lidos somente de Script Properties.
 */
var SERVICE_NAME = 'paty-mundopet-scheduling';
var SERVICE_VERSION = '1.0.0';
var MAX_FUTURE_DAYS = 90;
var LOCK_TIMEOUT_MS = 5000;
var REQUIRED_PROPERTIES = [
  'CALENDAR_ID', 'TIMEZONE', 'SLOT_DURATION_MINUTES',
  'ALLOWED_START_TIMES_JSON', 'ALLOWED_SERVICE_IDS_JSON',
  'PENDING_EVENT_PREFIX', 'WHATSAPP_NUMBER'
];
var TEXT_LIMITS = {
  serviceId: 80,
  responsibleName: 120,
  whatsapp: 20,
  petName: 80,
  region: 120,
  notes: 1000,
  requestId: 36
};

function doGet(e) {
  try {
    var action = getParameter_(e, 'action');
    if (action === 'health') return jsonResponse_(healthResponse_());
    if (action === 'availability') return jsonResponse_(availabilityResponse_(getParameter_(e, 'date')));
    return jsonResponse_(response_(false, 'INVALID_REQUEST', 'Ação GET inválida.'));
  } catch (error) {
    console.error('Erro interno no endpoint GET.');
    return jsonResponse_(response_(false, 'INTERNAL_ERROR', 'Não foi possível processar a solicitação.'));
  }
}

function doPost(e) {
  try {
    var payload = parsePostPayload_(e);
    if (payload.action !== 'request') {
      return jsonResponse_(response_(false, 'INVALID_REQUEST', 'Ação POST inválida.'));
    }
    return jsonResponse_(requestResponse_(payload));
  } catch (error) {
    console.error('Erro interno no endpoint POST.');
    return jsonResponse_(response_(false, 'INTERNAL_ERROR', 'Não foi possível processar a solicitação.'));
  }
}

function healthResponse_() {
  var configResult = loadConfig_();
  return {
    ok: true,
    code: 'HEALTH_OK',
    message: 'Serviço de diagnóstico disponível.',
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    configured: configResult.ok,
    timestamp: new Date().toISOString()
  };
}

function availabilityResponse_(dateText) {
  var configResult = loadConfig_();
  if (!configResult.ok) return response_(false, 'CONFIGURATION_REQUIRED', 'A integração ainda não foi configurada.');
  var config = configResult.config;
  var dateResult = validateDate_(dateText, config.timezone, true);
  if (!dateResult.ok) return response_(false, 'INVALID_REQUEST', dateResult.message);

  var calendar = CalendarApp.getCalendarById(config.calendarId);
  if (!calendar) return response_(false, 'CONFIGURATION_REQUIRED', 'A agenda configurada não está disponível.');
  var available = [];
  var unavailable = [];
  config.allowedStartTimes.forEach(function (time) {
    var interval = createInterval_(dateText, time, config);
    if (intervalHasStarted_(interval)) {
      unavailable.push(time);
      return;
    }
    var hasConflict = calendar.getEvents(interval.start, interval.end).length > 0;
    (hasConflict ? unavailable : available).push(time);
  });
  return response_(true, 'AVAILABILITY_OK', 'Disponibilidade consultada.', null, {
    date: dateText,
    available: available,
    unavailable: unavailable
  });
}

function requestResponse_(payload) {
  var configResult = loadConfig_();
  if (!configResult.ok) return response_(false, 'CONFIGURATION_REQUIRED', 'A integração ainda não foi configurada.');
  var config = configResult.config;
  var validation = validateRequest_(payload, config);
  if (!validation.ok) return response_(false, 'INVALID_REQUEST', validation.message);
  var clean = validation.value;
  var requestId = clean.requestId || Utilities.getUuid();
  var interval = createInterval_(clean.date, clean.time, config);
  if (intervalHasStarted_(interval)) {
    return response_(false, 'SLOT_UNAVAILABLE', 'O horário selecionado já passou.', requestId);
  }
  var calendar = CalendarApp.getCalendarById(config.calendarId);
  if (!calendar) return response_(false, 'CONFIGURATION_REQUIRED', 'A agenda configurada não está disponível.');

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_TIMEOUT_MS)) {
    return response_(false, 'LOCK_TIMEOUT', 'A agenda está ocupada. Tente novamente em instantes.', requestId);
  }
  try {
    if (requestIdExists_(calendar, requestId, config)) {
      return response_(true, 'REQUEST_CREATED', 'Esta solicitação já havia sido registrada para revisão.', requestId);
    }
    var events = calendar.getEvents(interval.start, interval.end);
    if (events.length > 0) {
      return response_(false, 'SLOT_UNAVAILABLE', 'O horário selecionado não está mais disponível.', requestId);
    }
    var createdAt = new Date().toISOString();
    var title = config.pendingPrefix + ' ' + clean.petName + ' — ' + clean.serviceId;
    var description = [
      'Responsável: ' + clean.responsibleName,
      'WhatsApp: ' + clean.whatsapp,
      'Pet: ' + clean.petName,
      'Serviço: ' + clean.serviceId,
      'Região: ' + clean.region,
      'Observações: ' + (clean.notes || 'Não informadas'),
      'requestId: ' + requestId,
      'Criada em: ' + createdAt
    ].join('\n');
    calendar.createEvent(title, interval.start, interval.end, { description: description });
    return response_(true, 'REQUEST_CREATED', 'Solicitação criada como pendente para revisão.', requestId);
  } finally {
    lock.releaseLock();
  }
}

function loadConfig_() {
  var properties = PropertiesService.getScriptProperties().getProperties();
  for (var i = 0; i < REQUIRED_PROPERTIES.length; i += 1) {
    var name = REQUIRED_PROPERTIES[i];
    if (typeof properties[name] !== 'string' || properties[name].trim() === '') return { ok: false };
  }
  try {
    var duration = Number(properties.SLOT_DURATION_MINUTES);
    var times = JSON.parse(properties.ALLOWED_START_TIMES_JSON);
    var services = JSON.parse(properties.ALLOWED_SERVICE_IDS_JSON);
    if (!Number.isInteger(duration) || duration < 1 || duration > 1440) return { ok: false };
    if (properties.CALENDAR_ID.length > 320 || hasControlCharacters_(properties.CALENDAR_ID)) return { ok: false };
    if (properties.TIMEZONE !== properties.TIMEZONE.trim() || hasControlCharacters_(properties.TIMEZONE)) return { ok: false };
    if (properties.PENDING_EVENT_PREFIX.length > 40 || hasControlCharacters_(properties.PENDING_EVENT_PREFIX)) return { ok: false };
    if (!Array.isArray(times) || times.length === 0 || times.some(function (time) { return !isValidTime_(time); })) return { ok: false };
    if (new Set(times).size !== times.length) return { ok: false };
    if (!Array.isArray(services) || services.length === 0 || services.some(function (id) { return typeof id !== 'string' || id !== id.trim() || !id || id.length > TEXT_LIMITS.serviceId || hasControlCharacters_(id); })) return { ok: false };
    if (new Set(services).size !== services.length) return { ok: false };
    Utilities.formatDate(new Date(), properties.TIMEZONE, 'yyyy-MM-dd');
    var normalizedBusinessPhone = normalizeWhatsapp_(properties.WHATSAPP_NUMBER);
    if (!normalizedBusinessPhone) return { ok: false };
    return { ok: true, config: {
      calendarId: properties.CALENDAR_ID,
      timezone: properties.TIMEZONE,
      slotDurationMinutes: duration,
      allowedStartTimes: times,
      allowedServiceIds: services,
      pendingPrefix: properties.PENDING_EVENT_PREFIX,
      whatsappNumber: normalizedBusinessPhone
    } };
  } catch (error) {
    return { ok: false };
  }
}

function validateRequest_(payload, config) {
  if (String(payload.honeypot || '').trim()) return { ok: false, message: 'Solicitação inválida.' };
  var required = ['serviceId', 'date', 'time', 'responsibleName', 'whatsapp', 'petName', 'region'];
  for (var i = 0; i < required.length; i += 1) {
    if (typeof payload[required[i]] !== 'string' || !payload[required[i]].trim()) return { ok: false, message: 'Preencha todos os campos obrigatórios.' };
  }
  if (payload.reviewAccepted !== true && payload.reviewAccepted !== 'true') return { ok: false, message: 'A revisão da solicitação deve ser aceita.' };
  var textFields = ['serviceId', 'responsibleName', 'whatsapp', 'petName', 'region', 'notes'];
  for (var j = 0; j < textFields.length; j += 1) {
    var field = textFields[j];
    var value = String(payload[field] || '').trim();
    if (value.length > TEXT_LIMITS[field] || hasControlCharacters_(value)) return { ok: false, message: 'Um ou mais campos de texto são inválidos.' };
  }
  if (config.allowedServiceIds.indexOf(payload.serviceId.trim()) === -1) return { ok: false, message: 'Serviço não permitido.' };
  if (!isValidTime_(payload.time) || config.allowedStartTimes.indexOf(payload.time) === -1) return { ok: false, message: 'Horário inválido.' };
  var dateResult = validateDate_(payload.date, config.timezone, true);
  if (!dateResult.ok) return { ok: false, message: dateResult.message };
  var phone = normalizeWhatsapp_(payload.whatsapp);
  if (!phone) return { ok: false, message: 'WhatsApp inválido.' };
  var requestId = String(payload.requestId || '').trim();
  if (requestId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) return { ok: false, message: 'Identificador da solicitação inválido.' };
  return { ok: true, value: {
    serviceId: payload.serviceId.trim(), date: payload.date, time: payload.time,
    responsibleName: payload.responsibleName.trim(), whatsapp: phone,
    petName: payload.petName.trim(), region: payload.region.trim(),
    notes: String(payload.notes || '').trim(), requestId: requestId
  } };
}

function validateDate_(dateText, timezone, enforceRange) {
  if (typeof dateText !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return { ok: false, message: 'Data inválida.' };
  try {
    var parsed = Utilities.parseDate(dateText + ' 12:00', timezone, 'yyyy-MM-dd HH:mm');
    if (Utilities.formatDate(parsed, timezone, 'yyyy-MM-dd') !== dateText) return { ok: false, message: 'Data inválida.' };
    if (enforceRange) {
      var todayText = Utilities.formatDate(new Date(), timezone, 'yyyy-MM-dd');
      var today = Utilities.parseDate(todayText + ' 12:00', timezone, 'yyyy-MM-dd HH:mm');
      var days = Math.round((parsed.getTime() - today.getTime()) / 86400000);
      if (days < 0) return { ok: false, message: 'Datas passadas não são permitidas.' };
      if (days > MAX_FUTURE_DAYS) return { ok: false, message: 'A data excede o período máximo de consulta.' };
    }
    return { ok: true, date: parsed };
  } catch (error) {
    return { ok: false, message: 'Data inválida.' };
  }
}

function isValidTime_(time) {
  return typeof time === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time);
}

function normalizeWhatsapp_(value) {
  if (typeof value !== 'string') return '';
  if (hasControlCharacters_(value)) return '';
  var digits = value.replace(/\D/g, '');
  return /^\d{10,15}$/.test(digits) ? digits : '';
}

function hasControlCharacters_(value) {
  return /[\u0000-\u001F\u007F]/.test(value);
}

function createInterval_(dateText, time, config) {
  var start = Utilities.parseDate(dateText + ' ' + time, config.timezone, 'yyyy-MM-dd HH:mm');
  return { start: start, end: new Date(start.getTime() + config.slotDurationMinutes * 60000) };
}

function now_() {
  return new Date();
}

function intervalHasStarted_(interval) {
  return interval.start.getTime() <= now_().getTime();
}

function hasRequestId_(events, requestId) {
  var marker = 'requestId: ' + requestId;
  return events.some(function (event) { return event.getDescription().indexOf(marker) !== -1; });
}

function requestIdExists_(calendar, requestId, config) {
  var todayText = Utilities.formatDate(new Date(), config.timezone, 'yyyy-MM-dd');
  var rangeStart = Utilities.parseDate(todayText + ' 00:00', config.timezone, 'yyyy-MM-dd HH:mm');
  var rangeEnd = new Date(rangeStart.getTime() + (MAX_FUTURE_DAYS + 2) * 86400000);
  return hasRequestId_(calendar.getEvents(rangeStart, rangeEnd, { search: requestId }), requestId);
}

function parsePostPayload_(e) {
  if (e && e.postData && typeof e.postData.contents === 'string' && e.postData.contents.trim()) {
    return JSON.parse(e.postData.contents);
  }
  return e && e.parameter ? e.parameter : {};
}

function getParameter_(e, name) {
  return e && e.parameter && typeof e.parameter[name] === 'string' ? e.parameter[name] : '';
}

function response_(ok, code, message, requestId, data) {
  var result = { ok: ok, code: code, message: message };
  if (requestId) result.requestId = requestId;
  if (data !== undefined) result.data = data;
  return result;
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Retorna e registra apenas um modelo fictício; não grava Script Properties.
 */
function setupExampleProperties() {
  var example = {
    CALENDAR_ID: 'agenda-exemplo@group.calendar.google.com',
    TIMEZONE: 'America/Sao_Paulo',
    SLOT_DURATION_MINUTES: '60',
    ALLOWED_START_TIMES_JSON: '["09:00","11:00","14:00"]',
    ALLOWED_SERVICE_IDS_JSON: '["servico-exemplo"]',
    PENDING_EVENT_PREFIX: '[PENDENTE]',
    WHATSAPP_NUMBER: '5500000000000'
  };
  console.log('EXEMPLO FICTÍCIO — copie e substitua manualmente: ' + JSON.stringify(example));
  return example;
}
