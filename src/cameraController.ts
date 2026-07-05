import * as THREE from 'three';

/**
 * Camera controller for orbit, pan, and zoom with touch support.
 */
export class CameraController {
  private domElement: HTMLElement;
  private camera: THREE.PerspectiveCamera;
  private enabled = true;

  // Target is the point the camera orbits around
  private target = new THREE.Vector3();

  // Spherical coordinates for orbit
  private spherical = new THREE.Spherical();

  // Pan offset
  private panOffset = new THREE.Vector3();

  // Zoom distance from target
  private zoomDistance = 0;

  // State
  private STATE = {
    NONE: -1,
    ROTATE: 0,
    DOLLY: 1,
    PAN: 2,
    TOUCH_ROTATE: 3,
    TOUCH_DOLLY_PAN: 4,
  };
  private state = {
    state: this.STATE.NONE,
    // For ROTATE
    rotateStart: new THREE.Vector2(),
    rotateEnd: new THREE.Vector2(),
    rotateDelta: new THREE.Vector2(),
    // For DOLLY
    dollyStart: new THREE.Vector2(),
    dollyEnd: new THREE.Vector2(),
    dollyDelta: new THREE.Vector2(),
    // For PAN
    panStart: new THREE.Vector2(),
    panEnd: new THREE.Vector2(),
    panDelta: new THREE.Vector2(),
    // For TOUCH_ROTATE
    touchStart: new THREE.Vector2(),
    touchEnd: new THREE.Vector2(),
    touchDelta: new THREE.Vector2(),
    // For TOUCH_DOLLY_PAN
    touchStartDistance: 0,
    touchEndDistance: 0,
    touchStartPan: new THREE.Vector2(),
    touchEndPan: new THREE.Vector2(),
  };

  // Constants for limits
  private readonly MIN_DISTANCE = 0;
  private readonly MAX_DISTANCE = 100;

  private readonly MIN_POLAR_ANGLE = 0; // radians
  private readonly MAX_POLAR_ANGLE = Math.PI; // radians

  private readonly MIN_ZOOM = 0.1;
  private readonly MAX_ZOOM = 2;

  constructor(domElement: HTMLElement, camera: THREE.PerspectiveCamera) {
    this.domElement = domElement;
    this.camera = camera;

    // Set up initial spherical coordinates from camera position
    this.spherical.setFromVector3(
      this.camera.position.clone().sub(this.target).multiplyScalar(-1)
    );

    // Initialize zoom distance
    this.zoomDistance = this.spherical.radius;

    // Bind event handlers
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onMouseWheel = this.onMouseWheel.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.onContextMenu = this.onContextMenu.bind(this);

    this.enabled = true;

    this.enable();
  }

  enable() {
    this.domElement.addEventListener('contextmenu', this.onContextMenu, false);
    this.domElement.addEventListener('mousedown', this.onMouseDown, false);
    this.domElement.addEventListener('wheel', this.onMouseWheel, false);
    this.domElement.addEventListener('touchstart', this.onTouchStart, false);
    this.domElement.addEventListener('touchmove', this.onTouchMove, false);
    this.domElement.addEventListener('touchend', this.onTouchEnd, false);
    this.enabled = true;
  }

  disable() {
    this.domElement.removeEventListener('contextmenu', this.onContextMenu, false);
    this.domElement.removeEventListener('mousedown', this.onMouseDown, false);
    this.domElement.removeEventListener('wheel', this.onMouseWheel, false);
    this.domElement.removeEventListener('touchstart', this.onTouchStart, false);
    this.domElement.removeEventListener('touchmove', this.onTouchMove, false);
    this.domElement.removeEventListener('touchend', this.onTouchEnd, false);
    this.enabled = false;
  }

  dispose() {
    this.disable();
  }

  getPolarAngle(): number {
    return this.spherical.phi;
  }

  getAzimuthalAngle(): number {
    return this.spherical.theta;
  }

  getDistance(): number {
    return this.spherical.radius * this.zoomDistance;
  }

  private update() {
    const position = new THREE.Vector3();
    const offset = new THREE.Vector3();

    // Calculate offset from spherical and zoom
    offset.setFromSpherical(this.spherical).multiplyScalar(this.zoomDistance);

    // Apply offset to target
    position.copy(this.target).add(offset);

    // Set camera position
    this.camera.position.copy(position);

    // Look at target
    this.camera.lookAt(this.target);

    // Update zoom distance based on zoom factor
    this.camera.zoom = this.zoomDistance;
    this.camera.updateProjectionMatrix();
  }

  private handleMouseDownRotate(event: MouseEvent) {
    this.state.state = this.STATE.ROTATE;
    this.state.rotateStart.set(event.clientX, event.clientY);
  }

  private handleMouseDownDolly(event: MouseEvent) {
    this.state.state = this.STATE.DOLLY;
    this.state.dollyStart.set(event.clientX, event.clientY);
  }

