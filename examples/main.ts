import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { BoxShadowFilter } from '../src/index';

// ============================================================
// Test case definitions (Visual tab)
// ============================================================

interface TestCase {
  label: string;
  boxShadow: string;
  borderRadius: number | [number, number, number, number];
  boxWidth: number;
  boxHeight: number;
  bgColor: string;
  bgColorHex: number;
}

const TEST_CASES: TestCase[] = [
  { label: 'Basic outer shadow', boxShadow: '4px 4px 8px rgba(0, 0, 0, 0.5)', borderRadius: 0, boxWidth: 160, boxHeight: 80, bgColor: '#ffffff', bgColorHex: 0xffffff },
  { label: 'No blur (hard shadow)', boxShadow: '4px 4px 0px rgba(0, 0, 0, 0.6)', borderRadius: 0, boxWidth: 160, boxHeight: 80, bgColor: '#ffffff', bgColorHex: 0xffffff },
  { label: 'Spread positive', boxShadow: '0 0 10px 5px rgba(0, 0, 0, 0.4)', borderRadius: 0, boxWidth: 160, boxHeight: 80, bgColor: '#ffffff', bgColorHex: 0xffffff },
  { label: 'Spread negative (Tailwind-like)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)', borderRadius: 0, boxWidth: 160, boxHeight: 80, bgColor: '#ffffff', bgColorHex: 0xffffff },
  { label: 'Inset shadow', boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.5)', borderRadius: 0, boxWidth: 160, boxHeight: 80, bgColor: '#ffffff', bgColorHex: 0xffffff },
  { label: 'Inset with spread', boxShadow: 'inset 0 0 10px 5px rgba(0, 0, 0, 0.5)', borderRadius: 0, boxWidth: 160, boxHeight: 80, bgColor: '#ffffff', bgColorHex: 0xffffff },
  { label: 'Border radius (16px) + shadow', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)', borderRadius: 16, boxWidth: 160, boxHeight: 80, bgColor: '#ffffff', bgColorHex: 0xffffff },
  { label: 'Per-corner radius (0 20px 0 20px)', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)', borderRadius: [0, 20, 0, 20], boxWidth: 160, boxHeight: 80, bgColor: '#ffffff', bgColorHex: 0xffffff },
  { label: 'Multiple shadows (Material Design)', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.24), 0 1px 2px rgba(0, 0, 0, 0.48)', borderRadius: 4, boxWidth: 160, boxHeight: 80, bgColor: '#ffffff', bgColorHex: 0xffffff },
  { label: 'Colored shadow (red)', boxShadow: '0 0 20px 5px rgba(255, 0, 0, 0.6)', borderRadius: 8, boxWidth: 160, boxHeight: 80, bgColor: '#ffffff', bgColorHex: 0xffffff },
  { label: 'Large blur (50px)', boxShadow: '0 0 50px rgba(0, 0, 0, 0.5)', borderRadius: 0, boxWidth: 160, boxHeight: 80, bgColor: '#ffffff', bgColorHex: 0xffffff },
  { label: 'Mixed inset + outer', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.4), inset 0 2px 6px rgba(0, 0, 0, 0.3)', borderRadius: 8, boxWidth: 160, boxHeight: 80, bgColor: '#ffffff', bgColorHex: 0xffffff },
  { label: 'Pill shape (full radius)', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)', borderRadius: 40, boxWidth: 160, boxHeight: 80, bgColor: '#ffffff', bgColorHex: 0xffffff },
  { label: 'Tailwind shadow-lg', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3)', borderRadius: 8, boxWidth: 160, boxHeight: 80, bgColor: '#ffffff', bgColorHex: 0xffffff },
  { label: 'Colored shadow (blue glow)', boxShadow: '0 0 30px 10px rgba(59, 130, 246, 0.5)', borderRadius: 12, boxWidth: 160, boxHeight: 80, bgColor: '#1e293b', bgColorHex: 0x1e293b },
  { label: 'Offset only, no blur/spread', boxShadow: '8px 8px 0 0 rgba(0, 0, 0, 0.8)', borderRadius: 0, boxWidth: 160, boxHeight: 80, bgColor: '#ffffff', bgColorHex: 0xffffff },
];

