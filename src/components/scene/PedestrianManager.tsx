import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, memo } from 'react';
import * as THREE from 'three';
import { PedestrianStyle, EraId, lerp } from '../../types';

type PedestrianData = {
  id: number;
  position: [number, number, number];
  direction: number;
  speed: number;
  style: PedestrianStyle;
  walkCycle: number;
};

const createRng = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 0x100000000;
    return state / 0x100000000;
  };
};

const generatePedestrians = (count: number, era: EraId, style: PedestrianStyle): PedestrianData[] => {
  const pedestrians: PedestrianData[] = [];
  const rng = createRng(200);

  const streetLength = 50;
  const sidewalkWidth = 4;

  for (let i = 0; i < count; i++) {
    const isOnSidewalk = rng() > 0.3;
    const isVertical = rng() > 0.5;

    let position: [number, number, number];
    let direction: number;

    if (isVertical) {
      if (isOnSidewalk) {
        // Sidewalk on east-west street
        position = [
          -streetLength / 2 + rng() * streetLength,
          0,
          (rng() - 0.5) * sidewalkWidth + (rng() > 0.5 ? sidewalkWidth + 4 : -sidewalkWidth - 4),
        ];
      } else {
        // On the street (crossing)
        position = [
          -streetLength / 2 + rng() * streetLength,
          0,
          (rng() - 0.5) * 8,
        ];
      }
      direction = rng() > 0.5 ? 0 : Math.PI;
    } else {
      if (isOnSidewalk) {
        position = [
          (rng() - 0.5) * sidewalkWidth + (rng() > 0.5 ? sidewalkWidth + 4 : -sidewalkWidth - 4),
          0,
          -streetLength / 2 + rng() * streetLength,
        ];
      } else {
        position = [
          (rng() - 0.5) * 8,
          0,
          -streetLength / 2 + rng() * streetLength,
        ];
      }
      direction = rng() > 0.5 ? Math.PI / 2 : -Math.PI / 2;
    }

    pedestrians.push({
      id: i,
      position,
      direction,
      speed: 0.8 + rng() * 1.5,
      style,
      walkCycle: rng() * Math.PI * 2,
    });
  }

  return pedestrians;
};

const getStyleColor = (style: PedestrianStyle): string => {
  const colors: Record<PedestrianStyle, string> = {
    '1940s': '#3E2723',
    '1960s': '#4A148C',
    '1980s': '#006064',
    '2000s': '#1565C0',
    casual: '#37474F',
    futuristic: '#4527A0',
  };
  return colors[style];
};

const getAccessoryColor = (style: PedestrianStyle): string => {
  const colors: Record<PedestrianStyle, string> = {
    '1940s': '#795548',
    '1960s': '#D81B60',
    '1980s': '#FFD600',
    '2000s': '#00C853',
    casual: '#FF6D00',
    futuristic: '#7C4DFF',
  };
  return colors[style];
};

