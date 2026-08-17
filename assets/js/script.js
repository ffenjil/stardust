/* ============================================
   Jil's Portfolio - Main JavaScript
   Author: Jil (ffenjil)

   This script handles:
   1. Animated space background (stars, planets, shooting stars)
   2. Lanyard API for real-time Discord & Spotify status
   3. Toast notifications
   4. Background music autoplay
   ============================================ */


// ============================================
// CANVAS SETUP - THE ANIMATED SPACE BACKGROUND
// ============================================

// Get the canvas element and its 2D drawing context
const canvas = document.getElementById('spaceCanvas');
const ctx = canvas.getContext('2d');

// Variables to store canvas size and our space objects
let width, height;
let stars = [];           // Array of all the twinkling stars
let shootingStars = [];   // Array of currently active shooting stars
let bgGradient = null;    // Cached background gradient (rebuilt on resize only)
let planetsPlaced = false;  // Have we done the initial spread across the screen?

const TAU = Math.PI * 2;

// I bake the planet textures at 2x and draw them down to size.
// Downscaling a supersampled image is basically free antialiasing,
// so the edges come out smooth without any extra work per frame.
const SS = 2;

// Where the sun is. It's off-screen up and to the left, tilted slightly
// toward the viewer so we see a decent crescent instead of a flat disc.
// Remember canvas Y points DOWN, so negative Y means "up".
const LIGHT = (() => {
    const v = [-0.55, -0.58, 0.60];
    const len = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / len, v[1] / len, v[2] / len];
})();


// ============================================
// PROCEDURAL NOISE
//
// This is what gives the planets actual surfaces
// instead of a flat colour ramp. It's a tiny value
// noise implementation - no libraries, maybe 30
// lines, and it only ever runs once at startup.
// ============================================

// Deterministic hash - same inputs always give the same number back.
// Math.imul keeps the multiply in 32-bit territory so we don't lose
// precision the way a plain * would.
function hash2(x, y) {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// Value noise - hash the four surrounding grid corners and blend
// between them with a smoothstep curve so there are no hard seams.
function valueNoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;

    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);

    const a = hash2(xi, yi);
    const b = hash2(xi + 1, yi);
    const c = hash2(xi, yi + 1);
    const d = hash2(xi + 1, yi + 1);

    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

// Fractal brownian motion - stack several octaves of noise, each one
// half as strong and twice as detailed. This is what turns smooth blobs
// into something that reads as cloud bands or rocky terrain.
function fbm(x, y, octaves) {
    let total = 0, amp = 1, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
        total += valueNoise(x * freq, y * freq) * amp;
        norm += amp;
        amp *= 0.5;
        freq *= 2;
    }
    return total / norm;
}


// --------------------------------------------
// SMALL MATH HELPERS
// --------------------------------------------
function clamp01(v) {
    return v < 0 ? 0 : (v > 1 ? 1 : v);
}

function mix(a, b, t) {
    return a + (b - a) * t;
}

// Standard smoothstep. Works reversed too (edge0 > edge1) which is
// handy for fading something out instead of in.
function smoothstep(edge0, edge1, x) {
    const t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
}

function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}


