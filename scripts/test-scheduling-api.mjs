import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const Api = require('../assets/js/scheduling-api.js');
const base = { mode: 'live', webAppUrl: 'https://script.google.com/macros/s/example/exec', requestTimeoutMs: 500, maxResponseBytes: 4096, maxFutureDays: 90, messages: { demo: 'demo' } };
const response = (value) => ({ text: async () => typeof value === 'string' ? value : JSON.stringify(value) });
const uuid = { randomUUID: () => '123e4567-e89b-42d3-a456-426614174000' };
let calls = [];
const client = (handler, config = base) => Api.createClient(config, { fetch: async (...args) => { calls.push(args); return handler(...args); }, crypto: uuid });

assert.equal(Api.validateWebAppUrl('javascript:alert(1)'), false);
assert.equal(Api.validateWebAppUrl('/relative/exec'), false);
assert.equal(Api.validateWebAppUrl('https://script.google.com/macros/s/x/dev'), false);
assert.equal(Api.validateWebAppUrl('https://script.google.com/macros/s/x/exec'), true);

assert.equal(Api.formatCalendarDate(new Date(2026, 0, 5, 23, 30)), '2026-01-05', 'preenche mês e dia com zero');
assert.equal(Api.formatCalendarDate(Api.addCalendarDays(new Date(2026, 0, 31, 12), 1)), '2026-02-01', 'trata virada de mês');
assert.equal(Api.formatCalendarDate(Api.addCalendarDays(new Date(2026, 11, 31, 12), 1)), '2027-01-01', 'trata virada de ano');
const initialDate = new Date(2026, 11, 20, 12);
const initialTimestamp = initialDate.getTime();
const maximumDate = Api.addCalendarDays(initialDate, 20);
assert.equal(Api.formatCalendarDate(maximumDate), '2027-01-09');
assert.equal(initialDate.getTime(), initialTimestamp, 'o cálculo da data máxima não modifica a data inicial');

calls = [];
const demo = client(() => { throw new Error('fetch não deveria ocorrer'); }, { ...base, mode: 'demo', webAppUrl: '' });
assert.equal((await demo.health()).code, 'DEMO_MODE');
assert.equal((await demo.availability('2026-08-01')).code, 'DEMO_MODE');
assert.equal((await demo.request({})).code, 'DEMO_MODE');
assert.equal(calls.length, 0, 'modo demo nunca chama fetch');

let health = await client(() => response({ ok: true, code: 'HEALTH_OK', message: 'ok', configured: true })).health();
assert.equal(health.configured, true);
health = await client(() => response({ ok: true, code: 'HEALTH_OK', message: 'ok', configured: false })).health();
assert.equal(health.configured, false);

calls = [];
const availability = await client(() => response({ ok: true, code: 'AVAILABILITY_OK', message: 'ok', data: { date: '2026-08-01', available: ['09:00'], unavailable: ['10:00'] } })).availability('2026-08-01');
assert.deepEqual(availability.data.available, ['09:00']);
assert.equal(calls[0][1].cache, 'no-store'); assert.equal(calls[0][1].redirect, 'follow');
await assert.rejects(client(() => response({ what: 'ever' })).health(), /INVALID_RESPONSE/);
await assert.rejects(client(() => response('x'.repeat(5000))).health(), /RESPONSE_TOO_LARGE/);
await assert.rejects(client(() => { throw new Error('offline'); }).health(), /NETWORK_ERROR/);
await assert.rejects(client(() => new Promise(() => {})).health(), /TIMEOUT/);

const payload = { serviceId: 'dog-walker', date: '2026-08-01', time: '09:00', responsibleName: 'Ana', whatsapp: '5511999999999', petName: 'Rex', region: 'Centro', notes: '', reviewAccepted: true, honeypot: '' };
calls = [];
const createdClient = client(() => response({ ok: true, code: 'REQUEST_CREATED', message: 'pendente', requestId: uuid.randomUUID() }));
assert.equal((await createdClient.request(payload)).code, 'REQUEST_CREATED');
assert.ok(calls[0][1].body instanceof URLSearchParams); assert.equal(calls[0][1].body.get('action'), 'request');
assert.equal(calls[0][1].redirect, 'follow'); assert.equal('credentials' in calls[0][1], false); assert.equal('headers' in calls[0][1], false);
const firstId = calls[0][1].body.get('requestId');
await createdClient.request(payload); assert.equal(calls[1][1].body.get('requestId'), firstId, 'reutiliza requestId após repetição');
let sequence = 0;
const rotating = Api.createClient(base, { fetch: async (...args) => { calls.push(args); return response({ ok: false, code: 'LOCK_TIMEOUT', message: 'tente' }); }, crypto: { randomUUID: () => `123e4567-e89b-42d3-a456-42661417400${sequence++}` } });
calls = []; assert.equal((await rotating.request(payload)).code, 'LOCK_TIMEOUT');
await rotating.request({ ...payload, petName: 'Bidu' }); assert.notEqual(calls[0][1].body.get('requestId'), calls[1][1].body.get('requestId'));
assert.equal((await client(() => response({ ok: false, code: 'SLOT_UNAVAILABLE', message: 'ocupado', requestId: uuid.randomUUID() })).request(payload)).code, 'SLOT_UNAVAILABLE');

const source = await readFile(new URL('../assets/js/scheduling.js', import.meta.url), 'utf8');
assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie/);
assert.match(source, /whatsappLink\.hidden = false/);
assert.match(source, /integration\.mode === 'demo'/);
console.log('Scheduling API: todos os testes locais passaram.');
