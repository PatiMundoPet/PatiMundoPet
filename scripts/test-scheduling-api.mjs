import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const Api = require('../assets/js/scheduling-api.js');
const operationalUrl = 'https://script.google.com/macros/s/AKfycbz9RyLNBWPGbq8xxfUKipwQ7CYKCwkvNYf0FajD7bX365w9NNFV9pd8Mc-qyeKNoKUQ/exec';
const base = { mode: 'live', webAppUrl: operationalUrl, requestTimeoutMs: 500, maxResponseBytes: 4096, maxFutureDays: 90, messages: { demo: 'demo', loading: 'Consultando disponibilidade…', unavailable: 'Indisponível. Fale com a Pati.' } };
const operationalConfig = JSON.parse(await readFile(new URL('../content/integration.json', import.meta.url), 'utf8'));
assert.equal(operationalConfig.requestTimeoutMs, 30000, 'timeout operacional exato de 30000 ms');
assert.equal(operationalConfig.messages.slowAvailability, 'A agenda está demorando um pouco, mas a consulta continua. Aguarde.');
assert.match(operationalConfig.messages.availabilityRetry, /repetindo a consulta automaticamente/);
assert.match(operationalConfig.messages.availabilityTimeout, /Nenhuma solicitação foi registrada/);
assert.match(operationalConfig.messages.availabilityNetworkError, /Nenhuma solicitação foi registrada/);
assert.match(operationalConfig.messages.availabilityInvalidResponse, /Nenhuma solicitação foi registrada/);
const response = (value) => ({ text: async () => typeof value === 'string' ? value : JSON.stringify(value) });
const uuid = { randomUUID: () => '123e4567-e89b-42d3-a456-426614174000' };
let calls = [];
const client = (handler, config = base, retry) => {
  const created = Api.createClient(config, { fetch: async (...args) => { calls.push(args); return handler(...args); }, crypto: uuid });
  return retry ? { ...created, availability: (date, startTime, endTime) => created.availability(date, startTime, endTime, retry) } : created;
};

assert.equal(Api.validateWebAppUrl('javascript:alert(1)'), false);
assert.equal(Api.validateWebAppUrl('/relative/exec'), false);
assert.equal(Api.validateWebAppUrl('https://script.google.com/macros/s/x/dev'), false);
assert.equal(Api.validateWebAppUrl('https://script.google.com/macros/s/x/exec'), true);
assert.equal(Api.validateWebAppUrl(operationalUrl), true);
assert.equal(operationalConfig.webAppUrl, operationalUrl, 'configuração usa a URL operacional exata');

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
const availability = await client(() => response({ ok: true, code: 'AVAILABILITY_OK', message: 'ok', data: { date: '2026-08-01', available: ['09:00'], unavailable: [] } })).availability('2026-08-01');
assert.deepEqual(availability.data.available, ['09:00']);
assert.deepEqual(availability.data.unavailable, [], 'interface não depende da publicação de horários ocupados');
assert.doesNotThrow(() => availability.data.available.concat(availability.data.unavailable), 'formato compatível não causa TypeError na renderização');

