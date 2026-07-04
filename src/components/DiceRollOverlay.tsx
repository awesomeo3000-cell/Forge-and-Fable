"use client";

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

export type RollingDie = {
  id: string;
  sides: number;
  result: number;
  label: string;
  resultSummary?: string;
  resultDetail?: string;
  lingerMs?: number;
  fromLeft: boolean;
  startYPct: number;
  landXPct: number;
  landYPct: number;
  rotations: number;
  delayMs: number;
  onFinish?: (result: number) => void;
  /** True for the discarded d20 of an advantage/disadvantage roll — rendered
      dimmed so the kept die reads as the result. */
  dropped?: boolean;
};

const ROLL_ANIMATION_MS = 2800;
const DEFAULT_RESULT_LINGER_MS = 1800;

/* ── Die shapes ── */

/* Icosahedron rendered as 20 *actual* triangular faces positioned in
   real 3D space with CSS `matrix3d`, inside a `transform-style:
   preserve-3d` rig — a true volumetric d20, not a flat drawing of one.
   Each face div is a precomputed rigid transform (rotation + position)
   that places a flat equilateral triangle exactly where that face
   sits on a regular icosahedron, derived from the icosahedron's golden-
   ratio vertex coordinates. Brightness per face comes from a fixed
   "studio light" direction dotted with that face's outward normal, so
   the lit/shadowed facets read as real depth, not a flat texture. */

const D20_FACES: { matrix: number[]; brightness: number }[] = [
  { matrix: [-0.809, 0.5, -0.309, 0, 0.1103, 0.6455, 0.7558, 0, 0.5774, 0.5774, -0.5774, 0, -19.9722, -23.3838, 14.452, 1], brightness: 0.021 },
  { matrix: [-0.5, 0.309, 0.809, 0, 0.866, 0.1784, 0.4671, 0, 0, 0.9342, -0.3568, 0, -5.5202, -32.3157, 8.9318, 1], brightness: 0.145 },
  { matrix: [0.5, -0.309, 0.809, 0, 0.866, 0.1784, -0.4671, 0, 0, 0.9342, 0.3568, 0, -5.5202, -32.3157, -8.9318, 1], brightness: 0.424 },
  { matrix: [0.809, -0.5, -0.309, 0, 0.1103, 0.6455, -0.7558, 0, 0.5774, 0.5774, 0.5774, 0, -19.9722, -23.3838, -14.452, 1], brightness: 0.473 },
  { matrix: [0, 0, -1, 0, -0.3568, 0.9342, 0, 0, 0.9342, 0.3568, 0, 0, -28.904, -17.8637, 0, 1], brightness: 0.224 },
  { matrix: [-0.809, -0.5, 0.309, 0, -0.1103, 0.6455, 0.7558, 0, -0.5774, 0.5774, -0.5774, 0, 19.9722, -23.3838, 14.452, 1], brightness: 0.26 },
  { matrix: [-0.809, -0.5, -0.309, 0, -0.4671, 0.866, -0.1784, 0, 0.3568, 0, -0.9342, 0, -8.9318, -5.5202, 32.3157, 1], brightness: 0.06 },
  { matrix: [-0.309, -0.809, -0.5, 0, 0.1784, 0.4671, -0.866, 0, 0.9342, -0.3568, 0, 0, -32.3157, 8.9318, 5.5202, 1], brightness: 0.388 },
  { matrix: [0, -1, 0, 0, 0.9342, 0, -0.3568, 0, 0.3568, 0, 0.9342, 0, -17.8637, 0, -28.904, 1], brightness: 0.792 },
  { matrix: [-0.309, -0.809, 0.5, 0, 0.7558, 0.1103, 0.6455, 0, -0.5774, 0.5774, 0.5774, 0, 14.452, -19.9722, -23.3838, 1], brightness: 0.713 },
  { matrix: [0.809, -0.5, -0.309, 0, -0.1103, -0.6455, 0.7558, 0, -0.5774, -0.5774, -0.5774, 0, 19.9722, 23.3838, 14.452, 1], brightness: 0.527 },
  { matrix: [0.5, -0.309, 0.809, 0, -0.866, -0.1784, 0.4671, 0, 0, -0.9342, -0.3568, 0, 5.5202, 32.3157, 8.9318, 1], brightness: 0.576 },
  { matrix: [-0.5, 0.309, 0.809, 0, -0.866, -0.1784, -0.4671, 0, 0, -0.9342, 0.3568, 0, 5.5202, 32.3157, -8.9318, 1], brightness: 0.855 },
  { matrix: [-0.809, 0.5, -0.309, 0, -0.1103, -0.6455, -0.7558, 0, -0.5774, -0.5774, 0.5774, 0, 19.9722, 23.3838, -14.452, 1], brightness: 0.979 },
  { matrix: [0, 0, -1, 0, 0.3568, -0.9342, 0, 0, -0.9342, -0.3568, 0, 0, 28.904, 17.8637, 0, 1], brightness: 0.776 },
  { matrix: [0.809, 0.5, -0.309, 0, 0.4671, -0.866, -0.1784, 0, -0.3568, 0, -0.9342, 0, 8.9318, 5.5202, 32.3157, 1], brightness: 0.208 },
  { matrix: [0.809, 0.5, 0.309, 0, 0.1103, -0.6455, 0.7558, 0, 0.5774, -0.5774, -0.5774, 0, -19.9722, 23.3838, 14.452, 1], brightness: 0.287 },
  { matrix: [0.309, 0.809, 0.5, 0, -0.7558, -0.1103, 0.6455, 0, 0.5774, -0.5774, 0.5774, 0, -14.452, 19.9722, -23.3838, 1], brightness: 0.74 },
  { matrix: [0, 1, 0, 0, -0.9342, 0, -0.3568, 0, -0.3568, 0, 0.9342, 0, 17.8637, 0, -28.904, 1], brightness: 0.94 },
  { matrix: [0.309, 0.809, -0.5, 0, -0.1784, -0.4671, -0.866, 0, -0.9342, 0.3568, 0, 0, 32.3157, -8.9318, 5.5202, 1], brightness: 0.612 },
];

