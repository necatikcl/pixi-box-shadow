import { animate } from 'motion';
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
  /** Radians — box mode SDF follows rotated local rect, not the AABB */
  rotation?: number;
  drawShape?: 'rect' | 'circle' | 'star' | 'diamond' | 'triangle' | 'heart' | 'hexagon' | 'cross';
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
  { label: 'Rotated 40° (box mode — shadow follows rect)', boxShadow: '6px 8px 14px rgba(0, 0, 0, 0.45)', borderRadius: 12, boxWidth: 160, boxHeight: 80, bgColor: '#ffffff', bgColorHex: 0xffffff, rotation: (40 * Math.PI) / 180 },

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

const DEMO_ROW_MIN_PX = 200;
/** Must match `.test-cell` padding-top and padding-bottom in `index.html`. */
const TEST_CELL_PAD_Y = 24;
const LABEL_DEMO_GAP_PX = 14;
const CANVAS_WIDTH = 400;
const PERF_VIEW_W = 400;
const PERF_VIEW_H = 280;

const TAB_SPRING = { type: 'spring' as const, stiffness: 460, damping: 38 };

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
  // Split on top-level commas (respecting parentheses)
  const parts: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < boxShadow.length; i++) {
    const ch = boxShadow[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(boxShadow.slice(start, i).trim());
      start = i + 1;
    }
  }
  const last = boxShadow.slice(start).trim();
  if (last.length > 0) parts.push(last);

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
    el.style.width = `${tc.boxWidth}px`;
    el.style.height = `${tc.boxHeight}px`;
    el.style.background = tc.bgColor;
    el.style.borderRadius = '50%';
    el.style.filter = boxShadowToDropShadow(tc.boxShadow);
    return el;
  }

  if (shape !== 'rect') {
    const wrap = document.createElement('div');
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
  el.style.width = `${tc.boxWidth}px`;
  el.style.height = `${tc.boxHeight}px`;
  el.style.background = tc.bgColor;
  el.style.borderRadius = cssRadiusStr;
  el.style.boxShadow = tc.boxShadow;
  if (tc.rotation != null) {
    el.style.transformOrigin = '0 0';
    el.style.transform = `rotate(${tc.rotation * (180 / Math.PI)}deg)`;
  }
  return el;
}

interface LabelParts {
  title: string;
  shadow: string;
  tagCss: string;
  tagPixi: string;
}

function buildLabelParts(tc: TestCase): LabelParts {
  const isTexture = tc.shapeMode === 'texture';
  const hasInset = tc.boxShadow.includes('inset');
  let cssNote = isTexture ? 'filter: drop-shadow()' : 'box-shadow';
  if (isTexture && hasInset) {
    cssNote += ' (inset not supported — showing outer)';
  }
  return {
    title: tc.label,
    shadow: tc.boxShadow,
    tagCss: `[CSS: ${cssNote}]`,
    tagPixi: `[PixiJS: ${cssNote}]`,
  };
}

const LABEL_WRAP_PX = 360;
const LABEL_BLOCK_GAP_PX = 4;

function createPixiLabelBlock(tc: TestCase, canvasWidth: number): Container {
  const parts = buildLabelParts(tc);
  const titleStyle = new TextStyle({
    fontFamily: 'Geist, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
    fontSize: 12,
    fontWeight: 500,
    fill: '#000000',
    align: 'center',
    lineHeight: 18,
    letterSpacing: 0,
    wordWrap: true,
    wordWrapWidth: LABEL_WRAP_PX,
  });
  const shadowStyle = new TextStyle({
    fontFamily: '"Geist Mono", ui-monospace, monospace',
    fontSize: 12,
    fontWeight: 400,
    fill: '#666666',
    align: 'center',
    lineHeight: 18,
    letterSpacing: 0,
    wordWrap: true,
    wordWrapWidth: LABEL_WRAP_PX,
  });
  const tagStyle = new TextStyle({
    fontFamily: '"Geist Mono", ui-monospace, monospace',
    fontSize: 11,
    fontWeight: 400,
    fill: '#888888',
    align: 'center',
    lineHeight: 16,
    letterSpacing: 0,
    wordWrap: true,
    wordWrapWidth: LABEL_WRAP_PX,
  });

  const title = new Text({ text: parts.title, style: titleStyle });
  const shadow = new Text({ text: parts.shadow, style: shadowStyle });
  const tag = new Text({ text: parts.tagPixi, style: tagStyle });

  const block = new Container();
  const cx = canvasWidth / 2;
  const lines = [title, shadow, tag];
  let y = 0;
  lines.forEach((t, i) => {
    t.anchor.set(0.5, 0);
    t.x = cx;
    t.y = y;
    block.addChild(t);
    y += t.height;
    if (i < lines.length - 1) y += LABEL_BLOCK_GAP_PX;
  });

  return block;
}

