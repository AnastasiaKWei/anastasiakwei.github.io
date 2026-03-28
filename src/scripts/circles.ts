/**
 * Kandinsky "Several Circles" (1926) — faithful interactive recreation.
 */

interface CircleDef {
  nx: number; ny: number; nr: number;
  color: string; opacity: number;
  /** Radial gradient halo: fades from color at circle edge to transparent */
  halo?: { spread: number; color: string; opacity: number };
  /** Black outline stroke (used in light mode instead of halo) */
  outline?: { width: number; opacity: number };
  /** Concentric inner rings */
  rings?: { nr: number; color: string; opacity: number }[];
  /** Small dots placed on this circle */
  dots?: { dx: number; dy: number; nr: number; color: string }[];
  /** Child circles that move with this one (e.g. black inside blue) */
  children?: { dx: number; dy: number; nr: number; color: string; opacity: number; outline?: { width: number; opacity: number } }[];
  /** Skip paint texture filter (for white/cream circle) */
  noTexture?: boolean;
}

interface Circle {
  x: number; y: number; r: number;
  vx: number; vy: number;
  el?: SVGGElement;
  isDragging?: boolean;
}

let haloIdCounter = 0;
const CLEAN_EDGES = true;

/** Saved circle positions/velocities — persists across page navigations */
let savedState: { x: number; y: number; vx: number; vy: number }[] | null = null;

const STORAGE_KEY = 'circle-state';

function saveToStorage(state: typeof savedState) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function loadFromStorage(): typeof savedState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) { sessionStorage.removeItem(STORAGE_KEY); return JSON.parse(raw); }
  } catch {}
  return null;
}

// ── Painting composition ──

