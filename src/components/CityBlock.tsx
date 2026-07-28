import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, InstancedMesh, Material, Mesh, Object3D, Color, Group, MathUtils } from 'three';
import { Era } from '../state';

const BUILDING_COUNT = 20;
const VEHICLE_COUNT = 12;
const PEDESTRIAN_COUNT = 30;

const dummy = new Object3D();
const tmpColor = new Color();

interface Props {
  era: Era;
}

export function CityBlock({ era }: Props) {
  const buildingsRef = useRef<InstancedMesh>(null!);
  const vehiclesRef = useRef<InstancedMesh>(null!);
  const pedestriansRef = useRef<InstancedMesh>(null!);
  const groupRef = useRef<Group>(null!);

  const buildingData = useMemo(() => {
    return Array.from({ length: BUILDING_COUNT }, (_, i) => ({
      x: MathUtils.lerp(-18, 18, i / (BUILDING_COUNT - 1)) + (Math.random() - 0.5) * 3,
      z: (Math.random() - 0.5) * 20 - 2,
      baseHeight: 3 + Math.random() * 12,
      width: 2 + Math.random() * 3,
      depth: 2 + Math.random() * 3,
      seed: Math.random(),
    }));
  }, []);

  const vehicleData = useMemo(() => {
    return Array.from({ length: VEHICLE_COUNT }, (_, i) => ({
      lane: i % 2 === 0 ? 1 : -1,
      z: MathUtils.lerp(-15, 15, i / (VEHICLE_COUNT - 1)) + (Math.random() - 0.5) * 2,
      speed: 2 + Math.random() * 3,
      offset: Math.random() * Math.PI * 2,
    }));
  }, []);

  const pedestrianData = useMemo(() => {
    return Array.from({ length: PEDESTRIAN_COUNT }, (_, i) => ({
      side: i % 2 === 0 ? 1 : -1,
      z: MathUtils.lerp(-15, 15, i / (PEDESTRIAN_COUNT - 1)) + (Math.random() - 0.5) * 2,
      speed: 0.5 + Math.random() * 1.5,
      offset: Math.random() * Math.PI * 2,
    }));
  }, []);

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    for (let i = 0; i < buildingData.length; i++) {
      const b = buildingData[i];
      const height = b.baseHeight;
      dummy.scale.set(b.width, height, b.depth);
      dummy.position.set(b.x, height / 2, b.z);
      dummy.updateMatrix();
      buildingsRef.current.setMatrixAt(i, dummy.matrix);
    }
    buildingsRef.current.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < vehicleData.length; i++) {
      const v = vehicleData[i];
      const x = v.lane * Math.sin(time * v.speed + v.offset) * 16;
      dummy.position.set(x, 0.5, v.z);
      dummy.rotation.set(0, v.lane > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
      dummy.scale.set(1.5, 0.6, 0.6);
      dummy.updateMatrix();
      vehiclesRef.current.setMatrixAt(i, dummy.matrix);
    }
    vehiclesRef.current.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < pedestrianData.length; i++) {
      const p = pedestrianData[i];
      const x = p.side * Math.sin(time * p.speed + p.offset) * 14;
      dummy.position.set(x, 0.8, p.z);
      dummy.rotation.set(0, p.side > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
      dummy.scale.set(0.3, 1.6, 0.2);
      dummy.updateMatrix();
      pedestriansRef.current.setMatrixAt(i, dummy.matrix);
    }
    pedestriansRef.current.instanceMatrix.needsUpdate = true;
  });

  const buildingColor = useMemo(() => {
    const colors = ['#8B4513', '#FFB6C1', '#000080', '#4682B4', '#32CD32', '#00FFFF'];
    return colors[era];
  }, [era]);

  const vehicleColor = useMemo(() => {
    const colors = ['#8B4513', '#FFB6C1', '#000080', '#4682B4', '#32CD32', '#00FFFF'];
    return colors[era];
  }, [era]);

  const pedestrianColor = useMemo(() => {
    const colors = ['#8B4513', '#FFB6C1', '#000080', '#4682B4', '#32CD32', '#00FFFF'];
    return colors[era];
  }, [era]);

  const boxGeom = useMemo(() => new BoxGeometry(1, 1, 1), []);

  return (
    <group ref={groupRef}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#222" />
      </mesh>

      <instancedMesh
        ref={buildingsRef}
        args={[boxGeom, null as unknown as Material, buildingData.length]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={buildingColor} />
      </instancedMesh>

      <instancedMesh
        ref={vehiclesRef}
        args={[boxGeom, null as unknown as Material, vehicleData.length]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={vehicleColor} />
      </instancedMesh>

      <instancedMesh
        ref={pedestriansRef}
        args={[boxGeom, null as unknown as Material, pedestrianData.length]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={pedestrianColor} />
      </instancedMesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[4, 20]} />
        <meshStandardMaterial color="#333" />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-4, 0.01, 0]} receiveShadow>
        <planeGeometry args={[4, 20]} />
        <meshStandardMaterial color="#555" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[4, 0.01, 0]} receiveShadow>
        <planeGeometry args={[4, 20]} />
        <meshStandardMaterial color="#555" />
      </mesh>
    </group>
  );
}
