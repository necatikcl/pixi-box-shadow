import type { BoxShadowOptions } from './types';

/**
 * Split a CSS box-shadow string on top-level commas,
 * respecting parentheses (e.g. inside `rgba(…)`).
 */
function splitShadows(css: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      result.push(css.slice(start, i).trim());
      start = i + 1;
    }
  }

  const last = css.slice(start).trim();
  if (last.length > 0) {
    result.push(last);
  }

  return result;
}

/**
 * Tokenize a single shadow string into meaningful tokens,
 * keeping functional notations like `rgb(…)` as single tokens.
 */
function tokenize(shadow: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const len = shadow.length;

  while (i < len) {
    // Skip whitespace
    while (i < len && /\s/.test(shadow[i])) i++;
    if (i >= len) break;

    // Check for functional notation: word followed by '('
    const funcMatch = shadow.slice(i).match(/^[a-zA-Z-]+\(/);
    if (funcMatch) {
      // Read until matching closing paren
      const start = i;
      let depth = 0;
      while (i < len) {
        if (shadow[i] === '(') depth++;
        else if (shadow[i] === ')') {
          depth--;
          if (depth === 0) { i++; break; }
        }
        i++;
      }
      tokens.push(shadow.slice(start, i).trim());
      continue;
    }

    // Regular token (no spaces)
    const start = i;
    while (i < len && !/\s/.test(shadow[i])) i++;
    tokens.push(shadow.slice(start, i));
  }

  return tokens;
}

/**
 * Check if a token looks like a CSS numeric length value.
 */
function isNumericToken(token: string): boolean {
  return /^-?(\d+\.?\d*|\.\d+)(px|em|rem|%)?$/.test(token);
}

/**
 * Parse a numeric value, stripping any CSS unit suffix.
 * Treats bare numbers and px as equivalent.
 */
function parseNumeric(token: string): number {
  return parseFloat(token);
}

/**
 * Check if a token is a CSS color value.
 */
function isColorToken(token: string): boolean {
  // Hex colors
  if (/^#[0-9a-fA-F]{3,8}$/.test(token)) return true;

  // Functional colors
  if (/^(rgb|rgba|hsl|hsla)\(/.test(token)) return true;

  // Named colors — check a large subset of CSS named colors
  const namedColors = new Set([
    'transparent', 'currentcolor',
    'black', 'white', 'red', 'green', 'blue', 'yellow', 'cyan', 'magenta',
    'orange', 'purple', 'pink', 'brown', 'gray', 'grey', 'silver', 'gold',
    'navy', 'teal', 'maroon', 'olive', 'lime', 'aqua', 'fuchsia',
    'darkblue', 'darkgreen', 'darkred', 'darkcyan', 'darkmagenta', 'darkyellow',
    'darkgray', 'darkgrey', 'lightblue', 'lightgreen', 'lightpink', 'lightyellow',
    'lightgray', 'lightgrey', 'lightcyan', 'lightcoral', 'lightsalmon',
    'cornflowerblue', 'dodgerblue', 'steelblue', 'royalblue', 'midnightblue',
    'slategray', 'slategrey', 'dimgray', 'dimgrey', 'darkslategray', 'darkslategrey',
    'coral', 'tomato', 'orangered', 'firebrick', 'crimson', 'indianred',
    'chocolate', 'sienna', 'saddlebrown', 'peru', 'tan', 'wheat',
    'lavender', 'thistle', 'plum', 'violet', 'orchid', 'mediumvioletred',
    'deeppink', 'hotpink', 'palevioletred',
    'darkviolet', 'darkorchid', 'darkmagenta', 'mediumpurple', 'blueviolet',
    'indigo', 'rebeccapurple',
    'greenyellow', 'chartreuse', 'lawngreen', 'limegreen', 'palegreen',
    'mediumspringgreen', 'springgreen', 'mediumaquamarine', 'mediumseagreen',
    'seagreen', 'forestgreen', 'darkgreen', 'darkolivegreen', 'olivedrab',
    'yellowgreen',
    'aliceblue', 'antiquewhite', 'azure', 'beige', 'bisque', 'blanchedalmond',
    'burlywood', 'cadetblue', 'cornsilk', 'floralwhite', 'gainsboro',
    'ghostwhite', 'honeydew', 'ivory', 'khaki', 'darkkhaki',
    'linen', 'mintcream', 'mistyrose', 'moccasin', 'navajowhite',
    'oldlace', 'papayawhip', 'peachpuff', 'rosybrown', 'sandybrown',
    'seashell', 'snow', 'whitesmoke',
    'skyblue', 'deepskyblue', 'lightskyblue', 'lightsteelblue',
    'powderblue', 'aquamarine', 'turquoise', 'mediumturquoise',
    'darkturquoise', 'lightseagreen', 'darkcyan',
    'salmon', 'lightsalmon', 'darksalmon',
    'goldenrod', 'darkgoldenrod', 'palegoldenrod',
    'lemonchiffon', 'lightgoldenrodyellow',
  ]);

  return namedColors.has(token.toLowerCase());
}

/**
 * Parse a single CSS box-shadow entry into a BoxShadowOptions object.
 *
 * Syntax: [inset] <offset-x> <offset-y> [<blur-radius> [<spread-radius>]] [<color>]
 * The `inset` keyword and color can appear at the start or end.
 */
function parseSingleShadow(raw: string): BoxShadowOptions {
  const tokens = tokenize(raw.trim());

  let inset = false;
  let color: string | undefined;
  const numbers: number[] = [];

  for (const token of tokens) {
    if (token.toLowerCase() === 'inset') {
      inset = true;
      continue;
    }

    if (isNumericToken(token)) {
      numbers.push(parseNumeric(token));
      continue;
    }

    if (isColorToken(token)) {
      color = token;
      continue;
    }

    // Unknown token — try to parse as color anyway (for edge cases)
    color = token;
  }

  // CSS spec: offset-x offset-y [blur [spread]]
  const offsetX = numbers[0] ?? 0;
  const offsetY = numbers[1] ?? 0;
  const blur = Math.max(0, numbers[2] ?? 0);
  const spread = numbers[3] ?? 0;

  // Parse alpha from color if it's rgba/hsla, otherwise default to 1
  let alpha = 1;
  let resolvedColor: string = color ?? 'rgba(0,0,0,1)';

  // Extract alpha from rgba() or hsla() for separate tracking
  const rgbaMatch = resolvedColor.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/);
  if (rgbaMatch && rgbaMatch[4] !== undefined) {
    alpha = parseFloat(rgbaMatch[4]);
    resolvedColor = `rgb(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]})`;
  }

  const hslaMatch = resolvedColor.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+%?)\s*,\s*([\d.]+%?)\s*(?:,\s*([\d.]+))?\s*\)$/);
  if (hslaMatch && hslaMatch[4] !== undefined) {
    alpha = parseFloat(hslaMatch[4]);
    resolvedColor = `hsl(${hslaMatch[1]}, ${hslaMatch[2]}, ${hslaMatch[3]})`;
  }

  return {
    offsetX,
    offsetY,
    blur,
    spread,
    color: resolvedColor,
    alpha,
    inset,
  };
}

/**
 * Parse a CSS `box-shadow` property value into an array of BoxShadowOptions.
 *
 * Supports all standard CSS box-shadow features:
 * - Multiple comma-separated shadows
 * - `inset` keyword
 * - Offset, blur, spread values with px/em units
 * - Named colors, hex, rgb(), rgba(), hsl(), hsla()
 *
 * @param css - The CSS box-shadow string to parse.
 * @returns Array of parsed shadow options. First = topmost (rendered last).
 */
export function parseBoxShadow(css: string): BoxShadowOptions[] {
  if (!css || css.trim() === 'none' || css.trim() === '') return [];

  const shadowStrings = splitShadows(css.trim());
  return shadowStrings.map(parseSingleShadow);
}
