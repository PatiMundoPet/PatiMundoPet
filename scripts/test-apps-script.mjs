import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
let properties = {};
let events = [];
function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error('invalid date');
  const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5]));
  if (date.getUTCFullYear() !== +match[1] || date.getUTCMonth() !== +match[2] - 1 || date.getUTCDate() !== +match[3]) throw new Error('invalid date');
  return date;
}
const calendar = {
  getEvents(start, end) { return events.filter((event) => event.start < end && event.end > start); },
  createEvent(title, start, end, options) { events.push({ title, start, end, description: options.description, getDescription() { return this.description; } }); }
};
const context = vm.createContext({
  console: { log() {}, error() {} }, Date, JSON, Math, Number, Set,
  PropertiesService: { getScriptProperties: () => ({ getProperties: () => ({ ...properties }) }) },
  CalendarApp: { getCalendarById: () => calendar },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  Utilities: {
    getUuid: () => '123e4567-e89b-42d3-a456-426614174000',
    parseDate: (value) => parseDate(value),
    formatDate: (date, timezone, format) => {
      if (!timezone || timezone === 'Invalid/Zone') throw new Error('invalid timezone');
      if (format !== 'yyyy-MM-dd') throw new Error('unsupported format');
      return date.toISOString().slice(0, 10);
    }
  },
  ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput(value) { return { value, setMimeType() { return this; } }; } }
});
vm.runInContext(source, context, { filename: 'Code.gs' });

const futureDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const validProperties = {
  CALENDAR_ID: 'calendar.test', TIMEZONE: 'Etc/UTC', SLOT_DURATION_MINUTES: '60',
  ALLOWED_START_TIMES_JSON: '["09:00","11:00"]', ALLOWED_SERVICE_IDS_JSON: '["dog-walker"]',
  PENDING_EVENT_PREFIX: '[PENDENTE]', WHATSAPP_NUMBER: '5511999999999'
};
const validRequest = {
  action: 'request', serviceId: 'dog-walker', date: futureDate, time: '09:00', responsibleName: 'Pessoa Teste',
  whatsapp: '(11) 99999-9999', petName: 'Pet Teste', region: 'Região Teste', notes: 'Texto breve', reviewAccepted: true, honeypot: ''
};
function configure() { properties = { ...validProperties }; events = []; }
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
const created = context.requestResponse_(validRequest);
assert.equal(created.code, 'REQUEST_CREATED');
assert.equal(typeof created.requestId, 'string');
assert.deepEqual(Object.keys(created).sort(), ['code', 'message', 'ok', 'requestId'], 'mantém estrutura segura da resposta');
const repeated = context.requestResponse_({ ...validRequest, requestId: created.requestId });
assert.equal(repeated.code, 'REQUEST_CREATED');
assert.equal(events.length, 1, 'não duplica uma solicitação com o mesmo requestId');
const repeatedAtAnotherTime = context.requestResponse_({ ...validRequest, time: '11:00', requestId: created.requestId });
assert.equal(repeatedAtAnotherTime.code, 'REQUEST_CREATED');
assert.equal(events.length, 1, 'localiza o requestId antes de criar em outro intervalo');
for (const code of ['CONFIGURATION_REQUIRED', 'INVALID_REQUEST', 'SLOT_UNAVAILABLE', 'LOCK_TIMEOUT', 'REQUEST_CREATED', 'INTERNAL_ERROR']) assert.match(code, /^[A-Z_]+$/);
console.log('Testes locais do Apps Script concluídos com sucesso.');
