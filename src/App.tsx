import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js';
import { Era, ERA_CONFIGS, ERA_YEARS } from './lib/eras';
import { AudioManager } from './lib/audioManager';
import { createSignage } from './lib/signage';
import './styles.css';

export default function App() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [currentEra, setCurrentEra] = useState<Era>('1945');
  const [loading, setLoading] = useState(true);
  const [webGLSupported, setWebGLSupported] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const objectsRef = useRef<THREE.Object3D[]>([]);
  const audioManagerRef = useRef<AudioManager | null>(null);

  useEffect(() => {
    // Check WebGL support
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) throw new Error('WebGL not supported');
    } catch (e) {
      setWebGLSupported(false);
      return;
    }

    audioManagerRef.current = new AudioManager();

    const initScene = () => {
      const currentCanvas = canvasRef.current;
      if (!currentCanvas) return;

      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x111827);
      sceneRef.current = scene;

      // Camera
      const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.set(50, 30, 80);
      cameraRef.current = camera;

      // Renderer
      const renderer = new THREE.WebGLRenderer({
        canvas: currentCanvas,
        antialias: true,
        alpha: false
      });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      rendererRef.current = renderer;

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
      directionalLight.position.set(100, 100, 50);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 1024;
      directionalLight.shadow.mapSize.height = 1024;
      scene.add(directionalLight);

      const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
      fillLight.position.set(-50, 80, -50);
      scene.add(fillLight);

      // Postprocessing
      const composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.5,
        0.4,
        0.85
      );
      composer.addPass(bloomPass);
      
      const gammaPass = new ShaderPass(GammaCorrectionShader);
      composer.addPass(gammaPass);

      // Controls (simple orbit controls)
      let theta = 0;
      let phi = Math.PI / 4;
      let radius = 100;

      const updateCamera = () => {
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.sin(theta);
        camera.position.set(x, Math.max(10, y), z);
        camera.lookAt(0, 10, 0);
      };

      // Mouse controls
      let isMouseDown = false;
      let lastX = 0;
      let lastY = 0;

      const onMouseDown = (e: MouseEvent) => {
        isMouseDown = true;
        lastX = e.clientX;
        lastY = e.clientY;
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!isMouseDown) return;
        theta -= (e.clientX - lastX) * 0.01;
        phi = Math.max(0.1, Math.min(Math.PI / 2, phi + (e.clientY - lastY) * 0.01));
        lastX = e.clientX;
        lastY = e.clientY;
        updateCamera();
      };

      const onMouseUp = () => {
        isMouseDown = false;
      };

      const onWheel = (e: WheelEvent) => {
        radius *= e.deltaY > 0 ? 1.1 : 0.9;
        radius = Math.max(20, Math.min(200, radius));
        updateCamera();
      };

      currentCanvas.addEventListener('mousedown', onMouseDown);
      currentCanvas.addEventListener('mousemove', onMouseMove);
      currentCanvas.addEventListener('mouseup', onMouseUp);
      currentCanvas.addEventListener('wheel', onWheel);
      currentCanvas.addEventListener('mouseleave', onMouseUp);

      // Handle resize
      const onResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener('resize', onResize);

      // Animation loop
      const animate = () => {
        requestAnimationFrame(animate);
        composer.render();
      };
      animate();

      // Cleanup
      return () => {
        currentCanvas.removeEventListener('mousedown', onMouseDown);
        currentCanvas.removeEventListener('mousemove', onMouseMove);
        currentCanvas.removeEventListener('mouseup', onMouseUp);
        currentCanvas.removeEventListener('wheel', onWheel);
        currentCanvas.removeEventListener('mouseleave', onMouseUp);
        window.removeEventListener('resize', onResize);
        renderer.dispose();
        composer.dispose();
      };
    };

    const cleanup = initScene();
    setLoading(false);
    audioManagerRef.current?.setEra(currentEra);

    return () => {
      cleanup?.();
      audioManagerRef.current?.dispose();
    };
  }, []);

  const updateScene = (era: Era) => {
    if (!sceneRef.current) return;
    
    // Clear previous objects
    objectsRef.current.forEach(obj => {
      obj.traverse((child) => {
        if ((child as THREE.Mesh).geometry) {
          (child as THREE.Mesh).geometry.dispose();
        }
        if ((child as THREE.Mesh).material) {
          const material = (child as THREE.Mesh).material;
          if (Array.isArray(material)) {
            material.forEach(m => m.dispose());
          } else {
            material.dispose();
          }
        }
      });
      sceneRef.current.remove(obj);
    });
    objectsRef.current = [];

    const config = ERA_CONFIGS[era];

    // Create street
    const streetGeometry = new THREE.PlaneGeometry(200, 200);
    const streetMaterial = new THREE.MeshStandardMaterial({ color: config.colorPalette.roads });
    const street = new THREE.Mesh(streetGeometry, streetMaterial);
    street.rotation.x = -Math.PI / 2;
    street.receiveShadow = true;
    sceneRef.current.add(street);
    objectsRef.current.push(street);

    // Create buildings
    for (let i = 0; i < 20; i++) {
      const x = (i % 5) * 25 - 50;
      const z = Math.floor(i / 5) * 30 - 75;
      
      const buildingGroup = new THREE.Group();
      const { height, width, depth } = config.buildingStyle;
      
      // Main building
      const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
      const buildingMaterial = new THREE.MeshStandardMaterial({
        color: config.colorPalette.buildings,
        roughness: era === '1945' ? 0.9 : era === '2055' ? 0.1 : 0.7,
        metalness: era === '2055' ? 0.8 : 0.3
      });
      const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
      building.position.y = height / 2;
      building.castShadow = true;
      building.receiveShadow = true;
      buildingGroup.add(building);

      // Windows
      const floors = Math.floor(height / 3);
      const windowMaterial = new THREE.MeshStandardMaterial({
        color: era === '2055' ? 0x87CEEB : 0x222222,
        emissive: era === '2025' || era === '2055' ? 0xffffff : 0x000000,
        emissiveIntensity: era === '2025' || era === '2055' ? 0.5 : 0
      });

      for (let floor = 0; floor < floors; floor++) {
        for (let wx = 0; wx < Math.floor(width); wx++) {
          for (let wy = 0; wy < Math.floor(config.buildingStyle.detailLevel * 2); wy++) {
            const windowGeometry = new THREE.BoxGeometry(0.5, 0.8, 0.1);
            const windowMesh = new THREE.Mesh(windowGeometry, windowMaterial);
            windowMesh.position.set(
              -width/2 + 1 + wx * (width - 2) / Math.floor(width),
              -height/2 + (floor + 0.5) * 3,
              depth/2 + 0.01
            );
            buildingGroup.add(windowMesh);
          }
        }
      }

      buildingGroup.position.set(x, 0, z);
      sceneRef.current.add(buildingGroup);
      objectsRef.current.push(buildingGroup);
    }

    // Create vehicles
    const vehicleCount = config.vehicleStyle.count * 6;
    for (let i = 0; i < vehicleCount; i++) {
      const x = (i % 6) * 15 - 40;
      const z = Math.floor(i / 6) * 30 - 75;
      
      const vehicleGroup = new THREE.Group();
      
      if (era === '2055') {
        // Flying vehicle
        const bodyGeometry = new THREE.CapsuleGeometry(1, 3, 4, 8);
        const bodyMaterial = new THREE.MeshStandardMaterial({
          color: 0x9932CC,
          emissive: 0x9932CC,
          emissiveIntensity: 0.5
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        vehicleGroup.add(body);

        const thrusterGeometry = new THREE.CylinderGeometry(0.5, 0.8, 0.5, 8);
        const thrusterMaterial = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0x00CED1,
          emissiveIntensity: 1
        });
        const thruster = new THREE.Mesh(thrusterGeometry, thrusterMaterial);
        thruster.position.y = -0.5;
        vehicleGroup.add(thruster);
      } else {
        const carGeometry = new THREE.BoxGeometry(3, 1.5, 1.5);
        const carMaterial = new THREE.MeshStandardMaterial({
          color: era === '1945' ? 0x8B4513 :
                 era === '1965' ? 0xFF0000 :
                 era === '1985' ? 0x00FF00 :
                 era === '2005' ? 0x0000FF : 0x00CED1
        });
        const car = new THREE.Mesh(carGeometry, carMaterial);
        vehicleGroup.add(car);

        // Wheels
        for (let wx = -1; wx <= 1; wx += 2) {
          for (let wz = -1; wz <= 1; wz += 2) {
            const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.5, 16);
            const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.rotation.x = Math.PI / 2;
            wheel.position.set(wx * 1, -0.75, wz * 0.75);
            vehicleGroup.add(wheel);
          }
        }
      }

      vehicleGroup.position.set(x, era === '2055' ? 2 : 0, z);
      vehicleGroup.rotation.y = Math.PI / 2;
      sceneRef.current.add(vehicleGroup);
      objectsRef.current.push(vehicleGroup);
    }

    // Create pedestrians
    const pedestrianCount = config.pedestrianStyle.count * 4;
    for (let i = 0; i < pedestrianCount; i++) {
      const x = (Math.random() - 0.5) * 150;
      const z = (Math.random() - 0.5) * 150;
      
      const pedestrianGroup = new THREE.Group();
      
      const bodyColor = era === '1945' ? 0x8B4513 :
                        era === '1965' ? 0x4169E1 :
                        era === '1985' ? 0xFF69B4 :
                        era === '2005' ? 0x32CD32 :
                        era === '2025' ? 0x00CED1 : 0x9932CC;

      const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1.5, 12);
      const bodyMaterial = new THREE.MeshStandardMaterial({ color: bodyColor });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      body.position.y = 0.5;
      pedestrianGroup.add(body);

      const headGeometry = new THREE.SphereGeometry(0.25, 12, 12);
      const headMaterial = new THREE.MeshStandardMaterial({ color: 0xf5d1a8 });
      const head = new THREE.Mesh(headGeometry, headMaterial);
      head.position.y = 1.3;
      pedestrianGroup.add(head);

      pedestrianGroup.position.set(x, 0, z);
      sceneRef.current.add(pedestrianGroup);
      objectsRef.current.push(pedestrianGroup);
    }

    // Create signage/advertisements
    createSignage(sceneRef.current, objectsRef.current, era);
  };

  useEffect(() => {
    if (!loading && sceneRef.current) {
      updateScene(currentEra);
    }
  }, [loading, currentEra]);

  const handleEraChange = (era: Era) => {
    if (era !== currentEra && !isTransitioning) {
      setIsTransitioning(true);
      audioManagerRef.current?.playTransitionSound();
      
      const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 2000;
      const startTime = performance.now();

      const animateTransition = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        if (progress < 1) {
          requestAnimationFrame(animateTransition);
        } else {
          setCurrentEra(era);
          setIsTransitioning(false);
          audioManagerRef.current?.setEra(era);
        }
      };
      
      requestAnimationFrame(animateTransition);
    }
  };

  if (!webGLSupported) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#111827',
        color: '#fff'
      }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h1>WebGL Not Supported</h1>
          <p>Your browser does not support WebGL, which is required for the 3D city scene.</p>
          <p>Please update your browser or try a different device.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ display: loading ? 'none' : 'block' }} />
      
      {loading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'rgba(0,0,0,0.8)',
          zIndex: 100
        }}>
          <div style={{
            padding: '2rem',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '1rem',
            textAlign: 'center'
          }}>
            <h2>Loading City Scene...</h2>
            <p>Initializing WebGL context</p>
          </div>
        </div>
      )}

      <ControlPanel
        currentEra={currentEra}
        onEraChange={handleEraChange}
        isTransitioning={isTransitioning}
        loading={loading}
      />

      <InfoPanel currentEra={currentEra} />
    </div>
  );
}