const COMPOSITION: CircleDef[] = [
  // ═══ BIG BLUE + BLACK as one group (always rendered first = back layer) ═══
  {
    nx: 0.40, ny: 0.42, nr: 0.24,
    color: '#1a3a8a', opacity: 0.95,
    halo: { spread: 0.36, color: '#c0d0e8', opacity: 0.5 },
    children: [
      { dx: -0.03, dy: -0.06, nr: 0.18, color: '#050508', opacity: 1.0 },
    ],
  },

  // ═══ CIRCLES ON / OVERLAPPING THE BIG BLUE ═══
  // Mauve/lilac
  {
    nx: 0.50, ny: 0.30, nr: 0.038, color: '#9b7faa', opacity: 0.75,
    halo: { spread: 0.065, color: '#b898c8', opacity: 0.3 },
  },
  // Small pink near mauve
  {
    nx: 0.47, ny: 0.27, nr: 0.018, color: '#d4a0b0', opacity: 0.7,
    halo: { spread: 0.035, color: '#d4a0b0', opacity: 0.25 },
  },
  // Yellow-green
  {
    nx: 0.42, ny: 0.52, nr: 0.038, color: '#c8cc7a', opacity: 0.8,
    halo: { spread: 0.065, color: '#c8cc7a', opacity: 0.25 },
  },
  // Olive/dark yellow
  {
    nx: 0.47, ny: 0.56, nr: 0.042, color: '#b8a030', opacity: 0.85,
    halo: { spread: 0.07, color: '#c8b030', opacity: 0.25 },
  },
  // Ochre/yellow
  {
    nx: 0.50, ny: 0.58, nr: 0.035, color: '#d4a843', opacity: 0.9,
    halo: { spread: 0.065, color: '#e8a030', opacity: 0.35 },
  },
  // Light blue
  {
    nx: 0.44, ny: 0.61, nr: 0.045, color: '#8bb8d0', opacity: 0.7,
    halo: { spread: 0.075, color: '#6aa8d0', opacity: 0.28 },
  },
  // Lavender
  {
    nx: 0.41, ny: 0.58, nr: 0.035, color: '#b8a8c8', opacity: 0.65,
    halo: { spread: 0.06, color: '#b8a8c8', opacity: 0.22 },
  },
  // Medium blue (lower)
  {
    nx: 0.53, ny: 0.64, nr: 0.05, color: '#5a9ec4', opacity: 0.85,
    halo: { spread: 0.085, color: '#4a8eca', opacity: 0.35 },
  },
  // Second medium blue
  {
    nx: 0.48, ny: 0.67, nr: 0.04, color: '#6aaad0', opacity: 0.65,
    halo: { spread: 0.07, color: '#5090c0', opacity: 0.25 },
  },
  // Pink at bottom edge
  {
    nx: 0.53, ny: 0.57, nr: 0.028, color: '#e8a0a0', opacity: 0.8,
    halo: { spread: 0.05, color: '#e07060', opacity: 0.3 },
  },

  // ═══ PINK + BLACK overlay (off-center) with blue halo ═══
  {
    nx: 0.25, ny: 0.50, nr: 0.065,
    color: '#c76d77', opacity: 0.85,
    halo: { spread: 0.1, color: '#0442fe', opacity: 0.8 },
    children: [
      { dx: 0.01, dy: 0.008, nr: 0.032, color: '#0a0a0a', opacity: 0.92 },
    ],
  },

  // ═══ LOWER-LEFT CLUSTER ═══
  // Yellow
  {
    nx: 0.20, ny: 0.64, nr: 0.033, color: '#dcc840', opacity: 0.9,
    halo: { spread: 0.06, color: '#dcc840', opacity: 0.32 },
  },
  // Ochre/orange
  {
    nx: 0.23, ny: 0.66, nr: 0.03, color: '#c87830', opacity: 0.85,
    halo: { spread: 0.055, color: '#e08830', opacity: 0.28 },
  },
  // Pink
  {
    nx: 0.25, ny: 0.67, nr: 0.022, color: '#e0a0a0', opacity: 0.75,
    halo: { spread: 0.042, color: '#e0a0a0', opacity: 0.25 },
  },
  // Red
  {
    nx: 0.21, ny: 0.69, nr: 0.018, color: '#cc3030', opacity: 0.9,
    halo: { spread: 0.038, color: '#cc3030', opacity: 0.3 },
  },
  // Small bright blue
  {
    nx: 0.14, ny: 0.73, nr: 0.02, color: '#3088d0', opacity: 0.9,
    halo: { spread: 0.04, color: '#3088d0', opacity: 0.28 },
  },
  // Olive ring
  {
    nx: 0.12, ny: 0.78, nr: 0.012, color: '#606020', opacity: 0.65,
    rings: [{ nr: 0.007, color: '#303010', opacity: 0.5 }],
    halo: { spread: 0.025, color: '#808030', opacity: 0.2 },
  },

  // ═══ UPPER-LEFT ═══
  {
    nx: 0.18, ny: 0.28, nr: 0.032, color: '#e8a0a0', opacity: 0.8,
    halo: { spread: 0.058, color: '#e8a0a0', opacity: 0.28 },
  },
  {
    nx: 0.25, ny: 0.16, nr: 0.018, color: '#dcc840', opacity: 0.85,
    halo: { spread: 0.035, color: '#dcc840', opacity: 0.25 },
  },

  // ═══ RIGHT SIDE ═══
  // Teal
  {
    nx: 0.63, ny: 0.38, nr: 0.055, color: '#2a8a7a', opacity: 0.85,
    halo: { spread: 0.095, color: '#e08020', opacity: 0.3 },
  },
  // Orange near teal
  {
    nx: 0.68, ny: 0.30, nr: 0.013, color: '#e08020', opacity: 0.9,
    halo: { spread: 0.028, color: '#e08020', opacity: 0.28 },
  },
  // Yellow upper-right
  {
    nx: 0.70, ny: 0.26, nr: 0.028, color: '#dcc840', opacity: 0.9,
    halo: { spread: 0.055, color: '#dcc840', opacity: 0.3 },
  },
  // Red dot
  {
    nx: 0.86, ny: 0.30, nr: 0.012, color: '#cc3030', opacity: 0.9,
    halo: { spread: 0.026, color: '#cc3030', opacity: 0.28 },
  },

  // ═══ LOWER-RIGHT: White/cream circle (NO texture, disassembled) ═══
  {
    nx: 0.78, ny: 0.70, nr: 0.085,
    color: '#d8ccd0', opacity: 0.85,
    noTexture: true,
    halo: { spread: 0.13, color: '#8090b0', opacity: 0.28 },
    rings: [
      { nr: 0.06, color: '#c0b0c8', opacity: 0.45 },
    ],
  },
  // Former dots on cream — now independent circles
  { nx: 0.785, ny: 0.665, nr: 0.005, color: '#cc3030', opacity: 0.9 },
  {
    nx: 0.81, ny: 0.72, nr: 0.02, color: '#70b8d8', opacity: 0.85,
    halo: { spread: 0.04, color: '#70b8d8', opacity: 0.25 },
  },
  // Tan/gold overlapping
  {
    nx: 0.72, ny: 0.69, nr: 0.022, color: '#c0a060', opacity: 0.75,
    halo: { spread: 0.042, color: '#c0a060', opacity: 0.25 },
  },

  // ═══ SCATTERED ACCENT CIRCLES ═══
  {
    nx: 0.87, ny: 0.58, nr: 0.014, color: '#2040a0', opacity: 0.75,
    rings: [{ nr: 0.008, color: '#1a1a40', opacity: 0.6 }],
    halo: { spread: 0.03, color: '#3050b0', opacity: 0.25 },
  },
  {
    nx: 0.63, ny: 0.80, nr: 0.014, color: '#e08020', opacity: 0.9,
    halo: { spread: 0.03, color: '#e08020', opacity: 0.28 },
  },
  {
    nx: 0.78, ny: 0.84, nr: 0.011, color: '#dcc840', opacity: 0.8,
    halo: { spread: 0.025, color: '#dcc840', opacity: 0.25 },
  },
  {
    nx: 0.90, ny: 0.84, nr: 0.015, color: '#3068b0', opacity: 0.85,
    halo: { spread: 0.032, color: '#3068b0', opacity: 0.28 },
  },
  {
    nx: 0.84, ny: 0.80, nr: 0.011, color: '#cc3030', opacity: 0.85,
    halo: { spread: 0.025, color: '#cc3030', opacity: 0.25 },
  },
  {
    nx: 0.10, ny: 0.68, nr: 0.012, color: '#e8a0a0', opacity: 0.65,
    halo: { spread: 0.028, color: '#e8a0a0', opacity: 0.22 },
  },
];

