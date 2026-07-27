import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const source = await readFile(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
let properties = {};
let events = [];
let calendarQueries = 0;
let cacheValues = new Map();
function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error('invalid date');
  const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5]));
  if (date.getUTCFullYear() !== +match[1] || date.getUTCMonth() !== +match[2] - 1 || date.getUTCDate() !== +match[3]) throw new Error('invalid date');
  return date;
}
const calendar = {
  getEvents(start, end) {
    calendarQueries += 1;
    return events.filter((event) => event.start < end && event.end > start);
  },
  createEvent(title, start, end, options) { const created = { id: 'event-' + (events.length + 1), title, start, end, description: options.description, getDescription() { return this.description; }, getTitle() { return this.title; }, getId() { return this.id; }, deleteEvent() { events = events.filter((item) => item !== this); }, setDescription(value) { this.description = value; } }; events.push(created); return created; }
};
const context = vm.createContext({
  console: { log() {}, error() {} }, Date, JSON, Math, Number, Set,
  CacheService: { getScriptCache: () => ({ get: (key) => cacheValues.get(key) || null, put: (key, value) => cacheValues.set(key, value) }) },
  PropertiesService: { getScriptProperties: () => ({ getProperties: () => ({ ...properties }) }) },
  CalendarApp: { getCalendarById: () => calendar },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  Utilities: {
    DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' },
    newBlob: (value) => ({ getBytes: () => [...Buffer.from(value)] }),
    computeDigest: (algorithm, value) => [...createHash('sha256').update(value).digest()],
    getUuid: () => '123e4567-e89b-42d3-a456-426614174000',
    parseDate: (value) => parseDate(value),
    formatDate: (date, timezone, format) => {
      if (!timezone || timezone === 'Invalid/Zone') throw new Error('invalid timezone');
      if (format !== 'yyyy-MM-dd') throw new Error('unsupported format');
      return date.toISOString().slice(0, 10);
    }
  },
  MailApp: { sendEmail() { throw new Error('e-mail não habilitado em teste'); } },
  ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput(value) { return { value, setMimeType() { return this; } }; } }
});
vm.runInContext(source, context, { filename: 'Code.gs' });

const futureDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const validProperties = {
  CALENDAR_ID: 'calendar.test', TIMEZONE: 'Etc/UTC', SLOT_DURATION_MINUTES: '60',
  ALLOWED_START_TIMES_JSON: '["09:00","11:00"]', ALLOWED_SERVICE_IDS_JSON: '["dog-walker"]',
  PENDING_EVENT_PREFIX: '[PENDENTE]', WHATSAPP_NUMBER: '5511999999999', PRIVACY_POLICY_VERSION: 'draft-2026-01',
  MAX_REQUEST_BYTES: '8192', RATE_LIMIT_WINDOW_MINUTES: '15', RATE_LIMIT_MAX_REQUESTS: '3', RATE_LIMIT_SALT: 'fictitious-test-salt', PENDING_RETENTION_DAYS: '30'
};
const validRequest = {
  action: 'request', serviceId: 'dog-walker', date: futureDate, time: '09:00', responsibleName: 'Pessoa Teste',
  whatsapp: '(11) 99999-9999', email: '', submissionChannel: 'whatsapp', petName: 'Pet Teste', region: 'Região Teste', notes: 'Texto breve', reviewAccepted: true, privacyAccepted: true, privacyPolicyVersion: 'draft-2026-01', honeypot: '', requestId: '123e4567-e89b-42d3-a456-426614174000'
};
function configure() { properties = { ...validProperties }; events = []; calendarQueries = 0; cacheValues = new Map(); }
function validate(overrides = {}) { return context.validateRequest_({ ...validRequest, ...overrides }, context.loadConfig_().config); }