// Control Panel Component
interface ControlPanelProps {
  currentEra: Era;
  onEraChange: (era: Era) => void;
  isTransitioning: boolean;
  loading: boolean;
}

function ControlPanel({ currentEra, onEraChange, isTransitioning, loading }: ControlPanelProps) {
  if (loading) return null;

  return (
    <div style={{
      position: 'absolute',
      top: '1rem',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: '0.5rem',
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(10px)',
      padding: '0.75rem',
      borderRadius: '0.75rem',
      border: '1px solid rgba(255,255,255,0.1)',
      zIndex: 10
    }} role="region" aria-label="Time period selection">
      <label htmlFor="era-slider" style={{ 
        color: '#fff', 
        padding: '0 1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        Year: {currentEra}
      </label>
      <input
        id="era-slider"
        type="range"
        min={0}
        max={ERA_YEARS.length - 1}
        value={ERA_YEARS.indexOf(currentEra)}
        onChange={(e) => onEraChange(ERA_YEARS[parseInt(e.target.value)] as Era)}
        style={{ cursor: 'pointer' }}
        aria-label="Select time period"
      />
      <div style={{ display: 'flex', gap: '0.25rem' }}>
        {ERA_YEARS.map((year) => (
          <button
            key={year}
            onClick={() => onEraChange(year as Era)}
            disabled={isTransitioning}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: isTransitioning ? 'not-allowed' : 'pointer',
              background: currentEra === year ? 'rgba(66, 153, 225, 0.8)' : 'rgba(255,255,255,0.1)',
              color: '#fff',
              opacity: isTransitioning ? 0.5 : 1
            }}
            aria-pressed={currentEra === year}
            aria-label={`Set era to ${ERA_CONFIGS[year].name} (${year})`}
          >
            {year}
          </button>
        ))}
      </div>
    </div>
  );
}

// Info Panel Component
interface InfoPanelProps {
  currentEra: Era;
}

function InfoPanel({ currentEra }: InfoPanelProps) {
  return (
    <div style={{
      position: 'absolute',
      bottom: '1rem',
      left: '1rem',
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(10px)',
      padding: '1rem',
      borderRadius: '0.5rem',
      border: '1px solid rgba(255,255,255,0.1)',
      maxWidth: '300px'
    }} aria-live="polite">
      <h3 style={{ margin: '0 0 0.5rem 0' }}>{ERA_CONFIGS[currentEra].name}</h3>
      <p style={{ margin: 0, fontSize: '0.875rem', color: '#ccc' }}>
        {currentEra === '1945' && 'Post-war reconstruction with brick buildings and vintage vehicles.'}
        {currentEra === '1965' && 'Modern architecture emerges with classic cars and neon signs.'}
        {currentEra === '1985' && 'Neon-lit streets with vibrant culture and modern vehicles.'}
        {currentEra === '2005' && 'Digital age with glass towers and electric cars.'}
        {currentEra === '2025' && 'Smart city with holographic displays and autonomous vehicles.'}
        {currentEra === '2055' && 'Future cityscape with flying vehicles and holographic architecture.'}
      </p>
    </div>
  );
}
