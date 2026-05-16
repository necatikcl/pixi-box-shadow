import { Application, Container, Graphics } from 'pixi.js';
import { BoxShadowFilter } from '../src/index';

type CacheMode = 'none' | 'child' | 'parent';
type ShapeMode = 'box' | 'texture';

interface DemoState {
  parentX: number;
  parentY: number;
  shapeMode: ShapeMode;
  localOrigin: boolean;
  moveAfterCache: boolean;
}

interface DemoApp {
  app: Application;
  host: HTMLElement;
  debug: HTMLElement;
  cacheMode: CacheMode;
}

const VIEW_W = 340;
const VIEW_H = 240;
const RECT_W = 110;
const RECT_H = 64;
const CIRCLE_SIZE = 74;
const BORDER_R = 10;
const BOX_SHADOW = '0 0 24px 10px rgba(0, 0, 0, 0.72)';

const els = {
  parentX: document.getElementById('parent-x') as HTMLInputElement,
  parentY: document.getElementById('parent-y') as HTMLInputElement,
  parentXValue: document.getElementById('parent-x-value')!,
  parentYValue: document.getElementById('parent-y-value')!,
  shapeMode: document.getElementById('shape-mode') as HTMLSelectElement,
  localOrigin: document.getElementById('local-origin') as HTMLInputElement,
  moveAfterCache: document.getElementById('move-after-cache') as HTMLInputElement,
};

function drawShape(gfx: Graphics, shapeMode: ShapeMode): void {
  if (shapeMode === 'texture') {
    const r = CIRCLE_SIZE / 2;
    gfx.circle(r, r, r);
    gfx.fill(0xffffff);
    return;
  }

  gfx.roundRect(0, 0, RECT_W, RECT_H, BORDER_R);
  gfx.fill(0xffffff);
}

function shapeSize(shapeMode: ShapeMode): { width: number; height: number } {
  return shapeMode === 'texture'
    ? { width: CIRCLE_SIZE, height: CIRCLE_SIZE }
    : { width: RECT_W, height: RECT_H };
}

function readState(): DemoState {
  return {
    parentX: Number(els.parentX.value),
    parentY: Number(els.parentY.value),
    shapeMode: els.shapeMode.value as ShapeMode,
    localOrigin: els.localOrigin.checked,
    moveAfterCache: els.moveAfterCache.checked,
  };
}

function formatBounds(bounds: { x: number; y: number; width: number; height: number } | null | undefined): string {
  if (!bounds) return 'n/a';
  return `x=${bounds.x.toFixed(1)}, y=${bounds.y.toFixed(1)}, w=${bounds.width.toFixed(1)}, h=${bounds.height.toFixed(1)}`;
}

function getCacheBounds(container: Container): { x: number; y: number; width: number; height: number } | null {
  const rg = container.renderGroup as unknown as {
    _textureBounds?: { x: number; y: number; width: number; height: number };
  } | null;
  return rg?._textureBounds ?? null;
}

async function createDemoApp(hostId: string, debugId: string, cacheMode: CacheMode): Promise<DemoApp> {
  const host = document.getElementById(hostId);
  const debug = document.getElementById(debugId);
  if (!host || !debug) {
    throw new Error(`Missing host/debug elements for ${cacheMode}`);
  }

  const app = new Application();
  await app.init({
    width: VIEW_W,
    height: VIEW_H,
    backgroundAlpha: 0,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    preference: 'webgl',
    autoStart: false,
  });
  host.appendChild(app.canvas);
  return { app, host, debug, cacheMode };
}

function renderDemo(demo: DemoApp, state: DemoState): void {
  const { app, cacheMode, debug } = demo;
  app.stage.removeChildren();

  const parent = new Container();
  const shape = new Graphics();
  drawShape(shape, state.shapeMode);

  const { width, height } = shapeSize(state.shapeMode);
  const targetWorldX = 110;
  const targetWorldY = 82;
  const initialParentX = state.moveAfterCache && cacheMode !== 'none' ? 0 : state.parentX;
  const initialParentY = state.moveAfterCache && cacheMode !== 'none' ? 0 : state.parentY;

  parent.position.set(initialParentX, initialParentY);
  if (state.localOrigin) {
    shape.position.set(0, 0);
  } else {
    shape.position.set(targetWorldX - initialParentX, targetWorldY - initialParentY);
  }

  const filter = new BoxShadowFilter({
    boxShadow: BOX_SHADOW,
    borderRadius: state.shapeMode === 'box' ? BORDER_R : 0,
    shapeMode: state.shapeMode === 'texture' ? 'texture' : 'box',
    quality: 4,
  });
  shape.filters = [filter];

  parent.addChild(shape);
  app.stage.addChild(parent);

  let cachedTarget: Container | null = null;
  if (cacheMode === 'child') {
    shape.cacheAsTexture(true);
    cachedTarget = shape;
  } else if (cacheMode === 'parent') {
    parent.cacheAsTexture(true);
    cachedTarget = parent;
  }

  if (state.moveAfterCache && cacheMode !== 'none') {
    app.render();
    parent.position.set(state.parentX, state.parentY);
  }

  app.render();

  const worldX = state.localOrigin ? state.parentX : targetWorldX;
  const worldY = state.localOrigin ? state.parentY : targetWorldY;
  const cacheBounds = cachedTarget ? getCacheBounds(cachedTarget) : null;

  debug.textContent = [
    `cache: ${cacheMode}`,
    `shape: ${state.shapeMode}; localOrigin=${state.localOrigin}; moveAfterCache=${state.moveAfterCache}`,
    `parent.position=(${parent.position.x.toFixed(1)}, ${parent.position.y.toFixed(1)})`,
    `expected element world rect: x=${worldX.toFixed(1)}, y=${worldY.toFixed(1)}, w=${width}, h=${height}`,
    `filter element: ${filter.elementWidth.toFixed(1)} × ${filter.elementHeight.toFixed(1)}; padding=${filter.padding}`,
    `cache texture bounds: ${formatBounds(cacheBounds)}`,
  ].join('\n');
}

async function main(): Promise<void> {
  const demos = await Promise.all([
    createDemoApp('host-uncached', 'debug-uncached', 'none'),
    createDemoApp('host-child-cache', 'debug-child-cache', 'child'),
    createDemoApp('host-parent-cache', 'debug-parent-cache', 'parent'),
  ]);

  const rerender = (): void => {
    const state = readState();
    els.parentXValue.textContent = String(state.parentX);
    els.parentYValue.textContent = String(state.parentY);
    for (const demo of demos) {
      renderDemo(demo, state);
    }
  };

  for (const control of [els.parentX, els.parentY, els.shapeMode, els.localOrigin, els.moveAfterCache]) {
    control.addEventListener('input', rerender);
    control.addEventListener('change', rerender);
  }

  rerender();
}

main().catch((error) => {
  console.error(error);
  for (const id of ['debug-uncached', 'debug-child-cache', 'debug-parent-cache']) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(error);
  }
});
