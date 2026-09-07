/**
 * Minimal type declarations for the `three` module (r165).
 *
 * The three.js r165 package does not bundle TypeScript declarations, so this
 * file types only the subset of the API this scaffold uses. It is intentionally
 * narrow; extend as downstream era modules require more of the API.
 */
declare module 'three' {
  export class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x?: number, y?: number, z?: number);
    set(x: number, y: number, z: number): this;
    copy(v: Vector3): this;
    clone(): Vector3;
  }

  export class Euler {
    x: number;
    y: number;
    z: number;
  }

  export class Color {
    r: number;
    g: number;
    b: number;
    setRGB(r: number, g: number, b: number): this;
    setHex(hex: number): this;
  }

  export class Object3D {
    position: Vector3;
    rotation: Euler;
    up: Vector3;
    children: Object3D[];
    parent: Object3D | null;
    add(...objects: Object3D[]): this;
    remove(...objects: Object3D[]): this;
    lookAt(x: number | Vector3, y?: number, z?: number): this;
    updateMatrix(): void;
  }

  export class Scene extends Object3D {
    constructor();
  }

  export class PerspectiveCamera extends Object3D {
    fov: number;
    constructor(fov?: number, aspect?: number, near?: number, far?: number);
    updateProjectionMatrix(): void;
  }

  export class WebGLRenderer {
    domElement: HTMLCanvasElement;
    constructor(parameters?: {
      canvas?: HTMLCanvasElement;
      context?: unknown;
      depth?: boolean;
      antialias?: boolean;
    });
    render(scene: Scene, camera: PerspectiveCamera): void;
    setSize(width: number, height: number, updateStyle?: boolean): void;
    dispose(): void;
  }

  export class MeshStandardMaterial {
    color: Color;
    constructor(color?: Color | number);
  }

  export class Mesh extends Object3D {
    material: MeshStandardMaterial;
    constructor(geometry?: BufferGeometry, material?: MeshStandardMaterial);
  }

  export class BufferGeometry {}

  export class BoxGeometry extends BufferGeometry {
    constructor(
      width?: number,
      height?: number,
      depth?: number,
      widthSegments?: number,
      heightSegments?: number,
      depthSegments?: number,
    );
  }

  export class SphereGeometry extends BufferGeometry {
    constructor(
      radius?: number,
      widthSegments?: number,
      heightSegments?: number,
      phiStart?: number,
      phiLength?: number,
      thetaStart?: number,
      thetaLength?: number,
    );
  }

  export class Light extends Object3D {
    color: Color;
    intensity: number;
    constructor(color?: Color | number, intensity?: number);
  }

  export class AmbientLight extends Light {
    constructor(color?: Color | number, intensity?: number);
  }

  export class DirectionalLight extends Light {
    target: Object3D;
    constructor(color?: Color | number, intensity?: number);
  }
}
