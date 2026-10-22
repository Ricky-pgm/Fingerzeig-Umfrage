// Neutral line pictograms for the hand shapes and motions. Pure data (SVG path strings, 48 x 48 box),
// so the same set renders in the page and can be checked in tests.
const fill = (d) => ({ d, fill: true });
const dot = (x, y, r) => fill(`M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0-${2 * r} 0`);
const ring = (x, y, r) => ({ d: `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0-${2 * r} 0` });

// A finger is a capsule outline of width w whose base sits at y = base.
const finger = (x, top, base = 25, w = 7) => ({ d: `M${x} ${base}V${top + w / 2}a${w / 2} ${w / 2} 0 0 1 ${w} 0V${base}` });
const turned = (part, angle, cx, cy) => ({ ...part, transform: `rotate(${angle} ${cx} ${cy})` });
const rounded = (x, y, w, h, r = 7) => ({ d: `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1-${r} ${r}h-${w - 2 * r}a${r} ${r} 0 0 1-${r}-${r}v-${h - 2 * r}a${r} ${r} 0 0 1 ${r}-${r}z` });

const PALM = rounded(10, 25, 28, 19, 8);
const FIST = rounded(10, 20, 28, 24, 8);
const FIST_DETAIL = { d: 'M17 20v8M24 20v8M31 20v8M13 36h16' };
const THUMB_UP = [rounded(14, 24, 24, 20, 7), finger(12, 6, 30, 7), { d: 'M22 31h16M22 37h16' }];

export const HAND_ICONS = {
  open_palm: [PALM, finger(10, 9), finger(17, 5), finger(24, 5), finger(31, 12), { d: 'M12 37l-8-9' }],
  fist: [FIST, FIST_DETAIL],
  point: [rounded(10, 24, 28, 20, 8), finger(10, 4, 24), { d: 'M24 24v4M31 24v4M13 36h16' }],
  thumb_up: THUMB_UP,
  thumb_down: THUMB_UP.map((part) => turned(part, 180, 24, 25)),
  victory: [
    rounded(10, 27, 28, 17, 8),
    turned(finger(11, 5, 27), -12, 14.5, 27),
    turned(finger(23, 5, 27), 12, 26.5, 27),
    { d: 'M31 27v3M13 38h14' },
  ],
  pinch: [rounded(10, 27, 28, 17, 8), ring(19, 16, 7), { d: 'M19 23v4M26 27v3M32 27v3M13 38h14' }],
  other: [dot(12, 24, 2.5), dot(24, 24, 2.5), dot(36, 24, 2.5)],
};

export const MOTION_ICONS = {
  still: [ring(24, 24, 15), dot(24, 24, 4)],
  swipe_left: [{ d: 'M40 24H8M18 14L8 24l10 10' }],
  swipe_right: [{ d: 'M8 24h32M30 14l10 10-10 10' }],
  swipe_up: [{ d: 'M24 40V8M14 18L24 8l10 10' }],
  swipe_down: [{ d: 'M24 8v32M14 30l10 10 10-10' }],
  circle: [{ d: 'M36 13A16 16 0 1 0 40 26M40 14l-4-1-1 5' }],
  tap: [dot(24, 24, 3), ring(24, 24, 9), ring(24, 24, 16)],
  other: [dot(12, 24, 2.5), dot(24, 24, 2.5), dot(36, 24, 2.5)],
};
