import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const [index, privacy, template, robots, integration, seo, scheduling, site] = await Promise.all([
  readFile('index.html', 'utf8'),
  readFile('privacy.html', 'utf8'),
  readFile('src/index.template.html', 'utf8'),
  readFile('robots.txt', 'utf8'),
  readFile('content/integration.json', 'utf8').then(JSON.parse),
  readFile('content/seo.json', 'utf8').then(JSON.parse),
  readFile('content/scheduling.json', 'utf8').then(JSON.parse),
  readFile('content/site.json', 'utf8').then(JSON.parse),
]);

const pages = { 'index.html': index, 'privacy.html': privacy };
const count = (html, pattern) => (html.match(pattern) || []).length;

for (const [name, html] of Object.entries(pages)) {
  assert.equal(count(html, /<h1\b/gi), 1, `${name}: deve existir exatamente um h1`);
  assert.match(html, /<meta name="description" content="[^"]+">/i, `${name}: description ausente`);
  assert.match(html, new RegExp(`<meta name="robots" content="${seo.indexingEnabled ? 'index, follow' : 'noindex, nofollow'}">`, 'i'));
  assert.match(html, /<a class="skip-link" href="#conteudo-principal">Pular para o conteúdo<\/a>/i);
  assert.match(html, /<main[^>]+id="conteudo-principal"/i);
  assert.doesNotMatch(html, /<script(?![^>]+type="application\/json")[^>]*>\s*[^<\s]/i, `${name}: JavaScript executável inline`);
  for (const tag of html.match(/<a\b[^>]*target="_blank"[^>]*>/gi) || []) {
    assert.match(tag, /rel="[^"]*noopener[^"]*noreferrer[^"]*"/i, `${name}: link externo sem proteção`);
  }
  for (const tag of html.match(/<img\b[^>]*>/gi) || []) {
    assert.match(tag, /\balt="[^"]*"/i, `${name}: imagem sem alt`);
    assert.match(tag, /\b(width|height)="|\bstyle="[^"]*aspect-ratio|\bclass="[^"]*aspect-/i, `${name}: imagem sem dimensão`);
  }
  for (const id of [...html.matchAll(/<(?:input|select|textarea)\b[^>]*\bid="([^"]+)"[^>]*>/gi)].map((match) => match[1])) {
    if (id === 'schedule-live-date') continue;
    assert.match(html, new RegExp(`<label\\b[^>]*for="${id}"`, 'i'), `${name}: controle ${id} sem label associado`);
  }
}

if (!seo.siteUrl) assert.doesNotMatch(index + privacy, /rel="canonical"|property="og:url"/i);
if (!seo.socialImage) assert.doesNotMatch(index + privacy, /property="og:image"|name="twitter:image"/i);
assert.equal(robots, seo.indexingEnabled ? robots : 'User-agent: *\nDisallow: /\n');
await assert.rejects(access('sitemap.xml'), undefined, 'sitemap fictício não deve existir');
assert.equal(integration.mode, 'live');
assert.match(integration.webAppUrl, /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/);
assert.equal(seo.indexingEnabled, false);
assert.equal(seo.siteUrl, '');
assert.equal(seo.socialImage, '');
assert.doesNotMatch(JSON.stringify(seo), /https?:\/\//i, 'SEO não pode inventar domínio');
assert.equal(site.contactsConfigured, true);

const expectedSectionOrder = [
  'inicio',
  'quem-e-a-pati',
  'servicos',
  'caminho-passeio',
  'galeria',
  'projetos-colaboradores',
  'agendamento',
];

for (const html of [template, index]) {
  const actualSectionOrder = [...html.matchAll(/<section\b[^>]*\bid="([^"]+)"/gi)].map((match) => match[1]);
  assert.deepEqual(actualSectionOrder, expectedSectionOrder, 'ordem estrutural das seções públicas');
  let previous = -1;
  for (const id of expectedSectionOrder) {
    const position = html.indexOf(`href="#${id}"`);
    assert.ok(position >= 0, `navegação ausente para #${id}`);
    const sectionPosition = html.indexOf(`id="${id}"`);
    assert.ok(sectionPosition > previous, `seção #${id} fora de ordem`);
    previous = sectionPosition;
  }
}

for (const id of expectedSectionOrder.slice(1)) {
  assert.ok(count(index, new RegExp(`href="#${id}"`, 'g')) >= 3, `desktop, mobile e rodapé devem apontar para #${id}`);
}

const servicesStart = index.indexOf('<section id="servicos"');
const servicesEnd = index.indexOf('<section id="caminho-passeio"');
const publicServices = index.slice(servicesStart, servicesEnd);
assert.match(publicServices, /<h3[^>]*>Passeios<\/h3>/i);
assert.match(publicServices, /<h3[^>]*>Dog Day Care<\/h3>/i);
assert.match(publicServices, /<h3[^>]*>Dog sitter<\/h3>/i);
assert.equal(count(publicServices, /<h3\b/gi), 3, 'exatamente três serviços públicos');
assert.match(publicServices, /aria-label="Combinar Dog sitter com a Pati pelo WhatsApp"/i);
assert.match(publicServices, new RegExp(`href="https://wa\\.me/${site.whatsappNumber}"`, 'i'));

assert.deepEqual(scheduling.services, [{ id: 'passeio-individual', label: 'Passeios' }, { id: 'dog-day-care', label: 'Dog Day Care' }]);
const whatsappField = scheduling.fields.find((field) => field.id === 'whatsapp');
assert.equal(whatsappField?.required, true, 'WhatsApp deve ser obrigatório');
const petField = scheduling.fields.find((field) => field.id === 'pet');
assert.equal(petField?.label, 'Nome do cão');

const formStart = index.indexOf('<form id="schedule-form"');
const formEnd = index.indexOf('</form>', formStart);
const form = index.slice(formStart, formEnd);
assert.equal(count(form, /name="servico"/gi), 2, 'formulário deve oferecer Passeios e Dog Day Care');
assert.match(form, /value="passeio-individual"/i);
assert.match(form, /value="dog-day-care"/i);
assert.doesNotMatch(form, /value="dog-sitter"/i);
assert.equal(count(form, /type="submit"/gi), 1, 'formulário possui um único botão de envio');
assert.match(form, />Enviar pré-solicitação<\/button>/i);
assert.doesNotMatch(form, /passeio-grupo|planos-semanais/i);
assert.match(form, /for="schedule-pet">Nome do cão/i);
assert.doesNotMatch(form, /for="schedule-pet">Nome do pet/i);
assert.match(form, /id="schedule-whatsapp"[^>]*\brequired\b/i);

const forbiddenPublicContent = [
  /todos os dias/i,
  /passeio em (?:pequeno )?grupo/i,
  /planos semanais/i,
  /\bequipe\b/i,
  /\bavalia(?:ção|ções)\b/i,
  /\bdepoimentos?\b/i,
  /\bcheckout\b/i,
  /\bcartão\b/i,
  /\bboleto\b/i,
  /\bfacebook\b/i,
];
for (const pattern of forbiddenPublicContent) assert.doesNotMatch(index + template, pattern, `conteúdo público proibido: ${pattern}`);

for (const project of site.collaborations.projects) {
  assert.match(index, new RegExp(project.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

assert.ok(index.indexOf('assets/js/scheduling-api.js') < index.indexOf('assets/js/scheduling.js'), 'ordem dos scripts de agenda');
for (const tag of index.match(/<script\b[^>]+src="[^"]+"[^>]*>/gi) || []) {
  if (tag.includes('boot.js')) continue;
  assert.match(tag, /\bdefer\b/i, `script não crítico sem defer: ${tag}`);
}

const reviewStart = template.indexOf('class="schedule-review"');
const reviewEnd = template.indexOf('</div>', template.indexOf('</div>', reviewStart) + 6) + 6;
const summaryPos = template.indexOf('id="schedule-summary"');
const privacyPos = template.indexOf('id="schedule-privacy-confirmation"');
assert.ok(reviewStart >= 0 && summaryPos > reviewStart && summaryPos < reviewEnd, '#schedule-summary deve estar no resumo');
assert.ok(privacyPos > reviewEnd, 'consentimento deve ficar fora e depois do resumo');
const schedulingSection = template.slice(template.indexOf('<section id="agendamento"'), template.indexOf('<section class="bg-moss-950'));
assert.equal(count(schedulingSection, /<div\b/gi), count(schedulingSection, /<\/div>/gi), 'divs desbalanceadas no agendamento');

console.log('Testes estáticos da Fase 11A, SEO, acessibilidade e performance aprovados.');

const schedulingSuccess = template;
for (const expected of ['Pré-solicitação registrada','Você pode continuar a conversa no WhatsApp ou copiar a ficha abaixo.','Continuar no WhatsApp','Ficha registrada','Copiar ficha']) assert(schedulingSuccess.includes(expected), `Ação de sucesso ausente: ${expected}`);
assert(/id="schedule-copy-text"[^>]*readonly/.test(schedulingSuccess), 'Ficha registrada deve ser somente leitura.');
for (const id of ['schedule-whatsapp-fallback','schedule-continue-whatsapp','schedule-copy-text','schedule-copy-button','schedule-final-notice','schedule-recovery-actions','schedule-retry-status']) assert.equal(count(schedulingSection,new RegExp(`id="${id}"`,'g')),1,`${id} deve ser preservado exatamente uma vez`);
assert.match(schedulingSection,/<a id="schedule-continue-whatsapp"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/,'Continuar no WhatsApp permanece link seguro separado');
assert.match(schedulingSection,/id="schedule-final-notice"[^>]*tabindex="-1"[^>]*aria-live="polite"/,'aviso final preserva foco programático e aria-live');