// --------------------------------------------
// PLANET CONFIGURATION
// These are the planets that float across the
// background. Each has its own size, speed,
// and colors. They reset when they go off screen.
//
// 'surface' picks which procedural texture recipe
// to bake. 'type' just decides whether we need the
// extra ring drawing passes.
// --------------------------------------------
const planets = [
    {
        name: 'Saturn',
        type: 'ringed',           // Needs the ring passes
        surface: 'banded',        // Soft low-contrast cloud bands
        x: -100,                  // Start off-screen to the left
        y: 0,                     // Y position set in resize()
        size: 40,                 // Planet radius in pixels
        dx: 0.2,                  // Horizontal speed (pixels per frame)
        colors: ['#f0dcb4', '#a3835c'],  // Pale cream -> tan
        rim: '#ffeccb',           // Hazy atmosphere colour on the lit edge
        rimStrength: 0.30,
        ambient: 0.05,            // How lit the night side is
        // Ring geometry, as multiples of the planet radius
        ringInner: 1.26,
        ringOuter: 2.32,
        ringTilt: -0.38,          // Rotation of the whole ring system
        ringSquash: 0.30,         // How edge-on we're viewing it
        ringColors: ['#e8dcc2', '#8f7c5e']  // Icy outer edge -> dustier inner
    },
    {
        name: 'Mars',
        type: 'solid',
        surface: 'rocky',         // Mottled terrain, dark basins, polar caps
        x: -300,
        y: 0,
        size: 15,
        dx: 0.35,                 // Faster than Saturn
        colors: ['#d9603b', '#8c3a22'],  // Rust red
        rim: '#ffb08a',
        rimStrength: 0.14,        // Thin atmosphere, so barely any rim
        ambient: 0.04
    },
    {
        name: 'Jupiter',
        type: 'solid',
        surface: 'gas',           // Strong belts and zones + the Red Spot
        x: -600,
        y: 0,
        size: 55,                 // The biggest planet
        dx: 0.15,                 // Slowest moving
        colors: ['#e8cfa8', '#9c6a43'],  // Cream zones -> brown belts
        rim: '#ffe2b8',
        rimStrength: 0.34,
        ambient: 0.05
    },
    {
        name: 'Neptune',
        type: 'solid',
        surface: 'ice',           // Smooth deep blue with a faint storm
        x: -900,
        y: 0,
        size: 28,
        dx: 0.18,
        colors: ['#5b8fd6', '#1d3f7a'],  // Bright blue -> deep navy
        rim: '#bcdcff',
        rimStrength: 0.40,        // Thick hazy atmosphere
        ambient: 0.05
    }
];


// ============================================
// PLANET SURFACE RECIPES
//
// Given a point on the sphere (longitude/latitude
// in radians) this works out what colour the ground
// or cloud tops are there. No lighting yet - that
// gets applied on top in bakePlanet().
// ============================================
const scratchRgb = [0, 0, 0];

function surfaceColor(p, lon, lat, out) {
    const c0 = p._rgb0, c1 = p._rgb1;
    let t;

    if (p.surface === 'gas') {
        // JUPITER - squashing the longitude frequency way down and
        // cranking the latitude frequency up smears the noise sideways,
        // which is exactly how belts and zones look.
        const swirl = fbm(lon * 1.6 + 10, lat * 9.0, 4);
        const band = Math.sin(lat * 7.4 + swirl * 2.4);
        t = smoothstep(0.16, 0.84, clamp01(0.5 + 0.5 * band));

        // A little fine turbulence so the band edges aren't ruler-straight
        t = clamp01(t + (fbm(lon * 5.0 + 60, lat * 14.0, 3) - 0.5) * 0.22);

    } else if (p.surface === 'banded') {
        // SATURN - same idea as Jupiter but much gentler. Saturn's bands
        // are genuinely subtle compared to Jupiter's.
        const swirl = fbm(lon * 1.2 + 40, lat * 6.0, 3);
        const band = Math.sin(lat * 9.0 + swirl * 1.2);
        t = 0.30 + clamp01(0.5 + 0.5 * band) * 0.42;

    } else if (p.surface === 'rocky') {
        // MARS - high frequency mottling for the terrain...
        const n = fbm(lon * 3.4 + 70, lat * 3.4, 5);
        t = smoothstep(0.34, 0.72, n);

        // ...plus big dark regions, like Syrtis Major
        const basin = fbm(lon * 1.7 + 200, lat * 1.7 + 90, 3);
        t *= mix(1, 0.5, smoothstep(0.54, 0.80, basin));

    } else {
        // NEPTUNE - mostly smooth, with faint banding you have to look for
        const swirl = fbm(lon * 1.1 + 130, lat * 5.0, 3);
        const band = Math.sin(lat * 5.4 + swirl * 1.5);
        t = 0.28 + clamp01(0.5 + 0.5 * band) * 0.46;
    }

    out[0] = mix(c1[0], c0[0], t);
    out[1] = mix(c1[1], c0[1], t);
    out[2] = mix(c1[2], c0[2], t);

    // --- Per-planet extras that sit on top of the base colour ---

    if (p.surface === 'gas') {
        // The Great Red Spot. It's an oval, and it sits in Jupiter's
        // southern hemisphere.
        const sx = (lon - 0.42) / 0.36;
        const sy = (lat + 0.30) / 0.15;
        const d = Math.sqrt(sx * sx + sy * sy);
        if (d < 1.25) {
            const s = smoothstep(1.15, 0.3, d) * 0.85;
            out[0] = mix(out[0], 196, s);
            out[1] = mix(out[1], 104, s);
            out[2] = mix(out[2], 74, s);
        }
    }

    if (p.surface === 'rocky') {
        // Polar ice caps. Latitude maxes out at ±PI/2 (~1.571), so
        // anything past ~1.15 is close enough to the pole to freeze.
        const wobble = fbm(lon * 4.0 + 300, lat * 4.0, 3) * 0.22;
        const cap = smoothstep(1.13, 1.42, Math.abs(lat) + wobble);
        out[0] = mix(out[0], 236, cap);
        out[1] = mix(out[1], 240, cap);
        out[2] = mix(out[2], 245, cap);
    }

    if (p.surface === 'ice') {
        // Neptune's dark storm - same trick as the Red Spot, darker
        const sx = (lon + 0.38) / 0.30;
        const sy = (lat - 0.22) / 0.13;
        const d = Math.sqrt(sx * sx + sy * sy);
        if (d < 1.2) {
            const s = smoothstep(1.1, 0.35, d) * 0.6;
            out[0] = mix(out[0], 18, s);
            out[1] = mix(out[1], 38, s);
            out[2] = mix(out[2], 82, s);
        }
    }
}


