  // ---------- Menu mobile ----------
  (function () {
    var toggle = document.getElementById('menu-toggle');
    var menu = document.getElementById('mobile-menu');
    var iconMenu = document.getElementById('icon-menu');
    var iconClose = document.getElementById('icon-close');
    if (!toggle || !menu || !iconMenu || !iconClose) return;

    var open = false;

    function setMenu(next) {
      open = next;
      menu.classList.toggle('is-open', open);
      iconMenu.classList.toggle('hidden', open);
      iconClose.classList.toggle('hidden', !open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    }

    toggle.addEventListener('click', function () { setMenu(!open); });
    menu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { setMenu(false); });
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && open) { setMenu(false); toggle.focus(); }
    });

    // Mantém os dois formatos coerentes entre si: se a janela crescer e
    // cruzar o breakpoint "desktop" (1024px, o mesmo "lg" do Tailwind)
    // enquanto o menu mobile estiver aberto, ele fecha sozinho — evitando
    // que os dois formatos fiquem sobrepostos ou travados um no outro.
    var desktopQuery = window.matchMedia('(min-width: 1024px)');
    function syncWithBreakpoint(e) {
      if (e.matches && open) setMenu(false);
    }
    if (desktopQuery.addEventListener) {
      desktopQuery.addEventListener('change', syncWithBreakpoint);
    } else if (desktopQuery.addListener) {
      desktopQuery.addListener(syncWithBreakpoint);
    }
  })();


  // ---------- Scroll reveal ----------
  (function () {
    var els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) return;

    var io;
    try {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 });
    } catch (error) {
      return;
    }

    els.forEach(function (el) {
      try {
        io.observe(el);
        el.classList.add('is-reveal-pending');
      } catch (error) {
        // Se o registro falhar, o estado visível padrão é preservado.
      }
    });
  })();

  // ---------- Profundidade no scroll (parallax discreto) ----------
  (function () {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(min-width: 768px)').matches) return; // no celular, fica desligado por desempenho
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));
    if (!els.length) return;

    var ticking = false;
    function update() {
      var viewportCenter = window.innerHeight / 2;
      els.forEach(function (el) {
        var rect = el.getBoundingClientRect();
        var distance = (rect.top + rect.height / 2) - viewportCenter;
        var factor = parseFloat(el.getAttribute('data-parallax')) || 0;
        el.style.transform = 'translate3d(0,' + (distance * factor).toFixed(1) + 'px,0)';
      });
      ticking = false;
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  })();

  // ---------- Cards com brilho/inclinação que seguem o mouse ----------
  (function () {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var cards = Array.prototype.slice.call(document.querySelectorAll('.tilt-card'));
    if (!cards.length) return;

    cards.forEach(function (card) {
      card.addEventListener('pointermove', function (event) {
        var rect = card.getBoundingClientRect();
        var x = (event.clientX - rect.left) / rect.width;
        var y = (event.clientY - rect.top) / rect.height;
        var rotateX = (0.5 - y) * 6;
        var rotateY = (x - 0.5) * 6;
        card.style.transform = 'perspective(900px) rotateX(' + rotateX.toFixed(2) + 'deg) rotateY(' + rotateY.toFixed(2) + 'deg)';
        card.style.setProperty('--glow-x', (x * 100).toFixed(1) + '%');
        card.style.setProperty('--glow-y', (y * 100).toFixed(1) + '%');
      });
      card.addEventListener('pointerleave', function () {
        card.style.transform = '';
      });
    });
  })();

  // ---------- Cursor personalizado: pegadinha que acompanha o mouse ----------
  (function () {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var paw = document.getElementById('cursor-paw');
    if (!paw) return;

    var targetX = -100, targetY = -100, x = -100, y = -100, active = false, ticking = false;

    function step() {
      x += (targetX - x) * 0.18;
      y += (targetY - y) * 0.18;
      paw.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) translate(-50%,-50%)';
      if (Math.abs(targetX - x) > 0.5 || Math.abs(targetY - y) > 0.5) {
        requestAnimationFrame(step);
      } else {
        ticking = false;
      }
    }

    document.addEventListener('mousemove', function (event) {
      targetX = event.clientX;
      targetY = event.clientY;
      if (!active) { active = true; paw.classList.add('is-active'); }
      if (!ticking) { ticking = true; requestAnimationFrame(step); }
    });
    document.addEventListener('mouseleave', function () { paw.classList.remove('is-active'); });
  })();

  // ---------- Galeria: visualizador de fotos ----------
  (function () {
    var items = Array.prototype.slice.call(document.querySelectorAll('.gallery-item'));
    var dialog = document.getElementById('gallery-lightbox');
    var image = document.getElementById('gallery-lightbox-image');
    var closeButton = document.getElementById('gallery-close');
    var prevButton = document.getElementById('gallery-prev');
    var nextButton = document.getElementById('gallery-next');
    if (!items.length || !dialog || !image || !closeButton || !prevButton || !nextButton) return;
    if (typeof dialog.showModal !== 'function') return; // sem suporte: fotos continuam visíveis na grade, só não ampliam

    var current = -1;
    var trigger = null;

    function show(index) {
      current = (index + items.length) % items.length;
      var item = items[current];
      var thumb = item.querySelector('img');
      image.src = item.getAttribute('data-full');
      image.alt = thumb ? thumb.getAttribute('alt') : '';
    }

    function open(index, originButton) {
      trigger = originButton || null;
      show(index);
      if (!dialog.open) dialog.showModal();
    }

    function close() {
      if (dialog.open) dialog.close();
    }

    items.forEach(function (item, index) {
      item.addEventListener('click', function () { open(index, item); });
    });

    closeButton.addEventListener('click', close);
    prevButton.addEventListener('click', function () { show(current - 1); });
    nextButton.addEventListener('click', function () { show(current + 1); });

    // Clique fora da foto (no backdrop) fecha; clique na própria foto ou nos controles, não.
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) close();
    });

    dialog.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') { event.preventDefault(); show(current - 1); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); show(current + 1); }
    });

    // Esc já fecha nativamente (evento "cancel" do <dialog>); aqui só devolvemos o foco.
    dialog.addEventListener('close', function () {
      if (trigger) { trigger.focus(); trigger = null; }
    });
  })();

  // ---------- Loader (tela de abertura) ----------
  (function () {
    var loader = document.getElementById('site-loader');
    var htmlEl = document.documentElement;
    if (!loader) return;

    var done = false;
    function hideLoader() {
      if (done) return;
      done = true;
      // Remove via style inline — funciona em QUALQUER browser/WebView/celular
      loader.style.cssText = 'display:none!important';
      htmlEl.style.overflow = '';
      document.body && (document.body.style.overflow = '');
      try { loader.parentNode && loader.parentNode.removeChild(loader); } catch(e) {}
    }

    // Dispara no máximo em 1s — independente de fonte, rede ou evento
    setTimeout(hideLoader, 1000);
    if (document.readyState === 'complete') {
      hideLoader();
    } else {
      document.addEventListener('DOMContentLoaded', function() { setTimeout(hideLoader, 300); });
      window.addEventListener('load', hideLoader);
    }
  })();
