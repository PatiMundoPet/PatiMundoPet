import { readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentPath = path.join(root, 'content/site.json');
const schedulingPath = path.join(root, 'content/scheduling.json');
const integrationPath = path.join(root, 'content/integration.json');
const privacyPath = path.join(root, 'content/privacy.json');
const seoPath = path.join(root, 'content/seo.json');
const robotsOutputPath = path.join(root, 'robots.txt');
const sitemapOutputPath = path.join(root, 'sitemap.xml');
const privacyTemplatePath = path.join(root, 'src/privacy.template.html');
const privacyOutputPath = path.join(root, 'privacy.html');
const templatePath = path.join(root, 'src/index.template.html');
const outputPath = path.join(root, 'index.html');

const requiredFields = [
  'projectName', 'professionalName', 'whatsappNumber', 'displayPhone',
  'whatsappMessage', 'email', 'instagram', 'displayInstagram', 'serviceArea', 'footerYear',
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
  if (typeof config.contactsConfigured !== 'boolean') errors.push('\"contactsConfigured\" deve ser booleano');
  if (config.contactsConfigured && typeof config.whatsappNumber === 'string' && !/^\d{10,15}$/.test(config.whatsappNumber)) {
    errors.push('"whatsappNumber" deve conter somente 10 a 15 dígitos, incluindo o código do país');
  }
  if (config.contactsConfigured && typeof config.email === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.email)) {
    errors.push('"email" deve ser um endereço de e-mail válido');
  }
  if (typeof config.footerYear === 'string' && !/^\d{4}$/.test(config.footerYear)) {
    errors.push('"footerYear" deve conter quatro dígitos');
  }
  if (!config.collaborations || typeof config.collaborations !== 'object' || Array.isArray(config.collaborations)) {
    errors.push('"collaborations" deve ser um objeto');
  } else {
    ['title', 'description'].forEach((field) => {
      if (typeof config.collaborations[field] !== 'string' || !config.collaborations[field].trim()) {
        errors.push(`"collaborations.${field}" deve ser uma string não vazia`);
      }
    });
    if (!Array.isArray(config.collaborations.projects) || !config.collaborations.projects.length) {
      errors.push('"collaborations.projects" deve ser uma lista não vazia');
    } else {
      config.collaborations.projects.forEach((project, index) => {
        ['name', 'instagram', 'url'].forEach((field) => {
          if (typeof project?.[field] !== 'string' || !project[field].trim()) {
            errors.push(`"collaborations.projects[${index}].${field}" deve ser uma string não vazia`);
          }
        });
        if (typeof project?.instagram === 'string' && !/^@[a-z0-9._]+$/i.test(project.instagram)) {
          errors.push(`"collaborations.projects[${index}].instagram" deve ser um perfil iniciado por @`);
        }
        if (typeof project?.url === 'string') {
          try {
            const url = new URL(project.url);
            if (url.protocol !== 'https:' || url.hostname !== 'www.instagram.com' || url.username || url.password || url.search || url.hash) {
              errors.push(`"collaborations.projects[${index}].url" deve ser uma URL HTTPS do Instagram`);
            }
          } catch { errors.push(`"collaborations.projects[${index}].url" deve ser uma URL válida`); }
        }
      });
    }
  }
  if (errors.length) throw new Error(`Configuração inválida em content/site.json:\n- ${errors.join('\n- ')}`);
}

const schedulingStrings = ['title', 'description', 'availabilityNotice', 'inactiveMessage', 'noScriptMessage', 'reviewConfirmation', 'summaryTitle', 'commercialNotice', 'whatsappSubmitLabel', 'emailSubmitLabel'];
const allowedServices = new Set(['Passeios', 'Dog sitter']);
const allowedFieldTypes = new Set(['text', 'tel', 'email', 'textarea']);

