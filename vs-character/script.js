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
  var deck = document.querySelector(".deck");
  var controls = document.querySelector(".controls");
  var timeline = document.getElementById("timeline");
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

  /* What the track says the pose should be at the moment being played. A key
     under a finger still wins, so a replay can be taken over at any point. */
  var trackPose = null;

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

    noteKeyframe("pose", pose);
  }

  /* The pose last asked for by hand. A key puts her in a pose and she stays
     there when it is let go, until another key or a replay moves her. */
  var restingPose = DEFAULT_POSE;

  function settle() {
    if (held.length) { show(held[held.length - 1].pose); return; }
    show(trackPose || restingPose);
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

    /* Letting the last key go leaves her as she is. Remembering the key that
       went down instead would snap her back to it when two are released in
       the order they were pressed. */
    if (!held.length && !trackPose) restingPose = current;
    settle();
  }

  function releaseAll() {
    if (held.length && !trackPose) restingPose = current;
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

  function rowGapOf(el) {
    var box = getComputedStyle(el);
    return parseFloat(box.columnGap || box.gap) || 0;
  }

  function padXOf(el) {
    var box = getComputedStyle(el);
    return parseFloat(box.paddingLeft) + parseFloat(box.paddingRight);
  }

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

      var rowGap = parseFloat(getComputedStyle(deck).columnGap || getComputedStyle(deck).gap) || 0;
      var availW = workspace.clientWidth - padX - controls.getBoundingClientRect().width - rowGap;
      var availH = workspace.clientHeight - padY - timeline.getBoundingClientRect().height - gap;

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

    /* How wide the panels end up depends on how tall the window is, because
       they wrap into columns, and how wide the scene is depends on what the
       panels left. Css cannot settle that in one pass, so the width the two of
       them came to is written back here, and the deck centres on it. The track
       underneath is left alone: it spans the window whatever this comes to. */
    var want = Math.round(canvasW * k) + rowGapOf(deck) + Math.ceil(controls.getBoundingClientRect().width);
    deck.style.width = Math.min(want, workspace.clientWidth - padXOf(workspace)) + "px";
    scaleNote.textContent = canvasW + " x " + canvasH + " at " + Math.round(k * 100) + "%";
    measureNames();
  }

  function applyResolution() {
    var parts = resolution.value.split("x");
    canvasW = parseInt(parts[0], 10);
    canvasH = parseInt(parts[1], 10);
    document.documentElement.style.setProperty("--w", canvasW);
    document.documentElement.style.setProperty("--h", canvasH);
    applyScale();
    measureNames();
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
    watcher.observe(timeline);
  } else {
    window.addEventListener("load", scheduleScale);
  }

  applyResolution();
  scheduleScale();

  /* ---------- the name written under each square ---------- */

  /* Typed in the panel, shown under its own square, and drawn into a recording
     by the same rasteriser that draws the captions. The band the names take up
     is published as a variable, so the caption below moves down by exactly as
     much as they occupy rather than by a guess. */
  var nameFields = { a: document.getElementById("nameFieldA"), b: document.getElementById("nameFieldB") };
  var nameLabels = { a: document.getElementById("nameA"), b: document.getElementById("nameB") };
  var nameWhich = { a: document.getElementById("nameWhichA"), b: document.getElementById("nameWhichB") };
  var nameBox = document.querySelector(".slot-names");

  function measureNames() {
    /* Load bearing: applyResolution calls this while the page is starting up,
       which is before the line below that looks the box up has run. */
    if (!nameBox) return;

    /* The band stays open if any picture in either reel carries a name, not
       only the two on screen, so stepping through a reel where some are named
       and some are not does not shunt the caption up and down underneath. */
    var any = namedAnywhere("a") || namedAnywhere("b");
    nameBox.classList.toggle("has-text", any);
    /* offsetHeight is layout pixels, and the stage is laid out at its real
       output size and only scaled for viewing, so this is already in canvas
       pixels. It has to be read after the class lands or a hidden box measures
       as nothing. */
    /* A box that measures nothing is a box that is not laid out, not a box
       with nothing in it, so it claims no room until it can be measured for
       real. applyScale calls this again on every resize, which is when that
       happens. */
    var tall = nameBox.offsetHeight;
    var band = (any && tall) ? 16 + tall : 0;
    document.documentElement.style.setProperty("--name-band", band + "px");
  }

  function namedAnywhere(which) {
    var names = reels[which] ? reels[which].names : null;
    if (!names) return false;
    for (var i = 0; i < names.length; i++) if (names[i]) return true;
    return false;
  }

  /* The field edits the name of whichever picture that square is showing, so
     one field covers a reel of any length and the panel never becomes a list.
     Stepping to the next picture swaps what the field is editing. */
  function applySlotName(which) {
    var field = nameFields[which];
    var reel = reels[which];
    if (!field || !reel.layers.length) return;

    /* Control characters can arrive with a paste, and one of them inside the
       svg makes the whole document unparseable rather than merely ugly: the
       raster fails to load and the take quietly loses its caption with it. */
    reel.names[reel.index] = field.value.replace(/[\u0000-\u001f\u007f]/g, "").trim();

    showName(which);
    drawTrack();
  }

  /* Puts the current picture's name on the stage, and tells the field which
     picture it is editing. */
  function showName(which) {
    var reel = reels[which];
    var label = nameLabels[which];
    var text = reel.layers.length ? (reel.names[reel.index] || "") : "";

    label.textContent = text;
    label.classList.toggle("is-on", text !== "");

    var field = nameFields[which];
    field.disabled = !reel.layers.length;
    if (document.activeElement !== field) field.value = text;
    nameWhich[which].textContent = reel.layers.length
      ? "picture " + (reel.index + 1) + " of " + reel.layers.length
      : "this picture";

    measureNames();
    buildNames();
  }

  for (var sn in nameFields) {
    if (Object.prototype.hasOwnProperty.call(nameFields, sn)) {
      (function (which) {
        var field = nameFields[which];
        if (!field) return;
        field.addEventListener("input", function () { applySlotName(which); });
      })(sn);
    }
  }

  /* ---------- image slots ---------- */

  /* Files never leave the machine. Each pick becomes an object URL pointing
     straight at the file on disk, so a hundred photos cost nothing to hold and
     nothing is copied or uploaded anywhere. Object URLs do not survive a
     reload, which is why the panel always shows what is currently loaded. */
  var reels = {
    a: { urls: [], layers: [], names: [], index: 0, el: null, stack: null, count: null, timer: 0, under: null, fadeAt: 0 },
    b: { urls: [], layers: [], names: [], index: 0, el: null, stack: null, count: null, timer: 0, under: null, fadeAt: 0 }
  };

  var SLOT_FADE = 140;

  function fadeMs() {
    var raw = getComputedStyle(document.documentElement).getPropertyValue("--slot-fade");
    var ms = parseFloat(raw);
    if (!isFinite(ms)) return SLOT_FADE;
    return raw.indexOf("ms") === -1 ? ms * 1000 : ms;
  }

  SLOT_FADE = fadeMs();

  var BREAK_TAG = new RegExp("<br" + String.fromCharCode(92) + "s*>", "gi");

  var CAPTION_FADE = (function () {
    var raw = getComputedStyle(document.documentElement).getPropertyValue("--caption-fade");
    var ms = parseFloat(raw);
    if (!isFinite(ms)) return 320;
    return raw.indexOf("ms") === -1 ? ms * 1000 : ms;
  })();

  function describe(reel) {
    if (!reel.layers.length) return "none";
    return (reel.index + 1) + " of " + reel.layers.length;
  }

  function clearReel(name) {
    var reel = reels[name];
    if (reel.timer) { clearTimeout(reel.timer); reel.timer = 0; }
    for (var i = 0; i < reel.urls.length; i++) URL.revokeObjectURL(reel.urls[i]);
    for (i = 0; i < reel.layers.length; i++) reel.layers[i].remove();
    reel.urls = [];
    reel.layers = [];
    reel.names = [];
    reel.index = 0;
    reel.under = null;
    reel.fadeAt = 0;
    reel.el.classList.remove("is-filled");
    reel.count.textContent = "none";
    showName(name);
  }

  function showFrame(name, index, animate) {
    var reel = reels[name];
    if (!reel.layers.length) return;

    var prev = reel.layers[reel.index];
    var next = reel.layers[index];
    var moved = reel.index !== index;
    reel.index = index;
    reel.count.textContent = describe(reel);
    showName(name);
    if (moved) noteKeyframe(name, index);

    if (!next) return;

    if (!animate || !prev || prev === next) {
      if (reel.timer) { clearTimeout(reel.timer); reel.timer = 0; }
      for (var i = 0; i < reel.layers.length; i++) {
        reel.layers[i].classList.remove("is-front", "is-top");
      }
      next.classList.add("is-front", "is-top");
      reel.under = null;
      reel.fadeAt = 0;
      return;
    }

    /* The arriving layer goes on top still transparent, then fades up over the
       outgoing one, which keeps its full opacity underneath the whole time. */
    prev.classList.remove("is-top");
    next.classList.add("is-top");
    next.classList.remove("is-front");

    /* Let that starting point be a real frame, or the browser folds it into the
       same style change and there is nothing to animate from. */
    void next.offsetWidth;
    next.classList.add("is-front");

    /* Noted so the canvas can work the dissolve out from the clock. Reading it
       back off the elements would tie the recording to how far the browser has
       got with the transition, and a window that is not being drawn does not
       advance one at all. */
    reel.under = prev;
    reel.fadeAt = performance.now();

    if (reel.timer) clearTimeout(reel.timer);
    reel.timer = setTimeout(function () {
      reel.timer = 0;
      for (var i = 0; i < reel.layers.length; i++) {
        if (reel.layers[i] !== next) reel.layers[i].classList.remove("is-front");
      }
    }, fadeMs() + 40);
  }

  function advance(name) {
    var reel = reels[name];
    if (reel.layers.length < 2) return;
    showFrame(name, (reel.index + 1) % reel.layers.length, true);
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

    var startedEmpty = reel.layers.length === 0;
    var arriving = [];

    for (var j = 0; j < picked.length; j++) {
      var url = URL.createObjectURL(picked[j]);
      var layer = document.createElement("img");
      layer.className = "slot-img";
      layer.alt = "";
      layer.src = url;
      reel.stack.appendChild(layer);
      reel.urls.push(url);
      reel.names.push("");
      reel.layers.push(layer);
      arriving.push(layer);
    }

    reel.el.classList.add("is-filled");

    /* Held as live elements rather than as a list of addresses, and every one
       decoded before it can be asked for, so a step never waits on the disk
       and never shows a half-drawn square. */
    var done = 0;
    var total = arriving.length;
    reel.count.textContent = "loading 0 of " + total;

    var jobs = [];
    for (var k = 0; k < arriving.length; k++) {
      jobs.push(warm(arriving[k]));
    }

    /* decode() is the best signal that a picture is ready to paint, but a
       browser under no obligation to paint anything can leave it pending for
       ever. Whichever of these arrives first is enough to move on, and none of
       them can strand the reel on the loading count. */
    function warm(layer) {
      return new Promise(function (go) {
          var settled = false;
          function ready() {
            if (settled) return;
            settled = true;
            go();
          }

          if (layer.decode) layer.decode().then(ready, ready);
          if (layer.complete && layer.naturalWidth) ready();
          else {
            layer.addEventListener("load", ready);
            layer.addEventListener("error", ready);
          }
          setTimeout(ready, 4000);
        }).then(function () {
          done++;
          reel.count.textContent = "loading " + done + " of " + total;
        });
    }

    Promise.all(jobs).then(function () {
      showFrame(name, startedEmpty ? 0 : reel.index, false);
    });
  }

  ["a", "b"].forEach(function (name) {
    var reel = reels[name];
    var box = document.querySelector('.slot[data-slot="' + name + '"]');
    var input = document.getElementById("file" + name.toUpperCase());

    reel.el = box;
    reel.stack = box.querySelector(".slot-stack");
    reel.count = document.getElementById("count" + name.toUpperCase());

    box.addEventListener("click", function (e) {
      if (e.target.closest(".slot-add")) return;
      if (reel.layers.length) advance(name);
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
      clearReel(name);
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
  });

  /* ---------- subtitles ---------- */

  var subtitle = document.getElementById("subtitle");
  var subtitleText = document.getElementById("subtitleText");
  var subsInfo = document.getElementById("subsInfo");
  var subsFile = document.getElementById("fileSubs");
  var cues = [];
  var shownCue = -1;

  /* A second track, never drawn. It exists so Sinhala can be lip synced: the
     user writes the same words in Latin letters and the mouth reads those. */
  var syncCues = [];

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

      found.push({ start: from, end: to, html: safeText(said), said: said });
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
    planMouths();
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
      planMouths();
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

  /* ---------- the track nobody sees ---------- */

  var syncInfo = document.getElementById("syncInfo");
  var syncFile = document.getElementById("fileSync");

  syncFile.addEventListener("change", function () {
    var file = syncFile.files && syncFile.files[0];
    syncFile.value = "";
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function () {
      syncCues = parseCues(String(reader.result));
      planMouths();
      syncInfo.textContent = syncCues.length
        ? file.name + ", " + syncCues.length + " lines"
        : file.name + ", nothing readable";
    };
    reader.onerror = function () { syncInfo.textContent = "could not read that file"; };
    reader.readAsText(file);
  });

  document.getElementById("pickSync").addEventListener("click", function () { syncFile.click(); });
  document.getElementById("clearSync").addEventListener("click", function () {
    syncCues = [];
    planMouths();
    syncInfo.textContent = "none";
  });

  /* ---------- subtitle styling ---------- */

  /* Position is handled in style.css, which parks the caption in the gap
     between the squares and the character. This is only how it looks. */
  var DEFAULT_CSS = [
    ".subtitle{",
    "\tfont-family: UN-Sandhyanee, Segoe UI, Roboto, sans-serif;",
    "\tfont-size: 56px;",
    "\tfont-weight: 500;",
    "\tline-height: 1.3;",
    "\ttext-align: center;",
    "\tcolor: #1d2a44;",
    "\ttext-shadow: 0 2px 0 rgba(255,255,255,.65);",
    "}",
    "",
    ".subtitle b {",
    "\tcolor: #c8442e;",
    "}"
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
    applyTrack(elapsed);
    drawPlayhead();
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
      /* Starting from the top with capture armed is a new take, not an
         addition to the last one. It opens with an entry per lane so the take
         records where it began as well as what changed. */
      if (capturing && elapsed < 0.05) seedTake();

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
            audioInfo.textContent = "the browser blocked playback, press Play once first";
            setPlaying(false);

            /* The clock is the track's own position, so a refusal leaves it at
               zero and the take would run until stopped by hand. Wrap it up. */
            if (recorder) enterTail();
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
    trackPose = null;
    restingPose = DEFAULT_POSE;
    settle();
    applyTrack(0);
    drawPlayhead();
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

  /* ---------- the keyframe track ---------- */

  /* What was done, and when. One entry per change: the pose the character
     moved to, or the picture a square moved to. Replaying is then a matter of
     asking what the newest entry before a given moment was. */
  var track = [];
  var capturing = false;
  var picked = null;
  var seq = 0;

  var capBtn = document.getElementById("capBtn");
  var capLabel = document.getElementById("capLabel");
  var tlInfo = document.getElementById("tlInfo");
  var tlSel = document.getElementById("tlSel");
  var tlGrid = document.getElementById("tlGrid");
  var tlZoom = document.getElementById("tlZoom");
  var tlZoomInfo = document.getElementById("tlZoomInfo");
  var zoomLevel = 1;
  var tlRuler = document.getElementById("tlRuler");
  var tlPlayhead = document.getElementById("tlPlayhead");
  var tlBack = document.getElementById("tlBack");
  var tlFwd = document.getElementById("tlFwd");
  var tlDel = document.getElementById("tlDel");
  var lanes = {
    pose: document.querySelector('.tl-lane[data-lane="pose"]'),
    a: document.querySelector('.tl-lane[data-lane="a"]'),
    b: document.querySelector('.tl-lane[data-lane="b"]')
  };

  var POSE_MARK = {
    "standing": "\u2022",
    "pointing-left": "\u2190",
    "pointing-right": "\u2192",
    "shrugging": "\u2191",
    "arms-folded": "\u2193"
  };

  function noteKeyframe(lane, value) {
    if (!capturing || !playing) return;

    var at = Math.max(0, elapsed);

    /* One entry per lane per instant, so holding a key through a stutter does
       not pile up duplicates on the same spot. */
    for (var i = track.length - 1; i >= 0; i--) {
      if (track[i].lane === lane && Math.abs(track[i].t - at) < 0.02) track.splice(i, 1);
    }

    track.push({ id: ++seq, t: at, lane: lane, value: value });
    track.sort(function (x, y) { return x.t - y.t; });
    drawTrack();
  }

  function seedTake() {
    track = [];
    picked = null;
    seq = 0;

    track.push({ id: ++seq, t: 0, lane: "pose", value: current });
    ["a", "b"].forEach(function (name) {
      if (reels[name].layers.length) {
        track.push({ id: ++seq, t: 0, lane: name, value: reels[name].index });
      }
    });
    drawTrack();
  }

  function trackSpan() {
    var end = 8;
    if (haveAudio() && isFinite(audio.duration)) end = Math.max(end, audio.duration);
    end = Math.max(end, lastCueEnd());
    for (var i = 0; i < track.length; i++) end = Math.max(end, track[i].t + 2);
    return end;
  }

  /* The newest entry on a lane at or before a moment, which is what that lane
     was showing then. */
  function valueAt(lane, time) {
    var found = null;
    for (var i = 0; i < track.length; i++) {
      if (track[i].lane === lane && track[i].t <= time + 0.0005) found = track[i].value;
      else if (track[i].t > time) break;
    }
    return found;
  }

  function applyTrack(time) {
    if (capturing || !track.length) return;

    var pose = valueAt("pose", time);
    trackPose = pose || null;
    settle();

    ["a", "b"].forEach(function (name) {
      var want = valueAt(name, time);
      var reel = reels[name];
      if (!reel.layers.length) return;
      if (want === null) want = 0;
      if (want >= reel.layers.length) want = reel.layers.length - 1;
      if (want !== reel.index) showFrame(name, want, true);
    });
  }

  function pictureName(lane, index) {
    var reel = reels[lane];
    if (!reel || !reel.names) return "";
    return reel.names[index] || "";
  }

  function drawTrack() {
    var span = trackSpan();

    tlRuler.innerHTML = "";
    var visible = span / zoomLevel;
    var step = visible > 40 ? 5 : visible > 16 ? 2 : visible > 6 ? 1 : visible > 2.5 ? 0.5 : 0.25;
    for (var t = 0; t <= span + 0.001; t += step) {
      var tick = document.createElement("div");
      tick.className = "tl-tick";
      tick.style.left = (100 * t / span) + "%";
      var label = document.createElement("span");
      label.textContent = (Math.round(t * 100) / 100) + "s";
      tick.appendChild(label);
      tlRuler.appendChild(tick);
    }

    for (var key in lanes) {
      if (Object.prototype.hasOwnProperty.call(lanes, key)) lanes[key].innerHTML = "";
    }

    for (var i = 0; i < track.length; i++) {
      var item = track[i];
      var lane = lanes[item.lane];
      if (!lane) continue;

      var chip = document.createElement("div");
      chip.className = "tl-key" + (item.lane === "pose" ? " is-pose" : "");
      if (item.lane === "pose" && item.value === DEFAULT_POSE) chip.className += " is-stand";
      if (picked === item.id) chip.className += " is-picked";
      chip.style.left = (100 * item.t / span) + "%";
      chip.textContent = item.lane === "pose"
        ? (POSE_MARK[item.value] || "?")
        : String(item.value + 1);

      /* The number says which picture, which is no help when you are looking
         for the moment a particular one arrives. If it has been given a name,
         the chip carries that instead. */
      var named = pictureName(item.lane, item.value);
      chip.title = item.t.toFixed(2) + "s  " +
        (item.lane === "pose" ? item.value : "picture " + (item.value + 1) + (named ? "  " + named : ""));
      if (named) chip.textContent = named;
      chip.dataset.id = item.id;
      lane.appendChild(chip);
    }

    tlInfo.textContent = track.length
      ? track.length + (track.length === 1 ? " keyframe" : " keyframes")
      : "nothing captured";

    drawPlayhead();
    describePicked();
  }

  function drawPlayhead() {
    var span = trackSpan();
    tlPlayhead.style.left = (100 * Math.min(elapsed, span) / span) + "%";

    if (!playing || zoomLevel <= 1) return;
    var x = Math.min(elapsed, span) / span * tlZoom.getBoundingClientRect().width;
    var view = tlGrid.clientWidth;
    if (x < tlGrid.scrollLeft || x > tlGrid.scrollLeft + view) {
      tlGrid.scrollLeft = Math.max(0, x - view * 0.3);
    }
  }

  function findKey(id) {
    for (var i = 0; i < track.length; i++) if (track[i].id === id) return track[i];
    return null;
  }

  function describePicked() {
    var item = picked && findKey(picked);
    var on = !!item;
    tlBack.disabled = !on;
    tlFwd.disabled = !on;
    tlDel.disabled = !on;
    if (!on) { tlSel.textContent = "nothing selected"; return; }
    var where = item.lane === "pose" ? "pose" : (item.lane === "a" ? "left" : "right");
    var what = item.lane === "pose" ? item.value : "image " + (item.value + 1);
    tlSel.textContent = where + ", " + what + ", at " + item.t.toFixed(2) + "s";
  }

  function pick(id) {
    picked = id;
    drawTrack();
  }

  function nudge(by) {
    var item = picked && findKey(picked);
    if (!item) return;
    item.t = Math.max(0, item.t + by);
    track.sort(function (x, y) { return x.t - y.t; });
    drawTrack();
    applyTrack(elapsed);
  }

  function timeFromX(clientX) {
    var box = tlZoom.getBoundingClientRect();
    var span = trackSpan();
    var at = (clientX - box.left) / box.width * span;
    return Math.max(0, Math.min(span, at));
  }

  /* Scrolling over the timeline zooms it, about the moment under the pointer
     so that moment stays put while the strip stretches around it. */
  function applyZoom() {
    tlZoom.style.width = (zoomLevel * 100) + "%";
    tlZoomInfo.textContent = (Math.round(zoomLevel * 10) / 10) + "x";
  }

  tlGrid.addEventListener("wheel", function (e) {
    /* Ctrl and the wheel zooms, which is what every timeline does. On its own
       the wheel runs along the track, so a zoomed-in one can be walked through
       without reaching for the scrollbar. */
    if (!e.ctrlKey && !e.metaKey) {
      if (tlGrid.scrollWidth <= tlGrid.clientWidth + 1) return;
      e.preventDefault();
      var roll = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      tlGrid.scrollLeft += roll;
      return;
    }

    e.preventDefault();
    var span = trackSpan();
    var under = timeFromX(e.clientX);
    var factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;

    zoomLevel = Math.max(1, Math.min(40, zoomLevel * factor));
    applyZoom();

    var strip = tlZoom.getBoundingClientRect().width;
    var grid = tlGrid.getBoundingClientRect();
    tlGrid.scrollLeft = under / span * strip - (e.clientX - grid.left);
    drawTrack();
  }, { passive: false });

  applyZoom();

  /* Dragging a keyframe retimes it. */
  var dragging = null;

  tlGrid.addEventListener("pointerdown", function (e) {
    var chip = e.target.closest(".tl-key");
    if (!chip) return;
    e.preventDefault();
    var id = parseInt(chip.dataset.id, 10);
    pick(id);
    dragging = id;
    if (tlGrid.setPointerCapture) {
      try { tlGrid.setPointerCapture(e.pointerId); } catch (err) {}
    }
  });

  tlGrid.addEventListener("pointermove", function (e) {
    if (dragging === null) return;
    var item = findKey(dragging);
    if (!item) return;
    item.t = timeFromX(e.clientX);
    track.sort(function (x, y) { return x.t - y.t; });
    drawTrack();
  });

  function endDrag() {
    if (dragging === null) return;
    dragging = null;
    applyTrack(elapsed);
  }

  tlGrid.addEventListener("pointerup", endDrag);
  tlGrid.addEventListener("pointercancel", endDrag);

  /* Clicking the ruler scrubs, which is how a keyframe gets checked in place. */
  tlRuler.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    scrubTo(timeFromX(e.clientX));
  });

  function scrubTo(time) {
    setPlaying(false);
    elapsed = time;
    if (haveAudio()) {
      try { audio.currentTime = Math.min(time, audio.duration || time); } catch (err) {}
    }
    shownCue = -1;
    drawClock();
    renderCue(elapsed);
    applyTrack(elapsed);
    drawPlayhead();
  }

  capBtn.addEventListener("click", function () {
    capturing = !capturing;
    capBtn.classList.toggle("is-armed", capturing);
    capLabel.textContent = capturing ? "Capturing" : "Capture";
    tlInfo.textContent = capturing
      ? "armed: Play, then drive the scene"
      : (track.length ? track.length + " keyframes" : "nothing captured");
    capBtn.blur();
  });

  document.getElementById("tlClear").addEventListener("click", function () {
    track = [];
    picked = null;
    trackPose = null;
    drawTrack();
  });

  tlBack.addEventListener("click", function () { nudge(-0.1); });
  tlFwd.addEventListener("click", function () { nudge(0.1); });

  tlDel.addEventListener("click", function () {
    for (var i = 0; i < track.length; i++) {
      if (track[i].id === picked) { track.splice(i, 1); break; }
    }
    picked = null;
    drawTrack();
    applyTrack(elapsed);
  });

  drawTrack();

  /* ---------- blinks and the mouth ---------- */

  /* Optional frames beside each pose, each one the pose's own file with only
     the face changed, so it lies over the base at the same registration and
     covers it exactly:

       <pose>-blink.webp     eyes shut
       <pose>-talk-a.webp    mouth wide open
       <pose>-talk-e.webp    mid open, corners wide
       <pose>-talk-o.webp    small and rounded
       <pose>-talk-m.webp    lips together
       <pose>-talk-s.webp    narrow, upper teeth

     A pose with none of them simply does not blink or speak, and one with only
     the older <pose>-talk.webp still works from that. The drawings themselves
     are png, kept in artwork-masters/; build-webp.py makes these from them. */
  var MOUTH_SHAPES = ["talk-a", "talk-e", "talk-o", "talk-m", "talk-s"];
  var OLDER_MOUTHS = ["talk", "talk2"];

  /* How the face behaves. Shorter shut time is a faster blink; shorter waits
     mean more of them. */
  var BLINK_SHUT = 70;
  var BLINK_WAIT = 1900;
  var BLINK_SPREAD = 2300;
  var BLINK_AGAIN = 0.16;
  var BLINK_SOON = 150;

  var MOUTH_HOLD = 70;
  var MOUTH_SPREAD = 60;
  var MOUTH_REST = 0.12;

  var faces = {};
  var activeFace = null;
  var blinkAt = 0;
  var blinkUntil = 0;
  var mouthAt = 0;
  var mouthNow = null;
  var lastMouth = null;
  var characterBox = document.getElementById("character");

  function probeFace(pose, suffix, onSettled) {
    var img = document.createElement("img");
    img.className = "pose face";
    img.dataset.pose = pose;
    img.alt = "";

    img.addEventListener("load", function () {
      if (suffix === "blink") {
        faces[pose].blink = img;
      } else {
        faces[pose].mouths.push(img);
        /* Named so the words can ask for a shape rather than an index. */
        faces[pose].byShape[suffix] = img;
      }
      characterBox.appendChild(img);
      if (img.decode) img.decode().catch(function () {});
      if (onSettled) onSettled();
    });

    img.addEventListener("error", function () { if (onSettled) onSettled(); });
    img.src = pose + "/" + pose + "-" + suffix + ".webp";
  }

  function loadFaces(pose) {
    faces[pose] = { blink: null, mouths: [], byShape: {} };
    probeFace(pose, "blink", null);

    /* The older pair is only asked for once the named shapes have all had
       their turn and none of them answered, which keeps the misses down. */
    var waiting = MOUTH_SHAPES.length;
    function settled() {
      waiting--;
      if (waiting || faces[pose].mouths.length) return;
      for (var i = 0; i < OLDER_MOUTHS.length; i++) probeFace(pose, OLDER_MOUTHS[i], null);
    }

    for (var i = 0; i < MOUTH_SHAPES.length; i++) probeFace(pose, MOUTH_SHAPES[i], settled);
  }

  for (var facePose in poses) {
    if (Object.prototype.hasOwnProperty.call(poses, facePose)) loadFaces(facePose);
  }

  function showFace(img) {
    if (activeFace === img) return;
    if (activeFace) activeFace.classList.remove("is-on");
    activeFace = img || null;
    if (activeFace) activeFace.classList.add("is-on");
  }

  /* A shape at random, never the same one twice running, with the odd closed
     beat standing in for the gap between words. */

  /* ---------- reading the words off the page ---------- */

  /* What the mouth does is mostly the vowel. Of the consonants, only the ones
     that make the lips do something a vowel would not are worth a frame at
     all: b, m and p close them, the sibilants narrow them, and a w at the
     start of a word rounds them. Everything else is tongue, velum or throat,
     and the audience sees nothing, so it emits nothing and the vowel either
     side carries it. Giving every consonant a frame is what makes a talking
     mouth look like a machine.

     One table serves English and Singlish with no flag anywhere, because the
     four places they look like they disagree turn out to be positional rather
     than linguistic: w rounds only at the start of a word, a vowel pair ending
     in w or y is only a pair when a vowel does not follow it, a word-final e
     is always light, and th is transparent in both. That last one is a
     decision rather than a dodge. Sinhala's th is a dental t, a stop with the
     lips idle, and it is everywhere - thamai, mathaka, ithin, gaththa - so
     reading it as the English fricative sprays a teeth-slit through every
     other syllable. Losing the small English slit costs far less. */

  var TICK = 0.04;
  var FLOOR = 2;                 /* under two ticks a shape is a flicker */
  var DIP_CEIL = 3;
  var CEIL = { "talk-a": 5, "talk-e": 6, "talk-o": 6, "talk-s": 4, "talk-m": 4 };
  var LEAD = 2;                  /* start a shade early; late reads worse */
  var TAIL = 2;                  /* close the lips at the end of a line */
  var JOIN = 6;                  /* cues closer than this are one breath */
  var RATE_MAX = 7;              /* vowels a second before beats get dropped */
  var SOFT_PAUSE = 4;
  var HARD_PAUSE = 8;

  var VOWEL_LETTER = "aeiou";
  var FUNCTION_WORDS = (" a an the is of to and in it on or as at be that " +
                        " da de ne yi ka ma ").split(/\s+/);

  /* kind V is a vowel carrying a weight, C a consonant costing whole ticks,
     and a pattern listed with no kind is transparent: matched so it is
     consumed whole, then thrown away. Longest first, which is what stops sh
     being read as s then h, or aa as two separate a beats. */
  var MOUTH_RULES = [
    ["igh", "VV", "talk-a", 1.0, "talk-e", 0.7],
    ["aee", "V", "talk-a", 1.4],
    ["tch", "C", "talk-s", 2],

    ["aa", "V", "talk-a", 1.8],
    ["ae", "V", "talk-a", 1.2],
    ["ai", "VV", "talk-a", 1.0, "talk-e", 0.7],
    ["ay", "VV", "talk-a", 1.0, "talk-e", 0.7, "guard"],
    ["au", "V", "talk-o", 1.4],
    ["aw", "V", "talk-o", 1.4, "guard"],
    ["ee", "V", "talk-e", 1.8],
    ["ii", "V", "talk-e", 1.8],
    ["ea", "V", "talk-e", 1.4],
    ["ei", "V", "talk-e", 1.4],
    ["ie", "V", "talk-e", 1.4],
    ["ey", "V", "talk-e", 1.4, "guard"],
    ["oo", "V", "talk-o", 1.8],
    ["uu", "V", "talk-o", 1.8],
    ["oa", "V", "talk-o", 1.4],
    ["ui", "V", "talk-o", 1.4],
    ["ue", "V", "talk-o", 1.4],
    ["ou", "VV", "talk-a", 1.0, "talk-o", 0.7],
    ["ow", "VV", "talk-a", 1.0, "talk-o", 0.7, "guard"],
    ["oi", "VV", "talk-o", 1.0, "talk-e", 0.7],
    ["oy", "VV", "talk-o", 1.0, "talk-e", 0.7, "guard"],

    /* One closure held through both letters, not two smacks: amba, Colombo. */
    ["mb", "C", "talk-m", 3], ["mp", "C", "talk-m", 3],
    /* A doubled letter is one longer sound, and it leans on its neighbours. */
    ["mm", "C", "talk-m", 3, "gem"], ["pp", "C", "talk-m", 3, "gem"],
    ["bb", "C", "talk-m", 3, "gem"], ["ss", "C", "talk-s", 3, "gem"],
    ["sh", "C", "talk-s", 2], ["ch", "C", "talk-s", 2], ["ph", "C", "talk-s", 2],

    /* Behind the teeth, every one of them. Nothing to see. */
    ["th", "-"], ["dh", "-"], ["kh", "-"], ["gh", "-"], ["bh", "-"],
    ["ck", "-"], ["ng", "-"], ["nd", "-"], ["nt", "-"], ["nk", "-"], ["nj", "-"],
    ["tt", "-", "gem"], ["dd", "-", "gem"], ["nn", "-", "gem"],
    ["ll", "-", "gem"], ["kk", "-", "gem"], ["rr", "-", "gem"], ["gg", "-", "gem"],

    ["a", "V", "talk-a", 1.0],
    ["e", "V", "talk-e", 1.0],
    ["i", "V", "talk-e", 0.9],
    ["o", "V", "talk-o", 1.0],
    ["u", "V", "talk-o", 0.9],

    ["m", "C", "talk-m", 2], ["b", "C", "talk-m", 2], ["p", "C", "talk-m", 2],
    ["s", "C", "talk-s", 2], ["z", "C", "talk-s", 2], ["j", "C", "talk-s", 2],
    ["x", "C", "talk-s", 2], ["f", "C", "talk-s", 2], ["v", "C", "talk-s", 2],
    ["q", "C", "talk-o", 2]
  ];

  function isVowelLetter(ch) { return ch && VOWEL_LETTER.indexOf(ch) !== -1; }

  /* The handful of letters whose value depends on where they sit. */
  function placedRule(word, at) {
    var ch = word.charAt(at);
    var next = word.charAt(at + 1);

    if (ch === "w") {
      /* write, wrong: the w is silent, and rounding for it is a visible lie. */
      if (at === 0 && next === "r") return { skip: 1 };
      if (at === 0 && next === "h") return { kind: "C", shape: "talk-o", ticks: 2, skip: 2 };
      /* Sinhala's w has no rounding at all, and it is almost always medial:
         wenasa, puluwan, kiyanawa. English's does, and it is almost always
         initial: what, we, why. So position decides, not language. */
      if (at === 0) return { kind: "C", shape: "talk-o", ticks: 2, skip: 1 };
      return { skip: 1 };
    }

    if (ch === "q" && next === "u") {
      return { kind: "C", shape: "talk-o", ticks: 2, skip: 2 };
    }

    /* A glide before a vowel, and the mouth is already making the vowel:
       yes, oyaa, kiyanawa, lassanayi. */
    if (ch === "y") {
      if (isVowelLetter(next)) return { skip: 1 };
      return { kind: "V", shape: "talk-e", weight: 0.9, skip: 1 };
    }

    /* Soft c only. Hard c is a k and shows nothing: capital, Colombo. */
    if (ch === "c") {
      if (next === "e" || next === "i" || next === "y") {
        return { kind: "C", shape: "talk-s", ticks: 2, skip: 1 };
      }
      return { skip: 1 };
    }

    /* No silent-e rule. It would delete the last syllable of kade, mage,
       gedhare and kiyanne, which are ordinary Sinhala words. */
    if (ch === "e" && at === word.length - 1) {
      return { kind: "V", shape: "talk-e", weight: 0.6, skip: 1 };
    }

    if (ch >= "0" && ch <= "9") {
      return { kind: "V", shape: "talk-a", weight: 0.9, skip: 1 };
    }

    return null;
  }

  function tableRule(word, at) {
    for (var i = 0; i < MOUTH_RULES.length; i++) {
      var row = MOUTH_RULES[i];
      var pattern = row[0];
      if (word.substr(at, pattern.length) !== pattern) continue;

      /* A pair ending in w or y is only a pair when no vowel follows it:
         oyaa is o-y-aa, nowe is no-we, hawasa is ha-wa-sa. */
      var guarded = row[row.length - 1] === "guard";
      if (guarded && isVowelLetter(word.charAt(at + pattern.length))) continue;

      var gem = row[row.length - 1] === "gem";
      if (row[1] === "-") return { skip: pattern.length, gem: gem };
      if (row[1] === "C") {
        return { kind: "C", shape: row[2], ticks: row[3], skip: pattern.length, gem: gem };
      }
      if (row[1] === "V") {
        return { kind: "V", shape: row[2], weight: row[3], skip: pattern.length };
      }
      return {
        kind: "VV", shape: row[2], weight: row[3],
        shape2: row[4], weight2: row[5], skip: pattern.length
      };
    }
    return null;
  }

  function scanWord(word) {
    var beats = [];
    var at = 0;

    while (at < word.length) {
      var hit = placedRule(word, at) || tableRule(word, at);
      if (!hit) { at += 1; continue; }

      if (hit.kind === "V" || hit.kind === "VV") {
        beats.push({ kind: "V", shape: hit.shape, weight: hit.weight });
        if (hit.kind === "VV") beats.push({ kind: "V", shape: hit.shape2, weight: hit.weight2, glide: true });
      } else if (hit.kind === "C") {
        beats.push({ kind: "C", shape: hit.shape, ticks: hit.ticks });
      }

      /* A long consonant borrows from the vowel in front and lends to the one
         behind, which is what a geminate actually sounds like. */
      if (hit.gem) {
        for (var b = beats.length - 1; b >= 0; b--) {
          if (beats[b].kind === "V") { beats[b].weight *= 0.8; break; }
        }
        beats.push({ lend: true });
      }

      at += hit.skip;
    }

    /* Nothing but silent letters still moves the mouth once. */
    if (!beats.length && word.length) beats.push({ kind: "V", shape: "talk-e", weight: 0.6 });
    return beats;
  }

  function readWord(word, quiet) {
    var beats = scanWord(word);
    var out = [];
    var lend = false;

    for (var i = 0; i < beats.length; i++) {
      if (beats[i].lend) { lend = true; continue; }
      if (lend && beats[i].kind === "V") { beats[i].weight *= 1.15; lend = false; }
      out.push(beats[i]);
    }

    var first = -1;
    for (i = 0; i < out.length; i++) if (out[i].kind === "V") { first = i; break; }
    if (first !== -1 && out[first].weight < 1.8) out[first].weight *= 1.15;

    if (quiet) {
      for (i = 0; i < out.length; i++) {
        if (out[i].kind === "V") out[i].weight *= 0.7;
        else out[i].spare = true;
      }
    }
    return out;
  }

  function readLine(text) {
    var clean = String(text).toLowerCase()
      .replace(/\[[^\]]*\]/g, " ")
      .replace(/\([^)]*\)/g, " ")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/\u0101/g, "aa").replace(/\u0113/g, "ee").replace(/\u012b/g, "ii")
      .replace(/\u014d/g, "oo").replace(/\u016b/g, "uu").replace(/\u00e6/g, "ae")
      .replace(/([a-z])['\u2019-]([a-z])/g, "$1$2");

    var marks = clean.replace(/[,;:]/g, " \u0001 ").replace(/[.!?\u2026\u2014]/g, " \u0002 ");
    var parts = marks.split(/\s+/);
    var out = [];

    /* A mark at the very end of the line is not a pause in it, it is the
       closing of the mouth, and that is the tail. */
    while (parts.length && (parts[parts.length - 1] === "\u0001" ||
                            parts[parts.length - 1] === "\u0002" || parts[parts.length - 1] === "")) {
      parts.pop();
    }

    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (!part) continue;
      if (part === "\u0001") { out.push({ kind: "P", ticks: SOFT_PAUSE }); continue; }
      if (part === "\u0002") { out.push({ kind: "P", ticks: HARD_PAUSE, hard: true }); continue; }

      var word = part.replace(/[^a-z0-9]/g, "");
      if (!word) continue;

      var beats = readWord(word, FUNCTION_WORDS.indexOf(word) !== -1);

      /* The gap between words is a quarter beat on the vowel before it and
         nothing else. Closing the lips in every gap is the chewing tell. */
      var follows = parts[i + 1];
      if (follows !== "\u0001" && follows !== "\u0002") {
        for (var j = beats.length - 1; j >= 0; j--) {
          if (beats[j].kind === "V") { beats[j].weight += 0.25; break; }
        }
      }
      for (j = 0; j < beats.length; j++) out.push(beats[j]);
    }
    return out;
  }

  /* Run again after every drop, because dropping changes what is adjacent. */
  function joinBeats(list) {
    var out = [];

    for (var i = 0; i < list.length; i++) {
      var beat = list[i];
      var last = out[out.length - 1];

      /* A sibilant or a closure really does run across a word boundary. */
      if (last && last.kind === "C" && beat.kind === "C" && last.shape === beat.shape) {
        last.ticks = Math.min(Math.max(last.ticks, beat.ticks) + 1, CEIL[last.shape]);
        continue;
      }
      /* A round before a round vowel is the same mouth twice. */
      if (last && last.kind === "C" && beat.kind === "V" && last.shape === beat.shape) {
        out.pop();
        beat = { kind: "V", shape: beat.shape, weight: beat.weight + 0.4, glide: beat.glide };
      }
      out.push(beat);
    }

    /* THE DIP, and it is the whole of what makes Sinhala work. Its words are
       full of short a and its consonants are nearly all tongue, so balanna,
       kohomada and "godak rasai" would otherwise hold one unchanging open
       mouth from end to end. Between two open beats the jaw really does come
       up and go down again, and that is a talk-e - never a rest, because the
       resting mouth is itself mildly open and would read as a third open
       beat. It is planned in here, before the time is shared out, so it
       competes for its share like anything else. */
    var dipped = [];
    for (i = 0; i < out.length; i++) {
      var prev = dipped[dipped.length - 1];
      if (prev && prev.kind === "V" && out[i].kind === "V" &&
          prev.shape === out[i].shape &&
          (prev.shape === "talk-a" || prev.shape === "talk-o")) {
        dipped.push({ kind: "V", shape: "talk-e", weight: 0.5, dip: true });
      }
      dipped.push(out[i]);
    }

    /* A line that ends without this looks clipped. */
    for (i = dipped.length - 1; i >= 0; i--) {
      if (dipped[i].kind === "V") { dipped[i].weight *= 1.5; break; }
    }
    return dipped;
  }

  /* Latin letters carry the mapping and Sinhala script does not, so a visible
     subtitle is only worth reading if it is written in them already. */
  function latinShare(list) {
    var latin = 0, letters = 0;
    for (var i = 0; i < list.length; i++) {
      var text = list[i].said || "";
      for (var j = 0; j < text.length; j++) {
        var ch = text.charAt(j);
        if (/[\s0-9.,!?'"();:-]/.test(ch)) continue;
        letters++;
        if (/[A-Za-z]/.test(ch)) latin++;
      }
    }
    return letters ? latin / letters : 0;
  }

  /* The track nobody sees wins outright. Mixing the two would have her speak
     both wherever they overlap. */
  function lipSource() {
    if (syncCues.length) return syncCues;
    if (cues.length && latinShare(cues) > 0.6) return cues;
    return null;
  }

  /* ---------- turning that into whole ticks ---------- */

  var mouthPlan = [];

  function dropOne(list) {
    var i;
    /* Detail first, lip closures last, in that order, because that is what
       really goes when someone speaks quickly. */
    for (i = list.length - 1; i >= 0; i--) if (list[i].dip) { list.splice(i, 1); return true; }
    for (i = list.length - 1; i >= 0; i--) if (list[i].glide) { list.splice(i, 1); return true; }
    for (i = list.length - 1; i >= 0; i--) if (list[i].spare && list[i].kind === "C") { list.splice(i, 1); return true; }
    for (i = list.length - 2; i >= 1; i--) {
      if (list[i].kind === "C" && list[i - 1].kind === "C" && list[i + 1].kind === "C" &&
          list[i].shape !== "talk-m") { list.splice(i, 1); return true; }
    }
    for (i = list.length - 1; i >= 0; i--) if (list[i].kind === "C" && list[i].shape === "talk-s") { list.splice(i, 1); return true; }
    for (i = list.length - 1; i >= 0; i--) if (list[i].kind === "P" && list[i].ticks > 0) { list[i].ticks = list[i].ticks > 4 ? 4 : list[i].ticks - 2; return true; }
    for (i = list.length - 1; i >= 0; i--) if (list[i].kind === "C" && list[i].shape === "talk-o") { list.splice(i, 1); return true; }

    /* Lightest vowel folded into the one before it, never the first or last. */
    var pick = -1;
    for (i = 1; i < list.length - 1; i++) {
      if (list[i].kind !== "V") continue;
      if (pick === -1 || list[i].weight < list[pick].weight) pick = i;
    }
    if (pick !== -1) {
      for (i = pick - 1; i >= 0; i--) {
        if (list[i].kind === "V") { list[i].weight += list[pick].weight; break; }
      }
      list.splice(pick, 1);
      return true;
    }
    return false;
  }

  function planCue(cue, before, after) {
    var beats = joinBeats(readLine(cue.said || ""));
    if (!beats.length) return [];

    var from = Math.round(cue.start / TICK);
    var to = Math.round(cue.end / TICK);
    var lead = (before === null || from - before >= 4) ? LEAD : 0;
    var tail = (after !== null && after - to < JOIN) ? 0 : TAIL;
    var seconds = cue.end - cue.start;

    var pool, weights, nuclei, fixed, guard = 0;
    while (true) {
      fixed = tail;
      weights = 0;
      nuclei = 0;
      for (var i = 0; i < beats.length; i++) {
        if (beats[i].kind === "C") fixed += beats[i].ticks;
        else if (beats[i].kind === "P") fixed += beats[i].ticks;
        else { weights += beats[i].weight; nuclei++; }
      }
      pool = (to - from) + lead - fixed;

      var tooDense = nuclei && (pool < FLOOR * nuclei || nuclei > RATE_MAX * seconds);
      if (!tooDense || guard++ > 200) break;
      if (!dropOne(beats)) break;
      beats = joinBeats(beats);
    }

    if (pool < 0) pool = 0;

    /* Every vowel gets a share of what the consonants left, in proportion to
       its weight. Sharing it evenly instead is what turns a mouth into a
       metronome: it makes an s as long as a long aa. */
    var unit = weights ? pool / weights : 0;
    var exact = [];
    var fixedSum = 0;
    var freeSum = 0;

    for (i = 0; i < beats.length; i++) {
      if (beats[i].kind !== "V") { exact.push(null); continue; }
      var want = beats[i].weight * unit;
      var cap = beats[i].dip ? DIP_CEIL : CEIL[beats[i].shape];
      if (want < FLOOR) { exact.push({ held: FLOOR }); fixedSum += FLOOR; }
      else if (want > cap) { exact.push({ held: cap }); fixedSum += cap; }
      else { exact.push({ want: want }); freeSum += want; }
    }

    /* Whatever the clamps did not use becomes one settle at the end, rather
       than being shared out again: handing a clamped vowel's surplus to
       whichever beat happens to be next is how an unstressed syllable ends up
       longer than the stressed one in front of it. */
    var give = pool - fixedSum;
    if (give < 0) give = 0;
    var slack = 0;
    if (give > Math.round(freeSum)) { slack = give - Math.round(freeSum); give = Math.round(freeSum); }

    /* Handed out by largest remainder, so the ticks add up exactly and the
       same line always comes out the same way. */
    var whole = [], rest = [];
    var used = 0;
    for (i = 0; i < exact.length; i++) {
      if (!exact[i] || exact[i].held !== undefined) { whole.push(0); rest.push(-1); continue; }
      var floorTicks = Math.floor(exact[i].want);
      if (floorTicks < FLOOR) floorTicks = FLOOR;
      whole.push(floorTicks);
      rest.push(exact[i].want - Math.floor(exact[i].want));
      used += floorTicks;
    }
    var spare = give - used;
    while (spare > 0) {
      var best = -1;
      for (i = 0; i < rest.length; i++) {
        if (rest[i] < 0) continue;
        if (best === -1 || rest[i] > rest[best]) best = i;
      }
      if (best === -1) break;
      whole[best]++;
      rest[best] = -1;
      spare--;
      if (spare > 0 && best === rest.length - 1) {
        for (i = 0; i < rest.length; i++) if (exact[i] && exact[i].want !== undefined) rest[i] = exact[i].want - Math.floor(exact[i].want);
      }
    }

    var runs = [];
    var at = from - lead;

    function put(shape, ticks) {
      if (ticks <= 0) return;
      var last = runs[runs.length - 1];
      if (last && last.shape === shape) { last.to += ticks; at += ticks; return; }
      runs.push({ from: at, to: at + ticks, shape: shape });
      at += ticks;
    }

    for (i = 0; i < beats.length; i++) {
      var beat = beats[i];
      if (beat.kind === "C") { put(beat.shape, beat.ticks); continue; }
      if (beat.kind === "P") {
        /* The last couple of ticks of a pause belong to the next sound: the
           mouth is in position before the voice arrives. */
        var lead2 = Math.min(2, beat.ticks);
        if (beat.hard) { put("talk-m", 2); put(null, beat.ticks - 2 - lead2); }
        else put(null, beat.ticks - lead2);
        var nextShape = null;
        for (var k = i + 1; k < beats.length; k++) { if (beats[k].shape) { nextShape = beats[k].shape; break; } }
        put(nextShape, lead2);
        continue;
      }
      var ticks = exact[i] && exact[i].held !== undefined ? exact[i].held : whole[i];
      put(beat.shape, ticks);
    }

    /* She finishes the line and settles while the subtitle is still up, which
       is what really happens: subtitle ends are padded well past the voice. */
    if (slack >= FLOOR) put(null, slack);
    else tail = Math.min(tail + slack, 4);
    put("talk-m", tail);

    return runs;
  }

  function planMouths() {
    mouthPlan = [];
    var list = lipSource();
    if (!list) return;

    for (var i = 0; i < list.length; i++) {
      var before = i > 0 ? Math.round(list[i - 1].end / TICK) : null;
      var after = i < list.length - 1 ? Math.round(list[i + 1].start / TICK) : null;
      var runs = planCue(list[i], before, after);
      for (var j = 0; j < runs.length; j++) mouthPlan.push(runs[j]);
    }
    mouthPlan.sort(function (x, y) { return x.from - y.from; });
  }

  /* A pure function of the clock: no state between frames, nothing random, so
     the preview and the exported file land on the same shape. */
  function plannedMouth(time) {
    var tick = Math.floor(time / TICK + 1e-6);
    var lo = 0, hi = mouthPlan.length - 1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      var run = mouthPlan[mid];
      if (tick < run.from) hi = mid - 1;
      else if (tick >= run.to) lo = mid + 1;
      else return run.shape;
    }
    return null;
  }

  /* A pose missing the drawing asked for takes the nearest one it has rather
     than showing nothing at all. */
  var SHAPE_FALLBACK = {
    "talk-a": ["talk-a", "talk-e", "talk-s", "talk-o", "talk-m"],
    "talk-e": ["talk-e", "talk-a", "talk-s", "talk-o", "talk-m"],
    "talk-o": ["talk-o", "talk-e", "talk-a", "talk-m", "talk-s"],
    "talk-s": ["talk-s", "talk-e", "talk-a", "talk-o", "talk-m"],
    "talk-m": ["talk-m", "talk-o", "talk-s", "talk-e", "talk-a"]
  };

  function faceFor(set, shape) {
    if (!shape || !set.byShape) return null;
    var order = SHAPE_FALLBACK[shape] || [shape];
    for (var i = 0; i < order.length; i++) if (set.byShape[order[i]]) return set.byShape[order[i]];
    return null;
  }

  /* A pose that only has the older single talk frame cannot be driven by
     words, so it keeps the old behaviour instead of standing still. */
  function namedShapes(set) {
    var n = 0;
    for (var i = 0; i < MOUTH_SHAPES.length; i++) {
      if (set.byShape && set.byShape[MOUTH_SHAPES[i]]) n++;
    }
    return n;
  }

  function nextMouth(set) {
    if (!set.mouths.length) return null;
    if (Math.random() < MOUTH_REST) return null;
    if (set.mouths.length === 1) return set.mouths[0];

    var pick = set.mouths[Math.floor(Math.random() * set.mouths.length)];
    if (pick === lastMouth) {
      var at = set.mouths.indexOf(pick);
      pick = set.mouths[(at + 1) % set.mouths.length];
    }
    return pick;
  }

  function faceTick() {
    var now = performance.now();
    var set = faces[current] || { blink: null, mouths: [], byShape: {} };

    /* Blinks come every couple of seconds, a shade irregular, now and then as
       a quick pair. They carry on while paused, so she looks alive in a hold. */
    if (!blinkAt) blinkAt = now + 900 + Math.random() * BLINK_SPREAD;
    if (!blinkUntil && now >= blinkAt) blinkUntil = now + BLINK_SHUT;
    if (blinkUntil && now >= blinkUntil) {
      blinkUntil = 0;
      blinkAt = now + (Math.random() < BLINK_AGAIN
        ? BLINK_SOON
        : BLINK_WAIT + Math.random() * BLINK_SPREAD);
    }

    /* The mouth moves only while a line is on screen and the clock is
       running, changing shape at an uneven pace so it does not look counted
       out. */
    if (!playing || !set.mouths.length) {
      mouthNow = null;
      lastMouth = null;
      mouthAt = 0;
    } else if (mouthPlan.length && namedShapes(set) > 1) {
      /* Driven by the words. Same clock in, same shape out, every time. */
      mouthNow = faceFor(set, plannedMouth(elapsed));
      lastMouth = mouthNow;
    } else if (shownCue !== -1) {
      /* Nothing to read, so the old behaviour: keep the mouth busy while a
         line is up, without pretending it knows what is being said. */
      if (now >= mouthAt) {
        mouthNow = nextMouth(set);
        lastMouth = mouthNow;
        mouthAt = now + MOUTH_HOLD + Math.random() * MOUTH_SPREAD;
      }
    } else {
      mouthNow = null;
      lastMouth = null;
      mouthAt = 0;
    }

    var talking = mouthNow !== null;

    if (blinkUntil && set.blink) showFace(set.blink);
    else showFace(talking ? mouthNow : null);
  }

  setInterval(faceTick, 40);

  /* ---------- drawing the scene onto a canvas ---------- */

  /* The recording is painted rather than screen-grabbed, so what comes out is a
     true 1080 x 1920 whatever the view is zoomed to. Everything is measured
     off the live page and divided by the view scale, which puts it back into
     canvas pixels, so the frame cannot drift away from the preview. */
  var frame = document.createElement("canvas");
  var brush = frame.getContext("2d");

  var skyEl = document.querySelector(".sky");
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

    brush.fillStyle = "#ffffff";
    brush.fillRect(0, 0, canvasW, canvasH);

    for (var i = 0; i < slotEls.length; i++) {
      var el = slotEls[i];
      var b = boxOf(el);
      var radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;

      brush.save();
      brush.shadowColor = "rgba(30,45,70,.08)";
      brush.shadowBlur = 26;
      brush.shadowOffsetY = 10;
      roundedPath(b.x, b.y, b.w, b.h, radius);
      brush.fillStyle = el.classList.contains("is-filled") ? "#ffffff" : "#f1f3f6";
      brush.fill();
      brush.restore();

      /* The same dissolve the page is showing, worked out from when it began
         rather than read back off the elements: the one going out underneath at
         full strength, the one arriving over it. */
      var reel = reels[el.dataset.slot];
      var arriving = reel && reel.layers.length ? reel.layers[reel.index] : null;

      if (arriving && arriving.naturalWidth) {
        var mix = reel.fadeAt ? (performance.now() - reel.fadeAt) / SLOT_FADE : 1;
        if (!(mix >= 0)) mix = 1;
        if (mix > 1) mix = 1;

        brush.save();
        roundedPath(b.x, b.y, b.w, b.h, radius);
        brush.clip();

        if (mix < 1 && reel.under && reel.under !== arriving && reel.under.naturalWidth) {
          drawCover(reel.under, b.x, b.y, b.w, b.h);
        }

        brush.globalAlpha = mix;
        drawCover(arriving, b.x, b.y, b.w, b.h);
        brush.globalAlpha = 1;
        brush.restore();
      }

      brush.save();
      roundedPath(b.x, b.y, b.w, b.h, radius);
      brush.strokeStyle = "rgba(23,32,58,.14)";
      brush.lineWidth = 1;
      brush.stroke();
      brush.restore();
    }

    var sh = boxOf(castShadow);
    brush.save();
    brush.translate(sh.x + sh.w / 2, sh.y + sh.h / 2);
    brush.scale(sh.w / 2, sh.h / 2);
    var cast = brush.createRadialGradient(0, 0, 0, 0, 0, 1);
    cast.addColorStop(0, "rgba(23,32,58,.26)");
    cast.addColorStop(0.45, "rgba(23,32,58,.12)");
    cast.addColorStop(0.72, "rgba(23,32,58,0)");
    brush.fillStyle = cast;
    brush.fillRect(-1, -1, 2, 2);
    brush.restore();

    var pose = poses[current];
    if (pose && pose.naturalWidth) {
      var p = boxOf(pose);
      brush.drawImage(pose, p.x, p.y, p.w, p.h);
    }

    /* The face is chosen again here rather than being taken as it stands,
       because the page picks it on a 40ms timer of its own and a frame drawn
       between two of those would carry a mouth up to a frame stale against its
       own timestamp. Asking for it at the moment of drawing is what keeps the
       exported file and the preview on the same shape. */
    faceTick();

    if (activeFace && activeFace.naturalWidth) {
      var fx = boxOf(activeFace);
      brush.drawImage(activeFace, fx.x, fx.y, fx.w, fx.h);
    }

    drawOverlay(namesArt, namesOn, namesAt, SLOT_FADE);
    drawOverlay(captionArt, captionOn, captionAt, CAPTION_FADE);
  }

  /* ---------- the caption, drawn through the browser's own layout ---------- */

  /* Captions carry whatever CSS the box and the file between them ask for, so
     rather than reimplementing any of that on the canvas the real element is
     handed back to the browser inside an SVG and rasterised. It only has to
     happen when the line changes, not every frame. */
  /* Two pictures rather than one. The names and the caption arrive and leave
     at different moments and each wants its own fade, which one shared raster
     cannot give them. Both are still the real elements handed back to the
     browser inside an svg and laid out by the page's own stylesheet. */
  var captionArt = null;
  var captionKey = "";
  var captionOn = false;
  var captionAt = 0;

  var namesArt = null;
  var namesKey = "";
  var namesOn = false;
  var namesAt = 0;

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
    var names = ["--w", "--h", "--edge", "--slot-top", "--floor", "--char-height", "--breath", "--name-band"];
    var root = getComputedStyle(document.documentElement);
    var out = ":root{";
    for (var i = 0; i < names.length; i++) {
      out += names[i] + ":" + root.getPropertyValue(names[i]) + ";";
    }
    return out + "}";
  }

  function xmlText(raw) {
    return raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function stageDoc(inner) {
    var face = fontData
      ? '@font-face{font-family:"UN-Sandhyanee";src:url(' + fontData + ') format("truetype");}'
      : "";

    /* CDATA keeps the stylesheet away from the XML parser.

       The live variables go in AFTER the stylesheet, not before it. The sheet
       carries its own :root block with --w and --h written as the defaults,
       and inside the svg both blocks select the same element with the same
       weight, so whichever comes last wins. Ahead of it these were overruled
       by the file and every raster laid itself out at 1080 x 1920 whatever the
       canvas was actually set to. */
    var css = "<style><![CDATA[" + face + sheetText + rootVars() + cssBox.value + "]]></style>";

    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + canvasW + '" height="' + canvasH + '">' +
      '<foreignObject x="0" y="0" width="' + canvasW + '" height="' + canvasH + '">' +
      '<div xmlns="http://www.w3.org/1999/xhtml" class="stage">' + css + inner +
      "</div></foreignObject></svg>";
  }

  function rasterise(inner, keep) {
    var art = new Image();
    art.onload = function () { keep(art); };
    art.onerror = function () { keep(null); };
    art.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(stageDoc(inner));
  }

  /* How far through a fade the canvas is. The page does this with a css
     transition, and a transition does not advance at all in a window nobody is
     drawing, so a recording works it out from when the change happened. */
  function fadeAlpha(on, at, ms) {
    var k = at ? (performance.now() - at) / ms : 1;
    if (!(k >= 0)) k = 1;
    if (k > 1) k = 1;
    return on ? k : 1 - k;
  }

  function drawOverlay(art, on, at, ms) {
    if (!art) return;
    var a = fadeAlpha(on, at, ms);
    if (a <= 0) return;
    brush.globalAlpha = a;
    brush.drawImage(art, 0, 0, canvasW, canvasH);
    brush.globalAlpha = 1;
  }

  function buildCaption() {
    var on = subtitle.classList.contains("has-text");
    var html = on ? subtitleText.innerHTML : "";
    var key = html + "|" + canvasW + "x" + canvasH + "|" + cssBox.value;
    if (key === captionKey) return;

    /* The stylesheet may still be on its way. Leave the key alone so this runs
       again once it lands, rather than marking the caption done. */
    if (sheetText === null) return;
    captionKey = key;

    if (captionOn !== on) {
      captionOn = on;
      captionAt = performance.now();
    }

    /* A line that has ended keeps its picture, so there is something left to
       fade out of. What ends it is the alpha, not the absence of a raster. */
    if (!on) return;

    /* An SVG is read as XML, where a bare <br> is a syntax error. */
    var body = html.replace(BREAK_TAG, "<br/>");

    rasterise('<div class="subtitle has-text"><div class="subtitle-text">' + body + "</div></div>",
      function (art) { captionArt = art; });
  }

  function buildNames() {
    var left = nameLabels.a.textContent;
    var right = nameLabels.b.textContent;
    var on = !!(left || right);
    var key = left + "|" + right + "|" + canvasW + "x" + canvasH;
    if (key === namesKey) return;
    if (sheetText === null) return;
    namesKey = key;

    /* Restarted on every change rather than only on the first, so a name that
       arrives with the next picture fades up the way the picture does. The
       text swaps while it is invisible, which is what makes it read as a
       dissolve rather than a jump. */
    namesOn = on;
    namesAt = performance.now();
    if (!on) return;

    rasterise('<div class="slot-names has-text">' +
      '<div class="slot-name is-on">' + xmlText(left) + "</div>" +
      '<div class="slot-name is-on">' + xmlText(right) + "</div></div>",
      function (art) { namesArt = art; });
  }

  /* ---------- making the file open outside a browser ---------- */

  /* MediaRecorder writes a fragmented mp4: the header carries no sample table
     at all and every frame lives inside a moof/mdat pair. Browsers and VLC read
     that happily, which is why it looks fine here, but Windows Media Player,
     the Photos app and most video editors will not open it. This rebuilds the
     very same picture and sound as an ordinary mp4, with a real sample table up
     front, which opens anywhere. Nothing is re-encoded and nothing leaves the
     machine: the frames are copied across byte for byte. */

  function mp4Scan(view, bytes, from, to) {
    var out = [];
    var p = from;
    while (p + 8 <= to) {
      var size = view.getUint32(p);
      var type = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
      var head = 8;
      if (size === 1) { size = Number(view.getBigUint64(p + 8)); head = 16; }
      else if (size === 0) { size = to - p; }
      if (size < head || p + size > to) break;
      out.push({ type: type, start: p, size: size, body: p + head, end: p + size });
      p += size;
    }
    return out;
  }

  function mp4Pick(list, type) {
    for (var i = 0; i < list.length; i++) if (list[i].type === type) return list[i];
    return null;
  }

  function mp4Num(n) {
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  }

  function mp4Box(type, parts) {
    var body = 0;
    var i;
    for (i = 0; i < parts.length; i++) body += parts[i].length;

    var out = new Uint8Array(8 + body);
    out.set(mp4Num(8 + body), 0);
    for (i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);

    var at = 8;
    for (i = 0; i < parts.length; i++) { out.set(parts[i], at); at += parts[i].length; }
    return out;
  }

  function mp4Slice(bytes, box) {
    return bytes.subarray(box.start, box.end);
  }

  /* Every sample the fragment describes, with where its bytes are. */
  function mp4Fragment(view, bytes, moof) {
    var tracks = {};
    var trafs = mp4Scan(view, bytes, moof.body, moof.end);

    for (var i = 0; i < trafs.length; i++) {
      if (trafs[i].type !== "traf") continue;
      var kids = mp4Scan(view, bytes, trafs[i].body, trafs[i].end);

      var tfhd = mp4Pick(kids, "tfhd");
      if (!tfhd) continue;

      var flags = view.getUint32(tfhd.body) & 0xffffff;
      var trackId = view.getUint32(tfhd.body + 4);
      var at = tfhd.body + 8;

      var base = moof.start;
      if (flags & 0x000001) { base = Number(view.getBigUint64(at)); at += 8; }
      if (flags & 0x000002) at += 4;

      var defDur = 0, defSize = 0, defFlags = 0;
      if (flags & 0x000008) { defDur = view.getUint32(at); at += 4; }
      if (flags & 0x000010) { defSize = view.getUint32(at); at += 4; }
      if (flags & 0x000020) { defFlags = view.getUint32(at); at += 4; }

      if (!tracks[trackId]) tracks[trackId] = [];

      for (var j = 0; j < kids.length; j++) {
        if (kids[j].type !== "trun") continue;

        var tflags = view.getUint32(kids[j].body) & 0xffffff;
        var count = view.getUint32(kids[j].body + 4);
        var q = kids[j].body + 8;

        var offset = 0;
        if (tflags & 0x000001) { offset = view.getInt32(q); q += 4; }
        var firstFlags = null;
        if (tflags & 0x000004) { firstFlags = view.getUint32(q); q += 4; }

        var where = base + offset;

        for (var k = 0; k < count; k++) {
          var dur = defDur, size = defSize, sflags = defFlags, cts = 0;
          if (tflags & 0x000100) { dur = view.getUint32(q); q += 4; }
          if (tflags & 0x000200) { size = view.getUint32(q); q += 4; }
          if (tflags & 0x000400) { sflags = view.getUint32(q); q += 4; }
          if (tflags & 0x000800) { cts = view.getInt32(q); q += 4; }
          if (k === 0 && firstFlags !== null) sflags = firstFlags;

          tracks[trackId].push({
            at: where,
            size: size,
            dur: dur,
            cts: cts,
            sync: !(sflags & 0x00010000)
          });
          where += size;
        }
      }
    }
    return tracks;
  }

  /* stts, stsz, stsc, stco and friends, worked out from the sample list. */
  function mp4Tables(samples, dataAt) {
    var i;

    var stts = [];
    for (i = 0; i < samples.length; i++) {
      var last = stts[stts.length - 1];
      if (last && last[1] === samples[i].dur) last[0]++;
      else stts.push([1, samples[i].dur]);
    }
    var sttsBody = [0, 0, 0, 0].concat(mp4Num(stts.length));
    for (i = 0; i < stts.length; i++) sttsBody = sttsBody.concat(mp4Num(stts[i][0]), mp4Num(stts[i][1]));

    var stszBody = [0, 0, 0, 0].concat(mp4Num(0), mp4Num(samples.length));
    for (i = 0; i < samples.length; i++) stszBody = stszBody.concat(mp4Num(samples[i].size));

    /* One chunk holding the lot, which is legal and keeps the table small. */
    var stscBody = [0, 0, 0, 0].concat(mp4Num(1), mp4Num(1), mp4Num(samples.length), mp4Num(1));
    var stcoBody = [0, 0, 0, 0].concat(mp4Num(1), mp4Num(dataAt));

    var boxes = [
      mp4Box("stts", [new Uint8Array(sttsBody)]),
      mp4Box("stsc", [new Uint8Array(stscBody)]),
      mp4Box("stsz", [new Uint8Array(stszBody)]),
      mp4Box("stco", [new Uint8Array(stcoBody)])
    ];

    var syncs = [];
    for (i = 0; i < samples.length; i++) if (samples[i].sync) syncs.push(i + 1);
    if (syncs.length && syncs.length !== samples.length) {
      var stssBody = [0, 0, 0, 0].concat(mp4Num(syncs.length));
      for (i = 0; i < syncs.length; i++) stssBody = stssBody.concat(mp4Num(syncs[i]));
      boxes.push(mp4Box("stss", [new Uint8Array(stssBody)]));
    }

    var shifted = false;
    for (i = 0; i < samples.length; i++) if (samples[i].cts) { shifted = true; break; }
    if (shifted) {
      var cttsBody = [0, 0, 0, 0].concat(mp4Num(samples.length));
      for (i = 0; i < samples.length; i++) cttsBody = cttsBody.concat(mp4Num(samples[i].cts));
      boxes.push(mp4Box("ctts", [new Uint8Array(cttsBody)]));
    }

    return boxes;
  }

  /* Where the duration sits depends on the box and on its version. mvhd and
     mdhd carry a timescale before it; tkhd carries a track id and a spare
     field instead, so the two layouts do not line up. */
  function mp4WriteDuration(bytes, box, value) {
    var copy = new Uint8Array(mp4Slice(bytes, box));
    var wide = copy[8] === 1;
    var at;

    if (box.type === "tkhd") at = wide ? 36 : 28;
    else at = wide ? 32 : 24;

    if (wide) {
      /* 64 bit, and the high half is zero for anything of this length. */
      copy.set([0, 0, 0, 0], at);
      copy.set(mp4Num(value), at + 4);
    } else {
      copy.set(mp4Num(value), at);
    }
    return copy;
  }

  function toProgressiveMp4(bytes) {
    var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    var top = mp4Scan(view, bytes, 0, bytes.length);

    var ftyp = mp4Pick(top, "ftyp");
    var moov = mp4Pick(top, "moov");
    if (!ftyp || !moov) return null;

    var moofs = [];
    for (var i = 0; i < top.length; i++) if (top[i].type === "moof") moofs.push(top[i]);
    if (!moofs.length) return null;

    /* Gather every sample from every fragment, per track. */
    var perTrack = {};
    for (i = 0; i < moofs.length; i++) {
      var found = mp4Fragment(view, bytes, moofs[i]);
      for (var id in found) {
        if (!Object.prototype.hasOwnProperty.call(found, id)) continue;
        if (!perTrack[id]) perTrack[id] = [];
        perTrack[id] = perTrack[id].concat(found[id]);
      }
    }

    var moovKids = mp4Scan(view, bytes, moov.body, moov.end);
    var mvhd = mp4Pick(moovKids, "mvhd");
    if (!mvhd) return null;

    var movieScale = view.getUint32(mvhd.body + (bytes[mvhd.body] === 1 ? 20 : 12));

    /* The header comes before the data, and its size depends on the offsets it
       carries, so the tables are built twice: once to learn how long the header
       is, and again with the offsets that follow from it. */
    var built = null;
    var guess = 0;

    for (var pass = 0; pass < 3; pass++) {
      var traks = [];

      /* Where the first sample will land: after the header, and after the
         eight bytes of the mdat box that wraps the samples. Leaving those out
         puts every offset short by eight, which decodes to a black picture. */
      var dataAt = ftyp.size + guess + 8;
      var longest = 0;

      for (var t = 0; t < moovKids.length; t++) {
        if (moovKids[t].type !== "trak") continue;

        var trakKids = mp4Scan(view, bytes, moovKids[t].body, moovKids[t].end);
        var tkhd = mp4Pick(trakKids, "tkhd");
        var mdia = mp4Pick(trakKids, "mdia");
        if (!tkhd || !mdia) return null;

        var trackId = view.getUint32(tkhd.body + (bytes[tkhd.body] === 1 ? 20 : 12));
        var samples = perTrack[trackId] || [];

        var mdiaKids = mp4Scan(view, bytes, mdia.body, mdia.end);
        var mdhd = mp4Pick(mdiaKids, "mdhd");
        var minf = mp4Pick(mdiaKids, "minf");
        if (!mdhd || !minf) return null;

        var mediaScale = view.getUint32(mdhd.body + (bytes[mdhd.body] === 1 ? 20 : 12));

        var span = 0;
        for (i = 0; i < samples.length; i++) span += samples[i].dur;
        var movieSpan = mediaScale ? Math.round(span * movieScale / mediaScale) : 0;
        if (movieSpan > longest) longest = movieSpan;

        var minfKids = mp4Scan(view, bytes, minf.body, minf.end);
        var stbl = mp4Pick(minfKids, "stbl");
        if (!stbl) return null;

        var stsd = mp4Pick(mp4Scan(view, bytes, stbl.body, stbl.end), "stsd");
        if (!stsd) return null;

        var stblParts = [mp4Slice(bytes, stsd)].concat(mp4Tables(samples, dataAt));
        for (i = 0; i < samples.length; i++) dataAt += samples[i].size;

        var minfParts = [];
        for (i = 0; i < minfKids.length; i++) {
          minfParts.push(minfKids[i].type === "stbl"
            ? mp4Box("stbl", stblParts)
            : mp4Slice(bytes, minfKids[i]));
        }

        var mdiaParts = [];
        for (i = 0; i < mdiaKids.length; i++) {
          if (mdiaKids[i].type === "mdhd") mdiaParts.push(mp4WriteDuration(bytes, mdhd, span));
          else if (mdiaKids[i].type === "minf") mdiaParts.push(mp4Box("minf", minfParts));
          else mdiaParts.push(mp4Slice(bytes, mdiaKids[i]));
        }

        var trakParts = [];
        for (i = 0; i < trakKids.length; i++) {
          if (trakKids[i].type === "tkhd") trakParts.push(mp4WriteDuration(bytes, tkhd, movieSpan));
          else if (trakKids[i].type === "mdia") trakParts.push(mp4Box("mdia", mdiaParts));
          else if (trakKids[i].type === "edts") continue;
          else trakParts.push(mp4Slice(bytes, trakKids[i]));
        }

        traks.push(mp4Box("trak", trakParts));
      }

      var moovParts = [mp4WriteDuration(bytes, mvhd, longest)];
      for (i = 0; i < traks.length; i++) moovParts.push(traks[i]);
      for (i = 0; i < moovKids.length; i++) {
        var kind = moovKids[i].type;
        if (kind === "mvhd" || kind === "trak" || kind === "mvex") continue;
        moovParts.push(mp4Slice(bytes, moovKids[i]));
      }

      built = mp4Box("moov", moovParts);
      if (built.length === guess) break;
      guess = built.length;
    }

    if (!built) return null;

    /* The samples themselves, copied over in the order the tables promise. */
    var total = 0;
    var order = [];
    for (var m = 0; m < moovKids.length; m++) {
      if (moovKids[m].type !== "trak") continue;
      var kids2 = mp4Scan(view, bytes, moovKids[m].body, moovKids[m].end);
      var head = mp4Pick(kids2, "tkhd");
      var id2 = view.getUint32(head.body + (bytes[head.body] === 1 ? 20 : 12));
      var list = perTrack[id2] || [];
      order.push(list);
      for (i = 0; i < list.length; i++) total += list[i].size;
    }

    var out = new Uint8Array(ftyp.size + built.length + 8 + total);
    var at = 0;
    out.set(mp4Slice(bytes, ftyp), at); at += ftyp.size;
    out.set(built, at); at += built.length;
    out.set(mp4Num(8 + total), at);
    out[at + 4] = 109; out[at + 5] = 100; out[at + 6] = 97; out[at + 7] = 116;
    at += 8;

    for (m = 0; m < order.length; m++) {
      for (i = 0; i < order[m].length; i++) {
        var one = order[m][i];
        out.set(bytes.subarray(one.at, one.at + one.size), at);
        at += one.size;
      }
    }

    return out;
  }

  /* ---------- recording ---------- */

  var recBtn = document.getElementById("recBtn");
  var recLabel = document.getElementById("recLabel");
  var recInfo = document.getElementById("recInfo");
  var recSave = document.getElementById("recSave");

  var recorder = null;
  var arming = false;
  var chunks = [];
  var saveUrl = "";
  var drawing = 0;
  var painting = 0;

  /* Every take opens on its first frame and closes on its last, held this long,
     so there is something to cut against at both ends. */
  var HANDLE = 3;
  var phase = "";
  var phaseUntil = 0;
  var phaseTimer = 0;
  var voiceTracks = [];
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

  var FORMATS = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];

  function pickFormat() {
    for (var i = 0; i < FORMATS.length; i++) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(FORMATS[i])) return FORMATS[i];
    }
    return "";
  }

  /* Both tracks count. A line that is only ever mouthed still has to be given
     the time to be mouthed in, so an export driven by nothing but the lip sync
     track runs to the end of it. */
  function lastCueEnd() {
    var end = 0;
    for (var i = 0; i < cues.length; i++) if (cues[i].end > end) end = cues[i].end;
    for (i = 0; i < syncCues.length; i++) if (syncCues[i].end > end) end = syncCues[i].end;
    return end;
  }

  /* Nothing else knows how long the middle runs for, so it ends with the
     track, or with the last subtitle line when there is no track. */
  function runLength() {
    if (haveAudio()) return isFinite(audio.duration) ? audio.duration : 0;

    /* Without a track to follow, the subtitles say how long it runs. With one,
       it has to last at least until the final keyframe has had its moment. */
    var end = lastCueEnd();
    for (var i = 0; i < track.length; i++) end = Math.max(end, track[i].t);
    return end;
  }

  function startRun() {
    if (!recorder || phase !== "head") return;
    phase = "run";

    /* The button will not start one without a length, so there is always an
       end coming; what is worth saying is how long there is left of it. */
    var runs = runLength();
    recInfo.textContent = "exporting " + canvasW + " x " + canvasH +
      (voiceTracks.length ? " with audio" : "") +
      (runs ? ", " + Math.round(runs + HANDLE * 2) + "s in all" : "");

    setPlaying(true);
  }

  function enterTail() {
    if (phase === "tail" || !recorder) return;
    setPlaying(false);
    phase = "tail";
    phaseUntil = performance.now() + HANDLE * 1000;
    recInfo.textContent = "holding the last frame, press again to cut it short";
    if (phaseTimer) clearTimeout(phaseTimer);
    phaseTimer = setTimeout(stopRecording, HANDLE * 1000);
  }

  function step() {
    if (!recorder) return;
    buildCaption();
    buildNames();
    drawScene();

    var now = performance.now();

    if (phase === "head") {
      if (now >= phaseUntil) startRun();
      return;
    }

    if (phase === "run") {
      var len = runLength();
      if (len && elapsed >= len - 0.03) enterTail();
      return;
    }

    if (phase === "tail" && now >= phaseUntil) stopRecording();
  }

  function paintLoop() {
    if (!recorder) return;
    step();
    if (recorder) drawing = requestAnimationFrame(paintLoop);
  }

  /* The caption is drawn from a picture of itself, and that picture needs the
     stylesheet and the font to have arrived. Pressing Record the moment the
     page opens used to beat them to it and leave the captions out of the file
     entirely, so the take waits instead. */
  function captionReady(done) {
    var tries = 0;
    (function poll() {
      var wantCaption = subtitle.classList.contains("has-text");
      var wantNames = !!(nameLabels.a.textContent || nameLabels.b.textContent);
      var ready = (!wantCaption || captionArt) && (!wantNames || namesArt);
      if ((!wantCaption && !wantNames) || ready || tries > 25) { done(); return; }
      tries++;
      setTimeout(poll, 20);
    })();
  }

  /* An export plays the scene through and ends itself. What tells it how long
     that is, is the audio, the last subtitle line, or the captured track, and
     with none of them loaded there is nothing to play and nothing to end it,
     so it says so rather than starting a take that never finishes. */
  function startExport() {
    if (recorder || arming) return;

    if (!runLength()) {
      recInfo.textContent = "load audio or subtitles, or capture a track, first";
      return;
    }

    startRecording();
  }

  function startRecording() {
    if (recorder || arming) return;

    if (!window.MediaRecorder || !frame.captureStream) {
      recInfo.textContent = "this browser cannot record";
      return;
    }

    var format = pickFormat();
    if (!format) {
      recInfo.textContent = "this browser cannot record";
      return;
    }

    if (sheetText === null || fontData === null) {
      recInfo.textContent = "getting the caption ready";
      setTimeout(startRecording, 120);
      return;
    }

    /* A take plays the track back. Leaving capture armed would rewrite it from
       whatever happens during the take instead. */
    if (capturing) {
      capturing = false;
      capBtn.classList.remove("is-armed");
      capLabel.textContent = "Capture";
    }

    if (saveUrl) { URL.revokeObjectURL(saveUrl); saveUrl = ""; }
    recSave.hidden = true;
    chunks = [];

    resetClock();
    frame.width = canvasW;
    frame.height = canvasH;

    /* Put the opening line up before the first frame is taken. */
    renderCue(0);
    captionKey = "";
    namesKey = "";
    buildCaption();
    buildNames();

    /* Tapped here, while the click is still the reason anything is happening.
       Left until the timer below it, the browser sees no gesture behind it. */
    voiceTracks = audioTracks();

    arming = true;
    recBtn.classList.add("is-live");
    recLabel.textContent = "Stop";
    recInfo.textContent = "getting ready";
    captionReady(function () {
      arming = false;
      if (recorder) return;
      beginRecording(format);
    });
  }

  function beginRecording(format) {
    drawScene();

    var stream = frame.captureStream(30);
    for (var i = 0; i < voiceTracks.length; i++) stream.addTrack(voiceTracks[i]);

    /* A browser can say yes to a format and still refuse it once a real stream
       is attached, most often h264 on a machine without the encoder for it.
       Each one is tried for real, in order, until one actually starts. */
    var order = [format];
    for (var n = 0; n < FORMATS.length; n++) {
      if (FORMATS[n] !== format) order.push(FORMATS[n]);
    }

    var opened = null;
    for (var k = 0; k < order.length && !opened; k++) {
      if (!MediaRecorder.isTypeSupported(order[k])) continue;
      opened = openRecorder(stream, order[k]);
    }

    if (!opened) {
      recInfo.textContent = "this browser cannot record";
      recBtn.classList.remove("is-live");
      recLabel.textContent = "Export to video";
      return;
    }

    recorder = opened;
    painting = setInterval(step, 200);

    phase = "head";
    phaseUntil = performance.now() + HANDLE * 1000;
    recInfo.textContent = "holding the first frame";
    if (phaseTimer) clearTimeout(phaseTimer);
    phaseTimer = setTimeout(startRun, HANDLE * 1000);

    drawing = requestAnimationFrame(paintLoop);
  }

  var recFormat = "";
  var lastFinished = null;

  function openRecorder(stream, mime) {
    var rec;
    try {
      rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12000000 });
    } catch (err) {
      return null;
    }

    rec.ondataavailable = function (e) {
      if (e.data && e.data.size) chunks.push(e.data);
    };

    rec.onstop = function () { finishRecording(rec); };

    /* A take that dies part way used to leave the button on Stop and the
       note on "saving" with nothing behind it. Say what happened and keep
       whatever was written before it went. */
    rec.onerror = function (e) {
      var why = (e && e.error && e.error.name) || "the encoder gave up";
      recInfo.textContent = "recording stopped: " + why;
      stopRecording();
    };

    try {
      /* Data lands every half second rather than all at the end, so a take
         that is cut short still leaves most of itself behind. */
      rec.start(500);
    } catch (err) {
      return null;
    }

    recFormat = mime;
    return rec;
  }

  function finishRecording(rec) {
    if (lastFinished === rec) return;
    lastFinished = rec;

    var kind = recFormat.indexOf("mp4") !== -1 ? "mp4" : "webm";
    var blob = new Blob(chunks, { type: recFormat.split(";")[0] });

    if (!blob.size) {
      recInfo.textContent = "nothing was recorded";
      recSave.hidden = true;
      return;
    }

    if (kind !== "mp4") {
      offerFile(blob, kind, "");
      return;
    }

    recInfo.textContent = "tidying the file";
    blob.arrayBuffer().then(function (raw) {
      var tidy = null;
      try {
        tidy = toProgressiveMp4(new Uint8Array(raw));
      } catch (err) {
        tidy = null;
      }

      if (tidy) offerFile(new Blob([tidy], { type: "video/mp4" }), "mp4", "");
      else offerFile(blob, "mp4", ", as written by the browser");
    }, function () {
      offerFile(blob, "mp4", "");
    });
  }

  function offerFile(blob, kind, note) {
    saveUrl = URL.createObjectURL(blob);
    recSave.href = saveUrl;
    recSave.download = "character." + kind;
    recSave.hidden = false;
    recInfo.textContent = kind + ", " + (blob.size / 1048576).toFixed(1) + " MB" + note;

    /* Straight to the downloads folder, since that is the point of the take.
       A browser set to refuse a download it did not see asked for will ignore
       this, which is what the button underneath is still there for. */
    try {
      recSave.click();
    } catch (err) {}
  }

  function stopRecording() {
    if (arming && !recorder) {
      arming = false;
      recBtn.classList.remove("is-live");
      recLabel.textContent = "Export to video";
      recInfo.textContent = "ready";
      setPlaying(false);
      return;
    }
    if (!recorder) return;

    var rec = recorder;
    recorder = null;
    phase = "";
    if (phaseTimer) { clearTimeout(phaseTimer); phaseTimer = 0; }
    if (drawing) { cancelAnimationFrame(drawing); drawing = 0; }
    if (painting) { clearInterval(painting); painting = 0; }
    setPlaying(false);
    recInfo.textContent = "saving";
    recBtn.classList.remove("is-live");
    recLabel.textContent = "Export to video";

    /* A recorder that has already given up is inactive, and stop() on one of
       those throws instead of firing onstop. Either way, finish from whatever
       it managed to write. */
    if (rec.state === "inactive") {
      finishRecording(rec);
      return;
    }

    try {
      rec.stop();
    } catch (err) {
      finishRecording(rec);
    }
  }

  recBtn.addEventListener("click", function () {
    /* One button, and while an export is running it is the way to abandon it.
       Cutting the middle short still earns the closing handle, so a file that
       was stopped by hand ends the same way as one that ran out. */
    if (recorder && phase === "run") enterTail();
    else if (recorder) stopRecording();
    else startExport();
    recBtn.blur();
  });

  audio.addEventListener("ended", function () {
    if (recorder && phase === "run") enterTail();
  });

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