configure();
assert.equal(context.validateDate_('2026-02-30', 'Etc/UTC', false).ok, false, 'rejeita data inexistente');
assert.equal(context.validateDate_('30/02/2026', 'Etc/UTC', false).ok, false, 'rejeita formato de data inválido');
assert.equal(context.isValidTime_('09:00'), true, 'aceita horário HH:mm');
assert.equal(context.isValidTime_('24:00'), false, 'rejeita horário impossível');
assert.equal(context.normalizeWhatsapp_('+55 (11) 99999-9999'), '5511999999999', 'normaliza WhatsApp');
assert.equal(context.normalizeWhatsapp_('123'), '', 'rejeita WhatsApp curto');
assert.equal(validate({ notes: 'x'.repeat(1001) }).ok, false, 'aplica limites de texto');
assert.equal(validate({ responsibleName: 'Nome\nInjetado' }).ok, false, 'rejeita caracteres de controle');
assert.equal(validate({ serviceId: 'nao-permitido' }).ok, false, 'rejeita serviço não permitido');
assert.equal(validate({ honeypot: 'robô' }).ok, false, 'rejeita honeypot preenchido');
properties = {};
assert.equal(context.loadConfig_().ok, false, 'detecta configuração incompleta');
assert.equal(context.availabilityResponse_(futureDate).code, 'CONFIGURATION_REQUIRED');
configure();
const start = parseDate(`${futureDate} 09:30`);
events.push({ start, end: new Date(start.getTime() + 30 * 60000), description: 'privado', getDescription() { return this.description; } });
const availability = context.availabilityResponse_(futureDate);
assert.deepEqual([...availability.data.unavailable], ['09:00'], 'detecta colisão de intervalos');
assert.equal(JSON.stringify(availability).includes('privado'), false, 'não retorna dados privados de eventos');

configure();
const today = new Date().toISOString().slice(0, 10);
context.now_ = () => parseDate(`${today} 10:00`);
const todayAvailability = context.availabilityResponse_(today);
assert.deepEqual([...todayAvailability.data.available], ['11:00'], 'mantém horário futuro do dia disponível');
assert.deepEqual([...todayAvailability.data.unavailable], ['09:00'], 'não apresenta horário passado como disponível');
assert.equal(calendarQueries, 1, 'não consulta o calendário para horário que já passou');
const pastRequest = context.requestResponse_({ ...validRequest, date: today, time: '09:00' });
assert.equal(pastRequest.code, 'SLOT_UNAVAILABLE', 'rejeita solicitação para horário que já passou');
assert.equal(events.length, 0, 'não cria evento para horário que já passou');
const futureRequest = context.requestResponse_({ ...validRequest, date: today, time: '11:00' });
assert.equal(futureRequest.code, 'REQUEST_CREATED', 'aceita normalmente horário futuro do mesmo dia');
assert.equal(events.length, 1, 'cria evento somente para o horário futuro');
context.now_ = () => new Date();


configure();
assert.equal(validate({ whatsapp: '', email: 'cliente@outlook.com', submissionChannel: 'email' }).ok, true, 'aceita e-mail válido de qualquer provedor');
assert.equal(validate({ whatsapp: '', email: 'cliente@empresa.com.br', submissionChannel: 'email' }).ok, true, 'aceita e-mail empresarial');
assert.equal(validate({ whatsapp: '', email: 'invalido', submissionChannel: 'email' }).ok, false, 'rejeita e-mail inválido');
assert.equal(validate({ email: '', submissionChannel: 'email' }).ok, false, 'exige e-mail no canal e-mail');
assert.equal(validate({ whatsapp: '', email: 'cliente@yahoo.com', submissionChannel: 'whatsapp' }).ok, false, 'exige WhatsApp no canal WhatsApp');

