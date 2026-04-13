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
  shapeMode?: 'box' | 'texture';
  quality?: number;
  drawShape?: 'rect' | 'circle' | 'star' | 'diamond' | 'triangle' | 'heart' | 'hexagon' | 'cross';
}

interface DemoStats {
  totalCases: number;
  textureCases: number;
  insetCases: number;
  multiShadowCases: number;
}

const TEST_CASES: TestCase[] = [
  // ── Original box-mode tests ────────────────────────────────
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
  { label: 'Multi-color shadows', boxShadow: '-6px -6px 16px rgba(255, 0, 0, 0.5), 6px 6px 16px rgba(0, 100, 255, 0.5)', borderRadius: 12, boxWidth: 160, boxHeight: 80, bgColor: '#ffffff', bgColorHex: 0xffffff },
  { label: 'Layered neon glow (multi-color)', boxShadow: '0 0 10px 2px rgba(255, 0, 200, 0.7), 0 0 30px 8px rgba(0, 200, 255, 0.4)', borderRadius: 12, boxWidth: 160, boxHeight: 80, bgColor: '#1e293b', bgColorHex: 0x1e293b },

  // ── Texture mode — shapes ─────────────────────────────────
  { label: 'TEXTURE: circle', boxShadow: '0 4px 10px rgba(0, 0, 0, 0.5)', borderRadius: 0, boxWidth: 80, boxHeight: 80, bgColor: '#ffffff', bgColorHex: 0xffffff, shapeMode: 'texture', drawShape: 'circle' },
  { label: 'TEXTURE: star', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)', borderRadius: 0, boxWidth: 80, boxHeight: 80, bgColor: '#ffffff', bgColorHex: 0xffffff, shapeMode: 'texture', drawShape: 'star' },
  { label: 'TEXTURE: diamond', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)', borderRadius: 0, boxWidth: 80, boxHeight: 80, bgColor: '#ffffff', bgColorHex: 0xffffff, shapeMode: 'texture', drawShape: 'diamond' },
  { label: 'TEXTURE: triangle', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)', borderRadius: 0, boxWidth: 80, boxHeight: 80, bgColor: '#ffffff', bgColorHex: 0xffffff, shapeMode: 'texture', drawShape: 'triangle' },
  { label: 'TEXTURE: hexagon', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)', borderRadius: 0, boxWidth: 80, boxHeight: 80, bgColor: '#ffffff', bgColorHex: 0xffffff, shapeMode: 'texture', drawShape: 'hexagon' },
  { label: 'TEXTURE: cross / plus', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)', borderRadius: 0, boxWidth: 80, boxHeight: 80, bgColor: '#ffffff', bgColorHex: 0xffffff, shapeMode: 'texture', drawShape: 'cross' },
  { label: 'TEXTURE: heart', boxShadow: '0 4px 14px rgba(220, 40, 60, 0.6)', borderRadius: 0, boxWidth: 80, boxHeight: 80, bgColor: '#dc143c', bgColorHex: 0xdc143c, shapeMode: 'texture', drawShape: 'heart' },

  // ── Texture mode — shadow styles ──────────────────────────
  { label: 'TEXTURE: colored glow (circle)', boxShadow: '0 0 24px 6px rgba(59, 130, 246, 0.6)', borderRadius: 0, boxWidth: 80, boxHeight: 80, bgColor: '#1e293b', bgColorHex: 0x1e293b, shapeMode: 'texture', drawShape: 'circle' },
  { label: 'TEXTURE: large blur (star)', boxShadow: '0 0 40px rgba(0, 0, 0, 0.5)', borderRadius: 0, boxWidth: 80, boxHeight: 80, bgColor: '#ffffff', bgColorHex: 0xffffff, shapeMode: 'texture', quality: 4, drawShape: 'star' },
  { label: 'TEXTURE: offset shadow (diamond)', boxShadow: '6px 6px 8px rgba(0, 0, 0, 0.5)', borderRadius: 0, boxWidth: 80, boxHeight: 80, bgColor: '#ffffff', bgColorHex: 0xffffff, shapeMode: 'texture', drawShape: 'diamond' },
  { label: 'TEXTURE: inset shadow (circle)', boxShadow: 'inset 0 3px 10px rgba(0, 0, 0, 0.6)', borderRadius: 0, boxWidth: 80, boxHeight: 80, bgColor: '#ffffff', bgColorHex: 0xffffff, shapeMode: 'texture', drawShape: 'circle' },
  { label: 'TEXTURE: multi-shadow (star)', boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3), 0 8px 24px rgba(0, 0, 0, 0.25)', borderRadius: 0, boxWidth: 80, boxHeight: 80, bgColor: '#ffffff', bgColorHex: 0xffffff, shapeMode: 'texture', drawShape: 'star' },
  { label: 'TEXTURE: hard shadow (hexagon)', boxShadow: '5px 5px 0 rgba(0, 0, 0, 0.7)', borderRadius: 0, boxWidth: 80, boxHeight: 80, bgColor: '#ffffff', bgColorHex: 0xffffff, shapeMode: 'texture', drawShape: 'hexagon' },
];

