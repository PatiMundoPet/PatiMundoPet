(function () {
  'use strict';
  var form = document.getElementById('schedule-form');
  var inactive = document.getElementById('schedule-inactive');
  if (!form || !inactive) return;
  var integration = { mode: 'demo', webAppUrl: '', messages: {} };
  try { integration = JSON.parse(document.getElementById('scheduling-integration-config').textContent); } catch (error) { /* configuração inválida permanece inativa */ }
  var api = window.SchedulingApi;
  var live = Boolean(api && integration.mode === 'live' && integration.webAppUrl && api.validateConfig(integration).valid);
  if (!live) { form.hidden = true; inactive.hidden = false; return; }

  var client = api.createClient(integration);
  var summaryPanel = document.getElementById('schedule-review');
  var summary = document.getElementById('schedule-summary');
  var validation = document.getElementById('schedule-validation');
  var notice = document.getElementById('schedule-final-notice');
  var status = document.getElementById('schedule-availability-status');
  var dates = document.getElementById('schedule-live-dates');
  var times = document.getElementById('schedule-live-times');
  var fallback = document.getElementById('schedule-whatsapp-fallback');
  var availabilityContact = document.getElementById('schedule-availability-contact');
  var copyText = document.getElementById('schedule-copy-text');
  var sending = false;
  var selectedDate = '';
  var availabilitySequence = 0;
  var today = new Date();
  today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  var maximum = api.addCalendarDays(today, integration.maxFutureDays);
  var cursor = new Date(today.getFullYear(), today.getMonth(), 1);
  var labels = { serviceId: 'Serviço', date: 'Data solicitada', time: 'Horário solicitado', responsibleName: 'Responsável', whatsapp: 'WhatsApp', email: 'E-mail', petName: 'Pet', region: 'Região', notes: 'Observações', submissionChannel: 'Canal escolhido' };

  inactive.hidden = true; form.hidden = false;
  function selected(name) { return form.querySelector('input[name="' + name + '"]:checked'); }
  function selectedValue(name) { var item = selected(name); return item ? item.value : ''; }
  function value(name) { var field = form.elements[name]; return field && typeof field.value === 'string' ? field.value.trim() : ''; }
  function cleanText(text, limit) { return String(text || '').replace(/[\u0000-\u001f\u007f]/g, function (character) { return character === '\n' || character === '\r' ? '\n' : ''; }).replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, limit); }
  function validEmail(email) { return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
  function validPhone(phone) { return /^\d{10,15}$/.test(phone.replace(/\D/g, '')); }
  function setError(name, message) { var field = form.elements[name]; var target = document.getElementById('error-' + name); if (field && field.setAttribute) field.setAttribute('aria-invalid', message ? 'true' : 'false'); if (target) target.textContent = message; }
  function payload(channel) { return { serviceId: selectedValue('servico'), date: selectedDate, time: selectedValue('horario'), responsibleName: value('responsavel'), whatsapp: value('whatsapp'), email: value('email'), petName: value('pet'), region: value('regiao'), notes: value('observacoes'), submissionChannel: channel, reviewAccepted: form.elements.revisao.checked, privacyAccepted: form.elements.privacyAccepted.checked, privacyPolicyVersion: form.dataset.privacyPolicyVersion, honeypot: '' }; }
  function validate(data) {
    var errors = [];
    ['serviceId','date','time','responsibleName','petName','region'].forEach(function (key) { if (!data[key]) errors.push(labels[key]); });
    if (!data.whatsapp && !data.email) errors.push('pelo menos um contato');
    if (data.whatsapp && !validPhone(data.whatsapp)) { errors.push('WhatsApp válido'); setError('whatsapp', 'Informe entre 10 e 15 dígitos.'); } else setError('whatsapp', '');
    if (data.email && !validEmail(data.email)) { errors.push('e-mail válido'); setError('email', 'Informe um endereço de e-mail válido.'); } else setError('email', '');
    if (data.submissionChannel === 'whatsapp' && !validPhone(data.whatsapp)) errors.push('WhatsApp para o canal escolhido');
    if (data.submissionChannel === 'email' && !validEmail(data.email)) errors.push('e-mail para o canal escolhido');
    if (!data.reviewAccepted) errors.push('confirmação de revisão');
    if (!data.privacyAccepted) errors.push('consentimento de privacidade');
    validation.textContent = errors.length ? 'Revise: ' + Array.from(new Set(errors)).join(', ') + '.' : '';
    return !errors.length;
  }
  function renderSummary(channel) {
    var data = payload(channel || '');
    var minimum = data.serviceId && data.date && data.time && data.responsibleName && data.petName && data.region && (validPhone(data.whatsapp) || validEmail(data.email));
    summaryPanel.hidden = !minimum; if (!minimum) { summary.replaceChildren(); return; }
    var values = { serviceId: selected('servico').dataset.label || data.serviceId, date: data.date, time: data.time, responsibleName: data.responsibleName, whatsapp: data.whatsapp, email: data.email, petName: data.petName, region: data.region, notes: data.notes, submissionChannel: channel === 'email' ? 'E-mail' : channel === 'whatsapp' ? 'WhatsApp' : '' };
    var list = document.createElement('dl'); list.className = 'schedule-summary-list';
    Object.keys(values).forEach(function (key) { if (!values[key]) return; var dt=document.createElement('dt'),dd=document.createElement('dd'); dt.textContent=labels[key]; dd.textContent=values[key]; list.append(dt,dd); }); summary.replaceChildren(list);
  }
  function renderTimes(data) {
    times.replaceChildren(); data.available.concat(data.unavailable).sort().forEach(function (time) { var enabled=data.available.indexOf(time)>=0,label=document.createElement('label'),input=document.createElement('input'),span=document.createElement('span'); label.className='schedule-choice'+(enabled?'':' is-unavailable'); input.type='radio'; input.name='horario'; input.value=time; input.disabled=!enabled; input.setAttribute('aria-label',(enabled?'Horário disponível ':'Horário indisponível ')+time); span.textContent=time; label.append(input,span); times.append(label); });
  }
  function setAvailabilityMessage(message, showContact) { status.textContent=message; availabilityContact.hidden=!showContact; }
  function loadDate(date, button) {
    var sequence=++availabilitySequence;
    setAvailabilityMessage(integration.messages.loading, false); times.replaceChildren();
    button.classList.add('is-loading'); button.setAttribute('aria-busy','true');
    client.availability(date).then(function(result){
      if(sequence!==availabilitySequence)return;
      if(!result.ok){setAvailabilityMessage(integration.messages.unavailable,true);return;}
      renderTimes(result.data);
      setAvailabilityMessage(result.data.available.length?'Selecione um horário disponível.':integration.messages.noAvailability,!result.data.available.length);
    }).catch(function(){if(sequence===availabilitySequence)setAvailabilityMessage(integration.messages.unavailable,true);})
      .finally(function(){button.classList.remove('is-loading');button.removeAttribute('aria-busy');});
  }
  function prepareCalendar() {
    document.getElementById('schedule-month-label').textContent=cursor.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
    dates.replaceChildren(); for(var day=new Date(cursor);day.getMonth()===cursor.getMonth();day.setDate(day.getDate()+1)){ var date=api.formatCalendarDate(day), button=document.createElement('button'); button.type='button'; button.textContent=String(day.getDate()); button.disabled=day<today||day>maximum; button.setAttribute('aria-label',(button.disabled?'Data indisponível ':'Consultar disponibilidade em ')+date); button.dataset.date=date; if(date===selectedDate)button.setAttribute('aria-pressed','true'); dates.append(button); }
    document.getElementById('schedule-previous-month').disabled=cursor<=new Date(today.getFullYear(),today.getMonth(),1);
    document.getElementById('schedule-next-month').disabled=new Date(cursor.getFullYear(),cursor.getMonth()+1,1)>maximum;
  }
  dates.addEventListener('click',function(event){ if(event.target.tagName!=='BUTTON'||event.target.disabled)return; selectedDate=event.target.dataset.date; dates.querySelectorAll('button').forEach(function(button){button.setAttribute('aria-pressed',String(button===event.target));}); loadDate(selectedDate,event.target); renderSummary(''); });
  document.getElementById('schedule-previous-month').addEventListener('click',function(){cursor=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);prepareCalendar();});
  document.getElementById('schedule-next-month').addEventListener('click',function(){cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);prepareCalendar();});
  form.addEventListener('input',function(){ validation.textContent=''; notice.classList.remove('is-visible'); renderSummary(''); });
  function whatsappMessage(data, requestId) { var rows=[form.dataset.projectName,'Código: '+cleanText(requestId,36),'Status: PENDENTE','Responsável: '+cleanText(data.responsibleName,120),'Pet: '+cleanText(data.petName,80),'Serviço: '+cleanText(selected('servico').dataset.label||data.serviceId,80),'Data solicitada: '+cleanText(data.date,10),'Horário solicitado: '+cleanText(data.time,5),'Região: '+cleanText(data.region,120)]; if(data.notes)rows.push('Observações: '+cleanText(data.notes,500)); rows.push('Esta é uma pré-solicitação pendente e ainda depende da confirmação da '+form.dataset.professionalName+'.'); return rows.join('\n'); }
  form.addEventListener('submit',async function(event){ event.preventDefault(); if(sending)return; var channel=event.submitter&&event.submitter.value; if(channel!=='whatsapp'&&channel!=='email')return; var data=payload(channel); renderSummary(channel); if(!validate(data))return; sending=true; form.querySelectorAll('button[type="submit"]').forEach(function(button){button.disabled=true;});
    try { var result=await client.request(data); if(result.code!=='REQUEST_CREATED'){notice.textContent=result.message||integration.messages.unavailable;notice.classList.add('is-visible');return;} notice.textContent=integration.messages.pendingCreated+' Código: '+result.requestId+'. Status: PENDENTE.'; notice.classList.add('is-visible');
      if(channel==='whatsapp'){ var message=whatsappMessage(data,result.requestId),digits=form.dataset.whatsappNumber.replace(/\D/g,''); copyText.value=message; fallback.hidden=false; notice.textContent+=' O WhatsApp será aberto com a ficha preenchida; toque em Enviar dentro do aplicativo.'; if(digits) window.location.assign('https://wa.me/'+digits+'?text='+encodeURIComponent(message)); }
      else if(result.notificationStatus==='SENT') notice.textContent+=' A notificação administrativa foi enviada.'; else if(result.notificationStatus==='FAILED') notice.textContent+=' '+integration.messages.emailFailed;
    } catch(error){ notice.textContent=integration.messages.unavailable; notice.classList.add('is-visible'); }
    finally {sending=false;form.querySelectorAll('button[type="submit"]').forEach(function(button){button.disabled=false;});}
  });
  document.getElementById('schedule-copy-button').addEventListener('click',function(){ navigator.clipboard.writeText(copyText.value).then(function(){notice.textContent='Ficha copiada.';}); });
  prepareCalendar();
})();
