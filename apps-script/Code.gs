/** Backend demonstrativo; toda configuração operacional vem de Script Properties. */
var SERVICE_NAME = 'paty-mundopet-scheduling';
var SERVICE_VERSION = '1.1.0';
var MAX_FUTURE_DAYS = 90;
var LOCK_TIMEOUT_MS = 5000;
var REQUIRED_PROPERTIES = ['CALENDAR_ID','TIMEZONE','SLOT_DURATION_MINUTES','ALLOWED_START_TIMES_JSON','ALLOWED_SERVICE_IDS_JSON','PENDING_EVENT_PREFIX','WHATSAPP_NUMBER','PRIVACY_POLICY_VERSION','MAX_REQUEST_BYTES','RATE_LIMIT_WINDOW_MINUTES','RATE_LIMIT_MAX_REQUESTS','RATE_LIMIT_SALT','PENDING_RETENTION_DAYS'];
var ALLOWED_POST_FIELDS = ['action','serviceId','date','time','responsibleName','whatsapp','petName','region','notes','reviewAccepted','privacyAccepted','privacyPolicyVersion','honeypot','requestId'];
var TEXT_LIMITS = { serviceId:80, responsibleName:120, whatsapp:20, petName:80, region:120, notes:1000, privacyPolicyVersion:80, requestId:36 };