// ============================================
// BAKING A PLANET
//
// This is the heart of it. We walk every pixel of
// a square, work out where on the sphere it lands,
// colour it, light it, and write it into an image.
//
// It runs ONCE per planet at startup. After that
// every frame is just a drawImage, which is far
// cheaper than what this used to do (rebuilding
// gradients 60 times a second).
// ============================================
function bakePlanet(p) {
    const R = Math.max(6, Math.round(p.size * SS));
    const D = R * 2;

    const cvs = document.createElement('canvas');
    cvs.width = D;
    cvs.height = D;
    const c = cvs.getContext('2d');

    const img = c.createImageData(D, D);
    const data = img.data;

    const amb = p.ambient;
    const rim = p._rimRgb;

    for (let py = 0; py < D; py++) {
        for (let px = 0; px < D; px++) {
            const i = (py * D + px) * 4;

            // Map the pixel into -1..1 across the disc
            const nx = (px + 0.5) / R - 1;
            const ny = (py + 0.5) / R - 1;
            const r2 = nx * nx + ny * ny;

            // Outside the circle - leave it fully transparent
            if (r2 >= 1) {
                data[i + 3] = 0;
                continue;
            }

            // Z component of the surface normal. Because the sphere is a
            // unit sphere, the normal and the position are the same thing.
            const nz = Math.sqrt(1 - r2);

            // Convert to sphere coordinates. This is the bit that actually
            // sells it as a ball: features bunch up toward the edges
            // instead of running flat off the side like a sticker.
            const lon = Math.atan2(nx, nz);
            const lat = Math.asin(ny < -1 ? -1 : (ny > 1 ? 1 : ny));

            surfaceColor(p, lon, lat, scratchRgb);

            // Lambert shading. Two separate jobs here, and it matters that
            // they stay separate:
            //   - 'shade' softens the day/night boundary into a gradual curve
            //   - 'lambert' keeps a real falloff ACROSS the lit face, so the
            //     brightest point is wherever the sun actually is
            // Smoothstepping straight to 1 does the first job but destroys the
            // second, which leaves the whole day side evenly lit and flat.
            const ndotl = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
            const lambert = ndotl > 0 ? ndotl : 0;
            const shade = smoothstep(-0.16, 0.16, ndotl);
            let intensity = amb + (1 - amb) * shade * (0.34 + 0.66 * Math.pow(lambert, 0.6));

            // Limb darkening - real spheres fall off toward the edge
            intensity *= 0.55 + 0.45 * Math.pow(nz, 0.45);

            let r = scratchRgb[0] * intensity;
            let g = scratchRgb[1] * intensity;
            let b = scratchRgb[2] * intensity;

            // Atmospheric rim. Only on the lit limb - this is the thin
            // bright edge you see on real planet photos. It replaces the
            // old shadowBlur halo, which made them look like glowing orbs.
            const rimAmt = Math.pow(1 - nz, 3) * Math.max(ndotl, 0) * p.rimStrength * 255;
            r += rim[0] / 255 * rimAmt;
            g += rim[1] / 255 * rimAmt;
            b += rim[2] / 255 * rimAmt;

            data[i]     = r > 255 ? 255 : r;
            data[i + 1] = g > 255 ? 255 : g;
            data[i + 2] = b > 255 ? 255 : b;

            // Feather the very edge so the limb isn't a jagged staircase
            data[i + 3] = 255 * smoothstep(0, 1.8 / R, 1 - Math.sqrt(r2));
        }
    }

    c.putImageData(img, 0, 0);
    return cvs;
}


