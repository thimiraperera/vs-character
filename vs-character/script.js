(function () {
  "use strict";

  var DEFAULT_POSE = "standing";

  var KEY_POSES = {
    ArrowLeft:  "pointing-left",
    ArrowRight: "pointing-right",
    ArrowUp:    "shrugging",
    ArrowDown:  "arms-folded",
    Left:       "pointing-left",
    Right:      "pointing-right",
    Up:         "shrugging",
    Down:       "arms-folded"
  };

  var stage = document.getElementById("stage");
  var stageHolder = document.getElementById("stageHolder");
  var stageArea = document.getElementById("stageArea");
  var workspace = document.querySelector(".workspace");
  var controls = document.querySelector(".controls");
  var castShadow = document.getElementById("castShadow");
  var resolution = document.getElementById("resolution");
  var zoom = document.getElementById("zoom");
  var scaleNote = document.getElementById("scaleNote");

  var poses = {};
  var slides = document.querySelectorAll(".pose");
  for (var i = 0; i < slides.length; i++) {
    poses[slides[i].dataset.pose] = slides[i];
  }

  /* Sources currently holding a pose down, oldest first. A source is either a
     keyboard key or a pointer id, so a finger and a key can never fight over
     which pose wins: the most recent one shows. */
  var held = [];
  var current = DEFAULT_POSE;

  function show(pose) {
    if (pose === current) return;
    var next = poses[pose];
    if (!next) return;

    var prev = poses[current];
    if (prev) prev.classList.remove("is-on");
    next.classList.add("is-on");
    current = pose;

    /* Widen the contact shadow a touch when the stance opens up. */
    var wide = pose === "shrugging" || pose === "pointing-left" || pose === "pointing-right";
    castShadow.style.width = wide ? "48%" : "42%";
  }

  function settle() {
    show(held.length ? held[held.length - 1].pose : DEFAULT_POSE);
  }

  function press(source, pose) {
    for (var i = 0; i < held.length; i++) {
      if (held[i].source === source) return;
    }
    held.push({ source: source, pose: pose });
    settle();
  }

  function release(source) {
    for (var i = held.length - 1; i >= 0; i--) {
      if (held[i].source === source) held.splice(i, 1);
    }
    settle();
  }

  function releaseAll() {
    held.length = 0;
    settle();
  }

  /* ---------- keyboard ---------- */

  function isTyping(e) {
    var el = e.target;
    if (!el || !el.tagName) return false;
    if (el.isContentEditable) return true;
    var tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  }

  window.addEventListener("keydown", function (e) {
    if (isTyping(e)) return;

    if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      if (!e.repeat) togglePlay();
      return;
    }

    if (e.key === "1" || e.key === "2") {
      e.preventDefault();
      if (!e.repeat) advance(e.key === "1" ? "a" : "b");
      return;
    }

    var pose = KEY_POSES[e.key];
    if (!pose) return;

    /* Arrows would otherwise scroll the canvas inside its holder. */
    e.preventDefault();

    /* Auto-repeat fires keydown over and over while the key stays down. */
    if (e.repeat) return;

    press("key:" + e.key, pose);
  });

  window.addEventListener("keyup", function (e) {
    if (isTyping(e)) return;
    var pose = KEY_POSES[e.key];
    if (!pose) return;
    e.preventDefault();
    release("key:" + e.key);
  });

  /* A key held while the tab or window loses focus never delivers its keyup,
     which would leave the pose stuck. */
  window.addEventListener("blur", releaseAll);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) releaseAll();
  });

  /* ---------- canvas size and viewing scale ---------- */

  var canvasW = 1080;
  var canvasH = 1920;
  var viewK = 1;

  function applyScale() {
    var mode = zoom.value;
    var k;

    stageArea.classList.toggle("is-zoomed", mode !== "fit");

    if (mode === "fit") {
      /* The panels wrap into however many columns the height needs, so how
         wide they end up is only known once they are laid out. Measure that
         and give the canvas what is left, otherwise a narrow window pushes
         the far column off the edge. */
      var box = getComputedStyle(workspace);
      var padX = parseFloat(box.paddingLeft) + parseFloat(box.paddingRight);
      var padY = parseFloat(box.paddingTop) + parseFloat(box.paddingBottom);
      var gap = parseFloat(box.columnGap || box.gap) || 0;

      var availW = workspace.clientWidth - padX - controls.getBoundingClientRect().width - gap;
      var availH = workspace.clientHeight - padY;

      k = Math.min(availW / canvasW, availH / canvasH);
      if (!(k > 0)) k = 0.05;
      if (k > 1) k = 1;
    } else {
      k = parseFloat(mode);
    }

    viewK = k;
    stage.style.transform = "scale(" + k + ")";
    stageHolder.style.width = Math.round(canvasW * k) + "px";
    stageHolder.style.height = Math.round(canvasH * k) + "px";
    scaleNote.textContent = canvasW + " x " + canvasH + " at " + Math.round(k * 100) + "%";
  }

  function applyResolution() {
    var parts = resolution.value.split("x");
    canvasW = parseInt(parts[0], 10);
    canvasH = parseInt(parts[1], 10);
    document.documentElement.style.setProperty("--w", canvasW);
    document.documentElement.style.setProperty("--h", canvasH);
    applyScale();
  }

  /* Resizing the window moves two things at once: the room available, and how
     many columns the panels wrap into. Measuring in the middle of that reads
     one of them stale, so the work is put off until the layout has settled. */
  var scalePending = 0;
  function scheduleScale() {
    if (scalePending) return;
    scalePending = setTimeout(function () {
      scalePending = 0;
      applyScale();
    }, 0);
  }

  resolution.addEventListener("change", applyResolution);
  zoom.addEventListener("change", applyScale);
  window.addEventListener("resize", scheduleScale);

  if (window.ResizeObserver) {
    var watcher = new ResizeObserver(scheduleScale);
    watcher.observe(controls);
    watcher.observe(workspace);
  } else {
    window.addEventListener("load", scheduleScale);
  }

  applyResolution();
  scheduleScale();

  /* ---------- image slots ---------- */

  /* Files never leave the machine. Each pick becomes an object URL pointing
     straight at the file on disk, so a hundred photos cost nothing to hold and
     nothing is copied or uploaded anywhere. Object URLs do not survive a
     reload, which is why the panel always shows what is currently loaded. */
  var reels = {
    a: { urls: [], index: 0, el: null, front: null, back: null, count: null },
    b: { urls: [], index: 0, el: null, front: null, back: null, count: null }
  };

  function releaseUrls(reel) {
    for (var i = 0; i < reel.urls.length; i++) URL.revokeObjectURL(reel.urls[i]);
    reel.urls = [];
    reel.index = 0;
  }

  function describe(reel) {
    if (!reel.urls.length) return "none";
    return (reel.index + 1) + " of " + reel.urls.length;
  }

  function paint(name, immediate) {
    var reel = reels[name];
    reel.count.textContent = describe(reel);

    if (!reel.urls.length) {
      reel.el.classList.remove("is-filled");
      reel.front.removeAttribute("src");
      reel.back.removeAttribute("src");
      return;
    }

    var url = reel.urls[reel.index];
    reel.el.classList.add("is-filled");

    if (immediate) {
      reel.front.src = url;
      reel.front.classList.add("is-front");
      reel.back.classList.remove("is-front");
      return;
    }

    /* Load into the layer underneath, then swap which one sits on top. */
    var incoming = reel.back;
    var outgoing = reel.front;
    incoming.src = url;

    var swap = function () {
      incoming.classList.add("is-front");
      outgoing.classList.remove("is-front");
      reel.front = incoming;
      reel.back = outgoing;
    };

    if (incoming.decode) incoming.decode().then(swap, swap);
    else swap();
  }

  function advance(name) {
    var reel = reels[name];
    if (reel.urls.length < 2) return;
    reel.index = (reel.index + 1) % reel.urls.length;
    paint(name, false);
  }

  function loadImages(name, files) {
    var reel = reels[name];
    var picked = [];
    for (var i = 0; i < files.length; i++) {
      if (files[i].type.indexOf("image/") === 0) picked.push(files[i]);
    }
    if (!picked.length) return;

    picked.sort(function (x, y) {
      return x.name.localeCompare(y.name, undefined, { numeric: true, sensitivity: "base" });
    });

    var startedEmpty = reel.urls.length === 0;
    for (var j = 0; j < picked.length; j++) reel.urls.push(URL.createObjectURL(picked[j]));

    /* Decode everything up front so a click never waits on the disk. */
    for (var k = 0; k < reel.urls.length; k++) {
      var warm = new Image();
      warm.src = reel.urls[k];
      if (warm.decode) warm.decode().catch(function () {});
    }

    /* Adding to a reel that already has something showing should not yank the
       picture out from under you, so only a first load jumps to the front. */
    if (startedEmpty) reel.index = 0;
    paint(name, true);
  }

  ["a", "b"].forEach(function (name) {
    var reel = reels[name];
    var box = document.querySelector('.slot[data-slot="' + name + '"]');
    var layers = box.querySelectorAll(".slot-img");
    var input = document.getElementById("file" + name.toUpperCase());

    reel.el = box;
    reel.front = layers[0];
    reel.back = layers[1];
    reel.count = document.getElementById("count" + name.toUpperCase());

    box.addEventListener("click", function (e) {
      if (e.target.closest(".slot-add")) return;
      if (reel.urls.length) advance(name);
      else input.click();
    });

    box.querySelector(".slot-add").addEventListener("click", function (e) {
      e.stopPropagation();
      input.click();
    });

    input.addEventListener("change", function () {
      if (input.files && input.files.length) loadImages(name, input.files);
      input.value = "";
    });

    var pickers = document.querySelectorAll('.controls [data-pick="' + name + '"]');
    for (var q = 0; q < pickers.length; q++) {
      pickers[q].addEventListener("click", function () { input.click(); });
    }

    document.querySelector('[data-clear="' + name + '"]').addEventListener("click", function () {
      releaseUrls(reel);
      paint(name, true);
    });

    box.addEventListener("dragover", function (e) {
      e.preventDefault();
      box.classList.add("is-over");
    });

    box.addEventListener("dragleave", function () {
      box.classList.remove("is-over");
    });

    box.addEventListener("drop", function (e) {
      e.preventDefault();
      box.classList.remove("is-over");
      if (e.dataTransfer && e.dataTransfer.files.length) loadImages(name, e.dataTransfer.files);
    });

    paint(name, true);
  });

  /* ---------- subtitles ---------- */

  var subtitle = document.getElementById("subtitle");
  var subtitleText = document.getElementById("subtitleText");
  var subsInfo = document.getElementById("subsInfo");
  var subsFile = document.getElementById("fileSubs");
  var cues = [];
  var shownCue = -1;

  /* "00:01:02,500" and "01:02.500" both turn up in real files. */
  function toSeconds(text) {
    var bits = text.trim().replace(",", ".").split(":");
    var total = 0;
    for (var i = 0; i < bits.length; i++) total = total * 60 + parseFloat(bits[i]);
    return isFinite(total) ? total : 0;
  }

  /* Declarations that could fetch something or smuggle a script. Everything
     else in a style attribute is just presentation and is let through. */
  var CSS_TRAPS = /url\s*\(|expression\s*\(|javascript\s*:|@import|behaviou?r\s*:|&/i;

  function cleanStyle(value) {
    var parts = value.replace(/\/\*[\s\S]*?\*\//g, "").split(";");
    var kept = [];
    for (var i = 0; i < parts.length; i++) {
      var decl = parts[i].trim();
      if (decl && !CSS_TRAPS.test(decl)) kept.push(decl);
    }
    return kept.join("; ");
  }

  /* Keeps class and style, and turns the old font attributes into a style,
     since that is how most .srt files carry colour. */
  function keepAttrs(tag, raw) {
    var style = "";
    var cls = "";
    var re = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    var found;

    function add(decl) { style += (style ? ";" : "") + decl; }

    while ((found = re.exec(raw))) {
      var name = found[1].toLowerCase();
      var value = (found[2] !== undefined ? found[2] : found[3]).replace(/"/g, "");

      if (name === "style") add(value);
      else if (name === "class") cls = value;
      else if (tag === "font") {
        if (name === "color") add("color:" + value);
        else if (name === "face") add("font-family:" + value);
        else if (name === "size" && /^\d+$/.test(value)) add("font-size:" + value + "px");
      }
    }

    style = cleanStyle(style);
    return (cls ? ' class="' + cls + '"' : "") + (style ? ' style="' + style + '"' : "");
  }

  /* Escape everything, then let a short list of tags back in, with their class
     and style attributes. Anything that does not match exactly stays literal
     text instead of turning into markup, so a stray angle bracket in a
     subtitle file cannot introduce anything. */
  function safeText(raw) {
    var out = raw
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    out = out.replace(
      /&lt;(b|i|u|s|em|strong|span|font)((?:\s+[a-zA-Z-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*&gt;/gi,
      function (whole, tag, attrs) {
        var name = tag.toLowerCase();
        return "<" + (name === "font" ? "span" : name) + keepAttrs(name, attrs || "") + ">";
      }
    );

    out = out.replace(/&lt;\/(b|i|u|s|em|strong|span|font)&gt;/gi, function (whole, tag) {
      var name = tag.toLowerCase();
      return "</" + (name === "font" ? "span" : name) + ">";
    });

    out = out.replace(/&lt;br\s*\/?&gt;/gi, "<br>");
    out = out.replace(/&lt;c\.([a-zA-Z0-9_ .-]+)&gt;/g, function (whole, names) {
      return '<span class="' + names.replace(/\./g, " ") + '">';
    });
    out = out.replace(/&lt;\/c&gt;/gi, "</span>");
    out = out.replace(/&lt;v\s+([^&]*?)&gt;/gi, '<span class="voice">');
    out = out.replace(/&lt;\/v&gt;/gi, "</span>");
    return out.replace(/\n/g, "<br>");
  }

  function parseCues(text) {
    var body = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
    var blocks = body.split(/\n{2,}/);
    var found = [];

    for (var i = 0; i < blocks.length; i++) {
      var lines = blocks[i].split("\n");
      var timeAt = -1;

      for (var j = 0; j < lines.length; j++) {
        if (lines[j].indexOf("-->") !== -1) { timeAt = j; break; }
      }
      if (timeAt === -1) continue;

      var halves = lines[timeAt].split("-->");
      if (halves.length < 2) continue;

      /* A VTT cue can carry positioning settings after the end stamp. */
      var from = toSeconds(halves[0]);
      var to = toSeconds(halves[1].trim().split(/\s+/)[0]);
      var said = lines.slice(timeAt + 1).join("\n").trim();
      if (!said || !(to > from)) continue;

      found.push({ start: from, end: to, html: safeText(said) });
    }

    found.sort(function (x, y) { return x.start - y.start; });
    return found;
  }

  function setCaption(html) {
    subtitleText.innerHTML = html;
    subtitle.classList.toggle("has-text", html !== "");
    buildCaption();
  }

  function renderCue(time) {
    var found = -1;
    for (var i = 0; i < cues.length; i++) {
      if (time >= cues[i].start && time < cues[i].end) { found = i; break; }
    }
    if (found === shownCue) return;
    shownCue = found;
    setCaption(found === -1 ? "" : cues[found].html);
  }

  function clearSubs() {
    cues = [];
    shownCue = -1;
    setCaption("");
    subsInfo.textContent = "none";
  }

  subsFile.addEventListener("change", function () {
    var file = subsFile.files && subsFile.files[0];
    subsFile.value = "";
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function () {
      cues = parseCues(String(reader.result));
      shownCue = -1;
      setCaption("");
      subsInfo.textContent = cues.length
        ? file.name + ", " + cues.length + " lines"
        : file.name + ", nothing readable";
      renderCue(elapsed);
    };
    reader.onerror = function () { subsInfo.textContent = "could not read that file"; };
    reader.readAsText(file);
  });

  document.getElementById("pickSubs").addEventListener("click", function () { subsFile.click(); });
  document.getElementById("clearSubs").addEventListener("click", clearSubs);

  /* ---------- subtitle styling ---------- */

  /* Position is handled in style.css, which parks the caption in the gap
     between the squares and the character. This is only how it looks. */
  var DEFAULT_CSS = [
    ".subtitle{",
    "  font-family: UN-Sandhyanee, Segoe UI, Roboto, sans-serif;",
    "  font-size: 52px;",
    "  font-weight: 700;",
    "  line-height: 1.3;",
    "  text-align: center;",
    "  color: #1d2a44;",
    "  text-shadow: 0 2px 0 rgba(255,255,255,.65);",
    "}",
    "",
    ".subtitle b{ color: #c8442e; }"
  ].join("\n");

  var cssBox = document.getElementById("subsCss");
  var cssNote = document.getElementById("cssNote");
  var cssTag = document.createElement("style");
  document.head.appendChild(cssTag);

  function applyCss() {
    cssTag.textContent = cssBox.value;

    /* Report what the browser actually understood. It quietly drops a rule it
       cannot parse, so a count that falls short of what is written is the
       honest way to point at a typo. */
    var sheet = cssTag.sheet;
    var parsed = sheet && sheet.cssRules ? sheet.cssRules.length : 0;
    var written = cssBox.value
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("}")
      .filter(function (part) { return part.indexOf("{") !== -1; })
      .length;

    if (written > parsed) {
      cssNote.textContent = parsed + " of " + written + " rules applied.";
      cssNote.classList.add("is-bad");
    } else {
      cssNote.textContent = parsed === 1 ? "1 rule applied." : parsed + " rules applied.";
      cssNote.classList.remove("is-bad");
    }
  }

  cssBox.value = DEFAULT_CSS;
  cssBox.addEventListener("input", applyCss);
  applyCss();

  /* ---------- audio ---------- */

  /* Read off the disk like the images, and never uploaded. When a track is
     loaded it becomes the clock: the subtitles read its currentTime rather
     than a timer of our own, so the two cannot drift apart. */
  var audio = document.getElementById("audio");
  var audioInfo = document.getElementById("audioInfo");
  var audioFile = document.getElementById("fileAudio");
  var audioUrl = "";

  function haveAudio() { return audioUrl !== ""; }

  function dropAudio() {
    if (!audioUrl) return;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    URL.revokeObjectURL(audioUrl);
    audioUrl = "";
    audioInfo.textContent = "none";
  }

  audioFile.addEventListener("change", function () {
    var file = audioFile.files && audioFile.files[0];
    audioFile.value = "";
    if (!file) return;

    setPlaying(false);
    dropAudio();
    audioUrl = URL.createObjectURL(file);
    audio.src = audioUrl;
    audioInfo.textContent = file.name;
    elapsed = 0;
    drawClock();
  });

  audio.addEventListener("loadedmetadata", function () {
    if (isFinite(audio.duration)) {
      audioInfo.textContent = audioInfo.textContent.split("  ")[0] + "  " + stamp(audio.duration);
    }
  });

  audio.addEventListener("error", function () {
    if (audioUrl) audioInfo.textContent = "that file would not play";
  });

  audio.addEventListener("ended", function () { setPlaying(false); });

  document.getElementById("pickAudio").addEventListener("click", function () { audioFile.click(); });
  document.getElementById("clearAudio").addEventListener("click", function () {
    setPlaying(false);
    dropAudio();
    resetClock();
  });

  /* ---------- playback clock ---------- */

  var playing = false;
  var elapsed = 0;
  var startedAt = 0;
  var offset = 0;
  var ticker = 0;
  var playBtn = document.getElementById("playBtn");
  var playLabel = document.getElementById("playLabel");
  var clock = document.getElementById("clock");
  var resetBtn = document.getElementById("resetBtn");

  function stamp(t) {
    var m = Math.floor(t / 60);
    var sec = t - m * 60;
    return m + ":" + (sec < 10 ? "0" : "") + sec.toFixed(1);
  }

  /* A loaded track is the clock. Without one, count from when Play was pressed
     rather than adding up frames, so a stall cannot lose time. */
  function readTime() {
    if (haveAudio()) return audio.currentTime;
    if (!playing) return elapsed;
    return offset + (performance.now() - startedAt) / 1000;
  }

  function drawClock() { clock.textContent = stamp(elapsed); }

  function sync() {
    elapsed = readTime();
    drawClock();
    renderCue(elapsed);
  }

  function tick() {
    if (!playing) return;
    sync();
    requestAnimationFrame(tick);
  }

  /* A hidden tab is handed no animation frames, so on its own the caption
     would freeze while the track played on. Both of these keep it moving. */
  audio.addEventListener("timeupdate", function () {
    if (playing && haveAudio()) sync();
  });

  function setPlaying(on) {
    if (playing === on) return;

    /* Read the time while it is still running, or the value is already stale. */
    if (!on) elapsed = readTime();

    playing = on;
    playBtn.classList.toggle("is-playing", on);
    playLabel.textContent = on ? "Pause" : "Play";
    playBtn.setAttribute("aria-label", on ? "Pause" : "Play");

    if (on) {
      offset = elapsed;
      startedAt = performance.now();

      if (haveAudio()) {
        wakeAudioGraph();
        var started = audio.play();

        /* If the browser refuses to start the track, the clock would sit at
           zero for ever, since it is the track's own currentTime. Stop, and
           say why. */
        if (started && started.catch) {
          started.catch(function () {
            audioInfo.textContent = "the browser blocked playback, press Play again";
            setPlaying(false);
          });
        }
      }

      requestAnimationFrame(tick);
      ticker = setInterval(sync, 250);
    } else {
      if (ticker) { clearInterval(ticker); ticker = 0; }
      if (haveAudio()) audio.pause();
      drawClock();
    }
  }

  function togglePlay() { setPlaying(!playing); }

  function resetClock() {
    setPlaying(false);
    if (haveAudio()) audio.currentTime = 0;
    elapsed = 0;
    shownCue = -1;
    setCaption("");
    drawClock();
  }

  playBtn.addEventListener("click", function () {
    togglePlay();
    playBtn.blur();
  });

  resetBtn.addEventListener("click", function () {
    resetClock();
    resetBtn.blur();
  });

  drawClock();

  /* ---------- drawing the scene onto a canvas ---------- */

  /* The recording is painted rather than screen-grabbed, so what comes out is a
     true 1080 x 1920 whatever the view is zoomed to. Everything is measured
     off the live page and divided by the view scale, which puts it back into
     canvas pixels, so the frame cannot drift away from the preview. */
  var frame = document.createElement("canvas");
  var brush = frame.getContext("2d");

  var skyEl = document.querySelector(".sky");
  var glowEl = document.querySelector(".glow");
  var floorEl = document.querySelector(".floor");
  var slotEls = document.querySelectorAll(".slot");

  function boxOf(el) {
    var r = el.getBoundingClientRect();
    var base = stage.getBoundingClientRect();
    var k = viewK || 1;
    return {
      x: (r.left - base.left) / k,
      y: (r.top - base.top) / k,
      w: r.width / k,
      h: r.height / k
    };
  }

  function roundedPath(x, y, w, h, r) {
    brush.beginPath();
    if (brush.roundRect) { brush.roundRect(x, y, w, h, r); return; }
    brush.moveTo(x + r, y);
    brush.arcTo(x + w, y, x + w, y + h, r);
    brush.arcTo(x + w, y + h, x, y + h, r);
    brush.arcTo(x, y + h, x, y, r);
    brush.arcTo(x, y, x + w, y, r);
    brush.closePath();
  }

  function drawCover(img, x, y, w, h) {
    var iw = img.naturalWidth, ih = img.naturalHeight;
    if (!iw || !ih) return;
    var scale = Math.max(w / iw, h / ih);
    var dw = iw * scale, dh = ih * scale;
    brush.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  function drawScene() {
    if (frame.width !== canvasW || frame.height !== canvasH) {
      frame.width = canvasW;
      frame.height = canvasH;
    }

    brush.clearRect(0, 0, canvasW, canvasH);

    var sky = brush.createLinearGradient(0, 0, 0, canvasH);
    sky.addColorStop(0, "#cfe9ff");
    sky.addColorStop(0.42, "#e6f1fb");
    sky.addColorStop(1, "#fdf3e6");
    brush.fillStyle = sky;
    brush.fillRect(0, 0, canvasW, canvasH);

    var g = boxOf(glowEl);
    var gx = g.x + g.w / 2, gy = g.y + g.h / 2;
    var glow = brush.createRadialGradient(gx, gy, 0, gx, gy, g.w / 2);
    glow.addColorStop(0, "rgba(255,236,196,.95)");
    glow.addColorStop(0.38, "rgba(255,236,196,.45)");
    glow.addColorStop(0.68, "rgba(255,236,196,0)");
    brush.fillStyle = glow;
    brush.fillRect(g.x, g.y, g.w, g.h);

    var f = boxOf(floorEl);
    var floor = brush.createLinearGradient(0, f.y, 0, f.y + f.h);
    floor.addColorStop(0, "rgba(126,150,178,0)");
    floor.addColorStop(0.6, "rgba(126,150,178,.16)");
    floor.addColorStop(1, "rgba(96,120,150,.26)");
    brush.fillStyle = floor;
    brush.fillRect(f.x, f.y, f.w, f.h);

    for (var i = 0; i < slotEls.length; i++) {
      var el = slotEls[i];
      var b = boxOf(el);
      var radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;

      brush.save();
      brush.shadowColor = "rgba(30,45,70,.10)";
      brush.shadowBlur = 26;
      brush.shadowOffsetY = 10;
      roundedPath(b.x, b.y, b.w, b.h, radius);
      brush.fillStyle = el.classList.contains("is-filled") ? "#ffffff" : "rgba(255,255,255,.55)";
      brush.fill();
      brush.restore();

      var shown = el.querySelector(".slot-img.is-front");
      if (el.classList.contains("is-filled") && shown && shown.naturalWidth) {
        brush.save();
        roundedPath(b.x, b.y, b.w, b.h, radius);
        brush.clip();
        drawCover(shown, b.x, b.y, b.w, b.h);
        brush.restore();
      }

      brush.save();
      roundedPath(b.x, b.y, b.w, b.h, radius);
      brush.strokeStyle = "rgba(23,32,58,.10)";
      brush.lineWidth = 1;
      brush.stroke();
      brush.restore();
    }

    var sh = boxOf(castShadow);
    brush.save();
    brush.translate(sh.x + sh.w / 2, sh.y + sh.h / 2);
    brush.scale(sh.w / 2, sh.h / 2);
    var cast = brush.createRadialGradient(0, 0, 0, 0, 0, 1);
    cast.addColorStop(0, "rgba(40,55,80,.42)");
    cast.addColorStop(0.45, "rgba(40,55,80,.20)");
    cast.addColorStop(0.72, "rgba(40,55,80,0)");
    brush.fillStyle = cast;
    brush.fillRect(-1, -1, 2, 2);
    brush.restore();

    var pose = poses[current];
    if (pose && pose.naturalWidth) {
      var p = boxOf(pose);
      brush.drawImage(pose, p.x, p.y, p.w, p.h);
    }

    if (captionArt) brush.drawImage(captionArt, 0, 0, canvasW, canvasH);
  }

  /* ---------- the caption, drawn through the browser's own layout ---------- */

  /* Captions carry whatever CSS the box and the file between them ask for, so
     rather than reimplementing any of that on the canvas the real element is
     handed back to the browser inside an SVG and rasterised. It only has to
     happen when the line changes, not every frame. */
  var captionArt = null;
  var captionKey = "";
  var fontData = null;
  var sheetText = null;

  /* The face is embedded rather than linked, because a relative url inside a
     data-url SVG has nothing to resolve against. */
  function loadFontData() {
    return fetch("../UN-Sandhyanee.ttf")
      .then(function (r) { return r.ok ? r.arrayBuffer() : null; })
      .then(function (buf) {
        if (!buf) { fontData = ""; return; }
        var bytes = new Uint8Array(buf), bin = "";
        for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        fontData = "data:font/ttf;base64," + btoa(bin);
      })
      .catch(function () { fontData = ""; });
  }

  /* The page's own stylesheet goes into the SVG, so the caption is laid out by
     the same rules that place it on screen rather than by a second copy of
     them that could drift. The linked face is dropped on the way in, since the
     embedded one replaces it. */
  function loadSheet() {
    return fetch("style.css")
      .then(function (r) { return r.ok ? r.text() : ""; })
      .then(function (text) { sheetText = text.replace(/@font-face\s*\{[^}]*\}/gi, ""); })
      .catch(function () { sheetText = ""; });
  }

  function rootVars() {
    var names = ["--w", "--h", "--edge", "--slot-top", "--floor", "--char-height", "--breath"];
    var root = getComputedStyle(document.documentElement);
    var out = ":root{";
    for (var i = 0; i < names.length; i++) {
      out += names[i] + ":" + root.getPropertyValue(names[i]) + ";";
    }
    return out + "}";
  }

  function buildCaption() {
    var html = subtitle.classList.contains("has-text") ? subtitleText.innerHTML : "";
    var key = html + "|" + canvasW + "x" + canvasH + "|" + cssBox.value;
    if (key === captionKey) return;

    if (!html) { captionKey = key; captionArt = null; return; }

    /* The stylesheet may still be on its way. Leave the key alone so this runs
       again once it lands, rather than marking the caption done. */
    if (sheetText === null) return;
    captionKey = key;

    /* An SVG is read as XML, where a bare <br> is a syntax error. */
    var body = html.replace(/<br\s*>/gi, "<br/>");

    var face = fontData
      ? '@font-face{font-family:"UN-Sandhyanee";src:url(' + fontData + ') format("truetype");}'
      : "";

    /* CDATA keeps the stylesheet away from the XML parser. */
    var css = "<style><![CDATA[" + face + rootVars() + sheetText + cssBox.value + "]]></style>";

    var doc =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + canvasW + '" height="' + canvasH + '">' +
      '<foreignObject x="0" y="0" width="' + canvasW + '" height="' + canvasH + '">' +
      '<div xmlns="http://www.w3.org/1999/xhtml" class="stage">' +
      css +
      '<div class="subtitle has-text"><div class="subtitle-text">' + body + "</div></div>" +
      "</div></foreignObject></svg>";

    var art = new Image();
    art.onload = function () { captionArt = art; };
    art.onerror = function () { captionArt = null; };
    art.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(doc);
  }

  /* ---------- recording ---------- */

  var recBtn = document.getElementById("recBtn");
  var recLabel = document.getElementById("recLabel");
  var recInfo = document.getElementById("recInfo");
  var recSave = document.getElementById("recSave");

  var recorder = null;
  var chunks = [];
  var saveUrl = "";
  var drawing = 0;
  var painting = 0;
  var actx = null;
  var audioTap = null;

  function wakeAudioGraph() {
    if (actx && actx.state === "suspended") actx.resume();
  }

  /* An element can only ever be tapped once, so the graph is built on the first
     recording and kept. Feeding it back to the speakers as well is what stops
     the tap from silencing playback. */
  function audioTracks() {
    if (!haveAudio()) return [];
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return [];
    if (!actx) {
      try {
        actx = new AC();
        var tap = actx.createMediaElementSource(audio);
        audioTap = actx.createMediaStreamDestination();
        tap.connect(actx.destination);
        tap.connect(audioTap);
      } catch (err) {
        actx = null;
        return [];
      }
    }
    wakeAudioGraph();
    return audioTap.stream.getAudioTracks();
  }

  function pickFormat() {
    var wanted = [
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm"
    ];
    for (var i = 0; i < wanted.length; i++) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(wanted[i])) return wanted[i];
    }
    return "";
  }

  function lastCueEnd() {
    var end = 0;
    for (var i = 0; i < cues.length; i++) if (cues[i].end > end) end = cues[i].end;
    return end;
  }

  function paintLoop() {
    if (!recorder) return;
    buildCaption();
    drawScene();

    /* Nothing else knows when to stop, so the run ends with the track, or with
       the last subtitle line when there is no track. */
    var stopAt = haveAudio() ? (isFinite(audio.duration) ? audio.duration : 0) : lastCueEnd();
    if (playing && stopAt && elapsed >= stopAt) {
      stopRecording();
      return;
    }
    drawing = requestAnimationFrame(paintLoop);
  }

  function startRecording() {
    if (recorder) return;

    if (!window.MediaRecorder || !frame.captureStream) {
      recInfo.textContent = "this browser cannot record";
      return;
    }

    var format = pickFormat();
    if (!format) {
      recInfo.textContent = "this browser cannot record";
      return;
    }

    if (saveUrl) { URL.revokeObjectURL(saveUrl); saveUrl = ""; }
    recSave.hidden = true;
    chunks = [];

    resetClock();
    frame.width = canvasW;
    frame.height = canvasH;
    captionKey = "";
    buildCaption();
    drawScene();

    var stream = frame.captureStream(30);
    var voice = audioTracks();
    for (var i = 0; i < voice.length; i++) stream.addTrack(voice[i]);

    try {
      recorder = new MediaRecorder(stream, { mimeType: format, videoBitsPerSecond: 12000000 });
    } catch (err) {
      recInfo.textContent = "this browser cannot record";
      return;
    }

    recorder.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };

    recorder.onstop = function () {
      var kind = format.indexOf("mp4") !== -1 ? "mp4" : "webm";
      var blob = new Blob(chunks, { type: format.split(";")[0] });
      saveUrl = URL.createObjectURL(blob);
      recSave.href = saveUrl;
      recSave.download = "character." + kind;
      recSave.hidden = false;
      recInfo.textContent = kind + ", " + (blob.size / 1048576).toFixed(1) + " MB";
    };

    recorder.start();
    painting = setInterval(function () { buildCaption(); drawScene(); }, 200);
    recBtn.classList.add("is-live");
    recLabel.textContent = "Stop";
    recInfo.textContent = "recording " + canvasW + " x " + canvasH +
      (voice.length ? " with audio" : ", no audio loaded");

    setPlaying(true);
    drawing = requestAnimationFrame(paintLoop);
  }

  function stopRecording() {
    if (!recorder) return;
    if (drawing) { cancelAnimationFrame(drawing); drawing = 0; }
    if (painting) { clearInterval(painting); painting = 0; }
    setPlaying(false);
    recInfo.textContent = "saving";
    try { recorder.stop(); } catch (err) {}
    recorder = null;
    recBtn.classList.remove("is-live");
    recLabel.textContent = "Record";
  }

  recBtn.addEventListener("click", function () {
    if (recorder) stopRecording();
    else startRecording();
    recBtn.blur();
  });

  audio.addEventListener("ended", function () { if (recorder) stopRecording(); });

  loadFontData();
  loadSheet();

  /* ---------- warm the artwork ---------- */

  /* Decode every pose up front so the first press swaps instantly instead of
     flashing an empty frame while the file is still being read. */
  for (var pose in poses) {
    if (!Object.prototype.hasOwnProperty.call(poses, pose)) continue;
    var art = poses[pose];
    if (art.decode) art.decode().catch(function () {});
  }
})();
