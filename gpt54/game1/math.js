(() => {
  const MoonDew = (window.MoonDew = window.MoonDew || {});

  const TAU = Math.PI * 2;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function inverseLerp(a, b, value) {
    if (a === b) {
      return 0;
    }
    return clamp((value - a) / (b - a), 0, 1);
  }

  function smoothstep(a, b, value) {
    const t = inverseLerp(a, b, value);
    return t * t * (3 - 2 * t);
  }

  function easeInOutSine(t) {
    return -(Math.cos(Math.PI * t) - 1) * 0.5;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function vec(x = 0, y = 0) {
    return { x, y };
  }

  function add(a, b) {
    return { x: a.x + b.x, y: a.y + b.y };
  }

  function sub(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
  }

  function scale(v, s) {
    return { x: v.x * s, y: v.y * s };
  }

  function length(v) {
    return Math.hypot(v.x, v.y);
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function normalize(v) {
    const len = length(v);
    if (len < 0.00001) {
      return { x: 0, y: 0 };
    }
    return { x: v.x / len, y: v.y / len };
  }

  function dot(a, b) {
    return a.x * b.x + a.y * b.y;
  }

  function angle(v) {
    return Math.atan2(v.y, v.x);
  }

  function fromAngle(value, radius = 1) {
    return { x: Math.cos(value) * radius, y: Math.sin(value) * radius };
  }

  function rotate(v, radians) {
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
  }

  function randomRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function randomInt(min, max) {
    return Math.floor(randomRange(min, max + 1));
  }

  function damp(current, target, smoothing, dt) {
    return lerp(current, target, 1 - Math.exp(-smoothing * dt));
  }

  function dampVec(current, target, smoothing, dt) {
    return {
      x: damp(current.x, target.x, smoothing, dt),
      y: damp(current.y, target.y, smoothing, dt),
    };
  }

  function pointInEllipse(point, ellipse) {
    const dx = (point.x - ellipse.x) / ellipse.rx;
    const dy = (point.y - ellipse.y) / ellipse.ry;
    return dx * dx + dy * dy <= 1;
  }

  function ellipseFalloff(point, ellipse) {
    const dx = (point.x - ellipse.x) / ellipse.rx;
    const dy = (point.y - ellipse.y) / ellipse.ry;
    return clamp(1 - dx * dx - dy * dy, 0, 1);
  }

  function distanceToSegment(point, a, b) {
    const ab = sub(b, a);
    const ap = sub(point, a);
    const denom = dot(ab, ab);
    if (denom <= 0.00001) {
      return distance(point, a);
    }
    const t = clamp(dot(ap, ab) / denom, 0, 1);
    const closest = { x: a.x + ab.x * t, y: a.y + ab.y * t };
    return distance(point, closest);
  }

  function projectOnSegment(point, a, b) {
    const ab = sub(b, a);
    const ap = sub(point, a);
    const denom = dot(ab, ab);
    if (denom <= 0.00001) {
      return { point: { x: a.x, y: a.y }, t: 0 };
    }
    const t = clamp(dot(ap, ab) / denom, 0, 1);
    return { point: { x: a.x + ab.x * t, y: a.y + ab.y * t }, t };
  }

  function hash2D(x, y) {
    const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return value - Math.floor(value);
  }

  function wrap(value, min, max) {
    const range = max - min;
    if (range === 0) {
      return min;
    }
    let result = (value - min) % range;
    if (result < 0) {
      result += range;
    }
    return result + min;
  }

  MoonDew.math = {
    TAU,
    clamp,
    lerp,
    inverseLerp,
    smoothstep,
    easeInOutSine,
    easeOutCubic,
    vec,
    add,
    sub,
    scale,
    length,
    distance,
    normalize,
    dot,
    angle,
    fromAngle,
    rotate,
    randomRange,
    randomInt,
    damp,
    dampVec,
    pointInEllipse,
    ellipseFalloff,
    distanceToSegment,
    projectOnSegment,
    hash2D,
    wrap,
  };
})();
