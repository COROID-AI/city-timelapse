import * as h from "three";
const v = {
  1945: {
    year: 1945,
    palette: {
      sky: "#c9c2b0",
      ground: "#8a7f6d",
      buildingBase: "#7a6a55",
      buildingAccent: "#5c4d3d",
      accent: "#3f3a2e",
      nightfall: "#2b2b2b"
    },
    buildingStyles: [
      {
        name: "prewar-brick",
        heightRange: [8, 18],
        floors: 4,
        palette: ["buildingBase", "buildingAccent"],
        material: "brick",
        features: ["cornice", "fireEscape"]
      },
      {
        name: "prewar-stone",
        heightRange: [10, 24],
        floors: 6,
        palette: ["buildingBase", "accent"],
        material: "stone",
        features: ["cornice"]
      }
    ],
    vehicles: ["sedan", "truck", "bus", "taxi"],
    storefronts: ["butcher", "bakery", "hardware", "barber"],
    ads: ["paintedSign", "windowSign"],
    streetProps: ["hydrant", "streetLamp", "newsstand", "bench"],
    lighting: {
      ambientIntensity: 0.6,
      directionalIntensity: 1,
      warmth: 0.9,
      isNight: !1,
      fogColor: "#c9c2b0"
    },
    audioCues: ["ambient", "sfxBirds", "sfxTraffic", "sfxCarHorn"]
  },
  1965: {
    year: 1965,
    palette: {
      sky: "#a9c3d8",
      ground: "#8d8b84",
      buildingBase: "#9a8f80",
      buildingAccent: "#6d6a63",
      accent: "#c05a3c",
      nightfall: "#232323"
    },
    buildingStyles: [
      {
        name: "midcentury-brick",
        heightRange: [12, 30],
        floors: 8,
        palette: ["buildingBase", "buildingAccent"],
        material: "brick",
        features: ["roofDeck"]
      },
      {
        name: "midcentury-concrete",
        heightRange: [20, 45],
        floors: 12,
        palette: ["buildingAccent", "accent"],
        material: "concrete",
        features: ["waterTower"]
      }
    ],
    vehicles: ["sedan", "truck", "bus", "taxi", "motorcycle"],
    storefronts: ["diner", "departmentStore", "gasStation", "barber"],
    ads: ["neonSign", "billboard"],
    streetProps: ["streetLamp", "payphone", "bench", "hydrant"],
    lighting: {
      ambientIntensity: 0.55,
      directionalIntensity: 0.95,
      warmth: 0.8,
      isNight: !1,
      fogColor: "#a9c3d8"
    },
    audioCues: ["ambient", "sfxTraffic", "sfxCarHorn", "sfxRadio"]
  },
  1985: {
    year: 1985,
    palette: {
      sky: "#7fa8c9",
      ground: "#6f6f6e",
      buildingBase: "#5f6b74",
      buildingAccent: "#8a8f8a",
      accent: "#e0457b",
      nightfall: "#1c1c1e"
    },
    buildingStyles: [
      {
        name: "latecentury-glass",
        heightRange: [25, 60],
        floors: 18,
        palette: ["buildingBase", "buildingAccent"],
        material: "glass",
        features: ["antennas"]
      },
      {
        name: "latecentury-concrete",
        heightRange: [30, 70],
        floors: 22,
        palette: ["buildingAccent", "accent"],
        material: "concrete",
        features: ["roofDeck"]
      }
    ],
    vehicles: ["sedan", "suv", "bus", "truck", "taxi", "motorcycle"],
    storefronts: ["videoStore", "arcade", "pizza", "electronics"],
    ads: ["neonSign", "billboard", "marquee"],
    streetProps: ["streetLamp", "payphone", "busStop", "newsstand"],
    lighting: {
      ambientIntensity: 0.5,
      directionalIntensity: 0.9,
      warmth: 0.7,
      isNight: !1,
      fogColor: "#7fa8c9"
    },
    audioCues: ["ambient", "sfxTraffic", "sfxRadio", "sfxNeon"]
  },
  2005: {
    year: 2005,
    palette: {
      sky: "#6f9ec2",
      ground: "#5f5f5e",
      buildingBase: "#4d5b66",
      buildingAccent: "#7d8b94",
      accent: "#2f86c8",
      nightfall: "#15151a"
    },
    buildingStyles: [
      {
        name: "modern-glass",
        heightRange: [40, 90],
        floors: 28,
        palette: ["buildingBase", "buildingAccent"],
        material: "glass",
        features: ["antennas", "roofDeck"]
      },
      {
        name: "modern-steel",
        heightRange: [35, 80],
        floors: 24,
        palette: ["buildingAccent", "accent"],
        material: "metal",
        features: ["roofDeck"]
      }
    ],
    vehicles: ["sedan", "suv", "truck", "bus", "taxi", "police"],
    storefronts: ["coffee", "electronics", "pharmacy", "fastFood"],
    ads: ["billboard", "digitalSign", "marquee"],
    streetProps: ["streetLamp", "busStop", "bikeRack", "newsstand"],
    lighting: {
      ambientIntensity: 0.45,
      directionalIntensity: 0.85,
      warmth: 0.6,
      isNight: !1,
      fogColor: "#6f9ec2"
    },
    audioCues: ["ambient", "sfxTraffic", "sfxPedestrians", "sfxConstruction"]
  },
  2025: {
    year: 2025,
    palette: {
      sky: "#5a8bb0",
      ground: "#4f4f4e",
      buildingBase: "#3c4a56",
      buildingAccent: "#6b7d8c",
      accent: "#00d1ff",
      nightfall: "#0e0e12"
    },
    buildingStyles: [
      {
        name: "contemporary-glass",
        heightRange: [50, 120],
        floors: 36,
        palette: ["buildingBase", "buildingAccent"],
        material: "glass",
        features: ["antennas", "roofDeck", "verticalGarden"]
      },
      {
        name: "contemporary-concrete",
        heightRange: [40, 100],
        floors: 30,
        palette: ["buildingAccent", "accent"],
        material: "concrete",
        features: ["roofDeck"]
      }
    ],
    vehicles: ["suv", "sedan", "bus", "truck", "police", "motorcycle"],
    storefronts: ["coffee", "grocery", "gym", "techShop"],
    ads: ["digitalSign", "ledBillboard", "videoWall"],
    streetProps: ["streetLamp", "busStop", "bikeRack", "chargingStation"],
    lighting: {
      ambientIntensity: 0.4,
      directionalIntensity: 0.8,
      warmth: 0.5,
      isNight: !1,
      fogColor: "#5a8bb0"
    },
    audioCues: ["ambient", "sfxTraffic", "sfxPedestrians", "sfxNeon"]
  }
}, x = ["cornerShop", "apartment", "office"], A = [
  "body",
  "windows",
  "roofline",
  "rooftop",
  "signage"
];
function d(c, t = {}) {
  const e = {
    color: c,
    roughness: t.roughness ?? 0.78,
    metalness: t.metalness ?? 0.06
  };
  return t.emissive !== void 0 && (e.emissive = t.emissive, e.emissiveIntensity = t.emissiveIntensity ?? 1.8), t.transparent !== void 0 && (e.transparent = t.transparent), new h.MeshStandardMaterial(e);
}
function u(c, t, e, n) {
  return new h.Mesh(new h.BoxGeometry(c, t, e), n);
}
function w(c, t, e) {
  return new h.Mesh(new h.PlaneGeometry(c, t), e);
}
function J(c) {
  const t = c.palette;
  return {
    base: t.buildingBase,
    accent: t.buildingAccent,
    window: "#1a2430"
  };
}
const $ = {
  1945: {
    year: 1945,
    style: "prewar-brick",
    material: "brick",
    windowStyle: "sash",
    rooftop: "waterTank",
    signage: "painted",
    boarding: 0.4,
    soot: !0,
    cornerShop: { height: 7, floors: 2 },
    apartment: { height: 15, floors: 5 },
    office: { height: 19, floors: 6 }
  },
  1965: {
    year: 1965,
    style: "midcentury-stucco",
    material: "stucco",
    windowStyle: "ribbon",
    rooftop: "waterTankDeck",
    signage: "neon",
    boarding: 0,
    soot: !1,
    cornerShop: { height: 8, floors: 2 },
    apartment: { height: 24, floors: 8 },
    office: { height: 36, floors: 12 }
  },
  1985: {
    year: 1985,
    style: "brutalist-concrete",
    material: "concrete",
    windowStyle: "punched",
    rooftop: "ac",
    signage: "plastic",
    boarding: 0,
    soot: !1,
    cornerShop: { height: 8, floors: 2 },
    apartment: { height: 26, floors: 9 },
    office: { height: 52, floors: 18 }
  },
  2005: {
    year: 2005,
    style: "glass-retrofit",
    material: "glass",
    windowStyle: "curtain",
    rooftop: "ac",
    signage: "glass",
    boarding: 0,
    soot: !1,
    cornerShop: { height: 10, floors: 3 },
    apartment: { height: 40, floors: 14 },
    office: { height: 70, floors: 24 }
  },
  2025: {
    year: 2025,
    style: "mixeduse-glass-steel",
    material: "glass",
    windowStyle: "curtain",
    rooftop: "solarGreen",
    signage: "led",
    boarding: 0,
    soot: !1,
    cornerShop: { height: 12, floors: 4 },
    apartment: { height: 60, floors: 20 },
    office: { height: 95, floors: 32 }
  }
};
function E(c, t) {
  const { width: e, height: n, floors: o, windowStyle: f, windowColor: i, boarding: s } = t, r = new h.Group();
  r.name = "windows";
  const l = Math.max(0.6, e * 0.07), a = e - l * 2, g = n / o, m = f === "ribbon" ? Math.max(0.5, g * 0.55) : Math.max(0.45, g * 0.5), C = f === "ribbon" ? 1 : f === "curtain" ? Math.max(3, Math.floor(a / 1.6)) : Math.max(2, Math.floor(a / 2.2)), I = C > 1 ? a / C : a, O = f === "curtain" ? I * 0.82 : f === "ribbon" ? a : I * 0.62, P = d(i, { metalness: 0.5, roughness: 0.2 }), L = d("#3a3026", { roughness: 0.9 });
  let B = 0;
  for (let p = 0; p < o; p += 1) {
    const R = (p + 0.5) * g;
    for (let y = 0; y < C; y += 1) {
      const k = -a / 2 + (C > 1 ? y * I + I / 2 : a / 2), G = s > 0 && (B * 7 + p * 3 + y * 5) % 10 < s * 10, N = u(O, m, 0.18, G ? L : P);
      N.position.set(k, R, 0.1), r.add(N), B += 1;
    }
  }
  if (c.add(r), t.boarding > 0) {
    const p = new h.Group();
    p.name = "soot";
    const R = Math.max(0.9, n * 0.16), y = u(e + 0.06, R, 0.06, d("#3c3630", { roughness: 0.95 }));
    y.position.set(0, n - R / 2, 0.1), p.add(y);
    for (let k = 0; k < 3; k += 1) {
      const G = u(0.5, n * 0.28, 0.05, d("#4a4238", { roughness: 0.95 }));
      G.position.set(-e * 0.3 + k * e * 0.3, n * 0.72, 0.1), p.add(G);
    }
    r.add(p);
  }
}
function H(c, t) {
  const e = new h.Group();
  e.name = "roofline";
  const { width: n, depth: o, height: f } = t, i = t.style.year;
  if (i === 1945) {
    const s = u(n + 0.5, 0.5, o + 0.5, d("#5c4d3d", { roughness: 0.85 }));
    s.position.set(0, f - 0.25, 0), e.add(s);
  } else if (i === 1965) {
    const s = u(n + 0.2, 0.7, o + 0.2, d("#8d8b84", { roughness: 0.6 }));
    s.position.set(0, f - 0.35, 0), e.add(s);
  } else if (i === 1985) {
    const s = u(n + 0.3, 0.8, o + 0.3, d("#6f6f6e", { roughness: 0.9 }));
    s.position.set(0, f - 0.4, 0), e.add(s);
    const r = u(n + 0.7, 0.25, o + 0.7, d("#8a8f8a", { roughness: 0.8 }));
    r.position.set(0, f - 0.12, 0), e.add(r);
  } else if (i === 2005) {
    const s = u(n + 0.2, 0.6, o + 0.2, d("#7d8b94", { metalness: 0.4 }));
    s.position.set(0, f - 0.3, 0), e.add(s);
  } else {
    const s = u(n + 0.2, 0.6, o + 0.2, d("#6b7d8c", { metalness: 0.5 }));
    if (s.position.set(0, f - 0.3, 0), e.add(s), f >= 50) {
      const r = u(n * 0.72, 1.6, o * 0.72, d("#3c4a56", { metalness: 0.45 }));
      r.position.set(0, f + 0.5, 0), e.add(r);
    }
  }
  c.add(e);
}
function F(c, t) {
  const e = new h.Group();
  e.name = "rooftop";
  const { width: n, depth: o, height: f } = t, i = t.style, s = f;
  switch (i.rooftop) {
    case "waterTank":
    case "waterTankDeck": {
      const r = Math.max(0.9, n * 0.09), l = Math.max(1.4, r * 1.3), a = new h.Mesh(
        new h.CylinderGeometry(r, r, l, 14),
        d("#7a5a3a", { roughness: 0.9 })
      );
      a.position.set(n * 0.22, s + l / 2, o * 0.18), e.add(a);
      const g = new h.Mesh(
        new h.ConeGeometry(r * 0.7, l * 0.4, 12),
        d("#6b4a2e", { roughness: 0.9 })
      );
      if (g.position.set(n * 0.22, s + l + l * 0.2, o * 0.18), e.add(g), f >= 30) {
        const m = new h.Mesh(
          new h.CylinderGeometry(r * 0.72, r * 0.72, l * 0.7, 12),
          d("#7a5a3a", { roughness: 0.9 })
        );
        m.position.set(-n * 0.24, s + l * 0.35, -o * 0.16), e.add(m);
      }
      break;
    }
    case "ac": {
      const r = Math.max(2, Math.floor(n / 3.2));
      for (let l = 0; l < r; l += 1) {
        const a = u(1.1, 0.7, 1.1, d("#9aa0a6", { metalness: 0.5, roughness: 0.5 }));
        a.position.set(-n * 0.28 + l * 1.6, s + 0.35, o * 0.2), e.add(a);
        const g = u(1.1, 0.08, 0.4, d("#6f6f6e", { metalness: 0.3 }));
        g.position.set(-n * 0.28 + l * 1.6, s + 0.72, o * 0.2), e.add(g);
      }
      break;
    }
    case "solarGreen": {
      const r = w(n * 0.7, o * 0.7, d("#3f7d3a", { roughness: 0.95 }));
      r.position.set(0, s + 0.05, 0), r.rotation.x = -Math.PI / 2, e.add(r);
      for (let a = 0; a < 3; a += 1) {
        const g = u(1.2, 0.5, 1.2, d("#4a6b3a", { roughness: 0.9 }));
        g.position.set(-n * 0.3 + a * 1.5, s + 0.25, o * 0.28), e.add(g);
      }
      const l = Math.max(2, Math.floor(n / 2.6));
      for (let a = 0; a < l; a += 1) {
        const g = w(1.6, 1, d("#1c2a4a", { metalness: 0.8, roughness: 0.2 }));
        g.position.set(-n * 0.26 + a * 1.9, s + 0.6, -o * 0.22), g.rotation.x = -Math.PI / 3.2, e.add(g);
        const m = u(0.08, 0.35, 0.08, d("#6b7d8c", { metalness: 0.6 }));
        m.position.set(-n * 0.26 + a * 1.9, s + 0.2, -o * 0.22), e.add(m);
      }
      break;
    }
  }
  c.add(e);
}
function W(c, t) {
  const e = new h.Group();
  e.name = "signage";
  const { width: n, height: o } = t, f = t.style, i = n * 0.3, s = Math.min(o * 0.5, 4.2), r = Math.min(3.4, n * 0.3), l = 0.8;
  switch (f.signage) {
    case "painted": {
      const a = w(r, l, d("#e8e2d6", { roughness: 0.5 }));
      a.position.set(i, s, 0.12), e.add(a);
      break;
    }
    case "neon": {
      const a = w(r, l, d("#2a2a2a", { roughness: 0.4 }));
      a.position.set(i, s, 0.12), e.add(a);
      const g = u(r * 0.8, 0.08, 0.05, d(t.accent, { emissive: t.accent, emissiveIntensity: 2.4 }));
      g.position.set(i, s, 0.2), e.add(g);
      break;
    }
    case "plastic": {
      const a = w(r, l, d(t.accent, { emissive: t.accent, emissiveIntensity: 1.6 }));
      a.position.set(i, s, 0.12), e.add(a);
      break;
    }
    case "glass": {
      const a = w(r, l, d("#dfe7ee", { metalness: 0.2, roughness: 0.2 }));
      a.position.set(i, s, 0.12), e.add(a);
      const g = u(r + 0.2, 0.1, 0.08, d("#7d8b94", { metalness: 0.6 }));
      g.position.set(i, s + l / 2 + 0.05, 0.16), e.add(g);
      break;
    }
    case "led": {
      const a = w(r, l, d("#0e0e12", { roughness: 0.3 }));
      a.position.set(i, s, 0.12), e.add(a);
      const g = u(r * 0.9, 0.12, 0.05, d("#00d1ff", { emissive: "#00d1ff", emissiveIntensity: 2.6 }));
      g.position.set(i, s + 0.1, 0.2), e.add(g);
      break;
    }
  }
  c.add(e);
}
const _ = {
  cornerShop: { width: 9, depth: 11, x: -15 },
  apartment: { width: 13, depth: 15, x: 0 },
  office: { width: 11, depth: 13, x: 15 }
};
function U(c, t, e) {
  const n = new h.Group();
  n.name = c;
  const o = _[c], f = t[c], i = f.height, s = t.material === "brick" ? e.base : t.material === "concrete" ? "#8a8f8a" : t.material === "stucco" ? "#c9c2b0" : e.base, r = e.accent, l = u(o.width, i, o.depth, d(s, { roughness: t.material === "glass" ? 0.2 : 0.85, metalness: t.material === "steel" || t.material === "glass" ? 0.35 : 0.05 }));
  return l.name = "body", l.position.set(0, i / 2, 0), n.add(l), E(n, {
    width: o.width,
    height: i,
    floors: f.floors,
    windowStyle: t.windowStyle,
    windowColor: e.window,
    boarding: t.boarding
  }), H(n, { width: o.width, depth: o.depth, height: i, style: t }), F(n, { width: o.width, depth: o.depth, height: i, style: t }), W(n, { width: o.width, height: i, style: t, accent: r }), n.position.set(o.x, 0, 0), n;
}
function T(c) {
  const t = new h.Group();
  t.name = `era-buildings-${c.year}`;
  const e = $[c.year], n = J(c);
  for (const o of x)
    t.add(U(o, e, n));
  return t;
}
function q(c) {
  const t = new h.Group();
  t.name = "era-buildings";
  let e = null, n = null, o = null;
  function f(i) {
    t.clear();
    const s = T(i);
    return t.add(s), o = s, n = i.year, s;
  }
  return {
    get root() {
      return t;
    },
    get group() {
      return o;
    },
    get year() {
      return n;
    },
    bootstrap(i, s) {
      return e = i, e.add(t), f(s ?? c ?? v[1945]), this;
    },
    update(i) {
      return f(i), this;
    },
    dispose() {
      e && e.remove(t), t.clear(), e = null, o = null, n = null;
    }
  };
}
const M = { bootstrap: 0, update: 0, dispose: 0 }, S = [];
for (const c of [1945, 1965, 1985, 2005, 2025]) {
  const t = v[c], e = T(t), n = e.children.map((o) => o.name);
  JSON.stringify(n) !== JSON.stringify([...x]) && S.push(`${c}: top order ${JSON.stringify(n)} != ${JSON.stringify([...x])}`);
  for (let o = 0; o < x.length; o += 1) {
    const i = e.children[o].children.map((s) => s.name);
    JSON.stringify(i) !== JSON.stringify([...A]) && S.push(`${c}/${x[o]}: slots ${JSON.stringify(i)} != ${JSON.stringify([...A])}`);
  }
}
const D = new h.Scene(), b = q();
b.bootstrap(D, v[1945]);
M.bootstrap += 1;
(b.year !== 1945 || b.root.parent !== D) && S.push("bootstrap did not attach root / set year 1945");
for (const c of [1965, 1985, 2005, 2025])
  b.update(v[c]), M.update += 1, b.year !== c && S.push(`update(${c}) did not set year`);
b.update(v[1945]);
M.update += 1;
b.dispose();
M.dispose += 1;
b.root.parent != null && S.push("dispose did not detach root");
const z = {
  modules: [
    {
      path: "src/eras/buildings.ts",
      name: "buildingsFactory",
      registrations: 1,
      lifecycleCalls: M
    },
    {
      // EraDefinition is a TypeScript interface (type alias) in
      // src/data/eraDefinition.ts — it is erased at runtime and has no
      // runtime lifecycle. It is consumed once by buildingsFactory as the
      // factory's parameter type; the source was read to confirm erasure.
      path: "src/data/eraDefinition.ts",
      name: "EraDefinition",
      registrations: 1,
      lifecycleCalls: { bootstrap: 0, update: 0, dispose: 0 }
    }
  ],
  errors: S
};
console.log(JSON.stringify(z));
S.length > 0 && process.exit(1);
