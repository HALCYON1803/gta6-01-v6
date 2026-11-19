// Renderer: scene, warm sun, sky, fog, and the smooth follow camera.
// v6 performance: pixel ratio capped at 1.25 and the shadow map at 1024 —
// the sunset look stays, but low-end machines keep their frame rate.
import * as THREE from 'three';
import { CFG } from './config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5d9);
  scene.fog = new THREE.Fog(0xc9d9e8, 120, 520);

  // Warm late-afternoon sun, low in the west so the streets glow.
  const sun = new THREE.DirectionalLight(0xffe3b3, 2.4);
  sun.position.set(120, 160, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -240;
  sun.shadow.camera.right = 240;
  sun.shadow.camera.top = 240;
  sun.shadow.camera.bottom = -240;
  sun.shadow.camera.far = 500;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.9));

  const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(0, 10, -20);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Smooth third-person follow camera.
  const camState = { yaw: Math.PI, pitch: 0.32, dist: CFG.cameraDistance, pos: new THREE.Vector3(0, 8, -14) };
  function updateCamera(target, dt, mouseDX, mouseDY) {
    camState.yaw -= mouseDX * 0.0032;
    camState.pitch = Math.max(0.08, Math.min(0.9, camState.pitch + mouseDY * 0.0024));
    const behind = new THREE.Vector3(
      target.x - Math.sin(camState.yaw) * camState.dist,
      target.y + camState.dist * Math.sin(camState.pitch) + 1.6,
      target.z - Math.cos(camState.yaw) * camState.dist
    );
    camState.pos.lerp(behind, Math.min(1, dt * 7));
    camera.position.copy(camState.pos);
    camera.lookAt(target.x, target.y + 1.6, target.z);
    return camState.yaw;
  }
  return { renderer, scene, camera, sun, camState, updateCamera };
}
