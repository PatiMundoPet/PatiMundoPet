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