// ============================================
// BAKING SATURN'S RINGS
//
// The ring gets drawn face-on here as a flat
// annulus, and then squashed vertically when we
// draw it. That way the texture is just a function
// of "how far out from the middle am I", which is
// how the real thing works anyway.
//
// Returns two canvases: the lit ring, and a pure
// black copy used for the shadow it casts on the
// planet.
// ============================================
function bakeRing(p) {
    const outer = Math.round(p.size * p.ringOuter * SS);
    const inner = p.size * p.ringInner * SS;
    const D = outer * 2;

    const cvs = document.createElement('canvas');
    cvs.width = D;
    cvs.height = D;
    const c = cvs.getContext('2d');

    const shadowCvs = document.createElement('canvas');
    shadowCvs.width = D;
    shadowCvs.height = D;
    const sc = shadowCvs.getContext('2d');

    const img = c.createImageData(D, D);
    const simg = sc.createImageData(D, D);
    const data = img.data;
    const sdata = simg.data;

    const c0 = p._ringRgb0, c1 = p._ringRgb1;

    for (let py = 0; py < D; py++) {
        for (let px = 0; px < D; px++) {
            const i = (py * D + px) * 4;

            const dx = px + 0.5 - outer;
            const dy = py + 0.5 - outer;
            const d = Math.hypot(dx, dy);

            if (d > outer || d < inner) {
                data[i + 3] = 0;
                sdata[i + 3] = 0;
                continue;
            }

            // How far across the ring band we are, 0 at the inner edge
            const t = (d - inner) / (outer - inner);

            // Fine ringlets. Saturn's rings are thousands of these.
            let dens = 0.55 + 0.45 * Math.sin(t * 42 + fbm(t * 9, 0.5, 3) * 5);

            // Larger scale density variation on top
            dens *= 0.40 + 0.80 * fbm(t * 5.5 + 3, 1.5, 4);

            // The Cassini Division - the one gap that's actually famous
            dens *= 1 - 0.94 * Math.exp(-Math.pow((t - 0.46) / 0.042, 2));

            // Fade both edges out so the ring doesn't just stop
            dens *= smoothstep(0, 0.05, t) * smoothstep(1, 0.88, t);

            // Slight graininess going around, so it isn't perfectly uniform
            const ang = Math.atan2(dy, dx);
            dens *= 0.84 + 0.16 * fbm(Math.cos(ang) * 7, Math.sin(ang) * 7 + t * 18, 2);

            dens = clamp01(dens);

            // Icier further out, dustier further in
            const shade = clamp01(0.35 + t * 0.65);
            data[i]     = mix(c1[0], c0[0], shade);
            data[i + 1] = mix(c1[1], c0[1], shade);
            data[i + 2] = mix(c1[2], c0[2], shade);
            data[i + 3] = dens * 235;

            // Shadow copy - same density, no colour
            sdata[i + 3] = dens * 255;
        }
    }

    c.putImageData(img, 0, 0);
    sc.putImageData(simg, 0, 0);

    return { ring: cvs, shadow: shadowCvs };
}


// --------------------------------------------
// BAKE EVERYTHING ONCE
// The textures only depend on each planet's size
// and colours, and those never change - so this
// does NOT need to re-run on resize.
// --------------------------------------------
function bakePlanets() {
    planets.forEach(p => {
        p._rgb0 = hexToRgb(p.colors[0]);
        p._rgb1 = hexToRgb(p.colors[1]);
        p._rimRgb = hexToRgb(p.rim);

        if (p.type === 'ringed') {
            p._ringRgb0 = hexToRgb(p.ringColors[0]);
            p._ringRgb1 = hexToRgb(p.ringColors[1]);
            const baked = bakeRing(p);
            p._ringTex = baked.ring;
            p._ringShadowTex = baked.shadow;
        }

        p._tex = bakePlanet(p);
    });
}


// ============================================
// DRAWING A PLANET
// ============================================

// The plain case - one blit, that's the whole thing
function drawPlanet(ctx, p) {
    const s = p.size;
    ctx.drawImage(p._tex, p.x - s, p.y - s, s * 2, s * 2);
}