function syncSegmentIndicator(
  indicator: HTMLElement,
  btn: HTMLButtonElement | null,
  useMotion: boolean,
) {
  if (!btn) return;
  const next = {
    left: `${btn.offsetLeft}px`,
    top: `${btn.offsetTop}px`,
    width: `${btn.offsetWidth}px`,
    height: `${btn.offsetHeight}px`,
  };
  if (useMotion) {
    animate(indicator, next, TAB_SPRING);
  } else {
    Object.assign(indicator.style, next);
  }
}

// ============================================================
// Tab management
// ============================================================

function setupTabs() {
  const tabBtns = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
  const tabContents = document.querySelectorAll<HTMLElement>('.tab-content');
  const mainInd = document.getElementById('main-tab-indicator')!;
  const subInd = document.getElementById('sub-tab-indicator')!;
  const perfPanel = document.getElementById('tab-perf')!;

  const refreshIndicators = (useMotion: boolean) => {
    syncSegmentIndicator(mainInd, document.querySelector<HTMLButtonElement>('.tab-btn.active'), useMotion);
    if (!perfPanel.hidden) {
      syncSegmentIndicator(subInd, document.querySelector<HTMLButtonElement>('.sub-tab-btn.active'), useMotion);
    }
  };

  const activateMainTab = (tabId: string) => {
    tabBtns.forEach(b => {
      const on = b.dataset.tab === tabId;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
    tabContents.forEach(c => {
      const on = c.id === `tab-${tabId}`;
      c.classList.toggle('active', on);
      if (on) {
        c.removeAttribute('hidden');
        c.inert = false;
      } else {
        c.setAttribute('hidden', '');
        c.inert = true;
      }
    });
  };

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab!;
      activateMainTab(tabId);
      refreshIndicators(true);

      if (tabId === 'perf') {
        visualApp?.stop();
        startPerfAnimations();
        requestAnimationFrame(() => refreshIndicators(false));
      } else {
        stopPerfAnimations();
        visualApp?.start();
      }
    });
  });

  const subBtns = document.querySelectorAll<HTMLButtonElement>('.sub-tab-btn');
  const subContents = document.querySelectorAll<HTMLElement>('.sub-content');

  const activateSubTab = (subId: string) => {
    subBtns.forEach(b => {
      const on = b.dataset.subtab === subId;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
    subContents.forEach(c => {
      const on = c.id === `subtab-${subId}`;
      c.classList.toggle('active', on);
      if (on) {
        c.removeAttribute('hidden');
        c.inert = false;
      } else {
        c.setAttribute('hidden', '');
        c.inert = true;
      }
    });
  };

  subBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      activateSubTab(btn.dataset.subtab!);
      refreshIndicators(true);
    });
  });

  activateMainTab('visual');
  activateSubTab('color');

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => refreshIndicators(false), 80);
  });

  document.fonts.ready.then(() => requestAnimationFrame(() => refreshIndicators(false)));
  requestAnimationFrame(() => refreshIndicators(false));
}

// ============================================================
// Visual tab
// ============================================================

/** Main comparison canvas — must stop its ticker when leaving Visual tab or it keeps burning GPU. */
let visualApp: Application | null = null;

