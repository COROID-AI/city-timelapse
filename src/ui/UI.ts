import type { EraIndex } from "../types";
import { ERA_YEARS, type EraYear } from "../types";
import { ERAS } from "../config/eras";

/**
 * Creates and owns all DOM UI: timeline, toolbar (mute/reset), HUD, start
 * overlay, and unsupported-browser fallback. Exposes typed event callbacks.
 */
export interface UICallbacks {
  onEraSelect: (era: EraIndex) => void;
  onResetCamera: () => void;
  onToggleMute: () => boolean;
  onStart: () => void;
  onHover: (title: string | null, body: string | null) => void;
}

export class UI {
  private readonly callbacks: UICallbacks;
  private readonly eraButtons: HTMLButtonElement[] = [];
  private readonly fillEl: HTMLElement;
  private readonly eraLabel: HTMLElement;
  private readonly hudEl: HTMLElement;
  private readonly hudLabel: HTMLElement;
  private readonly hudTitle: HTMLElement;
  private readonly hudBody: HTMLElement;
  private readonly overlayEl: HTMLElement;
  private readonly startBtn: HTMLButtonElement;
  private readonly muteBtn: HTMLButtonElement;
  private readonly resetBtn: HTMLButtonElement;

  constructor(container: HTMLElement, callbacks: UICallbacks) {
    this.callbacks = callbacks;

    // --- Timeline ---
    const tl = el("div", { class: "timeline" });
    const head = el("div", { class: "timeline__head" });
    const title = el("div", { class: "timeline__title" }, "City Era · 1945–2055");
    this.eraLabel = el("div", { class: "timeline__era" });
    head.append(title, this.eraLabel);

    const track = el("div", { class: "timeline__track" });
    const rail = el("div", { class: "timeline__rail" });
    this.fillEl = el("div", { class: "timeline__fill" });
    rail.append(this.fillEl);
    const btnRow = el("div", { class: "timeline__buttons" });

    ERA_YEARS.forEach((year, i) => {
      const btn = el("button", {
        class: "era-btn",
        type: "button",
        "data-era": String(i),
        "aria-label": `Select year ${year}`,
        "aria-current": "false",
      }) as HTMLButtonElement;
      const dot = el("div", { class: "era-btn__dot" });
      const yr = el("span", { class: "era-btn__year" }, String(year));
      btn.append(dot, yr);
      btn.addEventListener("click", () => {
        this.callbacks.onEraSelect(i as EraIndex);
      });
      this.eraButtons.push(btn);
      btnRow.append(btn);
    });

    track.append(rail, btnRow);
    tl.append(head, track);

    // --- Toolbar ---
    const toolbar = el("div", { class: "toolbar" });
    this.resetBtn = el("button", {
      class: "icon-btn",
      type: "button",
      "aria-label": "Reset camera view",
      title: "Reset camera (R)",
    }) as HTMLButtonElement;
    this.resetBtn.innerHTML =
      '<span class="glyph">⟲</span><span>Reset</span>';
    this.resetBtn.addEventListener("click", () =>
      this.callbacks.onResetCamera()
    );

    this.muteBtn = el("button", {
      class: "icon-btn",
      type: "button",
      "aria-label": "Toggle sound",
      "aria-pressed": "false",
      title: "Mute / unmute (M)",
    }) as HTMLButtonElement;
    this.muteBtn.innerHTML =
      '<span class="glyph on">🔇</span><span class="glyph off">🔊</span><span class="mute-label">Sound</span>';
    this.muteBtn.addEventListener("click", () => {
      const muted = this.callbacks.onToggleMute();
      this.muteBtn.setAttribute("aria-pressed", String(muted));
    });

    toolbar.append(this.resetBtn, this.muteBtn);

    // --- HUD ---
    this.hudEl = el("div", { class: "hud", role: "status", "aria-live": "polite" });
    this.hudLabel = el("div", { class: "hud__label" });
    this.hudTitle = el("div", { class: "hud__title" });
    this.hudBody = el("div", { class: "hud__body" });
    this.hudEl.append(this.hudLabel, this.hudTitle, this.hudBody);

    // --- Legend ---
    const legend = el("div", { class: "legend" });
    legend.innerHTML = `
      <h4>Controls</h4>
      <div><kbd>Drag</kbd> orbit · <kbd>Right-drag</kbd> pan</div>
      <div><kbd>Scroll</kbd> zoom · <kbd>±</kbd> dolly</div>
      <div><kbd>←</kbd> <kbd>→</kbd> pan · <kbd>R</kbd> reset</div>
      <div><kbd>M</kbd> mute · Hover to inspect</div>
    `;

    // --- Start overlay ---
    this.overlayEl = el("div", { class: "overlay" });
    const card = el("div", { class: "card" });
    card.innerHTML = `
      <div class="card__eyebrow">1945 — 2055</div>
      <h1 class="card__title">City Era Timelapse</h1>
      <p class="card__lede">
        Travel through a century of a single city block. Select a year to watch
        its buildings, traffic, signage, and light transform. Orbit, zoom, and
        hover anything to learn what you're seeing.
      </p>
    `;
    this.startBtn = el("button", { class: "start-btn", type: "button" }) as HTMLButtonElement;
    this.startBtn.innerHTML = '<span class="glyph">▶</span><span>Enter the Block</span>';
    this.startBtn.addEventListener("click", () => {
      this.callbacks.onStart();
    });
    const hint = el("div", { class: "card__hint" });
    hint.textContent = "Sound is enabled on entry · WebGL2 required";
    card.append(this.startBtn, hint);
    this.overlayEl.append(card);

    container.append(tl, toolbar, this.hudEl, legend, this.overlayEl);
    this.setEra(2, true);
  }