function validateScheduling(config) {
  const errors = [];
  schedulingStrings.forEach((field) => {
    if (typeof config[field] !== 'string' || config[field].trim() === '') errors.push(`"${field}" deve ser uma string não vazia`);
  });
  ['available', 'selected', 'unavailable', 'notSent'].forEach((field) => {
    if (!config.states || typeof config.states[field] !== 'string' || config.states[field].trim() === '') errors.push(`"states.${field}" deve ser uma string não vazia`);
  });
  ['services', 'days', 'times', 'fields'].forEach((field) => {
    if (!Array.isArray(config[field]) || ((field === 'services' || field === 'fields') && config[field].length === 0)) errors.push(`"${field}" deve ser uma lista${field === 'services' || field === 'fields' ? ' não vazia' : ''}`);
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
  const requiredIds = ['responsavel', 'pet', 'regiao'];
  requiredIds.forEach((id) => {
    if (!Array.isArray(config.fields) || !config.fields.some((field) => field.id === id && field.required)) errors.push(`o campo obrigatório "${id}" está ausente`);
  });
  if (errors.length) throw new Error(`Configuração inválida em content/scheduling.json:\n- ${errors.join('\n- ')}`);
}

function validateIntegration(config) {
  const errors = [];
  if (!config || !['demo', 'live'].includes(config.mode)) errors.push('"mode" deve ser "demo" ou "live"');
  if (!config || typeof config.webAppUrl !== 'string') errors.push('"webAppUrl" deve ser uma string');
  if (config.mode === 'demo' && config.webAppUrl !== '') errors.push('"webAppUrl" deve permanecer vazio no modo demo');
  if (!Number.isInteger(config.requestTimeoutMs) || config.requestTimeoutMs < 500 || config.requestTimeoutMs > 30000) errors.push('"requestTimeoutMs" deve estar entre 500 e 30000');
  if (!Number.isInteger(config.maxResponseBytes) || config.maxResponseBytes < 256 || config.maxResponseBytes > 1000000) errors.push('"maxResponseBytes" inválido');
  if (!Number.isInteger(config.maxFutureDays) || config.maxFutureDays < 1 || config.maxFutureDays > 365) errors.push('"maxFutureDays" inválido');
  if (config.mode === 'live') {
    try {
      const url = new URL(config.webAppUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'script.google.com' || !url.pathname.endsWith('/exec') || url.username || url.password || url.hash || url.search) errors.push('"webAppUrl" deve ser uma URL HTTPS script.google.com terminada em /exec');
    } catch { errors.push('"webAppUrl" inválida'); }
  }
  ['inactive', 'liveWithoutUrl', 'unavailable'].forEach((field) => {
    if (!config?.messages || typeof config.messages[field] !== 'string' || config.messages[field].trim() === '') errors.push(`"messages.${field}" deve ser uma string não vazia`);
  });
  if (errors.length) throw new Error(`Configuração inválida em content/integration.json:\n- ${errors.join('\n- ')}`);
}

function validatePrivacy(config, site) {
  const required = ['title', 'version', 'updatedAt', 'dataController', 'contactEmail', 'purpose', 'noReservation', 'calendarNotice', 'retentionPeriod', 'correctionDeletion', 'sensitiveDataWarning'];
  const errors = required.filter((field) => typeof config?.[field] !== 'string' || !config[field].trim()).map((field) => `"${field}" deve ser uma string não vazia`);
  if (!Array.isArray(config?.requestedData) || !config.requestedData.length || config.requestedData.some((item) => typeof item !== 'string' || !item.trim())) errors.push('"requestedData" deve ser uma lista de strings não vazias');
  if (typeof config?.requiresLegalReview !== 'boolean') errors.push('"requiresLegalReview" deve ser booleano');
  if (config?.contactEmail !== site.email) errors.push('"contactEmail" deve usar o e-mail centralizado em site.json');
  if (errors.length) throw new Error(`Configuração inválida em content/privacy.json:\n- ${errors.join('\n- ')}`);
}

function validateSeo(config) {
  const errors = [];
  const strings = ['titleTemplate', 'defaultDescription', 'locale', 'language', 'themeColor', 'siteUrl', 'socialImage', 'twitterCard'];
  strings.forEach((field) => { if (typeof config?.[field] !== 'string') errors.push(`"${field}" deve ser uma string`); });
  if (!config?.titleTemplate?.includes('%s')) errors.push('"titleTemplate" deve conter %s');
  if (config?.locale !== 'pt_BR' || config?.language !== 'pt-BR') errors.push('locale e language devem permanecer em português do Brasil');
  if (!/^#[0-9a-fA-F]{6}$/.test(config?.themeColor || '')) errors.push('"themeColor" deve ser uma cor hexadecimal');
  if (typeof config?.indexingEnabled !== 'boolean') errors.push('"indexingEnabled" deve ser booleano');
  if (config?.twitterCard !== 'summary_large_image') errors.push('"twitterCard" inválido');
  if (config?.siteUrl) {
    try { const url = new URL(config.siteUrl); if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) errors.push('"siteUrl" deve ser uma URL HTTPS base'); }
    catch { errors.push('"siteUrl" inválida'); }
  }
  if (config?.socialImage) {
    try { const url = new URL(config.socialImage); if (url.protocol !== 'https:') errors.push('"socialImage" deve ser uma URL HTTPS'); }
    catch { errors.push('"socialImage" inválida'); }
  }
  if (config?.indexingEnabled && !config.siteUrl) errors.push('indexação exige siteUrl explícita');
  if (errors.length) throw new Error(`Configuração inválida em content/seo.json:\n- ${errors.join('\n- ')}`);
}

function titleFor(seo, page) { return seo.titleTemplate.replace('%s', page); }
function optionalSeoTags(seo, pathname) {
  const tags = [];
  if (seo.siteUrl) {
    const url = new URL(pathname, seo.siteUrl.endsWith('/') ? seo.siteUrl : `${seo.siteUrl}/`).href;
    tags.push(`<link rel="canonical" href="${escapeHtml(url)}">`, `<meta property="og:url" content="${escapeHtml(url)}">`);
  }
  if (seo.socialImage) tags.push(`<meta property="og:image" content="${escapeHtml(seo.socialImage)}">`, `<meta name="twitter:image" content="${escapeHtml(seo.socialImage)}">`);
  return tags.join('\n');
}

function replaceTokens(template, values, label) {
  const output = template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (token, name) => {
    if (!(name in values)) throw new Error(`Token desconhecido em ${label}: ${token}`);
    return values[name];
  });
  const unresolved = output.match(/\{\{[^{}]+\}\}/g);
  if (unresolved) throw new Error(`Tokens não processados em ${label}: ${[...new Set(unresolved)].join(', ')}`);
  return output;
}

function renderOptions(items, name, states) {
  return items.map((item) => {
    const disabled = item.available === false;
    const state = disabled ? states.unavailable : states.available;
    return `<label class="schedule-choice${disabled ? ' is-unavailable' : ''}" data-available-label="${escapeHtml(state)}" data-selected-label="${escapeHtml(states.selected)}"><input type="radio" name="${name}" value="${escapeHtml(item.id)}" data-label="${escapeHtml(item.label)}" required${disabled ? ' disabled' : ''}><span>${escapeHtml(item.label)}<small>${escapeHtml(state)}</small></span></label>`;
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

function renderCollaborations(projects) {
  return projects.map((project) => `<article class="reveal bg-white/60 border border-stone-200 rounded-2xl p-7 flex flex-col">
        <div class="w-11 h-11 rounded-xl bg-moss-800 text-brass-400 flex items-center justify-center mb-5">
          <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
        </div>
        <h3 class="font-display font-semibold text-lg mb-4 flex-1">${escapeHtml(project.name)}</h3>
        <a href="${escapeHtml(project.url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 text-sm font-semibold text-moss-700 hover:text-moss-800 transition-colors" aria-label="Instagram do ${escapeHtml(project.name)} (abre em nova aba)">
          <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
          <span>Instagram ${escapeHtml(project.instagram)}</span>
        </a>
      </article>`).join('\n');
}

try {
  const [rawConfig, rawScheduling, rawIntegration, rawPrivacy, rawSeo, template, privacyTemplate] = await Promise.all([
    readFile(contentPath, 'utf8'),
    readFile(schedulingPath, 'utf8'),
    readFile(integrationPath, 'utf8'),
    readFile(privacyPath, 'utf8'),
    readFile(seoPath, 'utf8'),
    readFile(templatePath, 'utf8'),
    readFile(privacyTemplatePath, 'utf8'),
  ]);
  let config;
  let scheduling;
  let integration;
  let privacy;
  let seo;
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
  try { privacy = JSON.parse(rawPrivacy); } catch (error) { throw new Error(`JSON inválido em content/privacy.json: ${error.message}`); }
  try { seo = JSON.parse(rawSeo); } catch (error) { throw new Error(`JSON inválido em content/seo.json: ${error.message}`); }
  validate(config);
  validateScheduling(scheduling);
  validateIntegration(integration);
  validatePrivacy(privacy, config);
  validateSeo(seo);

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
    WHATSAPP_NUMBER: config.contactsConfigured ? config.whatsappNumber : '',
    DISPLAY_PHONE: htmlValues.displayPhone,
    EMAIL: htmlValues.email,
    INSTAGRAM_URL: escapeHtml(config.instagram),
    DISPLAY_INSTAGRAM: htmlValues.displayInstagram,
    COLLABORATIONS_TITLE: escapeHtml(config.collaborations.title),
    COLLABORATIONS_DESCRIPTION: escapeHtml(config.collaborations.description),
    COLLABORATIONS_PROJECTS: renderCollaborations(config.collaborations.projects),
    SERVICE_AREA: htmlValues.serviceArea,
    FOOTER_YEAR: htmlValues.footerYear,
    PROJECT_NAME_URL: encodeURIComponent(config.projectName),
    WHATSAPP_ATTRIBUTES: config.contactsConfigured ? `href=\"https://wa.me/${config.whatsappNumber}\"` : 'aria-disabled=\"true\" tabindex=\"-1\"',
    CONTACT_PHONE_DISPLAY: config.contactsConfigured ? htmlValues.displayPhone : 'Contato em configuração',
    CONTACT_EMAIL_DISPLAY: config.contactsConfigured ? htmlValues.email : 'Contato em configuração',
    SCHEDULING_TITLE: escapeHtml(scheduling.title),
    SCHEDULING_DESCRIPTION: escapeHtml(scheduling.description),
    SCHEDULING_NOTICE: escapeHtml(scheduling.availabilityNotice),
    SCHEDULING_INACTIVE: escapeHtml(scheduling.inactiveMessage.replaceAll('Pati', config.professionalName)),
    SCHEDULING_NOSCRIPT: escapeHtml(scheduling.noScriptMessage),
    SCHEDULING_SERVICES: renderOptions(scheduling.services, 'servico', scheduling.states),
    SCHEDULING_DAYS: '',
    SCHEDULING_TIMES: '',
    SCHEDULING_FIELDS: renderFields(scheduling.fields),
    SCHEDULING_REVIEW: escapeHtml(scheduling.reviewConfirmation),
    SCHEDULING_WHATSAPP_SUBMIT: escapeHtml(scheduling.whatsappSubmitLabel),
    SCHEDULING_EMAIL_SUBMIT: escapeHtml(scheduling.emailSubmitLabel),
    SCHEDULING_COMMERCIAL_NOTICE: escapeHtml(scheduling.commercialNotice.replaceAll('Pati', config.professionalName)),
    SCHEDULING_SUMMARY_TITLE: escapeHtml(scheduling.summaryTitle),
    SCHEDULING_NOT_SENT: escapeHtml(scheduling.states.notSent),
    INTEGRATION_CONFIG: JSON.stringify(integration).replaceAll('<', '\\u003c'),
    PRIVACY_POLICY_VERSION: escapeHtml(privacy.version),
    SEO_LANGUAGE: escapeHtml(seo.language), SEO_LOCALE: escapeHtml(seo.locale),
    SEO_THEME_COLOR: escapeHtml(seo.themeColor), SEO_ROBOTS: seo.indexingEnabled ? 'index, follow' : 'noindex, nofollow',
    SEO_TWITTER_CARD: escapeHtml(seo.twitterCard),
    SEO_INDEX_TITLE: escapeHtml(titleFor(seo, config.projectName)),
    SEO_INDEX_DESCRIPTION: escapeHtml(seo.defaultDescription),
    SEO_INDEX_OPTIONAL_TAGS: optionalSeoTags(seo, ''),
  };

  const output = replaceTokens(template, values, 'src/index.template.html');
  const privacyValues = {
    PROJECT_NAME: htmlValues.projectName, EMAIL: config.contactsConfigured ? htmlValues.email : 'Contato em configuração',
    PRIVACY_TITLE: escapeHtml(privacy.title), PRIVACY_VERSION: escapeHtml(privacy.version),
    PRIVACY_UPDATED_AT: escapeHtml(privacy.updatedAt), PRIVACY_CONTROLLER: escapeHtml(privacy.dataController),
    PRIVACY_DATA_TYPES: escapeHtml(privacy.requestedData.join(', ')), PRIVACY_PURPOSE: escapeHtml(privacy.purpose),
    PRIVACY_NO_RESERVATION: escapeHtml(privacy.noReservation), PRIVACY_CALENDAR_NOTICE: escapeHtml(privacy.calendarNotice),
    PRIVACY_RETENTION: escapeHtml(privacy.retentionPeriod), PRIVACY_CORRECTION: escapeHtml(privacy.correctionDeletion),
    PRIVACY_SENSITIVE_WARNING: escapeHtml(privacy.sensitiveDataWarning),
    SEO_LANGUAGE: escapeHtml(seo.language), SEO_LOCALE: escapeHtml(seo.locale),
    SEO_THEME_COLOR: escapeHtml(seo.themeColor), SEO_ROBOTS: seo.indexingEnabled ? 'index, follow' : 'noindex, nofollow',
    SEO_TWITTER_CARD: escapeHtml(seo.twitterCard),
    SEO_PRIVACY_TITLE: escapeHtml(titleFor(seo, privacy.title)),
    SEO_PRIVACY_DESCRIPTION: escapeHtml(`Aviso de privacidade da ${config.projectName} para solicitações de agendamento.`),
    SEO_PRIVACY_OPTIONAL_TAGS: optionalSeoTags(seo, 'privacy.html')
  };
  const privacyOutput = replaceTokens(privacyTemplate, privacyValues, 'src/privacy.template.html');
  const robots = seo.indexingEnabled ? `User-agent: *\nAllow: /\nSitemap: ${new URL('sitemap.xml', seo.siteUrl.endsWith('/') ? seo.siteUrl : `${seo.siteUrl}/`).href}\n` : 'User-agent: *\nDisallow: /\n';
  const writes = [writeFile(outputPath, output, 'utf8'), writeFile(privacyOutputPath, privacyOutput, 'utf8'), writeFile(robotsOutputPath, robots, 'utf8')];
  if (seo.indexingEnabled && seo.siteUrl) {
    const base = seo.siteUrl.endsWith('/') ? seo.siteUrl : `${seo.siteUrl}/`;
    writes.push(writeFile(sitemapOutputPath, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escapeHtml(base)}</loc></url><url><loc>${escapeHtml(new URL('privacy.html', base).href)}</loc></url></urlset>\n`, 'utf8'));
  } else writes.push(rm(sitemapOutputPath, { force: true }));
  await Promise.all(writes);
  console.log('index.html, privacy.html e robots.txt gerados com sucesso.');
} catch (error) {
  console.error(`Erro ao gerar o site: ${error.message}`);
  process.exitCode = 1;
}
