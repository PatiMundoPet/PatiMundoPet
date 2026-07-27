(function () {
  'use strict';

  var form = document.getElementById('schedule-form');
  if (!form) return;

  var summary = document.getElementById('schedule-summary');
  var validation = document.getElementById('schedule-validation');
  var finalNotice = document.getElementById('schedule-final-notice');
  var confirmation = document.getElementById('schedule-review-confirmation');
  if (!summary || !validation || !finalNotice || !confirmation) return;

  var labels = {
    servico: 'Serviço',
    data: 'Data demonstrativa',
    horario: 'Horário demonstrativo',
    responsavel: 'Responsável',
    whatsapp: 'WhatsApp',
    pet: 'Pet',
    regiao: 'Bairro ou região',
    observacoes: 'Observações'
  };

  function selectedValue(name) {
    var selected = form.querySelector('input[name="' + name + '"]:checked');
    return selected ? selected.value : '';
  }

  function fieldValue(name) {
    var field = form.elements[name];
    return field && typeof field.value === 'string' ? field.value.trim() : '';
  }

  function setFieldError(name, message) {
    var field = form.elements[name];
    var error = document.getElementById('error-' + name);
    if (field && field.setAttribute) field.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (error) error.textContent = message;
  }

  function validate() {
    var missing = [];
    ['servico', 'data', 'horario'].forEach(function (name) {
      if (!selectedValue(name)) missing.push(labels[name]);
    });
    ['responsavel', 'whatsapp', 'pet', 'regiao'].forEach(function (name) {
      var empty = !fieldValue(name);
      setFieldError(name, empty ? 'Preencha este campo obrigatório.' : '');
      if (empty) missing.push(labels[name]);
    });

    var phone = fieldValue('whatsapp');
    if (phone && phone.replace(/\D/g, '').length < 10) {
      setFieldError('whatsapp', 'Informe um WhatsApp com pelo menos 10 dígitos.');
      missing.push('WhatsApp válido');
    }

    setFieldError('revisao', confirmation.checked ? '' : 'Marque a confirmação de revisão.');
    if (!confirmation.checked) missing.push('Confirmação de revisão');
    validation.textContent = missing.length ? 'Revise: ' + missing.join(', ') + '.' : '';
    return missing.length === 0;
  }

  function appendSummaryItem(list, name, value) {
    var term = document.createElement('dt');
    var detail = document.createElement('dd');
    term.textContent = labels[name];
    detail.textContent = value || 'Não informado';
    list.appendChild(term);
    list.appendChild(detail);
  }

  function renderSummary() {
    var list = document.createElement('dl');
    list.className = 'schedule-summary-list';
    ['servico', 'data', 'horario'].forEach(function (name) {
      appendSummaryItem(list, name, selectedValue(name));
    });
    ['responsavel', 'whatsapp', 'pet', 'regiao', 'observacoes'].forEach(function (name) {
      appendSummaryItem(list, name, fieldValue(name));
    });
    summary.replaceChildren(list);
  }

  function updateChoiceStates(name) {
    form.querySelectorAll('input[name="' + name + '"]').forEach(function (input) {
      var choice = input.closest('.schedule-choice');
      var state = choice && choice.querySelector('small');
      if (!choice || !state || input.disabled) return;
      state.textContent = input.checked ? choice.dataset.selectedLabel : choice.dataset.availableLabel;
    });
  }

  form.addEventListener('input', function (event) {
    if (event.target && event.target.name && event.target.name in labels) {
      setFieldError(event.target.name, '');
    }
    validation.textContent = '';
    finalNotice.classList.remove('is-visible');
    if (event.target && ['servico', 'data', 'horario'].indexOf(event.target.name) !== -1) updateChoiceStates(event.target.name);
    renderSummary();
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    finalNotice.classList.remove('is-visible');
    if (!validate()) {
      var firstInvalid = form.querySelector('[aria-invalid="true"], input:invalid');
      if (firstInvalid) firstInvalid.focus();
      return;
    }
    renderSummary();
    finalNotice.classList.add('is-visible');
    finalNotice.focus();
  });
})();