  /** Update the timeline UI to reflect a selected/in-flight era. */
  setEra(era: EraIndex, immediate = false): void {
    const cfg = ERAS[era];
    this.eraButtons.forEach((btn, i) => {
      btn.setAttribute("aria-current", i === era ? "true" : "false");
    });
    // Fill width: proportion of the way along the timeline.
    const pct = (era / (ERA_YEARS.length - 1)) * 100;
    this.fillEl.style.transition = immediate
      ? "none"
      : "width 0.12s linear";
    this.fillEl.style.width = `${pct}%`;

    this.eraLabel.innerHTML = `<b>${cfg.year}</b> · ${cfg.name}`;
  }

  /** Show hover info in the HUD. */
  showHover(title: string | null, body: string | null): void {
    if (title === null) {
      this.hudEl.classList.remove("is-visible");
      return;
    }
    this.hudLabel.textContent = "Inspecting";
    this.hudTitle.textContent = title;
    this.hudBody.textContent = body ?? "";
    this.hudEl.classList.add("is-visible");
  }

  /** Hide the start overlay. */
  hideOverlay(): void {
    this.overlayEl.classList.add("is-hidden");
    // Remove from tab order after fade.
    window.setTimeout(() => {
      this.overlayEl.style.display = "none";
    }, 600);
  }

  setMuteState(muted: boolean): void {
    this.muteBtn.setAttribute("aria-pressed", String(muted));
  }

  isOverlayVisible(): boolean {
    return !this.overlayEl.classList.contains("is-hidden");
  }
}

/** Render the unsupported-browser fallback DOM. */
export function renderUnsupportedFallback(container: HTMLElement): void {
  container.innerHTML = "";
  const fb = el("div", { class: "fallback" });
  fb.innerHTML = `
    <div class="fallback__card">
      <div class="fallback__icon">🚫</div>
      <h2 class="fallback__title">WebGL2 is not available</h2>
      <p class="fallback__body">
        This 3D experience requires a browser with WebGL2 support.
        Please update your browser or graphics drivers and reload this page.
      </p>
      <p class="fallback__code">
        Try the latest Chrome, Edge, Firefox, or Safari.
      </p>
    </div>
  `;
  container.append(fb);
}

// --- Tiny DOM helper ---
type Attrs = Record<string, string>;

function el(
  tag: string,
  attrs?: Attrs,
  text?: string
): HTMLElement {
  const e = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") e.className = v;
      else e.setAttribute(k, v);
    }
  }
  if (text !== undefined) e.textContent = text;
  return e;
}

export { ERA_YEARS, type EraYear };
