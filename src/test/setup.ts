import "@testing-library/jest-dom/vitest";

// jsdom does not implement matchMedia; provide a neutral stub so UI hooks that
// query prefers-reduced-motion do not blow up in unit tests.
if (typeof window !== "undefined" && !window.matchMedia) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// jsdom lacks IntersectionObserver / ResizeObserver used transitively by drei.
if (typeof window !== "undefined") {
  class IO {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    root = null as any;
    rootMargin = "";
    thresholds = [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).IntersectionObserver = (window as any).IntersectionObserver || IO;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).ResizeObserver = (window as any).ResizeObserver || IO;
}