// ============================================================
// Shape drawing helpers
// ============================================================

const ROW_HEIGHT = 200;
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = ROW_HEIGHT * TEST_CASES.length;

function splitTopLevelCommaList(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }

  const last = value.slice(start).trim();
  if (last.length > 0) {
    parts.push(last);
  }

  return parts;
}

function getDemoStats(): DemoStats {
  return TEST_CASES.reduce<DemoStats>((stats, testCase) => {
    stats.totalCases += 1;
    if (testCase.shapeMode === 'texture') {
      stats.textureCases += 1;
    }
    if (testCase.boxShadow.includes('inset')) {
      stats.insetCases += 1;
    }
    if (splitTopLevelCommaList(testCase.boxShadow).length > 1) {
      stats.multiShadowCases += 1;
    }
    return stats;
  }, {
    totalCases: 0,
    textureCases: 0,
    insetCases: 0,
    multiShadowCases: 0,
  });
}

function setTextContent(id: string, value: string): void {
  const element = document.getElementById(id);
  if (!element) {
    return;
  }

  element.textContent = value;
}

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

function drawCircle(gfx: Graphics, size: number, fillColor: number): void {
  const r = size / 2;
  gfx.circle(r, r, r);
  gfx.fill(fillColor);
}

function drawPolygon(gfx: Graphics, cx: number, cy: number, r: number, sides: number, fillColor: number, startAngle = -Math.PI / 2): void {
  const step = (Math.PI * 2) / sides;
  gfx.moveTo(cx + r * Math.cos(startAngle), cy + r * Math.sin(startAngle));
  for (let i = 1; i <= sides; i++) {
    const angle = startAngle + i * step;
    gfx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
  }
  gfx.closePath();
  gfx.fill(fillColor);
}

function drawStar(gfx: Graphics, cx: number, cy: number, outerR: number, innerR: number, points: number, fillColor: number): void {
  const step = Math.PI / points;
  gfx.moveTo(cx + outerR * Math.cos(-Math.PI / 2), cy + outerR * Math.sin(-Math.PI / 2));
  for (let i = 0; i < points * 2; i++) {
    const angle = -Math.PI / 2 + (i + 1) * step;
    const r = (i % 2 === 0) ? innerR : outerR;
    gfx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
  }
  gfx.closePath();
  gfx.fill(fillColor);
}

function drawDiamond(gfx: Graphics, w: number, h: number, fillColor: number): void {
  const cx = w / 2, cy = h / 2;
  gfx.moveTo(cx, 0);
  gfx.lineTo(w, cy);
  gfx.lineTo(cx, h);
  gfx.lineTo(0, cy);
  gfx.closePath();
  gfx.fill(fillColor);
}