assert.equal(calls[0][1].cache, 'no-store'); assert.equal(calls[0][1].redirect, 'follow');
const exactResponse = { ok: true, code: 'AVAILABILITY_OK', message: 'livre agora', data: { date: '2026-08-01', startTime: '10:11', endTime: '11:37', available: true, unavailable: false } };
const exactAvailability = await client(() => response(exactResponse)).availability('2026-08-01', '10:11', '11:37');
assert.equal(exactAvailability.data.available, true, 'consulta exata aceita booleano');
await assert.rejects(client(() => response({ ok: true, code: 'AVAILABILITY_OK', message: 'legado', data: { date: '2026-08-01', available: [], unavailable: [] } })).availability('2026-08-01', '10:11', '11:37'), /INVALID_RESPONSE/, 'arrays legados nunca confirmam intervalo exato');
await assert.rejects(client(() => response({ ...exactResponse, data: { ...exactResponse.data, available: ['10:11'], unavailable: [] } })).availability('2026-08-01', '10:11', '11:37'), /INVALID_RESPONSE/, 'qualquer array falha na chamada exata');
await assert.rejects(client(() => response({ ...exactResponse, data: { ...exactResponse.data, available: 1 } })).availability('2026-08-01', '10:11', '11:37'), /INVALID_RESPONSE/, 'available precisa ser booleano');
await assert.rejects(client(() => response({ ...exactResponse, data: { ...exactResponse.data, endTime: '12:00' } })).availability('2026-08-01', '10:11', '11:37'), /INVALID_RESPONSE/, 'resposta precisa coincidir com o término enviado');
await assert.rejects(client(() => response({ ...exactResponse, data: { ...exactResponse.data, startTime: '10:12' } })).availability('2026-08-01', '10:11', '11:37'), /INVALID_RESPONSE/, 'resposta precisa coincidir com o início enviado');
await assert.rejects(client(() => response({ ...exactResponse, data: { ...exactResponse.data, date: '2026-08-02' } })).availability('2026-08-01', '10:11', '11:37'), /INVALID_RESPONSE/, 'resposta de outro dia é rejeitada');
await assert.rejects(client(() => response({ ...exactResponse, data: { ...exactResponse.data, available: true, unavailable: true } })).availability('2026-08-01', '10:11', '11:37'), /INVALID_RESPONSE/, 'true/true é inconsistente');
await assert.rejects(client(() => response({ ...exactResponse, data: { ...exactResponse.data, available: false, unavailable: false } })).availability('2026-08-01', '10:11', '11:37'), /INVALID_RESPONSE/, 'false/false é inconsistente');
assert.equal((await client(() => response({ ...exactResponse, data: { ...exactResponse.data, available: false, unavailable: true } })).availability('2026-08-01', '10:11', '11:37')).data.available, false, 'false/true é aceito');



calls = [];
const slowSuccess = await client(() => new Promise((resolve) => setTimeout(() => resolve(response(exactResponse)), 20)), { ...base, requestTimeoutMs: 30000 }).availability('2026-08-01', '10:11', '11:37');
assert.equal(slowSuccess.data.available, true, 'resposta lenta dentro de 30000 ms é aceita');
assert.equal(calls.length, 1, 'sucesso lento não repete GET');

calls = [];
let retryNotices = 0;
let networkAttempts = 0;
const retryClient = client(() => {
  networkAttempts += 1;
  if (networkAttempts === 1) throw new Error('offline');
  return response(exactResponse);
}, base, () => { retryNotices += 1; });
assert.equal((await retryClient.availability('2026-08-01', '10:11', '11:37')).data.available, true, 'uma repetição após NETWORK_ERROR recupera a consulta');
assert.equal(calls.length, 2, 'limite máximo de duas chamadas GET após NETWORK_ERROR');
assert.equal(retryNotices, 1, 'aviso de repetição é emitido uma vez');

for (const [name, handler, pattern] of [
  ['TIMEOUT', () => new Promise(() => {}), /TIMEOUT/],
  ['INVALID_RESPONSE', () => response({ what: 'ever' }), /INVALID_RESPONSE/],
  ['RESPONSE_TOO_LARGE', () => response('x'.repeat(5000)), /RESPONSE_TOO_LARGE/],
  ['ok false', () => response({ ok: false, code: 'SLOT_UNAVAILABLE', message: 'ocupado' }), null]
]) {
  calls = [];
  const noRetry = client(handler, { ...base, requestTimeoutMs: 500 });
  if (pattern) await assert.rejects(noRetry.availability('2026-08-01', '10:11', '11:37'), pattern, `${name} não é repetido`);
  else assert.equal((await noRetry.availability('2026-08-01', '10:11', '11:37')).ok, false, `${name} é resposta de negócio sem repetição`);
  assert.equal(calls.length, 1, `${name} faz uma chamada GET`);
}

calls = [];
await assert.rejects(client(() => { throw new Error('offline'); }).availability('2026-08-01', '10:11', '11:37'), /NETWORK_ERROR/, 'segunda falha de rede propaga NETWORK_ERROR');
assert.equal(calls.length, 2, 'mesmo com duas falhas de rede não passa de duas chamadas GET');



