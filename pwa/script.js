(function () {
  'use strict';

  /* ============================================
     1. COLOR PALETTE
     ============================================ */
  var PALETTE = [
    '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
    '#1abc9c', '#3498db', '#9b59b6', '#e84393',
    '#00b894', '#6c5ce7', '#fd79a8', '#00cec9'
  ];

  function getSegmentColor(index) {
    return PALETTE[index % PALETTE.length];
  }

  /* ============================================
     2. DEFAULT CONFIG
     ============================================ */
  var defaultConfig = {
    name: '\u041A\u043E\u043B\u0435\u0441\u043E \u0424\u043E\u0440\u0442\u0443\u043D\u044B',
    theme: 'light',
    backgroundImage: '',
    showScore: true,
    spinCost: 0,
    startingPoints: 0,
    groups: [
      {
        name: '\u041E\u0441\u043D\u043E\u0432\u043D\u0430\u044F',
        enabled: true,
        segments: [
          { name: '\u0412\u044B\u0438\u0433\u0440\u044B\u0448 100', weight: 1, points: 100 },
          { name: '\u0412\u044B\u0438\u0433\u0440\u044B\u0448 50', weight: 1, points: 50 },
          { name: '\u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u0435\u0449\u0451', weight: 1, points: 0 },
          { name: '\u0411\u0438\u043B\u0435\u0442', weight: 1, points: 10 },
          { name: '\u0414\u0436\u0435\u043A\u043F\u043E\u0442 500', weight: 0.5, points: 500 },
          { name: '\u041F\u0443\u0441\u0442\u043E', weight: 2, points: 0 },
          { name: '\u0411\u043E\u043D\u0443\u0441 \u04452', weight: 1, points: 75 },
          { name: '\u0412\u044B\u0438\u0433\u0440\u044B\u0448 20', weight: 1, points: 20 }
        ]
      }
    ]
  };

  /* ============================================
     3. CONFIG MANAGEMENT + MIGRATION
     ============================================ */
  var STORAGE_KEY = 'rouletteConfig';
  var SCORE_KEY = 'rouletteScore';
  var HISTORY_KEY = 'rouletteHistory';

  var config = loadConfig();
  var score = loadScore();
  var history = loadHistory();
  var currentRotation = 0;
  var isSpinning = false;
  var dragState = null;
  var expandedGroups = new Set();

  function migrateConfig(parsed) {
    if (parsed.segments && Array.isArray(parsed.segments) && !parsed.groups) {
      var segs = parsed.segments.map(function (s) {
        return {
          name: s.name || '\u0421\u0435\u0433\u043C\u0435\u043D\u0442',
          weight: s.probability ? s.probability / (100 / parsed.segments.length) : 1,
          points: s.probability || 1
        };
      });
      parsed.groups = [{
        name: '\u041E\u0441\u043D\u043E\u0432\u0430\u044F',
        enabled: true,
        segments: segs
      }];
      delete parsed.segments;
    }
    if (!parsed.groups) parsed.groups = defaultConfig.groups;
    if (parsed.spinCost === undefined) parsed.spinCost = 0;
    if (parsed.startingPoints === undefined) parsed.startingPoints = 0;
    if (parsed.backgroundImage === undefined) parsed.backgroundImage = '';
    if (parsed.showScore === undefined) parsed.showScore = true;
    parsed.groups.forEach(function (g) {
      if (g.enabled === undefined) g.enabled = true;
      if (!g.segments) g.segments = [];
      g.segments.forEach(function (s) {
        if (s.weight === undefined) s.weight = 1;
        if (s.points === undefined) s.points = 0;
      });
    });
    return parsed;
  }

  function loadConfig() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        var parsed = JSON.parse(saved);
        if (parsed.groups && parsed.groups.length > 0) {
          return migrateConfig(parsed);
        }
        if (parsed.segments) {
          return migrateConfig(parsed);
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
      var saved = localStorage.getItem(SCORE_KEY);
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch (e) {
      return 0;
    }
  }

  function saveScore() {
    try {
      localStorage.setItem(SCORE_KEY, String(score));
    } catch (e) {}
  }

  function loadHistory() {
    try {
      var saved = localStorage.getItem(HISTORY_KEY);
      if (saved) {
        var arr = JSON.parse(saved);
        if (Array.isArray(arr)) return arr.slice(-3);
      }
    } catch (e) {}
    return [];
  }

  function saveHistory() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-3)));
    } catch (e) {}
  }

  /* ============================================
     4. ACTIVE SEGMENTS (from all enabled groups)
     ============================================ */
  function getActiveSegments() {
    var result = [];
    config.groups.forEach(function (group) {
      if (group.enabled) {
        group.segments.forEach(function (seg) {
          result.push({ name: seg.name, weight: seg.weight || 1, points: seg.points || 0 });
        });
      }
    });
    return result;
  }

  function getTotalWeight(segments) {
    return segments.reduce(function (sum, s) { return sum + (s.weight || 1); }, 0);
  }

  /* ============================================
     5. PLATFORM DETECTION
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
        userInfo.textContent = 'Telegram: ' + (user.first_name || user.username || '\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C');
      }
    } else if (platform === 'max') {
      var mx = window.WebApp;
      if (mx.expand) mx.expand();
      if (mx.initDataUnsafe && mx.initDataUnsafe.user) {
        var u = mx.initDataUnsafe.user;
        userInfo.textContent = 'MAX: ' + (u.first_name || u.username || '\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C');
      }
    }
  }

  /* ============================================
     6. WHEEL RENDERING (Canvas)
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
    var segments = getActiveSegments();
    var total = getTotalWeight(segments);
    var count = segments.length;

    ctx.clearRect(0, 0, displaySize, displaySize);

    if (count === 0 || total === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
      ctx.fillStyle = '#555';
      ctx.fill();
      ctx.font = '16px -apple-system, sans-serif';
      ctx.fillStyle = '#aaa';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u041D\u0435\u0442 \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0445 \u0441\u0435\u0433\u043C\u0435\u043D\u0442\u043E\u0432', cx, cy);
      return;
    }

    ctx.beginPath();
    ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
    ctx.fillStyle = '#333';
    ctx.fill();

    var currentAngle = -Math.PI / 2;
    var colorIdx = 0;
    var globalIdx = 0;

    config.groups.forEach(function (group) {
      if (!group.enabled) return;
      group.segments.forEach(function (seg) {
        var sliceAngle = ((seg.weight || 1) / total) * Math.PI * 2;
        var startAngle = currentAngle;
        var endAngle = currentAngle + sliceAngle;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = getSegmentColor(colorIdx);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (sliceAngle > 0.18) {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(startAngle + sliceAngle / 2);
          var scale = displaySize / 400;
          var fontSize = (sliceAngle > 0.6 ? 14 : sliceAngle > 0.35 ? 11 : 9) * scale;
          ctx.font = 'bold ' + fontSize + 'px -apple-system, sans-serif';
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 3;
          var maxLen = sliceAngle > 0.6 ? 14 : sliceAngle > 0.35 ? 10 : 7;
          var displayName = seg.name.length > maxLen ? seg.name.slice(0, maxLen - 1) + '\u2026' : seg.name;
          ctx.fillText(displayName, radius * 0.6, 0);
          ctx.restore();
        }

        currentAngle = endAngle;
        colorIdx++;
        globalIdx++;
      });
    });

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
     7. SPIN LOGIC
     ============================================ */
  function weightedRandom(segments, total) {
    var random = Math.random() * total;
    for (var i = 0; i < segments.length; i++) {
      random -= (segments[i].weight || 1);
      if (random <= 0) return i;
    }
    return segments.length - 1;
  }

  function getSegmentByAngle(pointerScanAngle, segments, total) {
    var accumulated = 0;
    for (var i = 0; i < segments.length; i++) {
      accumulated += (segments[i].weight || 1) / total * 360;
      if (pointerScanAngle < accumulated) return i;
    }
    return segments.length - 1;
  }

  function spinWheel() {
    if (isSpinning) return;

    var segments = getActiveSegments();
    var total = getTotalWeight(segments);
    if (segments.length === 0 || total === 0) return;

    if (config.spinCost > 0 && score < config.spinCost) return;

    isSpinning = true;
    var spinBtn = document.getElementById('spinBtn');
    spinBtn.disabled = true;

    if (config.spinCost > 0) {
      score -= config.spinCost;
      saveScore();
      updateScoreDisplay();
      updateSpinButton();
    }

    var selectedIndex = weightedRandom(segments, total);

    var angleBefore = 0;
    for (var i = 0; i < selectedIndex; i++) {
      angleBefore += (segments[i].weight || 1) / total * 360;
    }
    var sliceAngle = (segments[selectedIndex].weight || 1) / total * 360;
    var randomOffset = Math.random() * sliceAngle;
    var spinAngleDeg = angleBefore + randomOffset;

    var fullRotations = 5 + Math.floor(Math.random() * 4);
    var totalSpin = fullRotations * 360 + spinAngleDeg;

    currentRotation += totalSpin;
    canvas.style.transform = 'rotate(' + currentRotation + 'deg)';
    canvas.classList.add('spinning');

    setTimeout(function () {
      canvas.classList.remove('spinning');
      var pointerScanAngle = ((currentRotation % 360) + 360) % 360;
      var detectedIndex = getSegmentByAngle(pointerScanAngle, segments, total);
      if (detectedIndex !== selectedIndex) {
        console.error('SPIN MISMATCH: selected=' + selectedIndex + ' detected=' + detectedIndex + ' angle=' + pointerScanAngle);
      }
      showResult(segments[detectedIndex]);
      isSpinning = false;
      spinBtn.disabled = false;
      updateSpinButton();
    }, 4200);
  }

  /* ============================================
     8. RESULT DISPLAY + HISTORY
     ============================================ */
  function showResult(segment) {
    var points = segment.points || 0;
    score += points;
    saveScore();
    updateScoreDisplay();

    var colorIdx = findSegmentColorIndex(segment);
    history.push({ name: segment.name, points: points, color: getSegmentColor(colorIdx), time: Date.now() });
    if (history.length > 3) history = history.slice(-3);
    saveHistory();
    renderHistory();

    var emoji = '\uD83C\uDFB0';
    if (points > 100) emoji = '\uD83E\uDD11';
    else if (points > 0) emoji = '\uD83C\uDF89';
    else if (points === 0) emoji = '\uD83D\uDE05';

    document.getElementById('resultEmoji').textContent = emoji;
    document.getElementById('resultText').textContent = segment.name;
    document.getElementById('resultPoints').textContent =
      points > 0 ? '+' + points + ' \u043E\u0447\u043A\u043E\u0432' : points < 0 ? points + ' \u043E\u0447\u043A\u043E\u0432' : '\u0411\u0435\u0437 \u043E\u0447\u043A\u043E\u0432';

    document.getElementById('resultModal').classList.add('active');
    sendResultToBot(segment.name, points);
  }

  function findSegmentColorIndex(targetSeg) {
    var idx = 0;
    for (var gi = 0; gi < config.groups.length; gi++) {
      var g = config.groups[gi];
      if (!g.enabled) continue;
      for (var si = 0; si < g.segments.length; si++) {
        if (g.segments[si].name === targetSeg.name && (g.segments[si].weight || 1) === (targetSeg.weight || 1)) {
          return idx;
        }
        idx++;
      }
    }
    return 0;
  }

  function updateScoreDisplay() {
    document.getElementById('scoreValue').textContent = score;
  }

  function updateSpinButton() {
    var spinBtn = document.getElementById('spinBtn');
    var sessionBtn = document.getElementById('newSessionBtn');
    if (config.spinCost > 0 && score < config.spinCost) {
      spinBtn.textContent = '\u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0431\u0430\u043B\u043B\u043E\u0432';
      spinBtn.disabled = true;
      sessionBtn.style.display = 'inline-block';
    } else {
      spinBtn.textContent = '\u041A\u0440\u0443\u0442\u0438\u0442\u044C';
      sessionBtn.style.display = config.spinCost > 0 ? 'inline-block' : 'none';
    }
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

  function newSession() {
    score = config.startingPoints || 0;
    history = [];
    saveScore();
    saveHistory();
    updateScoreDisplay();
    renderHistory();
    updateSpinButton();
  }

  /* ============================================
     9. BOT INTEGRATION
     ============================================ */
  function sendResultToBot(segmentName, points) {
    var platform = detectPlatform();
    try {
      var data = JSON.stringify({ segment: segmentName, points: points });
      if (platform === 'telegram' && window.Telegram.WebApp && window.Telegram.WebApp.sendData) {
        window.Telegram.WebApp.sendData(data);
      } else if (platform === 'max' && window.WebApp && window.WebApp.sendData) {
        window.WebApp.sendData(data);
      }
    } catch (e) {}
  }

  /* ============================================
     10. BACKGROUND IMAGE
     ============================================ */
  function applyBackgroundImage() {
    if (config.backgroundImage && config.backgroundImage.trim()) {
      document.body.style.backgroundImage = 'url(' + config.backgroundImage + ')';
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundRepeat = 'no-repeat';
    } else {
      document.body.style.backgroundImage = 'none';
    }
  }

  /* ============================================
     11. SETTINGS UI
     ============================================ */
  function openSettings() {
    document.getElementById('wheelNameInput').value = config.name;
    document.getElementById('bgUrlInput').value = config.backgroundImage || '';
    document.getElementById('showScoreCheckbox').checked = config.showScore;
    document.getElementById('spinCostInput').value = config.spinCost || 0;
    document.getElementById('startingPointsInput').value = config.startingPoints || 0;

    document.querySelectorAll('.theme-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.theme === config.theme);
    });

    renderGroupsList();
    document.getElementById('settingsModal').classList.add('active');
  }

  function closeSettings() {
    document.getElementById('settingsModal').classList.remove('active');
  }

  /* ---------- GROUPS ---------- */
  function renderGroupsList() {
    var container = document.getElementById('groupsContainer');
    var prevBodies = container.querySelectorAll('.group-body');
    expandedGroups.clear();
    prevBodies.forEach(function (b, i) {
      if (b.style.display !== 'none') expandedGroups.add(i);
    });

    container.innerHTML = '';

    config.groups.forEach(function (group, gi) {
      var groupEl = document.createElement('div');
      groupEl.className = 'group-item';
      groupEl.dataset.groupIndex = gi;

      var header = document.createElement('div');
      header.className = 'group-header';
      header.innerHTML =
        '<span class="group-toggle" data-gi="' + gi + '">' + (group.enabled ? '\u25BC' : '\u25B6') + '</span>' +
        '<input type="text" class="group-name-input" value="' + escapeAttr(group.name) + '" data-gi="' + gi + '">' +
        '<label class="group-enabled-label"><input type="checkbox" class="group-enabled-cb" data-gi="' + gi + '"' + (group.enabled ? ' checked' : '') + '>\u0412\u043A\u043B</label>' +
        '<button class="group-delete-btn" data-gi="' + gi + '">&times;</button>';

      var body = document.createElement('div');
      body.className = 'group-body';
      var isExpanded = expandedGroups.has(gi);
      body.style.display = isExpanded ? 'block' : 'none';

      group.segments.forEach(function (seg, si) {
        body.appendChild(createSegmentItem(gi, si, seg));
      });

      var addBtn = document.createElement('button');
      addBtn.className = 'add-segment-btn';
      addBtn.textContent = '+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0441\u0435\u0433\u043C\u0435\u043D\u0442';
      addBtn.addEventListener('click', function () {
        if (config.groups[gi].segments.length >= 50) {
          alert('\u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C 50 \u0441\u0435\u0433\u043C\u0435\u043D\u0442\u043E\u0432 \u0432 \u0433\u0440\u0443\u043F\u043F\u0435!');
          return;
        }
        config.groups[gi].segments.push({ name: '\u041D\u043E\u0432\u044B\u0439', weight: 1, points: 0 });
        renderGroupsList();
      });
      body.appendChild(addBtn);

      groupEl.appendChild(header);
      groupEl.appendChild(body);
      container.appendChild(groupEl);

      header.querySelector('.group-toggle').addEventListener('click', function () {
        var isVisible = body.style.display !== 'none';
        body.style.display = isVisible ? 'none' : 'block';
        this.textContent = isVisible ? '\u25B6' : '\u25BC';
      });

      header.querySelector('.group-name-input').addEventListener('change', function () {
        config.groups[gi].name = this.value;
      });

      header.querySelector('.group-enabled-cb').addEventListener('change', function () {
        config.groups[gi].enabled = this.checked;
        header.querySelector('.group-toggle').textContent = this.checked ? '\u25BC' : '\u25B6';
        drawWheel();
      });

      header.querySelector('.group-delete-btn').addEventListener('click', function () {
        if (config.groups.length <= 1) {
          alert('\u0414\u043E\u043B\u0436\u043D\u0430 \u0431\u044B\u0442\u044C \u0445\u043E\u0442\u044F \u043E\u0434\u043D\u0430 \u0433\u0440\u0443\u043F\u043F\u0430!');
          return;
        }
        if (confirm('\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0433\u0440\u0443\u043F\u043F\u0443 "' + config.groups[gi].name + '"?')) {
          config.groups.splice(gi, 1);
          renderGroupsList();
        }
      });

      setupDragAndDrop(body, gi);
    });
  }

  function createSegmentItem(gi, si, seg) {
    var total = 0;
    config.groups.forEach(function (g) {
      if (g.enabled) g.segments.forEach(function (s) { total += (s.weight || 1); });
    });
    var pct = total > 0 ? ((seg.weight || 1) / total * 100) : 0;

    var item = document.createElement('div');
    item.className = 'segment-item';
    item.draggable = true;
    item.dataset.groupIndex = gi;
    item.dataset.segmentIndex = si;

    item.innerHTML =
      '<div class="seg-drag-handle">\u2630</div>' +
      '<span class="segment-color" style="background:' + getSegmentColor(findGlobalIndex(gi, si)) + '"></span>' +
      '<div class="seg-fields">' +
        '<input type="text" class="seg-name" value="' + escapeAttr(seg.name) + '" placeholder="\u0418\u043C\u044F">' +
        '<div class="seg-numbers">' +
          '<div class="seg-field"><label>\u0412\u0435\u0441</label>' +
            '<input type="number" class="seg-weight" value="' + (seg.weight || 1) + '" min="0.1" step="0.1" data-gi="' + gi + '" data-si="' + si + '">' +
          '</div>' +
          '<div class="seg-field"><label>\u041E\u0447\u043A\u0438</label>' +
            '<input type="number" class="seg-points" value="' + (seg.points || 0) + '" data-gi="' + gi + '" data-si="' + si + '">' +
          '</div>' +
          '<div class="seg-field seg-pct"><label>\u0428\u0430\u043D\u0441</label>' +
            '<span class="seg-pct-value">' + Math.round(pct * 10) / 10 + '%</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<button class="segment-delete" data-gi="' + gi + '" data-si="' + si + '">&times;</button>';

    item.querySelector('.seg-name').addEventListener('change', function () {
      config.groups[gi].segments[si].name = this.value;
    });

    item.querySelector('.seg-weight').addEventListener('change', function () {
      config.groups[gi].segments[si].weight = parseFloat(this.value) || 1;
      renderGroupsList();
    });

    item.querySelector('.seg-points').addEventListener('change', function () {
      config.groups[gi].segments[si].points = parseInt(this.value, 10) || 0;
    });

    item.querySelector('.segment-delete').addEventListener('click', function () {
      config.groups[gi].segments.splice(si, 1);
      renderGroupsList();
    });

    return item;
  }

  function findGlobalIndex(gi, si) {
    var idx = 0;
    for (var g = 0; g < gi; g++) {
      idx += config.groups[g].segments.length;
    }
    return idx + si;
  }

  /* ---------- DRAG AND DROP ---------- */
  function setupDragAndDrop(container, gi) {
    var items = container.querySelectorAll('.segment-item');
    items.forEach(function (item) {
      item.addEventListener('dragstart', function (e) {
        dragState = { gi: gi, si: parseInt(this.dataset.segmentIndex) };
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      item.addEventListener('dragend', function () {
        this.classList.remove('dragging');
        container.querySelectorAll('.segment-item').forEach(function (el) {
          el.classList.remove('drag-over');
        });
        dragState = null;
      });

      item.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        this.classList.add('drag-over');
      });

      item.addEventListener('dragleave', function () {
        this.classList.remove('drag-over');
      });

      item.addEventListener('drop', function (e) {
        e.preventDefault();
        this.classList.remove('drag-over');
        if (!dragState) return;

        var fromSi = dragState.si;
        var toSi = parseInt(this.dataset.segmentIndex);

        if (fromSi === toSi) return;

        var segs = config.groups[gi].segments;
        var moved = segs.splice(fromSi, 1)[0];
        segs.splice(toSi, 0, moved);

        renderGroupsList();
      });
    });
  }

  /* ---------- ADD GROUP ---------- */
  function addGroup() {
    config.groups.push({
      name: '\u0413\u0440\u0443\u043F\u043F\u0430 ' + (config.groups.length + 1),
      enabled: true,
      segments: [{ name: '\u0421\u0435\u0433\u043C\u0435\u043D\u0442', weight: 1, points: 0 }]
    });
    renderGroupsList();
  }

  /* ---------- SAVE SETTINGS ---------- */
  function saveSettings() {
    config.name = document.getElementById('wheelNameInput').value || '\u041A\u043E\u043B\u0435\u0441\u043E \u0424\u043E\u0440\u0442\u0443\u043D\u044B';
    config.backgroundImage = document.getElementById('bgUrlInput').value.trim();
    config.showScore = document.getElementById('showScoreCheckbox').checked;
    config.spinCost = parseInt(document.getElementById('spinCostInput').value, 10) || 0;
    config.startingPoints = parseInt(document.getElementById('startingPointsInput').value, 10) || 0;

    if (config.spinCost > 0 && config.startingPoints < config.spinCost) {
      alert('\u0412\u043D\u0438\u043C\u0430\u043D\u0438\u0435! \u0421\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C \u0432\u0440\u0430\u0449\u0435\u043D\u0438\u044F (' + config.spinCost + ') \u0432\u044B\u0448\u0435, \u0447\u0435\u043C \u043D\u0430\u0447\u0430\u043B\u044C\u043D\u043E\u0435 \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u043E\u0447\u043A\u043E\u0432 (' + config.startingPoints + '). \u0418\u0441\u043F\u0440\u0430\u0432\u044C\u0442\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435.');
      return;
    }

    saveConfig();
    applyTheme(config.theme);
    document.getElementById('wheelTitle').textContent = config.name;
    document.title = config.name;
    applyScoreVisibility();
    updateSpinButton();
    drawWheel();
    closeSettings();
  }

  function resetSettings() {
    if (!confirm('\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u0432\u0441\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u043A \u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u044B\u043C?')) return;
    config = JSON.parse(JSON.stringify(defaultConfig));
    newSession();
    saveConfig();
    applyTheme(config.theme);
    document.getElementById('wheelTitle').textContent = config.name;
    document.title = config.name;
    applyScoreVisibility();
    updateSpinButton();
    drawWheel();
    closeSettings();
  }

  function applyTheme(theme) {
    document.body.className = 'theme-' + theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      var colors = { light: '#f5f5f5', dark: '#1a1a2e', contrast: '#0a0a0a' };
      meta.setAttribute('content', colors[theme] || colors.light);
    }
    applyBackgroundImage();
  }

  function applyScoreVisibility() {
    var panel = document.querySelector('.score-panel');
    if (panel) panel.style.display = config.showScore ? 'flex' : 'none';
  }

  /* ============================================
     12. IMPORT / EXPORT JSON
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
        imported = migrateConfig(imported);
        if (!imported.groups || imported.groups.length === 0) {
          alert('\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442');
          return;
        }
        config = imported;
        saveConfig();
        applyTheme(config.theme);
        document.getElementById('wheelTitle').textContent = config.name;
        document.title = config.name;
        applyScoreVisibility();
        updateSpinButton();
        drawWheel();
        alert('\u041A\u043E\u043D\u0444\u0438\u0433 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D!');
      } catch (err) {
        alert('\u041E\u0448\u0438\u0431\u043A\u0430: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  /* ============================================
     12.5. SHARE VIA URL HASH
     ============================================ */
  var KEY_MAP = { name: 'n', theme: 't', backgroundImage: 'bg', showScore: 'sc', spinCost: 'sp', startingPoints: 'st', groups: 'g', enabled: 'e', segments: 's', weight: 'w', points: 'p' };
  var KEY_MAP_REV = {}; (function () { for (var k in KEY_MAP) KEY_MAP_REV[KEY_MAP[k]] = k; })();

  function encodeConfig(cfg) {
    var o = {};
    if (cfg.name) o.n = cfg.name;
    if (cfg.theme && cfg.theme !== 'light') o.t = cfg.theme;
    if (cfg.backgroundImage) o.bg = cfg.backgroundImage;
    if (cfg.showScore === false) o.sc = false;
    if (cfg.spinCost) o.sp = cfg.spinCost;
    if (cfg.startingPoints) o.st = cfg.startingPoints;
    if (cfg.groups) {
      o.g = cfg.groups.map(function (gr) {
        var go = {};
        if (gr.name) go.n = gr.name;
        if (gr.enabled === false) go.e = false;
        if (gr.segments) {
          go.s = gr.segments.map(function (sg) {
            var so = {};
            if (sg.name) so.n = sg.name;
            if (sg.weight && sg.weight !== 1) so.w = sg.weight;
            if (sg.points) so.p = sg.points;
            return so;
          });
        }
        return go;
      });
    }
    var json = JSON.stringify(o);
    var b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decodeConfig(hash) {
    try {
      var b64 = hash.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      var json = decodeURIComponent(escape(atob(b64)));
      var o = JSON.parse(json);
      var cfg = {};
      cfg.name = o.n || '\u041A\u043E\u043B\u0435\u0441\u043E \u0424\u043E\u0440\u0442\u0443\u043D\u044B';
      cfg.theme = o.t || 'light';
      cfg.backgroundImage = o.bg || '';
      cfg.showScore = o.sc !== false;
      cfg.spinCost = o.sp || 0;
      cfg.startingPoints = o.st || 0;
      cfg.groups = (o.g || []).map(function (gr) {
        var group = {};
        group.name = gr.n || '\u0413\u0440\u0443\u043F\u043F\u0430';
        group.enabled = gr.e !== false;
        group.segments = (gr.s || []).map(function (sg) {
          return { name: sg.n || '\u0421\u0435\u0433\u043C\u0435\u043D\u0442', weight: sg.w || 1, points: sg.p || 0 };
        });
        return group;
      });
      return migrateConfig(cfg);
    } catch (e) {
      return null;
    }
  }

  var MAX_HASH_LENGTH = 8000;
  var pendingShareConfig = null;

  function checkShareLink() {
    var hash = location.hash.slice(1);
    if (!hash || hash.length < 2) return;
    var decoded = decodeConfig(hash);
    if (!decoded || !decoded.groups || decoded.groups.length === 0) {
      history.replaceState(null, '', location.pathname + location.search);
      return;
    }
    pendingShareConfig = decoded;
    showSharePreview(decoded);
  }

  function showSharePreview(cfg) {
    var themeNames = { light: '\u0421\u0432\u0435\u0442\u043B\u0430\u044F', dark: '\u0422\u0451\u043C\u043D\u0430\u044F', contrast: '\u041A\u043E\u043D\u0442\u0440\u0430\u0441\u0442\u043D\u0430\u044F' };
    var totalSegments = 0;
    cfg.groups.forEach(function (g) { totalSegments += (g.segments || []).length; });

    var html = '<div class="share-preview-list">' +
      '<div class="share-preview-item"><span class="share-preview-label">\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435:</span><span class="share-preview-value">' + escapeHTML(cfg.name) + '</span></div>' +
      '<div class="share-preview-item"><span class="share-preview-label">\u0422\u0435\u043C\u0430:</span><span class="share-preview-value">' + (themeNames[cfg.theme] || cfg.theme) + '</span></div>' +
      '<div class="share-preview-item"><span class="share-preview-label">\u0424\u043E\u043D:</span><span class="share-preview-value">' + (cfg.backgroundImage ? '\u0417\u0430\u0434\u0430\u043D' : '\u041D\u0435\u0442') + '</span></div>' +
      '<div class="share-preview-item"><span class="share-preview-label">\u0413\u0440\u0443\u043F\u043F:</span><span class="share-preview-value">' + cfg.groups.length + '</span></div>' +
      '<div class="share-preview-item"><span class="share-preview-label">\u0421\u0435\u0433\u043C\u0435\u043D\u0442\u043E\u0432:</span><span class="share-preview-value">' + totalSegments + '</span></div>' +
      '</div>';
    document.getElementById('sharePreviewContent').innerHTML = html;
    document.getElementById('sharePreviewModal').classList.add('active');
  }

  function applyShareConfig() {
    if (!pendingShareConfig) return;
    config = pendingShareConfig;
    saveConfig();
    applyTheme(config.theme);
    document.getElementById('wheelTitle').textContent = config.name;
    document.title = config.name;
    applyScoreVisibility();
    updateSpinButton();
    drawWheel();
    pendingShareConfig = null;
    history.replaceState(null, '', location.pathname + location.search);
    document.getElementById('sharePreviewModal').classList.remove('active');
  }

  function generateShareLink() {
    var hash = encodeConfig(config);
    if (hash.length > MAX_HASH_LENGTH) {
      alert('\u041A\u043E\u043D\u0444\u0438\u0433 \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0439 \u0434\u043B\u044F \u0448\u0430\u0440\u0438\u043D\u0433\u0430 (\u0441\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u043D\u043E\u0433\u043E \u0441\u0435\u0433\u043C\u0435\u043D\u0442\u043E\u0432 \u0438\u043B\u0438 \u0434\u043B\u0438\u043D\u043D\u044B\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F). \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0443\u043A\u043E\u0440\u043E\u0447\u0438\u0442\u044C \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F \u0438\u043B\u0438 \u0443\u0431\u0440\u0430\u0442\u044C \u043D\u0435\u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u0433\u0440\u0443\u043F\u043F\u044B.');
      return;
    }
    var url = location.origin + location.pathname + '#' + hash;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        alert('\u0421\u0441\u044B\u043B\u043A\u0430 \u0441\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u0430 \u0432 \u0431\u0443\u0444\u0435\u0440 \u043E\u0431\u043C\u0435\u043D\u0430!');
      }).catch(function () {
        prompt('\u0421\u043A\u043E\u043F\u0438\u0440\u0443\u0439\u0442\u0435 \u0441\u0441\u044B\u043B\u043A\u0443:', url);
      });
    } else {
      prompt('\u0421\u043A\u043E\u043F\u0438\u0440\u0443\u0439\u0442\u0435 \u0441\u0441\u044B\u043B\u043A\u0443:', url);
    }
  }

  /* ============================================
     13. UTILITIES
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
     14. EVENT LISTENERS & INIT
     ============================================ */
  function init() {
    applyTheme(config.theme);
    document.getElementById('wheelTitle').textContent = config.name;
    document.title = config.name;
    updateScoreDisplay();
    applyScoreVisibility();
    renderHistory();
    drawWheel();
    updateSpinButton();
    initPlatform();

    document.getElementById('spinBtn').addEventListener('click', spinWheel);

    document.getElementById('newSessionBtn').addEventListener('click', function () {
      if (confirm('\u041D\u0430\u0447\u0430\u0442\u044C \u043D\u043E\u0432\u0443\u044E \u0441\u0435\u0441\u0441\u0438\u044E? \u041E\u0447\u043A\u0438 \u0438 \u0438\u0441\u0442\u043E\u0440\u0438\u044F \u0431\u0443\u0434\u0443\u0442 \u0441\u0431\u0440\u043E\u0448\u0435\u043D\u044B.')) {
        newSession();
      }
    });

    document.getElementById('resetBtn').addEventListener('click', function () {
      if (confirm('\u041D\u0430\u0447\u0430\u0442\u044C \u043D\u043E\u0432\u0443\u044E \u0441\u0435\u0441\u0441\u0438\u044E?')) {
        newSession();
      }
    });

    document.getElementById('settingsBtn').addEventListener('click', openSettings);
    document.getElementById('closeSettings').addEventListener('click', closeSettings);
    document.getElementById('saveBtn').addEventListener('click', saveSettings);
    document.getElementById('resetSettingsBtn').addEventListener('click', resetSettings);
    document.getElementById('addGroupBtn').addEventListener('click', addGroup);

    document.getElementById('shuffleBtn').addEventListener('click', function () {
      config.groups.forEach(function (g) {
        for (var i = g.segments.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var tmp = g.segments[i]; g.segments[i] = g.segments[j]; g.segments[j] = tmp;
        }
      });
      renderGroupsList();
      drawWheel();
    });

    document.querySelectorAll('.theme-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        config.theme = this.dataset.theme;
        document.querySelectorAll('.theme-btn').forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
      });
    });

    document.getElementById('showScoreCheckbox').addEventListener('change', function () {
      config.showScore = this.checked;
      saveConfig();
      applyScoreVisibility();
    });

    document.getElementById('closeResult').addEventListener('click', function () {
      document.getElementById('resultModal').classList.remove('active');
    });

    document.querySelectorAll('.modal-overlay').forEach(function (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) overlay.classList.remove('active');
      });
    });

    document.getElementById('loadBtn').addEventListener('click', function () {
      config = loadConfig();
      applyTheme(config.theme);
      document.getElementById('wheelTitle').textContent = config.name;
      document.title = config.name;
      applyScoreVisibility();
      updateSpinButton();
      openSettings();
    });

    document.getElementById('exportBtn').addEventListener('click', exportConfig);
    document.getElementById('importBtn').addEventListener('click', function () {
      document.getElementById('importFileInput').click();
    });
    document.getElementById('importFileInput').addEventListener('change', function () {
      if (this.files && this.files[0]) {
        importConfig(this.files[0]);
        this.value = '';
      }
    });

    document.getElementById('shareBtn').addEventListener('click', generateShareLink);
    document.getElementById('shareApplyBtn').addEventListener('click', applyShareConfig);
    document.getElementById('shareCancelBtn').addEventListener('click', function () {
      pendingShareConfig = null;
      history.replaceState(null, '', location.pathname + location.search);
      document.getElementById('sharePreviewModal').classList.remove('active');
    });
    document.getElementById('closeSharePreview').addEventListener('click', function () {
      pendingShareConfig = null;
      history.replaceState(null, '', location.pathname + location.search);
      document.getElementById('sharePreviewModal').classList.remove('active');
    });

    document.getElementById('clearBgBtn').addEventListener('click', function () {
      document.getElementById('bgUrlInput').value = '';
      config.backgroundImage = '';
      applyBackgroundImage();
    });

    document.getElementById('pasteBgBtn').addEventListener('click', function () {
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then(function (text) {
          document.getElementById('bgUrlInput').value = text;
          config.backgroundImage = text.trim();
          applyBackgroundImage();
        }).catch(function () {
          alert('\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0431\u0443\u0444\u0435\u0440 \u043E\u0431\u043C\u0435\u043D\u0430');
        });
      } else {
        alert('\u0411\u0443\u0444\u0435\u0440 \u043E\u0431\u043C\u0435\u043D\u0430 \u043D\u0435 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F');
      }
    });

    var resizeTimeout;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(drawWheel, 150);
    });

    checkShareLink();
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (e) {});
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
