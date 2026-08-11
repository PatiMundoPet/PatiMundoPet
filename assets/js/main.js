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

  // ---------- Galeria: carrossel giratório em 3D + visualizador de fotos ----------
  // Um único componente: cada foto é ao mesmo tempo uma face do carrossel e o
  // gatilho da ampliação (lightbox). Sem JS, ou antes do boot.js rodar, é uma
  // faixa horizontal comum com rolagem por toque/scroll — 100% utilizável
  // sozinha; o giro 3D é só a melhoria por cima.
  (function () {
    var items = Array.prototype.slice.call(document.querySelectorAll('.gallery-carousel-face'));
    var dialog = document.getElementById('gallery-lightbox');
    var image = document.getElementById('gallery-lightbox-image');
    var closeButton = document.getElementById('gallery-close');
    var lightboxPrev = document.getElementById('gallery-prev');
    var lightboxNext = document.getElementById('gallery-next');
    if (!items.length || !dialog || !image || !closeButton || !lightboxPrev || !lightboxNext) return;

    // ---- Ampliação (lightbox) ----
    var current = -1;
    var trigger = null;
    var lightboxSupported = typeof dialog.showModal === 'function';

    function show(index) {
      current = (index + items.length) % items.length;
      var item = items[current];
      var thumb = item.querySelector('img');
      image.src = item.getAttribute('data-full');
      image.alt = thumb ? thumb.getAttribute('alt') : '';
    }

    function openLightbox(index, originButton) {
      if (!lightboxSupported) return; // sem suporte: fotos continuam visíveis, só não ampliam
      trigger = originButton || null;
      show(index);
      if (!dialog.open) dialog.showModal();
    }

    function closeLightbox() {
      if (dialog.open) dialog.close();
    }

    closeButton.addEventListener('click', closeLightbox);
    lightboxPrev.addEventListener('click', function () { show(current - 1); });
    lightboxNext.addEventListener('click', function () { show(current + 1); });

    // Clique fora da foto (no backdrop) fecha; clique na própria foto ou nos controles, não.
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) closeLightbox();
    });

    dialog.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') { event.preventDefault(); show(current - 1); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); show(current + 1); }
    });

    // Esc já fecha nativamente (evento "cancel" do <dialog>); aqui só devolvemos o foco.
    dialog.addEventListener('close', function () {
      if (trigger) { trigger.focus(); trigger = null; }
    });

    // ---- Carrossel 3D ----
    var carousel = document.getElementById('gallery-carousel');
    var track = document.getElementById('gallery-carousel-track');
    var viewport = track ? track.closest('.gallery-carousel-viewport') : null;
    var rotatePrev = document.getElementById('gallery-carousel-prev');
    var rotateNext = document.getElementById('gallery-carousel-next');
    var slides = track ? Array.prototype.slice.call(track.querySelectorAll('.gallery-carousel-slide')) : [];

    if (!carousel || !track || !viewport || !rotatePrev || !rotateNext || slides.length < 3) {
      // Sem os elementos do carrossel (ou fotos de menos pro giro fazer sentido):
      // cada foto ainda abre a ampliação normalmente, na faixa comum.
      items.forEach(function (item, index) {
        item.addEventListener('click', function () { openLightbox(index, item); });
      });
      return;
    }

    var reduceMotion = false;
    try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (error) { reduceMotion = false; }

    var count = slides.length;
    var step = 360 / count;
    var angle = 0; // rotação atual do cilindro, em graus
    var dragging = false;
    var pointerId = null;
    var startX = 0, startY = 0, startAngle = 0, moved = false;
    var lastPointerX = 0, lastPointerTime = 0, velocity = 0;
    var autoplayTimer = null;
    var pressedFace = null; // guardado no pointerdown, antes do setPointerCapture redirecionar o click pra track

    function faceWidthFor(viewportWidth) {
      if (viewportWidth < 480) return 210;
      if (viewportWidth < 768) return 270;
      if (viewportWidth < 1024) return 300;
      return 340;
    }

    function layout() {
      var viewportWidth = viewport.clientWidth || carousel.clientWidth || 320;
      var faceWidth = Math.min(faceWidthFor(viewportWidth), Math.round(viewportWidth * 0.68));
      var radius = Math.round((faceWidth / 2) / Math.tan(Math.PI / count));
      track.style.setProperty('--face-width', faceWidth + 'px');
      track.style.setProperty('--face-radius', radius + 'px');
      viewport.style.height = faceWidth + 'px';
      slides.forEach(function (slide, index) {
        slide.style.setProperty('--face-angle', (index * step) + 'deg');
      });
    }

    // Marca qual foto está de frente (mais perto do ângulo 0) pra ela ganhar
    // destaque visual — é o que faz o giro parecer 3D de verdade, e não uma
    // fileira de fotos do mesmo tamanho passando na frente da câmera.
    function updateFrontFace() {
      var normalized = ((angle % 360) + 360) % 360;
      var bestIndex = 0, bestDistance = Infinity;
      slides.forEach(function (slide, index) {
        var effective = (normalized + index * step) % 360;
        var distance = Math.min(effective, 360 - effective);
        if (distance < bestDistance) { bestDistance = distance; bestIndex = index; }
      });
      slides.forEach(function (slide, index) {
        slide.classList.toggle('is-front', index === bestIndex);
      });
    }

    function applyRotation() {
      track.style.transform = 'rotateY(' + angle + 'deg)';
      updateFrontFace();
    }

    function stopAutoplay() {
      if (autoplayTimer) { window.clearTimeout(autoplayTimer); autoplayTimer = null; }
    }

    function scheduleAutoplay() {
      stopAutoplay();
      if (reduceMotion) return;
      autoplayTimer = window.setTimeout(function () {
        angle -= step;
        track.style.transition = 'transform 1.1s cubic-bezier(.45,0,.2,1)';
        applyRotation();
        scheduleAutoplay();
      }, 3600);
    }

    function goToStep(delta) {
      stopAutoplay();
      angle += delta * step;
      track.style.transition = reduceMotion ? 'none' : 'transform .5s cubic-bezier(.22,1,.36,1)';
      applyRotation();
      scheduleAutoplay();
    }

    rotatePrev.addEventListener('click', function () { goToStep(1); });
    rotateNext.addEventListener('click', function () { goToStep(-1); });

    // Arrastar (mouse/toque) para girar
    track.addEventListener('pointerdown', function (event) {
      if (event.button !== undefined && event.button !== 0) return;
      dragging = true;
      moved = false;
      pressedFace = event.target.closest('.gallery-carousel-face');
      pointerId = event.pointerId;
      startX = event.clientX; startY = event.clientY; startAngle = angle;
      lastPointerX = event.clientX; lastPointerTime = event.timeStamp; velocity = 0;
      track.style.transition = 'none';
      stopAutoplay();
      try { track.setPointerCapture(pointerId); } catch (error) { /* navegador sem suporte: arrasto simples continua funcionando */ }
    });

    track.addEventListener('pointermove', function (event) {
      if (!dragging || event.pointerId !== pointerId) return;
      var dx = event.clientX - startX, dy = event.clientY - startY;
      if (!moved && Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      if (!moved && Math.abs(dy) > Math.abs(dx)) { dragging = false; return; } // gesto vertical: deixa a página rolar
      moved = true;
      var now = event.timeStamp;
      var dt = now - lastPointerTime || 16;
      velocity = ((event.clientX - lastPointerX) / dt) * 16;
      lastPointerX = event.clientX; lastPointerTime = now;
      angle = startAngle + dx * 0.28;
      applyRotation();
      event.preventDefault();
    });

    function endDrag(event) {
      if (!dragging || (pointerId !== null && event.pointerId !== pointerId)) return;
      dragging = false;
      if (moved) {
        var settled = angle + velocity * 4;
        angle = Math.round(settled / step) * step;
        track.style.transition = reduceMotion ? 'none' : 'transform .6s cubic-bezier(.22,1,.36,1)';
        applyRotation();
      }
      scheduleAutoplay();
      window.setTimeout(function () { moved = false; }, 0);
    }

    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);

    // Clique numa foto do carrossel abre a ampliação. Resolvido por índice (não
    // por listener em cada botão): o setPointerCapture do arrasto redireciona o
    // alvo do "click" pro track, então guardamos em pressedFace, no pointerdown,
    // qual foto foi realmente pressionada, antes disso acontecer.
    track.addEventListener('click', function (event) {
      var face = pressedFace;
      pressedFace = null;
      if (moved) { event.preventDefault(); return; } // era um arraste, não um clique
      if (!face) return; // clique fora de uma foto (ex.: espaço entre elas)
      var index = items.indexOf(face);
      if (index >= 0) openLightbox(index, face);
    });

    // Girar com as setas do teclado quando o foco está dentro do carrossel
    carousel.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') { event.preventDefault(); goToStep(1); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); goToStep(-1); }
    });

    carousel.addEventListener('mouseenter', stopAutoplay);
    carousel.addEventListener('mouseleave', scheduleAutoplay);
    carousel.addEventListener('focusin', stopAutoplay);
    carousel.addEventListener('focusout', scheduleAutoplay);

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () { layout(); applyRotation(); }, 150);
    });

    try {
      track.classList.add('is-enhanced');
      layout();
      applyRotation();
      scheduleAutoplay();
    } catch (error) {
      // Qualquer falha aqui e a faixa comum (rolagem por toque, clique abre a
      // ampliação) continua funcionando — nada quebra.
      track.classList.remove('is-enhanced');
      stopAutoplay();
    }
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