// Saturn needs the ring split into a far half and a near half, with the
// planet sandwiched between them. Drawing the ring as one complete ellipse
// on top - which is what this used to do - makes it look like a hoop that
// was pasted on, because the far side never goes behind the planet.
function drawRingedPlanet(ctx, p) {
    const s = p.size;
    const ro = s * p.ringOuter;          // Ring outer radius on screen
    const rh = ro * p.ringSquash;        // Squashed vertical radius

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.ringTilt);

    // --- PASS 1: the whole ring. The planet gets drawn over it next,
    // so whatever should be hidden behind the planet gets covered up.
    ctx.drawImage(p._ringTex, -ro, -rh, ro * 2, rh * 2);

    // --- PASS 2: the planet body, back in un-rotated space
    ctx.save();
    ctx.rotate(-p.ringTilt);
    ctx.drawImage(p._tex, -s, -s, s * 2, s * 2);
    ctx.restore();

    // --- The shadow the rings cast across the planet. Clipped to the
    // disc, nudged to the side the sun isn't on.
    ctx.save();
    ctx.rotate(-p.ringTilt);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.985, 0, TAU);
    ctx.clip();
    ctx.rotate(p.ringTilt);
    ctx.globalAlpha = 0.5;
    ctx.translate(-LIGHT[0] * s * 0.18, -LIGHT[1] * s * 0.42);
    ctx.drawImage(p._ringShadowTex, -ro, -rh, ro * 2, rh * 2);
    ctx.restore();

    // --- PASS 3: the near half of the ring, now drawn OVER the planet.
    // Clipping to positive Y in ring space gives us the half nearest
    // the viewer, which is the half that should occlude.
    ctx.save();
    ctx.beginPath();
    ctx.rect(-ro, 0, ro * 2, rh + 1);
    ctx.clip();
    ctx.drawImage(p._ringTex, -ro, -rh, ro * 2, rh * 2);
    ctx.restore();

    ctx.restore();
}


// ============================================
// THE STAR FIELD
//
// Real night skies aren't a spray of identical
// white dots. Two things fix that: brightness
// follows a power law (loads of faint ones, a
// handful of bright ones), and stars have colour
// depending on how hot they are.
// ============================================

// Rough blackbody ramp, cool through to hot.
// Orange dwarfs -> sun-like white -> blue-white giants.
const STAR_COLORS = [
    [255, 188, 138],
    [255, 213, 176],
    [255, 238, 219],
    [255, 255, 255],
    [226, 235, 255],
    [193, 212, 255]
];

function starColor() {
    // Averaging three randoms gives a bell curve instead of a flat one,
    // so most stars land near white and strong colour is the exception.
    // That's how a real field reads - the colour is there, but subtle.
    const t = (Math.random() + Math.random() + Math.random()) / 3;
    const f = t * (STAR_COLORS.length - 1);
    const i = Math.min(STAR_COLORS.length - 2, Math.floor(f));
    const k = f - i;
    const a = STAR_COLORS[i], b = STAR_COLORS[i + 1];
    return 'rgb(' +
        Math.round(mix(a[0], b[0], k)) + ',' +
        Math.round(mix(a[1], b[1], k)) + ',' +
        Math.round(mix(a[2], b[2], k)) + ')';
}

