import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentPath = path.join(root, 'content/site.json');
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

try {
  const [rawConfig, template] = await Promise.all([
    readFile(contentPath, 'utf8'),
    readFile(templatePath, 'utf8'),
  ]);
  let config;
  try {
    config = JSON.parse(rawConfig);
  } catch (error) {
    throw new Error(`JSON inválido em content/site.json: ${error.message}`);
  }
  validate(config);

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