function dieFaceColor(brightness: number, baseRgb: [number, number, number]): string {
  const [r, g, b] = baseRgb;
  if (brightness > 0.5) {
    const amt = (brightness - 0.5) * 0.7;
    return `rgb(${Math.round(r + (255 - r) * amt)}, ${Math.round(g + (255 - g) * amt)}, ${Math.round(b + (255 - b) * amt)})`;
  }
  const amt = (0.5 - brightness) * 0.85;
  return `rgb(${Math.round(r * (1 - amt))}, ${Math.round(g * (1 - amt))}, ${Math.round(b * (1 - amt))})`;
}

const DIE_SHAPES = {
  4: {
    outer: "50,7 93,85 7,85",
    facets: ["50,32 74,72 26,72"],
    textX: 50, textY: 66, fontSize: 20,
  },
  6: {
    outer: "10,10 90,10 90,90 10,90",
    facets: ["22,22 78,22 78,78 22,78"],
    textX: 50, textY: 53, fontSize: 28,
  },
  8: {
    outer: "50,5 95,50 50,95 5,50",
    facets: ["50,24 76,50 50,76 24,50"],
    textX: 50, textY: 53, fontSize: 28,
  },
  10: {
    outer: "50,7 89,35 76,83 24,83 11,35",
    facets: ["50,24 73,42 65,68 35,68 27,42"],
    textX: 50, textY: 55, fontSize: 26,
  },
  12: {
    outer: "50,4 79,20 95,54 79,88 50,97 21,88 5,54 21,20",
    facets: ["50,20 72,32 80,55 72,78 50,84 28,78 20,55 28,32"],
    textX: 50, textY: 53, fontSize: 26,
  },
  // 20 has no flat DieShape — it's rendered as a real 3D object by <D20Object>.
};

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function dieColors(accentHex: string): Record<number, { fill: string; stroke: string; facetStroke: string; glow: string }> {
  const [r, g, b] = hexToRgb(accentHex);
  const brighten = (n: number) => Math.min(255, Math.round(n * 1.35));
  return {
    4:  { fill: `rgba(${r},${g},${b},0.88)`,  stroke: `rgba(${brighten(r)},${brighten(g)},${brighten(b)},0.75)`, facetStroke: `rgba(${brighten(r)},${brighten(g)},${brighten(b)},0.28)`, glow: `rgba(${r},${g},${b},0.55)` },
    6:  { fill: `rgba(${r},${g},${b},0.88)`,  stroke: `rgba(${brighten(r)},${brighten(g)},${brighten(b)},0.75)`, facetStroke: `rgba(${brighten(r)},${brighten(g)},${brighten(b)},0.22)`, glow: `rgba(${r},${g},${b},0.55)` },
    8:  { fill: `rgba(${r},${g},${b},0.88)`,  stroke: `rgba(${brighten(r)},${brighten(g)},${brighten(b)},0.75)`, facetStroke: `rgba(${brighten(r)},${brighten(g)},${brighten(b)},0.22)`, glow: `rgba(${r},${g},${b},0.55)` },
    10: { fill: `rgba(${r},${g},${b},0.88)`,  stroke: `rgba(${brighten(r)},${brighten(g)},${brighten(b)},0.75)`, facetStroke: `rgba(${brighten(r)},${brighten(g)},${brighten(b)},0.22)`, glow: `rgba(${r},${g},${b},0.55)` },
    12: { fill: `rgba(${r},${g},${b},0.88)`,  stroke: `rgba(${brighten(r)},${brighten(g)},${brighten(b)},0.75)`, facetStroke: `rgba(${brighten(r)},${brighten(g)},${brighten(b)},0.28)`, glow: `rgba(${r},${g},${b},0.55)` },
    20: { fill: `rgba(${r},${g},${b},0.92)`,  stroke: `rgba(${brighten(r)},${brighten(g)},${brighten(b)},0.85)`, facetStroke: `rgba(${brighten(r)},${brighten(g)},${brighten(b)},0.32)`, glow: `rgba(${r},${g},${b},0.65)` },
    100: { fill: `rgba(${r},${g},${b},0.88)`, stroke: `rgba(${brighten(r)},${brighten(g)},${brighten(b)},0.75)`, facetStroke: `rgba(${brighten(r)},${brighten(g)},${brighten(b)},0.22)`, glow: `rgba(${r},${g},${b},0.55)` },
  };
}

