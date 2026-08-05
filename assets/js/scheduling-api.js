(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SchedulingApi = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var CODES = new Set(['HEALTH_OK', 'AVAILABILITY_OK', 'REQUEST_CREATED', 'SLOT_UNAVAILABLE', 'INTERVAL_UNAVAILABLE', 'LOCK_TIMEOUT', 'INVALID_REQUEST', 'CONFIGURATION_REQUIRED', 'INTERNAL_ERROR', 'RATE_LIMITED', 'INCONSISTENT_STATE', 'PERSISTENCE_FAILED']);

  function formatCalendarDate(date) {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new TypeError('Data inválida.');
    var year = String(date.getFullYear());
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function addCalendarDays(date, days) {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime()) || !Number.isInteger(days)) throw new TypeError('Data ou intervalo inválido.');
    var result = new Date(date.getTime());
    result.setDate(result.getDate() + days);
    return result;
  }

  function validateWebAppUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return false;
    try {
      var url = new URL(value);
      return url.protocol === 'https:' && url.hostname === 'script.google.com' &&
        /\/exec$/.test(url.pathname) && !/\/dev$/.test(url.pathname) &&
        !url.username && !url.password && !url.hash && !url.search;
    } catch (error) {
      return false;
    }
  }

  function validateConfig(config) {
    if (!config || (config.mode !== 'demo' && config.mode !== 'live')) return { valid: false, reason: 'Modo de integração inválido.' };
    if (!Number.isInteger(config.requestTimeoutMs) || config.requestTimeoutMs < 500 || config.requestTimeoutMs > 30000) return { valid: false, reason: 'Timeout inválido.' };
    if (!Number.isInteger(config.maxResponseBytes) || config.maxResponseBytes < 256 || config.maxResponseBytes > 1000000) return { valid: false, reason: 'Limite de resposta inválido.' };
    if (config.mode === 'live' && !validateWebAppUrl(config.webAppUrl)) return { valid: false, reason: 'URL do Web App ausente ou inválida.' };
    return { valid: true, live: config.mode === 'live' };
  }

  function normalizeResponse(value, kind, expectedInterval) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.ok !== 'boolean' ||
        typeof value.code !== 'string' || !CODES.has(value.code) || typeof value.message !== 'string' || value.message.length > 500) throw new Error('INVALID_RESPONSE');
    if (value.notificationStatus !== undefined && ['NOT_REQUESTED','PENDING','SENT','FAILED'].indexOf(value.notificationStatus) === -1) throw new Error('INVALID_RESPONSE');
    if (value.requestId !== undefined && (typeof value.requestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(value.requestId))) throw new Error('INVALID_RESPONSE');
    if (kind === 'health' && (value.code !== 'HEALTH_OK' || typeof value.configured !== 'boolean')) throw new Error('INVALID_RESPONSE');
    if (kind === 'availability' && value.ok) {
      if (value.code !== 'AVAILABILITY_OK' || !value.data || !/^\d{4}-\d{2}-\d{2}$/.test(value.data.date)) throw new Error('INVALID_RESPONSE');
      var exact = typeof value.data.available === 'boolean' && typeof value.data.unavailable === 'boolean' && value.data.unavailable === !value.data.available && expectedInterval && value.data.date === expectedInterval.date && value.data.startTime === expectedInterval.startTime && value.data.endTime === expectedInterval.endTime;
      var legacy = !expectedInterval && Array.isArray(value.data.available) && Array.isArray(value.data.unavailable) && value.data.available.concat(value.data.unavailable).every(function (time) { return typeof time === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time); });
      if (!exact && !legacy) throw new Error('INVALID_RESPONSE');
    }
    if (kind === 'request' && value.ok && (value.code !== 'REQUEST_CREATED' || !value.requestId)) throw new Error('INVALID_RESPONSE');
    return value;
  }

  function canAcceptExactAvailability(requested, current, result) {
    return Boolean(requested && current && requested.sequence === current.sequence && requested.interval === current.interval &&
      requested.date === current.date && requested.startTime === current.startTime && requested.endTime === current.endTime &&
      result && result.ok && result.data && typeof result.data.available === 'boolean' && typeof result.data.unavailable === 'boolean' && result.data.unavailable === !result.data.available &&
      result.data.date === requested.date && result.data.startTime === requested.startTime && result.data.endTime === requested.endTime);
  }

  function generateRequestId(cryptoObject) {
    if (!cryptoObject || typeof cryptoObject.randomUUID !== 'function') throw new Error('SECURE_ID_UNAVAILABLE');
    return cryptoObject.randomUUID();
  }

  function createClient(config, dependencies) {
    dependencies = dependencies || {};
    var checked = validateConfig(config);
    var fetcher = dependencies.fetch || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    var cryptoObject = dependencies.crypto || (typeof crypto !== 'undefined' ? crypto : null);
    var Abort = dependencies.AbortController || (typeof AbortController !== 'undefined' ? AbortController : null);
    var pendingFingerprint = '';
    var pendingRequestId = '';

    async function call(url, options, kind, expectedInterval) {
      if (config.mode === 'demo') return { ok: false, code: 'DEMO_MODE', message: config.messages.demo };
      if (!checked.valid) throw new Error('CONFIGURATION_REQUIRED');
      if (!fetcher) throw new Error('NETWORK_ERROR');
      var controller = Abort ? new Abort() : null;
      if (controller) options.signal = controller.signal;
      var rejectTimeout;
      var timer = setTimeout(function () { if (controller) controller.abort(); }, config.requestTimeoutMs);
      try {
        var response = await Promise.race([
          fetcher(url, options),
          new Promise(function (_, reject) { rejectTimeout = setTimeout(function () { reject(new Error('TIMEOUT')); }, config.requestTimeoutMs); })
        ]);
        var text = await response.text();
        if (new TextEncoder().encode(text).length > config.maxResponseBytes) throw new Error('RESPONSE_TOO_LARGE');
        var json;
        try { json = JSON.parse(text); } catch (error) { throw new Error('INVALID_RESPONSE'); }
        return normalizeResponse(json, kind, expectedInterval);
      } catch (error) {
        if (error && ['TIMEOUT', 'RESPONSE_TOO_LARGE', 'INVALID_RESPONSE'].indexOf(error.message) !== -1) throw error;
        if (error && error.name === 'AbortError') throw new Error('TIMEOUT');
        throw new Error('NETWORK_ERROR');
      } finally {
        clearTimeout(timer);
        clearTimeout(rejectTimeout);
      }
    }

    async function get(action, date, kind, parameters, expectedInterval) {
      if (config.mode === 'demo') return { ok: false, code: 'DEMO_MODE', message: config.messages.demo };
      if (!checked.valid) throw new Error('CONFIGURATION_REQUIRED');
      var url = new URL(config.webAppUrl);
      url.searchParams.set('action', action);
      if (date) url.searchParams.set('date', date);
      Object.keys(parameters || {}).forEach(function (key) { url.searchParams.set(key, parameters[key]); });
      var requestUrl = url.toString();
      var options = { method: 'GET', cache: 'no-store', redirect: 'follow' };
      try {
        return await call(requestUrl, options, kind, expectedInterval);
      } catch (error) {
        if (kind !== 'availability' || !error || error.message !== 'NETWORK_ERROR') throw error;
        if (typeof config.onAvailabilityRetry === 'function') config.onAvailabilityRetry();
        return call(requestUrl, { method: 'GET', cache: 'no-store', redirect: 'follow' }, kind, expectedInterval);
      }
    }

    function fingerprint(payload) {
      return ['serviceId', 'date', 'time', 'startTime', 'endTime', 'responsibleName', 'whatsapp', 'email', 'submissionChannel', 'petName', 'region', 'notes', 'reviewAccepted', 'privacyAccepted', 'privacyPolicyVersion', 'honeypot']
        .map(function (key) { return key + '=' + String(payload[key] == null ? '' : payload[key]); }).join('&');
    }

    return {
      configStatus: checked,
      health: function () { return get('health', '', 'health'); },
      availability: function (date, startTime, endTime) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return Promise.reject(new Error('INVALID_REQUEST'));
        if ((startTime || endTime) && (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime || '') || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(endTime || ''))) return Promise.reject(new Error('INVALID_REQUEST'));
        var interval = startTime ? { date: date, startTime: startTime, endTime: endTime } : null;
        return get('availability', date, 'availability', interval || {}, interval);
      },
      request: function (payload) {
        if (config.mode === 'demo') return Promise.resolve({ ok: false, code: 'DEMO_MODE', message: config.messages.demo });
        if (!checked.valid) return Promise.reject(new Error('CONFIGURATION_REQUIRED'));
        var current = fingerprint(payload);
        if (current !== pendingFingerprint) {
          pendingFingerprint = current;
          pendingRequestId = generateRequestId(cryptoObject);
        }
        var body = new URLSearchParams();
        Object.keys(payload).forEach(function (key) { body.set(key, String(payload[key] == null ? '' : payload[key])); });
        body.set('action', 'request');
        body.set('requestId', pendingRequestId);
        return call(config.webAppUrl, { method: 'POST', body: body, redirect: 'follow' }, 'request');
      }
    };
  }

  return {
    createClient: createClient,
    validateConfig: validateConfig,
    validateWebAppUrl: validateWebAppUrl,
    normalizeResponse: normalizeResponse,
    generateRequestId: generateRequestId,
    formatCalendarDate: formatCalendarDate,
    addCalendarDays: addCalendarDays,
    canAcceptExactAvailability: canAcceptExactAvailability
  };
});
