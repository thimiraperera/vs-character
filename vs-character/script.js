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
  var castShadow = document.getElementById("castShadow");
  var pad = document.querySelector(".pad");
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

  /* The pad button currently held down with Space or Enter, if any. Only one
     element can hold focus, so there is never more than one. */
  var keyButton = null;

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
    keyButton = null;
    settle();
    var down = pad.querySelectorAll(".key.is-down");
    for (var i = 0; i < down.length; i++) down[i].classList.remove("is-down");
  }

  /* ---------- keyboard ---------- */

  window.addEventListener("keydown", function (e) {
    var pose = KEY_POSES[e.key];
    if (!pose) return;

    /* Arrows would otherwise scroll the canvas inside its holder. */
    e.preventDefault();

    /* Auto-repeat fires keydown over and over while the key stays down. */
    if (e.repeat) return;

    press("key:" + e.key, pose);

    var button = pad.querySelector('.key[data-pose="' + pose + '"]');
    if (button) button.classList.add("is-down");
  });

  window.addEventListener("keyup", function (e) {
    var pose = KEY_POSES[e.key];
    if (!pose) return;
    e.preventDefault();
    release("key:" + e.key);

    var button = pad.querySelector('.key[data-pose="' + pose + '"]');
    if (button) button.classList.remove("is-down");
  });

  /* A key held while the tab or window loses focus never delivers its keyup,
     which would leave the pose stuck. */
  window.addEventListener("blur", releaseAll);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) releaseAll();
  });

  /* ---------- on-screen pad ---------- */

  pad.addEventListener("pointerdown", function (e) {
    var button = e.target.closest(".key");
    if (!button) return;

    /* A right or middle press should open nothing and pose nothing. */
    if (e.button !== 0 || e.isPrimary === false) return;
    e.preventDefault();

    if (button.setPointerCapture) {
      try { button.setPointerCapture(e.pointerId); } catch (err) {}
    }
    button.classList.add("is-down");
    press("pointer:" + e.pointerId, button.dataset.pose);
  });

  function liftPointer(e) {
    var button = e.target.closest ? e.target.closest(".key") : null;
    if (button) button.classList.remove("is-down");
    release("pointer:" + e.pointerId);
  }

  pad.addEventListener("pointerup", liftPointer);
  pad.addEventListener("pointercancel", liftPointer);

  /* Safety net for the release that never reaches the pad: capture can be
     refused, and a pointer can lift outside the button it started on. */
  window.addEventListener("pointerup", function (e) {
    release("pointer:" + e.pointerId);
  });
  window.addEventListener("pointercancel", function (e) {
    release("pointer:" + e.pointerId);
  });

  pad.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  pad.addEventListener("click", function (e) { e.preventDefault(); });

  pad.addEventListener("keydown", function (e) {
    var button = e.target.closest(".key");
    if (!button || (e.key !== " " && e.key !== "Enter") || e.repeat) return;
    e.preventDefault();
    if (keyButton) keyButton.classList.remove("is-down");
    keyButton = button;
    button.classList.add("is-down");
    press("btn", button.dataset.pose);
  });

  /* Watched on the window, and matched to the button that started the hold:
     the key can be let go after focus has already moved elsewhere, and that
     keyup would never reach the pad. */
  window.addEventListener("keyup", function (e) {
    if (!keyButton || (e.key !== " " && e.key !== "Enter")) return;
    keyButton.classList.remove("is-down");
    keyButton = null;
    release("btn");
  });

  pad.addEventListener("focusout", function () {
    if (!keyButton) return;
    keyButton.classList.remove("is-down");
    keyButton = null;
    release("btn");
  });

  /* ---------- canvas size and viewing scale ---------- */

  var canvasW = 1080;
  var canvasH = 1920;

  function applyScale() {
    var mode = zoom.value;
    var k;

    stageArea.classList.toggle("is-zoomed", mode !== "fit");

    if (mode === "fit") {
      k = Math.min(stageArea.clientWidth / canvasW, stageArea.clientHeight / canvasH);
      if (!(k > 0)) k = 0.1;
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

  resolution.addEventListener("change", applyResolution);
  zoom.addEventListener("change", applyScale);
  window.addEventListener("resize", applyScale);

  applyResolution();

  /* ---------- image slots ---------- */

  /* Uploads live in sessionStorage, so they survive a reload while the tab is
     open and are gone once it closes. Large photos are resized first: a raw
     phone picture would blow the storage quota on its own. */
  var STORE_LIMIT = 1400;
  var memory = {};

  function cacheKey(name) { return "slot:" + name; }

  function readCache(name) {
    if (memory[name]) return memory[name];
    try {
      return sessionStorage.getItem(cacheKey(name));
    } catch (err) {
      return null;
    }
  }

  function writeCache(name, url) {
    memory[name] = url;
    try {
      sessionStorage.setItem(cacheKey(name), url);
    } catch (err) {
      /* Quota is full or storage is blocked; the in-memory copy still shows. */
    }
  }

  function dropCache(name) {
    delete memory[name];
    try {
      sessionStorage.removeItem(cacheKey(name));
    } catch (err) {}
  }

  function shrink(file, done) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth;
        var h = img.naturalHeight;
        var scale = Math.min(1, STORE_LIMIT / Math.max(w, h));
        var canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        try {
          done(canvas.toDataURL("image/jpeg", 0.9));
        } catch (err) {
          done(reader.result);
        }
      };
      img.onerror = function () { done(null); };
      img.src = reader.result;
    };
    reader.onerror = function () { done(null); };
    reader.readAsDataURL(file);
  }

  function fillSlot(slot, url) {
    var img = slot.querySelector(".slot-img");
    if (!url) {
      img.removeAttribute("src");
      slot.classList.remove("is-filled");
      return;
    }
    img.src = url;
    slot.classList.add("is-filled");
  }

  function takeFile(slot, file) {
    if (!file || file.type.indexOf("image/") !== 0) return;
    shrink(file, function (url) {
      if (!url) return;
      writeCache(slot.dataset.slot, url);
      fillSlot(slot, url);
    });
  }

  var slots = document.querySelectorAll(".slot");
  for (var s = 0; s < slots.length; s++) {
    (function (slot) {
      var input = slot.querySelector(".slot-file");
      var clear = slot.querySelector(".slot-clear");

      fillSlot(slot, readCache(slot.dataset.slot));

      slot.addEventListener("click", function (e) {
        if (e.target.closest(".slot-clear")) return;
        input.click();
      });

      input.addEventListener("change", function () {
        if (input.files && input.files[0]) takeFile(slot, input.files[0]);
        input.value = "";
      });

      clear.addEventListener("click", function (e) {
        e.stopPropagation();
        dropCache(slot.dataset.slot);
        fillSlot(slot, null);
      });

      slot.addEventListener("dragover", function (e) {
        e.preventDefault();
        slot.classList.add("is-over");
      });

      slot.addEventListener("dragleave", function () {
        slot.classList.remove("is-over");
      });

      slot.addEventListener("drop", function (e) {
        e.preventDefault();
        slot.classList.remove("is-over");
        if (e.dataTransfer && e.dataTransfer.files[0]) takeFile(slot, e.dataTransfer.files[0]);
      });
    })(slots[s]);
  }

  /* ---------- warm the artwork ---------- */

  /* Decode every pose up front so the first press swaps instantly instead of
     flashing an empty frame while the file is still being read. */
  for (var pose in poses) {
    if (!Object.prototype.hasOwnProperty.call(poses, pose)) continue;
    var art = poses[pose];
    if (art.decode) art.decode().catch(function () {});
  }
})();