function drawTriangle(gfx: Graphics, w: number, h: number, fillColor: number): void {
  gfx.moveTo(w / 2, 0);
  gfx.lineTo(w, h);
  gfx.lineTo(0, h);
  gfx.closePath();
  gfx.fill(fillColor);
}

function drawCross(gfx: Graphics, size: number, thickness: number, fillColor: number): void {
  const s = size, t = thickness, off = (s - t) / 2;
  gfx.moveTo(off, 0);
  gfx.lineTo(off + t, 0);
  gfx.lineTo(off + t, off);
  gfx.lineTo(s, off);
  gfx.lineTo(s, off + t);
  gfx.lineTo(off + t, off + t);
  gfx.lineTo(off + t, s);
  gfx.lineTo(off, s);
  gfx.lineTo(off, off + t);
  gfx.lineTo(0, off + t);
  gfx.lineTo(0, off);
  gfx.lineTo(off, off);
  gfx.closePath();
  gfx.fill(fillColor);
}

function drawHeart(gfx: Graphics, size: number, fillColor: number): void {
  const s = size;
  const cx = s / 2;
  gfx.moveTo(cx, s * 0.9);
  gfx.bezierCurveTo(s * 0.05, s * 0.55, s * 0.05, s * 0.15, cx, s * 0.3);
  gfx.bezierCurveTo(s * 0.95, s * 0.15, s * 0.95, s * 0.55, cx, s * 0.9);
  gfx.closePath();
  gfx.fill(fillColor);
}

function drawShapeForTestCase(gfx: Graphics, tc: TestCase): void {
  const shape = tc.drawShape ?? 'rect';
  switch (shape) {
    case 'circle':
      drawCircle(gfx, tc.boxWidth, tc.bgColorHex);
      return;
    case 'star':
      drawStar(gfx, tc.boxWidth / 2, tc.boxHeight / 2, 38, 16, 5, tc.bgColorHex);
      return;
    case 'diamond':
      drawDiamond(gfx, tc.boxWidth, tc.boxHeight, tc.bgColorHex);
      return;
    case 'triangle':
      drawTriangle(gfx, tc.boxWidth, tc.boxHeight, tc.bgColorHex);
      return;
    case 'hexagon':
      drawPolygon(gfx, tc.boxWidth / 2, tc.boxHeight / 2, 38, 6, tc.bgColorHex);
      return;
    case 'cross':
      drawCross(gfx, tc.boxWidth, 24, tc.bgColorHex);
      return;
    case 'heart':
      drawHeart(gfx, tc.boxWidth, tc.bgColorHex);
      return;
    default:
      drawRoundedRect(gfx, tc.boxWidth, tc.boxHeight, tc.borderRadius, tc.bgColorHex);
  }
}

// ============================================================
// CSS column shape helpers
// ============================================================

/**
 * Convert a box-shadow CSS string into a CSS `filter` property value
 * using `drop-shadow()` functions. Strips `inset` (not supported by
 * drop-shadow) and the spread value (4th length, also not supported).
 * Multiple comma-separated shadows become chained drop-shadow() calls.
 */
function boxShadowToDropShadow(boxShadow: string): string {
  const parts = splitTopLevelCommaList(boxShadow);
  const filters: string[] = [];
  for (const part of parts) {
    // Strip inset keyword
    const clean = part.replace(/\binset\b/gi, '').trim();
    // Match: offsetX offsetY blur [spread] color
    // Length values can be "0", "4px", "-1px", etc. (bare 0 is valid CSS)
    const m = clean.match(
      /^([-\d.]+(?:px)?)\s+([-\d.]+(?:px)?)\s+([-\d.]+(?:px)?)\s*(?:[-\d.]+(?:px)?\s+)?(rgba?\([^)]+\)|hsla?\([^)]+\)|#[a-fA-F0-9]{3,8}|\w+)$/
    );
    if (m) {
      // Ensure px suffix for drop-shadow (required by spec)
      const offsetX = m[1].endsWith('px') ? m[1] : m[1] + 'px';
      const offsetY = m[2].endsWith('px') ? m[2] : m[2] + 'px';
      // CSS box-shadow blur = 2σ, but drop-shadow blur = σ (stdDeviation).
      // Halve the blur value so both produce the same visual result.
      const rawBlur = parseFloat(m[3]);
      const blur = `${rawBlur / 2}px`;
      filters.push(`drop-shadow(${offsetX} ${offsetY} ${blur} ${m[4]})`);
    }
  }

  return filters.join(' ');
}

