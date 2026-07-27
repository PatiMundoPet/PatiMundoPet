(function () {
  'use strict';

  var form = document.getElementById('schedule-form');
  if (!form) return;
  var summary = document.getElementById('schedule-summary');
  var validation = document.getElementById('schedule-validation');
  var finalNotice = document.getElementById('schedule-final-notice');
  var confirmation = document.getElementById('schedule-review-confirmation');
  var submit = form.querySelector('[type="submit"]');
  var whatsappLink = document.getElementById('schedule-whatsapp-success');
  var availabilityStatus = document.getElementById('schedule-availability-status');
  var liveDate = document.getElementById('schedule-live-date');
  var liveTimes = document.getElementById('schedule-live-times');
  if (!summary || !validation || !finalNotice || !confirmation || !submit) return;

  var integration = { mode: 'demo', webAppUrl: '', messages: {} };
  try {
    var parsed = JSON.parse(document.getElementById('scheduling-integration-config').textContent);
    if (parsed && typeof parsed === 'object') integration = parsed;
  } catch (error) { /* configuração inválida é tratada sem revelar detalhes */ }
  var api = window.SchedulingApi;
  var client = api && api.createClient(integration);
  var live = Boolean(client && integration.mode === 'live' && client.configStatus.valid);
  var loading = false;
  var sending = false;

  var labels = { servico: 'Serviço', data: 'Data', horario: 'Horário', responsavel: 'Responsável', whatsapp: 'WhatsApp', pet: 'Pet', regiao: 'Bairro ou região', observacoes: 'Observações' };

  function selectedInput(name) { return form.querySelector('input[name="' + name + '"]:checked'); }
  function selectedValue(name) { var item = selectedInput(name); return item ? item.value : ''; }
  function selectedLabel(name) { var item = selectedInput(name); return item ? (item.dataset.label || item.value) : ''; }
  function fieldValue(name) { var field = form.elements[name]; return field && typeof field.value === 'string' ? field.value.trim() : ''; }
  function setFieldError(name, message) {
    var field = form.elements[name];
    var error = document.getElementById('error-' + name);
    if (field && field.setAttribute) field.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (error) error.textContent = message;
  }
  function showNotice(message) { finalNotice.textContent = message; finalNotice.classList.add('is-visible'); finalNotice.focus(); }

  function validate() {
    var missing = [];
    ['servico', 'data', 'horario'].forEach(function (name) { if (!selectedValue(name)) missing.push(labels[name]); });
    ['responsavel', 'whatsapp', 'pet', 'regiao'].forEach(function (name) {
      var empty = !fieldValue(name); setFieldError(name, empty ? 'Preencha este campo obrigatório.' : ''); if (empty) missing.push(labels[name]);
    });
    var phone = fieldValue('whatsapp');
    if (phone && phone.replace(/\D/g, '').length < 10) { setFieldError('whatsapp', 'Informe um WhatsApp com pelo menos 10 dígitos.'); missing.push('WhatsApp válido'); }
    setFieldError('revisao', confirmation.checked ? '' : 'Marque a confirmação de revisão.');
    if (!confirmation.checked) missing.push('Confirmação de revisão');
    if (loading) missing.push('Conclusão da consulta de disponibilidade');
    validation.textContent = missing.length ? 'Revise: ' + missing.join(', ') + '.' : '';
    return !missing.length;
  }

  function appendSummaryItem(list, name, value) {
    var term = document.createElement('dt'); var detail = document.createElement('dd');
    term.textContent = labels[name]; detail.textContent = value || 'Não informado'; list.appendChild(term); list.appendChild(detail);
  }
  function renderSummary() {
    var list = document.createElement('dl'); list.className = 'schedule-summary-list';
    appendSummaryItem(list, 'servico', selectedLabel('servico'));
    appendSummaryItem(list, 'data', selectedLabel('data'));
    appendSummaryItem(list, 'horario', selectedLabel('horario'));
    ['responsavel', 'whatsapp', 'pet', 'regiao', 'observacoes'].forEach(function (name) { appendSummaryItem(list, name, fieldValue(name)); });
    summary.replaceChildren(list);
  }
  function updateChoiceStates(name) {
    form.querySelectorAll('input[name="' + name + '"]').forEach(function (input) {
      var choice = input.closest('.schedule-choice'); var state = choice && choice.querySelector('small');
      if (choice && state && !input.disabled) state.textContent = input.checked ? choice.dataset.selectedLabel : choice.dataset.availableLabel;
    });
  }
  function renderTimes(data) {
    liveTimes.replaceChildren();
    data.available.concat(data.unavailable).sort().forEach(function (time) {
      var available = data.available.indexOf(time) !== -1;
      var choice = document.createElement('label'); choice.className = 'schedule-choice' + (available ? '' : ' is-unavailable');
      choice.dataset.availableLabel = available ? 'Disponível' : 'Indisponível'; choice.dataset.selectedLabel = 'Selecionado';
      var input = document.createElement('input'); input.type = 'radio'; input.name = 'horario'; input.value = time; input.dataset.label = time; input.required = true; input.disabled = !available;
      var span = document.createElement('span'); span.textContent = time; var small = document.createElement('small'); small.textContent = choice.dataset.availableLabel;
      span.appendChild(small); choice.appendChild(input); choice.appendChild(span); liveTimes.appendChild(choice);
    });
  }
  async function loadAvailability() {
    liveTimes.replaceChildren(); loading = true; submit.disabled = true; availabilityStatus.textContent = integration.messages.loading;
    try {
      var result = await client.availability(liveDate.value);
      if (!result.ok) { availabilityStatus.textContent = result.message; return; }
      renderTimes(result.data); availabilityStatus.textContent = result.data.available.length ? 'Selecione um dos horários disponíveis.' : integration.messages.noAvailability;
    } catch (error) {
      availabilityStatus.textContent = error.message === 'INVALID_RESPONSE' ? integration.messages.invalidResponse : integration.messages.unavailable;
    } finally { loading = false; submit.disabled = false; renderSummary(); }
  }

  if (live) {
    document.getElementById('schedule-demo-date-panel').hidden = true; document.getElementById('schedule-demo-time-panel').hidden = true;
    form.querySelectorAll('#schedule-demo-date-panel input, #schedule-demo-time-panel input').forEach(function (input) { input.disabled = true; });
    document.getElementById('schedule-live-date-panel').hidden = false; document.getElementById('schedule-live-time-panel').hidden = false;
    var today = new Date(); var max = new Date(today); max.setDate(max.getDate() + integration.maxFutureDays);
    liveDate.min = today.toISOString().slice(0, 10); liveDate.max = max.toISOString().slice(0, 10); liveDate.required = true;
    client.health().then(function (result) { if (!result.configured) availabilityStatus.textContent = integration.messages.unavailable; }).catch(function () { availabilityStatus.textContent = integration.messages.unavailable; });
    liveDate.addEventListener('change', function () {
      liveTimes.replaceChildren();
      var proxy = document.createElement('input'); proxy.type = 'radio'; proxy.name = 'data'; proxy.value = liveDate.value; proxy.dataset.label = liveDate.value; proxy.checked = true; proxy.hidden = true;
      form.querySelectorAll('input[name="data"]').forEach(function (item) { item.remove(); }); form.appendChild(proxy);
      if (liveDate.value) loadAvailability(); renderSummary();
    });
  } else if (integration.mode === 'live') {
    showNotice(integration.messages.liveWithoutUrl || integration.messages.unavailable);
  }

  form.addEventListener('input', function (event) {
    if (event.target && event.target.name && labels[event.target.name]) setFieldError(event.target.name, '');
    validation.textContent = ''; finalNotice.classList.remove('is-visible'); whatsappLink.hidden = true;
    if (event.target && ['servico', 'data', 'horario'].indexOf(event.target.name) !== -1) updateChoiceStates(event.target.name);
    renderSummary();
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault(); if (sending) return; finalNotice.classList.remove('is-visible'); whatsappLink.hidden = true;
    if (!validate()) { var first = form.querySelector('[aria-invalid="true"], input:invalid'); if (first) first.focus(); return; }
    renderSummary();
    if (!live) { showNotice(integration.mode === 'demo' ? integration.messages.demo : integration.messages.unavailable); return; }
    var payload = { serviceId: selectedValue('servico'), date: selectedValue('data'), time: selectedValue('horario'), responsibleName: fieldValue('responsavel'), whatsapp: fieldValue('whatsapp'), petName: fieldValue('pet'), region: fieldValue('regiao'), notes: fieldValue('observacoes'), reviewAccepted: confirmation.checked, honeypot: '' };
    sending = true; submit.disabled = true; submit.textContent = integration.messages.processing;
    try {
      var result = await client.request(payload);
      if (result.code === 'REQUEST_CREATED') {
        showNotice(integration.messages.pendingCreated + ' Identificador: ' + result.requestId + '.');
        var message = ['Solicitação pendente', 'requestId: ' + result.requestId, 'Serviço: ' + selectedLabel('servico'), 'Data: ' + payload.date, 'Horário: ' + payload.time, 'Pet: ' + payload.petName].join('\n');
        whatsappLink.href = 'https://wa.me/' + form.dataset.whatsappNumber + '?text=' + encodeURIComponent(message); whatsappLink.hidden = false;
        confirmation.checked = false;
      } else if (result.code === 'SLOT_UNAVAILABLE') {
        var chosen = selectedInput('horario'); if (chosen) chosen.checked = false;
        showNotice('Outra pessoa pode ter solicitado esse horário antes. Consulte e escolha novamente.'); await loadAvailability();
      } else showNotice(result.message || integration.messages.unavailable);
    } catch (error) {
      showNotice(error.message === 'SECURE_ID_UNAVAILABLE' ? 'Não foi possível gerar um identificador seguro. O envio foi impedido.' : integration.messages.unavailable);
    } finally { sending = false; submit.disabled = false; submit.textContent = 'Preparar solicitação'; }
  });
  renderSummary();
})();