// A soft white halo, baked once. Only the brightest stars get one.
// This is where glow actually belongs - stars emit light, planets don't.
const glowTex = (() => {
    const S = 32;
    const cvs = document.createElement('canvas');
    cvs.width = cvs.height = S * 2;
    const c = cvs.getContext('2d');
    const g = c.createRadialGradient(S, S, 0, S, S, S);
    g.addColorStop(0,    'rgba(255,255,255,0.50)');
    g.addColorStop(0.18, 'rgba(255,255,255,0.14)');
    g.addColorStop(1,    'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, S * 2, S * 2);
    return cvs;
})();


// --------------------------------------------
// STAR GENERATION
// Creates random stars across the entire canvas.
// --------------------------------------------
function initStars() {
    stars = [];

    // Roughly 1 star per 3200 square pixels
    const count = Math.floor((width * height) / 3200);

    for (let i = 0; i < count; i++) {
        // Power law brightness. Cubing a 0..1 random pushes almost
        // everything toward the dim end, leaving a few standouts -
        // which is the single biggest thing that made the old field
        // look like static rather than sky.
        const mag = Math.pow(Math.random(), 3);

        stars.push({
            x: Math.random() * width,
            y: Math.random() * height,
            mag: mag,
            size: 0.35 + mag * 1.75,
            css: starColor(),
            phase: Math.random() * TAU,
            // Dimmer stars flicker harder - big bright ones sit steadier
            twinkleAmt: 0.10 + (1 - mag) * 0.34,
            twinkleSpeed: 0.5 + Math.random() * 1.9,
            spike: mag > 0.86          // Only the top few get diffraction spikes
        });
    }
}


// --------------------------------------------
// STAR DRAWING
// Note we vary globalAlpha rather than building
// an rgba() string per star per frame. With ~500
// stars at 60fps that's 30k strings a second saved.
// --------------------------------------------
function drawStars(time) {
    for (let i = 0; i < stars.length; i++) {
        const s = stars[i];

        // Smooth sine twinkle on a per-star phase, instead of the old
        // sawtooth that flipped direction at the limits and made every
        // star pulse in the same mechanical way.
        const tw = 1 - s.twinkleAmt + s.twinkleAmt * Math.sin(time * s.twinkleSpeed + s.phase);
        const alpha = clamp01((0.22 + s.mag * 0.78) * tw);

        // Halo on the brightest stars
        if (s.spike) {
            const gr = s.size * 9;
            ctx.globalAlpha = alpha * 0.75;
            ctx.drawImage(glowTex, s.x - gr, s.y - gr, gr * 2, gr * 2);
        }

        ctx.globalAlpha = alpha;
        ctx.fillStyle = s.css;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, TAU);
        ctx.fill();

        // Diffraction spikes - the little cross you get on bright stars
        // through a real lens. Cheap, and it sells the whole thing.
        if (s.spike) {
            const len = s.size * 6.5 * tw;
            ctx.globalAlpha = alpha * 0.45;
            ctx.strokeStyle = s.css;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(s.x - len, s.y);
            ctx.lineTo(s.x + len, s.y);
            ctx.moveTo(s.x, s.y - len);
            ctx.lineTo(s.x, s.y + len);
            ctx.stroke();
        }
    }

    ctx.globalAlpha = 1;
}


// --------------------------------------------
// SHOOTING STAR CREATION
// Spawns a new shooting star from the top half
// of the screen. It flies diagonally down-right.
// --------------------------------------------
function createShootingStar() {
    const startX = Math.random() * width;
    const startY = Math.random() * (height / 2);  // Start in upper half only

    shootingStars.push({
        x: startX,
        y: startY,
        len: Math.random() * 80 + 50,     // Tail length (50-130 pixels)
        speed: Math.random() * 10 + 10,   // Speed (10-20 pixels/frame)
        angle: Math.PI / 4                // 45 degrees diagonal
    });
}


// --------------------------------------------
// RESIZE HANDLER
// Updates the canvas size, repositions planets and
// regenerates the star field.
//
// Planet textures are NOT rebuilt here - they only
// depend on size and colour, neither of which change.
// --------------------------------------------
function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    // Distribute planets at different heights
    planets[0].y = height * 0.2;   // Saturn near the top
    planets[1].y = height * 0.75;  // Mars lower down
    planets[2].y = height * 0.5;   // Jupiter in the middle
    planets[3].y = height * 0.85;  // Neptune near the bottom

    // Spread them across the screen the first time so there's something to
    // look at straight away. They used to all start off-screen left, and at
    // 0.15px a frame Jupiter took the best part of two minutes to drift in.
    if (!planetsPlaced) {
        planets[0].x = width * 0.17;
        planets[1].x = width * 0.63;
        planets[2].x = width * 0.81;
        planets[3].x = width * 0.38;
        planetsPlaced = true;
    }

    // Cache the background gradient. Building this every frame was
    // pure waste - it only ever changes when the window does.
    bgGradient = ctx.createRadialGradient(
        width / 2, height * 2, 0,
        width / 2, height / 2, height * 1.5
    );
    bgGradient.addColorStop(0, '#101225');  // Dark blue at center
    bgGradient.addColorStop(1, '#050505');  // Almost black at edges

    initStars();
}


