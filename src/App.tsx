import { TimelineSlider } from './components/TimelineSlider';

/**
 * Application shell. The 3D scene (owned by the composition root later) will be
 * mounted beneath the top timeline slider. The slider sits at the top of the
 * viewport and drives the shared era timeline store.
 */
export function App() {
  return (
    <div className="app">
      <TimelineSlider />
      <main className="scene-host" aria-label="3D city scene">
        {/* Scene composition root mounts here in a later phase. */}
      </main>
    </div>
  );
}