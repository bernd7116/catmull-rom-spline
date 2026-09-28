import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catmullRomPoint, catmullRomSpline, sampleSpline } from '../src/index.js';

// Helper: compare floats with tolerance. Catmull-Rom coefficients are exact
// in binary at t=0, 0.5, 1 but not at arbitrary t, so we never use === on
// interpolated output.
function approxEqual(a, b, eps = 1e-9) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > eps) return false;
  }
  return true;
}

test('catmullRomPoint at t=0 returns the second control point', () => {
  const pts = [[0,0],[1,2],[2,2],[3,0]];
  const r = catmullRomPoint(pts, 0);
  assert.ok(approxEqual(r, [1,2]));
});

test('catmullRomPoint at t=1 returns the second-to-last control point', () => {
  const pts = [[0,0],[1,2],[2,2],[3,0]];
  const r = catmullRomPoint(pts, 1);
  assert.ok(approxEqual(r, [2,2]));
});

test('catmullRomPoint at segment midpoint matches direct segment formula', () => {
  // 4 points -> 1 segment. t=0.5 should equal the known Catmull-Rom value.
  const p0 = [0,0], p1 = [1,2], p2 = [2,2], p3 = [3,0];
  const t = 0.5;
  const t2 = t*t, t3 = t2*t;
  const expected = [
    0.5 * (2*p1[0] + (-p0[0]+p2[0])*t + (2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2 + (-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
    0.5 * (2*p1[1] + (-p0[1]+p2[1])*t + (2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2 + (-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)
  ];
  const r = catmullRomPoint([p0,p1,p2,p3], 0.5);
  assert.ok(approxEqual(r, expected));
});

test('catmullRomPoint clamps t above 1 to the last endpoint', () => {
  const pts = [[0,0],[1,2],[2,2],[3,0]];
  const r = catmullRomPoint(pts, 1.0001);
  assert.ok(approxEqual(r, [2,2]));
});

test('catmullRomPoint clamps t below 0 to the first endpoint', () => {
  const pts = [[0,0],[1,2],[2,2],[3,0]];
  const r = catmullRomPoint(pts, -0.5);
  assert.ok(approxEqual(r, [1,2]));
});

test('catmullRomPoint throws on fewer than 4 control points', () => {
  assert.throws(() => catmullRomPoint([[0,0],[1,1],[2,2]], 0.5), /at least 4/);
});

test('catmullRomPoint throws on NaN t', () => {
  const pts = [[0,0],[1,2],[2,2],[3,0]];
  assert.throws(() => catmullRomPoint(pts, NaN), /finite number/);
});

test('catmullRomPoint handles multi-segment spline at segment boundary', () => {
  // 5 points -> 2 segments. At t=0.5 we should be at the boundary point
  // points[2], which is the end of segment 0 and start of segment 1.
  const pts = [[0,0],[1,2],[2,2],[3,2],[4,0]];
  const r = catmullRomPoint(pts, 0.5);
  assert.ok(approxEqual(r, [2,2]));
});

test('catmullRomPoint works in 3D', () => {
  const pts = [[0,0,0],[1,1,1],[2,1,1],[3,0,0]];
  const r = catmullRomPoint(pts, 0);
  assert.ok(approxEqual(r, [1,1,1]));
});

test('catmullRomSpline returns numSamples points with exact endpoints', () => {
  const pts = [[0,0],[1,2],[2,2],[3,0]];
  const samples = catmullRomSpline(pts, 10);
  assert.equal(samples.length, 10);
  assert.ok(approxEqual(samples[0], [1,2]));
  assert.ok(approxEqual(samples[samples.length-1], [2,2]));
});

test('catmullRomSpline throws on numSamples < 2', () => {
  const pts = [[0,0],[1,2],[2,2],[3,0]];
  assert.throws(() => catmullRomSpline(pts, 1), /integer >= 2/);
});

test('catmullRomSpline throws on non-integer numSamples', () => {
  const pts = [[0,0],[1,2],[2,2],[3,0]];
  assert.throws(() => catmullRomSpline(pts, 2.5), /integer >= 2/);
});

test('sampleSpline returns [t, point] pairs with correct t values', () => {
  const pts = [[0,0],[1,2],[2,2],[3,0]];
  const pairs = sampleSpline(pts, 3);
  assert.equal(pairs.length, 3);
  assert.equal(pairs[0][0], 0);
  assert.equal(pairs[1][0], 0.5);
  assert.equal(pairs[2][0], 1);
  assert.ok(approxEqual(pairs[0][1], [1,2]));
  assert.ok(approxEqual(pairs[2][1], [2,2]));
});

test('catmullRomSpline is monotonic in x for a monotonic control polygon', () => {
  // When control x-coordinates are strictly increasing and the tangents do
  // not reverse, the uniform Catmull-Rom x(t) should be monotonic. This is
  // a property callers rely on for plotting.
  const pts = [[0,0],[1,1],[2,0],[3,1],[4,0]];
  const samples = catmullRomSpline(pts, 50);
  for (let i = 1; i < samples.length; i++) {
    assert.ok(samples[i][0] >= samples[i-1][0] - 1e-9,
      `x decreased at sample ${i}: ${samples[i-1][0]} -> ${samples[i][0]}`);
  }
});
