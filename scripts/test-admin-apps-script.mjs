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

// Testes comportamentais das operações administrativas com serviços do Apps Script simulados.
const assert = (await import('node:assert/strict')).default;
const requestHeaders = ['requestId','dataRecebimento','submissionChannel','serviço','data','horário','responsável','WhatsApp','e-mail','pet','região','observações','status','notificationStatus','dataÚltimaAtualização','horárioTérmino','eventIdAtendimento','observaçãoAdministrativa'];
const clientHeaders = ['clienteId','responsável','WhatsApp','e-mail','pets','observações','dataCadastro','últimoAtendimento'];
const paymentHeaders = ['requestId','cliente','serviço','valor','formaPagamento','vencimento','statusPagamento','dataPagamento','observações'];
const ids = ['123e4567-e89b-42d3-a456-426614174000','223e4567-e89b-42d3-a456-426614174000'];
let activeEmail, opens, flushes, lockReleases, sheets, appointmentCalendar, availabilityCalendar;
function mockEvent(title,start,end,description='',status='confirmed',allDay=false) { return { title,start,end,description,status,allDay,deleted:false,deleteFails:false,getTitle(){return this.title;},getStartTime(){return this.start;},getEndTime(){return this.end;},getDescription(){return this.description;},getEventStatus(){return this.status;},getId(){return this.id;},isAllDayEvent(){return this.allDay;},deleteEvent(){if(this.deleteFails)throw Error('delete');this.deleted=true;} }; }
function mockCalendar() { return { events:[],creates:0,lookups:0,getEvents(start,end){return this.events.filter(event=>!event.deleted&&event.start<end&&event.end>start);},getEventById(id){this.lookups++;return this.events.find(event=>!event.deleted&&event.id===id)||null;},createEvent(title,start,end,options){this.creates++;const event=mockEvent(title,start,end,options.description);event.id='event-'+this.creates;this.events.push(event);return event;},createAllDayEvent(title,start,end,options){this.creates++;const event=mockEvent(title,start,end,options.description,'confirmed',true);event.id='event-'+this.creates;this.events.push(event);return event;} }; }
function mockSheet(name,headers) { return { name,rows:[headers.slice()],failWrite:false,getLastColumn(){return this.rows[0].length;},getLastRow(){return this.rows.length;},getDataRange(){return this.getRange(1,1,this.rows.length,this.rows[0].length);},getRange(row,column,rowCount=1,columnCount=1){const self=this;return {getValues(){return Array.from({length:rowCount},(_,i)=>self.rows[row-1+i].slice(column-1,column-1+columnCount));},setValues(values){if(self.failWrite)throw Error('sheet write');for(let i=0;i<rowCount;i++)for(let j=0;j<columnCount;j++)self.rows[row-1+i][column-1+j]=values[i][j];}};} }; }
function parseAdminDate(value) { const match=/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(value);if(!match)throw Error('date');const date=new Date(Date.UTC(+match[1],+match[2]-1,+match[3],+match[4],+match[5]));if(date.getUTCFullYear()!==+match[1]||date.getUTCMonth()+1!==+match[2]||date.getUTCDate()!==+match[3])throw Error('date');return date; }
const adminProperties={ADMIN_EMAIL:'admin@example.test',SPREADSHEET_ID:'sheet-test',APPOINTMENTS_CALENDAR_ID:'appointments-test',AVAILABILITY_CALENDAR_ID:'availability-test',TIMEZONE:'America/Sao_Paulo',WORKDAY_START_TIME:'08:30',WORKDAY_END_TIME:'18:00'};
const adminContext=vm.createContext({Date,console:{error(){}},PropertiesService:{getScriptProperties:()=>({getProperties:()=>({...adminProperties})})},Session:{getActiveUser:()=>({getEmail:()=>activeEmail})},SpreadsheetApp:{openById(){opens++;return {getSheetByName:name=>sheets[name]||null};},flush(){flushes++;}},CalendarApp:{getCalendarById:id=>id===adminProperties.APPOINTMENTS_CALENDAR_ID?appointmentCalendar:id===adminProperties.AVAILABILITY_CALENDAR_ID?availabilityCalendar:null},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){lockReleases++;}})},Utilities:{parseDate:parseAdminDate,formatDate(date,tz,format){if(format==='yyyy-MM-dd HH:mm')return date.toISOString().slice(0,16).replace('T',' ');if(format==='yyyy-MM-dd')return date.toISOString().slice(0,10);if(format==='HH:mm')return date.toISOString().slice(11,16);if(format==="yyyy-MM-dd'T'HH:mm:ss")return date.toISOString().slice(0,19);if(format==='u')return '1';throw Error(format);}}});
new vm.Script(code).runInContext(adminContext);
function resetAdmin(columns=18) { activeEmail='admin@example.test';opens=flushes=lockReleases=0;appointmentCalendar=mockCalendar();availabilityCalendar=mockCalendar();sheets={'Solicitações':mockSheet('Solicitações',requestHeaders.slice(0,columns)),'Clientes':mockSheet('Clientes',clientHeaders),'Pagamentos':mockSheet('Pagamentos',paymentHeaders)};adminContext.Date=class extends Date { constructor(value){super(value===undefined?'2026-07-29T12:00:00Z':value);} static now(){return new Date('2026-07-29T12:00:00Z').getTime();} }; }
function addRequest(id=ids[0],start='10:11',end='11:37',status='PENDENTE',eventId='',date='2026-08-10') { sheets.Solicitações.rows.push([id,'2026-07-29T10:00:00','site','serviço',date,start,'Responsável','5500000000000','pessoa@example.test','Pet','Região','Nota',status,'NOT_REQUESTED','2026-07-29T10:00:00',end,eventId,'']); }
function safeCode(fn){try{fn();return '';}catch(error){return error.safeCode||String(error.message).split(':')[0];}}
resetAdmin();activeEmail='other@example.test';assert.equal(safeCode(()=>adminContext.carregarDadosIniciais()),'ACCESS_DENIED');assert.equal(opens,0,'não autorizado não lê planilha');assert.equal(safeCode(()=>adminContext.confirmarSolicitacao(ids[0])),'ACCESS_DENIED');assert.equal(opens,0,'não autorizado não escreve');
for(const columns of [16,17]){resetAdmin(columns);assert.equal(adminContext.writesConfigured_(adminProperties),false);}
resetAdmin();assert.equal(adminContext.writesConfigured_(adminProperties),true);sheets.Solicitações.rows[0][17]='errado';assert.equal(adminContext.writesConfigured_(adminProperties),false);
for(const [start,end,expected] of [['10:11','11:37',''],['17:47','18:00',''],['08:29','09:00','INVALID_INTERVAL'],['17:47','18:01','INVALID_INTERVAL'],['10:11','10:11','INVALID_INTERVAL'],['texto 10:11','11:37','INVALID_INTERVAL']]){resetAdmin();addRequest(ids[0],start,end);const code=safeCode(()=>adminContext.confirmarSolicitacao(ids[0]));assert.equal(code,expected,`${start}-${end}`);if(!expected)assert.equal(appointmentCalendar.creates,1);}
resetAdmin();addRequest(ids[0],'10:11','11:37','PENDENTE','','2026-02-30');assert.equal(safeCode(()=>adminContext.confirmarSolicitacao(ids[0])),'INVALID_INTERVAL');
const nativeDate=new Date('2026-08-10T12:00:00Z'),nativeStart=new Date('1899-12-30T10:11:00Z'),nativeEnd=new Date('1899-12-30T11:37:00Z');
for (const [dateValue,startValue,endValue] of [[nativeDate,'10:11','11:37'],['2026-08-10',nativeStart,'11:37'],['2026-08-10','10:11',nativeEnd],[nativeDate,nativeStart,nativeEnd]]) { resetAdmin();addRequest();sheets.Solicitações.rows[1][4]=dateValue;sheets.Solicitações.rows[1][5]=startValue;sheets.Solicitações.rows[1][15]=endValue;assert.equal(safeCode(()=>adminContext.confirmarSolicitacao(ids[0])),'','valores Date nativos confirmam 10:11–11:37');assert.equal(appointmentCalendar.creates,1); }