/**
 * Light mode color map — palette extracted from "circles in a circle".
 * Palette (approx): #231F21, #57382D, #C33135, #207669, #826848,
 * #599E91, #8BAA98, #E2BB7F, #E2BBB1, #E0D0C1, #E8D8CB, #F1E2D5
 */
const LIGHT_COLOR_MAP: Record<string, string> = {
  '#1a3a8a': '#c49440',   // big blue → #c49440
  '#050508': '#de2c1a',   // black child → #de2c1a
  '#9b7faa': '#8BAA98',   // mauve → #8BAA98
  '#d4a0b0': '#E8D8CB',   // pink → #E8D8CB
  '#c8cc7a': '#8BAA98',   // yellow-green → #8BAA98
  '#b8a030': '#58503b',   // olive → #f8d359
  '#d4a843': '#E2BB7F',   // ochre → #E2BB7F
  '#8bb8d0': '#eea8b3',   // light blue → #eea8b3
  '#b8a8c8': '#f1b6ba',   // lavender → #f1b6ba
  '#5a9ec4': '#b03d60',   // medium blue → #b03d60
  '#6aaad0': '#8BAA98',   // second blue → #8BAA98
  '#e8a0a0': '#f8d359',   // pink → #f8d359
  '#c76d77': '#147566',   // rose → #147566
  '#0a0a0a': '#0c2430',   // black → #0c2430
  '#dcc840': '#E2BB7F',   // yellow → #E2BB7F
  '#c87830': '#ed6130',   // ochre/orange → #ed6130
  '#e0a0a0': '#ed6130',   // pink → #ed6130
  '#cc3030': '#C33135',   // red → #C33135
  '#3088d0': '#8e4562',   // bright blue → #8e4562
  '#606020': '#dd0713',   // olive ring → #dd0713
  '#303010': '#dd0713',   // dark olive → #dd0713
  '#2a8a7a': '#eea8b3',   // teal → #eea8b3
  '#e08020': '#C33135',   // orange → #C33135
  '#d8ccd0': '#E0D0C1',   // cream → #E0D0C1
  '#c0b0c8': '#E8D8CB',   // lilac ring → #E8D8CB
  '#70b8d8': '#8BAA98',   // cyan dot → #8BAA98
  '#c0a060': '#E2BB7F',   // tan → #E2BB7F
  '#2040a0': '#eea8b3',   // dark blue → #eea8b3
  '#3068b0': '#58503b',   // blue → #599E91
  '#1a1a40': '#f8d359',   // dark ring → #f8d359
};