function doGet(e) {
  try { var action=getParameter_(e,'action'); if(action==='health')return jsonResponse_(healthResponse_()); if(action==='availability')return jsonResponse_(availabilityResponse_(getParameter_(e,'date'))); return jsonResponse_(invalidRequest_()); }
  catch(error){ logTechnical_('GET_INTERNAL',''); return jsonResponse_(response_(false,'INTERNAL_ERROR','Não foi possível processar a solicitação.')); }
}
function doPost(e) {
  var requestId='';
  try {
    var baseConfig=loadConfig_();
    if(!baseConfig.ok) return jsonResponse_(response_(false,'CONFIGURATION_REQUIRED','A integração ainda não foi configurada.'));
    var parsed=parsePostPayload_(e,baseConfig.config.maxRequestBytes);
    if(!parsed.ok) return jsonResponse_(invalidRequest_());
    requestId=String(parsed.payload.requestId||'');
    if(parsed.payload.action!=='request') return jsonResponse_(invalidRequest_());
    return jsonResponse_(requestResponse_(parsed.payload,baseConfig.config));
  } catch(error){ logTechnical_('POST_INTERNAL',requestId); return jsonResponse_(response_(false,'INTERNAL_ERROR','Não foi possível processar a solicitação.',requestId)); }
}
function invalidRequest_(){ return response_(false,'INVALID_REQUEST','Solicitação inválida.'); }
function healthResponse_(){ var c=loadConfig_(); return {ok:true,code:'HEALTH_OK',message:'Serviço de diagnóstico disponível.',service:SERVICE_NAME,version:SERVICE_VERSION,configured:c.ok,timestamp:new Date().toISOString()}; }
function availabilityResponse_(dateText){
  var r=loadConfig_(); if(!r.ok)return response_(false,'CONFIGURATION_REQUIRED','A integração ainda não foi configurada.'); var c=r.config,d=validateDate_(dateText,c.timezone,true); if(!d.ok)return invalidRequest_();
  var calendar=CalendarApp.getCalendarById(c.calendarId); if(!calendar)return response_(false,'CONFIGURATION_REQUIRED','A agenda configurada não está disponível.'); var available=[],unavailable=[];
  c.allowedStartTimes.forEach(function(time){var interval=createInterval_(dateText,time,c); if(intervalHasStarted_(interval)){unavailable.push(time);return;} (calendar.getEvents(interval.start,interval.end).length?unavailable:available).push(time);});
  return response_(true,'AVAILABILITY_OK','Disponibilidade consultada.',null,{date:dateText,available:available,unavailable:unavailable});
}
function requestResponse_(payload, suppliedConfig){
  var r=suppliedConfig?{ok:true,config:suppliedConfig}:loadConfig_(); if(!r.ok)return response_(false,'CONFIGURATION_REQUIRED','A integração ainda não foi configurada.'); var c=r.config,v=validateRequest_(payload,c); if(!v.ok)return invalidRequest_(); var clean=v.value,requestId=clean.requestId||Utilities.getUuid();
  var calendar=CalendarApp.getCalendarById(c.calendarId); if(!calendar)return response_(false,'CONFIGURATION_REQUIRED','A agenda configurada não está disponível.');
  var lock=LockService.getScriptLock(); if(!lock.tryLock(LOCK_TIMEOUT_MS))return response_(false,'LOCK_TIMEOUT','A agenda está ocupada. Tente novamente em instantes.',requestId);
  try {
    // A idempotência vem antes da contagem: uma repetição legítima não é novo abuso.
    if(requestIdExists_(calendar,requestId,c))return response_(true,'REQUEST_CREATED','Esta solicitação já havia sido registrada para revisão.',requestId);
    if(!consumeRateLimit_(clean.whatsapp,c))return response_(false,'RATE_LIMITED','Muitas solicitações foram recebidas. Aguarde antes de tentar novamente.',requestId);
    var interval=createInterval_(clean.date,clean.time,c); if(intervalHasStarted_(interval))return response_(false,'SLOT_UNAVAILABLE','O horário selecionado não está disponível.',requestId);
    if(calendar.getEvents(interval.start,interval.end).length)return response_(false,'SLOT_UNAVAILABLE','O horário selecionado não está mais disponível.',requestId);
    var title=c.pendingPrefix+' '+singleLine_(clean.petName)+' — '+singleLine_(clean.serviceId);
    var description=['Responsável: '+singleLine_(clean.responsibleName),'WhatsApp: '+clean.whatsapp,'Pet: '+singleLine_(clean.petName),'Serviço: '+singleLine_(clean.serviceId),'Região: '+singleLine_(clean.region),'Observações: '+clean.notes,'requestId: '+requestId,'Criada em: '+new Date().toISOString()].join('\n');
    calendar.createEvent(title,interval.start,interval.end,{description:description}); return response_(true,'REQUEST_CREATED','Solicitação criada como pendente para revisão.',requestId);
  } finally { lock.releaseLock(); }
}
function loadConfig_(){
  var p=PropertiesService.getScriptProperties().getProperties(); for(var i=0;i<REQUIRED_PROPERTIES.length;i++)if(typeof p[REQUIRED_PROPERTIES[i]]!=='string'||!p[REQUIRED_PROPERTIES[i]].trim())return {ok:false};
  try { var duration=Number(p.SLOT_DURATION_MINUTES),times=JSON.parse(p.ALLOWED_START_TIMES_JSON),services=JSON.parse(p.ALLOWED_SERVICE_IDS_JSON),maxBytes=Number(p.MAX_REQUEST_BYTES),window=Number(p.RATE_LIMIT_WINDOW_MINUTES),maximum=Number(p.RATE_LIMIT_MAX_REQUESTS),retention=Number(p.PENDING_RETENTION_DAYS);
    if(!Number.isInteger(duration)||duration<1||duration>1440||!Number.isInteger(maxBytes)||maxBytes<256||maxBytes>1000000||!Number.isInteger(window)||window<1||window>360||!Number.isInteger(maximum)||maximum<1||maximum>1000||!Number.isInteger(retention)||retention<1||retention>3650)return {ok:false};
    if(!Array.isArray(times)||!times.length||times.some(function(x){return !isValidTime_(x);})||new Set(times).size!==times.length)return {ok:false};
    if(!Array.isArray(services)||!services.length||services.some(function(x){return typeof x!=='string'||!x.trim()||x.length>80||hasControlCharacters_(x);}))return {ok:false};
    if(p.PENDING_EVENT_PREFIX.length>40||hasControlCharacters_(p.PENDING_EVENT_PREFIX)||p.PRIVACY_POLICY_VERSION.length>80||hasControlCharacters_(p.PRIVACY_POLICY_VERSION)||p.RATE_LIMIT_SALT.length<8)return {ok:false}; Utilities.formatDate(new Date(),p.TIMEZONE,'yyyy-MM-dd'); if(!normalizeWhatsapp_(p.WHATSAPP_NUMBER))return {ok:false};
    return {ok:true,config:{calendarId:p.CALENDAR_ID,timezone:p.TIMEZONE,slotDurationMinutes:duration,allowedStartTimes:times,allowedServiceIds:services,pendingPrefix:p.PENDING_EVENT_PREFIX,privacyPolicyVersion:p.PRIVACY_POLICY_VERSION,maxRequestBytes:maxBytes,rateLimitWindowMinutes:window,rateLimitMaxRequests:maximum,rateLimitSalt:p.RATE_LIMIT_SALT,pendingRetentionDays:retention}};
  }catch(error){return {ok:false};}
}
function validateRequest_(payload,c){
  if(!payload||Object.keys(payload).some(function(k){return ALLOWED_POST_FIELDS.indexOf(k)===-1;}))return {ok:false}; if(String(payload.honeypot||'').trim())return {ok:false};
  var required=['serviceId','date','time','responsibleName','whatsapp','petName','region','privacyPolicyVersion']; for(var i=0;i<required.length;i++)if(typeof payload[required[i]]!=='string'||!payload[required[i]].trim())return {ok:false};
  if(payload.reviewAccepted!==true&&payload.reviewAccepted!=='true')return {ok:false}; if(payload.privacyAccepted!==true&&payload.privacyAccepted!=='true')return {ok:false}; if(payload.privacyPolicyVersion!==c.privacyPolicyVersion)return {ok:false};
  var fields=['serviceId','responsibleName','whatsapp','petName','region','notes','privacyPolicyVersion']; for(var j=0;j<fields.length;j++){var value=String(payload[fields[j]]||'').trim(); if(value.length>TEXT_LIMITS[fields[j]]||hasControlCharacters_(value))return {ok:false};}
  if(c.allowedServiceIds.indexOf(payload.serviceId.trim())<0||!isValidTime_(payload.time)||c.allowedStartTimes.indexOf(payload.time)<0||!validateDate_(payload.date,c.timezone,true).ok)return {ok:false}; var phone=normalizeWhatsapp_(payload.whatsapp); if(!phone)return {ok:false}; var id=String(payload.requestId||'').trim(); if(id&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return {ok:false};
  return {ok:true,value:{serviceId:payload.serviceId.trim(),date:payload.date,time:payload.time,responsibleName:payload.responsibleName.trim(),whatsapp:phone,petName:payload.petName.trim(),region:payload.region.trim(),notes:String(payload.notes||'').trim(),requestId:id}};
}
function parsePostPayload_(e,maxBytes){ if(!e||!e.postData||typeof e.postData.contents!=='string'||!e.postData.contents)return {ok:false}; var type=String(e.postData.type||'').toLowerCase(); if(!/^application\/x-www-form-urlencoded(?:\s*;\s*charset=[a-z0-9._-]+)?$/.test(type))return {ok:false}; if(Utilities.newBlob(e.postData.contents).getBytes().length>maxBytes)return {ok:false}; var p=e.parameter||{}; if(Object.keys(p).some(function(k){return ALLOWED_POST_FIELDS.indexOf(k)<0;}))return {ok:false}; return {ok:true,payload:p}; }
function rateLimitKey_(phone,c){var bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,c.rateLimitSalt+':'+phone,Utilities.Charset.UTF_8);return 'rate:'+bytes.map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');}
function consumeRateLimit_(phone,c){var cache=CacheService.getScriptCache(),key=rateLimitKey_(phone,c),count=Number(cache.get(key)||'0');if(count>=c.rateLimitMaxRequests)return false;cache.put(key,String(count+1),c.rateLimitWindowMinutes*60);return true;}
function validateDate_(text,tz,range){if(typeof text!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(text))return {ok:false};try{var d=Utilities.parseDate(text+' 12:00',tz,'yyyy-MM-dd HH:mm');if(Utilities.formatDate(d,tz,'yyyy-MM-dd')!==text)return {ok:false};if(range){var today=Utilities.parseDate(Utilities.formatDate(new Date(),tz,'yyyy-MM-dd')+' 12:00',tz,'yyyy-MM-dd HH:mm'),days=Math.round((d-today)/86400000);if(days<0||days>MAX_FUTURE_DAYS)return {ok:false};}return {ok:true,date:d};}catch(error){return {ok:false};}}
function isValidTime_(x){return typeof x==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(x);} function normalizeWhatsapp_(x){if(typeof x!=='string'||hasControlCharacters_(x))return '';var d=x.replace(/\D/g,'');return /^\d{10,15}$/.test(d)?d:'';} function hasControlCharacters_(x){return /[\u0000-\u001F\u007F]/.test(x);} function singleLine_(x){return String(x).replace(/[\r\n]+/g,' ').trim();}
function createInterval_(date,time,c){var start=Utilities.parseDate(date+' '+time,c.timezone,'yyyy-MM-dd HH:mm');return {start:start,end:new Date(start.getTime()+c.slotDurationMinutes*60000)};} function now_(){return new Date();} function intervalHasStarted_(x){return x.start.getTime()<=now_().getTime();}
function hasRequestId_(events,id){var marker='requestId: '+id;return events.some(function(e){return e.getDescription().indexOf(marker)>=0;});} function requestIdExists_(calendar,id,c){if(!id)return false;var start=Utilities.parseDate(Utilities.formatDate(new Date(),c.timezone,'yyyy-MM-dd')+' 00:00',c.timezone,'yyyy-MM-dd HH:mm');return hasRequestId_(calendar.getEvents(start,new Date(start.getTime()+(MAX_FUTURE_DAYS+2)*86400000),{search:id}),id);}
function previewExpiredPendingEvents(){var r=loadConfig_();if(!r.ok)return {ok:false,code:'CONFIGURATION_REQUIRED',total:0,eventIds:[]};var c=r.config,cutoff=new Date(now_().getTime()-c.pendingRetentionDays*86400000),events=CalendarApp.getCalendarById(c.calendarId).getEvents(new Date(0),cutoff);var ids=events.filter(function(e){return e.getTitle().indexOf(c.pendingPrefix)===0;}).map(function(e){return e.getId();});return {ok:true,code:'RETENTION_PREVIEW',total:ids.length,eventIds:ids};}
function cleanupExpiredPendingEvents(confirmCleanup){var preview=previewExpiredPendingEvents();if(!preview.ok||confirmCleanup!==true)return {ok:preview.ok,code:confirmCleanup===true?preview.code:'CLEANUP_CONFIRMATION_REQUIRED',total:preview.total,removed:0,eventIds:preview.eventIds};var r=loadConfig_(),c=r.config,calendar=CalendarApp.getCalendarById(c.calendarId),allowed=new Set(preview.eventIds),removed=0;calendar.getEvents(new Date(0),new Date(now_().getTime()-c.pendingRetentionDays*86400000)).forEach(function(e){if(allowed.has(e.getId())&&e.getTitle().indexOf(c.pendingPrefix)===0){e.deleteEvent();removed++;}});return {ok:true,code:'CLEANUP_COMPLETE',total:preview.total,removed:removed,eventIds:preview.eventIds};}
function getParameter_(e,n){return e&&e.parameter&&typeof e.parameter[n]==='string'?e.parameter[n]:'';} function response_(ok,code,message,id,data){var x={ok:ok,code:code,message:message};if(id)x.requestId=id;if(data!==undefined)x.data=data;return x;} function jsonResponse_(p){return ContentService.createTextOutput(JSON.stringify(p)).setMimeType(ContentService.MimeType.JSON);} function logTechnical_(code,id){console.error(code+(id?' requestId='+id:''));}
/** Retorna exemplos fictícios; não salva nem registra propriedades. */
function setupExampleProperties(){return {CALENDAR_ID:'agenda-ficticia@example.invalid',TIMEZONE:'Etc/UTC',SLOT_DURATION_MINUTES:'60',ALLOWED_START_TIMES_JSON:'["09:00"]',ALLOWED_SERVICE_IDS_JSON:'["servico-exemplo"]',PENDING_EVENT_PREFIX:'[PENDENTE]',WHATSAPP_NUMBER:'5500000000000',PRIVACY_POLICY_VERSION:'versao-ficticia',MAX_REQUEST_BYTES:'8192',RATE_LIMIT_WINDOW_MINUTES:'15',RATE_LIMIT_MAX_REQUESTS:'3',RATE_LIMIT_SALT:'sal-ficticio-substituir',PENDING_RETENTION_DAYS:'30'};}
