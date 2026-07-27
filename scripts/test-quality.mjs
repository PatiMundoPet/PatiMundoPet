import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const [index, privacy, template, robots, integration, seo] = await Promise.all([
  readFile('index.html', 'utf8'), readFile('privacy.html', 'utf8'), readFile('src/index.template.html', 'utf8'),
  readFile('robots.txt', 'utf8'), readFile('content/integration.json', 'utf8').then(JSON.parse), readFile('content/seo.json', 'utf8').then(JSON.parse),
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
  for (const tag of html.match(/<a\b[^>]*target="_blank"[^>]*>/gi) || []) assert.match(tag, /rel="[^"]*noopener[^"]*noreferrer[^"]*"/i);
  for (const tag of html.match(/<img\b[^>]*>/gi) || []) {
    assert.match(tag, /\balt="[^"]*"/i, `${name}: imagem sem alt`);
    assert.match(tag, /\b(width|height)="|\bstyle="[^"]*aspect-ratio|\bclass="[^"]*aspect-/i, `${name}: imagem sem dimensão`);
  }
  for (const id of [...html.matchAll(/<(?:input|select|textarea)\b[^>]*\bid="([^"]+)"[^>]*>/gi)].map((match) => match[1])) {
    if (id === 'schedule-live-date') continue;
    assert.match(html, new RegExp(`<label\\b[^>]*for="${id}"`, 'i'), `${name}: controle ${id} sem label associado`);
  }
}

if (!seo.siteUrl) {
  assert.doesNotMatch(index + privacy, /rel="canonical"|property="og:url"/i);
}
if (!seo.socialImage) assert.doesNotMatch(index + privacy, /property="og:image"|name="twitter:image"/i);
assert.equal(robots, seo.indexingEnabled ? robots : 'User-agent: *\nDisallow: /\n');
await assert.rejects(access('sitemap.xml'), undefined, 'sitemap fictício não deve existir');
assert.ok(index.indexOf('assets/js/scheduling-api.js') < index.indexOf('assets/js/scheduling.js'), 'ordem dos scripts de agenda');
for (const tag of index.match(/<script\b[^>]+src="[^"]+"[^>]*>/gi) || []) {
  if (tag.includes('boot.js')) continue;
  assert.match(tag, /\bdefer\b/i, `script não crítico sem defer: ${tag}`);
}
assert.doesNotMatch(index.match(/<div id="inicio"[\s\S]*?<\/div>\s*<!--.*?DIFERENCIAIS/)?.[0] || '', /<img[^>]+loading="lazy"/i);

const reviewStart = template.indexOf('class="schedule-review"');
const reviewEnd = template.indexOf('</div>', template.indexOf('</div>', reviewStart) + 6) + 6;
const summaryPos = template.indexOf('id="schedule-summary"');
const privacyPos = template.indexOf('id="schedule-privacy-confirmation"');
assert.ok(reviewStart >= 0 && summaryPos > reviewStart && summaryPos < reviewEnd, '#schedule-summary deve estar no resumo');
assert.ok(privacyPos > reviewEnd, 'consentimento deve ficar fora e depois do resumo');
const scheduling = template.slice(template.indexOf('<section id="agendamento"'), template.indexOf('<!-- ============================================================ COMO FUNCIONA'));
assert.equal(count(scheduling, /<div\b/gi), count(scheduling, /<\/div>/gi), 'divs desbalanceadas no agendamento');
assert.equal(integration.mode, 'demo');
assert.equal(integration.webAppUrl, '');
assert.equal(seo.indexingEnabled, false);
assert.equal(seo.siteUrl, '');
assert.equal(seo.socialImage, '');
assert.doesNotMatch(JSON.stringify(seo), /https?:\/\//i, 'SEO não pode inventar domínio');
assert.match(await readFile('content/site.json', 'utf8'), /contactsConfigured/);

console.log('Testes estáticos de SEO, acessibilidade e performance aprovados.');