/** Outline stroke widths — varies by circle size/importance */
const LIGHT_OUTLINE_WIDTHS: Record<string, number> = {
  '#1a3a8a': 4,     // big blue → thick
  '#050508': 4,     // black child
  '#c76d77': 2.5,     // rose/pink+black
  '#2a8a7a': 2.0,     // teal
  '#5a9ec4': 2.0,     // medium blue
  '#d8ccd0': 2.5,     // cream circle
  '#cc3030': 3,     // red (small)
  '#e08020': 1.2,     // orange (small)
};
const DEFAULT_OUTLINE_WIDTH = 1.5;

function remapForLight(def: CircleDef): CircleDef {
  const mapped = { ...def };
  mapped.color = LIGHT_COLOR_MAP[def.color] || def.color;
  // Cap opacity — watercolor feel
  mapped.opacity = Math.min(def.opacity, 0.75);
  // The two biggest circles (big blue nr=0.24, cream nr=0.085) get extra transparency
  if (def.nr >= 0.08) {
    mapped.opacity = Math.min(def.opacity, 0.55);
  }
  // Replace gradient halo with black outline stroke
  if (def.halo) {
    const outlineW = LIGHT_OUTLINE_WIDTHS[def.color] || DEFAULT_OUTLINE_WIDTH;
    let outlineOpacity = Math.min(def.opacity, 0.85);
    if (def.color === '#1a3a8a') outlineOpacity = 0.95;
    mapped.outline = { width: outlineW, opacity: outlineOpacity };
    mapped.halo = undefined;
  }
  if (def.children) {
    mapped.children = def.children.map(c => ({
      ...c,
      color: LIGHT_COLOR_MAP[c.color] || c.color,
      opacity: Math.min(c.opacity, 0.7),
      outline: def.color === '#1a3a8a' ? { width: 4.5, opacity: 0.95 } : undefined,
    }));
  }
  if (def.rings) {
    mapped.rings = def.rings.map(r => ({
      ...r,
      color: LIGHT_COLOR_MAP[r.color] || r.color,
      opacity: Math.min(r.opacity, 0.6),
    }));
  }
  return mapped;
}

