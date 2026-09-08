import * as React from 'react';
import { create, act } from 'react-test-renderer';

import { TimelineSlider } from '../src/components/TimelineSlider';
import { useEraStore, ERA_YEARS } from '../src/state/eraStore';

type Renderer = ReturnType<typeof create>;

/** Render the slider against a fresh store and return the renderer + store. */
function renderSlider(initialYear?: number) {
  const store = useEraStore(initialYear);
  let renderer: Renderer | undefined;
  act(() => {
    renderer = create(React.createElement(TimelineSlider, { store }));
  });
  if (renderer === undefined) {
    throw new Error('renderer was not created');
  }
  return { store, renderer };
}

/** The JSON tree of the rendered slider (avoids circular refs). */
function tree(renderer: Renderer) {
  return renderer.toJSON() as {
    type: string;
    props: Record<string, unknown>;
    children?: Array<{
      type: string;
      props?: Record<string, unknown>;
      children?: Array<string | Record<string, unknown>>;
    }>;
  };
}

/** The root (role=slider) node's props. */
function sliderProps(renderer: Renderer): Record<string, unknown> {
  return tree(renderer).props;
}

/** The rendered year-label texts, in order. */
function labelTexts(renderer: Renderer): string[] {
  const node = tree(renderer);
  const spans = (node.children ?? []).filter(
    (c) => c.type === 'span' && Array.isArray(c.children),
  );
  return spans
    .map((s) => String(s.children![0]))
    .filter((t) => /^\d{4}$/.test(t));
}

/** Fire a keydown event on the slider root. */
function pressKey(renderer: Renderer, key: string) {
  const props = sliderProps(renderer);
  const onKeyDown = props['onKeyDown'] as (e: { key: string; preventDefault(): void }) => void;
  act(() => onKeyDown({ key, preventDefault() {} }));
}

describe('era store', () => {
  it('derives the year list from the era registry read-only', () => {
    expect(ERA_YEARS).toEqual([1945, 1965, 1985, 2005, 2025]);
  });

  it('holds a current year and a tweened 0..1 progress value', () => {
    const store = useEraStore(1945);
    expect(store.current.year).toBe(1945);
    expect(store.current.progress).toBe(0);

    store.advance(0.4);
    expect(store.current.progress).toBeCloseTo(0.4);

    store.advance(0.9);
    expect(store.current.progress).toBeCloseTo(1);

    store.select(1985);
    expect(store.current.year).toBe(1985);
    expect(store.current.progress).toBe(0);
  });

  it('pins progress to 1 for the final era', () => {
    const store = useEraStore(2025);
    store.advance(0.5);
    expect(store.current.progress).toBe(1);
  });

  it('rejects unknown years', () => {
    const store = useEraStore();
    expect(() => store.select(2055)).toThrow(/Unknown era year 2055/);
  });
});

describe('timeline slider', () => {
  it('renders exactly the five era options at the top', () => {
    const { renderer } = renderSlider();
    expect(labelTexts(renderer)).toEqual(['1945', '1965', '1985', '2005', '2025']);
  });

  it('exposes an accessible slider role with era-reflective labels', () => {
    const { renderer } = renderSlider(1985);
    const props = sliderProps(renderer);
    expect(props['role']).toBe('slider');
    expect(props['aria-label']).toBe('Timeline era');
    expect(props['aria-valuemin']).toBe(0);
    expect(props['aria-valuemax']).toBe(4);
    expect(props['aria-valuenow']).toBe(2); // 1985 is the third of five eras
    expect(props['aria-valuetext']).toBe('1985');
    expect(props['tabIndex']).toBe(0);
  });

  it('moves the selection with arrow keys', () => {
    const { store, renderer } = renderSlider(1945);

    pressKey(renderer, 'ArrowRight');
    expect(store.current.year).toBe(1965);

    pressKey(renderer, 'ArrowRight');
    expect(store.current.year).toBe(1985);

    pressKey(renderer, 'ArrowLeft');
    expect(store.current.year).toBe(1965);

    pressKey(renderer, 'End');
    expect(store.current.year).toBe(2025);

    pressKey(renderer, 'Home');
    expect(store.current.year).toBe(1945);
  });
});