resetAdmin();addRequest();appointmentCalendar.events.push(mockEvent('adjacente',parseAdminDate('2026-08-10 09:00'),parseAdminDate('2026-08-10 10:11')));assert.equal(safeCode(()=>adminContext.confirmarSolicitacao(ids[0])), '');
for(const target of ['appointments','availability']){resetAdmin();addRequest();const calendar=target==='appointments'?appointmentCalendar:availabilityCalendar;calendar.events.push(mockEvent(target,parseAdminDate('2026-08-10 11:36'),parseAdminDate('2026-08-10 12:00')));assert.equal(safeCode(()=>adminContext.confirmarSolicitacao(ids[0])),'INTERVAL_UNAVAILABLE');}
for(const title of ['dia inteiro','ocorrência recorrente']){resetAdmin();addRequest();appointmentCalendar.events.push(mockEvent(title,parseAdminDate('2026-08-10 00:00'),parseAdminDate('2026-08-11 00:00')));assert.equal(safeCode(()=>adminContext.confirmarSolicitacao(ids[0])),'INTERVAL_UNAVAILABLE');}
resetAdmin();addRequest(ids[0]);addRequest(ids[1]);assert.equal(safeCode(()=>adminContext.confirmarSolicitacao(ids[0])),'');assert.equal(safeCode(()=>adminContext.confirmarSolicitacao(ids[1])),'INTERVAL_UNAVAILABLE');assert.equal(appointmentCalendar.creates,1);assert.match(appointmentCalendar.events[0].description,new RegExp(ids[0]));assert.equal(sheets.Solicitações.rows[1][16],'event-1');assert.equal(safeCode(()=>adminContext.confirmarSolicitacao(ids[0])),'');assert.equal(appointmentCalendar.creates,1,'confirmação repetida não duplica');
resetAdmin();addRequest(ids[0],'10:11','11:37','CONFIRMADO');assert.equal(safeCode(()=>adminContext.confirmarSolicitacao(ids[0])),'RECONCILIATION_REQUIRED');
for(const status of ['PENDENTE','MAIS_INFORMACOES','RECUSADO','CANCELADO']){resetAdmin();addRequest(ids[0],'10:11','11:37',status,'orphan');const action=status==='PENDENTE'?()=>adminContext.voltarSolicitacaoParaPendente(ids[0],''):status==='MAIS_INFORMACOES'?()=>adminContext.pedirMaisInformacoes(ids[0],'nota'):status==='RECUSADO'?()=>adminContext.recusarSolicitacao(ids[0],'nota'):()=>adminContext.cancelarSolicitacao(ids[0],'');assert.equal(safeCode(action),'RECONCILIATION_REQUIRED',status);}
resetAdmin();addRequest();sheets.Solicitações.failWrite=true;assert.equal(safeCode(()=>adminContext.confirmarSolicitacao(ids[0])),'PERSISTENCE_FAILED');assert.equal(appointmentCalendar.events[0].deleted,true);
resetAdmin();addRequest();sheets.Solicitações.failWrite=true;appointmentCalendar.createEvent=function(t,s,e,o){const event=mockEvent(t,s,e,o.description);event.id='event-x';event.deleteFails=true;this.events.push(event);return event;};assert.equal(safeCode(()=>adminContext.confirmarSolicitacao(ids[0])),'RECONCILIATION_REQUIRED');
for(const [action,status,note] of [['pedirMaisInformacoes','PENDENTE','nota'],['voltarSolicitacaoParaPendente','MAIS_INFORMACOES',''],['recusarSolicitacao','PENDENTE','nota']]){resetAdmin();addRequest(ids[0],'10:11','11:37',status);assert.equal(safeCode(()=>adminContext[action](ids[0],note)),'');assert.equal(appointmentCalendar.creates,0);}
resetAdmin();addRequest();assert.equal(safeCode(()=>adminContext.cancelarSolicitacao(ids[0],'')),'');assert.equal(appointmentCalendar.lookups,0);
resetAdmin();const linked=mockEvent('vinculado',parseAdminDate('2026-08-10 10:11'),parseAdminDate('2026-08-10 11:37'),'PATI_MUNDOPET_REQUEST\nrequestId: '+ids[0]);linked.id='linked';appointmentCalendar.events.push(linked);addRequest(ids[0],'10:11','11:37','CONFIRMADO','linked');assert.equal(safeCode(()=>adminContext.cancelarSolicitacao(ids[0],'')),'');assert.equal(linked.deleted,true);assert.equal(sheets.Solicitações.rows[1][16],'');
resetAdmin();const wrong=mockEvent('errado',parseAdminDate('2026-08-10 10:11'),parseAdminDate('2026-08-10 11:37'),'PATI_MUNDOPET_REQUEST\nrequestId: '+ids[1]);wrong.id='wrong';appointmentCalendar.events.push(wrong);addRequest(ids[0],'10:11','11:37','CONFIRMADO','wrong');assert.equal(safeCode(()=>adminContext.cancelarSolicitacao(ids[0],'')),'RECONCILIATION_REQUIRED');assert.equal(wrong.deleted,false);
for(const status of ['RECUSADO','CANCELADO']){resetAdmin();addRequest(ids[0],'10:11','11:37',status);assert.equal(safeCode(()=>adminContext.pedirMaisInformacoes(ids[0],'nota')),'INVALID_TRANSITION');}
assert.doesNotMatch(code,/MailApp|GmailApp|UrlFetchApp|appendPayment|WhatsApp.*send/i,'ações administrativas não enviam mensagens nem criam pagamentos');
assert.match(app,/if \(state\.writing\) return;/,'modal e novas ações respeitam escrita em andamento');
assert.match(app,/querySelector\('\.action-panel'\)/,'somente um painel de ação é permitido');
assert.match(app,/textarea:not\(\[disabled\]\)/,'textarea participa da navegação por teclado');
for (const codeName of ['ACCESS_DENIED','CONFIG_ERROR','INVALID_REQUEST','INVALID_TRANSITION','INVALID_INTERVAL','INTERVAL_UNAVAILABLE','LOCK_TIMEOUT','RECONCILIATION_REQUIRED','PERSISTENCE_FAILED','WRITE_ERROR','NOT_FOUND']) assert.match(app,new RegExp(`${codeName}:`),`mensagem segura ausente: ${codeName}`);
assert.match(app,/agendaDate = \$\('agendaDate'\)\.value/,'data da agenda é preservada');
assert.match(app,/\.then\(refreshAfterWrite\)\.then/,'sucesso somente é exibido após releitura');
const mapped=adminContext.mapRequest_({requestId:ids[0],status:'PENDENTE','observaçãoAdministrativa':'Nota interna'},'America/Sao_Paulo');assert.equal(mapped.adminNote,'Nota interna');
assert.match(app,/if \(row\.adminNote\) requestFields\.push\(\['Observação administrativa', row\.adminNote\]\)/,'observação administrativa aparece condicionalmente');
assert.match(app,/action\[1\] !== 'confirmarSolicitacao'/,'Confirmar não cria textarea');
assert.match(app,/action\[2\] \? ' \(obrigatória\)' : ' \(opcional\)'/,'demais ações mantêm observação obrigatória ou opcional');
const requestModalSource=app.slice(app.indexOf('function openRequest'),app.indexOf('function renderClients'));
assert.doesNotMatch(requestModalSource,/eventIdAtendimento/,'modal não expõe ID do evento');


