# Catmull Rom Spline

Interpolates smooth curves through control points using the uniform Catmull-Rom basis. Pure ESM, zero dependencies.

## Usage

```js
import { catmullRomPoint, catmullRomSpline, sampleSpline } from 'catmull-rom-spline';

const points = [[0,0],[1,2],[2,2],[3,0]];

// Single evaluation at global t in [0, 1].
const mid = catmullRomPoint(points, 0.5);

// Evenly sampled curve, including both endpoints of the valid span.
const curve = catmullRomSpline(points, 20);

// Same thing, with the t value attached to each sample.
const tagged = sampleSpline(points, 20);
```

## Why this exists

The problem is drawing a smooth curve that passes through every control point, without the overshoot of a natural cubic spline or the endpoint constraints of a Bézier. Catmull-Rom gives C1 continuity and local control — moving one point only affects two segments.

The trade-off: this is **uniform** parameterization. Segments are spaced equally in t regardless of geometric distance. If your control points are unevenly spaced, the curve will appear to move faster through dense regions. Centripetal and chordal variants fix this but add a per-segment square-root and a non-trivial t-remap. Uniform is the textbook definition and the simplest to reason about, so that is what is here.

## The awkward edge

The curve only spans the **interior** of the control polygon. With `n` points, `catmullRomPoint` at t=0 returns `points[1]` and at t=1 returns `points[n-2]`. The first and last control points contribute tangents only and are never returned as curve points. If you need the curve to start exactly at your first point, duplicate it as the second point in the input.

Requires at least 4 control points. Fewer throws.

## Exports

- `catmullRomPoint(points, t)` — evaluate at global t in [0, 1]. Clamps out-of-range t.
- `catmullRomSpline(points, numSamples)` — sample into `numSamples` points (integer >= 2).
- `sampleSpline(points, numSamples)` — same, but returns `[t, point]` pairs.

## Design notes

The window stores values eagerly rather than keeping running aggregates. Running
sums drift with floating point over long streams, and recomputing from a small
buffer is cheap enough that the drift is not worth the speed.

## Performance

The window keeps a bounded buffer, so `push` is constant time and memory does not
grow with the length of the stream. `peak` and `trough` are linear in the window
size, which is the trade that keeps `push` cheap.