function displayValue(sides: number, result: number): string {
  if (sides === 20 && result === 20) return "C";
  if (sides === 100) return result === 100 ? "00" : String(result).padStart(2, "0");
  return String(result);
}

/* ── d20: a real 3D object that physically settles on the rolled face ──

   The rig is rotated (via the Web Animations API) so the rolled number's
   actual face ends up pointing at the camera, upright. The spin starts
   fast and decelerates with a small overshoot/settle, so the die reads as
   a weighty object coming to rest — not a flat badge spinning forever. */

type Quat = [number, number, number, number]; // x, y, z, w
type Vec3 = [number, number, number];

function normalize3(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

/* Quaternion for a rotation matrix given its three columns. */
function quatFromColumns(cx: Vec3, cy: Vec3, cz: Vec3): Quat {
  const m00 = cx[0], m10 = cx[1], m20 = cx[2];
  const m01 = cy[0], m11 = cy[1], m21 = cy[2];
  const m02 = cz[0], m12 = cz[1], m22 = cz[2];
  const t = m00 + m11 + m22;
  let x: number, y: number, z: number, w: number;
  if (t > 0) {
    const s = 0.5 / Math.sqrt(t + 1);
    w = 0.25 / s; x = (m21 - m12) * s; y = (m02 - m20) * s; z = (m10 - m01) * s;
  } else if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    w = (m21 - m12) / s; x = 0.25 * s; y = (m01 + m10) / s; z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    w = (m02 - m20) / s; x = (m01 + m10) / s; y = 0.25 * s; z = (m12 + m21) / s;
  } else {
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
    w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = 0.25 * s;
  }
  return [x, y, z, w];
}

function quatAxisAngle(axis: Vec3, angle: number): Quat {
  const a = normalize3(axis);
  const h = angle / 2, s = Math.sin(h);
  return [a[0] * s, a[1] * s, a[2] * s, Math.cos(h)];
}

function quatMul(q: Quat, r: Quat): Quat {
  const [qx, qy, qz, qw] = q;
  const [rx, ry, rz, rw] = r;
  return [
    qw * rx + qx * rw + qy * rz - qz * ry,
    qw * ry - qx * rz + qy * rw + qz * rx,
    qw * rz + qx * ry - qy * rx + qz * rw,
    qw * rw - qx * rx - qy * ry - qz * rz,
  ];
}

function matrix3dFromQuat(q: Quat): string {
  let [x, y, z, w] = q;
  const len = Math.hypot(x, y, z, w) || 1;
  x /= len; y /= len; z /= len; w /= len;
  const m00 = 1 - 2 * (y * y + z * z), m01 = 2 * (x * y - z * w), m02 = 2 * (x * z + y * w);
  const m10 = 2 * (x * y + z * w), m11 = 1 - 2 * (x * x + z * z), m12 = 2 * (y * z - x * w);
  const m20 = 2 * (x * z - y * w), m21 = 2 * (y * z + x * w), m22 = 1 - 2 * (x * x + y * y);
  // column-major
  const c = [m00, m10, m20, 0, m01, m11, m21, 0, m02, m12, m22, 0, 0, 0, 0, 1];
  return `matrix3d(${c.map((n) => n.toFixed(6)).join(",")})`;
}

/* Resting orientation that puts a given face flat toward the camera. */
function restQuatForFace(faceIndex: number): Quat {
  const m = D20_FACES[faceIndex].matrix;
  // R_rest = transpose of the face's rotation; its columns are the face's rows.
  return quatFromColumns(
    [m[0], m[4], m[8]],
    [m[1], m[5], m[9]],
    [m[2], m[6], m[10]],
  );
}

function restQuatForMatrix(m: number[]): Quat {
  return quatFromColumns(
    [m[0], m[4], m[8]],
    [m[1], m[5], m[9]],
    [m[2], m[6], m[10]],
  );
}

type MeshFace = {
  matrix: number[];
  brightness: number;
  clipPath: string;
  width: number;
  height: number;
  label: string;
};

function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function add3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale3(v: Vec3, scale: number): Vec3 {
  return [v[0] * scale, v[1] * scale, v[2] * scale];
}