configure();
const created = context.requestResponse_(validRequest);
assert.equal(created.code, 'REQUEST_CREATED');
assert.equal(typeof created.requestId, 'string');
assert.deepEqual(Object.keys(created).sort(), ['code', 'message', 'notificationStatus', 'ok', 'requestId'], 'mantém estrutura segura da resposta');
const repeated = context.requestResponse_({ ...validRequest, requestId: created.requestId });
assert.equal(repeated.code, 'REQUEST_CREATED');
assert.equal(events.length, 1, 'não duplica uma solicitação com o mesmo requestId');
const repeatedAtAnotherTime = context.requestResponse_({ ...validRequest, time: '11:00', requestId: created.requestId });
assert.equal(repeatedAtAnotherTime.code, 'REQUEST_CREATED');
assert.equal(events.length, 1, 'localiza o requestId antes de criar em outro intervalo');
for (const code of ['CONFIGURATION_REQUIRED', 'INVALID_REQUEST', 'SLOT_UNAVAILABLE', 'LOCK_TIMEOUT', 'REQUEST_CREATED', 'INTERNAL_ERROR']) assert.match(code, /^[A-Z_]+$/);
configure();
assert.equal(validate({ privacyAccepted: false }).ok, false, 'exige consentimento separado');
assert.equal(validate({ privacyPolicyVersion: '' }).ok, false, 'exige versão');
assert.equal(validate({ privacyPolicyVersion: 'outra' }).ok, false, 'rejeita versão diferente');
assert.equal(validate({ unexpected: 'x' }).ok, false, 'rejeita campo inesperado');
const postBase = { postData: { contents: 'action=request', type: 'application/x-www-form-urlencoded; charset=UTF-8' }, parameter: { ...validRequest } };
assert.equal(context.parsePostPayload_(postBase, 8192).ok, true);
assert.equal(context.parsePostPayload_({ ...postBase, postData: { ...postBase.postData, type: 'application/json' } }, 8192).ok, false, 'rejeita Content-Type');
assert.equal(context.parsePostPayload_({ ...postBase, postData: { ...postBase.postData, contents: 'x'.repeat(9000) } }, 8192).ok, false, 'rejeita corpo grande');
const key = context.rateLimitKey_('5511999999999', context.loadConfig_().config);
assert.equal(key.includes('5511999999999'), false, 'hash não contém telefone bruto');
assert.equal(context.consumeRateLimit_('5511999999999', context.loadConfig_().config), true);
context.consumeRateLimit_('5511999999999', context.loadConfig_().config); context.consumeRateLimit_('5511999999999', context.loadConfig_().config);
assert.equal(context.consumeRateLimit_('5511999999999', context.loadConfig_().config), false, 'limite excedido');
configure();
let sentEmails = [];
context.MailApp.sendEmail = (message) => { sentEmails.push(message); };
properties.EMAIL_NOTIFICATIONS_ENABLED = 'true'; properties.NOTIFICATION_EMAIL = 'admin@example.test';
const emailRequest = { ...validRequest, whatsapp: '', email: 'cliente@hotmail.com', submissionChannel: 'email', requestId: '223e4567-e89b-42d3-a456-426614174000' };
const emailed = context.requestResponse_(emailRequest);
assert.equal(emailed.notificationStatus, 'SENT'); assert.equal(sentEmails.length, 1, 'envia somente com configuração habilitada');
assert.equal(sentEmails[0].to, properties.NOTIFICATION_EMAIL); assert.equal(sentEmails[0].replyTo, emailRequest.email); assert.match(sentEmails[0].subject, /PENDENTE/);
const emailedAgain = context.requestResponse_(emailRequest); assert.equal(emailedAgain.notificationStatus, 'SENT'); assert.equal(sentEmails.length, 1, 'não reenvia notificação SENT'); assert.equal(events.length, 1, 'não duplica requestId por e-mail');
assert.equal(JSON.stringify(emailed).includes(properties.NOTIFICATION_EMAIL), false, 'não expõe e-mail administrativo');
configure(); properties.EMAIL_NOTIFICATIONS_ENABLED = 'true'; properties.NOTIFICATION_EMAIL = 'admin@example.test'; context.MailApp.sendEmail = () => { throw new Error('falha simulada'); };
const failedEmail = context.requestResponse_({ ...emailRequest, requestId: '323e4567-e89b-42d3-a456-426614174000' }); assert.equal(failedEmail.code, 'REQUEST_CREATED'); assert.equal(failedEmail.notificationStatus, 'FAILED'); assert.equal(events.length, 1, 'preserva solicitação quando MailApp falha');
context.MailApp.sendEmail = () => { throw new Error('teste não envia e-mail real'); };

configure();
const oldStart = new Date(Date.now() - 60 * 86400000); const oldEnd = new Date(oldStart.getTime() + 3600000);
function retentionEvent(id, title, description) { return { id, title, description, start: oldStart, end: oldEnd, deleted: false, getId() { return this.id; }, getTitle() { return this.title; }, getDescription() { return this.description; }, deleteEvent() { this.deleted = true; events = events.filter((item) => item !== this); } }; }
const expiredPending = retentionEvent('technical-pending', '[PENDENTE] Pet', 'private person phone');
const confirmed = retentionEvent('technical-confirmed', '[CONFIRMADO] Pet', 'private confirmed data'); events = [expiredPending, confirmed];
const preview = context.previewExpiredPendingEvents();
assert.deepEqual([...preview.eventIds], ['technical-pending']); assert.equal(JSON.stringify(preview).includes('private'), false, 'preview não retorna dados pessoais');
assert.equal(context.cleanupExpiredPendingEvents(false).removed, 0); assert.equal(events.length, 2, 'sem true não remove');
assert.equal(context.cleanupExpiredPendingEvents(true).removed, 1); assert.equal(events.includes(confirmed), true, 'confirmado nunca é removido');
assert.doesNotMatch(source, /console\.(?:log|error)\([^)]*(?:responsibleName|whatsapp|petName|region|notes)/, 'logs não incluem dados pessoais');
console.log('Testes locais do Apps Script concluídos com sucesso.');
