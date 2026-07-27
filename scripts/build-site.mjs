import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentPath = path.join(root, 'content/site.json');
const schedulingPath = path.join(root, 'content/scheduling.json');
const integrationPath = path.join(root, 'content/integration.json');
const templatePath = path.join(root, 'src/index.template.html');
const outputPath = path.join(root, 'index.html');

const requiredFields = [
  'projectName', 'professionalName', 'whatsappNumber', 'displayPhone',
  'whatsappMessage', 'email', 'instagram', 'serviceArea', 'footerYear',
];

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function validate(config) {
  const errors = [];
  for (const field of requiredFields) {
    if (typeof config[field] !== 'string' || config[field].trim() === '') {
      errors.push(`"${field}" deve ser uma string não vazia`);
    }
  }
  if (typeof config.whatsappNumber === 'string' && !/^\d{10,15}$/.test(config.whatsappNumber)) {
    errors.push('"whatsappNumber" deve conter somente 10 a 15 dígitos, incluindo o código do país');
  }
  if (typeof config.email === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.email)) {
    errors.push('"email" deve ser um endereço de e-mail válido');
  }
  if (typeof config.footerYear === 'string' && !/^\d{4}$/.test(config.footerYear)) {
    errors.push('"footerYear" deve conter quatro dígitos');
  }
  if (errors.length) throw new Error(`Configuração inválida em content/site.json:\n- ${errors.join('\n- ')}`);
}

const schedulingStrings = ['title', 'description', 'availabilityNotice', 'noScriptMessage', 'reviewConfirmation', 'submitLabel', 'summaryTitle'];
const allowedServices = new Set(['Dog Walker', 'Passeio Individual', 'Passeio em Pequeno Grupo', 'Planos Semanais']);
const allowedFieldTypes = new Set(['text', 'tel', 'textarea']);

function validateScheduling(config) {
  const errors = [];
  schedulingStrings.forEach((field) => {
    if (typeof config[field] !== 'string' || config[field].trim() === '') errors.push(`"${field}" deve ser uma string não vazia`);
  });
  ['available', 'selected', 'unavailable', 'notSent', 'demoResult'].forEach((field) => {
    if (!config.states || typeof config.states[field] !== 'string' || config.states[field].trim() === '') errors.push(`"states.${field}" deve ser uma string não vazia`);
  });
  ['services', 'days', 'times', 'fields'].forEach((field) => {
    if (!Array.isArray(config[field]) || config[field].length === 0) errors.push(`"${field}" deve ser uma lista não vazia`);
  });
  const ids = new Set();
  ['services', 'days', 'times', 'fields'].forEach((collection) => {
    if (!Array.isArray(config[collection])) return;
    config[collection].forEach((item, index) => {
      if (!item || typeof item.id !== 'string' || !/^[a-z0-9-]+$/.test(item.id)) errors.push(`"${collection}[${index}].id" deve usar letras minúsculas, números ou hífens`);
      else if (ids.has(item.id)) errors.push(`id duplicado: "${item.id}"`);
      else ids.add(item.id);
      if (!item || typeof item.label !== 'string' || item.label.trim() === '') errors.push(`"${collection}[${index}].label" deve ser uma string não vazia`);
    });
  });
  if (Array.isArray(config.services)) config.services.forEach((item) => {
    if (item && !allowedServices.has(item.label)) errors.push(`serviço não existente no site: "${item.label}"`);
  });
  if (Array.isArray(config.times)) config.times.forEach((item, index) => {
    if (typeof item.available !== 'boolean') errors.push(`"times[${index}].available" deve ser booleano`);
  });
  if (Array.isArray(config.fields)) config.fields.forEach((item, index) => {
    if (!allowedFieldTypes.has(item.type)) errors.push(`"fields[${index}].type" inválido`);
    if (typeof item.required !== 'boolean') errors.push(`"fields[${index}].required" deve ser booleano`);
    if (typeof item.autocomplete !== 'string') errors.push(`"fields[${index}].autocomplete" deve ser uma string`);
  });
  const requiredIds = ['responsavel', 'whatsapp', 'pet', 'regiao'];
  requiredIds.forEach((id) => {
    if (!Array.isArray(config.fields) || !config.fields.some((field) => field.id === id && field.required)) errors.push(`o campo obrigatório "${id}" está ausente`);
  });
  if (errors.length) throw new Error(`Configuração inválida em content/scheduling.json:\n- ${errors.join('\n- ')}`);
}

function validateIntegration(config) {
  const errors = [];
  if (!config || !['demo', 'live'].includes(config.mode)) errors.push('"mode" deve ser "demo" ou "live"');
  if (!config || typeof config.webAppUrl !== 'string') errors.push('"webAppUrl" deve ser uma string');
  ['demo', 'liveWithoutUrl', 'unavailable'].forEach((field) => {
    if (!config?.messages || typeof config.messages[field] !== 'string' || config.messages[field].trim() === '') errors.push(`"messages.${field}" deve ser uma string não vazia`);
  });
  if (errors.length) throw new Error(`Configuração inválida em content/integration.json:\n- ${errors.join('\n- ')}`);
}