function negate3(v: Vec3): Vec3 {
  return [-v[0], -v[1], -v[2]];
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

const STUDIO_LIGHT = normalize3([-0.36, -0.54, 0.76]);

function brightnessForNormal(normal: Vec3): number {
  return Math.max(0, Math.min(1, dot3(normalize3(normal), STUDIO_LIGHT) * 0.5 + 0.5));
}

function dieFaceIndex(sides: number, result: number, faceCount: number): number {
  if (sides === 100) {
    return Math.floor((result % 100) / 10);
  }
  return (((result - 1) % faceCount) + faceCount) % faceCount;
}

function inactiveFaceLabel(sides: number, index: number): string {
  if (sides === 100) return index === 0 ? "00" : String(index * 10).padStart(2, "0");
  return String(index + 1);
}

type MeshInput = {
  vertices: Vec3[];
  faces: number[][];
  className: string;
};

function average3(points: Vec3[]): Vec3 {
  return scale3(
    points.reduce((sum, point) => add3(sum, point), [0, 0, 0] as Vec3),
    1 / points.length,
  );
}

function scaleVerticesToRadius(vertices: Vec3[], radius: number): Vec3[] {
  const maxLen = Math.max(...vertices.map((vertex) => Math.hypot(vertex[0], vertex[1], vertex[2])));
  const scale = radius / (maxLen || 1);
  return vertices.map((vertex) => scale3(vertex, scale));
}

function orderFaceIndices(vertices: Vec3[], indices: number[], outwardNormal: Vec3): number[] {
  const points = indices.map((index) => vertices[index]);
  const center = average3(points);
  const normal = dot3(outwardNormal, center) < 0 ? negate3(outwardNormal) : outwardNormal;
  const xAxis = normalize3(sub3(points[0], center));
  const yAxis = normalize3(cross3(normal, xAxis));

  return [...indices].sort((a, b) => {
    const av = sub3(vertices[a], center);
    const bv = sub3(vertices[b], center);
    return Math.atan2(dot3(av, yAxis), dot3(av, xAxis)) - Math.atan2(dot3(bv, yAxis), dot3(bv, xAxis));
  });
}

function supportFaces(vertices: Vec3[], faceSize: number): number[][] {
  const faces = new Map<string, number[]>();
  const eps = 0.001;

  for (let i = 0; i < vertices.length - 2; i++) {
    for (let j = i + 1; j < vertices.length - 1; j++) {
      for (let k = j + 1; k < vertices.length; k++) {
        const raw = cross3(sub3(vertices[j], vertices[i]), sub3(vertices[k], vertices[i]));
        if (Math.hypot(raw[0], raw[1], raw[2]) < eps) continue;

        const baseNormal = normalize3(raw);
        for (const normal of [baseNormal, negate3(baseNormal)]) {
          const maxDot = Math.max(...vertices.map((vertex) => dot3(vertex, normal)));
          const ids = vertices
            .map((vertex, index) => ({ index, offset: Math.abs(maxDot - dot3(vertex, normal)) }))
            .filter((item) => item.offset < eps)
            .map((item) => item.index);

          if (ids.length !== faceSize) continue;

          const key = [...ids].sort((a, b) => a - b).join("-");
          if (!faces.has(key)) {
            faces.set(key, orderFaceIndices(vertices, ids, normal));
          }
        }
      }
    }
  }

  return [...faces.values()];
}

function facePlane(vertices: Vec3[], indices: number[]): { normal: Vec3; distance: number } {
  const points = indices.map((index) => vertices[index]);
  let normal = normalize3(cross3(sub3(points[1], points[0]), sub3(points[2], points[0])));
  const center = average3(points);

  if (dot3(normal, center) < 0) {
    normal = negate3(normal);
  }

  const distance = dot3(normal, points[0]);
  return distance < 0 ? { normal: negate3(normal), distance: -distance } : { normal, distance };
}

function faceFromIndices(vertices: Vec3[], indices: number[], label: string, upHint?: Vec3): MeshFace {
  let points = indices.map((index) => vertices[index]);
  let normal = normalize3(cross3(sub3(points[1], points[0]), sub3(points[2], points[0])));
  const center = average3(points);

  if (dot3(normal, center) < 0) {
    points = [...points].reverse();
    normal = negate3(normal);
  }

  // Text frame. By default the baseline follows an edge (fine for regular faces).
  // For kite faces (d10/d100) an edge is skew to the kite's axis, so the number
  // renders crooked — pass upHint (toward the kite's apex) to stand it upright.
  let xAxis: Vec3;
  let yAxis: Vec3;
  const projectedUp = upHint ? sub3(upHint, scale3(normal, dot3(upHint, normal))) : null;
  if (projectedUp && Math.hypot(projectedUp[0], projectedUp[1], projectedUp[2]) > 1e-6) {
    yAxis = normalize3(projectedUp);
    xAxis = normalize3(cross3(yAxis, normal)); // right-handed: xAxis × yAxis = normal
  } else {
    xAxis = normalize3(sub3(points[1], points[0]));
    yAxis = normalize3(cross3(normal, xAxis));
  }
  const projections = points.map((point) => [dot3(point, xAxis), dot3(point, yAxis)] as [number, number]);
  const minX = Math.min(...projections.map(([x]) => x));
  const maxX = Math.max(...projections.map(([x]) => x));
  const minY = Math.min(...projections.map(([, y]) => y));
  const maxY = Math.max(...projections.map(([, y]) => y));
  const pad = 0.35;
  const width = maxX - minX + pad * 2;
  const height = maxY - minY + pad * 2;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const planeOffset = dot3(normal, points[0]);
  const faceCenter = add3(
    add3(scale3(xAxis, centerX), scale3(yAxis, centerY)),
    scale3(normal, planeOffset),
  );
  const clipPath = `polygon(${projections
    .map(([x, y]) => `${(((x - minX + pad) / width) * 100).toFixed(3)}% ${(((y - minY + pad) / height) * 100).toFixed(3)}%`)
    .join(", ")})`;

  return {
    matrix: [
      xAxis[0], xAxis[1], xAxis[2], 0,
      yAxis[0], yAxis[1], yAxis[2], 0,
      normal[0], normal[1], normal[2], 0,
      faceCenter[0], faceCenter[1], faceCenter[2], 1,
    ],
    brightness: brightnessForNormal(normal),
    clipPath,
    width,
    height,
    label,
  };
}

function pentagonalTrapezohedron(radius: number): MeshInput {
  const count = 5;
  // Antiprism cap height. The die is the polar dual of this antiprism; taller
  // caps here push the dual's equator outward, giving the squat proportions of
  // a real d10 (height ≈ 1.1× width). At 0.46 the dual apexes shot out on Z and
  // the die rendered as a tall spike (height ≈ 2× width).
  const height = 0.8;
  const vertices: Vec3[] = [];

  for (let i = 0; i < count; i++) {
    vertices.push([Math.cos((i / count) * Math.PI * 2), Math.sin((i / count) * Math.PI * 2), -height]);
  }

  for (let i = 0; i < count; i++) {
    vertices.push([
      Math.cos(((i + 0.5) / count) * Math.PI * 2),
      Math.sin(((i + 0.5) / count) * Math.PI * 2),
      height,
    ]);
  }

  const antiprismFaces: number[][] = [
    Array.from({ length: count }, (_, i) => count - 1 - i),
    Array.from({ length: count }, (_, i) => count + i),
  ];

  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count;
    antiprismFaces.push([i, next, count + i]);
    antiprismFaces.push([count + i, next, count + next]);
  }

  const dualVertices = antiprismFaces.map((face) => {
    const { normal, distance } = facePlane(vertices, face);
    return scale3(normal, 1 / (distance || 1));
  });
  const dualFaces = vertices.map((vertex, vertexIndex) => {
    const adjacent = antiprismFaces
      .map((face, faceIndex) => (face.includes(vertexIndex) ? faceIndex : -1))
      .filter((faceIndex) => faceIndex >= 0);
    return orderFaceIndices(dualVertices, adjacent, normalize3(vertex));
  });

  return {
    vertices: scaleVerticesToRadius(dualVertices, radius),
    faces: dualFaces,
    className: "is-d10",
  };
}