// ============================================================
// Helpers
// ============================================================

const ROW_HEIGHT = 200;
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = ROW_HEIGHT * TEST_CASES.length;

function drawRoundedRect(
  gfx: Graphics, w: number, h: number,
  radius: number | [number, number, number, number], fillColor: number,
): void {
  if (Array.isArray(radius)) {
    const [tl, tr, br, bl] = radius;
    gfx.moveTo(tl, 0);
    gfx.lineTo(w - tr, 0);
    if (tr > 0) gfx.arcTo(w, 0, w, tr, tr); else gfx.lineTo(w, 0);
    gfx.lineTo(w, h - br);
    if (br > 0) gfx.arcTo(w, h, w - br, h, br); else gfx.lineTo(w, h);
    gfx.lineTo(bl, h);
    if (bl > 0) gfx.arcTo(0, h, 0, h - bl, bl); else gfx.lineTo(0, h);
    gfx.lineTo(0, tl);
    if (tl > 0) gfx.arcTo(0, 0, tl, 0, tl); else gfx.lineTo(0, 0);
    gfx.closePath();
    gfx.fill(fillColor);
  } else {
    gfx.roundRect(0, 0, w, h, radius);
    gfx.fill(fillColor);
  }
}

// ============================================================
// Tab management
// ============================================================

function setupTabs() {
  const tabBtns = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
  const tabContents = document.querySelectorAll<HTMLElement>('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const tab = document.getElementById(`tab-${btn.dataset.tab}`)!;
      tab.classList.add('active');

      // Start/stop perf animations based on active tab
      if (btn.dataset.tab === 'perf') {
        startPerfAnimations();
      } else {
        stopPerfAnimations();
      }
    });
  });

  const subBtns = document.querySelectorAll<HTMLButtonElement>('.sub-tab-btn');
  const subContents = document.querySelectorAll<HTMLElement>('.sub-content');

  subBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      subBtns.forEach(b => b.classList.remove('active'));
      subContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const sub = document.getElementById(`subtab-${btn.dataset.subtab}`)!;
      sub.classList.add('active');
    });
  });
}

// ============================================================
// Visual tab
// ============================================================

async function initVisualTab() {
  const cssColumn = document.getElementById('css-column')!;
  const pixiWrap = document.getElementById('pixi-canvas-wrap')!;

  // CSS column
  for (const tc of TEST_CASES) {
    const cssRadiusStr = Array.isArray(tc.borderRadius)
      ? tc.borderRadius.map((r: number) => `${r}px`).join(' ')
      : `${tc.borderRadius}px`;

    const cell = document.createElement('div');
    cell.className = 'test-cell';
    cell.style.minHeight = `${ROW_HEIGHT}px`;

    const label = document.createElement('div');
    label.className = 'test-label';
    label.textContent = `${tc.label}\n${tc.boxShadow}`;
    cell.appendChild(label);

    const box = document.createElement('div');
    box.style.width = `${tc.boxWidth}px`;
    box.style.height = `${tc.boxHeight}px`;
    box.style.background = tc.bgColor;
    box.style.borderRadius = cssRadiusStr;
    box.style.boxShadow = tc.boxShadow;
    cell.appendChild(box);
    cssColumn.appendChild(cell);
  }

  // PixiJS canvas
  const app = new Application();
  await app.init({
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundAlpha: 0,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    preference: 'webgl',
  });
  pixiWrap.appendChild(app.canvas);

  const labelStyle = new TextStyle({
    fontFamily: 'SF Mono, Fira Code, monospace',
    fontSize: 11,
    fill: '#777777',
    align: 'center',
    wordWrap: true,
    wordWrapWidth: 300,
  });

  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    const rowContainer = new Container();
    rowContainer.y = i * ROW_HEIGHT;
    app.stage.addChild(rowContainer);

    const label = new Text({ text: `${tc.label} (PixiJS)`, style: labelStyle });
    label.anchor.set(0.5, 0);
    label.x = CANVAS_WIDTH / 2;
    label.y = 15;
    rowContainer.addChild(label);

    const gfx = new Graphics();
    drawRoundedRect(gfx, tc.boxWidth, tc.boxHeight, tc.borderRadius, tc.bgColorHex);
    gfx.x = (CANVAS_WIDTH - tc.boxWidth) / 2;
    gfx.y = (ROW_HEIGHT - tc.boxHeight) / 2 + 10;

    const filter = new BoxShadowFilter({
      boxShadow: tc.boxShadow,
      width: tc.boxWidth,
      height: tc.boxHeight,
      borderRadius: tc.borderRadius,
    });
    gfx.filters = [filter];
    rowContainer.addChild(gfx);
  }
}

