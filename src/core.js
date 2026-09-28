/**
 * Catmull-Rom spline interpolation.
 *
 * Design decisions (stated plainly so callers know what they are getting):
 *
 * 1. Uniform parameterization. The t-parameter spacing between control
 *    points is constant (1.0), regardless of geometric distance. Centripetal
 *    and chordal variants reduce self-intersection on unevenly spaced points
 *    but introduce a square-root per segment and a non-obvious mapping
 *    between the input t and the per-segment t. Uniform is the textbook
 *    definition and the easiest to reason about; we pick it and say so.
 *
 * 2. Boundary handling: the curve is only defined between the second and
 *    second-to-last control points (the standard Catmull-Rom span). We do
 *    NOT extrapolate phantom endpoints. If you want the curve to reach the
 *    first/last point, duplicate them in your input. This keeps the behavior
 *    predictable and avoids inventing tangents.
 *
 * 3. catmullRomPoint evaluates a single t in [0, 1] across the full span of
 *    the provided control points (t=0 -> p1, t=1 -> p[n-2]). catmullRomSpline
 *    samples that span into numSamples points.
 *
 * 4. Points are plain number arrays of any equal dimension. We do not
 *    validate dimension equality on every call (hot path); mismatched
 *    dimensions produce NaN, which is the caller's bug to fix.
 */

/**
 * Evaluate the uniform Catmull-Rom basis for a single segment at local t.
 *
 * Given four control points p0, p1, p2, p3, the curve segment from p1 to p2
 * at local parameter t in [0, 1] is:
 *
 *   q(t) = 0.5 * ((2*p1) +
 *                (-p0 + p2) * t +
 *                (2*p0 - 5*p1 + 4*p2 - p3) * t^2 +
 *                (-p0 + 3*p1 - 3*p2 + p3) * t^3)
 *
 * This is the standard matrix form. The 0.5 factor comes from the basis
 * function coefficients; it is not a tunable tension parameter here.
 *
 * @param {number[]} p0 - Previous control point (influences tangent at p1).
 * @param {number[]} p1 - Segment start.
 * @param {number[]} p2 - Segment end.
 * @param {number[]} p3 - Next control point (influences tangent at p2).
 * @param {number} t - Local parameter in [0, 1].
 * @returns {number[]} Interpolated point, same dimension as inputs.
 */
export function catmullRomSegment(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  const dim = p1.length;
  const out = new Array(dim);
  for (let i = 0; i < dim; i++) {
    const a0 = p0[i];
    const a1 = p1[i];
    const a2 = p2[i];
    const a3 = p3[i];
    out[i] = 0.5 * (
      2 * a1 +
      (-a0 + a2) * t +
      (2 * a0 - 5 * a1 + 4 * a2 - a3) * t2 +
      (-a0 + 3 * a1 - 3 * a2 + a3) * t3
    );
  }
  return out;
}

/**
 * Evaluate the Catmull-Rom spline at a global parameter t in [0, 1].
 *
 * t=0 returns points[1], t=1 returns points[points.length - 2]. The valid
 * span is the interior of the control polygon; the first and last points
 * only contribute tangents and are never returned as curve points.
 *
 * Requires at least 4 control points. With fewer, there is no full segment
 * to evaluate and we throw rather than silently degrade.
 *
 * t is clamped to [0, 1] so callers do not need to sanitize. Values outside
 * this range would extrapolate along the end tangents, which is a different
 * feature and not provided here.
 *
 * @param {number[][]} points - Control points (at least 4, equal dimension).
 * @param {number} t - Global parameter in [0, 1].
 * @returns {number[]} Interpolated point.
 */
export function catmullRomPoint(points, t) {
  if (!Array.isArray(points) || points.length < 4) {
    throw new Error('catmullRomPoint requires at least 4 control points');
  }
  if (typeof t !== 'number' || Number.isNaN(t)) {
    throw new Error('t must be a finite number');
  }
  // Clamp rather than reject: the common caller mistake is passing 1.0000001
  // from a loop accumulator, and clamping gives a clean endpoint.
  const tc = t < 0 ? 0 : t > 1 ? 1 : t;

  const n = points.length;
  // Number of full segments: n - 3 (segments use 4 consecutive points).
  const numSegments = n - 3;
  const scaled = tc * numSegments;
  let seg = Math.floor(scaled);
  // At t=1, floor(numSegments) == numSegments which is out of range; pin to
  // the last segment and evaluate at local t=1.
  if (seg >= numSegments) {
    seg = numSegments - 1;
  }
  const localT = scaled - seg;

  const p0 = points[seg];
    const p1 = points[seg + 1];
  const p2 = points[seg + 2];
  const p3 = points[seg + 3];
  return catmullRomSegment(p0, p1, p2, p3, localT);
}

/**
 * Sample the Catmull-Rom spline into numSamples points.
 *
 * The first sample is points[1] and the last is points[n-2], matching the
 * valid span. Samples are evenly spaced in t, including both endpoints.
 *
 * numSamples must be an integer >= 2. We throw on 1 or 0 because a single
 * sample at t=0 is not a "spline sample" in any useful sense and silently
 * returning [points[1]] would mislead callers who expected a curve.
 *
 * @param {number[][]} points - Control points (at least 4).
 * @param {number} numSamples - Number of samples to produce (>= 2).
 * @returns {number[][]} Array of sampled points.
 */
export function catmullRomSpline(points, numSamples) {
  if (!Number.isInteger(numSamples) || numSamples < 2) {
    throw new Error('numSamples must be an integer >= 2');
  }
  const out = new Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    // i/(numSamples-1) gives exact 0 at i=0 and exact 1 at i=numSamples-1.
    const t = i / (numSamples - 1);
    out[i] = catmullRomPoint(points, t);
  }
  return out;
}

/**
 * Convenience: sample a spline and return an array of [t, point] pairs.
 *
 * Useful when the caller needs to know the parameter value of each sample,
 * e.g. for plotting or resampling at a target arc-length later. The t values
 * are the same global parameters passed to catmullRomPoint.
 *
 * @param {number[][]} points - Control points (at least 4).
 * @param {number} numSamples - Number of samples (>= 2).
 * @returns {Array<[number, number[]]>} Pairs of [t, point].
 */
export function sampleSpline(points, numSamples) {
  if (!Number.isInteger(numSamples) || numSamples < 2) {
    throw new Error('numSamples must be an integer >= 2');
  }
  const out = new Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / (numSamples - 1);
    out[i] = [t, catmullRomPoint(points, t)];
  }
  return out;
}