function meshInputForDie(sides: number): MeshInput {
  const phi = (1 + Math.sqrt(5)) / 2;

  switch (sides) {
    case 4: {
      const vertices: Vec3[] = [
        [1, 1, 1],
        [-1, -1, 1],
        [-1, 1, -1],
        [1, -1, -1],
      ];
      return { vertices: scaleVerticesToRadius(vertices, 38), faces: supportFaces(vertices, 3), className: "is-d4" };
    }
    case 6: {
      const vertices: Vec3[] = [
        [-1, -1, -1],
        [1, -1, -1],
        [1, 1, -1],
        [-1, 1, -1],
        [-1, -1, 1],
        [1, -1, 1],
        [1, 1, 1],
        [-1, 1, 1],
      ];
      return { vertices: scaleVerticesToRadius(vertices, 42), faces: supportFaces(vertices, 4), className: "is-d6" };
    }
    case 8: {
      const vertices: Vec3[] = [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ];
      return { vertices: scaleVerticesToRadius(vertices, 40), faces: supportFaces(vertices, 3), className: "is-d8" };
    }
    case 10:
    case 100: {
      const input = pentagonalTrapezohedron(41);
      return { ...input, className: sides === 100 ? "is-d100" : "is-d10" };
    }
    case 12: {
      const vertices: Vec3[] = [
        [1, 1, 1],
        [1, 1, -1],
        [1, -1, 1],
        [1, -1, -1],
        [-1, 1, 1],
        [-1, 1, -1],
        [-1, -1, 1],
        [-1, -1, -1],
        [0, 1 / phi, phi],
        [0, 1 / phi, -phi],
        [0, -1 / phi, phi],
        [0, -1 / phi, -phi],
        [1 / phi, phi, 0],
        [1 / phi, -phi, 0],
        [-1 / phi, phi, 0],
        [-1 / phi, -phi, 0],
        [phi, 0, 1 / phi],
        [phi, 0, -1 / phi],
        [-phi, 0, 1 / phi],
        [-phi, 0, -1 / phi],
      ];
      return { vertices: scaleVerticesToRadius(vertices, 40), faces: supportFaces(vertices, 5), className: "is-d12" };
    }
    default:
      return meshInputForDie(8);
  }
}