// ============================================================
// Performance tab
// ============================================================

let perfAnimationId: number | null = null;
let perfColorApp: Application | null = null;
let perfSizeApp: Application | null = null;

// FPS tracking
class FPSTracker {
  private lastTime = performance.now();
  private el: HTMLElement;
  private frameTimes: number[] = [];

  constructor(elementId: string) {
    this.el = document.getElementById(elementId)!;
  }

  tick() {
    const now = performance.now();
    this.frameTimes.push(now - this.lastTime);
    this.lastTime = now;

    if (this.frameTimes.length >= 60) {
      const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
      const fps = 1000 / avg;
      this.el.textContent = `FPS: ${fps.toFixed(1)}  |  Frame: ${avg.toFixed(2)}ms`;
      this.frameTimes = [];
    }
  }

  reset() {
    this.frameTimes = [];
    this.lastTime = performance.now();
    this.el.textContent = '–';
  }
}

const BOX_W = 160;
const BOX_H = 80;
const BORDER_RADIUS = 12;

function lerpColor(t: number): { r: number; g: number; b: number } {
  const r = Math.round(255 * (1 - t));
  const b = Math.round(255 * t);
  return { r, g: 0, b };
}

// --- State ---
let perfRunning = false;
let animationPaused = false;  // ticker runs but no changes
let canvasPaused = false;     // ticker stopped entirely

let perfColorTest: { filter: BoxShadowFilter; gfx: Graphics } | null = null;
let perfSizeTest: { gfx: Graphics; filter: BoxShadowFilter } | null = null;
let fpsPixiColor: FPSTracker | null = null;
let fpsPixiSize: FPSTracker | null = null;
let perfStartTime = 0;

async function initPerfColorTest() {
  const container = document.getElementById('perf-pixi-color-container')!;
  const app = new Application();
  await app.init({
    width: 400, height: 280,
    backgroundAlpha: 0,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    preference: 'webgl',
  });
  container.appendChild(app.canvas);
  perfColorApp = app;

  const gfx = new Graphics();
  gfx.roundRect(0, 0, BOX_W, BOX_H, BORDER_RADIUS);
  gfx.fill(0xffffff);
  gfx.x = (400 - BOX_W) / 2;
  gfx.y = (280 - BOX_H) / 2;

  const filter = new BoxShadowFilter({
    shadows: [{ offsetX: 0, offsetY: 0, blur: 20, spread: 5, color: 'rgb(255,0,0)', alpha: 0.6, inset: false }],
    width: BOX_W, height: BOX_H,
    borderRadius: BORDER_RADIUS,
  });
  gfx.filters = [filter];
  app.stage.addChild(gfx);

  return { filter, gfx };
}

