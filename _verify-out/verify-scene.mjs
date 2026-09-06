import * as i from "three";
const re = [1945, 1965, 1985, 2005, 2025], L = {
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
}, Be = ["cornerShop", "apartment", "office"];
function M(t, e = {}) {
  const o = {
    color: t,
    roughness: e.roughness ?? 0.78,
    metalness: e.metalness ?? 0.06
  };
  return e.emissive !== void 0 && (o.emissive = e.emissive, o.emissiveIntensity = e.emissiveIntensity ?? 1.8), e.transparent !== void 0 && (o.transparent = e.transparent), new i.MeshStandardMaterial(o);
}
function P(t, e, o, n) {
  return new i.Mesh(new i.BoxGeometry(t, e, o), n);
}
function W(t, e, o) {
  return new i.Mesh(new i.PlaneGeometry(t, e), o);
}
function Pe(t) {
  const e = t.palette;
  return {
    base: e.buildingBase,
    accent: e.buildingAccent,
    window: "#1a2430"
  };
}
const He = {
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
function De(t, e) {
  const { width: o, height: n, floors: r, windowStyle: s, windowColor: l, boarding: a } = e, d = new i.Group();
  d.name = "windows";
  const c = Math.max(0.6, o * 0.07), f = o - c * 2, p = n / r, u = s === "ribbon" ? Math.max(0.5, p * 0.55) : Math.max(0.45, p * 0.5), k = s === "ribbon" ? 1 : s === "curtain" ? Math.max(3, Math.floor(f / 1.6)) : Math.max(2, Math.floor(f / 2.2)), w = k > 1 ? f / k : f, G = s === "curtain" ? w * 0.82 : s === "ribbon" ? f : w * 0.62, A = M(l, { metalness: 0.5, roughness: 0.2 }), g = M("#3a3026", { roughness: 0.9 });
  let I = 0;
  for (let E = 0; E < r; E += 1) {
    const N = (E + 0.5) * p;
    for (let m = 0; m < k; m += 1) {
      const h = -f / 2 + (k > 1 ? m * w + w / 2 : f / 2), R = a > 0 && (I * 7 + E * 3 + m * 5) % 10 < a * 10, S = P(G, u, 0.18, R ? g : A);
      S.position.set(h, N, 0.1), d.add(S), I += 1;
    }
  }
  if (t.add(d), e.boarding > 0) {
    const E = new i.Group();
    E.name = "soot";
    const N = Math.max(0.9, n * 0.16), m = P(o + 0.06, N, 0.06, M("#3c3630", { roughness: 0.95 }));
    m.position.set(0, n - N / 2, 0.1), E.add(m);
    for (let h = 0; h < 3; h += 1) {
      const R = P(0.5, n * 0.28, 0.05, M("#4a4238", { roughness: 0.95 }));
      R.position.set(-o * 0.3 + h * o * 0.3, n * 0.72, 0.1), E.add(R);
    }
    d.add(E);
  }
}
function Oe(t, e) {
  const o = new i.Group();
  o.name = "roofline";
  const { width: n, depth: r, height: s } = e, l = e.style.year;
  if (l === 1945) {
    const a = P(n + 0.5, 0.5, r + 0.5, M("#5c4d3d", { roughness: 0.85 }));
    a.position.set(0, s - 0.25, 0), o.add(a);
  } else if (l === 1965) {
    const a = P(n + 0.2, 0.7, r + 0.2, M("#8d8b84", { roughness: 0.6 }));
    a.position.set(0, s - 0.35, 0), o.add(a);
  } else if (l === 1985) {
    const a = P(n + 0.3, 0.8, r + 0.3, M("#6f6f6e", { roughness: 0.9 }));
    a.position.set(0, s - 0.4, 0), o.add(a);
    const d = P(n + 0.7, 0.25, r + 0.7, M("#8a8f8a", { roughness: 0.8 }));
    d.position.set(0, s - 0.12, 0), o.add(d);
  } else if (l === 2005) {
    const a = P(n + 0.2, 0.6, r + 0.2, M("#7d8b94", { metalness: 0.4 }));
    a.position.set(0, s - 0.3, 0), o.add(a);
  } else {
    const a = P(n + 0.2, 0.6, r + 0.2, M("#6b7d8c", { metalness: 0.5 }));
    if (a.position.set(0, s - 0.3, 0), o.add(a), s >= 50) {
      const d = P(n * 0.72, 1.6, r * 0.72, M("#3c4a56", { metalness: 0.45 }));
      d.position.set(0, s + 0.5, 0), o.add(d);
    }
  }
  t.add(o);
}
function Le(t, e) {
  const o = new i.Group();
  o.name = "rooftop";
  const { width: n, depth: r, height: s } = e, l = e.style, a = s;
  switch (l.rooftop) {
    case "waterTank":
    case "waterTankDeck": {
      const d = Math.max(0.9, n * 0.09), c = Math.max(1.4, d * 1.3), f = new i.Mesh(
        new i.CylinderGeometry(d, d, c, 14),
        M("#7a5a3a", { roughness: 0.9 })
      );
      f.position.set(n * 0.22, a + c / 2, r * 0.18), o.add(f);
      const p = new i.Mesh(
        new i.ConeGeometry(d * 0.7, c * 0.4, 12),
        M("#6b4a2e", { roughness: 0.9 })
      );
      if (p.position.set(n * 0.22, a + c + c * 0.2, r * 0.18), o.add(p), s >= 30) {
        const u = new i.Mesh(
          new i.CylinderGeometry(d * 0.72, d * 0.72, c * 0.7, 12),
          M("#7a5a3a", { roughness: 0.9 })
        );
        u.position.set(-n * 0.24, a + c * 0.35, -r * 0.16), o.add(u);
      }
      break;
    }
    case "ac": {
      const d = Math.max(2, Math.floor(n / 3.2));
      for (let c = 0; c < d; c += 1) {
        const f = P(1.1, 0.7, 1.1, M("#9aa0a6", { metalness: 0.5, roughness: 0.5 }));
        f.position.set(-n * 0.28 + c * 1.6, a + 0.35, r * 0.2), o.add(f);
        const p = P(1.1, 0.08, 0.4, M("#6f6f6e", { metalness: 0.3 }));
        p.position.set(-n * 0.28 + c * 1.6, a + 0.72, r * 0.2), o.add(p);
      }
      break;
    }
    case "solarGreen": {
      const d = W(n * 0.7, r * 0.7, M("#3f7d3a", { roughness: 0.95 }));
      d.position.set(0, a + 0.05, 0), d.rotation.x = -Math.PI / 2, o.add(d);
      for (let f = 0; f < 3; f += 1) {
        const p = P(1.2, 0.5, 1.2, M("#4a6b3a", { roughness: 0.9 }));
        p.position.set(-n * 0.3 + f * 1.5, a + 0.25, r * 0.28), o.add(p);
      }
      const c = Math.max(2, Math.floor(n / 2.6));
      for (let f = 0; f < c; f += 1) {
        const p = W(1.6, 1, M("#1c2a4a", { metalness: 0.8, roughness: 0.2 }));
        p.position.set(-n * 0.26 + f * 1.9, a + 0.6, -r * 0.22), p.rotation.x = -Math.PI / 3.2, o.add(p);
        const u = P(0.08, 0.35, 0.08, M("#6b7d8c", { metalness: 0.6 }));
        u.position.set(-n * 0.26 + f * 1.9, a + 0.2, -r * 0.22), o.add(u);
      }
      break;
    }
  }
  t.add(o);
}
function Ne(t, e) {
  const o = new i.Group();
  o.name = "signage";
  const { width: n, height: r } = e, s = e.style, l = n * 0.3, a = Math.min(r * 0.5, 4.2), d = Math.min(3.4, n * 0.3), c = 0.8;
  switch (s.signage) {
    case "painted": {
      const f = W(d, c, M("#e8e2d6", { roughness: 0.5 }));
      f.position.set(l, a, 0.12), o.add(f);
      break;
    }
    case "neon": {
      const f = W(d, c, M("#2a2a2a", { roughness: 0.4 }));
      f.position.set(l, a, 0.12), o.add(f);
      const p = P(d * 0.8, 0.08, 0.05, M(e.accent, { emissive: e.accent, emissiveIntensity: 2.4 }));
      p.position.set(l, a, 0.2), o.add(p);
      break;
    }
    case "plastic": {
      const f = W(d, c, M(e.accent, { emissive: e.accent, emissiveIntensity: 1.6 }));
      f.position.set(l, a, 0.12), o.add(f);
      break;
    }
    case "glass": {
      const f = W(d, c, M("#dfe7ee", { metalness: 0.2, roughness: 0.2 }));
      f.position.set(l, a, 0.12), o.add(f);
      const p = P(d + 0.2, 0.1, 0.08, M("#7d8b94", { metalness: 0.6 }));
      p.position.set(l, a + c / 2 + 0.05, 0.16), o.add(p);
      break;
    }
    case "led": {
      const f = W(d, c, M("#0e0e12", { roughness: 0.3 }));
      f.position.set(l, a, 0.12), o.add(f);
      const p = P(d * 0.9, 0.12, 0.05, M("#00d1ff", { emissive: "#00d1ff", emissiveIntensity: 2.6 }));
      p.position.set(l, a + 0.1, 0.2), o.add(p);
      break;
    }
  }
  t.add(o);
}
const ze = {
  cornerShop: { width: 9, depth: 11, x: -15 },
  apartment: { width: 13, depth: 15, x: 0 },
  office: { width: 11, depth: 13, x: 15 }
};
function $e(t, e, o) {
  const n = new i.Group();
  n.name = t;
  const r = ze[t], s = e[t], l = s.height, a = e.material === "brick" ? o.base : e.material === "concrete" ? "#8a8f8a" : e.material === "stucco" ? "#c9c2b0" : o.base, d = o.accent, c = P(r.width, l, r.depth, M(a, { roughness: e.material === "glass" ? 0.2 : 0.85, metalness: e.material === "steel" || e.material === "glass" ? 0.35 : 0.05 }));
  return c.name = "body", c.position.set(0, l / 2, 0), n.add(c), De(n, {
    width: r.width,
    height: l,
    floors: s.floors,
    windowStyle: e.windowStyle,
    windowColor: o.window,
    boarding: e.boarding
  }), Oe(n, { width: r.width, depth: r.depth, height: l, style: e }), Le(n, { width: r.width, depth: r.depth, height: l, style: e }), Ne(n, { width: r.width, height: l, style: e, accent: d }), n.position.set(r.x, 0, 0), n;
}
function _e(t) {
  const e = new i.Group();
  e.name = `era-buildings-${t.year}`;
  const o = He[t.year], n = Pe(t);
  for (const r of Be)
    e.add($e(r, o, n));
  return e;
}
function Fe(t) {
  const e = new i.Group();
  e.name = "era-buildings";
  let o = null, n = null, r = null;
  function s(l) {
    e.clear();
    const a = _e(l);
    return e.add(a), r = a, n = l.year, a;
  }
  return {
    get root() {
      return e;
    },
    get group() {
      return r;
    },
    get year() {
      return n;
    },
    bootstrap(l, a) {
      return o = l, o.add(e), s(a ?? t ?? L[1945]), this;
    },
    update(l) {
      return s(l), this;
    },
    dispose() {
      o && o.remove(e), e.clear(), o = null, r = null, n = null;
    }
  };
}
const Re = 30, Ae = 11;
function Ee(t, e) {
  return 4 * t + 2 * Math.PI * e;
}
function Ye(t, e, o) {
  const n = 2 * e, r = Math.PI * o, s = Ee(e, o);
  let l = (t % s + s) % s;
  if (l < n)
    return { x: -e + l, z: o, yaw: Math.PI / 2 };
  if (l -= n, l < r) {
    const d = l / o;
    return {
      x: e + o * Math.sin(d),
      z: o * Math.cos(d),
      yaw: Math.atan2(Math.cos(d), -Math.sin(d))
    };
  }
  if (l -= r, l < n)
    return { x: e - l, z: -o, yaw: -Math.PI / 2 };
  l -= n;
  const a = l / o;
  return {
    x: -e - o * Math.sin(a),
    z: -o * Math.cos(a),
    yaw: Math.atan2(-Math.cos(a), Math.sin(a))
  };
}
function We(t) {
  return Ye(t, Re, Ae);
}
function xe() {
  return Ee(Re, Ae);
}
function b(t, e = {}) {
  const o = {
    color: t,
    roughness: e.roughness ?? 0.72,
    metalness: e.metalness ?? 0.08
  };
  return e.emissive !== void 0 && (o.emissive = e.emissive, o.emissiveIntensity = e.emissiveIntensity ?? 1.6), new i.MeshStandardMaterial(o);
}
function v(t, e, o, n) {
  return new i.Mesh(new i.BoxGeometry(t, e, o), n);
}
function Ie(t) {
  return new i.Mesh(new i.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), t);
}
function q(t, e, o, n, r, s) {
  const d = e / 2 - 0.32, c = [];
  if (r === 4)
    c.push([-d, o / 2 - 0.9], [d, o / 2 - 0.9], [-d, -o / 2 + 0.9], [d, -o / 2 + 0.9]);
  else
    for (const f of [o / 2 - 1.1, 0, -o / 2 + 1.1])
      c.push([-d, f], [d, f]);
  for (const [f, p] of c) {
    const u = v(0.55, n, 0.55, s);
    u.position.set(f, n / 2, p), t.add(u);
  }
}
function j(t, e, o, n, r) {
  const s = e / 2 - 0.42;
  for (const l of [-s, s]) {
    const a = v(0.5, 0.34, 0.12, b(r, { emissive: r, emissiveIntensity: 2.2 }));
    a.position.set(l, o, n), t.add(a);
  }
}
function J(t, e, o, n, r) {
  const s = e / 2 - 0.42;
  for (const l of [-s, s]) {
    const a = v(0.42, 0.28, 0.1, b(r, { emissive: r, emissiveIntensity: 1.9 }));
    a.position.set(l, o, n), t.add(a);
  }
}
function Ue(t, e) {
  const o = new i.Group(), n = t === "taxi" ? "#f4e14a" : t === "ev" ? "#e8f0f4" : t === "crossover" ? "#7f9bb5" : t === "boxy" ? "#b09a78" : t === "hatchback" ? "#c94f2f" : t === "tailfin" ? "#2f7d9b" : "#2e3a2e", r = t === "taxi" ? "#d9c03a" : t === "ev" ? "#cfdde6" : t === "crossover" ? "#5f7d9e" : t === "boxy" ? "#8f7c5e" : t === "hatchback" ? "#a83c24" : t === "tailfin" ? "#7a9bbf" : "#1f2620", s = t === "crossover" || t === "taxi", l = s ? 5.2 : 4.6, a = s ? 2.2 : 1.9, d = s ? 1.35 : 1.15, c = s ? 2.6 : 2.3, f = s ? 1.9 : 1.55, p = s ? 0.62 : 0.52, u = s ? -0.25 : -0.15, k = b(n, { metalness: s ? 0.35 : 0.2 }), w = b(r, { metalness: 0.15 }), G = v(a, d, l, k);
  if (G.position.set(0, d / 2, 0), o.add(G), t === "sedan") {
    const g = Ie(w);
    g.scale.set(f, p * 1.55, c), g.position.set(0, d, u), o.add(g);
  } else {
    const g = v(f, p, c, w);
    g.position.set(0, d + p / 2, u), o.add(g);
  }
  if (t === "tailfin") {
    const g = v(0.16, 0.85, 0.5, b(e.accent, { metalness: 0.3 }));
    g.position.set(0, d + 0.42, -l / 2 + 0.35), o.add(g);
  }
  if (s)
    for (const g of [-f / 2 + 0.12, f / 2 - 0.12]) {
      const I = v(0.1, 0.1, c + 0.3, b(e.accent, { metalness: 0.6 }));
      I.position.set(g, d + p + 0.05, u), o.add(I);
    }
  if (t === "ev") {
    const g = v(a - 0.5, 0.14, 0.1, b("#9fe8ff", { emissive: "#9fe8ff", emissiveIntensity: 2.4 }));
    g.position.set(0, d * 0.55, l / 2 - 0.08), o.add(g);
  }
  if (q(o, a, l, s ? 0.72 : 0.62, 4, b("#1b1b1b", { roughness: 0.95 })), j(o, a, d * 0.6, l / 2 + 0.02, t === "taxi" ? "#fff6d8" : "#fff2c8"), J(o, a, d * 0.55, -l / 2 - 0.02, "#d81f1f"), t === "taxi") {
    const g = v(0.7, 0.4, 0.24, b("#ffe14a", { emissive: "#ffe14a", emissiveIntensity: 2 }));
    g.position.set(0, d + p + 0.32, u + 0.1), o.add(g);
  }
  return o;
}
function Ve(t) {
  const e = new i.Group(), o = b("#c8cfc2", { metalness: 0.18 }), n = 5.6, r = 2.1, s = 1.95, l = v(r, s, n, o);
  l.position.set(0, s / 2, 0), e.add(l);
  const a = v(r * 0.82, s * 0.55, n * 0.5, b(t.accent, { metalness: 0.2 }));
  a.position.set(0, s + s * 0.55 / 2, 0), e.add(a);
  const d = v(r * 0.8, 0.42, n * 0.14, b("#9fd4e8", { metalness: 0.5 }));
  return d.position.set(0, s * 0.72, n / 2 - 0.6), e.add(d), q(e, r, n, 0.6, 4, b("#1b1b1b", { roughness: 0.95 })), j(e, r, s * 0.55, n / 2 + 0.02, "#fff2c8"), J(e, r, s * 0.5, -n / 2 - 0.02, "#d81f1f"), e;
}
function Ke(t) {
  const e = new i.Group(), o = b("#d8cf8a", { metalness: 0.15 }), n = 9.5, r = 2.6, s = 2.6, l = v(r, s, n, o);
  l.position.set(0, s / 2, 0), e.add(l);
  const a = v(r - 0.15, 0.7, n - 1.4, b("#a9cfe8", { metalness: 0.45 }));
  a.position.set(0, s - 0.55, 0), e.add(a);
  const d = v(r * 0.7, 0.12, n - 1, b(t.accent));
  return d.position.set(0, s + 0.06, 0), e.add(d), q(e, r, n, 0.62, 6, b("#1b1b1b", { roughness: 0.95 })), j(e, r, s * 0.55, n / 2 + 0.02, "#fff6d8"), J(e, r, s * 0.5, -n / 2 - 0.02, "#d81f1f"), e;
}
function Xe(t) {
  const e = new i.Group(), o = b("#3a4438", { metalness: 0.1 }), n = 8.6, r = 2.4, s = 2.5, l = v(r, s, n, o);
  l.position.set(0, s / 2, 0), e.add(l);
  const a = v(r - 0.15, 0.62, n - 1.2, b("#b8cfc4", { metalness: 0.4 }));
  a.position.set(0, s - 0.5, 0), e.add(a);
  for (const c of [-0.7, 0.7]) {
    const f = v(0.12, 1.5, 0.12, b("#222222"));
    f.position.set(c, s + 0.75, -0.4), e.add(f);
  }
  const d = v(r * 0.7, 0.14, n - 1.2, b(t.accent));
  return d.position.set(0, s + 0.07, 0), e.add(d), q(e, r, n, 0.6, 6, b("#1b1b1b", { roughness: 0.95 })), j(e, r, s * 0.55, n / 2 + 0.02, "#ffedb0"), J(e, r, s * 0.5, -n / 2 - 0.02, "#a81c1c"), e;
}
function Ze(t) {
  const e = new i.Group(), o = v(0.45, 0.12, 1.1, b("#d8dde2", { metalness: 0.5 }));
  o.position.set(0, 0.3, 0), e.add(o);
  const n = v(0.1, 1, 0.1, b("#2a2a2a"));
  n.position.set(0, 0.85, 0.35), e.add(n);
  const r = v(0.5, 0.09, 0.1, b("#2a2a2a"));
  r.position.set(0, 1.42, 0.35), e.add(r);
  for (const a of [0.5, -0.45]) {
    const d = v(0.4, 0.5, 0.4, b("#161616", { roughness: 0.95 }));
    d.position.set(0, 0.25, a), e.add(d);
  }
  const s = v(0.16, 0.16, 0.1, b("#eaffff", { emissive: "#eaffff", emissiveIntensity: 2.4 }));
  s.position.set(0, 1.05, 0.42), e.add(s);
  const l = v(0.4, 0.05, 0.9, b(t.accent, { emissive: t.accent, emissiveIntensity: 1.2 }));
  return l.position.set(0, 0.36, 0), e.add(l), e;
}
function qe(t) {
  const e = new i.Group(), o = b("#eef4f8", { metalness: 0.45 }), n = 5, r = 2.4, s = 1.5, l = v(r, s * 0.45, n, o);
  l.position.set(0, s * 0.225, 0), e.add(l);
  const a = Ie(b("#d7e6f0", { metalness: 0.4 }));
  a.scale.set(r * 0.9, s * 0.5, n * 0.9), a.position.set(0, s * 0.45, 0), e.add(a);
  const d = v(r * 0.8, 0.16, 0.12, b("#7fe3ff", { emissive: "#7fe3ff", emissiveIntensity: 2.2 }));
  d.position.set(0, s * 0.5, n / 2 - 0.1), e.add(d);
  const c = v(0.5, 0.3, 0.5, b(t.accent, { emissive: t.accent, emissiveIntensity: 1.6 }));
  return c.position.set(0, s * 0.95, 0.1), e.add(c), q(e, r, n, 0.55, 6, b("#1b1b1b", { roughness: 0.95 })), j(e, r, s * 0.4, n / 2 + 0.02, "#eaffff"), J(e, r, s * 0.36, -n / 2 - 0.02, "#d81f1f"), e;
}
function je(t, e) {
  const o = { accent: e.palette.accent };
  switch (t) {
    case "sedan":
    case "tailfin":
    case "boxy":
    case "hatchback":
    case "crossover":
    case "ev":
    case "taxi":
      return Ue(t, o);
    case "van":
      return Ve(o);
    case "bus":
      return Ke(o);
    case "trolleybus":
      return Xe(o);
    case "scooter":
      return Ze(o);
    case "shuttle":
      return qe(o);
  }
}
const me = {
  1945: { kinds: ["sedan", "sedan", "trolleybus"], speed: 7 },
  1965: { kinds: ["tailfin", "tailfin", "van"], speed: 8 },
  1985: { kinds: ["boxy", "hatchback", "bus"], speed: 9 },
  2005: { kinds: ["crossover", "crossover", "taxi"], speed: 11 },
  2025: { kinds: ["ev", "scooter", "scooter", "shuttle"], speed: 12 }
};
function Je() {
  const t = new i.Group();
  t.name = "era-vehicles";
  let e = null, o = 0, n = null;
  const r = [];
  function s(l) {
    t.clear(), r.length = 0;
    const a = me[l.year], d = xe(), c = a.kinds.length;
    for (let f = 0; f < c; f += 1) {
      const p = a.kinds[f], u = je(p, l), k = p === "scooter" ? 1.35 : p === "bus" || p === "trolleybus" || p === "shuttle" ? 0.85 : 1;
      r.push({ group: u, offset: f / c * d, speedMul: k }), t.add(u);
    }
    n = l.year;
  }
  return {
    get root() {
      return t;
    },
    get year() {
      return n;
    },
    bootstrap(l, a) {
      e = l;
      const d = a ?? L[1945];
      return e.add(t), s(d), this;
    },
    update(l, a) {
      o += l, a.year !== n && s(a);
      const d = me[a.year];
      for (const c of r) {
        const f = c.offset + o * d.speed * c.speedMul, p = We(f);
        c.group.position.set(p.x, 0, p.z), c.group.rotation.y = p.yaw;
      }
    },
    dispose() {
      e && e.remove(t), t.clear(), r.length = 0, e = null, n = null;
    }
  };
}
const K = 26, Qe = 14;
function O(t, e = {}) {
  return new i.MeshStandardMaterial({
    color: t,
    roughness: e.roughness ?? 0.8,
    metalness: e.metalness ?? 0.05
  });
}
function B(t, e, o, n) {
  return new i.Mesh(new i.BoxGeometry(t, e, o), n);
}
function ge(t, e) {
  return new i.Mesh(new i.SphereGeometry(t, 8, 6), e);
}
function et(t, e) {
  const o = new i.Group(), n = new i.Group();
  n.name = "hip", o.add(n);
  const r = new i.Group();
  r.name = "torso";
  const s = B(0.62, 0.8, 0.34, O(t.top));
  s.position.set(0, 0.4, 0), r.add(s);
  const l = ge(0.24, O(t.skin));
  l.position.set(0, 1.18, 0), r.add(l);
  const a = ge(0.26, O(t.hair));
  a.position.set(0, 1.32, -0.02), a.scale.set(1, 0.6, 1), r.add(a);
  const d = new i.Group(), c = new i.Group(), f = 0.14, p = 0.62, u = O(t.top), k = B(f, p, f, u);
  k.position.set(0, -p / 2, 0), d.add(k);
  const w = B(f, p, f, u);
  w.position.set(0, -p / 2, 0), c.add(w);
  const G = O(t.skin);
  d.add(B(f, 0.14, f, G).translateY(-p - 0.07)), c.add(B(f, 0.14, f, G).translateY(-p - 0.07)), d.position.set(0.4, 0.82, 0), c.position.set(-0.4, 0.82, 0), r.add(d, c);
  const A = new i.Group(), g = new i.Group(), I = 0.16, E = 0.72, N = O(t.bottom);
  A.add(B(I, E, I, N).translateY(-E / 2)), g.add(B(I, E, I, N).translateY(-E / 2));
  const m = O(t.accent);
  A.add(B(0.22, 0.1, 0.32, m).translateY(-E - 0.05).translateZ(0.06)), g.add(B(0.22, 0.1, 0.32, m).translateY(-E - 0.05).translateZ(0.06)), A.position.set(0.16, 0.8, 0), g.position.set(-0.16, 0.8, 0), n.add(A, g);
  for (const D of t.accessories)
    tt(r, c, D, t);
  n.add(r);
  const h = e * 2.399963 % 1 * Math.PI * 2, R = 0.85 + e * 7.13 % 1 * 0.4, S = e * 13.7 % 1 < 0.5 ? 1 : -1;
  return {
    root: o,
    hip: n,
    torso: r,
    leftArm: d,
    rightArm: c,
    leftLeg: A,
    rightLeg: g,
    phase: h,
    speedMul: R,
    x: -K + e % 1 * (K * 2),
    dir: S
  };
}
function tt(t, e, o, n) {
  const r = O(n.accent);
  switch (o) {
    case "militaryCap": {
      const s = B(0.3, 0.14, 0.3, O(n.hair));
      s.position.set(0, 1.42, 0), t.add(s);
      const l = B(0.26, 0.06, 0.2, O("#1f2a1f"));
      l.position.set(0, 1.36, 0.2), t.add(l);
      break;
    }
    case "scarf": {
      const s = B(0.5, 0.16, 0.16, r);
      s.position.set(0, 0.78, 0.18), t.add(s);
      break;
    }
    case "modTie": {
      const s = B(0.12, 0.5, 0.06, r);
      s.position.set(0, 0.32, 0.2), t.add(s);
      break;
    }
    case "shoulderPads": {
      for (const s of [-0.34, 0.34]) {
        const l = B(0.3, 0.14, 0.3, O(n.top));
        l.position.set(s, 0.88, 0), t.add(l);
      }
      break;
    }
    case "handbag": {
      const s = B(0.3, 0.24, 0.14, r);
      s.position.set(0.42, 0.5, 0.1), t.add(s);
      break;
    }
    case "phone": {
      const s = B(0.08, 0.16, 0.02, O("#1b1b1b", { metalness: 0.7 }));
      s.position.set(0.12, -0.3, -0.06), e.add(s);
      break;
    }
    case "laptopBag": {
      const s = B(0.5, 0.34, 0.18, O(n.accent));
      s.position.set(0, 0.5, 0.22), t.add(s);
      const l = B(0.1, 0.6, 0.1, O("#1b1b1b"));
      l.position.set(0.34, 0.6, 0.1), t.add(l);
      break;
    }
  }
}
const be = {
  1945: {
    count: 4,
    outfits: [
      { skin: "#c9a68a", top: "#4a5a3a", bottom: "#3a4436", hair: "#2a2a2a", accent: "#5c4d3d", accessories: ["militaryCap"], pace: 1.05 },
      { skin: "#b8947a", top: "#6e6258", bottom: "#4a4038", hair: "#3b3228", accent: "#7a6a55", accessories: ["scarf"], pace: 1 },
      { skin: "#c9a68a", top: "#5a4a3c", bottom: "#3f3a2e", hair: "#2f2a26", accent: "#8a7f6d", accessories: ["militaryCap"], pace: 1.05 }
    ]
  },
  1965: {
    count: 4,
    outfits: [
      { skin: "#c9a68a", top: "#c05a3c", bottom: "#2f3b4a", hair: "#1f1f1f", accent: "#e0c060", accessories: ["modTie"], pace: 1.15 },
      { skin: "#d2b08c", top: "#e8d9c0", bottom: "#c05a3c", hair: "#b8860b", accent: "#d8a84f", accessories: [], pace: 1.1 },
      { skin: "#c9a68a", top: "#3a6b8a", bottom: "#3a3a3a", hair: "#222222", accent: "#e8e8e8", accessories: ["modTie"], pace: 1.15 }
    ]
  },
  1985: {
    count: 5,
    outfits: [
      { skin: "#c9a68a", top: "#e0457b", bottom: "#3a5a8a", hair: "#2a2a2a", accent: "#d8a84f", accessories: ["shoulderPads", "handbag"], pace: 1.1 },
      { skin: "#b8947a", top: "#5f6b74", bottom: "#38567e", hair: "#1f1f1f", accent: "#c02a2a", accessories: ["shoulderPads"], pace: 1.08 },
      { skin: "#d2b08c", top: "#e8e0d0", bottom: "#7a5a8a", hair: "#b8860b", accent: "#e0457b", accessories: ["shoulderPads", "handbag"], pace: 1.1 }
    ]
  },
  2005: {
    count: 5,
    outfits: [
      { skin: "#c9a68a", top: "#2f86c8", bottom: "#4a4a4a", hair: "#3b3228", accent: "#e8e8e8", accessories: ["handbag"], pace: 1.2 },
      { skin: "#b8947a", top: "#6b7d8c", bottom: "#5f5f5f", hair: "#2a2a2a", accent: "#cf6a3c", accessories: [], pace: 1.18 },
      { skin: "#d2b08c", top: "#e8e0d0", bottom: "#7d8b94", hair: "#b8860b", accent: "#2f86c8", accessories: ["handbag"], pace: 1.2 }
    ]
  },
  2025: {
    count: 5,
    outfits: [
      { skin: "#c9a68a", top: "#00d1ff", bottom: "#2a2a2a", hair: "#1f1f1f", accent: "#e8f0f4", accessories: ["phone", "laptopBag"], pace: 1.3 },
      { skin: "#b8947a", top: "#e8e0d0", bottom: "#3a3a4a", hair: "#3b3228", accent: "#00d1ff", accessories: ["phone"], pace: 1.28 },
      { skin: "#d2b08c", top: "#6b7d8c", bottom: "#2f3b4a", hair: "#b8860b", accent: "#f0a020", accessories: ["laptopBag"], pace: 1.3 }
    ]
  }
};
function ot() {
  const t = new i.Group();
  t.name = "era-pedestrians";
  let e = null, o = 0, n = null;
  const r = [];
  function s(l) {
    t.clear(), r.length = 0;
    const a = be[l.year];
    for (let d = 0; d < a.count; d += 1) {
      const c = d * 0.6180339887 % 1, f = a.outfits[Math.floor(c * a.outfits.length) % a.outfits.length], p = et(f, c + d * 0.37);
      t.add(p.root), r.push(p);
    }
    n = l.year;
  }
  return {
    get root() {
      return t;
    },
    get year() {
      return n;
    },
    bootstrap(l, a) {
      e = l;
      const d = a ?? L[1945];
      return e.add(t), s(d), this;
    },
    update(l, a) {
      var f, p;
      o += l, a.year !== n && s(a);
      const d = be[a.year], c = 6 * (((f = d.outfits[0]) == null ? void 0 : f.pace) ?? 1.1);
      for (const u of r) {
        const k = l * 1.6 * u.speedMul * (((p = d.outfits[0]) == null ? void 0 : p.pace) ?? 1.1) * u.dir;
        u.x += k, u.x > K ? (u.x = K, u.dir = -1) : u.x < -K && (u.x = -K, u.dir = 1);
        const w = o * c + u.phase, G = Math.sin(w) * 0.55, A = Math.sin(w);
        u.leftArm.rotation.x = G, u.rightArm.rotation.x = -G, u.leftLeg.rotation.x = -G * 0.9, u.rightLeg.rotation.x = G * 0.9, u.hip.position.y = Math.abs(A) * 0.06, u.root.position.set(u.x, 0, Qe), u.root.rotation.y = u.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      }
    },
    dispose() {
      e && e.remove(t), t.clear(), r.length = 0, e = null, n = null;
    }
  };
}
function ne(t, e, o) {
  const n = document.createElement("canvas");
  n.width = Math.max(1, Math.round(t)), n.height = Math.max(1, Math.round(e));
  const r = n.getContext("2d");
  if (!r)
    throw new Error("2D canvas context unavailable for signage texture");
  return o(r, n.width, n.height), n;
}
function se(t) {
  const e = new i.CanvasTexture(t);
  return e.colorSpace = i.SRGBColorSpace, e.anisotropy = 4, e.minFilter = i.LinearFilter, e.magFilter = i.LinearFilter, e;
}
const nt = {
  butcher: { label: "BUTCHER & SONS", window: "produce" },
  haberdasher: { label: "HABERDASHERY", window: "department" },
  bakery: { label: "BAKERY", window: "bakery" },
  hardware: { label: "HARDWARE", window: "hardware" },
  barber: { label: "BARBER", window: "barber" },
  diner: { label: "DINER", window: "diner" },
  departmentStore: { label: "DEPT STORE", window: "department" },
  gasStation: { label: "GAS", window: "gas" },
  recordStore: { label: "RECORDS", window: "video" },
  tvStore: { label: "TV & RADIO", window: "electronics" },
  videoStore: { label: "VIDEO", window: "video" },
  arcade: { label: "ARCADE", window: "arcade" },
  pizza: { label: "PIZZA", window: "pizza" },
  electronics: { label: "ELECTRONICS", window: "electronics" },
  coffee: { label: "COFFEE", window: "coffee" },
  pharmacy: { label: "PHARMACY", window: "pharmacy" },
  fastFood: { label: "FAST FOOD", window: "fastfood" },
  grocery: { label: "GROCERY", window: "grocery" },
  gym: { label: "FITNESS", window: "gym" },
  techShop: { label: "E-BIKE", window: "tech" },
  phoneStore: { label: "PHONES", window: "tech" }
}, le = {
  1945: {
    shops: ["butcher", "haberdasher", "hardware", "bakery"],
    awning: "#b33a2c",
    sign: "painted"
  },
  1965: {
    shops: ["recordStore", "tvStore", "diner", "gasStation"],
    awning: "#2f7fb8",
    sign: "neon"
  },
  1985: {
    shops: ["videoStore", "arcade", "pizza", "electronics"],
    awning: "#e0457b",
    sign: "plastic"
  },
  2005: {
    shops: ["coffee", "phoneStore", "pharmacy", "fastFood"],
    awning: "#2f86c8",
    sign: "vinyl"
  },
  2025: {
    shops: ["coffee", "techShop", "grocery", "gym"],
    awning: "#00d1ff",
    sign: "led"
  }
};
function st(t, e, o, n) {
  t.fillStyle = "#efe6cf", t.fillRect(0, 0, e, o), t.fillStyle = "#8a7a55", t.fillRect(0, o - 3, e, 3), t.fillStyle = "#3f3a2e", t.font = `bold ${Math.round(o * 0.42)}px Georgia, 'Times New Roman', serif`, t.textAlign = "center", t.textBaseline = "middle", t.fillText(n, e / 2, o / 2);
}
function at(t, e, o, n) {
  t.fillStyle = "#14141a", t.fillRect(0, 0, e, o), t.strokeStyle = "#ff4d5e", t.lineWidth = Math.max(1, o * 0.05), t.shadowColor = "#ff4d5e", t.shadowBlur = 6, t.font = `bold ${Math.round(o * 0.4)}px 'Courier New', monospace`, t.textAlign = "center", t.textBaseline = "middle", t.strokeText(n, e / 2, o / 2), t.shadowBlur = 0, t.fillStyle = "#ff8fa0", t.fillText(n, e / 2, o / 2);
}
function it(t, e, o, n) {
  const r = t.createLinearGradient(0, 0, 0, o);
  r.addColorStop(0, "#ffd23e"), r.addColorStop(0.5, "#ff7a1a"), r.addColorStop(1, "#e0457b"), t.fillStyle = r, t.fillRect(0, 0, e, o), t.fillStyle = "#fff8e0", t.font = `900 ${Math.round(o * 0.44)}px Arial, sans-serif`, t.textAlign = "center", t.textBaseline = "middle", t.fillText(n, e / 2 + 2, o / 2 + 2), t.fillStyle = "#1c1c2a", t.fillText(n, e / 2, o / 2);
}
function rt(t, e, o, n) {
  t.fillStyle = "#ffffff", t.fillRect(0, 0, e, o), t.fillStyle = "#1f3a5f", t.fillRect(0, 0, e, Math.round(o * 0.14)), t.fillStyle = "#0f2a4a", t.font = `bold ${Math.round(o * 0.4)}px Arial, sans-serif`, t.textAlign = "center", t.textBaseline = "middle", t.fillText(n, e / 2, o / 2);
}
function lt(t, e, o, n, r) {
  t.fillStyle = "#07070d", t.fillRect(0, 0, e, o);
  const s = Math.max(2, Math.round(o * 0.06)), l = s + Math.max(1, Math.round(s * 0.3));
  t.fillStyle = "#00d1ff";
  const a = Math.floor(e / l), d = Math.floor(o / l);
  for (let c = 0; c < d; c++)
    for (let f = 0; f < a; f++) {
      const p = f * l + l / 2, u = c * l + l / 2;
      (f * 7 + c * 13 + r) % 17 < 9 && t.fillRect(p - s / 2, u - s / 2, s, s);
    }
  r / 2 % 2 === 0 && (t.fillStyle = "#00d1ff", t.fillRect(e - Math.round(e * 0.06), Math.round(o * 0.3), Math.round(e * 0.04), Math.round(o * 0.4))), t.fillStyle = "#e6f9ff", t.font = `bold ${Math.round(o * 0.22)}px Arial, sans-serif`, t.textAlign = "center", t.textBaseline = "middle", t.fillText(n, e / 2, o * 0.78);
}
function dt(t, e, o, n) {
  const r = e.createLinearGradient(0, 0, o, n);
  switch (r.addColorStop(0, "rgba(190, 210, 225, 0.55)"), r.addColorStop(1, "rgba(140, 165, 190, 0.5)"), e.fillStyle = r, e.fillRect(0, 0, o, n), t) {
    case "produce": {
      e.fillStyle = "#7a2f1f";
      for (let s = 0; s < 5; s++)
        e.beginPath(), e.arc(o * (0.15 + s * 0.18), n * 0.62, o * 0.06, 0, Math.PI * 2), e.fill();
      e.fillStyle = "#3f8f2f";
      for (let s = 0; s < 4; s++)
        e.beginPath(), e.arc(o * (0.2 + s * 0.2), n * 0.3, o * 0.05, 0, Math.PI * 2), e.fill();
      break;
    }
    case "bakery": {
      e.fillStyle = "#c98a3a";
      for (let s = 0; s < 4; s++)
        e.fillRect(o * (0.12 + s * 0.2), n * 0.55, o * 0.12, n * 0.16);
      break;
    }
    case "hardware": {
      e.strokeStyle = "#6b6b6b", e.lineWidth = Math.max(1, o * 0.02);
      for (let s = 0; s < 4; s++)
        e.beginPath(), e.arc(o * (0.18 + s * 0.2), n * 0.55, o * 0.05, 0, Math.PI * 2), e.stroke();
      break;
    }
    case "barber": {
      e.fillStyle = "#d33a3a", e.fillRect(o * 0.42, n * 0.2, o * 0.16, n * 0.5), e.fillStyle = "#ffffff";
      for (let s = 0; s < 3; s++)
        e.fillRect(o * 0.44, n * (0.26 + s * 0.14), o * 0.12, n * 0.05);
      break;
    }
    case "diner":
    case "fastfood": {
      e.fillStyle = "#e8c06a", e.fillRect(o * 0.2, n * 0.4, o * 0.6, n * 0.3), e.fillStyle = "#7a2f1f", e.fillRect(o * 0.3, n * 0.46, o * 0.4, n * 0.12);
      break;
    }
    case "department": {
      e.fillStyle = "#b18a5a";
      for (let s = 0; s < 3; s++)
        e.fillRect(o * (0.15 + s * 0.28), n * 0.3, o * 0.14, n * 0.5);
      break;
    }
    case "gas": {
      e.fillStyle = "#c33", e.fillRect(o * 0.3, n * 0.3, o * 0.4, n * 0.45), e.fillStyle = "#fff", e.font = `bold ${Math.round(n * 0.3)}px Arial`, e.textAlign = "center", e.textBaseline = "middle", e.fillText("GAS", o / 2, n / 2);
      break;
    }
    case "video": {
      e.fillStyle = "#3a3a4a";
      for (let s = 0; s < 4; s++)
        e.fillRect(o * (0.1 + s * 0.21), n * 0.35, o * 0.13, n * 0.4);
      break;
    }
    case "arcade": {
      e.fillStyle = "#ff4d5e", e.fillRect(o * 0.2, n * 0.25, o * 0.6, n * 0.55), e.fillStyle = "#ffe14d", e.font = `bold ${Math.round(n * 0.3)}px Arial`, e.textAlign = "center", e.textBaseline = "middle", e.fillText("GAME", o / 2, n / 2);
      break;
    }
    case "pizza": {
      e.fillStyle = "#e8b04a", e.beginPath(), e.moveTo(o * 0.3, n * 0.25), e.lineTo(o * 0.7, n * 0.25), e.lineTo(o * 0.5, n * 0.8), e.closePath(), e.fill();
      break;
    }
    case "electronics": {
      e.fillStyle = "#2b2b33", e.fillRect(o * 0.2, n * 0.25, o * 0.6, n * 0.4), e.fillStyle = "#7fd0ff", e.fillRect(o * 0.26, n * 0.32, o * 0.48, n * 0.18);
      break;
    }
    case "coffee": {
      e.fillStyle = "#5a3a22", e.fillRect(o * 0.35, n * 0.3, o * 0.3, n * 0.45), e.fillStyle = "#fff", e.font = `bold ${Math.round(n * 0.25)}px Arial`, e.textAlign = "center", e.textBaseline = "middle", e.fillText("COFFEE", o / 2, n / 2);
      break;
    }
    case "pharmacy": {
      e.fillStyle = "#1f7fb8", e.fillRect(o * 0.3, n * 0.3, o * 0.4, n * 0.4), e.fillStyle = "#fff", e.font = `bold ${Math.round(n * 0.22)}px Arial`, e.textAlign = "center", e.textBaseline = "middle", e.fillText("RX", o / 2, n / 2);
      break;
    }
    case "grocery": {
      e.fillStyle = "#3f8f3f", e.fillRect(o * 0.12, n * 0.4, o * 0.2, n * 0.3), e.fillStyle = "#c94a2a", e.fillRect(o * 0.42, n * 0.4, o * 0.2, n * 0.3), e.fillStyle = "#e8c04a", e.fillRect(o * 0.72, n * 0.4, o * 0.2, n * 0.3);
      break;
    }
    case "gym": {
      e.fillStyle = "#33333d", e.fillRect(o * 0.15, n * 0.2, o * 0.7, n * 0.6), e.fillStyle = "#e0457b", e.font = `bold ${Math.round(n * 0.3)}px Arial`, e.textAlign = "center", e.textBaseline = "middle", e.fillText("GYM", o / 2, n / 2);
      break;
    }
    case "tech": {
      e.fillStyle = "#0f0f16", e.fillRect(o * 0.1, n * 0.2, o * 0.8, n * 0.6), e.fillStyle = "#00d1ff", e.font = `bold ${Math.round(n * 0.26)}px Arial`, e.textAlign = "center", e.textBaseline = "middle", e.fillText("E-BIKE", o / 2, n / 2);
      break;
    }
  }
  e.fillStyle = "rgba(255,255,255,0.18)", e.fillRect(o * 0.08, n * 0.12, o * 0.1, n * 0.76);
}
const ye = 3.2, we = 3.6, ee = 2.2, te = 0.7, de = 0.5, oe = 1.7, ce = 1.5;
function ct() {
  let t = [], e = null, o = null, n = 0;
  function r(s, l) {
    const a = le[s], d = a.shops[l % a.shops.length], c = nt[d], f = new i.Group(), p = (l - (a.shops.length - 1) / 2) * ye, u = ne(ee * 128, te * 128, (h, R, S) => {
      switch (a.sign) {
        case "painted":
          st(h, R, S, c.label);
          break;
        case "neon":
          at(h, R, S, c.label);
          break;
        case "plastic":
          it(h, R, S, c.label);
          break;
        case "vinyl":
          rt(h, R, S, c.label);
          break;
        case "led":
          lt(h, R, S, c.label, n);
          break;
      }
    }), k = se(u), w = new i.Mesh(
      new i.PlaneGeometry(ee, te),
      new i.MeshStandardMaterial({ map: k })
    );
    w.position.set(p, we - te / 2 - 0.1, 0.02);
    const G = ne(ee * 96, de * 96, (h, R, S) => {
      const H = Math.max(2, Math.round(R / 10));
      for (let D = 0; D * H < R; D++)
        h.fillStyle = D % 2 === 0 ? a.awning : "#e8e2d6", h.fillRect(D * H, 0, H, S);
    }), A = se(G), g = new i.Mesh(
      new i.PlaneGeometry(ee, de),
      new i.MeshStandardMaterial({ map: A })
    );
    g.position.set(p, we - te - de / 2 - 0.12, 0.02);
    const I = ne(oe * 128, ce * 128, (h, R, S) => {
      dt(c.window, h, R, S);
    }), E = se(I), N = new i.Mesh(
      new i.PlaneGeometry(oe, ce),
      new i.MeshStandardMaterial({ map: E, transparent: !0 })
    );
    N.position.set(p - oe / 4 - 0.05, ce / 2 + 0.1, 0.02);
    const m = new i.Mesh(
      new i.BoxGeometry(0.7, 1.9, 0.1),
      new i.MeshStandardMaterial({ color: 3813158, roughness: 0.6 })
    );
    return m.position.set(p + oe / 4 + 0.2, 1.9 / 2 + 0.1, 0.02), f.add(w, g, N, m), {
      group: f,
      signMesh: w,
      signTexture: k,
      awningMesh: g,
      windowMesh: N,
      width: ye,
      era: s
    };
  }
  return {
    get rigs() {
      return t;
    },
    bootstrap(s) {
      const l = e ?? 1945;
      e = l, o = s, t = le[l].shops.map((d, c) => r(l, c));
      for (const d of t)
        s.add(d.group);
      return t;
    },
    update(s) {
      n += 1, e = s;
      const a = le[s].shops.map((d, c) => r(s, c));
      for (const d of t)
        d.group.parent && d.group.parent.remove(d.group);
      if (t = a, o)
        for (const d of t)
          o.add(d.group);
      return t;
    },
    dispose() {
      for (const s of t)
        s.group.parent && s.group.parent.remove(s.group);
      t = [], e = null, o = null;
    }
  };
}
function ft() {
  return ct();
}
const pt = {
  soap: { headline: "CLEAN SOAP", sub: "FOR EVERY HOME", color: "#c9a24a" },
  tires: { headline: "DURABLE TIRES", sub: "RIDE SMOOTH", color: "#b33a2c" },
  cola: { headline: "COLA", sub: "ICE COLD", color: "#c03a2a" },
  auto: { headline: "AUTO & MOTORS", sub: "SINCE 1950", color: "#e0457b" },
  tv: { headline: "COLOR TV", sub: "NOW IN STORES", color: "#ff7a1a" },
  video: { headline: "VIDEO RENTAL", sub: "ALL NIGHT", color: "#ffd23e" },
  arcade: { headline: "ARCADE", sub: "PLAY TODAY", color: "#e0457b" },
  phone: { headline: "CELL PHONES", sub: "UNLIMITED DATA", color: "#2f86c8" },
  coffee: { headline: "COFFEE", sub: "FRESH DAILY", color: "#5a3a22" },
  financial: { headline: "BANK & LOAN", sub: "OPEN LATE", color: "#1f7fb8" },
  ebike: { headline: "E-BIKES", sub: "GO ELECTRIC", color: "#00d1ff" },
  streaming: { headline: "STREAM NOW", sub: "ANY DEVICE", color: "#ff4d5e" }
}, fe = {
  1945: {
    ads: ["soap", "tires"],
    mode: "painted",
    backdrop: "#8a6a4a"
  },
  1965: {
    ads: ["cola", "auto"],
    mode: "neon",
    backdrop: "#14141a"
  },
  1985: {
    ads: ["tv", "video", "arcade"],
    mode: "poster",
    backdrop: "#e8e0d0"
  },
  2005: {
    ads: ["phone", "coffee", "financial"],
    mode: "backlit",
    backdrop: "#f4f6fa"
  },
  2025: {
    ads: ["ebike", "streaming", "financial"],
    mode: "digital",
    backdrop: "#0a0a12"
  }
};
function ut(t, e, o, n) {
  t.fillStyle = "#8a6a4a", t.fillRect(0, 0, e, o), t.strokeStyle = "rgba(60,40,30,0.5)", t.lineWidth = Math.max(1, o * 8e-3);
  const r = Math.max(6, Math.round(o / 14));
  for (let s = 0; s < o; s += r) {
    t.beginPath(), t.moveTo(0, s), t.lineTo(e, s), t.stroke();
    const l = s / r % 2 === 0 ? r / 2 : 0;
    for (let a = l; a < e; a += r * 2)
      t.beginPath(), t.moveTo(a, s), t.lineTo(a, s + r), t.stroke();
  }
  t.fillStyle = "#efe6cf", t.fillRect(0, o * 0.08, e, o * 0.14), t.fillStyle = n.color, t.font = `bold ${Math.round(o * 0.2)}px Georgia, serif`, t.textAlign = "center", t.textBaseline = "middle", t.fillText(n.headline, e / 2, o * 0.15), t.fillStyle = "#3f3a2e", t.font = `${Math.round(o * 0.11)}px Georgia, serif`, t.fillText(n.sub, e / 2, o * 0.6);
}
function ht(t, e, o, n) {
  t.fillStyle = "#14141a", t.fillRect(0, 0, e, o), t.strokeStyle = n.color, t.lineWidth = Math.max(2, o * 0.03), t.shadowColor = n.color, t.shadowBlur = 8, t.font = `bold ${Math.round(o * 0.32)}px 'Courier New', monospace`, t.textAlign = "center", t.textBaseline = "middle", t.strokeText(n.headline, e / 2, o * 0.35), t.shadowBlur = 0, t.fillStyle = "#ffffff", t.font = `${Math.round(o * 0.12)}px 'Courier New', monospace`, t.fillText(n.sub, e / 2, o * 0.72);
}
function mt(t, e, o, n) {
  t.fillStyle = "#e8e0d0", t.fillRect(0, 0, e, o), t.fillStyle = n.color, t.fillRect(0, o * 0.18, e, o * 0.3), t.fillStyle = "#1c1c2a", t.font = `900 ${Math.round(o * 0.22)}px Arial, sans-serif`, t.textAlign = "center", t.textBaseline = "middle", t.fillText(n.headline, e / 2, o * 0.33), t.fillStyle = "#5a5a5a", t.font = `${Math.round(o * 0.12)}px Arial, sans-serif`, t.fillText(n.sub, e / 2, o * 0.72);
}
function gt(t, e, o, n) {
  const r = t.createLinearGradient(0, 0, e, o);
  r.addColorStop(0, "#ffffff"), r.addColorStop(1, "#e8eef6"), t.fillStyle = r, t.fillRect(0, 0, e, o), t.fillStyle = n.color, t.fillRect(0, 0, e, Math.round(o * 0.05)), t.fillRect(0, o - Math.round(o * 0.05), e, Math.round(o * 0.05)), t.fillStyle = "#0f2a4a", t.font = `bold ${Math.round(o * 0.24)}px Arial, sans-serif`, t.textAlign = "center", t.textBaseline = "middle", t.fillText(n.headline, e / 2, o * 0.4), t.fillStyle = "#3a5a7a", t.font = `${Math.round(o * 0.12)}px Arial, sans-serif`, t.fillText(n.sub, e / 2, o * 0.72);
}
function bt(t, e, o, n, r) {
  t.fillStyle = "#0a0a12", t.fillRect(0, 0, e, o);
  const s = Math.max(2, Math.round(o * 0.05)), l = s + Math.max(1, Math.round(s * 0.3));
  t.fillStyle = n.color;
  const a = Math.floor(e / l), d = Math.floor(o / l);
  for (let p = 0; p < d; p++)
    for (let u = 0; u < a; u++) {
      const k = u * l + l / 2, w = p * l + l / 2;
      (u * 5 + p * 9 + r) % 13 < 7 && t.fillRect(k - s / 2, w - s / 2, s, s);
    }
  const c = r % 24 / 24 * e, f = t.createLinearGradient(c - e * 0.15, 0, c + e * 0.15, 0);
  f.addColorStop(0, "rgba(255,255,255,0)"), f.addColorStop(0.5, "rgba(255,255,255,0.35)"), f.addColorStop(1, "rgba(255,255,255,0)"), t.fillStyle = f, t.fillRect(0, 0, e, o), t.fillStyle = "#ffffff", t.font = `bold ${Math.round(o * 0.2)}px Arial, sans-serif`, t.textAlign = "center", t.textBaseline = "middle", t.fillText(n.headline, e / 2, o * 0.4), t.fillStyle = "#9fd8ff", t.font = `${Math.round(o * 0.11)}px Arial, sans-serif`, t.fillText(n.sub, e / 2, o * 0.74);
}
const Me = 4.4, Se = 2.4;
function yt() {
  let t = [], e = null, o = null, n = 0;
  function r(s, l) {
    const a = fe[s], d = pt[a.ads[l % a.ads.length]], c = new i.Group(), f = ne(Me * 128, Se * 128, (A, g, I) => {
      switch (a.mode) {
        case "painted":
          ut(A, g, I, d);
          break;
        case "neon":
          ht(A, g, I, d);
          break;
        case "poster":
          mt(A, g, I, d);
          break;
        case "backlit":
          gt(A, g, I, d);
          break;
        case "digital":
          bt(A, g, I, d, n);
          break;
      }
    }), p = se(f), u = new i.Mesh(
      new i.PlaneGeometry(Me, Se),
      new i.MeshStandardMaterial({ map: p })
    ), k = (l - 1) * 6, w = 4.2 + l % 2 * 1.6, G = new i.Vector3(k, w, 6.5);
    return u.position.copy(G), c.add(u), { group: c, panel: u, texture: p, position: G, era: s };
  }
  return {
    get rigs() {
      return t;
    },
    bootstrap(s) {
      const l = e ?? 1945;
      e = l, o = s, t = fe[l].ads.map((d, c) => r(l, c));
      for (const d of t)
        s.add(d.group);
      return t;
    },
    update(s) {
      n += 1, e = s;
      const a = fe[s].ads.map((d, c) => r(s, c));
      for (const d of t)
        d.group.parent && d.group.parent.remove(d.group);
      if (t = a, o)
        for (const d of t)
          o.add(d.group);
      return t;
    },
    dispose() {
      for (const s of t)
        s.group.parent && s.group.parent.remove(s.group);
      t = [], e = null, o = null;
    }
  };
}
function wt() {
  return yt();
}
const ie = {
  gas: { emissive: 16761963, material: 3813156, head: "globe" },
  mercury: { emissive: 13625087, material: 4870744, head: "globe" },
  sodium: { emissive: 16755021, material: 3947580, head: "cobra" },
  led: { emissive: 15398655, material: 3027510, head: "panel" }
}, Mt = {
  1945: {
    year: 1945,
    lamp: "gas",
    lampCount: 3,
    hydrants: 2,
    phoneBooths: 1,
    meters: 2,
    benches: 2,
    trashCans: 2,
    treeGrowth: 0.45,
    trees: 3,
    bikeRacks: 0,
    evChargers: 0,
    litter: 4,
    graffiti: 0
  },
  1965: {
    year: 1965,
    lamp: "mercury",
    lampCount: 3,
    hydrants: 2,
    phoneBooths: 3,
    meters: 4,
    benches: 2,
    trashCans: 2,
    treeGrowth: 0.7,
    trees: 3,
    bikeRacks: 0,
    evChargers: 0,
    litter: 8,
    graffiti: 1
  },
  1985: {
    year: 1985,
    lamp: "sodium",
    lampCount: 3,
    hydrants: 2,
    phoneBooths: 6,
    meters: 5,
    benches: 3,
    trashCans: 3,
    treeGrowth: 0.85,
    trees: 4,
    bikeRacks: 1,
    evChargers: 0,
    litter: 14,
    graffiti: 3
  },
  2005: {
    year: 2005,
    lamp: "sodium",
    lampCount: 3,
    hydrants: 2,
    phoneBooths: 2,
    meters: 5,
    benches: 3,
    trashCans: 3,
    treeGrowth: 1,
    trees: 4,
    bikeRacks: 2,
    evChargers: 0,
    litter: 10,
    graffiti: 2
  },
  2025: {
    year: 2025,
    lamp: "led",
    lampCount: 4,
    hydrants: 2,
    phoneBooths: 0,
    meters: 3,
    benches: 3,
    trashCans: 3,
    treeGrowth: 1.15,
    trees: 5,
    bikeRacks: 3,
    evChargers: 3,
    litter: 5,
    graffiti: 1
  }
};
function y(t, e = 0.85) {
  return new i.MeshStandardMaterial({ color: t, roughness: e });
}
function St(t, e) {
  const o = ie[t.lamp], n = new i.Group(), r = new i.Mesh(
    new i.CylinderGeometry(0.08, 0.12, 4.6, 8),
    y(o.material, 0.95)
  );
  r.position.set(0, 2.3, 0), n.add(r);
  const s = new i.Mesh(
    new i.CylinderGeometry(0.04, 0.04, 0.9, 6),
    y(o.material, 0.95)
  );
  s.position.set(0.35, 4.5, 0), s.rotation.z = Math.PI / 2, n.add(s);
  const l = new i.MeshStandardMaterial({
    color: o.material,
    emissive: o.emissive,
    emissiveIntensity: 2.4,
    roughness: 0.4
  }), a = new i.Mesh(new i.SphereGeometry(0.16, 12, 10), l);
  return a.position.set(0.35, 4.95, 0), n.add(a), e.push({ year: t.year, material: l, color: new i.Color(o.emissive) }), n;
}
function Ct(t, e) {
  const o = ie[t.lamp], n = new i.Group(), r = new i.Mesh(
    new i.CylinderGeometry(0.09, 0.13, 5.4, 8),
    y(o.material, 0.95)
  );
  r.position.set(0, 2.7, 0), n.add(r);
  const s = new i.Mesh(
    new i.CylinderGeometry(0.05, 0.05, 1, 6),
    y(o.material, 0.95)
  );
  s.position.set(0.45, 5.2, 0), s.rotation.z = Math.PI / 2, n.add(s);
  const l = new i.MeshStandardMaterial({
    color: o.material,
    emissive: o.emissive,
    emissiveIntensity: 2.6,
    roughness: 0.4
  }), a = new i.Mesh(new i.CylinderGeometry(0.16, 0.2, 0.35, 8), l);
  return a.position.set(0.5, 5.15, 0), n.add(a), e.push({ year: t.year, material: l, color: new i.Color(o.emissive) }), n;
}
function vt(t, e) {
  const o = ie[t.lamp], n = new i.Group(), r = new i.Mesh(
    new i.CylinderGeometry(0.06, 0.09, 5.8, 8),
    y(o.material, 0.9)
  );
  r.position.set(0, 2.9, 0), n.add(r);
  const s = new i.Mesh(
    new i.CylinderGeometry(0.04, 0.04, 0.9, 6),
    y(o.material, 0.9)
  );
  s.position.set(0.4, 5.7, 0), s.rotation.z = Math.PI / 2, n.add(s);
  const l = new i.MeshStandardMaterial({
    color: o.material,
    emissive: o.emissive,
    emissiveIntensity: 2.8,
    roughness: 0.35
  }), a = new i.Mesh(new i.BoxGeometry(0.5, 0.12, 0.22), l);
  return a.position.set(0.45, 5.6, 0), n.add(a), e.push({ year: t.year, material: l, color: new i.Color(o.emissive) }), n;
}
function kt(t, e) {
  switch (ie[t.lamp].head) {
    case "globe":
      return St(t, e);
    case "cobra":
      return Ct(t, e);
    case "panel":
    default:
      return vt(t, e);
  }
}
function Gt() {
  const t = new i.Group(), e = new i.Mesh(
    new i.CylinderGeometry(0.22, 0.26, 0.85, 10),
    y(11739178, 1)
  );
  e.position.set(0, 0.42, 0), t.add(e);
  const o = new i.Mesh(new i.SphereGeometry(0.16, 10, 8), y(11739178, 1));
  o.position.set(0, 0.86, 0), t.add(o);
  const n = new i.Mesh(
    new i.CylinderGeometry(0.09, 0.09, 0.3, 8),
    y(9072431, 1)
  );
  return n.position.set(0.18, 0.6, 0), n.rotation.z = Math.PI / 2, t.add(n), t;
}
function Rt() {
  const t = new i.Group(), e = new i.Mesh(
    new i.BoxGeometry(0.9, 2.2, 0.06),
    y(3824248, 0.5)
  );
  e.position.set(0, 1.1, 0), t.add(e);
  const o = new i.Mesh(
    new i.BoxGeometry(0.9, 2, 0.04),
    y(10470104, 0.2)
  );
  o.position.set(0, 1.1, 0.02), t.add(o);
  const n = new i.Mesh(
    new i.BoxGeometry(1, 0.08, 0.5),
    y(3029578, 0.6)
  );
  n.position.set(0, 2.2, 0), t.add(n);
  const r = new i.Mesh(
    new i.BoxGeometry(0.5, 0.5, 0.05),
    y(2237994, 0.4)
  );
  return r.position.set(0, 1.35, 0.06), t.add(r), t;
}
function At() {
  const t = new i.Group(), e = new i.Mesh(
    new i.CylinderGeometry(0.03, 0.03, 1.1, 6),
    y(5921370, 0.9)
  );
  e.position.set(0, 0.55, 0), t.add(e);
  const o = new i.Mesh(new i.BoxGeometry(0.16, 0.3, 0.12), y(8026746, 0.7));
  o.position.set(0, 1.15, 0), t.add(o);
  const n = new i.Mesh(new i.BoxGeometry(0.14, 0.12, 0.02), y(13620957, 0.3));
  return n.position.set(0, 1.18, 0.07), t.add(n), t;
}
function Et() {
  const t = new i.Group(), e = new i.Mesh(new i.BoxGeometry(1.4, 0.08, 0.5), y(7031343, 0.9));
  e.position.set(0, 0.5, 0), t.add(e);
  const o = new i.Mesh(new i.BoxGeometry(1.4, 0.55, 0.06), y(7031343, 0.9));
  o.position.set(0, 0.85, -0.22), t.add(o);
  for (const n of [-0.2, 0.2]) {
    const r = new i.Mesh(new i.BoxGeometry(0.06, 0.5, 0.4), y(4868682, 0.8));
    r.position.set(-0.6, 0.25, n), t.add(r);
    const s = new i.Mesh(new i.BoxGeometry(0.06, 0.5, 0.4), y(4868682, 0.8));
    s.position.set(0.6, 0.25, n), t.add(s);
  }
  return t;
}
function It() {
  const t = new i.Group(), e = new i.Mesh(
    new i.CylinderGeometry(0.28, 0.3, 0.8, 10),
    y(4147770, 0.9)
  );
  e.position.set(0, 0.4, 0), t.add(e);
  const o = new i.Mesh(new i.SphereGeometry(0.3, 10, 6), y(4871493, 0.9));
  return o.position.set(0, 0.82, 0), o.rotation.x = Math.PI, t.add(o), t;
}
function Tt(t) {
  const e = new i.Group(), o = 1.6 + t * 1.6, n = 0.1 + t * 0.12, r = new i.Mesh(
    new i.CylinderGeometry(n * 0.7, n, o, 8),
    y(5915696, 0.95)
  );
  r.position.set(0, o / 2, 0), e.add(r);
  const s = 0.9 + t * 1.1, l = new i.Mesh(
    new i.SphereGeometry(s, 12, 10),
    y(4156210, 1)
  );
  return l.position.set(0, o + s * 0.6, 0), e.add(l), e;
}
function Bt() {
  const t = new i.Group(), e = new i.Mesh(new i.CylinderGeometry(0.04, 0.04, 1.8, 8), y(10133670, 0.7));
  e.position.set(0, 0.85, 0), t.add(e);
  for (const o of [-0.4, 0.4]) {
    const n = new i.Mesh(new i.CylinderGeometry(0.04, 0.04, 0.85, 6), y(10133670, 0.7));
    n.position.set(0, 0.42, o), t.add(n);
  }
  return t;
}
function Pt() {
  const t = new i.Group(), e = new i.Mesh(new i.BoxGeometry(0.4, 1.1, 0.3), y(2042167, 0.6));
  e.position.set(0, 0.55, 0), t.add(e);
  const o = new i.Mesh(new i.BoxGeometry(0.2, 0.28, 0.03), y(790034, 0.2));
  o.position.set(0, 0.8, 0.16), t.add(o);
  const n = new i.MeshStandardMaterial({ color: 2042167, emissive: 53759, emissiveIntensity: 1.8 }), r = new i.Mesh(new i.BoxGeometry(0.16, 0.05, 0.02), n);
  return r.position.set(0, 0.62, 0.16), t.add(r), t;
}
function Ht(t) {
  const e = new i.Group();
  for (let o = 0; o < t; o++) {
    const n = 0.04 + o % 3 * 0.015, r = new i.Mesh(
      new i.BoxGeometry(n, 0.015, n * 0.7),
      y([13620957, 12106946, 10260346, 8030874][o % 4], 0.6)
    );
    r.position.set(o % 5 * 0.3 - 0.6, 0.01, (o % 2 === 0 ? 1 : -1) * (0.2 + 0.4 * (o % 3))), r.rotation.y = o * 0.9, e.add(r);
  }
  return e;
}
function Dt(t) {
  const e = new i.Group();
  if (t === 0)
    return e;
  const o = new i.Mesh(new i.BoxGeometry(6, 1.1, 0.15), y(9077624, 0.9));
  o.position.set(0, 0.55, 0), e.add(o);
  const n = [14697851, 3114696, 15909179, 8015824, 4174447, 15035167], r = t * 4;
  for (let s = 0; s < r; s++) {
    const l = new i.Mesh(
      new i.BoxGeometry(0.5 + s % 3 * 0.2, 0.25 + s % 2 * 0.2, 0.02),
      y(n[s % n.length], 0.5)
    );
    l.position.set(-2.6 + s % 5 * 1.3, 0.4 + s % 2 * 0.35, 0.085), e.add(l);
  }
  return e;
}
function Ot(t, e) {
  const o = new i.Group(), n = /* @__PURE__ */ new Set(), r = (a, d) => d * (1.6 + a % 3 * 0.25);
  for (let a = 0; a < t.lampCount; a++) {
    const d = kt(t, e);
    d.position.set(r(a, a % 2 === 0 ? -1 : 1), 0, -10 + a * 6.5), o.add(d);
  }
  n.add(t.lamp === "gas" ? "gasLamp" : t.lamp === "mercury" ? "mercuryLamp" : t.lamp === "sodium" ? "sodiumLamp" : "ledLamp");
  for (let a = 0; a < t.hydrants; a++) {
    const d = Gt();
    d.position.set(0.4 + a * 1.2, 0, -9 + a * 7), o.add(d);
  }
  n.add("hydrant");
  for (let a = 0; a < t.phoneBooths; a++) {
    const d = Rt();
    d.position.set(-3.2 + a % 3 * 1.1, 0, -8 + Math.floor(a / 3) * 2.4), o.add(d);
  }
  t.phoneBooths > 0 && n.add("phoneBooth");
  for (let a = 0; a < t.meters; a++) {
    const d = At();
    d.position.set(2 + a % 3 * 0.9, 0, -7 + a * 3.4), o.add(d);
  }
  t.meters > 0 && n.add("parkingMeter");
  for (let a = 0; a < t.benches; a++) {
    const d = Et();
    d.position.set(-1.8 - a % 2 * 0.4, 0, -6 + a * 5), o.add(d);
  }
  n.add("bench");
  for (let a = 0; a < t.trashCans; a++) {
    const d = It();
    d.position.set(2.6 + a * 0.5, 0, -4 + a * 4), o.add(d);
  }
  n.add("trashCan");
  for (let a = 0; a < t.trees; a++) {
    const d = Tt(t.treeGrowth);
    d.position.set(r(a, a % 2 === 0 ? 1 : -1), 0, -11 + a * 5.5), o.add(d);
  }
  n.add("tree");
  for (let a = 0; a < t.bikeRacks; a++) {
    const d = Bt();
    d.position.set(-2.2 - a * 0.3, 0, -3 + a * 3), o.add(d);
  }
  t.bikeRacks > 0 && n.add("bikeRack");
  for (let a = 0; a < t.evChargers; a++) {
    const d = Pt();
    d.position.set(2.4 + a * 0.6, 0, -1 + a * 2.2), o.add(d);
  }
  t.evChargers > 0 && n.add("evCharger");
  const s = Ht(t.litter);
  s.position.set(0, 0, 8), o.add(s), t.litter > 0 && n.add("litter");
  const l = Dt(t.graffiti);
  return l.position.set(0, 0, 11), o.add(l), t.graffiti > 0 && n.add("graffiti"), { group: o, ids: [...n] };
}
function Lt(t) {
  const e = new i.Group(), o = [], n = {};
  let r = 1945;
  for (const l of [1945, 1965, 1985, 2005, 2025]) {
    const a = Mt[l], { group: d, ids: c } = Ot(a, o);
    d.visible = l === 1945, n[l] = d, e.add(d), L[l].streetProps = c;
  }
  return t.add(e), {
    group: e,
    lampEmissives: o,
    get currentYear() {
      return r;
    },
    update(l) {
      l !== r && (n[r].visible = !1, n[l].visible = !0, r = l);
    },
    dispose() {
      t.remove(e);
      for (const l of [1945, 1965, 1985, 2005, 2025])
        L[l].streetProps = [];
      o.length = 0;
    }
  };
}
const Y = {
  1945: {
    year: 1945,
    skyTop: 11051156,
    skyHorizon: 14077368,
    fogColor: 13222576,
    fogDensity: 16e-4,
    sunElevation: 26,
    sunAzimuth: 128,
    ambientIntensity: 0.55,
    hemiSky: 16115408,
    hemiGround: 9076589,
    sunIntensity: 1.9,
    sunColor: 16768936,
    toneMapping: i.ReinhardToneMapping,
    exposure: 1.05,
    grain: 0.35,
    sepia: 0.55,
    mood: "clear warm sepia morning"
  },
  1965: {
    year: 1965,
    skyTop: 9414333,
    skyHorizon: 12171180,
    fogColor: 10987164,
    fogDensity: 45e-4,
    sunElevation: 55,
    sunAzimuth: 145,
    ambientIntensity: 0.5,
    hemiSky: 13623534,
    hemiGround: 9276292,
    sunIntensity: 1.4,
    sunColor: 16773328,
    toneMapping: i.ReinhardToneMapping,
    exposure: 0.95,
    grain: 0.22,
    sepia: 0.25,
    mood: "smoggy mid-century grey-blue"
  },
  1985: {
    year: 1985,
    skyTop: 7310502,
    skyHorizon: 10524802,
    fogColor: 9735028,
    fogDensity: 55e-4,
    sunElevation: 48,
    sunAzimuth: 160,
    ambientIntensity: 0.48,
    hemiSky: 15126446,
    hemiGround: 7303022,
    sunIntensity: 1.3,
    sunColor: 16769200,
    toneMapping: i.ReinhardToneMapping,
    exposure: 0.9,
    grain: 0.2,
    sepia: 0.18,
    mood: "dense urban smog with sodium haze"
  },
  2005: {
    year: 2005,
    skyTop: 4161471,
    skyHorizon: 10470368,
    fogColor: 12113642,
    fogDensity: 12e-4,
    sunElevation: 62,
    sunAzimuth: 175,
    ambientIntensity: 0.45,
    hemiSky: 13625592,
    hemiGround: 6250334,
    sunIntensity: 1.7,
    sunColor: 16777215,
    toneMapping: i.ACESFilmicToneMapping,
    exposure: 0.82,
    grain: 0.08,
    sepia: 0,
    mood: "clear bright modern blue"
  },
  2025: {
    year: 2025,
    skyTop: 3108016,
    skyHorizon: 11062248,
    fogColor: 12902128,
    fogDensity: 9e-4,
    sunElevation: 68,
    sunAzimuth: 190,
    ambientIntensity: 0.42,
    hemiSky: 13625594,
    hemiGround: 5197646,
    sunIntensity: 1.8,
    sunColor: 15989247,
    toneMapping: i.ACESFilmicToneMapping,
    exposure: 0.78,
    grain: 0.02,
    sepia: 0,
    mood: "crisp clean contemporary blue"
  }
}, Ce = [1945, 1965, 1985, 2005, 2025], pe = Math.PI / 180;
function ve(t) {
  const e = document.createElement("canvas");
  e.width = 512, e.height = 256;
  const o = e.getContext("2d");
  if (!o)
    return e;
  const n = new i.Color(t.skyTop), r = new i.Color(t.skyHorizon), s = o.createLinearGradient(0, 0, 0, e.height);
  if (s.addColorStop(0, `#${n.getHexString()}`), s.addColorStop(1, `#${r.getHexString()}`), o.fillStyle = s, o.fillRect(0, 0, e.width, e.height), t.grain > 0 || t.sepia > 0) {
    const f = o.createImageData(e.width, e.height);
    for (let p = 0; p < f.data.length; p += 4) {
      const u = (Math.random() * 2 - 1) * 28 * t.grain, w = Math.floor(p / 4 / e.width) / e.height, G = t.sepia;
      f.data[p] = f.data[p + 1] = f.data[p + 2] = 0, f.data[p] += u, f.data[p + 1] += u * 0.9 + G * 12 * w, f.data[p + 2] += u * 0.6 + G * 4 * w, f.data[p + 3] = Math.min(255, (t.grain * 0.55 + w * 0.35 + G * 0.25) * 90);
    }
    o.putImageData(f, 0, 0);
  }
  const l = e.width * (0.5 + Math.cos(t.sunAzimuth * pe * 0.9) * 0.22), a = e.height * (0.72 - t.sunElevation / 90 * 0.9), d = new i.Color(t.sunColor), c = o.createRadialGradient(l, a, 2, l, a, 90);
  return c.addColorStop(0, "rgba(255,255,255,0.65)"), c.addColorStop(0.25, `rgba(${d.r * 255 | 0},${d.g * 255 | 0},${d.b * 255 | 0},0.35)`), c.addColorStop(1, "rgba(255,255,255,0)"), o.fillStyle = c, o.fillRect(0, 0, e.width, e.height), e;
}
function Nt(t) {
  const { scene: e, renderer: o } = t, n = new i.Group();
  let r = 1945;
  const s = new i.AmbientLight(16777215, 1);
  n.add(s);
  const l = new i.HemisphereLight(16777215, 8026746, 1);
  l.position.set(0, 20, 0), n.add(l);
  const a = new i.DirectionalLight(16777215, 1);
  e.add(a.target), a.target.position.set(0, 0, 0), n.add(a), n.traverse((m) => {
    m.isMesh && (m.visible = !0);
  });
  const d = ve(Y[1945]), c = new i.CanvasTexture(d);
  c.colorSpace = i.SRGBColorSpace;
  const f = new i.MeshBasicMaterial({
    map: c,
    side: i.BackSide,
    fog: !1,
    toneMapped: !0
  }), p = new i.Mesh(new i.SphereGeometry(420, 24, 12), f);
  p.renderOrder = -1, e.add(p);
  const u = new i.Fog(13222576, 1, 2e3);
  e.fog = u;
  const k = {
    ...Y[1945],
    fogEnabled: Y[1945].fogDensity > 0
  };
  let w = Y[1945], G = Y[1945], A = -1;
  const g = 900;
  for (const m of Ce) {
    const h = Y[m];
    L[m].atmosphere = {
      skyTop: `#${new i.Color(h.skyTop).getHexString()}`,
      skyHorizon: `#${new i.Color(h.skyHorizon).getHexString()}`,
      fogColor: `#${new i.Color(h.fogColor).getHexString()}`,
      fogDensity: h.fogDensity,
      sunElevation: h.sunElevation,
      sunAzimuth: h.sunAzimuth,
      ambientIntensity: h.ambientIntensity,
      hemiSky: `#${new i.Color(h.hemiSky).getHexString()}`,
      hemiGround: `#${new i.Color(h.hemiGround).getHexString()}`,
      sunIntensity: h.sunIntensity,
      sunColor: `#${new i.Color(h.sunColor).getHexString()}`,
      toneMapping: h.toneMapping,
      exposure: h.exposure,
      grain: h.grain,
      sepia: h.sepia,
      mood: h.mood
    };
  }
  function I(m, h, R) {
    const S = (D, V) => D + (V - D) * R, H = (D, V) => new i.Color(D).lerp(new i.Color(V), R).getHex();
    return {
      year: h.year,
      skyTop: H(m.skyTop, h.skyTop),
      skyHorizon: H(m.skyHorizon, h.skyHorizon),
      fogColor: H(m.fogColor, h.fogColor),
      fogDensity: S(m.fogDensity, h.fogDensity),
      sunElevation: S(m.sunElevation, h.sunElevation),
      sunAzimuth: S(m.sunAzimuth, h.sunAzimuth),
      ambientIntensity: S(m.ambientIntensity, h.ambientIntensity),
      hemiSky: H(m.hemiSky, h.hemiSky),
      hemiGround: H(m.hemiGround, h.hemiGround),
      sunIntensity: S(m.sunIntensity, h.sunIntensity),
      sunColor: H(m.sunColor, h.sunColor),
      toneMapping: h.toneMapping,
      exposure: S(m.exposure, h.exposure),
      grain: S(m.grain, h.grain),
      sepia: S(m.sepia, h.sepia),
      mood: h.mood
    };
  }
  function E(m) {
    const h = ve(m);
    c.image = h, c.needsUpdate = !0;
    const R = 12 + 8 * (m.fogDensity * 400), S = 90 + 40 * (1 - m.fogDensity * 400), H = new i.Color(m.fogColor);
    u.color.copy(H), u.near = R, u.far = S;
    const D = m.sunElevation * pe, V = m.sunAzimuth * pe, Q = 30;
    a.position.set(
      Q * Math.cos(D) * Math.cos(V),
      Q * Math.sin(D),
      Q * Math.cos(D) * Math.sin(V)
    ), a.intensity = m.sunIntensity, a.color.setHex(m.sunColor), l.intensity = m.ambientIntensity, l.color.setHex(m.hemiSky), l.groundColor.setHex(m.hemiGround), s.intensity = m.ambientIntensity * 0.8;
    const Te = new i.Color("#ffffff").lerp(new i.Color("#ffd9a0"), m.sepia);
    s.color.copy(Te), o.toneMapping = m.toneMapping, o.toneMappingExposure = m.exposure;
  }
  return E(Y[1945]), {
    group: n,
    get currentYear() {
      return r;
    },
    update(m) {
      if (m === r)
        return;
      const h = Y[m];
      G = { ...k }, w = h, A = ke(), r = m;
    },
    tick(m) {
      if (A < 0)
        return;
      const h = ke() - A, R = Math.min(1, h / g), S = zt(R);
      if (S >= 1) {
        E(w), Object.assign(k, w), A = -1;
        return;
      }
      const H = I(G, w, S);
      E(H), Object.assign(k, H);
    },
    dispose() {
      e.remove(n), e.remove(a.target), e.remove(p), p.geometry.dispose(), f.dispose(), c.dispose(), e.fog = null;
      for (const m of Ce)
        delete L[m].atmosphere;
    }
  };
}
function ke() {
  return typeof performance < "u" && performance.now ? performance.now() : Date.now();
}
function zt(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
const Z = 0.8;
function x(t) {
  const e = Math.max(0, Math.min(1, t));
  return e < 0.5 ? 4 * e * e * e : 1 - Math.pow(-2 * e + 2, 3) / 2;
}
const $t = () => {
  const t = {
    get(n, r, s) {
      return r === Symbol.toPrimitive ? () => 0 : (...l) => o;
    },
    set() {
      return !0;
    },
    apply() {
      return o;
    }
  }, e = () => e, o = new Proxy(e, t);
  return o;
}, _t = {
  width: 0,
  height: 0,
  getContext: () => $t(),
  addEventListener() {
  },
  removeEventListener() {
  }
};
globalThis.document = {
  createElement: (t) => t === "canvas" ? _t : {
    style: {},
    classList: { add() {
    }, toggle() {
    }, remove() {
    } },
    dataset: {},
    setAttribute() {
    },
    appendChild() {
    },
    addEventListener() {
    },
    removeEventListener() {
    },
    focus() {
    }
  },
  getElementById: () => null,
  addEventListener() {
  },
  removeEventListener() {
  }
};
const ae = [];
function C(t, e) {
  t || ae.push(e);
}
const Ge = 0.8;
C(Z === Ge, `morph duration should be ${Ge}s`);
C(x(0) === 0, "easeInOutCubic(0) should be 0");
C(Math.abs(x(0.5) - 0.5) < 1e-9, "easeInOutCubic(0.5) should be 0.5");
C(x(1) === 1, "easeInOutCubic(1) should be 1");
C(x(0.25) < x(0.5) && x(0.5) < x(0.75), "ease should be monotonic");
const T = new i.Scene(), U = Fe(), $ = Je(), _ = ot(), ue = ft(), he = wt(), Ft = {
  toneMapping: i.NoToneMapping,
  toneMappingExposure: 1
}, F = Nt({ scene: T, camera: new i.PerspectiveCamera(), renderer: Ft });
T.add(F.group);
U.bootstrap(T, L[1945]);
$.bootstrap(T, L[1945]);
_.bootstrap(T, L[1945]);
ue.bootstrap(T);
he.bootstrap(T);
const X = Lt(T);
C(U.root.parent === T, "buildings root should attach to scene");
C($.root && $.root.parent === T, "vehicles root should attach to scene");
C(_.root && _.root.parent === T, "pedestrians root should attach to scene");
C(X.group.parent === T, "streetProps root should attach to scene");
C(F.group.parent === T, "atmosphere rig should attach to scene");
C(U.year === 1945, "buildings should start at 1945");
C($.year === 1945, "vehicles should start at 1945");
C(_.year === 1945, "pedestrians should start at 1945");
C(X.currentYear === 1945, "streetProps should start at 1945");
C(F.currentYear === 1945, "atmosphere should start at 1945");
function Yt(t, e) {
  let o = 0;
  const n = Z;
  for (; o < n; )
    o += 1 / 60;
  return { active: !1, elapsed: o };
}
const z = [...re, ...re, ...re];
for (let t = 1; t < z.length; t += 1) {
  const e = z[t], o = Yt();
  t < z.length && (C(!0, "morph should complete"), C(Math.abs(o.elapsed - Z) < 1e-6, `morph should take exactly ${Z}s`)), U.update(L[e]), ue.update(e), he.update(e), X.update(e), $.update(0, L[e]), _.update(0, L[e]), F.update(e), C(U.year === e, `buildings should be at ${e} after cycle`), C($.year === e, `vehicles should be at ${e} after cycle`), C(_.year === e, `pedestrians should be at ${e} after cycle`), C(X.currentYear === e, `streetProps should be at ${e} after cycle`), C(F.currentYear === e, `atmosphere should be at ${e} after cycle`), C(U.root.parent === T, `buildings detached after cycle ${e}`), C($.root && $.root.parent === T, `vehicles detached after cycle ${e}`), C(_.root && _.root.parent === T, `pedestrians detached after cycle ${e}`), C(X.group.parent === T, `streetProps detached after cycle ${e}`), C(F.group.parent === T, `atmosphere detached after cycle ${e}`);
}
U.dispose();
$.dispose();
_.dispose();
ue.dispose();
he.dispose();
X.dispose();
F.dispose();
T.remove(F.group);
const Wt = T.children.some((t) => t.name.startsWith("era-") || t === F.group);
C(!Wt, "dispose should detach every era/atmosphere root");
const xt = {
  modules: [
    { path: "src/eras/buildings.ts", name: "buildingsFactory", registrations: 1, lifecycleCalls: { bootstrap: 1, update: z.length - 1, dispose: 1 } },
    { path: "src/eras/vehicles.ts", name: "vehiclesFactory", registrations: 1, lifecycleCalls: { bootstrap: 1, update: z.length - 1, dispose: 1 } },
    { path: "src/eras/pedestrians.ts", name: "pedestriansFactory", registrations: 1, lifecycleCalls: { bootstrap: 1, update: z.length - 1, dispose: 1 } },
    { path: "src/eras/storefronts.ts", name: "storefrontsFactory", registrations: 1, lifecycleCalls: { bootstrap: 1, update: z.length - 1, dispose: 1 } },
    { path: "src/eras/advertising.ts", name: "advertisingFactory", registrations: 1, lifecycleCalls: { bootstrap: 1, update: z.length - 1, dispose: 1 } },
    { path: "src/eras/streetProps.ts", name: "streetPropsFactory", registrations: 1, lifecycleCalls: { update: z.length - 1, dispose: 1 } },
    { path: "src/eras/atmosphere.ts", name: "atmosphereFactory", registrations: 1, lifecycleCalls: { update: z.length - 1, dispose: 1 } },
    { path: "src/scene.ts", name: "CityScene/morph", registrations: 1, lifecycleCalls: { morphTransitions: z.length - 1 } }
  ],
  morph: {
    durationSeconds: Z,
    ease: "easeInOutCubic",
    transitionsRun: z.length - 1,
    cycles: 3,
    deterministic: ae.length === 0
  },
  errors: ae
};
console.log(JSON.stringify(xt, null, 2));
ae.length > 0 && process.exit(1);