function meshForDie(sides: number, result: number): { faces: MeshFace[]; upIndex: number; className: string } {
  const input = meshInputForDie(sides);
  const upIndex = dieFaceIndex(sides, result, input.faces.length);
  // d10/d100 kites: stand the number upright by pointing its top at the kite's
  // apex — the face vertex nearest a pole (max |z|).
  const kite = sides === 10 || sides === 100;

  return {
    className: input.className,
    upIndex,
    faces: input.faces.map((face, i) => {
      const label = i === upIndex ? displayValue(sides, result) : inactiveFaceLabel(sides, i);
      if (!kite) return faceFromIndices(input.vertices, face, label);
      const verts = face.map((idx) => input.vertices[idx]);
      const apex = verts.reduce((a, b) => (Math.abs(b[2]) > Math.abs(a[2]) ? b : a));
      const centroid = average3(verts);
      return faceFromIndices(input.vertices, face, label, sub3(apex, centroid));
    }),
  };
}

// ── Computation caches (avoid recalculating identical geometry/colours) ──

const meshCache = new Map<string, { faces: MeshFace[]; upIndex: number; className: string }>();
function getCachedMesh(sides: number, result: number) {
  const key = `${sides}-${result}`;
  let entry = meshCache.get(key);
  if (!entry) {
    entry = meshForDie(sides, result);
    meshCache.set(key, entry);
  }
  return entry;
}

const colorCache = new Map<string, Record<number, { fill: string; stroke: string; facetStroke: string; glow: string }>>();
function getCachedColors(accentHex: string) {
  let entry = colorCache.get(accentHex);
  if (!entry) {
    entry = dieColors(accentHex);
    colorCache.set(accentHex, entry);
  }
  return entry;
}

function tumbleFrames(rest: Quat): Keyframe[] {
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const s1 = Math.random() < 0.5 ? -1 : 1;
  const s2 = Math.random() < 0.5 ? -1 : 1;
  const axis1: Vec3 = [1, rnd(0.2, 0.5), rnd(0.1, 0.3)];
  const axis2: Vec3 = [rnd(0.1, 0.35), 1, rnd(0.3, 0.6)];
  const tau = Math.PI * 2;
  const phiMax = s1 * rnd(3, 4.5) * tau;
  const psiMax = s2 * rnd(2, 3.2) * tau;
  const c1 = 0.9, c3 = c1 + 1;
  const easeOutBack = (o: number) => 1 + c3 * Math.pow(o - 1, 3) + c1 * Math.pow(o - 1, 2);
  const frames: Keyframe[] = [];
  const steps = 20; // reduced from 60 — visually identical, much cheaper

  for (let i = 0; i <= steps; i++) {
    const o = i / steps;
    const k = 1 - easeOutBack(o);
    const spin = quatMul(quatAxisAngle(axis1, phiMax * k), quatAxisAngle(axis2, psiMax * k));
    frames.push({ transform: matrix3dFromQuat(quatMul(rest, spin)), offset: o, easing: "linear" });
  }

  return frames;
}