// Fase 10C-1: criação e exclusão de bloqueios com calendários simulados.
const blockId=ids[0];
const timedPayload=(start='10:11',end='11:37',date='2026-08-10')=>({tipo:'horario',blockId,motivo:'Compromisso',data:date,inicio:start,termino:end});
resetAdmin();activeEmail='other@example.test';assert.equal(safeCode(()=>adminContext.criarBloqueio(timedPayload())),'ACCESS_DENIED');assert.equal(appointmentCalendar.lookups,0);assert.equal(availabilityCalendar.lookups,0);
resetAdmin();activeEmail='other@example.test';assert.equal(safeCode(()=>adminContext.excluirBloqueio('event-1',blockId)),'ACCESS_DENIED');assert.equal(availabilityCalendar.lookups,0);
for(const [start,end,expected] of [['10:11','11:37',''],['17:47','18:00',''],['08:29','09:00','INVALID_INTERVAL'],['17:47','18:01','INVALID_INTERVAL'],['10:11','10:11','INVALID_INTERVAL'],['texto 10:11','11:37','INVALID_INTERVAL']]){resetAdmin();assert.equal(safeCode(()=>adminContext.criarBloqueio(timedPayload(start,end))),expected);if(!expected){assert.equal(availabilityCalendar.creates,1);assert.equal(availabilityCalendar.events[0].start.toISOString().slice(11,16),start);assert.equal(appointmentCalendar.creates,0);}}
resetAdmin();assert.equal(safeCode(()=>adminContext.criarBloqueio(timedPayload('10:11','11:37','2026-02-30'))),'INVALID_DATE');
resetAdmin();assert.equal(safeCode(()=>adminContext.criarBloqueio(timedPayload('10:11','11:37','2026-07-01'))),'INVALID_INTERVAL');
resetAdmin();appointmentCalendar.events.push(mockEvent('adjacente',parseAdminDate('2026-08-10 09:00'),parseAdminDate('2026-08-10 10:11')));assert.equal(safeCode(()=>adminContext.criarBloqueio(timedPayload())), '');
for(const [target,start,status] of [['appointments','11:36','confirmed'],['availability','11:36','confirmed'],['appointments','00:00','confirmed'],['appointments','11:36','canceled']]){resetAdmin();const calendar=target==='appointments'?appointmentCalendar:availabilityCalendar;calendar.events.push(mockEvent('evento',parseAdminDate('2026-08-10 '+start),parseAdminDate(start==='00:00'?'2026-08-11 00:00':'2026-08-10 12:00'),' ',status,start==='00:00'));const expected=status==='canceled'?'':'INTERVAL_UNAVAILABLE';assert.equal(safeCode(()=>adminContext.criarBloqueio(timedPayload())),expected);}
resetAdmin();const oneDay={tipo:'dia_inteiro',blockId,motivo:'Folga',dataInicial:'2026-08-10',dataFinal:'2026-08-10'};assert.equal(safeCode(()=>adminContext.criarBloqueio(oneDay)),'');assert.equal(availabilityCalendar.events[0].allDay,true);assert.equal(availabilityCalendar.events[0].end.toISOString().slice(0,10),'2026-08-11');
resetAdmin();const manyDays={...oneDay,dataFinal:'2026-08-17'};assert.equal(safeCode(()=>adminContext.criarBloqueio(manyDays)),'');assert.equal(availabilityCalendar.events[0].end.toISOString().slice(0,10),'2026-08-18');
for(const [initial,final,expected] of [['2026-08-11','2026-08-10','INVALID_RANGE'],['2026-08-10','2027-08-11','INVALID_RANGE'],['2026-01-01','2026-01-02','INVALID_RANGE']]){resetAdmin();assert.equal(safeCode(()=>adminContext.criarBloqueio({...oneDay,dataInicial:initial,dataFinal:final})),expected);}
resetAdmin();appointmentCalendar.events.push(mockEvent('ocupado',parseAdminDate('2026-08-12 10:00'),parseAdminDate('2026-08-12 11:00')));assert.equal(safeCode(()=>adminContext.criarBloqueio(manyDays)),'INTERVAL_UNAVAILABLE');
resetAdmin();assert.equal(safeCode(()=>adminContext.criarBloqueio(timedPayload())),'');assert.equal(safeCode(()=>adminContext.criarBloqueio(timedPayload())),'');assert.equal(availabilityCalendar.creates,1,'blockId repetido não duplica');
const managed=availabilityCalendar.events[0];assert.equal(safeCode(()=>adminContext.excluirBloqueio(managed.id,blockId)),'');assert.equal(managed.deleted,true);
resetAdmin();const manual=mockEvent('manual',parseAdminDate('2026-08-10 10:00'),parseAdminDate('2026-08-10 11:00'));manual.id='manual';availabilityCalendar.events.push(manual);assert.equal(safeCode(()=>adminContext.excluirBloqueio('manual',blockId)),'RECONCILIATION_REQUIRED');assert.equal(manual.deleted,false);
resetAdmin();assert.equal(safeCode(()=>adminContext.criarBloqueio(timedPayload())),'');const wrongBlock=availabilityCalendar.events[0];assert.equal(safeCode(()=>adminContext.excluirBloqueio(wrongBlock.id,ids[1])),'RECONCILIATION_REQUIRED');assert.equal(wrongBlock.deleted,false);
resetAdmin();const appointment=mockEvent('atendimento',parseAdminDate('2026-08-10 10:00'),parseAdminDate('2026-08-10 11:00'),'PATI_MUNDOPET_BLOCK\nblockId: '+blockId);appointment.id='appointment';appointmentCalendar.events.push(appointment);assert.equal(safeCode(()=>adminContext.excluirBloqueio('appointment',blockId)),'RECONCILIATION_REQUIRED');assert.equal(appointment.deleted,false);assert.equal(appointmentCalendar.lookups,0,'exclusão não consulta Atendimentos');
assert.match(app,/crypto\.randomUUID\(\)/);assert.doesNotMatch(app,/window\.(?:prompt|confirm)\(/);assert.match(app,/if \(row\.managed\)/);assert.match(app,/Gerenciado diretamente no Google Agenda/);assert.doesNotMatch(app,/text\(row\.eventId|eventId\)/,'eventId não é renderizado');assert.match(app,/if \(state\.writing\) return;/);assert.match(app,/Promise\.all\(\[loadAgenda\(\), loadBlocks\(\)\]\)/);
console.log('Admin Apps Script: bloqueios temporizados, de dia inteiro, idempotência e exclusão segura validados com mocks.');

console.log('Admin Apps Script: operações administrativas e compensações validadas com mocks.');