async function initPerfSizeTest() {
  const container = document.getElementById('perf-pixi-size-container')!;
  const app = new Application();
  await app.init({
    width: 400, height: 280,
    backgroundAlpha: 0,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    preference: 'webgl',
  });
  container.appendChild(app.canvas);
  perfSizeApp = app;

  const gfx = new Graphics();
  gfx.roundRect(0, 0, BOX_W, BOX_H, BORDER_RADIUS);
  gfx.fill(0xffffff);
  gfx.x = (400 - BOX_W) / 2;
  gfx.y = (280 - BOX_H) / 2;

  const filter = new BoxShadowFilter({
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    width: BOX_W, height: BOX_H,
    borderRadius: BORDER_RADIUS,
  });
  gfx.filters = [filter];
  app.stage.addChild(gfx);

  return { gfx, filter };
}

function perfAnimate() {
  if (!perfRunning || !perfColorTest || !perfSizeTest) return;
  if (canvasPaused) return; // ticker fully stopped

  const elapsed = performance.now() - perfStartTime;
  const t = (Math.sin(elapsed * 0.003) + 1) * 0.5;

  if (!animationPaused) {
    // --- Color transition (only active sub-tab matters, but update both) ---
    const { r, g, b } = lerpColor(t);
    const colArr = perfColorTest.filter.uniforms.uShadowColor;
    colArr[0] = r / 255;
    colArr[1] = g / 255;
    colArr[2] = b / 255;
    colArr[3] = 0.6;

    // --- Size transition ---
    const minW = 80, maxW = 240;
    const minH = 40, maxH = 120;
    const w = Math.round(minW + (maxW - minW) * t);
    const h = Math.round(minH + (maxH - minH) * t);

    perfSizeTest.gfx.clear();
    perfSizeTest.gfx.roundRect(0, 0, w, h, BORDER_RADIUS);
    perfSizeTest.gfx.fill(0xffffff);
    perfSizeTest.gfx.x = (400 - w) / 2;
    perfSizeTest.gfx.y = (280 - h) / 2;
    perfSizeTest.filter.elementWidth = w;
    perfSizeTest.filter.elementHeight = h;
  }

  // Always tick FPS (even when animation paused — measures render cost)
  fpsPixiColor!.tick();
  fpsPixiSize!.tick();

  // Force PixiJS to re-render even when nothing changed (tests idle cache cost)
  perfColorApp!.render();
  perfSizeApp!.render();

  perfAnimationId = requestAnimationFrame(perfAnimate);
}

function setupPerfControls() {
  const btnAnim = document.getElementById('btn-toggle-animation')!;
  const btnCanvas = document.getElementById('btn-toggle-canvas')!;

  btnAnim.addEventListener('click', () => {
    animationPaused = !animationPaused;
    btnAnim.textContent = animationPaused ? '▶ Play Animation' : '⏸ Pause Animation';
    btnAnim.classList.toggle('paused', animationPaused);

    if (animationPaused) {
      fpsPixiColor?.reset();
      fpsPixiSize?.reset();
    }
  });

  btnCanvas.addEventListener('click', () => {
    canvasPaused = !canvasPaused;
    btnCanvas.textContent = canvasPaused ? '▶ Play Canvas' : '⏸ Pause Canvas';
    btnCanvas.classList.toggle('paused', canvasPaused);

    if (!canvasPaused && perfRunning) {
      // Resume the loop
      fpsPixiColor?.reset();
      fpsPixiSize?.reset();
      perfAnimationId = requestAnimationFrame(perfAnimate);
    }
  });
}

async function startPerfAnimations() {
  if (perfRunning) return;
  perfRunning = true;

  if (!perfColorApp) {
    perfColorTest = await initPerfColorTest();
    perfSizeTest = await initPerfSizeTest();
    fpsPixiColor = new FPSTracker('fps-pixi-color');
    fpsPixiSize = new FPSTracker('fps-pixi-size');
    setupPerfControls();
  }

  perfStartTime = performance.now();
  perfAnimationId = requestAnimationFrame(perfAnimate);
}

function stopPerfAnimations() {
  perfRunning = false;
  if (perfAnimationId !== null) {
    cancelAnimationFrame(perfAnimationId);
    perfAnimationId = null;
  }
}

// ============================================================
// Init
// ============================================================

async function init() {
  setupTabs();
  await initVisualTab();
}

init().catch(console.error);
