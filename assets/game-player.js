/**
 * BAMZO Game Player & Fullscreen Manager
 * Handles responsive player layout, cross-browser/mobile fullscreen (including iOS Safari),
 * per-game orientation locking, and iframe permissions.
 */
(function() {
  'use strict';

  // Known portrait games list
  var PORTRAIT_SLUGS = [
    'subway-surfers', 'subway-surfers-new-york', 'temple-run-2', 'flappy-bird', 'stack',
    'doodle-jump', 'bottle-flip-3d', 'bottle-flip', 'ball-sort-puzzle', 'ball-sort-halloween',
    'ball-sort-soccer', 'rise-higher', 'happy-hop', 'hop-pop-it', 'tower-crash-3d',
    'wheelie-bike', 'wheelie-bike-2', 'fruit-ninja', '1010-color-match', '1010-deluxe',
    'wood-block-puzzle', 'marbles-sorting', 'solitaire', 'spider-solitaire'
  ];

  function getGameOrientation(game) {
    if (game && game.orientation) return game.orientation;
    if (game && typeof game.aspectRatio === 'number') return game.aspectRatio < 1 ? 'portrait' : 'landscape';

    if (game && game.slug && PORTRAIT_SLUGS.indexOf(game.slug) !== -1) {
      return 'portrait';
    }

    var name = (game && game.name) ? String(game.name) : '';
    var genre = (game && game.genre) ? String(game.genre) : '';
    var about = (game && game.about) ? String(game.about) : '';
    var text = (name + ' ' + genre + ' ' + about).toLowerCase();

    if (text.indexOf('portrait') !== -1 || text.indexOf('vertical runner') !== -1 || text.indexOf('vertical endless runner') !== -1) {
      return 'portrait';
    }

    return 'landscape';
  }

  function applyOrientation(game) {
    var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent) ||
                   (window.innerWidth <= 900 && ('ontouchstart' in window || navigator.maxTouchPoints > 0));
    if (!isMobile) return;

    if ('orientation' in screen && typeof screen.orientation.lock === 'function') {
      var targetOrientation = getGameOrientation(game);
      screen.orientation.lock(targetOrientation).catch(function(err) {
        console.warn('Screen orientation lock failed or rejected:', err);
      });
    }
  }

  function restoreOrientation() {
    if ('orientation' in screen && typeof screen.orientation.unlock === 'function') {
      try {
        screen.orientation.unlock();
      } catch (e) {}
    }
  }

  function isNativeFullscreen() {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.webkitCurrentFullScreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
  }

  function isFullscreenActive() {
    var player = document.getElementById('player');
    return isNativeFullscreen() || (player && player.classList.contains('is-fullscreen'));
  }

  function ensureGameStarted() {
    var frame = document.getElementById('gameFrame');
    var start = document.getElementById('startScreen');
    if (frame && !frame.src && frame.dataset && frame.dataset.src) {
      frame.src = frame.dataset.src;
      frame.style.display = 'block';
      if (start) start.style.display = 'none';
      if (typeof GAME !== 'undefined' && GAME.id) {
        try {
          var r = JSON.parse(localStorage.getItem('nova-recents') || '[]').map(String).filter(function(x) {
            return x !== String(GAME.id);
          });
          localStorage.setItem('nova-recents', JSON.stringify([String(GAME.id)].concat(r).slice(0, 20)));
        } catch (e) {}
      }
    }
  }

  function enterFullscreen(game) {
    var player = document.getElementById('player');
    if (!player) return;

    ensureGameStarted();

    function onEntered() {
      player.classList.add('is-fullscreen');
      document.documentElement.classList.add('has-fullscreen');
      document.body.classList.add('has-fullscreen');
      applyOrientation(game || (typeof GAME !== 'undefined' ? GAME : null));
    }

    var reqFn = player.requestFullscreen ||
                  player.webkitRequestFullscreen ||
                  player.webkitRequestFullScreen ||
                  player.mozRequestFullScreen ||
                  player.msRequestFullscreen;

    if (reqFn) {
      try {
        var p = reqFn.call(player);
        if (p && typeof p.then === 'function') {
          p.then(onEntered).catch(function(err) {
            console.warn('Native requestFullscreen rejected, using fallback CSS fullscreen:', err);
            onEntered();
          });
        } else {
          onEntered();
        }
      } catch (err) {
        console.warn('Native requestFullscreen threw error, using fallback CSS fullscreen:', err);
        onEntered();
      }
    } else {
      // iOS Safari (iPhone) or unsupported browser: use CSS fullscreen fallback
      onEntered();
    }
  }

  function exitFullscreen() {
    var player = document.getElementById('player');

    function onExited() {
      if (player) player.classList.remove('is-fullscreen');
      document.documentElement.classList.remove('has-fullscreen');
      document.body.classList.remove('has-fullscreen');
      restoreOrientation();
    }

    var exitFn = document.exitFullscreen ||
                   document.webkitExitFullscreen ||
                   document.webkitCancelFullScreen ||
                   document.mozCancelFullScreen ||
                   document.msExitFullscreen;

    if (isNativeFullscreen() && exitFn) {
      try {
        var p = exitFn.call(document);
        if (p && typeof p.then === 'function') {
          p.then(onExited).catch(onExited);
        } else {
          onExited();
        }
      } catch (e) {
        onExited();
      }
    } else {
      onExited();
    }
  }

  function toggleFullscreen(game) {
    if (isFullscreenActive()) {
      exitFullscreen();
    } else {
      enterFullscreen(game);
    }
  }

  function handleFSChange() {
    var nativeFS = isNativeFullscreen();
    var player = document.getElementById('player');
    if (!nativeFS && player && player.classList.contains('is-fullscreen')) {
      player.classList.remove('is-fullscreen');
      document.documentElement.classList.remove('has-fullscreen');
      document.body.classList.remove('has-fullscreen');
      restoreOrientation();
    } else if (nativeFS && player && !player.classList.contains('is-fullscreen')) {
      player.classList.add('is-fullscreen');
      document.documentElement.classList.add('has-fullscreen');
      document.body.classList.add('has-fullscreen');
      applyOrientation(typeof GAME !== 'undefined' ? GAME : null);
    }
  }

  ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(function(evt) {
    document.addEventListener(evt, handleFSChange);
  });

  function ensureIframePermissions() {
    var frame = document.getElementById('gameFrame');
    if (frame) {
      var currentAllow = frame.getAttribute('allow') || '';
      var requiredPermissions = ['autoplay', 'fullscreen', 'gamepad', 'clipboard-read', 'clipboard-write'];
      var allowParts = currentAllow ? currentAllow.split(';').map(function(s) { return s.trim(); }).filter(Boolean) : [];
      
      requiredPermissions.forEach(function(perm) {
        if (!allowParts.some(function(p) { return p.indexOf(perm) === 0; })) {
          allowParts.push(perm);
        }
      });
      
      frame.setAttribute('allow', allowParts.join('; '));
      frame.setAttribute('allowfullscreen', 'true');
      frame.setAttribute('webkitallowfullscreen', 'true');
      frame.setAttribute('mozallowfullscreen', 'true');
    }
  }

  function initPlayerControls() {
    ensureIframePermissions();

    var player = document.getElementById('player');
    if (player && !document.getElementById('fsExitBtn')) {
      var exitBtn = document.createElement('button');
      exitBtn.id = 'fsExitBtn';
      exitBtn.className = 'fullscreen-exit-btn';
      exitBtn.title = 'Exit Fullscreen';
      exitBtn.setAttribute('aria-label', 'Exit Fullscreen');
      exitBtn.innerHTML = '✕';
      exitBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        exitFullscreen();
      };
      player.appendChild(exitBtn);
    }

    var fsBtn = document.getElementById('fullscreenButton');
    if (fsBtn) {
      fsBtn.onclick = function(e) {
        e.preventDefault();
        toggleFullscreen(typeof GAME !== 'undefined' ? GAME : null);
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPlayerControls);
  } else {
    initPlayerControls();
  }

  window.BAMZO_Player = {
    toggleFullscreen: toggleFullscreen,
    enterFullscreen: enterFullscreen,
    exitFullscreen: exitFullscreen,
    getGameOrientation: getGameOrientation
  };
})();
