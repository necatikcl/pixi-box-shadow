import { Application, Graphics } from 'pixi.js';
import { BoxShadowFilter } from '../src/index';

const BOX_W = 160;
const BOX_H = 80;
const BORDER_R = 12;
const BOX_SHADOW = '0 6px 18px rgba(0, 0, 0, 0.55)';
const ELEMENT_ALPHA = 0.35;

async function main(): Promise<void> {
  const host = document.getElementById('pixi-host');
  const debugEl = document.getElementById('pixi-debug');
  if (!host || !debugEl) return;

  const app = new Application();
  await app.init({
    width: 400,
    height: 280,
    backgroundAlpha: 0,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    preference: 'webgl',
  });
  host.appendChild(app.canvas);

  const gfx = new Graphics();
  gfx.roundRect(0, 0, BOX_W, BOX_H, BORDER_R);
  gfx.fill(0xffffff);
  gfx.x = (app.renderer.width - BOX_W) / 2;
  gfx.y = (app.renderer.height - BOX_H) / 2;

  const filter = new BoxShadowFilter({
    boxShadow: BOX_SHADOW,
    borderRadius: BORDER_R,
  });
  gfx.filters = [filter];
  gfx.alpha = ELEMENT_ALPHA;

  app.stage.addChild(gfx);

  const tickDebug = (): void => {
    const wa = filter.uniforms.uWorldAlpha;
    const match = Math.abs(wa - ELEMENT_ALPHA) < 0.02;
    debugEl.textContent =
      `gfx.alpha=${ELEMENT_ALPHA} · uWorldAlpha=${wa.toFixed(4)}${match ? ' ✓' : ' ✗ (should match gfx.alpha when solo on stage)'}`;
  };

  app.ticker.add(tickDebug);
  tickDebug();
  app.start();
}

main().catch((e) => {
  console.error(e);
  const el = document.getElementById('pixi-debug');
  if (el) el.textContent = String(e);
});
