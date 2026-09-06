import type { CreateControlsOptions } from '../controls';

/**
 * Headless test helpers — a stubbed canvas and injectable event host that let
 * the engine modules boot and exercise navigation without a real WebGL/browser
 * environment.
 */

export interface CanvasStub {
  style: { touchAction: string };
  addEventListener(kind: string, fn: EventListener, opts?: unknown): void;
  removeEventListener(kind: string, fn: EventListener, opts?: unknown): void;
  getRootNode(): {
    addEventListener(kind: string, fn: EventListener, opts?: unknown): void;
    removeEventListener(kind: string, fn: EventListener, opts?: unknown): void;
  };
  requestPointerLock?(): void;
  dispatchEvent(evt: Event): boolean;
  /** Listener maps for dispose assertions. */
  listeners(): { canvas: Map<string, EventListener[]>; root: Map<string, EventListener[]> };
}

/**
 * Create a stub canvas that records its own listeners (for dispose assertions)
 * and its root node's listeners (for OrbitControls' document-level keydown).
 */
export function createCanvasStub(): CanvasStub {
  const canvasListeners = new Map<string, EventListener[]>();
  const rootListeners = new Map<string, EventListener[]>();

  const make = (store: Map<string, EventListener[]>): ((kind: string, fn: EventListener) => void) => {
    return (kind, fn) => {
      const list = store.get(kind) ?? [];
      list.push(fn);
      store.set(kind, list);
    };
  };
  const remove = (store: Map<string, EventListener[]>): ((kind: string, fn: EventListener) => void) => {
    return (kind, fn) => {
      const list = store.get(kind) ?? [];
      store.set(
        kind,
        list.filter((h) => h !== fn),
      );
    };
  };

  const canvasAdd = make(canvasListeners);
  const canvasRemove = remove(canvasListeners);
  const rootAdd = make(rootListeners);
  const rootRemove = remove(rootListeners);

  return {
    style: { touchAction: 'auto' },
    addEventListener: canvasAdd,
    removeEventListener: canvasRemove,
    getRootNode: () => ({ addEventListener: rootAdd, removeEventListener: rootRemove }),
    requestPointerLock: () => undefined,
    dispatchEvent: () => true,
    listeners: () => ({ canvas: canvasListeners, root: rootListeners }),
  };
}

/** Minimal event-capable window used by the controls when no browser exists. */
export interface TestWindow {
  addEventListener(kind: string, fn: EventListener): void;
  removeEventListener(kind: string, fn: EventListener): void;
  /** Fire a key event at the registered listeners. */
  dispatchKey(code: string, type: 'keydown' | 'keyup'): void;
}

/** Minimal document used by the controls for pointer-lock state. */
export interface TestDocument {
  pointerLockElement: unknown;
  exitPointerLock?(): void;
}

/** Build an injectable window/document pair for headless `createControls`. */
export function createTestHost(pointerLocked = false): {
  window: TestWindow;
  document: TestDocument;
  options: CreateControlsOptions['host'];
  setPointerLock(locked: boolean): void;
} {
  const listeners = new Map<string, EventListener[]>();
  const window: TestWindow = {
    addEventListener(kind, fn) {
      const list = listeners.get(kind) ?? [];
      list.push(fn);
      listeners.set(kind, list);
    },
    removeEventListener(kind, fn) {
      const list = listeners.get(kind) ?? [];
      listeners.set(
        kind,
        list.filter((h) => h !== fn),
      );
    },
    dispatchKey(code, type) {
      const evt = { code } as KeyboardEvent;
      for (const fn of listeners.get(type) ?? []) fn(evt);
    },
  };
  const document: TestDocument = { pointerLockElement: pointerLocked ? {} : null };
  return {
    window,
    document,
    options: { window: window as never, document: document as never },
    setPointerLock(locked) {
      document.pointerLockElement = locked ? {} : null;
    },
  };
}

/** Fire a pointer-move at the canvas stub with an eye-ray movement. */
export function firePointer(canvas: CanvasStub, x: number, y: number, locked = true): void {
  const evt = {
    movementX: x,
    movementY: y,
    pointerLockElement: locked ? {} : null,
  } as unknown as PointerEvent;
  for (const fn of canvas.listeners().canvas.get('pointermove') ?? []) {
    fn(evt);
  }
}