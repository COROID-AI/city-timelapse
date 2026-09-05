/**
 * src/content/ads/geometry.ts — procedural ad housing geometry.
 *
 * Each media family gets a distinct 3D box around the ad texture:
 *   mural    — flat weathered wall board (wood frame edge)
 *   neon     — flat dark panel with a thicker neon cap
 *   billboard — boxed billboard with side posts
 *   screen   — slim LED panel with a back body
 *
 * Ad geometry is mounted on the shared anchor slots (window/shelf) so the
 * morph engine drives the box poses during transitions; the material map
 * swap is handled by the module's texture-swap binds.
 */

import * as THREE from 'three';

import type { AdMedia } from '../../eras';

export interface AdBuild {
  group: THREE.Group;
  /** Mesh names that follow a shared anchor slot. */
  followers: { slot: 'window' | 'shelf'; name: string }[];
}

function box(
  name: string,
  w: number,
  h: number,
  d: number,
): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.name = name;
  return geo;
}

/** Build one ad housing (media-dependent frame) at position (x, y, z). */
export function buildAdGeometry(
  id: string,
  media: AdMedia,
  x: number,
  y: number,
  z: number,
): AdBuild {
  const group = new THREE.Group();
  group.name = id;
  const followers: AdBuild['followers'] = [];

  if (media === 'mural') {
    const face = new THREE.Mesh(box('mural-face', 4.6, 2.6, 0.18));
    face.position.set(x, y, z);
    face.name = 'mural-face';
    const frame = new THREE.Mesh(box('mural-frame', 4.9, 2.9, 0.06));
    frame.position.set(x, y, z);
    frame.name = 'mural-frame';
    group.add(frame, face);
    followers.push({ slot: 'window', name: 'mural-face' });
  } else if (media === 'neon') {
    const panel = new THREE.Mesh(box('neon-panel', 3.4, 1.6, 0.22));
    panel.position.set(x, y, z);
    panel.name = 'neon-panel';
    const cap = new THREE.Mesh(box('neon-cap', 3.7, 0.22, 0.26));
    cap.position.set(x, y + 0.86, z);
    cap.name = 'neon-cap';
    group.add(cap, panel);
    followers.push({ slot: 'window', name: 'neon-panel' });
  } else if (media === 'billboard') {
    const board = new THREE.Mesh(box('billboard-board', 5.2, 2.6, 0.24));
    board.position.set(x, y, z);
    board.name = 'billboard-board';
    for (const sx of [-2.2, 2.2]) {
      const post = new THREE.Mesh(box('billboard-post', 0.12, 2.6, 0.12));
      post.position.set(x + sx, y - 1.3, z);
      post.name = 'billboard-post';
      group.add(post);
    }
    group.add(board);
    followers.push({ slot: 'window', name: 'billboard-board' });
  } else {
    const screen = new THREE.Mesh(box('screen-panel', 4.4, 1.4, 0.16));
    screen.position.set(x, y, z);
    screen.name = 'screen-panel';
    const back = new THREE.Mesh(box('screen-back', 4.6, 1.6, 0.1));
    back.position.set(x, y - 0.02, z - 0.1);
    back.name = 'screen-back';
    group.add(back, screen);
    followers.push({ slot: 'shelf', name: 'screen-panel' });
  }

  return { group, followers };
}