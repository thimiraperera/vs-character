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

  /* Escape everything, then let a short list of tags back in. Anything else in
     the file stays literal text instead of turning into markup. */
  function safeText(raw) {
    var out = raw
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    out = out.replace(/&lt;(\/?)(b|i|u|em|strong)&gt;/gi, "<$1$2>");
    out = out.replace(/&lt;br\s*\/?&gt;/gi, "<br>");
    out = out.replace(/&lt;c\.([a-zA-Z0-9_ -]+)&gt;/g, function (m, names) {
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
    "  font-family: Segoe UI, Roboto, sans-serif;",
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

  /* ---------- warm the artwork ---------- */

  /* Decode every pose up front so the first press swaps instantly instead of
     flashing an empty frame while the file is still being read. */
  for (var pose in poses) {
    if (!Object.prototype.hasOwnProperty.call(poses, pose)) continue;
    var art = poses[pose];
    if (art.decode) art.decode().catch(function () {});
  }
})();
