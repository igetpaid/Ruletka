(function () {
  'use strict';

  /* ============================================
     1. COLOR PALETTE (non-rainbow, aesthetic)
     ============================================ */
  const PALETTE = [
    '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
    '#1abc9c', '#3498db', '#9b59b6', '#e84393',
    '#00b894', '#6c5ce7', '#fd79a8', '#00cec9'
  ];

  function getSegmentColor(index) {
    return PALETTE[index % PALETTE.length];
  }

  /* ============================================
     2. CONFIG MANAGEMENT
     ============================================ */
  const STORAGE_KEY = 'rouletteConfig';
  const SCORE_KEY = 'rouletteScore';
  const HISTORY_KEY = 'rouletteHistory';

  const defaultConfig = {
    name: 'Колесо Фортуны',
    theme: 'light',
    backgroundImage: '',
    showScore: true,
    segments: [
      { name: 'Выигрыш 100', probability: 12.5 },
      { name: 'Выигрыш 50', probability: 12.5 },
      { name: 'Попробуй ещё', probability: 12.5 },
      { name: 'Билет', probability: 12.5 },
      { name: 'Джекпот 500', probability: 12.5 },
      { name: 'Пусто', probability: 12.5 },
      { name: 'Бонус х2', probability: 12.5 },
      { name: 'Выигрыш 20', probability: 12.5 }
    ]
  };

  let config = loadConfig();
  let score = loadScore();
  let history = loadHistory();
  let currentRotation = 0;
  let isSpinning = false;

  function loadConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.segments && parsed.segments.length >= 2) {
          if (parsed.backgroundImage === undefined) parsed.backgroundImage = '';
          if (parsed.showScore === undefined) parsed.showScore = true;
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load config:', e);
    }
    return JSON.parse(JSON.stringify(defaultConfig));
  }

  function saveConfig() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.warn('Failed to save config:', e);
    }
  }

  function loadScore() {
    try {
      const saved = localStorage.getItem(SCORE_KEY);
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch (e) {
      return 0;
    }
  }

  function saveScore() {
    try {
      localStorage.setItem(SCORE_KEY, String(score));
    } catch (e) {
      console.warn('Failed to save score:', e);
    }
  }

  function loadHistory() {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) return arr.slice(-3);
      }
    } catch (e) {}
    return [];
  }

  function saveHistory() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-3)));
    } catch (e) {
      console.warn('Failed to save history:', e);
    }
  }

  function shuffleSegments() {
    for (let i = config.segments.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [config.segments[i], config.segments[j]] = [config.segments[j], config.segments[i]];
    }
  }

  function getTotalProbability() {
    return config.segments.reduce(function (sum, s) { return sum + s.probability; }, 0);
  }

  function normalizeProbabilities() {
    const total = getTotalProbability();
    if (total === 0) {
      const each = 100 / config.segments.length;
      config.segments.forEach(function (s) { s.probability = each; });
    }
  }

  /* ============================================
     3. PLATFORM DETECTION
     ============================================ */
  function detectPlatform() {
    if (window.Telegram && window.Telegram.WebApp) return 'telegram';
    if (window.WebApp) return 'max';
    return 'standalone';
  }

  function initPlatform() {
    var platform = detectPlatform();
    var userInfo = document.getElementById('userInfo');

    if (platform === 'telegram') {
      var tg = window.Telegram.WebApp;
      tg.expand();
      if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
        var user = tg.initDataUnsafe.user;
        var name = user.first_name || user.username || 'Пользователь';
        userInfo.textContent = 'Telegram: ' + name;
      }
    } else if (platform === 'max') {
      var mx = window.WebApp;
      if (mx.expand) mx.expand();
      if (mx.initDataUnsafe && mx.initDataUnsafe.user) {
        var u = mx.initDataUnsafe.user;
        var n = u.first_name || u.username || 'Пользователь';
        userInfo.textContent = 'MAX: ' + n;
      }
    }
  }

  /* ============================================
     4. WHEEL RENDERING (Canvas) — PROPORTIONAL
     ============================================ */
  var canvas = document.getElementById('wheelCanvas');
  var ctx = canvas.getContext('2d');

  function setupCanvas() {
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height) || 300;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return size;
  }

  function drawWheel() {
    var displaySize = setupCanvas();
    var cx = displaySize / 2;
    var cy = displaySize / 2;
    var radius = displaySize / 2 - 4;
    var segments = config.segments;
    var count = segments.length;
    var total = getTotalProbability();
    var showText = count <= 20;

    ctx.clearRect(0, 0, displaySize, displaySize);

    // Background circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
    ctx.fillStyle = '#333';
    ctx.fill();

    // Draw segments proportionally
    var currentAngle = -Math.PI / 2; // start from top
    for (var i = 0; i < count; i++) {
      var sliceAngle = (segments[i].probability / total) * Math.PI * 2;
      var startAngle = currentAngle;
      var endAngle = currentAngle + sliceAngle;

      // Segment
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = getSegmentColor(i);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Text
      if (showText && sliceAngle > 0.15) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(startAngle + sliceAngle / 2);

        var name = segments[i].name;
        var scale = displaySize / 400;
        var fontSize = (sliceAngle > 0.5 ? 14 : sliceAngle > 0.3 ? 11 : 9) * scale;
        ctx.font = 'bold ' + fontSize + 'px -apple-system, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 3;

        var maxLen = sliceAngle > 0.5 ? 14 : sliceAngle > 0.3 ? 10 : 7;
        var displayName = name.length > maxLen ? name.slice(0, maxLen - 1) + '\u2026' : name;
        ctx.fillText(displayName, radius * 0.6, 0);

        ctx.restore();
      }

      currentAngle = endAngle;
    }

    // Center circle
    var centerR = 22 * (displaySize / 400);
    var dotR = 6 * (displaySize / 400);
    ctx.beginPath();
    ctx.arc(cx, cy, centerR, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
    ctx.fillStyle = '#333';
    ctx.fill();
  }

  /* ============================================
     5. SPIN LOGIC — PROPORTIONAL
     ============================================ */
  function weightedRandom() {
    var total = getTotalProbability();
    var random = Math.random() * total;
    for (var i = 0; i < config.segments.length; i++) {
      random -= config.segments[i].probability;
      if (random <= 0) return i;
    }
    return config.segments.length - 1;
  }

  function spinWheel() {
    if (isSpinning) return;
    isSpinning = true;

    var spinBtn = document.getElementById('spinBtn');
    spinBtn.disabled = true;

    var total = getTotalProbability();
    var selectedIndex = weightedRandom();

    // Calculate the actual center angle of the selected segment
    var angleBefore = 0;
    for (var i = 0; i < selectedIndex; i++) {
      angleBefore += (config.segments[i].probability / total) * 360;
    }
    var sliceAngle = (config.segments[selectedIndex].probability / total) * 360;
    var segmentCenterDeg = angleBefore + sliceAngle / 2;

    // Pointer is at top (0°). We need segmentCenterDeg to rotate to 0°.
    // Current wheel rotation is currentRotation. Target: segmentCenter aligns with top.
    // targetAngle = 360 - segmentCenterDeg (to bring it to top)
    var targetAngle = 360 - segmentCenterDeg;

    var fullRotations = 5 + Math.floor(Math.random() * 4);
    var totalSpin = fullRotations * 360 + targetAngle;

    currentRotation += totalSpin;
    canvas.style.transform = 'rotate(' + currentRotation + 'deg)';
    canvas.classList.add('spinning');

    setTimeout(function () {
      canvas.classList.remove('spinning');
      showResult(selectedIndex);
      isSpinning = false;
      spinBtn.disabled = false;
    }, 4200);
  }

  /* ============================================
     6. RESULT DISPLAY + HISTORY
     ============================================ */
  function showResult(index) {
    var segment = config.segments[index];
    var name = segment.name;

    var points = parsePoints(name);
    score += points;
    saveScore();
    updateScoreDisplay();

    // Add to history
    history.push({ name: name, points: points, color: getSegmentColor(index), time: Date.now() });
    if (history.length > 3) history = history.slice(-3);
    saveHistory();
    renderHistory();

    var emoji = '\uD83C\uDFB0';
    if (points > 100) emoji = '\uD83E\uDD11';
    else if (points > 0) emoji = '\uD83C\uDF89';
    else if (name.toLowerCase().indexOf('\u0434\u0436\u0435\u043A\u043F\u043E\u0442') >= 0) emoji = '\uD83D\uDCB0';
    else if (name.toLowerCase().indexOf('\u0431\u043E\u043D\u0443\u0441') >= 0) emoji = '\u2728';
    else if (points === 0) emoji = '\uD83D\uDE05';

    document.getElementById('resultEmoji').textContent = emoji;
    document.getElementById('resultText').textContent = name;
    document.getElementById('resultPoints').textContent =
      points > 0 ? '+' + points + ' \u043E\u0447\u043A\u043E\u0432' : points < 0 ? points + ' \u043E\u0447\u043A\u043E\u0432' : '\u0411\u0435\u0437 \u043E\u0447\u043A\u043E\u0432';

    document.getElementById('resultModal').classList.add('active');

    sendResultToBot(name, points);
  }

  function parsePoints(name) {
    var lower = name.toLowerCase();

    if (lower.indexOf('\u043F\u0443\u0441\u0442\u043E') >= 0 || lower.indexOf('\u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439') >= 0) return 0;

    var bonusMatch = lower.match(/\u0431\u043E\u043D\u0443\u0441\s*х(\d+)/);
    if (bonusMatch) return 50 * parseInt(bonusMatch[1], 10);

    var jackpotMatch = lower.match(/\u0434\u0436\u0435\u043A\u043F\u043E\u0442\s*(\d+)/);
    if (jackpotMatch) return parseInt(jackpotMatch[1], 10);

    var numMatch = name.match(/(\d+)/);
    if (numMatch) return parseInt(numMatch[1], 10);

    return 0;
  }

  function updateScoreDisplay() {
    document.getElementById('scoreValue').textContent = score;
  }

  function renderHistory() {
    var panel = document.getElementById('historyList');
    if (!panel) return;
    panel.innerHTML = '';
    for (var i = history.length - 1; i >= 0; i--) {
      var h = history[i];
      var card = document.createElement('div');
      card.className = 'history-card';
      card.innerHTML =
        '<span class="history-dot" style="background:' + h.color + '"></span>' +
        '<span class="history-name">' + escapeHTML(h.name) + '</span>' +
        '<span class="history-pts">' + (h.points > 0 ? '+' + h.points : h.points) + '</span>';
      panel.appendChild(card);
    }
  }

  /* ============================================
     7. BOT INTEGRATION (Telegram/MAX)
     ============================================ */
  function sendResultToBot(segmentName, points) {
    var platform = detectPlatform();
    try {
      if (platform === 'telegram' && window.Telegram.WebApp) {
        var tg = window.Telegram.WebApp;
        if (tg.sendData) {
          tg.sendData(JSON.stringify({ segment: segmentName, points: points }));
        }
      } else if (platform === 'max' && window.WebApp) {
        var mx = window.WebApp;
        if (mx.sendData) {
          mx.sendData(JSON.stringify({ segment: segmentName, points: points }));
        }
      }
    } catch (e) {
      console.warn('Could not send data to bot:', e);
    }
  }

  /* ============================================
     8. BACKGROUND IMAGE
     ============================================ */
  function applyBackgroundImage() {
    var body = document.body;
    if (config.backgroundImage && config.backgroundImage.trim()) {
      body.style.backgroundImage = 'url(' + config.backgroundImage + ')';
      body.style.backgroundSize = 'cover';
      body.style.backgroundPosition = 'center';
      body.style.backgroundRepeat = 'no-repeat';
    } else {
      body.style.backgroundImage = 'none';
    }
  }

  /* ============================================
     9. SETTINGS UI
     ============================================ */
  function openSettings() {
    document.getElementById('wheelNameInput').value = config.name;
    document.getElementById('bgUrlInput').value = config.backgroundImage || '';

    // Show score checkbox
    document.getElementById('showScoreCheckbox').checked = config.showScore;

    // Theme buttons
    document.querySelectorAll('.theme-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.theme === config.theme);
    });

    renderSegmentsList();
    updateProbabilityTotal();
    document.getElementById('tooManyWarning').style.display =
      config.segments.length > 20 ? 'block' : 'none';

    document.getElementById('settingsModal').classList.add('active');
  }

  function closeSettings() {
    document.getElementById('settingsModal').classList.remove('active');
  }

  function renderSegmentsList() {
    var list = document.getElementById('segmentsList');
    list.innerHTML = '';

    document.getElementById('segmentCount').textContent =
      '(' + config.segments.length + ')';

    config.segments.forEach(function (seg, i) {
      var item = document.createElement('div');
      item.className = 'segment-item';
      item.innerHTML =
        '<span class="segment-color" style="background:' + getSegmentColor(i) + '"></span>' +
        '<input type="text" value="' + escapeAttr(seg.name) + '" data-index="' + i + '" class="seg-name">' +
        '<input type="number" value="' + seg.probability + '" min="0" max="100" step="0.5" data-index="' + i + '" class="seg-prob">' +
        '<span style="font-size:0.8rem;color:var(--text-secondary)">%</span>' +
        '<button class="segment-delete" data-index="' + i + '">&times;</button>';
      list.appendChild(item);
    });

    list.querySelectorAll('.seg-name').forEach(function (input) {
      input.addEventListener('change', function () {
        config.segments[parseInt(this.dataset.index)].name = this.value;
      });
    });

    list.querySelectorAll('.seg-prob').forEach(function (input) {
      input.addEventListener('change', function () {
        config.segments[parseInt(this.dataset.index)].probability =
          parseFloat(this.value) || 0;
        updateProbabilityTotal();
      });
    });

    list.querySelectorAll('.segment-delete').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (config.segments.length <= 2) {
          alert('\u041C\u0438\u043D\u0438\u043C\u0443\u043C 2 \u0441\u0435\u0433\u043C\u0435\u043D\u0442\u0430!');
          return;
        }
        config.segments.splice(parseInt(this.dataset.index), 1);
        renderSegmentsList();
        updateProbabilityTotal();
      });
    });
  }

  function updateProbabilityTotal() {
    var total = getTotalProbability();
    var el = document.getElementById('totalProbability');
    el.textContent = Math.round(total * 10) / 10 + '%';
    el.style.color = Math.abs(total - 100) < 0.1 ? 'var(--primary)' : 'var(--danger)';
  }

  function addSegment() {
    if (config.segments.length >= 50) {
      alert('\u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C 50 \u0441\u0435\u0433\u043C\u0435\u043D\u0442\u043E\u0432!');
      return;
    }
    config.segments.push({
      name: '\u041D\u043E\u0432\u044B\u0439 \u0441\u0435\u0433\u043C\u0435\u043D\u0442',
      probability: Math.round(100 / (config.segments.length + 1) * 10) / 10
    });
    renderSegmentsList();
    updateProbabilityTotal();
    document.getElementById('tooManyWarning').style.display =
      config.segments.length > 20 ? 'block' : 'none';
  }

  function applyTheme(theme) {
    document.body.className = 'theme-' + theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      var colors = { light: '#f5f5f5', dark: '#1a1a2e', kawaii: '#1a0a1a' };
      meta.setAttribute('content', colors[theme] || colors.light);
    }
    applyBackgroundImage();
  }

  function saveSettings() {
    config.name = document.getElementById('wheelNameInput').value || '\u041A\u043E\u043B\u0435\u0441\u043E \u0424\u043E\u0440\u0442\u0443\u043D\u044B';
    config.backgroundImage = document.getElementById('bgUrlInput').value.trim();
    config.showScore = document.getElementById('showScoreCheckbox').checked;
    normalizeProbabilities();
    saveConfig();
    applyTheme(config.theme);
    document.getElementById('wheelTitle').textContent = config.name;
    document.title = config.name;
    applyScoreVisibility();
    drawWheel();
    closeSettings();
  }

  function resetSettings() {
    if (!confirm('\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u0432\u0441\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u043A \u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u044B\u043C?')) return;
    config = JSON.parse(JSON.stringify(defaultConfig));
    saveConfig();
    applyTheme(config.theme);
    document.getElementById('wheelTitle').textContent = config.name;
    document.title = config.name;
    applyScoreVisibility();
    drawWheel();
    closeSettings();
  }

  function applyScoreVisibility() {
    var panel = document.querySelector('.score-panel');
    if (panel) {
      panel.style.display = config.showScore ? 'flex' : 'none';
    }
  }

  /* ============================================
     10. IMPORT / EXPORT JSON
     ============================================ */
  function exportConfig() {
    var blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (config.name || 'roulette') + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importConfig(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var imported = JSON.parse(e.target.result);
        if (!imported.segments || !Array.isArray(imported.segments) || imported.segments.length < 2) {
          alert('\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442: \u043D\u0443\u0436\u043D\u044B \u043C\u0438\u043D\u0438\u043C\u0443\u043C 2 \u0441\u0435\u0433\u043C\u0435\u043D\u0442\u0430');
          return;
        }
        config = imported;
        if (config.backgroundImage === undefined) config.backgroundImage = '';
        if (config.showScore === undefined) config.showScore = true;
        normalizeProbabilities();
        saveConfig();
        applyTheme(config.theme);
        document.getElementById('wheelTitle').textContent = config.name;
        document.title = config.name;
        applyScoreVisibility();
        drawWheel();
        alert('\u041A\u043E\u043D\u0444\u0438\u0433 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D!');
      } catch (err) {
        alert('\u041E\u0448\u0438\u0431\u043A\u0430 \u0447\u0442\u0435\u043D\u0438\u044F JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  /* ============================================
     11. UTILITIES
     ============================================ */
  function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escapeHTML(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ============================================
     12. EVENT LISTENERS & INIT
     ============================================ */
  function init() {
    applyTheme(config.theme);
    document.getElementById('wheelTitle').textContent = config.name;
    document.title = config.name;
    updateScoreDisplay();
    applyScoreVisibility();
    renderHistory();
    drawWheel();
    initPlatform();

    // Spin button
    document.getElementById('spinBtn').addEventListener('click', spinWheel);

    // Reset score
    document.getElementById('resetBtn').addEventListener('click', function () {
      if (confirm('\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u0441\u0447\u0451\u0442?')) {
        score = 0;
        saveScore();
        updateScoreDisplay();
      }
    });

    // Settings
    document.getElementById('settingsBtn').addEventListener('click', openSettings);
    document.getElementById('closeSettings').addEventListener('click', closeSettings);
    document.getElementById('addSegmentBtn').addEventListener('click', addSegment);
    document.getElementById('saveBtn').addEventListener('click', saveSettings);
    document.getElementById('resetSettingsBtn').addEventListener('click', resetSettings);

    // Shuffle
    document.getElementById('shuffleBtn').addEventListener('click', function () {
      shuffleSegments();
      renderSegmentsList();
      drawWheel();
    });

    // Theme buttons
    document.querySelectorAll('.theme-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        config.theme = this.dataset.theme;
        document.querySelectorAll('.theme-btn').forEach(function (b) {
          b.classList.remove('active');
        });
        this.classList.add('active');
      });
    });

    // Show score checkbox
    document.getElementById('showScoreCheckbox').addEventListener('change', function () {
      config.showScore = this.checked;
      saveConfig();
      applyScoreVisibility();
    });

    // Close result modal
    document.getElementById('closeResult').addEventListener('click', function () {
      document.getElementById('resultModal').classList.remove('active');
    });

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(function (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    });

    // Load from localStorage (reload button in settings)
    document.getElementById('loadBtn').addEventListener('click', function () {
      config = loadConfig();
      applyTheme(config.theme);
      document.getElementById('wheelTitle').textContent = config.name;
      document.title = config.name;
      applyScoreVisibility();
      openSettings();
    });

    // Export JSON
    document.getElementById('exportBtn').addEventListener('click', exportConfig);

    // Import JSON
    document.getElementById('importBtn').addEventListener('click', function () {
      document.getElementById('importFileInput').click();
    });
    document.getElementById('importFileInput').addEventListener('change', function () {
      if (this.files && this.files[0]) {
        importConfig(this.files[0]);
        this.value = '';
      }
    });

    // Background URL live preview
    document.getElementById('bgUrlInput').addEventListener('change', function () {
      config.backgroundImage = this.value.trim();
      applyBackgroundImage();
    });

    // Handle resize
    var resizeTimeout;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(drawWheel, 150);
    });
  }

  // Service Worker registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (e) {
        console.warn('SW registration failed:', e);
      });
    });
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