const Pedestrian = memo(({
  data,
  pedestrianStyle,
  transitionProgress,
}: {
  data: PedestrianData;
  pedestrianStyle: PedestrianStyle;
  transitionProgress: number;
}) => {
  const groupRef = useRef<THREE.Group>(null);

  const bodyColor = useMemo(() => getStyleColor(pedestrianStyle), [pedestrianStyle]);
  const accessoryColor = useMemo(() => getAccessoryColor(pedestrianStyle), [pedestrianStyle]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Move pedestrian
    const moveX = Math.sin(data.direction) * data.speed * delta * 60;
    const moveZ = Math.cos(data.direction) * data.speed * delta * 60;

    groupRef.current.position.x += moveX;
    groupRef.current.position.z += moveZ;

    // Walking animation
    data.walkCycle += delta * 5;
    const walkBob = Math.sin(data.walkCycle) * 0.1;
    const walkSwing = Math.sin(data.walkCycle * 2) * 0.2;

    // Apply walking animation to limbs
    if (groupRef.current.children.length > 0) {
      // Body bob
      groupRef.current.position.y = Math.abs(walkBob) * 0.3;

      // Arm swing
      const arms = groupRef.current.getObjectByName('arms');
      if (arms) {
        arms.rotation.x = walkSwing * 0.5;
      }

      // Leg swing
      const legs = groupRef.current.getObjectByName('legs');
      if (legs) {
        legs.rotation.x = walkSwing * 0.3;
      }
    }

    // Reset position when pedestrian goes off sidewalk
    const maxDist = 55;
    if (Math.abs(groupRef.current.position.x) > maxDist || Math.abs(groupRef.current.position.z) > maxDist) {
      groupRef.current.position.set(data.position[0], data.position[1], data.position[2]);
      data.walkCycle = 0;
    }
  });

  // Build pedestrian geometry
  const pedestrianGeometry = useMemo(() => {
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.CapsuleGeometry(0.15, 0.5, 4, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.name = 'body';
    body.position.y = 1.0;
    group.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.2, 12, 12);
    const headMat = new THREE.MeshStandardMaterial({ color: '#FDBCB4' });
    const head = new THREE.Mesh(headGeo, headMat);
    head.name = 'head';
    head.position.y = 1.6;
    group.add(head);

    // Arms (as a group for animation)
    const arms = new THREE.Group();
    arms.name = 'arms';
    const armGeo = new THREE.CapsuleGeometry(0.06, 0.5, 2, 8);
    const armMat = new THREE.MeshStandardMaterial({ color: bodyColor });
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.3, -0.1, 0);
    arms.add(leftArm);
    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.3, -0.1, 0);
    arms.add(rightArm);
    group.add(arms);

    // Legs (as a group for animation)
    const legs = new THREE.Group();
    legs.name = 'legs';
    const legGeo = new THREE.CapsuleGeometry(0.08, 0.5, 2, 8);
    const legMat = new THREE.MeshStandardMaterial({ color: '#1565C0' });
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.1, -0.6, 0);
    legs.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.1, -0.6, 0);
    legs.add(rightLeg);
    group.add(legs);

    // Hat/accessory for certain eras
    if (pedestrianStyle === '1940s' || pedestrianStyle === '1960s') {
      const hatGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.1, 16);
      const hatMat = new THREE.MeshStandardMaterial({ color: '#3E2723' });
      const hat = new THREE.Mesh(hatGeo, hatMat);
      hat.position.y = 1.85;
      group.add(hat);
    }

    // Backpack/accessory for futuristic
    if (pedestrianStyle === 'futuristic') {
      const packGeo = new THREE.BoxGeometry(0.3, 0.4, 0.1);
      const packMat = new THREE.MeshStandardMaterial({ color: accessoryColor, emissive: accessoryColor, emissiveIntensity: 0.5 });
      const pack = new THREE.Mesh(packGeo, packMat);
      pack.position.y = 1.0;
      pack.position.z = -0.2;
      group.add(pack);
    }

    return group;
  }, [bodyColor, accessoryColor, pedestrianStyle]);

  return (
    <group ref={groupRef} position={data.position} rotation={[0, data.direction, 0]}>
      <primitive object={pedestrianGeometry.clone()} />
    </group>
  );
});

export const PedestrianManager = ({
  pedestrianStyle,
  pedestrianCount,
  era,
  transitionProgress,
}: {
  pedestrianStyle: PedestrianStyle;
  pedestrianCount: number;
  era: EraId;
  transitionProgress: number;
}) => {
  const pedestrians = useMemo(
    () => generatePedestrians(pedestrianCount, era, pedestrianStyle),
    [pedestrianCount, era, pedestrianStyle]
  );

  return (
    <group>
      {pedestrians.map((pedestrian) => (
        <Pedestrian
          key={pedestrian.id}
          data={pedestrian}
          pedestrianStyle={pedestrianStyle}
          transitionProgress={transitionProgress}
        />
      ))}
    </group>
  );
};