function random(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function createCircles(w: number, h: number, isMobile: boolean, isLight: boolean): (Circle & { _def: CircleDef })[] {
  const s = Math.min(w, h);
  const speed = () => random(-0.12, 0.12);
  const rawDefs = isMobile ? COMPOSITION.slice(0, 20) : COMPOSITION;
  const defs = isLight ? rawDefs.map(remapForLight) : rawDefs;

  return defs.map((def, i) => {
    const r = def.nr * s * (isMobile ? 0.85 : 1);
    // Restore saved position/velocity if available
    if (savedState && savedState[i]) {
      const saved = savedState[i];
      return { x: saved.x, y: saved.y, r, vx: saved.vx, vy: saved.vy, isDragging: false, _def: def };
    }
    return { x: def.nx * w, y: def.ny * h, r, vx: speed(), vy: speed(), isDragging: false, _def: def };
  });
}

function createSVG(container: HTMLElement): SVGSVGElement {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" style="position:absolute;top:0;left:0;width:100%;height:100%">
    <defs>
      <!-- Brushstroke texture: clipped to circle alpha -->
      <filter id="paint-texture" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
        <feTurbulence type="turbulence" baseFrequency="0.025 0.012" numOctaves="3" seed="7" result="warp"/>
        <feDisplacementMap in="SourceGraphic" in2="warp" scale="4" xChannelSelector="R" yChannelSelector="G" result="warped"/>
        <feTurbulence type="fractalNoise" baseFrequency="1.5 0.8" numOctaves="5" stitchTiles="stitch" result="grain"/>
        <feColorMatrix type="saturate" values="0" in="grain" result="mono-grain"/>
        <feComposite in="mono-grain" in2="warped" operator="in" result="clipped-grain"/>
        <feBlend in="warped" in2="clipped-grain" mode="overlay"/>
      </filter>
    </defs>
  </svg>`;
  const svg = wrapper.querySelector('svg') as SVGSVGElement;
  container.appendChild(svg);
  return svg;
}

/** Create radial gradient for a halo: intense at center, fades to transparent */
function createHaloGradient(svg: SVGSVGElement, color: string, circleR: number, haloR: number): string {
  const id = `halo-grad-${haloIdCounter++}`;
  const defs = svg.querySelector('defs')!;
  const grad = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
  grad.setAttribute('id', id);
  grad.setAttribute('cx', '50%');
  grad.setAttribute('cy', '50%');
  grad.setAttribute('r', '50%');

  // Inner stop at the circle edge ratio
  const innerStop = circleR / haloR;

  const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop1.setAttribute('offset', String(Math.max(0, innerStop - 0.08)));
  stop1.setAttribute('stop-color', color);
  stop1.setAttribute('stop-opacity', '1');

  const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop2.setAttribute('offset', String(innerStop));
  stop2.setAttribute('stop-color', color);
  stop2.setAttribute('stop-opacity', '0.7');

  const stop3 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop3.setAttribute('offset', String(Math.min(1, innerStop + (1 - innerStop) * 0.5)));
  stop3.setAttribute('stop-color', color);
  stop3.setAttribute('stop-opacity', '0.25');

  const stop4 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop4.setAttribute('offset', '1');
  stop4.setAttribute('stop-color', color);
  stop4.setAttribute('stop-opacity', '0');

  grad.appendChild(stop1);
  grad.appendChild(stop2);
  grad.appendChild(stop3);
  grad.appendChild(stop4);
  defs.appendChild(grad);
  return id;
}

function renderCircles(svg: SVGSVGElement, circles: (Circle & { _def: CircleDef })[]) {
  const s = Math.min(window.innerWidth, window.innerHeight);

  circles.forEach((c) => {
    const def = c._def;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    // Halo as radial gradient (fades from circle edge outward) — dark mode
    if (def.halo) {
      const haloR = def.halo.spread * s;
      const gradId = createHaloGradient(svg, def.halo.color, c.r, haloR);
      const haloEl = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      haloEl.setAttribute('cx', '0');
      haloEl.setAttribute('cy', '0');
      haloEl.setAttribute('r', String(haloR));
      haloEl.setAttribute('fill', `url(#${gradId})`);
      haloEl.setAttribute('opacity', String(def.halo.opacity));
      g.appendChild(haloEl);
    }

    // Main circle
    const main = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    main.setAttribute('cx', '0');
    main.setAttribute('cy', '0');
    main.setAttribute('r', String(c.r));
    main.setAttribute('fill', def.color);
    main.setAttribute('opacity', String(def.opacity));
    // Black outline stroke — light mode (replaces halo)
    if (def.outline) {
      main.setAttribute('stroke', '#0b0b0b');
      main.setAttribute('stroke-width', String(def.outline.width));
      main.setAttribute('stroke-opacity', String(def.outline.opacity));
    }
    g.appendChild(main);

    // Children (e.g. black circle overlapping inside blue)
    if (def.children) {
      def.children.forEach((child) => {
        const childEl = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        childEl.setAttribute('cx', String(child.dx * s));
        childEl.setAttribute('cy', String(child.dy * s));
        childEl.setAttribute('r', String(child.nr * s));
        childEl.setAttribute('fill', child.color);
        childEl.setAttribute('opacity', String(child.opacity));
        if (child.outline) {
          childEl.setAttribute('stroke', '#0b0b0b');
          childEl.setAttribute('stroke-width', String(child.outline.width));
          childEl.setAttribute('stroke-opacity', String(child.outline.opacity));
        }
        g.appendChild(childEl);
      });
    }

    // Concentric rings
    if (def.rings) {
      def.rings.forEach((ring) => {
        const ringEl = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        ringEl.setAttribute('cx', '0');
        ringEl.setAttribute('cy', '0');
        ringEl.setAttribute('r', String(ring.nr * s));
        ringEl.setAttribute('fill', ring.color);
        ringEl.setAttribute('opacity', String(ring.opacity));
        g.appendChild(ringEl);
      });
    }

    // Dots on the circle
    if (def.dots) {
      def.dots.forEach((dot) => {
        const dotEl = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dotEl.setAttribute('cx', String(dot.dx * s));
        dotEl.setAttribute('cy', String(dot.dy * s));
        dotEl.setAttribute('r', String(dot.nr * s));
        dotEl.setAttribute('fill', dot.color);
        dotEl.setAttribute('opacity', '0.9');
        g.appendChild(dotEl);
      });
    }

    // Apply paint texture only if not opted out (disabled for clean edges)
    if (!def.noTexture && !CLEAN_EDGES) {
      g.setAttribute('filter', 'url(#paint-texture)');
    }

    g.setAttribute('transform', `translate(${c.x}, ${c.y})`);
    c.el = g;
    svg.appendChild(g);
  });
}