/**
 * Build the SVG markup for a given non-rect shape (no shadow filter —
 * the CSS `filter: drop-shadow()` is applied on the wrapping HTML element).
 */
function buildShapeSVG(shape: string, size: number, fill: string): string {
  const s = size;
  let content = '';
  switch (shape) {
    case 'star':
      content = `<polygon points="40,5 50,30 78,30 55,47 63,75 40,58 17,75 25,47 2,30 30,30" fill="${fill}"/>`;
      break;
    case 'diamond':
      content = `<polygon points="${s / 2},0 ${s},${s / 2} ${s / 2},${s} 0,${s / 2}" fill="${fill}"/>`;
      break;
    case 'triangle':
      content = `<polygon points="${s / 2},0 ${s},${s} 0,${s}" fill="${fill}"/>`;
      break;
    case 'hexagon': {
      const r = 38, cx = s / 2, cy = s / 2;
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = -Math.PI / 2 + i * Math.PI / 3;
        return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
      }).join(' ');
      content = `<polygon points="${pts}" fill="${fill}"/>`;
      break;
    }
    case 'cross': {
      const t = 24, off = (s - t) / 2;
      content = `<polygon points="${off},0 ${off + t},0 ${off + t},${off} ${s},${off} ${s},${off + t} ${off + t},${off + t} ${off + t},${s} ${off},${s} ${off},${off + t} 0,${off + t} 0,${off} ${off},${off}" fill="${fill}"/>`;
      break;
    }
    case 'heart':
      content = `<path d="M${s / 2},${s * 0.9} C${s * 0.05},${s * 0.55} ${s * 0.05},${s * 0.15} ${s / 2},${s * 0.3} C${s * 0.95},${s * 0.15} ${s * 0.95},${s * 0.55} ${s / 2},${s * 0.9}Z" fill="${fill}"/>`;
      break;
  }
  return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">${content}</svg>`;
}

function createCSSElement(tc: TestCase): HTMLElement {
  const shape = tc.drawShape ?? 'rect';

  // ── Non-rect shapes: use CSS filter: drop-shadow() ─────────
  if (shape === 'circle') {
    const el = document.createElement('div');
    el.className = 'css-preview-shape';
    el.style.width = `${tc.boxWidth}px`;
    el.style.height = `${tc.boxHeight}px`;
    el.style.background = tc.bgColor;
    el.style.borderRadius = '50%';
    el.style.filter = boxShadowToDropShadow(tc.boxShadow);
    return el;
  }

  if (shape !== 'rect') {
    const wrap = document.createElement('div');
    wrap.className = 'css-preview-shape';
    wrap.style.width = `${tc.boxWidth}px`;
    wrap.style.height = `${tc.boxHeight}px`;
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.justifyContent = 'center';
    // CSS filter: drop-shadow() on the wrapper traces the alpha contour
    // of the SVG content — this is the proper CSS comparison for our
    // texture-mode two-pass Gaussian blur.
    wrap.style.filter = boxShadowToDropShadow(tc.boxShadow);
    wrap.innerHTML = buildShapeSVG(shape, tc.boxWidth, tc.bgColor);
    return wrap;
  }

  // ── Rect shapes: use standard CSS box-shadow ───────────────
  const cssRadiusStr = Array.isArray(tc.borderRadius)
    ? tc.borderRadius.map((r: number) => `${r}px`).join(' ')
    : `${tc.borderRadius}px`;

  const el = document.createElement('div');
  el.className = 'css-preview-shape';
  el.style.width = `${tc.boxWidth}px`;
  el.style.height = `${tc.boxHeight}px`;
  el.style.background = tc.bgColor;
  el.style.borderRadius = cssRadiusStr;
  el.style.boxShadow = tc.boxShadow;
  return el;
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
      tabBtns.forEach(b => b.setAttribute('aria-selected', 'false'));
      tabContents.forEach(c => {
        c.classList.remove('active');
        c.setAttribute('hidden', 'true');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const tab = document.getElementById(`tab-${btn.dataset.tab}`)!;
      tab.classList.add('active');
      tab.removeAttribute('hidden');

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
      subBtns.forEach(b => b.setAttribute('aria-selected', 'false'));
      subContents.forEach(c => {
        c.classList.remove('active');
        c.setAttribute('hidden', 'true');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const sub = document.getElementById(`subtab-${btn.dataset.subtab}`)!;
      sub.classList.add('active');
      sub.removeAttribute('hidden');
    });
  });
}

