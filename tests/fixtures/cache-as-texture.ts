import { Application, Container, Graphics, Rectangle } from 'pixi.js';
import { BoxShadowFilter } from '../../src/index';

type ShapeKind = 'rect' | 'rotatedRect' | 'circle';
type CacheTarget = 'self' | 'parent';

interface ScenarioOptions {
  shape: ShapeKind;
  shapeMode?: 'box' | 'texture';
  cache: boolean;
  cacheTarget?: CacheTarget;
  parentPosition?: { x: number; y: number };
  localOrigin?: boolean;
  moveParentAfterCache?: { x: number; y: number };
}

interface BoundsSnapshot {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AlphaBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  alphaSum: number;
}

export interface CacheScenarioResult {
  filterPadding: number;
  elementWidth: number;
  elementHeight: number;
  cacheTextureBounds: BoundsSnapshot | null;
  alphaBounds: AlphaBounds;
  shadowProbeAlpha: number;
  centerAlpha: number;
  canvasWidth: number;
  canvasHeight: number;
}

const VIEW_W = 240;
const VIEW_H = 180;
const RECT_W = 80;
const RECT_H = 50;
const RECT_X = 80;
const RECT_Y = 65;
const CIRCLE_SIZE = 64;
const CIRCLE_X = 88;
const CIRCLE_Y = 58;
const SHADOW = '0 0 20px 10px rgba(0, 0, 0, 0.8)';
const ALPHA_THRESHOLD = 4;

function createShape(options: ScenarioOptions): Graphics {
  const gfx = new Graphics();

  if (options.shape === 'circle') {
    const r = CIRCLE_SIZE / 2;
    gfx.circle(r, r, r);
    gfx.fill(0xffffff);
    if (options.localOrigin) {
      gfx.position.set(0, 0);
    } else {
      gfx.position.set(CIRCLE_X, CIRCLE_Y);
    }
    return gfx;
  }

  gfx.roundRect(0, 0, RECT_W, RECT_H, 8);
  gfx.fill(0xffffff);
  if (options.localOrigin) {
    gfx.position.set(0, 0);
  } else {
    gfx.position.set(RECT_X, RECT_Y);
  }

  if (options.shape === 'rotatedRect') {
    gfx.pivot.set(RECT_W / 2, RECT_H / 2);
    gfx.position.set(RECT_X + RECT_W / 2, RECT_Y + RECT_H / 2);
    gfx.rotation = Math.PI / 5;
  }

  return gfx;
}

function snapshotBounds(bounds: { x: number; y: number; width: number; height: number } | null | undefined): BoundsSnapshot | null {
  if (!bounds) return null;
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
}

function getCacheTextureBounds(target: Container): BoundsSnapshot | null {
  const rg = target.renderGroup as unknown as { _textureBounds?: { x: number; y: number; width: number; height: number } } | null;
  return snapshotBounds(rg?._textureBounds);
}

function extractImageData(app: Application): ImageData {
  const canvas = app.renderer.extract.canvas({
    target: app.stage,
    frame: new Rectangle(0, 0, VIEW_W, VIEW_H),
  }) as HTMLCanvasElement;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D extraction context is unavailable');
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function alphaAt(imageData: ImageData, x: number, y: number): number {
  const clampedX = Math.max(0, Math.min(imageData.width - 1, Math.round(x)));
  const clampedY = Math.max(0, Math.min(imageData.height - 1, Math.round(y)));
  return imageData.data[(clampedY * imageData.width + clampedX) * 4 + 3];
}

function measureAlphaBounds(imageData: ImageData): AlphaBounds {
  let minX = imageData.width;
  let minY = imageData.height;
  let maxX = -1;
  let maxY = -1;
  let alphaSum = 0;

  for (let y = 0; y < imageData.height; y++) {
    for (let x = 0; x < imageData.width; x++) {
      const alpha = imageData.data[(y * imageData.width + x) * 4 + 3];
      if (alpha <= ALPHA_THRESHOLD) continue;

      alphaSum += alpha;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0, alphaSum: 0 };
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    alphaSum,
  };
}

async function renderScenario(options: ScenarioOptions): Promise<CacheScenarioResult> {
  const app = new Application();
  await app.init({
    width: VIEW_W,
    height: VIEW_H,
    backgroundAlpha: 0,
    antialias: false,
    autoDensity: false,
    resolution: 1,
    preference: 'webgl',
    autoStart: false,
  });

  const shape = createShape(options);
  const finalParentPosition = options.moveParentAfterCache ?? options.parentPosition;
  const probeOrigin = options.localOrigin && finalParentPosition
    ? finalParentPosition
    : { x: RECT_X, y: RECT_Y };
  const filter = new BoxShadowFilter({
    boxShadow: SHADOW,
    borderRadius: options.shape === 'circle' ? 0 : 8,
    shapeMode: options.shapeMode,
    quality: 4,
  });
  shape.filters = [filter];

  let cacheTarget: Container | null = null;

  const shouldWrapInParent = options.cacheTarget === 'parent' || options.parentPosition !== undefined;
  let parentContainer: Container | null = null;
  if (shouldWrapInParent) {
    const parent = new Container();
    const parentPosition = options.parentPosition ?? { x: 16, y: 12 };
    if (!options.localOrigin) {
      shape.position.x -= parentPosition.x;
      shape.position.y -= parentPosition.y;
    }
    parent.position.set(parentPosition.x, parentPosition.y);
    parent.addChild(shape);
    app.stage.addChild(parent);
    parentContainer = parent;
    if (options.cache) {
      if (options.cacheTarget === 'parent') {
        parent.cacheAsTexture(true);
        cacheTarget = parent;
      } else {
        shape.cacheAsTexture(true);
        cacheTarget = shape;
      }
    }
  } else {
    app.stage.addChild(shape);
    if (options.cache) {
      shape.cacheAsTexture(true);
      cacheTarget = shape;
    }
  }

  if (options.moveParentAfterCache && options.cache && parentContainer) {
    app.render();
    parentContainer.position.set(options.moveParentAfterCache.x, options.moveParentAfterCache.y);
  }

  app.render();

  const imageData = extractImageData(app);
  const result: CacheScenarioResult = {
    filterPadding: filter.padding,
    elementWidth: filter.elementWidth,
    elementHeight: filter.elementHeight,
    cacheTextureBounds: cacheTarget ? getCacheTextureBounds(cacheTarget) : null,
    alphaBounds: measureAlphaBounds(imageData),
    shadowProbeAlpha: options.shape === 'circle'
      ? alphaAt(imageData, CIRCLE_X - 10, CIRCLE_Y + CIRCLE_SIZE / 2)
      : alphaAt(imageData, probeOrigin.x - 10, probeOrigin.y + RECT_H / 2),
    centerAlpha: options.shape === 'circle'
      ? alphaAt(imageData, CIRCLE_X + CIRCLE_SIZE / 2, CIRCLE_Y + CIRCLE_SIZE / 2)
      : alphaAt(imageData, probeOrigin.x + RECT_W / 2, probeOrigin.y + RECT_H / 2),
    canvasWidth: imageData.width,
    canvasHeight: imageData.height,
  };

  app.destroy(true);
  return result;
}

declare global {
  interface Window {
    runCacheAsTextureScenario: (options: ScenarioOptions) => Promise<CacheScenarioResult>;
  }
}

window.runCacheAsTextureScenario = renderScenario;