  private handleMouseDownPan(event: MouseEvent) {
    this.state.state = this.STATE.PAN;
    this.state.panStart.set(event.clientX, event.clientY);
  }

  private handleMouseMoveRotate(event: MouseEvent) {
    if (this.state.state !== this.STATE.ROTATE) return;

    const end = new THREE.Vector2(event.clientX, event.clientY);
    const delta = end.sub(this.state.rotateStart);

    const element = this.domElement;
    const width = element.clientWidth;
    const height = element.clientHeight;

    const rotateSpeed = 1.0;
    const rotateLeft = (2 * Math.PI * delta.x) / width * rotateSpeed;
    const rotateUp = (2 * Math.PI * delta.y) / height * rotateSpeed;

    this.spherical.theta -= rotateLeft;
    this.spherical.phi -= rotateUp;

    // Restrict theta to be between 0 and 2PI
    this.spherical.theta = Math.max(0, Math.min(2 * Math.PI, this.spherical.theta));

    // Restrict phi to be between min and max polar angle
    this.spherical.phi = Math.max(
      this.MIN_POLAR_ANGLE,
      Math.min(this.MAX_POLAR_ANGLE, this.spherical.phi)
    );

    this.state.rotateStart.copy(end);
    this.update();
  }

  private handleMouseMoveDolly(event: MouseEvent) {
    if (this.state.state !== this.STATE.DOLLY) return;

    const end = new THREE.Vector2(event.clientX, event.clientY);
    const delta = end.sub(this.state.dollyStart);

    const element = this.domElement;
    const height = element.clientHeight;

    const dollySpeed = 0.5;
    const dollyDelta = (delta.y * dollySpeed) / height;

    this.zoomDistance *= Math.pow(0.95, dollyDelta);

    this.zoomDistance = Math.max(
      this.MIN_ZOOM,
      Math.min(this.MAX_ZOOM, this.zoomDistance)
    );

    this.state.dollyStart.copy(end);
    this.update();
  }

  private handleMouseMovePan(event: MouseEvent) {
    if (this.state.state !== this.STATE.PAN) return;

    const end = new THREE.Vector2(event.clientX, event.clientY);
    const delta = end.sub(this.state.panStart);

    const element = this.domElement;
    const width = element.clientWidth;
    const height = element.clientHeight;

    const panSpeed = 0.5;
    const panLeft = (-delta.x * panSpeed) / width;
    const panUp = (delta.y * panSpeed) / height;

    // Pan in camera's plane
    const offset = new THREE.Vector3();
    offset.copy(this.camera.up).multiplyScalar(panUp);
    offset.add(
      new THREE.Vector3()
        .crossVectors(this.camera.up, this.camera.position)
        .normalize()
        .multiplyScalar(panLeft)
    );

    this.target.add(offset);

    this.state.panStart.copy(end);
    this.update();
  }

  private handleMouseUp() {
    this.state.state = this.STATE.NONE;
  }

  private handleMouseWheel(event: WheelEvent) {
    if (this.state.state !== this.STATE.NONE) return;

    event.preventDefault();
    event.stopPropagation();

    const delta = -event.deltaY;
    const dollySpeed = 0.001;
    const dollyDelta = delta * dollySpeed;

    this.zoomDistance *= Math.pow(0.95, dollyDelta);

    this.zoomDistance = Math.max(
      this.MIN_ZOOM,
      Math.min(this.MAX_ZOOM, this.zoomDistance)
    );

    this.update();
  }

  private handleTouchStartRotate(event: TouchEvent) {
    if (event.touches.length === 1) {
      this.state.state = this.STATE.TOUCH_ROTATE;
      this.state.touchStart.set(event.touches[0].clientX, event.touches[0].clientY);
    } else if (event.touches.length === 2) {
      this.state.state = this.STATE.TOUCH_DOLLY_PAN;
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      this.state.touchStartDistance = Math.sqrt(dx * dx + dy * dy);
      this.state.touchStartPan.set(
        (event.touches[0].clientX + event.touches[1].clientX) / 2,
        (event.touches[0].clientY + event.touches[1].clientY) / 2
      );
    }
  }

  private handleTouchMoveRotate(event: TouchEvent) {
    if (
      this.state.state !== this.STATE.TOUCH_ROTATE ||
      event.touches.length !== 1
    )
      return;

    const end = new THREE.Vector2(
      event.touches[0].clientX,
      event.touches[0].clientY
    );
    const delta = end.sub(this.state.touchStart);

    const element = this.domElement;
    const width = element.clientWidth;
    const height = element.clientHeight;

    const rotateSpeed = 1.0;
    const rotateLeft = (2 * Math.PI * delta.x) / width * rotateSpeed;
    const rotateUp = (2 * Math.PI * delta.y) / height * rotateSpeed;

    this.spherical.theta -= rotateLeft;
    this.spherical.phi -= rotateUp;

    // Restrict theta to be between 0 and 2PI
    this.spherical.theta = Math.max(0, Math.min(2 * Math.PI, this.spherical.theta));

    // Restrict phi to be between min and max polar angle
    this.spherical.phi = Math.max(
      this.MIN_POLAR_ANGLE,
      Math.min(this.MAX_POLAR_ANGLE, this.spherical.phi)
    );

    this.state.touchStart.copy(end);
    this.update();
  }