/** Add a CSS-based canvas texture overlay with randomized noise */
function addTextureOverlay(container: HTMLElement) {
  // Create a small canvas to generate random noise texture
  const texCanvas = document.createElement('canvas');
  texCanvas.width = 256;
  texCanvas.height = 256;
  const ctx = texCanvas.getContext('2d')!;

  // Draw randomized grain
  const imageData = ctx.createImageData(256, 256);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.random() * 40; // subtle grain intensity
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 25; // very low alpha — subtle
  }
  ctx.putImageData(imageData, 0, 0);

  // Create overlay div
  const overlay = document.createElement('div');
  overlay.className = 'canvas-texture-overlay';
  overlay.style.cssText = `
    position: absolute;
    top: 0; left: 0; width: 100%; height: 100%;
    pointer-events: none;
    background-image: url(${texCanvas.toDataURL()});
    background-repeat: repeat;
    mix-blend-mode: overlay;
    opacity: 0.6;
    z-index: 1;
  `;
  container.appendChild(overlay);
}

function animateCircles(circles: Circle[], w: number, h: number, running: { value: boolean }) {
  if (!running.value) return;

  circles.forEach((c) => {
    if (c.isDragging) return;

    c.vx += random(-0.005, 0.005);
    c.vy += random(-0.005, 0.005);

    const speed = Math.sqrt(c.vx * c.vx + c.vy * c.vy);
    const maxSpeed = 0.18;
    if (speed > maxSpeed) {
      c.vx *= maxSpeed / speed;
      c.vy *= maxSpeed / speed;
    }

    c.vx *= 0.9995;
    c.vy *= 0.9995;

    c.x += c.vx;
    c.y += c.vy;

    const margin = c.r * 0.3;
    if (c.x < -margin) { c.x = -margin; c.vx = Math.abs(c.vx) * 0.7; }
    if (c.x > w + margin) { c.x = w + margin; c.vx = -Math.abs(c.vx) * 0.7; }
    if (c.y < -margin) { c.y = -margin; c.vy = Math.abs(c.vy) * 0.7; }
    if (c.y > h + margin) { c.y = h + margin; c.vy = -Math.abs(c.vy) * 0.7; }

    if (c.el) {
      c.el.setAttribute('transform', `translate(${c.x}, ${c.y})`);
    }
  });

  requestAnimationFrame(() => animateCircles(circles, w, h, running));
}