calls = [];
const pendingFetches = [];
const overlappingClient = Api.createClient(base, { fetch: async (...args) => {
  calls.push(args);
  return new Promise((resolve, reject) => { pendingFetches.push({ resolve, reject }); });
}, crypto: uuid });
const retryCallbacks = [];
const firstOverlapping = overlappingClient.availability('2026-08-01', '10:11', '11:37', () => { retryCallbacks.push('antiga'); });
const secondOverlapping = overlappingClient.availability('2026-08-02', '12:00', '13:00', () => { retryCallbacks.push('nova'); });
assert.equal(pendingFetches.length, 2, 'duas consultas sobrepostas iniciam duas chamadas independentes');
pendingFetches[0].reject(new Error('offline'));
while (pendingFetches.length < 3) await new Promise((resolve) => setTimeout(resolve, 0));
assert.deepEqual(retryCallbacks, ['antiga'], 'a repetição da consulta antiga executa somente o callback antigo');
pendingFetches[1].resolve(response({ ok: true, code: 'AVAILABILITY_OK', message: 'ok', data: { date: '2026-08-02', startTime: '12:00', endTime: '13:00', available: true, unavailable: false } }));
pendingFetches[2].resolve(response(exactResponse));
assert.equal((await secondOverlapping).data.date, '2026-08-02', 'a consulta nova mantém seu próprio resultado');
assert.equal((await firstOverlapping).data.date, '2026-08-01', 'a consulta antiga mantém seu próprio resultado após repetir');
assert.deepEqual(retryCallbacks, ['antiga'], 'a consulta antiga não executa o callback da consulta nova nem altera seu estado');
assert.equal(calls.length, 3, 'sobreposição com uma falha de rede ainda limita a consulta antiga a uma repetição');

const businessAvailabilityError = await client(() => response({ ok: false, code: 'SLOT_UNAVAILABLE', message: 'Período ocupado. Fale com a Pati.' })).availability('2026-08-01', '10:11', '11:37');
assert.equal(businessAvailabilityError.ok, false, 'disponibilidade com ok false é preservada para a interface tratar explicitamente');
assert.equal(businessAvailabilityError.message, 'Período ocupado. Fale com a Pati.');

const requested = { sequence: 4, interval: '2026-08-01|10:11|11:37', date: '2026-08-01', startTime: '10:11', endTime: '11:37' };
assert.equal(Api.canAcceptExactAvailability(requested, { ...requested }, exactResponse), true, 'resposta atual e exata pode ser aceita');
assert.equal(Api.canAcceptExactAvailability(requested, { ...requested, interval: '2026-08-01|10:11|12:00', endTime: '12:00', sequence: 5 }, exactResponse), false, 'alterar somente o término neutraliza resposta antiga');
assert.equal(Api.canAcceptExactAvailability(requested, { ...requested, date: '2026-08-02', interval: '2026-08-02|10:11|11:37', sequence: 5 }, exactResponse), false, 'alterar a data neutraliza resposta antiga');
assert.equal(Api.canAcceptExactAvailability(requested, { ...requested, sequence: 5 }, exactResponse), false, 'nova sequência neutraliza resposta pendente');
assert.equal(Api.canAcceptExactAvailability(requested, { ...requested }, { ...exactResponse, data: { ...exactResponse.data, date: '2026-08-02' } }), false, 'resposta de outro dia nunca confirma o estado atual');
assert.equal(Api.canAcceptExactAvailability(requested, { ...requested }, { ...exactResponse, data: { ...exactResponse.data, available: true, unavailable: true } }), false, 'estado booleano inconsistente nunca confirma');
assert.equal(Api.canAcceptExactAvailability(requested, { ...requested }, { ...exactResponse, data: { ...exactResponse.data, available: [] } }), false, 'array nunca confirma o intervalo na interface');


await assert.rejects(client(() => response({ what: 'ever' })).health(), /INVALID_RESPONSE/);
await assert.rejects(client(() => response('x'.repeat(5000))).health(), /RESPONSE_TOO_LARGE/);
await assert.rejects(client(() => { throw new Error('offline'); }).health(), /NETWORK_ERROR/);
await assert.rejects(client(() => new Promise(() => {})).health(), /TIMEOUT/);

const payload = { serviceId: 'passeio-individual', date: '2026-08-01', time: '09:00', responsibleName: 'Ana', whatsapp: '5511999999999', email: '', submissionChannel: 'whatsapp', petName: 'Rex', region: 'Centro', notes: '', reviewAccepted: true, privacyAccepted: true, privacyPolicyVersion: 'draft-2026-01', honeypot: '' };
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
for (const code of ['INCONSISTENT_STATE', 'PERSISTENCE_FAILED']) {
  const safeMessage = code === 'INCONSISTENT_STATE' ? 'A solicitação requer reconciliação administrativa.' : 'Não foi possível registrar a solicitação.';
  const safeError = await client(() => response({ ok: false, code, message: safeMessage, requestId: uuid.randomUUID() })).request(payload);
  assert.equal(safeError.code, code, `${code} é aceito como erro seguro`);
  assert.equal(safeError.message, safeMessage, `${code} preserva a mensagem segura`);
}

