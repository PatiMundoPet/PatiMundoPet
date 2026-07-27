import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
for (const file of ['index.html', 'privacy.html']) {
  const html = await readFile(new URL('../' + file, import.meta.url), 'utf8');
  assert.doesNotMatch(html, /\{\{[^}]+\}\}/, `${file} não pode conter tokens`);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=|[^>]*type=["']application\/json["'])[^>]*>[\s\S]*?<\/script>/i, `${file} não pode conter JS inline`);
  for (const tag of html.match(/<a\b[^>]*target=["']_blank["'][^>]*>/gi) || []) {
    assert.match(tag, /rel=["'][^"']*\bnoopener\b[^"']*\bnoreferrer\b[^"']*["']/i, 'target blank deve ser isolado');
  }
}
const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
assert.match(index.match(/<head>[\s\S]*?<\/head>/i)[0], /<script src="assets\/js\/boot\.js"><\/script>/);
const schedulingSection = index.match(/<section\b[^>]*\bid="agendamento"[^>]*>[\s\S]*?<\/section>/i)?.[0];
assert.ok(schedulingSection, 'a seção de agendamento deve existir');
const scheduleReview = schedulingSection.match(/<div class="schedule-review">[\s\S]*?<\/div>\s*<\/div>/i)?.[0];
assert.ok(scheduleReview, 'o bloco de revisão deve existir');
assert.match(scheduleReview, /id="schedule-summary"/, 'schedule-summary deve estar dentro de schedule-review');
assert.doesNotMatch(scheduleReview, /id="schedule-privacy-confirmation"/, 'o consentimento deve estar fora de schedule-review');
assert.match(schedulingSection.slice(schedulingSection.indexOf(scheduleReview) + scheduleReview.length), /id="schedule-privacy-confirmation"/, 'o consentimento deve vir depois de schedule-review');
assert.equal((schedulingSection.match(/<div\b/gi) || []).length, (schedulingSection.match(/<\/div>/gi) || []).length, 'a seção de agendamento deve ter a mesma quantidade de aberturas e fechamentos de div');
const integration = JSON.parse(await readFile(new URL('../content/integration.json', import.meta.url), 'utf8'));
assert.equal(integration.mode, 'demo'); assert.equal(integration.webAppUrl, '');
console.log('Verificações estáticas de segurança concluídas.');