function enableDrag(container: HTMLElement, circles: Circle[]) {
  let dragTarget: Circle | null = null;
  let offsetX = 0;
  let offsetY = 0;

  function getPos(e: MouseEvent | TouchEvent) {
    const rect = container.getBoundingClientRect();
    if ('touches' in e && e.touches.length > 0) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as MouseEvent).clientX - rect.left, y: (e as MouseEvent).clientY - rect.top };
  }

  function findCircle(px: number, py: number): Circle | null {
    for (let i = circles.length - 1; i >= 0; i--) {
      const c = circles[i];
      const dx = px - c.x;
      const dy = py - c.y;
      if (dx * dx + dy * dy <= c.r * c.r) return c;
    }
    return null;
  }

  function onStart(e: MouseEvent | TouchEvent) {
    const pos = getPos(e);
    dragTarget = findCircle(pos.x, pos.y);
    if (dragTarget) {
      dragTarget.isDragging = true;
      offsetX = pos.x - dragTarget.x;
      offsetY = pos.y - dragTarget.y;
      if (dragTarget.el) {
        dragTarget.el.style.cursor = 'grabbing';
        // Bring dragged circle to front, but keep big blue (index 0) in back
        dragTarget.el.parentNode?.appendChild(dragTarget.el);
        // Always push the big blue circle back to right after <defs>
        const blueEl = circles[0]?.el;
        if (blueEl && blueEl !== dragTarget.el) {
          const defs = blueEl.parentNode?.querySelector('defs');
          if (defs && defs.nextSibling !== blueEl) {
            blueEl.parentNode?.insertBefore(blueEl, defs.nextSibling);
          }
        }
      }
      e.preventDefault();
    }
  }

  function onMove(e: MouseEvent | TouchEvent) {
    if (!dragTarget) return;
    const pos = getPos(e);
    dragTarget.x = pos.x - offsetX;
    dragTarget.y = pos.y - offsetY;
    if (dragTarget.el) {
      dragTarget.el.setAttribute('transform', `translate(${dragTarget.x}, ${dragTarget.y})`);
    }
    e.preventDefault();
  }

  function onEnd() {
    if (dragTarget) {
      dragTarget.isDragging = false;
      dragTarget.vx = random(-0.08, 0.08);
      dragTarget.vy = random(-0.08, 0.08);
      if (dragTarget.el) dragTarget.el.style.cursor = 'grab';
      dragTarget = null;
    }
  }

  container.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);
  container.addEventListener('touchstart', onStart, { passive: false });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onEnd);

  circles.forEach((c) => {
    if (c.el) c.el.style.cursor = 'grab';
  });

  return () => {
    container.removeEventListener('mousedown', onStart);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onEnd);
    container.removeEventListener('touchstart', onStart);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend', onEnd);
  };
}

function listenForMotionToggle(running: { value: boolean }, circles: Circle[], w: number, h: number) {
  function onToggle(e: Event) {
    const paused = (e as CustomEvent).detail?.paused;
    running.value = !paused;
    if (running.value) animateCircles(circles, w, h, running);
  }
  window.addEventListener('toggle-motion', onToggle);
  return () => window.removeEventListener('toggle-motion', onToggle);
}

// ── Public API ──

let cleanup: (() => void) | null = null;

export function initCircles(container: HTMLElement, isHome: boolean) {
  if (cleanup) { cleanup(); cleanup = null; }

  container.innerHTML = '';
  haloIdCounter = 0;

  const w = window.innerWidth;
  const h = window.innerHeight;
  const isMobile = w < 768;

  // Restore from sessionStorage if module variable was cleared (full reload)
  if (!savedState) savedState = loadFromStorage();

  const svg = createSVG(container);
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const circles = createCircles(w, h, isMobile, isLight);
  savedState = null; // Clear after restoring
  renderCircles(svg, circles);

  // Add canvas grain texture overlay (option 4: randomized, not uniform)
  addTextureOverlay(container);

  const running = { value: true };
  animateCircles(circles, w, h, running);

  let cleanupDrag: (() => void) | null = null;
  if (isHome) {
    cleanupDrag = enableDrag(container, circles);
  }

  const cleanupMotion = listenForMotionToggle(running, circles, w, h);

  function onResize() {
    const nw = window.innerWidth;
    const nh = window.innerHeight;
    circles.forEach((c) => {
      if (c.x + c.r > nw) c.x = nw - c.r;
      if (c.y + c.r > nh) c.y = nh - c.r;
    });
  }

  window.addEventListener('resize', onResize);

  // Re-render circles when theme changes (swap color palette)
  function onThemeChanged() {
    // Save positions, then reinit with new colors
    savedState = circles.map((c) => ({ x: c.x, y: c.y, vx: c.vx, vy: c.vy }));
    saveToStorage(savedState);
    initCircles(container, isHome);
  }
  window.addEventListener('theme-changed', onThemeChanged);

  cleanup = () => {
    // Save circle positions before teardown
    savedState = circles.map((c) => ({ x: c.x, y: c.y, vx: c.vx, vy: c.vy }));
    saveToStorage(savedState);
    running.value = false;
    window.removeEventListener('resize', onResize);
    window.removeEventListener('theme-changed', onThemeChanged);
    cleanupDrag?.();
    cleanupMotion();
  };
}
