(() => {
  if (window.__BT_MENU_MOUNTED__) return;
  window.__BT_MENU_MOUNTED__ = true;

  const config = {
    enabled: true,
    speedMultiplier: null,
    staminaDrain: 0,
    stamina: 100,
    forceGallop: false,
    speedNow: 8,
    fly: false,
    flyHeight: 8,
    noclip: false
  };
  let hooksReady = false;
  let horseConnected = false;
  let updateStatus = () => {};

  const publish = () => window.postMessage({
    source: "bt-trail-kit-extension",
    type: "config",
    config: { ...config }
  }, location.origin);

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (message?.source !== "bt-trail-kit-page" || message.type !== "status") return;
    hooksReady = Boolean(message.hooksReady);
    horseConnected = Boolean(message.connected);
    updateStatus();
  });

  const mount = async () => {
    if (!document.body || document.getElementById("bt-mod-root")) return;
    const state = await chrome.runtime.sendMessage({ type: "bt-content-state" }).catch(() => null);
    if (!state?.enabled || !document.body || document.getElementById("bt-mod-root")) return;
    const asset = (path) => chrome.runtime.getURL(path);

    const root = document.createElement("div");
    root.id = "bt-mod-root";
    root.setAttribute("aria-label", "Horse controls");
    root.innerHTML = `
      <section id="bt-mod-panel" aria-label="Trail kit controls">
        <header id="bt-mod-head">
          <div class="bt-brand">
            <img class="bt-brand-mark" src="${asset("assets/brand-mark.svg")}" alt="" aria-hidden="true">
            <div class="bt-brand-copy">
              <div id="bt-mod-title">Bagan-Trail</div>
              <div class="bt-brand-sub">ON STEROIDS</div>
              <div class="bt-brand-byline">Made with love by Aether</div>
              <div class="bt-status-line"><span id="bt-mod-dot"></span><span id="bt-mod-status" role="status" aria-live="polite">Activating hook</span></div>
            </div>
          </div>
          <button id="bt-mod-collapse" type="button" aria-expanded="true" aria-label="Collapse controls"><img class="bt-chevron" src="${asset("assets/icons/chevron.svg")}" alt="" aria-hidden="true"><span>Hide</span></button>
        </header>
        <div id="bt-mod-content">
          <div class="bt-control">
            <label class="bt-label" for="bt-speed"><span class="bt-label-title"><img class="bt-icon" src="${asset("assets/icons/speed.svg")}" alt="" aria-hidden="true">Target speed</span><output id="bt-speed-value" class="bt-value"></output></label>
            <input id="bt-speed" class="bt-range" type="range" min="0" max="100" step="1">
            <p class="bt-hint">Set to 0 for normal game pace.</p>
          </div>
          <div class="bt-toggles">
            <label class="bt-toggle"><input id="bt-gallop" type="checkbox"><img class="bt-icon" src="${asset("assets/icons/gallop.svg")}" alt="" aria-hidden="true"><span>Gallop</span></label>
            <label class="bt-toggle"><input id="bt-stamina" type="checkbox"><img class="bt-icon" src="${asset("assets/icons/stamina.svg")}" alt="" aria-hidden="true"><span>Full stamina</span></label>
            <label class="bt-toggle"><input id="bt-fly" type="checkbox"><img class="bt-icon" src="${asset("assets/icons/flight.svg")}" alt="" aria-hidden="true"><span>Fly</span></label>
            <label class="bt-toggle"><input id="bt-noclip" type="checkbox"><img class="bt-icon" src="${asset("assets/icons/wall-pass.svg")}" alt="" aria-hidden="true"><span>Pass walls</span></label>
          </div>
          <p class="bt-hint">Pass walls works while mounted; it can put you inside scenery.</p>
          <div id="bt-flight-level" class="bt-control" hidden>
            <label class="bt-label" for="bt-height"><span>Flight height</span><output id="bt-height-value" class="bt-value"></output></label>
            <input id="bt-height" class="bt-range" type="range" min="2" max="100" step="1">
          </div>
          <button id="bt-stop" type="button"><img class="bt-icon" src="${asset("assets/icons/stop.svg")}" alt="" aria-hidden="true"><span>Stop boost and land</span></button>
          <p class="bt-hint"><img class="bt-drag-icon" src="${asset("assets/icons/drag.svg")}" alt="" aria-hidden="true"> Drag the header to move · Alt+M hides or shows.</p>
        </div>
      </section>`;
    document.body.appendChild(root);

    const $ = (id) => root.querySelector(`#${id}`);
    const speed = $("bt-speed");
    const speedValue = $("bt-speed-value");
    const gallop = $("bt-gallop");
    const stamina = $("bt-stamina");
    const fly = $("bt-fly");
    const noClip = $("bt-noclip");
    const height = $("bt-height");
    const heightValue = $("bt-height-value");
    const flightLevel = $("bt-flight-level");
    const header = $("bt-mod-head");
    const formatSpeed = (value) => value === 0 ? "Game pace" : `${value} m/s · ${Math.round(value * 3.6)} km/h`;
    const sync = () => {
      speed.value = String(config.speedNow || 0);
      speedValue.textContent = formatSpeed(Number(speed.value));
      gallop.checked = Boolean(config.forceGallop);
      stamina.checked = config.staminaDrain === 0;
      fly.checked = Boolean(config.fly);
      noClip.checked = Boolean(config.noclip);
      height.value = String(config.flyHeight || 8);
      heightValue.textContent = `${height.value} m`;
      flightLevel.hidden = !fly.checked;
    };

    let drag = null;
    header.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest?.("button")) return;
      const rect = root.getBoundingClientRect();
      drag = { pointerId: event.pointerId, x: event.clientX - rect.left, y: event.clientY - rect.top };
      root.dataset.dragging = "true";
      try { header.setPointerCapture(event.pointerId); } catch {}
      event.preventDefault();
    });
    header.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      root.style.left = `${Math.min(Math.max(0, event.clientX - drag.x), Math.max(0, innerWidth - root.offsetWidth))}px`;
      root.style.right = "auto";
      root.style.top = `${Math.min(Math.max(0, event.clientY - drag.y), Math.max(0, innerHeight - root.offsetHeight))}px`;
    });
    const stopDragging = (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      drag = null;
      root.dataset.dragging = "false";
    };
    header.addEventListener("pointerup", stopDragging);
    header.addEventListener("pointercancel", stopDragging);

    speed.addEventListener("input", () => {
      config.speedNow = Number(speed.value);
      config.speedMultiplier = null;
      speedValue.textContent = formatSpeed(config.speedNow);
      publish();
    });
    gallop.addEventListener("change", () => { config.forceGallop = gallop.checked; publish(); });
    stamina.addEventListener("change", () => {
      config.staminaDrain = stamina.checked ? 0 : null;
      config.stamina = stamina.checked ? 100 : null;
      publish();
    });
    fly.addEventListener("change", () => {
      config.fly = fly.checked;
      flightLevel.hidden = !fly.checked;
      publish();
    });
    noClip.addEventListener("change", () => { config.noclip = noClip.checked; publish(); });
    height.addEventListener("input", () => {
      config.flyHeight = Number(height.value);
      heightValue.textContent = `${height.value} m`;
      publish();
    });
    $("bt-stop").addEventListener("click", () => {
      config.speedNow = 0;
      config.speedMultiplier = null;
      config.forceGallop = false;
      config.fly = false;
      config.noclip = false;
      sync();
      publish();
      window.postMessage({ source: "bt-trail-kit-extension", type: "stop" }, location.origin);
    });
    $("bt-mod-collapse").addEventListener("click", (event) => {
      const collapsed = root.dataset.collapsed !== "true";
      root.dataset.collapsed = String(collapsed);
      event.currentTarget.querySelector("span").textContent = collapsed ? "Show" : "Hide";
      event.currentTarget.setAttribute("aria-expanded", String(!collapsed));
      event.currentTarget.setAttribute("aria-label", collapsed ? "Expand controls" : "Collapse controls");
    });
    window.addEventListener("keydown", (event) => {
      if (event.altKey && event.key.toLowerCase() === "m") {
        event.preventDefault();
        $("bt-mod-collapse").click();
      }
    });

    updateStatus = () => {
      const status = $("bt-mod-status");
      const dot = $("bt-mod-dot");
      const ready = hooksReady;
      dot.dataset.ready = String(ready && horseConnected);
      if (!ready) status.textContent = "Hook not ready · reload the game";
      else if (horseConnected) status.textContent = "Horse connected";
      else status.textContent = document.querySelector(".intro-begin") ? "Press Start, then enter a ride" : "Choose a horse and start riding";
    };

    sync();
    publish();
    updateStatus();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void mount(), { once: true });
  else void mount();
})();
