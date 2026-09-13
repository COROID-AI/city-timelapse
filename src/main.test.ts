import { describe, expect, it } from 'vitest';

const APP_TITLE = 'City Time Period Timelapse';
const APP_STUB_MARKER = 'app-stub';

describe('entry stub (src/main.ts)', () => {
  it('importing the module populates #app with the title and stub marker', async () => {
    // Recreate the browser DOM contract (index.html provides #app) before the
    // module bootstrap runs.
    const app = document.createElement('div');
    app.id = 'app';
    document.body.append(app);

    await import('./main');

    const stub = app.querySelector(`[data-app-stub="${APP_STUB_MARKER}"]`);
    expect(stub).not.toBeNull();
    expect(stub?.querySelector('h1')?.textContent).toBe(APP_TITLE);
    expect(stub?.querySelector('p')?.textContent).toContain('Foundation scaffold');
  });

  it('initApp replaces previous content and returns the stub element', async () => {
    const { initApp } = await import('./main');

    const container = document.createElement('section');
    container.append(document.createElement('span'));

    const stub = initApp(container);

    expect(stub.dataset.appStub).toBe(APP_STUB_MARKER);
    expect(stub.querySelector('h1')?.textContent).toBe(APP_TITLE);
    expect(container.querySelector('span')).toBeNull();
  });
});