/* ============================================
   모바일 결혼 알림장 - JavaScript
   박현규 ♥ 최지원
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ============================================
  // 1. ENVELOPE OPENING
  // ============================================
  const envelopeOverlay = document.getElementById('envelope-overlay');
  const mainContent = document.getElementById('main-content');
  const bgmAudio = document.getElementById('bgm-audio');
  const bgmToggle = document.getElementById('bgm-toggle');

  const envelopeContainer = document.getElementById('envelope-container');
  const heroRevealEls = document.querySelectorAll('.hero-reveal');

  function spawnSparkBurst() {
    if (!envelopeContainer) return;
    const count = 14;
    const colors = ['var(--accent-warm)', 'var(--primary)', 'var(--primary-light)'];
    for (let i = 0; i < count; i++) {
      const spark = document.createElement('div');
      spark.className = 'envelope-spark';
      const angle = (Math.PI * 2 * i) / count + (Math.random() * 0.4 - 0.2);
      const distance = 70 + Math.random() * 60;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance - 20; // bias upward
      spark.style.setProperty('--tx', `${tx}px`);
      spark.style.setProperty('--ty', `${ty}px`);
      spark.style.setProperty('--spark-color', colors[i % colors.length]);
      spark.style.setProperty('--spark-delay', `${Math.random() * 0.15}s`);
      envelopeContainer.appendChild(spark);
      spark.addEventListener('animationend', () => spark.remove());
    }
  }

  // Reveal hero content in a gentle cascade, timed to the envelope opening
  // rather than the moment it scrolls into view (it's already on screen).
  function revealHero() {
    heroRevealEls.forEach((el, i) => {
      setTimeout(() => el.classList.add('visible'), i * 130);
    });
  }

  if (envelopeOverlay) {
    envelopeOverlay.addEventListener('click', () => {
      if (envelopeOverlay.classList.contains('opening') || envelopeOverlay.classList.contains('opened')) return;

      // Phase 1: seal breaks, flap opens, then the envelope drops away
      // downward, uncovering the invitation card that stays in place
      envelopeOverlay.classList.add('opening');
      if (navigator.vibrate) navigator.vibrate(12);
      spawnSparkBurst();

      // Start the music inside the tap handler itself. iOS only reliably
      // honours play() when it is called from the gesture that triggered it,
      // so this must not wait for the reveal timeout below.
      startBGM();

      // Phase 2: card holds for a beat, then focus-pull into the invitation
      setTimeout(() => {
        envelopeOverlay.classList.add('opened');

        // Show main content
        if (mainContent) {
          mainContent.classList.remove('hidden');
        }

        revealHero();

        // hand the floating music button over to the reader
        if (bgmToggle) bgmToggle.classList.remove('is-hidden');

        // Start falling petals
        initPetals();

      // The envelope finishes dropping at ~1.5s and the card settles at ~1.6s;
      // this holds the revealed card on screen for a beat before the page.
      }, 2700);
    });
  }

  // ============================================
  // 2. BGM CONTROL
  // ============================================
  // Browsers block audible autoplay until the visitor has interacted with the
  // page, so this uses a two-step strategy: try immediately in case this
  // browser allows it, and otherwise start on the first gesture — in practice
  // the envelope tap, which is the first thing anyone does here.
  // The audio file itself was 25 dB too quiet (-39 LUFS), so it was amplified
  // to a normal -15 LUFS instead of leaning on this number. 0.85 keeps a little
  // headroom in case it should go louder still; 1.0 is the maximum.
  const BGM_VOLUME = 0.85;
  const GESTURES = ['pointerdown', 'touchstart', 'keydown'];
  let fadeTimer = null;
  // set once the reader turns the music off themselves. Without this, the
  // first-gesture fallback below would restart it on their next scroll,
  // since a touch-scroll fires touchstart.
  let userMuted = false;

  function fadeTo(target, ms, onDone) {
    if (!bgmAudio) return;
    clearInterval(fadeTimer);
    const stepMs = 40;
    const from = bgmAudio.volume;
    const steps = Math.max(1, Math.round(ms / stepMs));
    let i = 0;
    fadeTimer = setInterval(() => {
      i++;
      const v = from + (target - from) * (i / steps);
      bgmAudio.volume = Math.min(1, Math.max(0, v));
      if (i >= steps) {
        clearInterval(fadeTimer);
        if (onDone) onDone();
      }
    }, stepMs);
  }

  function startBGM() {
    if (!bgmAudio || userMuted) return Promise.resolve();
    if (!bgmAudio.paused) return Promise.resolve();

    bgmAudio.volume = 0;
    const played = bgmAudio.play();

    if (played && played.then) {
      return played
        .then(() => { fadeTo(BGM_VOLUME, 1200); })
        .catch(() => { /* blocked: the gesture fallback below retries */ });
    }
    fadeTo(BGM_VOLUME, 1200);
    return Promise.resolve();
  }

  // Keep the button showing what the audio element is actually doing, rather
  // than a flag that can drift out of sync when play() is rejected.
  function syncBgmUI() {
    if (!bgmToggle || !bgmAudio) return;
    const on = !bgmAudio.paused;
    bgmToggle.classList.toggle('playing', on);
    bgmToggle.classList.toggle('muted', !on);
    bgmToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    bgmToggle.setAttribute('aria-label', on ? '배경음악 끄기' : '배경음악 켜기');
  }

  if (bgmAudio) {
    bgmAudio.addEventListener('play', syncBgmUI);
    bgmAudio.addEventListener('pause', syncBgmUI);
    syncBgmUI();

    // Step 1: try right away, for browsers that permit audible autoplay.
    startBGM();

    // Step 2: fallback — the first interaction anywhere starts it. The
    // listeners are only removed once playback has actually begun.
    const dropGestureHooks = () =>
      GESTURES.forEach(ev => window.removeEventListener(ev, kickOff));

    function kickOff() {
      if (userMuted) { dropGestureHooks(); return; }
      startBGM().then(() => {
        if (!bgmAudio.paused) dropGestureHooks();
      });
    }
    GESTURES.forEach(ev => window.addEventListener(ev, kickOff, { passive: true }));
  }

  if (bgmToggle && bgmAudio) {
    bgmToggle.addEventListener('click', (e) => {
      e.stopPropagation();

      if (bgmAudio.paused) {
        userMuted = false;
        bgmAudio.volume = 0;
        bgmAudio.play().then(() => fadeTo(BGM_VOLUME, 600)).catch(() => {});
      } else {
        userMuted = true;
        // reflect the tap at once, then fade out before pausing
        bgmToggle.classList.remove('playing');
        bgmToggle.classList.add('muted');
        bgmToggle.setAttribute('aria-pressed', 'false');
        bgmToggle.setAttribute('aria-label', '배경음악 켜기');
        fadeTo(0, 350, () => bgmAudio.pause());
      }
    });
  }

  // ============================================
  // 3. SCROLL ANIMATIONS (Intersection Observer)
  // ============================================
  const animatedElements = document.querySelectorAll('.animate-on-scroll');

  const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        scrollObserver.unobserve(entry.target);
      }
    });
  }, {
    root: null,
    rootMargin: '0px 0px -50px 0px',
    threshold: 0.1
  });

  animatedElements.forEach(el => scrollObserver.observe(el));

  // ============================================
  // 4. PHOTO GALLERY LIGHTBOX
  // ============================================
  const galleryItems = document.querySelectorAll('.gallery-item');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxClose = document.querySelector('.lightbox-close');
  const lightboxPrev = document.querySelector('.lightbox-prev');
  const lightboxNext = document.querySelector('.lightbox-next');
  const lightboxCurrent = document.getElementById('lightbox-current');
  const lightboxTotal = document.getElementById('lightbox-total');

  let currentIndex = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchDeltaX = 0;

  // Collect all image sources
  const gallerySrcs = [];
  const preloadedImages = {};
  galleryItems.forEach(item => {
    const img = item.querySelector('img');
    if (img) gallerySrcs.push(img.src);
  });

  // Aggressively preload: when gallery section scrolls into view,
  // force all images to load immediately
  const gallerySection = document.getElementById('gallery');
  if (gallerySection) {
    const galleryObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Remove lazy loading from all gallery images
          galleryItems.forEach(item => {
            const img = item.querySelector('img');
            if (img) img.loading = 'eager';
          });
          // Preload all full-size images into memory cache
          gallerySrcs.forEach(src => {
            const img = new Image();
            img.src = src;
            preloadedImages[src] = img;
          });
          galleryObserver.disconnect();
        }
      });
    }, { rootMargin: '200px' });
    galleryObserver.observe(gallerySection);
  }

  if (lightboxTotal) lightboxTotal.textContent = gallerySrcs.length;

  function openLightbox(index) {
    currentIndex = index;
    // Set image source immediately — the thumbnail is already loaded
    lightboxImg.src = gallerySrcs[currentIndex];
    if (lightboxCurrent) lightboxCurrent.textContent = currentIndex + 1;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
    // Preload adjacent images
    preloadAdjacent(currentIndex);
  }

  function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  }

  function updateLightboxImage() {
    if (!lightboxImg) return;
    lightboxImg.src = gallerySrcs[currentIndex];
    if (lightboxCurrent) lightboxCurrent.textContent = currentIndex + 1;
    preloadAdjacent(currentIndex);
  }

  function preloadAdjacent(idx) {
    const next = (idx + 1) % gallerySrcs.length;
    const prev = (idx - 1 + gallerySrcs.length) % gallerySrcs.length;
    if (!preloadedImages[gallerySrcs[next]]) {
      const img = new Image();
      img.src = gallerySrcs[next];
      preloadedImages[gallerySrcs[next]] = img;
    }
    if (!preloadedImages[gallerySrcs[prev]]) {
      const img = new Image();
      img.src = gallerySrcs[prev];
      preloadedImages[gallerySrcs[prev]] = img;
    }
  }

  function nextImage() {
    currentIndex = (currentIndex + 1) % gallerySrcs.length;
    updateLightboxImage();
  }

  function prevImage() {
    currentIndex = (currentIndex - 1 + gallerySrcs.length) % gallerySrcs.length;
    updateLightboxImage();
  }

  // Gallery item click
  galleryItems.forEach((item) => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.getAttribute('data-index'), 10);
      openLightbox(idx);
    });
  });

  // Lightbox controls
  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightboxPrev) lightboxPrev.addEventListener('click', prevImage);
  if (lightboxNext) lightboxNext.addEventListener('click', nextImage);

  // Close on backdrop click
  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox || e.target.classList.contains('lightbox-image-wrapper')) {
        closeLightbox();
      }
    });
  }

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (!lightbox || !lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') nextImage();
    if (e.key === 'ArrowLeft') prevImage();
  });

  // Touch swipe for lightbox
  if (lightbox) {
    lightbox.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    lightbox.addEventListener('touchend', (e) => {
      const deltaX = e.changedTouches[0].screenX - touchStartX;
      const deltaY = e.changedTouches[0].screenY - touchStartY;

      // Only handle horizontal swipes (not vertical scrolling)
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        if (deltaX < 0) nextImage();
        else prevImage();
      }
    }, { passive: true });
  }

  // ============================================
  // 5. ACCOUNT NUMBER COPY & ACCORDION
  // ============================================
  const giftCardHeaders = document.querySelectorAll('.gift-card-header');
  const copyButtons = document.querySelectorAll('.copy-btn');

  // Accordion toggle
  giftCardHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const isExpanded = header.getAttribute('aria-expanded') === 'true';
      const bodyId = header.getAttribute('aria-controls');
      const body = document.getElementById(bodyId);

      if (!body) return;

      if (isExpanded) {
        header.setAttribute('aria-expanded', 'false');
        // pin the current height first, so removing it animates down to 0
        body.style.maxHeight = body.scrollHeight + 'px';
        void body.offsetHeight;
        body.style.maxHeight = '';
        body.setAttribute('hidden', '');
      } else {
        header.setAttribute('aria-expanded', 'true');
        body.removeAttribute('hidden');
        // measure the real content height so nothing is ever clipped
        body.style.maxHeight = body.scrollHeight + 'px';
        body.addEventListener('transitionend', function done(e) {
          if (e.propertyName !== 'max-height') return;
          body.removeEventListener('transitionend', done);
          // release the cap once open, so it survives rotation / font reflow
          if (header.getAttribute('aria-expanded') === 'true') body.style.maxHeight = 'none';
        });
      }
    });
  });

  // Copy to clipboard
  copyButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const accountNo = btn.getAttribute('data-account');
      if (!accountNo) return;

      copyToClipboard(accountNo).then(() => {
        showToast('계좌번호가 복사되었습니다');
      }).catch(() => {
        showToast('복사에 실패했습니다');
      });
    });
  });

  async function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
      textarea.remove();
      return Promise.resolve();
    } catch (err) {
      textarea.remove();
      return Promise.reject(err);
    }
  }

  // ============================================
  // 6. TOAST NOTIFICATION
  // ============================================
  function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
    }, 2200);
  }

  // ============================================
  // 7. FALLING PETALS ANIMATION
  // ============================================
  const petalsContainer = document.getElementById('petals-container');
  const MAX_PETALS = 25;
  let petals = [];
  let petalAnimId = null;

  function initPetals() {
    if (!petalsContainer) return;
    animatePetals();
  }

  function createPetal() {
    if (petals.length >= MAX_PETALS) return;

    const petal = document.createElement('div');
    petal.classList.add('petal');

    const size = Math.random() * 10 + 6;
    const startX = Math.random() * window.innerWidth;
    const hue = 195 + Math.random() * 30; // sky blue range
    const lightness = 75 + Math.random() * 15;
    const alpha = 0.3 + Math.random() * 0.4;

    petal.style.width = size + 'px';
    petal.style.height = size + 'px';
    petal.style.left = startX + 'px';
    petal.style.top = '-20px';
    petal.style.background = `hsla(${hue}, 60%, ${lightness}%, ${alpha})`;

    const data = {
      el: petal,
      x: startX,
      y: -20,
      speed: 0.4 + Math.random() * 0.8,
      drift: (Math.random() - 0.5) * 0.6,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 1.5,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.02 + Math.random() * 0.03
    };

    petalsContainer.appendChild(petal);
    petals.push(data);
  }

  function animatePetals() {
    // Spawn new petal occasionally
    if (Math.random() < 0.04) createPetal();

    for (let i = petals.length - 1; i >= 0; i--) {
      const p = petals[i];
      p.y += p.speed;
      p.wobble += p.wobbleSpeed;
      p.x += p.drift + Math.sin(p.wobble) * 0.3;
      p.rotation += p.rotSpeed;

      p.el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.rotation}deg)`;

      // Fade in and out
      const screenH = window.innerHeight;
      if (p.y < 50) {
        p.el.style.opacity = p.y / 50;
      } else if (p.y > screenH - 100) {
        p.el.style.opacity = Math.max(0, (screenH - p.y) / 100);
      } else {
        p.el.style.opacity = 0.7;
      }

      // Remove if offscreen
      if (p.y > screenH + 20) {
        p.el.remove();
        petals.splice(i, 1);
      }
    }

    petalAnimId = requestAnimationFrame(animatePetals);
  }

  // Performance: pause when tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (petalAnimId) cancelAnimationFrame(petalAnimId);
    } else {
      if (petals.length > 0 || petalsContainer) {
        animatePetals();
      }
    }
  });

  // ============================================
  // 8. SHARE BUTTON
  // ============================================
  const shareBtn = document.getElementById('share-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const shareData = {
        title: '박현규 ♥ 최지원 결혼합니다',
        text: '저희 두 사람이 사랑으로 하나 되어 새로운 시작을 알립니다.',
        url: window.location.href
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch (err) {
          // User cancelled or error
        }
      } else {
        // Fallback: copy URL
        copyToClipboard(window.location.href).then(() => {
          showToast('링크가 복사되었습니다');
        });
      }
    });
  }

  // ============================================
  // 9. KAKAOPAY BUTTONS
  // ============================================
  // The two versions of the invitation are switched by the small script in
  // <head> (v-gift / v-guest classes), not here, so that it works even if
  // this file fails to run.
  //
  // A KakaoPay button is only useful once a real transfer link is pasted in,
  // so remove any that still holds the "#" placeholder.
  document.querySelectorAll('.kakaopay-btn').forEach(btn => {
    if (!/^https?:\/\//.test(btn.getAttribute('href') || '')) btn.remove();
  });

});
