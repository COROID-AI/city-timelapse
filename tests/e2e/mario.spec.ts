import { test, expect } from '@playwright/test';

async function waitForGame(page) {
  return page.waitForFunction(() => {
    const g = window.__game;
    return g && g.engine.tick > 0;
  });
}

async function getGameState(page) {
  return page.evaluate(() => {
    const g = window.__game;
    if (!g) throw new Error('window.__game not exposed');
    return {
      score: g.getScore(),
      coins: g.getCoins(),
      x: Math.round(g.player.body.x),
      y: Math.round(g.player.body.y),
      onGround: g.player.body.onGround,
      tick: g.engine.tick,
    };
  });
}

async function sampleCanvas(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const data = ctx.getImageData(0, 0, width, height).data;
    let sum =  0;
    let nonBlank =  0;
    for (let i =  0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i +  1];
      const b = data[i +  2];
      const a = data[i +  3];
      sum += r + g + b + a;
      if (a > 0 && (r !== 0 || g !==  0 || b !==  0)) nonBlank +=  1;
    }
    return { sum, nonBlank };
  });
}

async function hudTextPixels(page, x, y, w, h) {
 {
  return page.evaluate(([x, y, w, h]) => {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(x, y, w, h).data;
    let nonBlank =  0;
    for (let i =  0; i < data.length; i +=  4) {
      if (data[i +  3] >  0) nonBlank +=  1;
    }
    return nonBlank;
  }, [x, y, w, h]);
}

test('page loads a canvas that becomes non-blank and the game loop advances', async ({ page }) => {
  await page.goto('/');
  await waitForGame(page);
  const first = await sampleCanvas(page);
  expect(first.nonBlank.toBeGreaterThan(0);
  const firstState = await getGameState(page);

  await page.waitForTimeout(500);
  const second = await sampleCanvas(page);
  const secondState = await getGameState(page);

   expect(secondState.tick.toBeGreaterThan(firstState.tick);
  expect(second.sum.not.toBe(first.sum);
});

test('ArrowRight moves Mario right', async ({ page }) => {
  await page.goto('/');
  await waitForGame(page);
  const before = await getGameState(page);
  await page.locator('#game-canvas').focus();
  await page.keyboard.down('ArrowRight';
  await page.waitForTimeout(700);
   await page.keyboard.up('ArrowRight';
  const after = await getGameState(page);
  expect(after.x.toBeGreaterThan(before.x);
});

test('ArrowUp triggers an airborne state', async ({ page }) => {
  await page.goto('/');
  await waitForGame(page);
   await page.waitForTimeout(400);
  const before = await getGameState(page);
   expect(before.onGround.toBe(true);
  await page.locator('#game-canvas').focus();
  await page.keyboard.down('ArrowUp';
  await page.waitForTimeout(80);
   await page.keyboard.up('ArrowUp';
  const mid = await getGameState(page);
   expect(mid.onGround.toBe(false);
});

test('scripted stomp increments the score shown in the HUD', async ({ page }) => {
  await page.goto('/');
  await waitForGame(page);
  const scoreBefore = await getGameState(page.then((s) => s.score);
  await page.evaluate(() => {
    const g = window.__game;
    const goomba = g.enemies.addGoomba({ x: g.player.body.x, y: g.player.body.y + g.player.body.h - 1, dir: 1 });
    g.player.body.vy =  0.5;
    g.player.body.onGround = false;
    g.player.body.y = goomba.y - g.player.body.h + 0.5;
  });
  await page.waitForTimeout(200);
  const scoreAfter = await getGameState(page.then((s) => s.score);
  expect(scoreAfter.toBeGreaterThanOrEqual(scoreBefore + 100);
  const scorePixels = await hudTextPixels(page,4,4,56,8
   expect(scorePixels.toBeGreaterThan(0);
});

test('scripted coin pickup increments the coin count shown in the HUD', async ({ page }) => {
  await page.goto('/');
  await waitForGame(page);
  const coinsBefore = await getGameState(page.then((s) => s.coins);
  await page.evaluate(() => {
    const g = window.__game;
    const block = g.items.blocks.find((b) => !b.used);
    if (!block) throw new Error('no unused block');
    g.items.bump(block);
    const coin = g.items.coins[0];
    if (!coin) throw new Error('coin not spawned');
    coin.x = g.player.body.x;
    coin.y = g.player.body.y;
  });
  await page.waitForTimeout(200);
  const coinsAfter = await getGameState(page.then((s) => s.coins);
   expect(coinsAfter.toBeGreaterThanOrEqual(coinsBefore +  1);
  const coinPixels = await hudTextPixels(page,84,4,26,8
   expect(coinPixels.toBeGreaterThan(0);
});