// ============================================
// MAIN ANIMATION LOOP
// This runs ~60 times per second and redraws
// everything on the canvas.
// ============================================
function animate(now) {
    const time = now * 0.001;  // Seconds, for the twinkle phase

    // Background
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    drawStars(time);

    // Update and draw all planets
    planets.forEach(p => {
        // Move planet to the right
        p.x += p.dx;

        // If planet goes off right side, reset to left side
        if (p.x > width + p.size * 3) {
            p.x = -p.size * 3;
            // Random new Y position when it comes back
            p.y = Math.random() * (height * 0.8) + (height * 0.1);
        }

        if (p.type === 'ringed') {
            drawRingedPlanet(ctx, p);
        } else {
            drawPlanet(ctx, p);
        }
    });

    // --- SHOOTING STARS ---
    // Small chance (0.1%) to spawn a new shooting star each frame
    // Max 2 shooting stars at once to keep it rare and special
    if (Math.random() < 0.001 && shootingStars.length < 2) {
        createShootingStar();
    }

    // Draw and update each shooting star
    for (let i = shootingStars.length - 1; i >= 0; i--) {
        let s = shootingStars[i];

        // Move the shooting star
        s.x += s.speed * Math.cos(s.angle);
        s.y += s.speed * Math.sin(s.angle);

        // Calculate tail end position
        const tailX = s.x - s.len * Math.cos(s.angle);
        const tailY = s.y - s.len * Math.sin(s.angle);

        // Draw the tail with gradient (bright at head, fades to transparent)
        const grad = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
        grad.addColorStop(0, "rgba(255,255,255,1)");
        grad.addColorStop(1, "rgba(255,255,255,0)");

        ctx.beginPath();
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        // Remove shooting star if it went off screen
        if (s.x > width + s.len || s.y > height + s.len) {
            shootingStars.splice(i, 1);
        }
    }

    // Keep the animation going
    requestAnimationFrame(animate);
}


// --------------------------------------------
// START EVERYTHING
// Resize fires rapidly while you drag a window edge,
// so it's debounced - regenerating hundreds of stars
// on every single event was needless work.
// --------------------------------------------
let resizeTimer = null;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
});

bakePlanets();              // One-off texture bake
resize();                   // Initial setup
requestAnimationFrame(animate);


// ============================================
// UI HELPER FUNCTIONS
// ============================================

// Shows a toast notification at the bottom of the screen
function showToast(msg) {
    const t = document.getElementById('toast');
    document.getElementById('toast-message').innerText = msg;
    t.classList.add('show');

    // Hide after 3 seconds
    setTimeout(() => t.classList.remove('show'), 3000);
}

// Stellarium activity timer - counts how long I've been "using" it
let sec = 0, min = 0;
setInterval(() => {
    sec++;
    if (sec === 60) {
        sec = 0;
        min++;
    }
    document.getElementById('timer').innerText =
        `${min < 10 ? '0'+min : min}:${sec < 10 ? '0'+sec : sec} elapsed`;
}, 1000);


// ============================================
// LANYARD API - REAL-TIME DISCORD & SPOTIFY
//
// Lanyard is a free API that shows your Discord
// presence in real-time, including what you're
// listening to on Spotify!
//
// It uses WebSockets so updates happen instantly
// instead of polling every few seconds.
// ============================================

// Get references to all the Spotify/activity elements
const stellariumSection = document.getElementById('stellarium-section');
const spotifySection = document.getElementById('spotify-section');
const progressBar = document.getElementById('spotify-progress');
const timeDisplay = document.getElementById('spotify-current-time');
const totalTimeDisplay = document.getElementById('spotify-total-time');
const songTitle = document.getElementById('spotify-song');
const artistName = document.getElementById('spotify-artist');
const albumArt = document.getElementById('spotify-album-art');
const statusIndicator = document.querySelector('.status-indicator');

// Store Spotify playback data
let spotifyData = null;
let spotifyStartTime = 0;
let spotifyEndTime = 0;

// ========================================
// MY DISCORD USER ID
// Get yours from Discord Developer Mode
// (Settings > Advanced > Developer Mode)
// Then right-click yourself and "Copy ID"
// ========================================
const DISCORD_USER_ID = '1186375223583440967';


// --------------------------------------------
// LANYARD WEBSOCKET CONNECTION
// Connects to Lanyard and listens for updates
// to my Discord presence and Spotify status.
// --------------------------------------------
function connectLanyard() {
    // Safety check - don't connect if no ID set
    if (DISCORD_USER_ID === 'YOUR_DISCORD_USER_ID_HERE') {
        console.log('Lanyard: No Discord User ID set. Using demo mode.');
        return;
    }

    // Create WebSocket connection to Lanyard
    const ws = new WebSocket('wss://api.lanyard.rest/socket');

    ws.onopen = () => {
        console.log('Lanyard: Connected');
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // OP 1 = Hello - Lanyard wants us to subscribe
        if (data.op === 1) {
            // Tell Lanyard which user to track
            ws.send(JSON.stringify({
                op: 2,
                d: { subscribe_to_id: DISCORD_USER_ID }
            }));

            // Start heartbeat to keep connection alive
            setInterval(() => {
                ws.send(JSON.stringify({ op: 3 }));
            }, data.d.heartbeat_interval);
        }

        // OP 0 = Event - Lanyard is sending us presence data
        if (data.op === 0) {
            const presence = data.d;

            // Update Spotify card if listening
            handleSpotifyUpdate(presence.spotify);

            // Update the status indicator dot
            updateDiscordStatus(presence.discord_status);
        }
    };

    // If connection drops, try again in 5 seconds
    ws.onclose = () => {
        console.log('Lanyard: Disconnected. Reconnecting in 5s...');
        setTimeout(connectLanyard, 5000);
    };
}


