import * as THREE from 'three';
import { EraKey } from '../eras/eraData';

/**
 * GraffitiAlley - Represents a 1985-era graffiti art alley wall
 * Features: graffiti mural, brick texture, alley setting,
 * contrasting with restored brick facades nearby
 *
 * Designated alley wall showcasing 1980s graffiti art culture
 */
export class GraffitiAlley {
  private mesh: THREE.Group;
  private readonly wallWidth = 25;
  private readonly wallHeight = 20;
  private readonly wallDepth = 1;

  constructor(position: THREE.Vector3, era: EraKey = '1985') {
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);
    this.mesh.userData.isEraObject = true;
    this.mesh.userData.buildingType = 'graffitiAlley';
    this.mesh.userData.era = era;

    this.createStructure();
    this.createBrickBase();
    this.createGraffitiMural();
    this.createAlleyDetails();

    console.log(`GraffitiAlley created at ${position.x}, ${position.z} for era ${era}`);
  }

  getMesh(): THREE.Group {
    return this.mesh;
  }

  private createStructure(): void {
    // Main alley wall structure
    const wallColor = new THREE.Color(0x2C3E50);
    const wallGeometry = new THREE.BoxGeometry(this.wallWidth, this.wallHeight, this.wallDepth);
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: wallColor,
      roughness: 0.8,
      metalness: 0.1,
    });
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.y = this.wallHeight / 2;
    this.mesh.add(wall);
  }

  private createBrickBase(): void {
    // Base section showing underlying brick (contrasting with restored facades)
    const brickColor = new THREE.Color(0xE8E8E8);
    const brickMaterial = new THREE.MeshStandardMaterial({
      color: brickColor,
      roughness: 0.7,
      metalness: 0.1,
    });

    // Lower section of wall showing brick texture
    const baseHeight = 5;
    const baseGeometry = new THREE.BoxGeometry(this.wallWidth, baseHeight, this.wallDepth);
    const base = new THREE.Mesh(baseGeometry, brickMaterial);
    base.position.y = baseHeight / 2;
    this.mesh.add(base);

    // Simulate aged/mortar lines
    const mortarColor = new THREE.Color(0xB5B5B5);
    const mortarMaterial = new THREE.MeshStandardMaterial({
      color: mortarColor,
      roughness: 0.9,
      metalness: 0.0,
    });

    // Vertical mortar lines
    for (let i = 0; i < 8; i++) {
      const xPos = (i * 3.5) - 10.5;
      const vertGeometry = new THREE.BoxGeometry(0.5, baseHeight, this.wallDepth);
      const vertMortar = new THREE.Mesh(vertGeometry, mortarMaterial);
      vertMortar.position.x = xPos;
      vertMortar.position.y = baseHeight / 2;
      vertMortar.position.z = 0;
      this.mesh.add(vertMortar);
    }

    // Horizontal mortar lines
    for (let i = 0; i < 6; i++) {
      const yPos = (i * 3.5) + 1.75;
      const horizGeometry = new THREE.BoxGeometry(this.wallWidth - 1, 0.5, this.wallDepth);
      const horizMortar = new THREE.Mesh(horizGeometry, mortarMaterial);
      horizMortar.position.x = 0;
      horizMortar.position.y = yPos;
      horizMortar.position.z = 0;
      this.mesh.add(horizMortar);
    }
  }

  private createGraffitiMural(): void {
    // Main graffiti mural on upper section
    const muralTopY = this.wallHeight - baseHeight;
    
    // Graffiti area - textured/colored surface
    const graffitiColor = new THREE.Color(0x1A1A1A);
    const graffitiMaterial = new THREE.MeshStandardMaterial({
      color: graffitiColor,
      roughness: 0.9,
      metalness: 0.0,
    });

    // Main graffiti area
    const muralGeometry = new THREE.BoxGeometry(this.wallWidth - 2, this.wallHeight - baseHeight - 2, this.wallDepth);
    const mural = new THREE.Mesh(muralGeometry, graffitiMaterial);
    mural.position.x = 0;
    mural.position.y = baseHeight + (this.wallHeight - baseHeight - 2) / 2;
    mural.position.z = 0;
    this.mesh.add(mural);

    // Create graffiti "tags" - colorful shapes simulating spray paint
    const tagColors = [
      new THREE.Color(0xFF00FF), // Magenta
      new THREE.Color(0x00FFFF), // Cyan
      new THREE.Color(0xF1C40F), // Yellow
      new THREE.Color(0xE74C3C), // Red
      new THREE.Color(0x9B59B6), // Purple
    ];

    // Various graffiti shapes
    const tagShapes = [
      // Circle tag
      { type: 'circle', x: -8, y: muralTopY + 3, radius: 2, colorIdx: 0 },
      // Square tag
      { type: 'square', x: 0, y: muralTopY + 5, size: 3, colorIdx: 1 },
      // Triangle tag
      { type: 'triangle', x: 8, y: muralTopY + 3, size: 2, colorIdx: 2 },
      // Abstract shape
      { type: 'abstract', x: -5, y: muralTopY + 7, size: 2.5, colorIdx: 3 },
      // Another tag
      { type: 'abstract', x: 5, y: muralTopY + 7, size: 2, colorIdx: 4 },
    ];

    tagShapes.forEach((shape, idx) => {
      const color = tagColors[shape.colorIdx];
      
      if (shape.type === 'circle') {
        const circleGeometry = new THREE.CircleGeometry(shape.radius, 32);
        const circle = new THREE.Mesh(circleGeometry, new THREE.MeshStandardMaterial({
          color: color,
          roughness: 0.7,
          metalness: 0.1,
        }));
        circle.position.x = shape.x;
        circle.position.y = shape.y;
        circle.position.z = 0.1;
        // Rotate circle to look like a tag
        circle.rotation.z = Math.PI / 4;
        this.mesh.add(circle);
      } else if (shape.type === 'square') {
        const squareGeometry = new THREE.BoxGeometry(shape.size, shape.size, 0.5);
        const square = new THREE.Mesh(squareGeometry, new THREE.MeshStandardMaterial({
          color: color,
          roughness: 0.7,
          metalness: 0.1,
        }));
        square.position.x = shape.x;
        square.position.y = shape.y;
        square.position.z = 0.1;
        this.mesh.add(square);
      } else if (type === 'triangle') {
        // Create triangle using shape geometry
        const trianglePoints = [
          new THREE.Vector2(0, 0),
          new THREE.Vector2(shape.size, shape.size),
          new THREE.Vector2(0, shape.size),
        ];
        const triangleGeometry = new THREE.ShapeGeometry(trianglePoints);
        const triangle = new THREE.Mesh(triangleGeometry, new THREE.MeshStandardMaterial({
          color: color,
          roughness: 0.7,
          metalness: 0.1,
        }));
        triangle.position.x = shape.x;
        triangle.position.y = shape.y;
        triangle.position.z = 0.1;
        this.mesh.add(triangle);
      } else if (shape.type === 'abstract') {
        // Abstract shape - just a colored blob/geom
        const abstractGeometry = new THREE.BoxGeometry(shape.size, shape.size, 0.5);
        const abstract = new THREE.Mesh(abstractGeometry, new THREE.MeshStandardMaterial({
          color: color,
          roughness: 0.7,
          metalness: 0.1,
        }));
        abstract.position.x = shape.x;
        abstract.position.y = shape.y;
        abstract.position.z = 0.1;
        this.mesh.add(abstract);
      }
    });

    // Spray paint drips
    const dripColor = new THREE.Color(0xFFFFFF);
    const dripMaterial = new THREE.MeshStandardMaterial({
      color: dripColor,
      roughness: 0.5,
      metalness: 0.1,
    });

    for (let i = 0; i < 8; i++) {
      const dripX = (Math.random() - 0.5) * 15;
      const dripY = muralTopY + (Math.random() * 4);
      const dripGeometry = new THREE.BoxGeometry(0.3, 1.5 + Math.random() * 1, 0.1);
      const drip = new THREE.Mesh(dripGeometry, dripMaterial);
      drip.position.x = dripX;
      drip.position.y = dripY;
      drip.position.z = 0.05;
      drip.rotation.z = Math.random() * Math.PI / 4;
      this.mesh.add(drip);
    }
  }

  private createAlleyDetails(): void {
    // Alley floor/ground
    const floorColor = new THREE.Color(0x34495E);
    const floorGeometry = new THREE.BoxGeometry(this.wallWidth, 1, this.wallWidth);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: floorColor,
      roughness: 0.8,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.y = 0.5;
    floor.position.x = 0;
    floor.position.z = -(this.wallDepth / 2) - this.wallWidth / 2 - 0.5;
    this.mesh.add(floor);

    // Trash receptacles (1980s style)
    const trashColor = new THREE.Color(0x2C3E50);
    const trashMaterial = new THREE.MeshStandardMaterial({
      color: trashColor,
      roughness: 0.7,
      metalness: 0.3,
    });

    // Two trash cans in alley
    for (let i = 0; i < 2; i++) {
      const trashX = (i * 6) - 3;
      const trashGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
      const trash = new THREE.Mesh(trashGeometry, trashMaterial);
      trash.position.x = trashX;
      trash.position.y = 0.75;
      trash.position.z = -(this.wallDepth / 2) - this.wallWidth / 2 - 0.5;
      this.mesh.add(trash);

      // Trash lid
      const lidGeometry = new THREE.BoxGeometry(1.7, 0.3, 1.7);
      const lid = new THREE.Mesh(lidGeometry, trashMaterial);
      lid.position.x = trashX;
      lid.position.y = 1.5;
      lid.position.z = -(this.wallDepth / 2) - this.wallWidth / 2 - 0.5;
      this.mesh.add(lid);

      // Trash bag opening
      const bagColor = new THREE.Color(0x000000);
      const bagMaterial = new THREE.MeshStandardMaterial({
        color: bagColor,
        roughness: 0.9,
        metalness: 0.0,
      });
      const bagGeometry = new THREE.BoxGeometry(1.3, 1, 1.3);
      const bag = new THREE.Mesh(bagGeometry, bagMaterial);
      bag.position.x = trashX;
      bag.position.y = 0.8;
      bag.position.z = -(this.wallDepth / 2) - this.wallWidth / 2 - 0.5;
      this.mesh.add(bag);
    }

    // Metal bench (1985-style)
    const benchColor = new THREE.Color(0x999999);
    const benchMaterial = new THREE.MeshStandardMaterial({
      color: benchColor,
      roughness: 0.5,
      metalness: 0.6,
    });

    const benchGeometry = new THREE.BoxGeometry(2, 0.5, 1.5);
    const bench = new THREE.Mesh(benchGeometry, benchMaterial);
    bench.position.x = 6;
    bench.position.y = 0.25;
    bench.position.z = -(this.wallDepth / 2) - this.wallWidth / 2 - 0.5;
    this.mesh.add(bench);

    // Bench back
    const backGeometry = new THREE.BoxGeometry(2.5, 1, 0.3);
    const back = new THREE.Mesh(backGeometry, benchMaterial);
    back.position.x = 6;
    back.position.y = 1.5;
    back.position.z = -(this.wallDepth / 2) - this.wallWidth / 2 - 0.5;
    this.mesh.add(back);
  }
}