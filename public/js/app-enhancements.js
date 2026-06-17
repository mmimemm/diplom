// ====================================================================
// ДОПОЛНИТЕЛЬНЫЕ УЛУЧШЕНИЯ: скролл-анимации, жесты, свайпы, звуки
// Подключается на всех страницах студента ПОСЛЕ app.js
// ====================================================================

(function() {
  'use strict';

  // ===== 1. IntersectionObserver — анимации при скролле =====
  function initScrollAnimations() {
    if (!('IntersectionObserver' in window)) {
      // Fallback для старых браузеров — показываем всё сразу
      document.querySelectorAll('.scroll-anim').forEach(function(el) {
        el.classList.add('visible');
      });
      return;
    }

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          // Анимация один раз — отключаем наблюдение
          observer.unobserve(entry.target);
          
          // Звук при появлении блока (только на десктопе, не спамить)
          if (typeof playSound === 'function' && window.innerWidth > 768) {
            playSound('hover');
          }
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    document.querySelectorAll('.scroll-anim').forEach(function(el) {
      observer.observe(el);
    });
  }

  // ===== 2. Touch-жесты: свайп для сайдбара =====
  function initSwipeGestures() {
    var sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    var startX = 0;
    var currentX = 0;
    var isDragging = false;
    var threshold = 80;
    var sidebarWidth = 260;

    // Свайп вправо — открыть сайдбар
    document.addEventListener('touchstart', function(e) {
      if (sidebar.classList.contains('open')) return;
      var touch = e.touches[0];
      // Только если свайп начинается с левого края (первые 40px)
      if (touch.clientX < 40) {
        startX = touch.clientX;
        isDragging = true;
      }
    }, { passive: true });

    document.addEventListener('touchmove', function(e) {
      if (!isDragging) return;
      currentX = e.touches[0].clientX;
      var diff = currentX - startX;
      if (diff > 0) {
        sidebar.style.transform = 'translateX(' + Math.min(diff - sidebarWidth, 0) + 'px)';
      }
    }, { passive: true });

    document.addEventListener('touchend', function(e) {
      if (!isDragging) return;
      isDragging = false;
      var diff = currentX - startX;
      sidebar.style.transform = '';

      if (diff > threshold) {
        // Открываем сайдбар
        if (typeof toggleSidebar === 'function') {
          toggleSidebar();
        }
        if (typeof playSound === 'function') {
          playSound('swipe');
        }
      }
    }, { passive: true });

    // Свайп влево — закрыть сайдбар
    var overlay = document.querySelector('.sidebar-overlay');
    if (overlay) {
      overlay.addEventListener('touchstart', function(e) {
        var touch = e.touches[0];
        startX = touch.clientX;
        isDragging = true;
      }, { passive: true });

      overlay.addEventListener('touchmove', function(e) {
        if (!isDragging) return;
        currentX = e.touches[0].clientX;
        var diff = startX - currentX;
        if (diff > 0) {
          sidebar.style.transform = 'translateX(' + Math.max(-diff, -sidebarWidth) + 'px)';
        }
      }, { passive: true });

      overlay.addEventListener('touchend', function() {
        if (!isDragging) return;
        isDragging = false;
        var diff = startX - currentX;
        sidebar.style.transform = '';

        if (diff > threshold) {
          if (typeof toggleSidebar === 'function') {
            toggleSidebar();
          }
        }
      }, { passive: true });
    }
  }

  // ===== 3. Haptic feedback для мобильных (вибрация) =====
  function triggerHaptic() {
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  }

  // ===== 4. Улучшенные звуки для всех взаимодействий =====
  function initEnhancedSounds() {
    // Звук на переключение вкладок
    document.addEventListener('click', function(e) {
      var tab = e.target.closest('.chat-tab, .filter-tab, .tab-btn, .lang-tab');
      if (tab && typeof playSound === 'function') {
        playSound('swipe');
      }
    });

    // Звук при открытии/закрытии модалок
    document.addEventListener('click', function(e) {
      var modalTrigger = e.target.closest('[data-modal]');
      if (modalTrigger && typeof playSound === 'function') {
        playSound('open');
      }
    });

    // Звук на отправку форм
    document.addEventListener('submit', function(e) {
      if (typeof playSound === 'function') {
        playSound('success');
      }
    });

    // Звук при изменении toggle-переключателей
    document.addEventListener('change', function(e) {
      var toggle = e.target.closest('input[type="checkbox"]');
      if (toggle && toggle.closest('.toggle-switch') && typeof playSound === 'function') {
        playSound('ding');
      }
    });
  }

  // ===== 5. Плавный скролл к якорям =====
  function initSmoothScroll() {
    document.addEventListener('click', function(e) {
      var anchor = e.target.closest('a[href^="#"]');
      if (!anchor) return;
      var target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  // ===== 6. Авто-закрытие тостов по клику =====
  function initToastDismiss() {
    document.addEventListener('click', function(e) {
      var toast = e.target.closest('[data-toast]');
      if (toast) {
        toast.remove();
      }
    });
  }

  // ===== 7. Максимальная ширина контента на больших экранах =====
  function initMaxWidth() {
    var mainContent = document.querySelector('.main-content');
    if (!mainContent) return;
    
    if (window.innerWidth > 1400) {
      mainContent.style.maxWidth = '1200px';
      mainContent.style.marginLeft = 'auto';
      mainContent.style.marginRight = 'auto';
    }
    
    window.addEventListener('resize', function() {
      if (window.innerWidth > 1400) {
        mainContent.style.maxWidth = '1200px';
        mainContent.style.marginLeft = 'auto';
        mainContent.style.marginRight = 'auto';
      } else {
        mainContent.style.maxWidth = '';
        mainContent.style.marginLeft = '';
        mainContent.style.marginRight = '';
      }
    });
  }

  // ===== 8. Перехват ошибок загрузки изображений =====
  function initImageFallbacks() {
    document.addEventListener('error', function(e) {
      var img = e.target;
      if (img.tagName === 'IMG' && !img.classList.contains('img-error-fixed')) {
        img.classList.add('img-error-fixed');
        img.style.display = 'none';
        // Показываем первую букву/эмодзи как fallback
        if (img.closest('.user-avatar')) {
          var fallback = img.getAttribute('data-fallback') || '?';
          var parent = img.parentElement;
          parent.textContent = fallback;
          parent.style.background = '';
        }
      }
    }, true);
  }

  // ===== 9. Определение устройства для адаптивности =====
  function getDeviceType() {
    var width = window.innerWidth;
    if (width <= 360) return 'phone-small';
    if (width <= 480) return 'phone';
    if (width <= 768) return 'tablet';
    if (width <= 992) return 'tablet-landscape';
    return 'desktop';
  }

  window.getDeviceType = getDeviceType;

  // ===== 10. Показать тост-уведомление (улучшенная версия) =====
  function showEnhancedToast(msg, type) {
    type = type || 'success';
    var existing = document.querySelector('.enhanced-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'enhanced-toast';
    toast.setAttribute('data-toast', 'true');
    
    var icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    var colors = { 
      success: '#1a1a2e', 
      error: '#cc0000', 
      info: '#0066cc',
      warning: '#cc8800' 
    };
    
    toast.innerHTML = '<span>' + (icons[type] || '✅') + '</span> ' + msg;
    toast.style.cssText = [
      'position:fixed',
      'bottom:80px',
      'left:50%',
      'transform:translateX(-50%)',
      'background:' + (colors[type] || '#1a1a2e'),
      'color:white',
      'padding:14px 28px',
      'border-radius:30px',
      'z-index:9999',
      'font-weight:700',
      'font-family:Nunito,sans-serif',
      'box-shadow:0 4px 20px rgba(0,0,0,0.3)',
      'display:flex',
      'align-items:center',
      'gap:8px',
      'animation:fadeInUp 0.3s ease',
      'cursor:pointer',
      'max-width:90vw'
    ].join(';');
    
    document.body.appendChild(toast);
    
    // Звук
    if (typeof playSound === 'function') {
      playSound(type === 'error' ? 'error' : type === 'success' ? 'success' : 'ding');
    }
    
    // Вибрация на мобилке
    if (type === 'error' && navigator.vibrate) {
      navigator.vibrate([50, 30, 50]);
    }
    
    setTimeout(function() {
      toast.style.transition = 'opacity 0.3s, transform 0.3s';
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(20px)';
      setTimeout(function() { toast.remove(); }, 300);
    }, 3000);
    
    // Клик закрывает
    toast.addEventListener('click', function() { toast.remove(); });
  }

  // ===== 11. Следим за производительностью — requestAnimationFrame =====
  function initPerformanceMonitor() {
    var lastTime = performance.now();
    var frames = 0;
    
    function checkFPS() {
      frames++;
      var now = performance.now();
      var delta = now - lastTime;
      
      if (delta >= 1000) {
        var fps = Math.round(frames * 1000 / delta);
        lastTime = now;
        frames = 0;
        
        // Если FPS < 30 — отключаем анимации для производительности
        if (fps < 30 && fps > 0) {
          document.body.classList.add('low-fps');
        } else {
          document.body.classList.remove('low-fps');
        }
      }
      requestAnimationFrame(checkFPS);
    }
    
    requestAnimationFrame(checkFPS);
  }

  // ===== 12. Добавление класса scroll-anim к карточкам =====
  function addScrollClasses() {
    // Добавляем классы анимации ко всем карточкам и элементам
    var selectors = '.content-card, .stat-card, .submission-card, .shop-item, .module-card, .lesson-item, .schedule-item';
    document.querySelectorAll(selectors).forEach(function(el) {
      // Пропускаем если уже есть класс анимации
      if (el.classList.contains('scroll-anim') || el.classList.contains('anim-fade-in')) return;
      
      // Добавляем только если элемент не виден сразу (ниже 300px от верха)
      var rect = el.getBoundingClientRect();
      if (rect.top > window.innerHeight * 0.7) {
        el.classList.add('scroll-anim', 'scroll-anim-fade-up');
      }
    });
  }

  // ===== 13. Ленивая загрузка изображений =====
  function initLazyImages() {
    if ('loading' in HTMLImageElement.prototype) {
      document.querySelectorAll('img[loading="lazy"]').forEach(function(img) {
        img.loading = 'lazy';
      });
    } else {
      // Fallback для старых браузеров
      var lazyObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            var img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
            }
            lazyObserver.unobserve(img);
          }
        });
      });
      
      document.querySelectorAll('img[data-src]').forEach(function(img) {
        lazyObserver.observe(img);
      });
    }
  }

  // ===== SAFETY FALLBACK для scroll-anim — гарантирует что всё видимо =====
  function ensureScrollAnimVisible() {
    var hidden = document.querySelectorAll('.scroll-anim:not(.visible)');
    if (hidden.length > 0) {
      hidden.forEach(function(el) {
        el.classList.add('visible');
      });
    }
  }

  // ===== ИНИЦИАЛИЗАЦИЯ =====
  function init() {
    // Даём время DOM загрузиться
    setTimeout(function() {
      addScrollClasses();
      initScrollAnimations();
      initSwipeGestures();
      initEnhancedSounds();
      initSmoothScroll();
      initToastDismiss();
      initMaxWidth();
      initImageFallbacks();
      initLazyImages();
      // Performance monitor — опционально, не на мобилках
      if (!/Mobi|Android/i.test(navigator.userAgent)) {
        initPerformanceMonitor();
      }
    }, 300);

    // Safety fallback: через 2.5 секунды показываем все scroll-anim,
    // которые не получили класс visible (если IntersectionObserver не сработал)
    setTimeout(ensureScrollAnimVisible, 2500);
    // Повторная проверка через 6 секунд для подстраховки
    setTimeout(ensureScrollAnimVisible, 6000);
  }

  // Запускаем после полной загрузки
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }

  // Экспортируем
  window.showEnhancedToast = showEnhancedToast;
  window.initScrollAnimations = initScrollAnimations;

})();
