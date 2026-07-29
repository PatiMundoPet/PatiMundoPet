import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8');
const required = ['Code.gs', 'Index.html', 'Styles.html', 'App.html', 'appsscript.json', 'README.md'];
for (const file of required) {
  if (!fs.existsSync(new URL(`admin-apps-script/${file}`, root))) throw new Error(`Arquivo ausente: ${file}`);
}

const code = read('admin-apps-script/Code.gs');
const app = read('admin-apps-script/App.html');
const index = read('admin-apps-script/Index.html');
const manifest = JSON.parse(read('admin-apps-script/appsscript.json'));

new vm.Script(code, { filename: 'Code.gs' });
new vm.Script(app.replace(/^<script>\s*/, '').replace(/\s*<\/script>\s*$/, ''), { filename: 'App.html' });

for (const name of ['carregarDadosIniciais', 'listarSolicitacoes', 'listarClientes', 'listarPagamentos', 'consultarAgendaDia', 'consultarAgendaSemana', 'listarBloqueios']) {
  if (!new RegExp(`function\\s+${name}\\s*\\(`).test(code)) throw new Error(`Função de leitura ausente: ${name}`);
}
for (const view of ['inicio', 'solicitacoes', 'agenda', 'bloqueios', 'clientes', 'pagamentos']) {
  if (!index.includes(`id="view-${view}"`)) throw new Error(`Módulo ausente: ${view}`);
}
for (const name of ['confirmarSolicitacao', 'pedirMaisInformacoes', 'voltarSolicitacaoParaPendente', 'recusarSolicitacao', 'cancelarSolicitacao']) {
  if (!new RegExp(`function\\s+${name}\\s*\\(`).test(code)) throw new Error(`Função administrativa ausente: ${name}`);
}
if (/painel\.html/.test(read('index.html'))) throw new Error('O site público referencia o painel.');
if (fs.existsSync(new URL('painel.html', root))) throw new Error('O protótipo ainda está na raiz.');
if (!code.includes("WORKDAY_START_TIME !== '08:30'") || !code.includes("WORKDAY_END_TIME !== '18:00'")) throw new Error('Regras operacionais ausentes.');
if (app.includes('slotTimes') || app.includes('slotIntervalMinutes')) throw new Error('A agenda não deve depender de grade artificial.');
if (!app.includes("grid.appendChild(eventCard(event))")) throw new Error('Lista cronológica ausente.');
if (!/data\.appointments\.concat\(data\.blocks\)\.filter[\s\S]*?\.sort\(function \(a, b\) \{ return a\.start\.localeCompare\(b\.start\); \}\)/.test(app)) throw new Error('Visão semanal não ordena conjuntamente atendimentos e bloqueios.');
if (!code.includes('Session.getActiveUser().getEmail()')) throw new Error('Autorização por usuário ausente.');
if (manifest.runtimeVersion !== 'V8' || manifest.timeZone !== 'America/Sao_Paulo') throw new Error('Manifesto inválido.');
const expectedScopes = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/userinfo.email'
];
if (!Array.isArray(manifest.oauthScopes) || manifest.oauthScopes.length !== expectedScopes.length || expectedScopes.some((scope) => !manifest.oauthScopes.includes(scope))) {
  throw new Error('O manifesto deve conter exatamente os três escopos autorizados.');
}

const serverContext = vm.createContext({ console, Date });
new vm.Script(code).runInContext(serverContext);
const clientOverlapSource = app.match(/function eventOverlapsPeriod\([^}]+\}/)?.[0];
if (!clientOverlapSource) throw new Error('Comparação de sobreposição da interface ausente.');
const clientContext = vm.createContext({});
new vm.Script(clientOverlapSource).runInContext(clientContext);

const overlapCases = [
  { name: 'evento normal no mesmo dia', event: { start: '2026-07-28T10:00:00', end: '2026-07-28T11:00:00' }, expectedDays: ['2026-07-28'] },
  { name: 'evento terminando à meia-noite', event: { start: '2026-07-28T23:00:00', end: '2026-07-29T00:00:00' }, expectedDays: ['2026-07-28'] },
  { name: 'bloqueio de dia inteiro com término exclusivo', event: { start: '2026-07-28T00:00:00', end: '2026-07-29T00:00:00' }, expectedDays: ['2026-07-28'] },
  { name: 'evento atravessando dois dias', event: { start: '2026-07-28T23:00:00', end: '2026-07-29T01:00:00' }, expectedDays: ['2026-07-28', '2026-07-29'] }
];
const checkedDays = ['2026-07-28', '2026-07-29'];
for (const testCase of overlapCases) {
  for (const day of checkedDays) {
    const expected = testCase.expectedDays.includes(day);
    const periodStart = `${day}T00:00:00`;
    const nextDay = day === '2026-07-28' ? '2026-07-29' : '2026-07-30';
    const periodEnd = `${nextDay}T00:00:00`;
    if (serverContext.overlapsDay_(testCase.event, day) !== expected) throw new Error(`Servidor falhou: ${testCase.name} em ${day}.`);
    if (clientContext.eventOverlapsPeriod(testCase.event, periodStart, periodEnd) !== expected) throw new Error(`Semana falhou: ${testCase.name} em ${day}.`);
  }
}
console.log('Admin Apps Script: estrutura, sintaxe, leitura, segurança e agenda validadas.');
