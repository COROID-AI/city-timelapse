import * as THREE from 'three';
import { generateBuilding } from '../toolkit/building.js';
import { generateStorefront } from '../toolkit/storefront.js';
import { generateSignage } from '../toolkit/signage.js';
import { generateVehicle } from '../toolkit/vehicle.js';
import { generatePedestrian } from '../toolkit/pedestrian.js';
import { generateProp } from '../toolkit/props.js';

/**
 * Scratch playground: instantiates one of each generator with era-agnostic
 * params, places them on a simple ground plane, and renders a frame.
 * Used for manual verification that all generators compile and produce output.
 */
export function createPlaygroundScene(canvas: HTMLCanvasElement): {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  dispose(): void;
} {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB);

  // Camera
  const camera = new THREE.PerspectiveCamera(50, canvas.width / canvas.height, 0.1, 200);
  camera.position.set(12, 8, 18);
  camera.lookAt(0, 2, 0);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(canvas.width, canvas.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(8, 15, 10);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(1024, 1024);
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 50;
  dirLight.shadow.camera.left = -15;
  dirLight.shadow.camera.right = 15;
  dirLight.shadow.camera.top = 15;
  dirLight.shadow.camera.bottom = -15;
  scene.add(dirLight);
  const hemi = new THREE.HemisphereLight(0x87CEEB, 0x444422, 0.3);
  scene.add(hemi);

  // Ground
  const groundGeo = new THREE.PlaneGeometry(60, 60);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x556B2F, roughness: 0.9 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Sidewalk strip
  const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0xBBBBAA, roughness: 0.8 });
  const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(60, 0.1, 2), sidewalkMat);
  sidewalk.position.set(0, 0.05, -1);
  sidewalk.receiveShadow = true;
  scene.add(sidewalk);

  // ── Instantiate each generator ────────────────────────────────

  // 1. Building — Art Deco style
  const building = generateBuilding({
    width: 6,
    depth: 5,
    floors: 5,
    floorHeight: 3,
    style: 'art_deco',
    wallMaterial: 'render',
    bays: 4,
    cornice: 'decorated',
    rooftop: 'parapet',
    fireEscape: false,
    awning: 'canvas',
    condition: 0.75,
    baseColor: 0xD4C5A9,
  });
  building.group.position.set(-8, 0, -3);
  scene.add(building.group);

  // 2. Building — Brick Classic
  const brickBuilding = generateBuilding({
    width: 5,
    depth: 4,
    floors: 4,
    floorHeight: 3,
    style: 'brick_classic',
    wallMaterial: 'brick',
    bays: 3,
    cornice: 'simple',
    rooftop: 'water_tank',
    fireEscape: true,
    awning: false,
    condition: 0.6,
    baseColor: 0x8B4513,
  });
  brickBuilding.group.position.set(-2, 0, -3);
  scene.add(brickBuilding.group);

  // 3. Building — Modernist
  const modernBuilding = generateBuilding({
    width: 8,
    depth: 6,
    floors: 3,
    floorHeight: 3.5,
    style: 'modernist',
    wallMaterial: 'render',
    bays: 6,
    cornice: 'none',
    rooftop: 'flat',
    fireEscape: false,
    awning: 'metal',
    condition: 0.9,
    baseColor: 0xF5F5F0,
  });
  modernBuilding.group.position.set(5, 0, -3);
  scene.add(modernBuilding.group);

  // 4. Building — Brutalist
  const brutalistBuilding = generateBuilding({
    width: 7,
    depth: 5,
    floors: 6,
    floorHeight: 3,
    style: 'brutalist',
    wallMaterial: 'concrete',
    bays: 5,
    cornice: 'elaborate',
    rooftop: 'penthouse',
    fireEscape: false,
    awning: false,
    condition: 0.5,
    baseColor: 0x555550,
  });
  brutalistBuilding.group.position.set(12, 0, -3);
  scene.add(brutalistBuilding.group);

  // 5. Storefront
  const storefront = generateStorefront({
    width: 3.5,
    height: 3.5,
    windowRatio: 0.55,
    doorType: 'double',
    kickPanel: 'marble',
    awning: 'stripes',
    hangingSign: true,
    signText: 'CAFÉ',
    displayCaseMaterial: 'glass',
    interiorLight: 0xFFEECC,
    condition: 0.8,
    accentColor: 0xCC7722,
  });
  storefront.group.position.set(-5, 0, 0.5);
  scene.add(storefront.group);

  // 6. Signage — Fascia
  const fasciaSign = generateSignage({
    type: 'fascia',
    width: 4,
    height: 1,
    text: 'MAIN STREET',
    fontSize: 0.4,
    textColor: 0xFFFFFF,
    bgColor: 0x1A1A2E,
    frameColor: 0xC0A060,
    ornament: 'art_deco',
    condition: 0.7,
  });
  fasciaSign.group.position.set(-5, 3.8, 0.5);
  scene.add(fasciaSign.group);

  // 7. Signage — Neon Outline
  const neonSign = generateSignage({
    type: 'neon_outline',
    width: 3,
    height: 1,
    text: 'OPEN',
    fontSize: 0.5,
    textColor: 0xFF3333,
    glowIntensity: 0.9,
    emissive: true,
    condition: 0.85,
  });
  neonSign.group.position.set(2, 3.5, 0.5);
  scene.add(neonSign.group);

  // 8. Signage — Billboard
  const billboard = generateSignage({
    type: 'billboard',
    width: 10,
    height: 3,
    text: 'WELCOME',
    fontSize: 0.25,
    textColor: 0xFFFFEE,
    bgColor: 0x223344,
    frameColor: 0x666666,
    ornament: 'ornate',
    condition: 0.6,
  });
  billboard.group.position.set(10, 0, -6);
  scene.add(billboard.group);

  // 9. Vehicle — Car
  const car = generateVehicle({
    type: 'car',
    scale: 1,
    paintColor: 0xCC0000,
    chromeColor: 0xDDDDDD,
    wheelStyle: 'spoke',
    condition: 0.75,
    roofShape: 'curved',
    bumperStyle: 'chrome_bar',
    headlightStyle: 'round',
    taillightStyle: 'round',
  });
  car.group.position.set(-3, 0.3, 2);
  car.group.rotation.y = Math.PI / 4;
  scene.add(car.group);

  // 10. Vehicle — Truck
  const truck = generateVehicle({
    type: 'truck',
    scale: 1.1,
    paintColor: 0x2255AA,
    wheelStyle: 'heavy_duty',
    condition: 0.6,
    bumperStyle: 'heavy',
    headlightStyle: 'rectangular',
    taillightStyle: 'vertical_strip',
  });
  truck.group.position.set(3, 0.35, 2);
  truck.group.rotation.y = -Math.PI / 6;
  scene.add(truck.group);

  // 11. Vehicle — Bus
  const bus = generateVehicle({
    type: 'bus',
    scale: 1,
    paintColor: 0x006633,
    wheelStyle: 'heavy_duty',
    condition: 0.65,
    headlightStyle: 'rectangular',
    taillightStyle: 'vertical_strip',
  });
  bus.group.position.set(-8, 0.45, 2);
  scene.add(bus.group);

  // 12. Vehicle — Taxi
  const taxi = generateVehicle({
    type: 'taxi',
    scale: 1,
    paintColor: 0xFFCC00,
    wheelStyle: 'spoke',
    condition: 0.7,
    bumperStyle: 'chrome_bar',
    roofDetails: ['roof_light'],
  });
  taxi.group.position.set(8, 0.3, 2);
  taxi.group.rotation.y = Math.PI / 3;
  scene.add(taxi.group);

  // 13. Vehicle — Tram
  const tram = generateVehicle({
    type: 'tram',
    scale: 1,
    paintColor: 0xCC3333,
    wheelStyle: 'simple',
    condition: 0.6,
  });
  tram.group.position.set(0, 0.35, 4);
  scene.add(tram.group);

  // 14. Pedestrians — Various outfit sets
  const p1 = generatePedestrian({
    outfit: 'worker',
    heightScale: 1,
    skinTone: 0xD4A574,
    hatStyle: 'cap',
    animated: true,
    walkSpeed: 3,
  });
  p1.group.position.set(-4, 0, 1.5);
  scene.add(p1.group);

  const p2 = generatePedestrian({
    outfit: 'business_suit',
    heightScale: 1.05,
    skinTone: 0xB8860B,
    hatStyle: 'fedora',
    accessories: ['briefcase'],
    animated: true,
    walkSpeed: 2.5,
  });
  p2.group.position.set(1, 0, 1.5);
  scene.add(p2.group);

  const p3 = generatePedestrian({
    outfit: 'casual_jeans',
    heightScale: 0.95,
    skinTone: 0xE8C9A0,
    hatStyle: 'beanie',
    accessories: ['phone', 'bag'],
    animated: true,
    walkSpeed: 3.5,
  });
  p3.group.position.set(5, 0, 1.5);
  scene.add(p3.group);

  const p4 = generatePedestrian({
    outfit: 'downtown_evening',
    heightScale: 1,
    skinTone: 0x8D5524,
    hatStyle: 'top_hat',
    accessories: ['cane'],
    animated: true,
    walkSpeed: 2,
  });
  p4.group.position.set(9, 0, 1.5);
  scene.add(p4.group);

  const p5 = generatePedestrian({
    outfit: 'school_child',
    heightScale: 0.75,
    skinTone: 0xF0D0A0,
    hatStyle: 'sun_hat',
    accessories: ['camera'],
    animated: true,
    walkSpeed: 4,
  });
  p5.group.position.set(-1, 0, 3);
  scene.add(p5.group);

  // 15. Props
  const lampPost = generateProp({
    type: 'lamp_post',
    scale: 1,
    style: 'classic',
    lit: true,
    ornate: true,
    condition: 0.8,
  });
  lampPost.group.position.set(-6, 0, 0.5);
  scene.add(lampPost.group);

  const hydrant = generateProp({
    type: 'hydrant',
    scale: 1,
    color: 0xCC2222,
    condition: 0.6,
  });
  hydrant.group.position.set(-3, 0, 0.5);
  scene.add(hydrant.group);

  const bench = generateProp({
    type: 'bench',
    scale: 1,
    style: 'classic',
    condition: 0.7,
  });
  bench.group.position.set(4, 0, 0.5);
  scene.add(bench.group);

  const trashCan = generateProp({
    type: 'trash_can',
    scale: 1,
    style: 'industrial',
    condition: 0.5,
  });
  trashCan.group.position.set(7, 0, 0.5);
  scene.add(trashCan.group);

  const phoneBooth = generateProp({
    type: 'phone_booth',
    scale: 1,
    color: 0x2244AA,
    ornate: true,
    condition: 0.7,
  });
  phoneBooth.group.position.set(10, 0, 0.5);
  scene.add(phoneBooth.group);

  const newspaperBox = generateProp({
    type: 'newspaper_box',
    scale: 1,
    condition: 0.6,
  });
  newspaperBox.group.position.set(-1, 0, 0.5);
  scene.add(newspaperBox.group);

  const bikeRack = generateProp({
    type: 'bike_rack',
    scale: 1,
    condition: 0.8,
  });
  bikeRack.group.position.set(6, 0, 1.5);
  scene.add(bikeRack.group);

  const planter = generateProp({
    type: 'planter',
    scale: 1,
    style: 'classic',
    condition: 0.8,
  });
  planter.group.position.set(-9, 0, 0.5);
  scene.add(planter.group);

  const acUnit = generateProp({
    type: 'ac_unit',
    scale: 1,
    condition: 0.6,
  });
  acUnit.group.position.set(14, 0, 0.5);
  scene.add(acUnit.group);

  const solarPanel = generateProp({
    type: 'solar_panel',
    scale: 1,
    condition: 0.9,
  });
  solarPanel.group.position.set(14, 0, -4);
  scene.add(solarPanel.group);

  const evCharger = generateProp({
    type: 'ev_charger',
    scale: 1,
    color: 0x00AA66,
    condition: 0.9,
  });
  evCharger.group.position.set(11, 0, 0.5);
  scene.add(evCharger.group);

  const cctv = generateProp({
    type: 'cctv',
    scale: 1,
    ornate: false,
    condition: 0.8,
  });
  cctv.group.position.set(-10, 0, 0.5);
  scene.add(cctv.group);

  const bollard = generateProp({
    type: 'bollard',
    scale: 1,
    style: 'modern',
    condition: 0.8,
  });
  bollard.group.position.set(-7, 0, 1);
  scene.add(bollard.group);

  const mailbox = generateProp({
    type: 'mailbox',
    scale: 1,
    color: 0x003366,
    condition: 0.6,
  });
  mailbox.group.position.set(0, 0, 1);
  scene.add(mailbox.group);

  const busStop = generateProp({
    type: 'bus_stop',
    scale: 1,
    style: 'modern',
    ornate: true,
    condition: 0.7,
  });
  busStop.group.position.set(8, 0, 0.5);
  scene.add(busStop.group);

  return {
    renderer,
    scene,
    camera,
    dispose() {
      // Dispose all generated content
      building.dispose();
      brickBuilding.dispose();
      modernBuilding.dispose();
      brutalistBuilding.dispose();
      storefront.dispose();
      fasciaSign.dispose();
      neonSign.dispose();
      billboard.dispose();
      car.dispose();
      truck.dispose();
      bus.dispose();
      taxi.dispose();
      tram.dispose();
      p1.dispose();
      p2.dispose();
      p3.dispose();
      p4.dispose();
      p5.dispose();
      lampPost.dispose();
      hydrant.dispose();
      bench.dispose();
      trashCan.dispose();
      phoneBooth.dispose();
      newspaperBox.dispose();
      bikeRack.dispose();
      planter.dispose();
      acUnit.dispose();
      solarPanel.dispose();
      evCharger.dispose();
      cctv.dispose();
      bollard.dispose();
      mailbox.dispose();
      busStop.dispose();

      // Clean up scene objects
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          (obj as THREE.Mesh).geometry.dispose();
          const m = (obj as THREE.Mesh).material;
          if (Array.isArray(m)) {
            for (const mat of m) mat.dispose();
          } else if (m) {
            m.dispose();
          }
        }
      });
      renderer.dispose();
    },
  };
}