function renderOptions(items, name, states) {
  return items.map((item) => {
    const disabled = item.available === false;
    const state = disabled ? states.unavailable : states.available;
    return `<label class="schedule-choice${disabled ? ' is-unavailable' : ''}" data-available-label="${escapeHtml(state)}" data-selected-label="${escapeHtml(states.selected)}"><input type="radio" name="${name}" value="${escapeHtml(item.label)}" required${disabled ? ' disabled' : ''}><span>${escapeHtml(item.label)}<small>${escapeHtml(state)}</small></span></label>`;
  }).join('\n');
}

function renderFields(fields) {
  return fields.map((field) => {
    const required = field.required ? ' required aria-required="true"' : '';
    const common = `id="schedule-${field.id}" name="${field.id}" autocomplete="${escapeHtml(field.autocomplete)}"${required} aria-describedby="error-${field.id}"`;
    const control = field.type === 'textarea' ? `<textarea ${common} rows="4"></textarea>` : `<input ${common} type="${field.type}">`;
    return `<div class="schedule-field"><label for="schedule-${field.id}">${escapeHtml(field.label)}${field.required ? ' <span aria-hidden="true">*</span>' : ''}</label>${control}<span class="schedule-error" id="error-${field.id}"></span></div>`;
  }).join('\n');
}

try {
  const [rawConfig, rawScheduling, rawIntegration, template] = await Promise.all([
    readFile(contentPath, 'utf8'),
    readFile(schedulingPath, 'utf8'),
    readFile(integrationPath, 'utf8'),
    readFile(templatePath, 'utf8'),
  ]);
  let config;
  let scheduling;
  let integration;
  try {
    config = JSON.parse(rawConfig);
  } catch (error) {
    throw new Error(`JSON inválido em content/site.json: ${error.message}`);
  }
  try {
    scheduling = JSON.parse(rawScheduling);
  } catch (error) {
    throw new Error(`JSON inválido em content/scheduling.json: ${error.message}`);
  }
  try {
    integration = JSON.parse(rawIntegration);
  } catch (error) {
    throw new Error(`JSON inválido em content/integration.json: ${error.message}`);
  }
  validate(config);
  validateScheduling(scheduling);
  validateIntegration(integration);

  if (!config.projectName.startsWith(config.professionalName)) {
    throw new Error('Configuração inválida em content/site.json:\n- \"projectName\" deve começar com \"professionalName\" para preservar a identidade visual');
  }

  const htmlValues = Object.fromEntries(
    Object.entries(config).map(([key, value]) => [key, typeof value === 'string' ? escapeHtml(value) : value]),
  );
  const values = {
    PROJECT_NAME: htmlValues.projectName,
    PROFESSIONAL_NAME: htmlValues.professionalName,
    PROJECT_NAME_REMAINDER: escapeHtml(config.projectName.slice(config.professionalName.length)),
    WHATSAPP_NUMBER: config.whatsappNumber,
    DISPLAY_PHONE: htmlValues.displayPhone,
    EMAIL: htmlValues.email,
    INSTAGRAM_URL: escapeHtml(config.instagram),
    SERVICE_AREA: htmlValues.serviceArea,
    FOOTER_YEAR: htmlValues.footerYear,
    PROJECT_NAME_URL: encodeURIComponent(config.projectName),
    WHATSAPP_URL: `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(config.whatsappMessage)}`.replaceAll('&', '&amp;'),
    SCHEDULING_TITLE: escapeHtml(scheduling.title),
    SCHEDULING_DESCRIPTION: escapeHtml(scheduling.description),
    SCHEDULING_NOTICE: escapeHtml(scheduling.availabilityNotice),
    SCHEDULING_NOSCRIPT: escapeHtml(scheduling.noScriptMessage),
    SCHEDULING_SERVICES: renderOptions(scheduling.services, 'servico', scheduling.states),
    SCHEDULING_DAYS: renderOptions(scheduling.days, 'data', scheduling.states),
    SCHEDULING_TIMES: renderOptions(scheduling.times, 'horario', scheduling.states),
    SCHEDULING_FIELDS: renderFields(scheduling.fields),
    SCHEDULING_REVIEW: escapeHtml(scheduling.reviewConfirmation),
    SCHEDULING_SUBMIT: escapeHtml(scheduling.submitLabel),
    SCHEDULING_SUMMARY_TITLE: escapeHtml(scheduling.summaryTitle),
    SCHEDULING_NOT_SENT: escapeHtml(scheduling.states.notSent),
    SCHEDULING_DEMO_RESULT: escapeHtml(scheduling.states.demoResult),
    INTEGRATION_CONFIG: JSON.stringify(integration).replaceAll('<', '\\u003c'),
  };

  const output = template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (token, name) => {
    if (!(name in values)) throw new Error(`Token desconhecido no template: ${token}`);
    return values[name];
  });
  const unresolved = output.match(/\{\{[^{}]+\}\}/g);
  if (unresolved) throw new Error(`Tokens não processados: ${[...new Set(unresolved)].join(', ')}`);

  await writeFile(outputPath, output, 'utf8');
  console.log('index.html gerado com sucesso.');
} catch (error) {
  console.error(`Erro ao gerar o site: ${error.message}`);
  process.exitCode = 1;
}