function createMetaPill(content: string, tone: 'default' | 'info' | 'warning' = 'default'): HTMLSpanElement {
  const pill = document.createElement('span');
  pill.className = 'meta-pill';

  if (tone !== 'default') {
    pill.classList.add(tone);
  }

  pill.textContent = content;
  return pill;
}

function getModeLabel(testCase: TestCase): string {
  if (testCase.shapeMode === 'texture') {
    return 'Texture mode';
  }

  return 'Box mode';
}

function getShapeLabel(testCase: TestCase): string {
  const shape = testCase.drawShape ?? 'rect';
  if (shape === 'rect') {
    return 'Rounded rect';
  }

  return shape.charAt(0).toUpperCase() + shape.slice(1);
}

function getCSSStrategyLabel(testCase: TestCase): string {
  if (testCase.shapeMode === 'texture') {
    return 'CSS: drop-shadow()';
  }

  return 'CSS: box-shadow';
}

function getPixiLabel(testCase: TestCase): string {
  if (testCase.shapeMode === 'texture') {
    return `${testCase.label.replace(/^TEXTURE:\s*/, '')} · PixiJS`;
  }

  return `${testCase.label} · PixiJS`;
}

function createVisualTestCell(testCase: TestCase): HTMLElement {
  const cell = document.createElement('div');
  cell.className = 'test-cell';
  cell.style.minHeight = `${ROW_HEIGHT}px`;

  const header = document.createElement('div');
  header.className = 'test-cell__header';

  const title = document.createElement('div');
  title.className = 'test-cell__title';
  title.textContent = testCase.label.replace(/^TEXTURE:\s*/, '');

  const shadow = document.createElement('code');
  shadow.className = 'test-cell__shadow';
  shadow.textContent = testCase.boxShadow;

  const meta = document.createElement('div');
  meta.className = 'test-cell__meta';
  meta.appendChild(createMetaPill(getModeLabel(testCase)));
  meta.appendChild(createMetaPill(getShapeLabel(testCase), 'info'));
  meta.appendChild(createMetaPill(getCSSStrategyLabel(testCase)));

  if (splitTopLevelCommaList(testCase.boxShadow).length > 1) {
    meta.appendChild(createMetaPill('Multi-shadow'));
  }

  if (testCase.boxShadow.includes('inset')) {
    const tone = testCase.shapeMode === 'texture' ? 'warning' : 'info';
    const content = testCase.shapeMode === 'texture'
      ? 'Inset reference falls back to outer drop-shadow()'
      : 'Inset shadow';
    meta.appendChild(createMetaPill(content, tone));
  }

  header.append(title, shadow, meta);

  const preview = document.createElement('div');
  preview.className = 'test-cell__preview';
  preview.appendChild(createCSSElement(testCase));

  cell.append(header, preview);
  return cell;
}

function updateDemoStats(): void {
  const stats = getDemoStats();
  setTextContent('stat-total-cases', String(stats.totalCases));
  setTextContent('stat-texture-cases', String(stats.textureCases));
  setTextContent('stat-inset-cases', String(stats.insetCases));
  setTextContent('stat-multi-cases', String(stats.multiShadowCases));
}