async function initVisualTab() {
  await document.fonts.ready;
  await Promise.all([
    document.fonts.load('500 12px Geist'),
    document.fonts.load('400 12px "Geist Mono"'),
    document.fonts.load('400 11px "Geist Mono"'),
  ]);

  const cssColumn = document.getElementById('css-column')!;
  const pixiWrap = document.getElementById('pixi-canvas-wrap')!;
  const rowGrid = document.getElementById('pixi-row-grid')!;

  for (const tc of TEST_CASES) {
    const cell = document.createElement('div');
    cell.className = 'test-cell';

    const parts = buildLabelParts(tc);
    const label = document.createElement('div');
    label.className = 'test-label';
    const titleEl = document.createElement('span');
    titleEl.className = 'test-label-title';
    titleEl.textContent = parts.title;
    const shadowEl = document.createElement('span');
    shadowEl.className = 'test-label-shadow';
    shadowEl.textContent = parts.shadow;
    const tagEl = document.createElement('span');
    tagEl.className = 'test-label-tag';
    tagEl.textContent = parts.tagCss;
    label.append(titleEl, shadowEl, tagEl);
    cell.appendChild(label);

    cell.appendChild(createCSSElement(tc));
    cssColumn.appendChild(cell);
  }

  const cells = [...cssColumn.querySelectorAll<HTMLElement>('.test-cell')];
  const naturals = cells.map(c => c.offsetHeight);
  const rowHeights = naturals.map(h => Math.max(h, DEMO_ROW_MIN_PX));
  cells.forEach((cell, i) => {
    cell.style.height = `${rowHeights[i]}px`;
    cell.style.minHeight = `${rowHeights[i]}px`;
  });

  const labelHeights = cells.map(c => c.querySelector<HTMLElement>('.test-label')!.offsetHeight);

  const canvasHeight = rowHeights.reduce((a, b) => a + b, 0);

  rowGrid.innerHTML = '';
  for (const h of rowHeights) {
    const row = document.createElement('div');
    row.style.height = `${h}px`;
    row.style.flexShrink = '0';
    row.style.borderBottom = '1px solid var(--border)';
    row.style.boxSizing = 'border-box';
    rowGrid.appendChild(row);
  }

  const app = new Application();
  await app.init({
    width: CANVAS_WIDTH,
    height: canvasHeight,
    backgroundAlpha: 0,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    preference: 'webgl',
    autoStart: false,
  });
  visualApp = app;
  pixiWrap.appendChild(app.canvas);

  let yAcc = 0;
  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    const rh = rowHeights[i];
    const lh = labelHeights[i];

    const rowContainer = new Container();
    rowContainer.y = yAcc;
    yAcc += rh;
    app.stage.addChild(rowContainer);

    const labelBlock = createPixiLabelBlock(tc, CANVAS_WIDTH);
    labelBlock.y = TEST_CELL_PAD_Y;
    rowContainer.addChild(labelBlock);

    const gfx = new Graphics();
    drawShapeForTestCase(gfx, tc);
    const demoY = TEST_CELL_PAD_Y + lh + LABEL_DEMO_GAP_PX;
    gfx.x = (CANVAS_WIDTH - tc.boxWidth) / 2;
    gfx.y = demoY;
    if (tc.rotation != null) gfx.rotation = tc.rotation;

    const filter = new BoxShadowFilter({
      boxShadow: tc.boxShadow,
      borderRadius: tc.borderRadius,
      shapeMode: tc.shapeMode,
      quality: tc.quality,
    });
    gfx.filters = [filter];
    rowContainer.addChild(gfx);
  }

  app.start();
}

// ============================================================
// Performance tab
// ============================================================

let perfAnimationId: number | null = null;
let perfColorApp: Application | null = null;
let perfSizeApp: Application | null = null;

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
    width: PERF_VIEW_W, height: PERF_VIEW_H,
    backgroundAlpha: 0,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    preference: 'webgl',
    autoStart: false,
  });
  container.appendChild(app.canvas);
  perfColorApp = app;

  const gfx = new Graphics();
  gfx.roundRect(0, 0, BOX_W, BOX_H, BORDER_RADIUS);
  gfx.fill(0xffffff);
  gfx.pivot.set(BOX_W / 2, BOX_H / 2);
  gfx.position.set(PERF_VIEW_W / 2, PERF_VIEW_H / 2);

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
    width: PERF_VIEW_W, height: PERF_VIEW_H,
    backgroundAlpha: 0,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    preference: 'webgl',
    autoStart: false,
  });
  container.appendChild(app.canvas);
  perfSizeApp = app;

  const gfx = new Graphics();
  gfx.roundRect(0, 0, BOX_W, BOX_H, BORDER_RADIUS);
  gfx.fill(0xffffff);
  gfx.pivot.set(BOX_W / 2, BOX_H / 2);
  gfx.position.set(PERF_VIEW_W / 2, PERF_VIEW_H / 2);

  const filter = new BoxShadowFilter({
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    borderRadius: BORDER_RADIUS,
  });
  gfx.filters = [filter];
  app.stage.addChild(gfx);

  return { gfx, filter };
}

function perfAnimate() {
  if (!perfRunning || !perfColorTest || !perfSizeTest) return;
  if (canvasPaused) return;

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
    perfSizeTest.gfx.pivot.set(w / 2, h / 2);
    perfSizeTest.gfx.position.set(PERF_VIEW_W / 2, PERF_VIEW_H / 2);

    // Continuous rotation (box-mode shadow uses local-space SDF while filter sees AABB)
    const rotation = elapsed * 0.0011;
    perfColorTest.gfx.rotation = rotation;
    perfSizeTest.gfx.rotation = rotation;
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
    btnAnim.textContent = animationPaused ? 'Play animation' : 'Pause animation';
    btnAnim.classList.toggle('paused', animationPaused);

    if (animationPaused) {
      fpsPixiColor?.reset();
      fpsPixiSize?.reset();
    }
  });

  btnCanvas.addEventListener('click', () => {
    canvasPaused = !canvasPaused;
    btnCanvas.textContent = canvasPaused ? 'Play canvas' : 'Pause canvas';
    btnCanvas.classList.toggle('paused', canvasPaused);

    if (canvasPaused && perfAnimationId !== null) {
      cancelAnimationFrame(perfAnimationId);
      perfAnimationId = null;
    }

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
  setupTabs();
  await initVisualTab();
}

init().catch(console.error);