// --------------------------------------------
// SPOTIFY UPDATE HANDLER
// Called whenever Lanyard sends new Spotify data.
// Shows/hides the Spotify card and updates info.
// --------------------------------------------
function handleSpotifyUpdate(spotify) {
    if (spotify) {
        // I'M LISTENING TO SPOTIFY!
        spotifyData = spotify;
        spotifyStartTime = spotify.timestamps.start;
        spotifyEndTime = spotify.timestamps.end;

        // Update the Spotify card UI
        songTitle.innerText = spotify.song;
        artistName.innerText = spotify.artist;
        albumArt.src = spotify.album_art_url;

        // Calculate and display total song length
        const totalMs = spotifyEndTime - spotifyStartTime;
        const totalSec = Math.floor(totalMs / 1000);
        const totalM = Math.floor(totalSec / 60);
        const totalS = totalSec % 60;
        totalTimeDisplay.innerText = `${totalM}:${totalS < 10 ? '0'+totalS : totalS}`;

        // Show Spotify card, hide Stellarium activity
        stellariumSection.style.display = 'none';
        spotifySection.style.display = 'block';
    } else {
        // NOT LISTENING - show Stellarium instead
        spotifyData = null;

        stellariumSection.style.display = 'block';
        spotifySection.style.display = 'none';
    }
}


// --------------------------------------------
// DISCORD STATUS UPDATE
// Updates the little colored dot on my avatar
// to show my current Discord status.
// --------------------------------------------
function updateDiscordStatus(status) {
    if (!statusIndicator) return;

    // Clear all previous status classes
    statusIndicator.classList.remove('online', 'idle', 'dnd', 'offline');

    // Add the new status class (defaults to offline if invalid)
    const validStatus = ['online', 'idle', 'dnd', 'offline'].includes(status) ? status : 'offline';
    statusIndicator.classList.add(validStatus);

    // Set tooltip text (capitalize first letter)
    statusIndicator.title = validStatus.charAt(0).toUpperCase() + validStatus.slice(1);
}


// --------------------------------------------
// SPOTIFY PROGRESS BAR UPDATE
// Runs every second to update the progress bar
// and current time display while listening.
// --------------------------------------------
function updateSpotifyProgress() {
    if (!spotifyData) return;  // Not listening, skip

    // Calculate how far into the song we are
    const now = Date.now();
    const elapsed = now - spotifyStartTime;
    const total = spotifyEndTime - spotifyStartTime;
    const percentage = Math.min((elapsed / total) * 100, 100);

    // Update the progress bar width
    if (progressBar) progressBar.style.width = `${percentage}%`;

    // Update the current time display (0:00 format)
    const elapsedSec = Math.floor(elapsed / 1000);
    const m = Math.floor(elapsedSec / 60);
    const s = elapsedSec % 60;
    if (timeDisplay) timeDisplay.innerText = `${m}:${s < 10 ? '0'+s : s}`;
}

// Update progress bar every second
setInterval(updateSpotifyProgress, 1000);

// Start the Lanyard connection!
connectLanyard();


// ============================================
// BACKGROUND MUSIC
// Plays bgm.mp3 automatically at 10% volume.
// If browser blocks autoplay, it waits for
// any click on the page to start playing.
// ============================================
const bgm = document.getElementById('bgm');

if (bgm) {
    bgm.volume = 0.1;  // 10% volume so it's not too loud

    // Try to autoplay
    bgm.play().catch(() => {
        // Browser blocked autoplay (most do now)
        // So we wait for user to click anywhere, then play
        const playOnce = () => {
            bgm.play();
            document.removeEventListener('click', playOnce);
        };
        document.addEventListener('click', playOnce);
    });
}