// ============================================================
// Visual tab
// ============================================================

async function initVisualTab() {
  const cssColumn = document.getElementById('css-column')!;
  const pixiWrap = document.getElementById('pixi-canvas-wrap')!;

  for (const tc of TEST_CASES) {
    cssColumn.appendChild(createVisualTestCell(tc));
  }

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
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
    fontSize: 13,
    fontWeight: '600',
    fill: '#27272a',
    align: 'center',
    wordWrap: true,
    wordWrapWidth: 320,
    lineHeight: 18,
  });

  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    const rowContainer = new Container();
    rowContainer.y = i * ROW_HEIGHT;
    app.stage.addChild(rowContainer);

    const label = new Text({ text: getPixiLabel(tc), style: labelStyle });
    label.anchor.set(0.5, 0);
    label.x = CANVAS_WIDTH / 2;
    label.y = 18;
    rowContainer.addChild(label);

    const gfx = new Graphics();
    drawShapeForTestCase(gfx, tc);
    gfx.x = (CANVAS_WIDTH - tc.boxWidth) / 2;
    gfx.y = (ROW_HEIGHT - tc.boxHeight) / 2 + 18;

    const filter = new BoxShadowFilter({
      boxShadow: tc.boxShadow,
      borderRadius: tc.borderRadius,
      shapeMode: tc.shapeMode,
      quality: tc.quality,
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

class FPSTracker {
  private lastTime = performance.now();
  private lastDisplayTime = performance.now();
  private el: HTMLElement;
  private frameTimes: number[] = [];

  constructor(elementId: string) {
    this.el = document.getElementById(elementId)!;
  }

  tick() {
    const now = performance.now();
    this.frameTimes.push(now - this.lastTime);
    this.lastTime = now;

    const shouldUpdateDisplay = this.frameTimes.length >= 60 || (
      this.frameTimes.length > 1 && now - this.lastDisplayTime >= 250
    );

    if (shouldUpdateDisplay) {
      const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
      const fps = 1000 / avg;
      this.el.textContent = `FPS: ${fps.toFixed(1)}  |  Frame: ${avg.toFixed(2)}ms`;
      this.frameTimes = [];
      this.lastDisplayTime = now;
    }
  }

  reset() {
    this.frameTimes = [];
    this.lastTime = performance.now();
    this.lastDisplayTime = this.lastTime;
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

let perfRunning = false;
let animationPaused = false;
let canvasPaused = false;

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
    borderRadius: BORDER_RADIUS,
  });
  gfx.filters = [filter];
  app.stage.addChild(gfx);

  return { gfx, filter };
}

function perfAnimate() {
  if (!perfRunning || !perfColorTest || !perfSizeTest) {
    return;
  }
  if (canvasPaused) {
    return;
  }

  const elapsed = performance.now() - perfStartTime;
  const t = (Math.sin(elapsed * 0.003) + 1) * 0.5;

  if (!animationPaused) {
    const { r, g, b } = lerpColor(t);
    const colArr = perfColorTest.filter.uniforms.uShadowColor;
    colArr[0] = r / 255;
    colArr[1] = g / 255;
    colArr[2] = b / 255;
    colArr[3] = 0.6;

    const minW = 80, maxW = 240;
    const minH = 40, maxH = 120;
    const w = Math.round(minW + (maxW - minW) * t);
    const h = Math.round(minH + (maxH - minH) * t);

    perfSizeTest.gfx.clear();
    perfSizeTest.gfx.roundRect(0, 0, w, h, BORDER_RADIUS);
    perfSizeTest.gfx.fill(0xffffff);
    perfSizeTest.gfx.x = (400 - w) / 2;
    perfSizeTest.gfx.y = (280 - h) / 2;
  }

  fpsPixiColor!.tick();
  fpsPixiSize!.tick();

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
  updateDemoStats();
  setupTabs();
  await initVisualTab();
}

init().catch(console.error);