const source = await readFile(new URL('../assets/js/scheduling.js', import.meta.url), 'utf8');
assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie/);
assert.match(source, /encodeURIComponent\(message\)/);
assert.match(source, /schedule-copy-button/);
assert.match(source, /result\.code!=='REQUEST_CREATED'/);
assert.match(source, /integration\.mode === 'live'/);
assert.match(source, /privacyAccepted/);
assert.match(source, /Selecione uma data para consultar os horários|schedule-availability-status/);
assert.match(source, /client\.availability\(requestedDate,requestedStart,requestedEnd,onAvailabilityRetry\)/, 'disponibilidade usa os valores capturados e callback de retry por consulta');
assert.doesNotMatch(source, /client\.request\([\s\S]*checkAvailability/, 'verificar disponibilidade não chama criação');
assert.match(source, /slowAvailability/, 'mensagem de demora existe na interface');
assert.match(source, /availabilityTimeout/, 'mensagem de timeout existe na interface');
assert.match(source, /availabilityNetworkError/, 'mensagem de rede existe na interface');
assert.match(source, /availabilityInvalidResponse/, 'mensagem de resposta inválida existe na interface');
assert.match(source, /requestedInterval=intervalKey\(\)/, 'a chave exata é capturada antes da resposta');
assert.match(source, /canAcceptExactAvailability\(requested,current,result\)/, 'resposta passa pela validação completa de estado');

assert.match(source, /result\.ok===false[\s\S]*ensureNoRequestNotice\(result\.message\|\|integration\.messages\.unavailable\)/, 'erro de negócio da disponibilidade aparece junto ao botão, oferece contato e informa que nada foi registrado');
assert.match(source, /verifiedInterval='';if\(result\.ok===false\)/, 'respostas de erro não validam o intervalo');
assert.match(source, /clearAvailabilityTimers\(\)/, 'timers são limpos nos caminhos de término e invalidação');
assert.doesNotMatch(source, /integration\.onAvailabilityRetry/, 'callback de retry não é compartilhado no objeto de integração');
assert.match(source, /availabilityFailureMessage\(error\)/, 'erros técnicos são diferenciados antes da mensagem pública');
assert.match(source, /ensureNoRequestNotice\('Não foi possível consultar a agenda\.'\)/, 'fallback de erro desconhecido informa que nada foi registrado sem depender da mensagem unavailable');
assert.match(source, /ensureNoRequestNotice\(result\.message\|\|integration\.messages\.unavailable\)/, 'erro de negócio também passa pela proteção contra mensagem duplicada');
assert.match(source, /showFinalNotice\('Verifique a disponibilidade do período escolhido antes de enviar\.'\)/, 'envio bloqueado usa o aviso final junto aos botões');
assert.match(source, /notice\.scrollIntoView\(\{ block: 'center', behavior: 'smooth' \}\)/, 'aviso final fica visível com rolagem');
assert.match(source, /notice\.focus\(\{ preventScroll: true \}\)/, 'aviso final recebe foco');
assert.match(source, /if\(requested\.sequence!==current\.sequence\|\|requested\.interval!==current\.interval/, 'proteção contra respostas antigas é preservada antes de tratar a resposta');
assert.match(source, /finally \{sending=false;form\.querySelectorAll\('button\[type="submit"\]'\)/, 'botões de envio são reabilitados no finally');
assert.match(source, /verifiedInterval=requestedInterval/, 'a confirmação usa apenas a chave capturada');
assert.match(source, /function invalidateAvailability\(\) \{ availabilitySequence\+=1; verifiedInterval=''/, 'qualquer alteração invalida respostas pendentes');
assert.match(await readFile(new URL('../assets/js/scheduling-api.js', import.meta.url), 'utf8'), /typeof result\.data\.available === 'boolean'/, 'interface exige booleano no resultado exato');
assert.doesNotMatch(source, /role=['"]radiogroup['"]/, 'fluxo novo não usa radiogroup de slots');
assert.match(source, /verifiedInterval!==intervalKey/, 'envio exige verificação ainda válida');
assert.equal((source.match(/client\.request\(/g) || []).length, 1, 'a criação existe somente no envio explícito do formulário');
assert.match(source, /form\.addEventListener\('submit',[\s\S]*client\.request\(data\)/, 'a criação depende do envio explícito do formulário');
console.log('Scheduling API: todos os testes locais passaram.');