function PolyhedralDieObject({
  sides,
  result,
  delayMs,
  accentHex,
  fontStack,
}: {
  sides: number;
  result: number;
  delayMs: number;
  accentHex: string;
  fontStack: string;
}) {
  const baseRgb = hexToRgb(accentHex);
  const colors = getCachedColors(accentHex)[sides] ?? getCachedColors(accentHex)[sides === 100 ? 10 : 8];
  const rigRef = useRef<HTMLDivElement>(null);
  const mesh = useMemo(() => getCachedMesh(sides, result), [result, sides]);

  useLayoutEffect(() => {
    const rig = rigRef.current;
    if (!rig) return;

    const rest = restQuatForMatrix(mesh.faces[mesh.upIndex].matrix);
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      rig.style.transform = matrix3dFromQuat(rest);
      return;
    }

    const frames = tumbleFrames(rest);
    rig.style.transform = frames[0].transform as string;
    const anim = rig.animate(frames, {
      duration: 1500,
      delay: delayMs,
      fill: "forwards",
      easing: "linear",
    });
    return () => anim.cancel();
  }, [delayMs, mesh]);

  const style = {
    "--dnd-die-font": fontStack,
    "--dnd-die-fill": colors.fill,
    "--dnd-die-stroke": colors.stroke,
  } as React.CSSProperties;

  return (
    <div className={`dnd-die-stage ${mesh.className}`} style={style}>
      <div className="dnd-die-rig" ref={rigRef}>
        {mesh.faces.map((face, i) => {
          const isUp = i === mesh.upIndex;
          return (
            <div
              key={i}
              className={`dnd-die-face${isUp ? " is-up" : ""}`}
              style={{
                width: `${face.width}px`,
                height: `${face.height}px`,
                marginLeft: `${face.width / -2}px`,
                marginTop: `${face.height / -2}px`,
                clipPath: face.clipPath,
                transform: `matrix3d(${face.matrix.join(",")})`,
                ...(isUp ? null : { background: dieFaceColor(face.brightness, baseRgb) }),
              }}
            >
              {face.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function D20Object({
  result,
  isCrit,
  isFumble,
  delayMs,
  accentHex,
}: {
  result: number;
  isCrit: boolean;
  isFumble: boolean;
  delayMs: number;
  accentHex: string;
}) {
  const baseRgb = hexToRgb(accentHex);
  const rigRef = useRef<HTMLDivElement>(null);
  const upIndex = (((result - 1) % 20) + 20) % 20;

  useLayoutEffect(() => {
    const rig = rigRef.current;
    if (!rig) return;

    const rest = restQuatForFace(upIndex);
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      rig.style.transform = matrix3dFromQuat(rest);
      return;
    }

    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const s1 = Math.random() < 0.5 ? -1 : 1;
    const s2 = Math.random() < 0.5 ? -1 : 1;
    // Two tilted spin axes -> the apparent axis keeps changing (real tumble,
    // not a top spinning about one line).
    const axis1: Vec3 = [1, rnd(0.2, 0.5), rnd(0.1, 0.3)];
    const axis2: Vec3 = [rnd(0.1, 0.35), 1, rnd(0.3, 0.6)];
    const TAU = Math.PI * 2;
    const phiMax = s1 * rnd(3, 4.5) * TAU;
    const psiMax = s2 * rnd(2, 3.2) * TAU;

    // easeOutBack: decelerates and overshoots the rest slightly, then settles
    // back exactly to it — that overshoot is the "weight" of the die landing.
    const c1 = 0.9, c3 = c1 + 1;
    const easeOutBack = (o: number) =>
      1 + c3 * Math.pow(o - 1, 3) + c1 * Math.pow(o - 1, 2);

    const N = 20; // reduced from 60 — visually identical
    const frames: Keyframe[] = [];
    for (let i = 0; i <= N; i++) {
      const o = i / N;
      const k = 1 - easeOutBack(o); // spin remaining: 1 -> ~0 (with tiny overshoot)
      const spin = quatMul(quatAxisAngle(axis1, phiMax * k), quatAxisAngle(axis2, psiMax * k));
      const q = quatMul(rest, spin);
      frames.push({ transform: matrix3dFromQuat(q), offset: o, easing: "linear" });
    }

    // Paint the first frame immediately so there's no untransformed flash.
    rig.style.transform = frames[0].transform as string;
    const anim = rig.animate(frames, {
      duration: 1500,
      delay: delayMs,
      fill: "forwards",
      easing: "linear",
    });
    return () => anim.cancel();
  }, [upIndex, delayMs]);

  return (
    <div className="d20-stage">
      <div className="d20-rig" ref={rigRef}>
        {D20_FACES.map((face, i) => {
          const isUp = i === upIndex;
          return (
            <div
              key={i}
              className={`d20-face${isUp ? " is-up" : ""}${isUp && isCrit ? " is-crit" : ""}${isUp && isFumble ? " is-fumble" : ""}`}
              style={{
                transform: `matrix3d(${face.matrix.join(",")})`,
                ...(isUp ? null : { background: dieFaceColor(face.brightness, baseRgb) }),
              }}
            >
              {i + 1}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Crit / Fumble banners ── */

function ClarebearCrit({ delayMs }: { delayMs: number }) {
  const style = { "--crit-delay": `${delayMs}ms` } as React.CSSProperties;
  return (
    <div className="crit-banner" style={style} aria-live="assertive">
      <span className="crit-text">HOLY SHIT</span>
    </div>
  );
}

function FumbleBanner({ delayMs }: { delayMs: number }) {
  const style = { "--crit-delay": `${delayMs}ms` } as React.CSSProperties;
  return (
    <div className="fumble-banner" style={style} aria-live="assertive">
      <span className="fumble-text">FUMBLE</span>
    </div>
  );
}

/* ── Main overlay ── */

export default memo(function DiceRollOverlay({
  dice,
  onExpire,
  accentHex,
  fontStack,
}: {
  dice: RollingDie[];
  onExpire: (id: string) => void;
  accentHex?: string;
  fontStack?: string;
}) {
  const accent = accentHex ?? "#a23f29";
  const font = fontStack ?? "Georgia, 'Times New Roman', serif";
  const crits = dice.filter((d) => d.sides === 20 && d.result === 20 && !d.dropped);
  const fumbles = dice.filter((d) => d.sides === 20 && d.result === 1 && !d.dropped);

  if (dice.length === 0) return null;

  return (
    <div className="dice-fly-overlay" aria-hidden="true">
      {dice.map((die) => (
        <FlyingDie key={die.id} die={die} onExpire={onExpire} accentHex={accent} fontStack={font} />
      ))}
      {crits.map((die) => (
        <ClarebearCrit key={`crit-${die.id}`} delayMs={die.delayMs + 1680} />
      ))}
      {fumbles.map((die) => (
        <FumbleBanner key={`fumble-${die.id}`} delayMs={die.delayMs + 1680} />
      ))}
    </div>
  );
})

/* ── Single animated die ── */

function FlyingDie({ die, onExpire, accentHex, fontStack }: { die: RollingDie; onExpire: (id: string) => void; accentHex: string; fontStack: string }) {
  const [visible, setVisible] = useState(true);
  const finishMs = ROLL_ANIMATION_MS + die.delayMs + 100;
  const expireMs = finishMs + (die.lingerMs ?? DEFAULT_RESULT_LINGER_MS);

  useEffect(() => {
    const finishTimer = setTimeout(() => {
      die.onFinish?.(die.result);
    }, finishMs);
    const expireTimer = setTimeout(() => {
      setVisible(false);
      onExpire(die.id);
    }, expireMs);
    return () => {
      clearTimeout(finishTimer);
      clearTimeout(expireTimer);
    };
  }, [die, expireMs, finishMs, onExpire]);

  if (!visible) return null;

  const colors = getCachedColors(accentHex)[die.sides] ?? getCachedColors(accentHex)[die.sides === 100 ? 10 : 8];
  const shape = DIE_SHAPES[die.sides as keyof typeof DIE_SHAPES] ?? DIE_SHAPES[8];
  const filterId = `glow-${die.id}`;
  const label = displayValue(die.sides, die.result);
  const isD20 = die.sides === 20;

  const style = {
    "--die-from-x": die.fromLeft ? "-120px" : "calc(100vw + 120px)",
    "--die-from-y": `${die.startYPct * 100}vh`,
    "--die-to-x":   `calc(${die.landXPct * 100}vw - 48px)`,
    "--die-to-y":   `calc(${die.landYPct * 100}vh - 48px)`,
    "--die-spin":   `${die.rotations}deg`,
    "--die-glow":   colors.glow,
    "--die-start-opacity": die.dropped ? "0.34" : "0.85",
    "--die-visible-opacity": die.dropped ? "0.42" : "1",
    animationDelay:    `${die.delayMs}ms`,
    animationDuration: `${ROLL_ANIMATION_MS}ms`,
  } as React.CSSProperties;

  const textStyle = {
    animationDelay: `${die.delayMs}ms`,
    animationDuration: `${ROLL_ANIMATION_MS}ms`,
  } as React.CSSProperties;

  if (!isD20) {
    return (
      <div className={`flying-die${die.dropped ? " dropped" : ""}`} style={style}>
        <PolyhedralDieObject
          sides={die.sides}
          result={die.result}
          delayMs={die.delayMs}
          accentHex={accentHex}
          fontStack={fontStack}
        />

        <RollResultLabel die={die} textStyle={textStyle} />
      </div>
    );
  }

  return (
    <div className={`flying-die${die.dropped ? " dropped" : ""}`} style={style}>
      {isD20 ? (
        <D20Object
          result={die.result}
          isCrit={die.result === 20}
          isFumble={die.result === 1}
          delayMs={die.delayMs}
          accentHex={accentHex}
        />
      ) : (
        <svg viewBox="0 0 100 100" width="100" height="100" aria-hidden="true">
          <defs>
            <filter id={filterId} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
              <feColorMatrix in="blur" type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 16 -5"
                result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Die face */}
          <polygon
            points={shape.outer}
            fill={colors.fill}
            stroke={colors.stroke}
            strokeWidth="2.8"
            strokeLinejoin="round"
            filter={`url(#${filterId})`}
          />

          {/* Facet / inner lines */}
          {shape.facets?.map((pts, i) => (
            <polygon
              key={i}
              points={pts}
              fill="none"
              stroke={colors.facetStroke}
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          ))}

          {/* Subtle top-highlight */}
          <polygon
            points={shape.outer}
            fill="rgba(255,255,255,0.10)"
            clipPath="inset(0 0 55% 0)"
            stroke="none"
          />

          {/* Result — fades in after landing */}
          <text
            x={shape.textX}
            y={shape.textY}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={label === "C" ? shape.fontSize + 4 : shape.fontSize}
            fontWeight="bold"
            fill={label === "C" ? "#ffd700" : "#fff4da"}
            fontFamily={fontStack}
            className="die-result-num"
            style={textStyle}
          >
            {label}
          </text>
        </svg>
      )}

      <RollResultLabel die={die} textStyle={textStyle} />
    </div>
  );
}

function RollResultLabel({ die, textStyle }: { die: RollingDie; textStyle: React.CSSProperties }) {
  return (
    <div className="die-roll-label" style={textStyle}>
      <span className="die-roll-label-main">
        <span className="die-roll-label-name">{die.label}</span>
        <span className="die-roll-label-die">d{die.sides}</span>
      </span>
      {die.resultSummary ? <span className="die-roll-label-total">{die.resultSummary}</span> : null}
      {die.resultDetail ? <span className="die-roll-label-detail">{die.resultDetail}</span> : null}
    </div>
  );
}
