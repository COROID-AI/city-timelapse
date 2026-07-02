import * as THREE from 'three';
const v = new THREE.Vector3(1, 2, 3);
const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
cam.position.copy(v);
const s = new THREE.Spherical();
console.log(v.length(), cam.position.x, s.radius);