  private handleTouchMoveDollyPan(event: TouchEvent) {
    if (
      this.state.state !== this.STATE.TOUCH_DOLLY_PAN ||
      event.touches.length !== 2
    )
      return;

    const dx =
      event.touches[0].clientX - event.touches[1].clientX;
    const dy =
      event.touches[0].clientY - event.touches[1].clientY;
    const currentDistance = Math.sqrt(dx * dx + dy * dy);

    const deltaDistance =
      (currentDistance - this.state.touchStartDistance) /
      this.state.touchStartDistance;

    const element = this.domElement;
    const width = element.clientWidth;
    const height = element.clientHeight;

    const dollySpeed = 0.5;
    const dollyDelta = deltaDistance * dollySpeed;

    this.zoomDistance *= Math.pow(0.95, dollyDelta);

    this.zoomDistance = Math.max(
      this.MIN_ZOOM,
      Math.min(this.MAX_ZOOM, this.zoomDistance)
    );

    // Pan
    const prevTouchStart = this.state.touchStartPan.clone();
    const currentPanStart = new THREE.Vector2(
      (event.touches[0].clientX + event.touches[1].clientX) / 2,
      (event.touches[0].clientY + event.touches[1].clientY) / 2
    );
    const panDelta = currentPanStart.sub(prevTouchStart);

    const panSpeed = 0.5;
    const panLeft = (-panDelta.x * panSpeed) / width;
    const panUp = (panDelta.y * panSpeed) / height;

    const offset = new THREE.Vector3();
    offset.copy(this.camera.up).multiplyScalar(panUp);
    offset.add(
      new THREE.Vector3()
        .crossVectors(this.camera.up, this.camera.position)
        .normalize()
        .multiplyScalar(panLeft)
    );

    this.target.add(offset);

    this.state.touchStartDistance = currentDistance;
    this.state.touchStartPan.copy(currentPanStart);
    this.update();
  }

  private handleTouchEnd() {
    this.state.state = this.STATE.NONE;
  }

  private onContextMenu(event: Event) {
    if (this.enabled) event.preventDefault();
  }

  private onMouseDown(event: MouseEvent) {
    if (!this.enabled) return;

    event.preventDefault();

    if (event.button === 0) {
      // Left click
      this.handleMouseDownRotate(event);
    } else if (event.button === 2) {
      // Right click
      this.handleMouseDownPan(event);
    } else if (event.button === -1 || event.button === 1) {
      // Middle or wheel
      this.handleMouseDownDolly(event);
    }

    if (this.state.state !== this.STATE.NONE) {
      this.domElement.ownerDocument.addEventListener(
        'mousemove',
        this.onMouseMove,
        false
      );
      this.domElement.ownerDocument.addEventListener(
        'mouseup',
        this.onMouseUp,
        false
      );
    }
  }

  private onMouseMove(event: MouseEvent) {
    if (!this.enabled) return;

    switch (this.state.state) {
      case this.STATE.ROTATE:
        this.handleMouseMoveRotate(event);
        break;
      case this.STATE.DOLLY:
        this.handleMouseMoveDolly(event);
        break;
      case this.STATE.PAN:
        this.handleMouseMovePan(event);
        break;
    }
  }

  private onMouseUp(_event: MouseEvent) {
    if (!this.enabled) return;
    void _event;

    this.handleMouseUp();

    this.domElement.ownerDocument.removeEventListener(
      'mousemove',
      this.onMouseMove,
      false
    );
    this.domElement.ownerDocument.removeEventListener(
      'mouseup',
      this.onMouseUp,
      false
    );
  }

  private onMouseWheel(event: WheelEvent) {
    if (!this.enabled) return;

    this.handleMouseWheel(event);
  }

  private onTouchStart(event: TouchEvent) {
    if (!this.enabled) return;

    switch (event.touches.length) {
      case 1:
        this.handleTouchStartRotate(event);
        break;
      case 2:
        this.handleTouchStartRotate(event); // Actually handled by the same function for two touches
        break;
      default:
        this.state.state = this.STATE.NONE;
    }
  }

  private onTouchMove(event: TouchEvent) {
    if (!this.enabled) return;

    switch (event.touches.length) {
      case 1:
        this.handleTouchMoveRotate(event);
        break;
      case 2:
        this.handleTouchMoveDollyPan(event);
        break;
    }
  }

  private onTouchEnd(event: TouchEvent) {
    if (!this.enabled) return;

    this.handleTouchEnd();
  }
}