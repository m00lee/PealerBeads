// ============================================================
// PealerBeads - 3D Bead Preview (Three.js)
// ============================================================
//
// Renders the perler bead grid as 3D hollow cylinders using
// React Three Fiber. Each bead is a cylinder with a hole.

import { useMemo, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import type { MappedPixel, GridDimensions } from '@/types';
import { TRANSPARENT_KEY } from '@/lib/pixelEditing';

// ---- Bead geometry: hollow cylinder (tube shape) ----

// Create a single bead shape (lathe geometry from cross-section profile)
function createBeadGeometry(): THREE.LatheGeometry {
  // Cross-section profile of a bead (half-profile for lathe)
  // A perler bead is basically a short hollow cylinder with slightly rounded edges
  const points: THREE.Vector2[] = [];

  const innerR = 0.1;  // hole radius
  const outerR = 0.42;  // outer radius
  const height = 0.22;  // bead height
  const bevel = 0.04;   // edge rounding

  // Bottom inner edge → bottom outer edge
  points.push(new THREE.Vector2(innerR, 0));
  points.push(new THREE.Vector2(outerR - bevel, 0));
  points.push(new THREE.Vector2(outerR, bevel));
  // Outer wall up
  points.push(new THREE.Vector2(outerR, height - bevel));
  points.push(new THREE.Vector2(outerR - bevel, height));
  // Top outer edge → top inner edge
  points.push(new THREE.Vector2(innerR, height));

  // Create lathe geometry (revolve around Y axis)
  return new THREE.LatheGeometry(points, 16);
}

// ---- Pegboard base ----

function Pegboard({ cols, rows }: { cols: number; rows: number }) {
  const geometry = useMemo(() => {
    const w = cols;
    const h = rows;
    const geo = new THREE.BoxGeometry(w, 0.08, h);
    return geo;
  }, [cols, rows]);

  return (
    <mesh position={[cols / 2 - 0.5, -0.04, rows / 2 - 0.5]} geometry={geometry}>
      <meshStandardMaterial color="#e8dfc8" roughness={0.7} />
    </mesh>
  );
}

// ---- Pegboard pegs ----
function Pegs({ cols, rows }: { cols: number; rows: number }) {
  const pegGeo = useMemo(() => new THREE.CylinderGeometry(0.06, 0.06, 0.2, 8), []);

  const positions = useMemo(() => {
    const pos: [number, number, number][] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        pos.push([c, 0.1, r]);
      }
    }
    return pos;
  }, [cols, rows]);

  // Use instanced mesh for performance
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useMemo(() => {
    if (!meshRef.current) return;
    positions.forEach((pos, i) => {
      dummy.position.set(pos[0], pos[1], pos[2]);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [positions, dummy]);

  // Also set in useFrame to handle initial render
  useFrame(() => {
    if (!meshRef.current || meshRef.current.userData.initialized) return;
    positions.forEach((pos, i) => {
      dummy.position.set(pos[0], pos[1], pos[2]);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    meshRef.current.userData.initialized = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[pegGeo, undefined, positions.length]}>
      <meshStandardMaterial color="#d4ccc0" roughness={0.5} />
    </instancedMesh>
  );
}

// ---- Bead instances ----

interface BeadData {
  x: number;
  z: number;
  color: string;
}

function BeadInstances({ beads }: { beads: BeadData[] }) {
  const beadGeo = useMemo(() => createBeadGeometry(), []);

  // Group beads by color for instanced rendering
  const colorGroups = useMemo(() => {
    const groups = new Map<string, BeadData[]>();
    for (const bead of beads) {
      const arr = groups.get(bead.color) || [];
      arr.push(bead);
      groups.set(bead.color, arr);
    }
    return groups;
  }, [beads]);

  return (
    <>
      {Array.from(colorGroups.entries()).map(([color, group]) => (
        <BeadColorGroup key={color} beads={group} color={color} geometry={beadGeo} />
      ))}
    </>
  );
}

function BeadColorGroup({
  beads,
  color,
  geometry,
}: {
  beads: BeadData[];
  color: string;
  geometry: THREE.LatheGeometry;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const threeColor = useMemo(() => new THREE.Color(color), [color]);

  useFrame(() => {
    if (!meshRef.current || meshRef.current.userData.initialized) return;
    beads.forEach((bead, i) => {
      dummy.position.set(bead.x, 0.04, bead.z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    meshRef.current.userData.initialized = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, beads.length]}>
      <meshStandardMaterial
        color={threeColor}
        roughness={0.3}
        metalness={0.05}
      />
    </instancedMesh>
  );
}

// ---- Scene ----

function Scene({ pixels, dims }: { pixels: MappedPixel[][]; dims: GridDimensions }) {
  const beads = useMemo(() => {
    const result: BeadData[] = [];
    for (let j = 0; j < dims.M; j++) {
      for (let i = 0; i < dims.N; i++) {
        const cell = pixels[j]?.[i];
        if (cell && !cell.isExternal && cell.key !== TRANSPARENT_KEY) {
          result.push({ x: i, z: j, color: cell.color });
        }
      }
    }
    return result;
  }, [pixels, dims]);

  const center = useMemo(
    () => [dims.N / 2 - 0.5, 0, dims.M / 2 - 0.5] as [number, number, number],
    [dims]
  );

  const camDist = Math.max(dims.N, dims.M) * 0.9;

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[center[0], camDist * 0.6, center[2] + camDist * 0.8]}
        fov={45}
        near={0.1}
        far={camDist * 5}
      />
      <OrbitControls target={center} enableDamping dampingFactor={0.1} />

      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[center[0] + 10, 20, center[2] - 10]} intensity={0.8} castShadow />
      <directionalLight position={[center[0] - 10, 15, center[2] + 10]} intensity={0.3} />

      {/* Pegboard */}
      <Pegboard cols={dims.N} rows={dims.M} />
      <Pegs cols={dims.N} rows={dims.M} />

      {/* Beads */}
      <BeadInstances beads={beads} />
    </>
  );
}

// ---- Main Component ----

export function Preview3D({
  pixels,
  dims,
  onClose,
}: {
  pixels: MappedPixel[][];
  dims: GridDimensions;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-light/90 border-b border-surface-lighter">
        <h2 className="text-sm font-medium text-text">3D 拼豆预览</h2>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-text-dim">鼠标左键旋转 | 右键平移 | 滚轮缩放</span>
          <button
            className="px-3 py-1 text-sm text-text-muted hover:text-text rounded transition-colors border border-surface-lighter hover:bg-surface"
            onClick={onClose}
          >
            关闭
          </button>
        </div>
      </div>

      {/* 3D Canvas */}
      <div className="flex-1">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full text-text-muted">
              <div className="text-center">
                <div className="text-2xl mb-2">⏳</div>
                <p className="text-sm">加载 3D 场景...</p>
              </div>
            </div>
          }
        >
          <Canvas
            gl={{ antialias: true, alpha: false }}
            style={{ background: '#1a1a2e' }}
          >
            <Scene pixels={pixels} dims={dims} />
          </Canvas>
        </Suspense>
      </div>
    </div>
  );
}
