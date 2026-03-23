/**
 * EventSphereX Media Theme JavaScript
 */
(function() {
  'use strict';

  // === Date ===
  var dateEl = document.getElementById('current-date');
  if (dateEl) {
    var d = new Date();
    dateEl.textContent = d.toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  // === Dark mode ===
  var toggle = document.getElementById('theme-toggle');
  if (toggle) {
    var moonSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    var sunSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
    var saved = localStorage.getItem('esx-theme');
    if (saved === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      toggle.innerHTML = sunSvg;
    }
    toggle.addEventListener('click', function() {
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      document.documentElement.setAttribute('data-theme', isDark ? '' : 'dark');
      localStorage.setItem('esx-theme', isDark ? 'light' : 'dark');
      toggle.innerHTML = isDark ? moonSvg : sunSvg;
    });
  }

  // === Tools strip arrows ===
  var toolsTrack = document.getElementById('tools-track');
  var toolsPrev = document.getElementById('tools-prev');
  var toolsNext = document.getElementById('tools-next');
  if (toolsTrack && toolsPrev && toolsNext) {
    var scrollAmt = 280;
    toolsPrev.addEventListener('click', function() {
      toolsTrack.scrollBy({ left: -scrollAmt, behavior: 'smooth' });
    });
    toolsNext.addEventListener('click', function() {
      toolsTrack.scrollBy({ left: scrollAmt, behavior: 'smooth' });
    });
    // Hide nav if all cards fit
    var nav = document.getElementById('tools-nav');
    if (nav && toolsTrack.scrollWidth <= toolsTrack.clientWidth) {
      nav.style.display = 'none';
    }
  }

  // === Scroll progress bar ===
  var progressBar = document.getElementById('progress-bar');
  var backToTopBtn = document.getElementById('back-to-top');
  window.addEventListener('scroll', function() {
    var h = document.documentElement;
    var pct = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
    if (progressBar) {
      progressBar.style.width = pct + '%';
    }
    if (backToTopBtn) {
      backToTopBtn.classList.toggle('visible', window.scrollY > 600);
    }
  });

  // === Back to top ===
  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // === Mobile menu ===
  var mobileMenuBtn = document.getElementById('mobile-menu-btn');
  var mobileMenu = document.getElementById('mobile-menu');
  var mobileMenuClose = document.getElementById('mobile-menu-close');
  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', function() {
      mobileMenu.classList.add('open');
    });
  }
  if (mobileMenuClose && mobileMenu) {
    mobileMenuClose.addEventListener('click', function() {
      mobileMenu.classList.remove('open');
    });
  }

  // === Fade in on scroll ===
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.fade-in').forEach(function(el) {
    observer.observe(el);
  });

  // === Animated counters ===
  var counterObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.isIntersecting) {
        var el = e.target;
        var target = parseInt(el.getAttribute('data-target'));
        if (isNaN(target)) return;
        var current = 0;
        var step = Math.ceil(target / 60);
        var timer = setInterval(function() {
          current += step;
          if (current >= target) {
            current = target;
            clearInterval(timer);
          }
          el.textContent = current.toLocaleString('en-IN') + '+';
        }, 20);
        counterObserver.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('.stat-num').forEach(function(el) {
    counterObserver.observe(el);
  });

  // === Bookmark ===
  document.querySelectorAll('.article-bookmark').forEach(function(btn) {
    btn.addEventListener('click', function() {
      btn.classList.toggle('saved');
      btn.textContent = btn.classList.contains('saved') ? '\u2605' : '\u2606';
    });
  });

  // === Copy link (single post share) ===
  var copyBtn = document.getElementById('copy-link-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', function() {
      navigator.clipboard.writeText(window.location.href).then(function() {
        copyBtn.textContent = 'Copied!';
        setTimeout(function() { copyBtn.innerHTML = '&#128279; Copy Link'; }, 2000);
      });
    });
  }

  // === Live Updates ===
  if (typeof esxLive !== 'undefined' && document.querySelector('.article-list')) {
    var lastDate = esxLive.lastDate;

    function checkForNewPosts() {
      fetch(esxLive.api + '?after=' + encodeURIComponent(lastDate), {
        headers: { 'X-WP-Nonce': esxLive.nonce }
      })
      .then(function(r) { return r.json(); })
      .then(function(posts) {
        if (!posts.length) return;

        var grid = document.querySelector('.article-list');
        var liveBar = document.getElementById('esx-live-bar');

        if (!liveBar) {
          liveBar = document.createElement('div');
          liveBar.id = 'esx-live-bar';
          liveBar.innerHTML = '<span class="live-dot"></span> New articles available';
          liveBar.style.cssText = 'background:var(--accent,#b3d237);color:#091d1b;padding:10px 20px;text-align:center;font-weight:600;font-size:14px;cursor:pointer;border-radius:8px;margin-bottom:16px;display:flex;align-items:center;justify-content:center;gap:8px';
          liveBar.addEventListener('click', function() {
            var hidden = grid.querySelectorAll('.live-new-card');
            hidden.forEach(function(card) {
              card.style.display = '';
              card.classList.add('visible');
            });
            liveBar.remove();
          });
          grid.parentNode.insertBefore(liveBar, grid);
        }

        posts.reverse().forEach(function(post) {
          if (document.querySelector('[data-post-id="' + post.id + '"]')) return;

          var card = document.createElement('div');
          card.className = 'article-card fade-in live-new-card';
          card.setAttribute('data-post-id', post.id);
          card.style.display = 'none';
          card.innerHTML =
            '<div class="article-card-image">' +
              '<img src="' + post.thumbnail + '" alt="" loading="lazy">' +
              '<span class="article-badge ' + post.badge + '">' + post.category + '</span>' +
              '<span class="live-badge">LIVE</span>' +
            '</div>' +
            '<div class="article-card-content">' +
              '<h3><a href="' + post.url + '">' + post.title + '</a></h3>' +
              '<p>' + post.excerpt + '</p>' +
              '<div class="article-card-meta">' +
                '<span>' + post.time_ago + '</span>' +
                '<span>' + post.read_time + '</span>' +
              '</div>' +
            '</div>';

          grid.insertBefore(card, grid.firstChild);
          lastDate = post.date;
        });
      })
      .catch(function() { /* silently retry next interval */ });
    }

    setInterval(checkForNewPosts, esxLive.interval);
  }

})();
