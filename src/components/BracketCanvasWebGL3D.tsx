/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Visualizador Espacial WebGL 3D (Z-Space Depth) con Three.js puro,
 * Tarjetas Holográficas 3D de Alta Definición, Conectores Curvos 3D (CubicBezierCurve3 + TubeGeometry),
 * Presets de Cámara Orbital y Modo Celebración 3D.
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  BracketPhase,
  OBFDocument,
  OBFEntrant,
  OBFSet,
} from '../engine/nikBracketsEngine';
import { Video, Trophy } from 'lucide-react';

interface BracketCanvasWebGL3DProps {
  obf: OBFDocument;
  selectedSetID: string;
  onSelectSet: (setID: string) => void;
}

type CameraPresetKey = 'global' | 'stream' | 'winners' | 'losers' | 'second_chance' | 'finals';

const PHASE_PALETTE: Record<
  BracketPhase,
  { hex: string; num: number; headerText: string }
> = {
  SWISS: { hex: '#00F0FF', num: 0x00f0ff, headerText: '#041019' },
  WINNERS: { hex: '#00F0FF', num: 0x00f0ff, headerText: '#041019' },
  LOSERS: { hex: '#FF0055', num: 0xff0055, headerText: '#FFFFFF' },
  SECOND_CHANCE: { hex: '#10B981', num: 0x10b981, headerText: '#031811' },
  GRAND_FINAL: { hex: '#F59E0B', num: 0xf59e0b, headerText: '#190E02' },
  GRAND_FINAL_RESET: { hex: '#F59E0B', num: 0xf59e0b, headerText: '#190E02' },
  THIRD_PLACE: { hex: '#38BDF8', num: 0x38bdf8, headerText: '#041019' },
  ROUND_ROBIN: { hex: '#00F0FF', num: 0x00f0ff, headerText: '#041019' },
  FFA_STAGE: { hex: '#A855F7', num: 0xa855f7, headerText: '#FFFFFF' },
  LEADERBOARD_STAGE: { hex: '#00F0FF', num: 0x00f0ff, headerText: '#041019' },
};

/**
 * Dibuja la textura frontal de alta resolución (1024x512) de cada Estación 3D
 * replicando fielmente el diseño Cyber-Esports del repositorio base.
 */
function createStationCardCanvasTexture(
  set: OBFSet,
  p1: OBFEntrant | undefined,
  p2: OBFEntrant | undefined,
  isSelected: boolean,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const theme = PHASE_PALETTE[set.phase] || PHASE_PALETTE.WINNERS;

  // Fondo principal oscuro Cyber-Slate
  ctx.fillStyle = isSelected ? '#132038' : '#0B1320';
  ctx.fillRect(0, 0, 1024, 512);

  // Franja superior de color de fase (Header)
  ctx.fillStyle = theme.hex;
  ctx.fillRect(0, 0, 1024, 104);

  // Borde exterior luminoso
  ctx.strokeStyle = isSelected ? '#FFFFFF' : theme.hex;
  ctx.lineWidth = isSelected ? 14 : 9;
  ctx.strokeRect(4, 4, 1016, 504);

  // Texto del Header (ID del Set + Nombre de Ronda)
  ctx.fillStyle = theme.headerText;
  ctx.font = 'bold 33px "Plus Jakarta Sans", "Outfit", sans-serif';
  const maxChars = set.other.isStream ? 25 : 36;
  const titleText = `${set.setID} • ${set.roundLabel}`;
  ctx.fillText(titleText.slice(0, maxChars), 32, 66);

  // Etiqueta LIVE STREAM morada si la estación es de transmisión
  if (set.other.isStream) {
    const badgeW = 244;
    const badgeH = 58;
    const badgeX = 1024 - badgeW - 24;
    const badgeY = 23;

    ctx.fillStyle = '#8A2BE2';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 10);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 26px "JetBrains Mono", monospace';
    ctx.fillText('LIVE STREAM', badgeX + 24, badgeY + 38);
  }

  // Fila Jugador 1
  const p1Label = p1 ? `#${p1.initialSeed} ${p1.entrantTag}` : 'TBD (Esperando)';
  const p1Won = set.status === 'COMPLETED' && set.winnerID === set.entrant1ID;
  ctx.fillStyle = p1 ? (p1Won ? '#FFFFFF' : '#E2E8F0') : '#64748B';
  ctx.font = `${p1Won ? 'bold' : '600'} 42px "Plus Jakarta Sans", sans-serif`;
  ctx.fillText(p1Label.slice(0, 24), 38, 205);

  // Marcador Jugador 1
  ctx.fillStyle = p1Won ? '#00F0FF' : theme.hex;
  ctx.font = 'bold 54px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(String(set.entrant1Score), 975, 210);
  ctx.textAlign = 'left';

  // Línea divisoria central
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(34, 258);
  ctx.lineTo(990, 258);
  ctx.stroke();

  // Fila Jugador 2
  const p2Label = p2 ? `#${p2.initialSeed} ${p2.entrantTag}` : 'TBD (Esperando)';
  const p2Won = set.status === 'COMPLETED' && set.winnerID === set.entrant2ID;
  ctx.fillStyle = p2 ? (p2Won ? '#FFFFFF' : '#CBD5E1') : '#64748B';
  ctx.font = `${p2Won ? 'bold' : '600'} 42px "Plus Jakarta Sans", sans-serif`;
  ctx.fillText(p2Label.slice(0, 24), 38, 342);

  // Marcador Jugador 2
  ctx.fillStyle = p2Won ? '#00F0FF' : '#E2E8F0';
  ctx.font = 'bold 54px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(String(set.entrant2Score), 975, 346);
  ctx.textAlign = 'left';

  // Franja inferior de Metadatos de Estación y Estado
  ctx.fillStyle = '#060A12';
  ctx.fillRect(8, 412, 1008, 92);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 26px "JetBrains Mono", monospace';
  const stationStr = `Estación: ${set.other.station || 'EST-01'} • Estado: ${set.status}`;
  ctx.fillText(stationStr, 38, 468);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

export const BracketCanvasWebGL3D: React.FC<BracketCanvasWebGL3DProps> = ({
  obf,
  selectedSetID,
  onSelectSet,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const onSelectRef = useRef(onSelectSet);
  onSelectRef.current = onSelectSet;

  const [activePreset, setActivePreset] = useState<CameraPresetKey>('global');
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [celebrationActive, setCelebrationActive] = useState<boolean>(false);
  const [hoveredSetID, setHoveredSetID] = useState<string | null>(null);

  const cameraTargetRef = useRef<{
    pos: THREE.Vector3;
    look: THREE.Vector3;
    transitioning: boolean;
  }>({
    pos: new THREE.Vector3(3.2, -1.2, 41.5),
    look: new THREE.Vector3(3.2, -1.4, 0.0),
    transitioning: false,
  });

  const autoRotateRef = useRef<boolean>(false);
  const celebrationRef = useRef<boolean>(false);
  const syncBracketTo3DRef = useRef<((doc: OBFDocument, selId: string) => void) | null>(null);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    celebrationRef.current = celebrationActive;
  }, [celebrationActive]);

  const computeGlobalFraming = (sets: OBFSet[]) => {
    if (!sets || sets.length === 0) {
      return {
        pos: new THREE.Vector3(3.2, -1.2, 41.5),
        look: new THREE.Vector3(3.2, -1.4, 0.0),
      };
    }
    const xs = sets.map((s) => s.other.position3D?.[0] ?? 0);
    const ys = sets.map((s) => s.other.position3D?.[1] ?? 0);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const centerX = Number(((minX + maxX) * 0.5).toFixed(2));
    const centerY = Number(((minY + maxY) * 0.5).toFixed(2));
    const spanX = Math.max(10, maxX - minX + 7);
    const spanY = Math.max(8, maxY - minY + 6);
    const distanceZ = Math.min(62, Math.max(24, Math.max(spanX * 0.92, spanY * 1.32)));
    return {
      pos: new THREE.Vector3(centerX, centerY + 0.2, distanceZ),
      look: new THREE.Vector3(centerX, centerY, 0.0),
    };
  };

  const applyCameraPreset = (preset: CameraPresetKey) => {
    setActivePreset(preset);
    if (preset === 'global') {
      const globalFrame = computeGlobalFraming(obf.sets);
      cameraTargetRef.current = {
        pos: globalFrame.pos,
        look: globalFrame.look,
        transitioning: true,
      };
    } else if (preset === 'stream') {
      const streamSet =
        obf.sets.find((s) => s.other.isStream && s.status !== 'COMPLETED') ||
        obf.sets.find((s) => s.other.isStream) ||
        obf.sets[0];
      const [sx, sy, sz] = streamSet?.other.position3D || [6.4, 5.4, 0];
      cameraTargetRef.current = {
        pos: new THREE.Vector3(sx - 0.8, sy + 0.8, sz + 8.2),
        look: new THREE.Vector3(sx, sy, sz),
        transitioning: true,
      };
      if (streamSet) onSelectSet(streamSet.setID);
    } else if (preset === 'winners') {
      const winnerSets = obf.sets.filter(
        (s) => s.phase === 'WINNERS' || s.phase === 'SWISS' || s.phase === 'ROUND_ROBIN'
      );
      const frame = computeGlobalFraming(winnerSets.length > 0 ? winnerSets : obf.sets);
      cameraTargetRef.current = {
        pos: new THREE.Vector3(frame.look.x, frame.look.y + 0.2, Math.max(18, frame.pos.z * 0.72)),
        look: frame.look,
        transitioning: true,
      };
    } else if (preset === 'losers') {
      const loserSets = obf.sets.filter((s) => s.phase === 'LOSERS');
      const frame = computeGlobalFraming(loserSets.length > 0 ? loserSets : obf.sets);
      cameraTargetRef.current = {
        pos: new THREE.Vector3(frame.look.x, frame.look.y, Math.max(18, frame.pos.z * 0.72)),
        look: new THREE.Vector3(frame.look.x, frame.look.y, -2.2),
        transitioning: true,
      };
    } else if (preset === 'second_chance') {
      const scSets = obf.sets.filter((s) => s.phase === 'SECOND_CHANCE');
      const frame = computeGlobalFraming(scSets.length > 0 ? scSets : obf.sets);
      cameraTargetRef.current = {
        pos: new THREE.Vector3(frame.look.x, frame.look.y, Math.max(18, frame.pos.z * 0.75)),
        look: new THREE.Vector3(frame.look.x, frame.look.y, 1.2),
        transitioning: true,
      };
    } else if (preset === 'finals') {
      const finalSets = obf.sets.filter(
        (s) =>
          s.phase === 'GRAND_FINAL' ||
          s.phase === 'GRAND_FINAL_RESET' ||
          s.phase === 'THIRD_PLACE' ||
          s.roundLabel.toLowerCase().includes('final')
      );
      const frame = computeGlobalFraming(finalSets.length > 0 ? finalSets : obf.sets);
      cameraTargetRef.current = {
        pos: new THREE.Vector3(frame.look.x, frame.look.y + 0.3, Math.max(19, frame.pos.z * 0.78)),
        look: frame.look,
        transitioning: true,
      };
    }
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || 1020;
    const height = container.clientHeight || 680;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040810);
    scene.fog = new THREE.FogExp2(0x040810, 0.0075);

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 240);
    camera.position.set(3.2, -1.2, 41.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(3.2, -1.4, 0.0);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.maxDistance = 78;
    controls.minDistance = 4;
    controls.maxPolarAngle = Math.PI / 2 + 0.15;

    controls.addEventListener('start', () => {
      cameraTargetRef.current.transitioning = false;
    });

    // Iluminación de estudio Cyber-Esports
    const hemiLight = new THREE.HemisphereLight(0x00f0ff, 0x090d16, 0.95);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
    keyLight.position.set(-10, 18, 16);
    scene.add(keyLight);

    const cyanPoint = new THREE.PointLight(0x00f0ff, 2.6, 65);
    cyanPoint.position.set(-8, 10, 10);
    scene.add(cyanPoint);

    const crimsonPoint = new THREE.PointLight(0xff0055, 2.2, 65);
    crimsonPoint.position.set(8, -8, -4);
    scene.add(crimsonPoint);

    // Piso de Grilla Perspectiva Z-Space ubicado debajo de la 3ra banda de perdedores
    const gridHelper = new THREE.GridHelper(110, 88, 0x00f0ff, 0x0d2840);
    gridHelper.position.set(3, -19.4, 0);
    const gridMat = gridHelper.material as THREE.Material;
    if (!Array.isArray(gridMat)) {
      gridMat.transparent = true;
      gridMat.opacity = 0.72;
    }
    scene.add(gridHelper);

    const floorGeo = new THREE.PlaneGeometry(150, 150);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x03060c,
      roughness: 0.35,
      metalness: 0.75,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(3, -19.48, 0);
    scene.add(floorMesh);

    // Partículas holográficas flotantes en Z-Space
    const particleCount = 180;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.45) * 64;
      particlePositions[i * 3 + 1] = -18.0 + Math.random() * 34;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 24;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.14,
      transparent: true,
      opacity: 0.85,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // Trofeo 3D Compuesto para Celebración 3D (ubicado sobre la Grand Final a la derecha)
    const trophyGroup = new THREE.Group();
    trophyGroup.position.set(22.4, 5.2, 1.2);
    trophyGroup.visible = false;

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.92,
      roughness: 0.16,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.3,
    });
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.7,
      roughness: 0.35,
    });
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.85, 0.42, 24), baseMat);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 0.75, 20), goldMat);
    stem.position.y = 0.55;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.28, 0.9, 24), goldMat);
    cup.position.y = 1.25;
    const haloRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.05, 16, 48),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    haloRing.position.y = 1.15;
    trophyGroup.add(pedestal, stem, cup, haloRing);
    scene.add(trophyGroup);

    const stationsRoot = new THREE.Group();
    const connectorsRoot = new THREE.Group();
    scene.add(stationsRoot);
    scene.add(connectorsRoot);

    const interactiveMeshes: THREE.Mesh[] = [];
    const stationGroups: Array<{ group: THREE.Group; baseY: number; phaseOffset: number }> = [];
    const pulseTravelers: Array<{
      mesh: THREE.Mesh;
      curve: THREE.CubicBezierCurve3;
      speed: number;
      offset: number;
    }> = [];

    const clearDynamicScene = () => {
      while (stationsRoot.children.length > 0) {
        const child = stationsRoot.children[0];
        child.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const m = obj as THREE.Mesh;
            m.geometry?.dispose();
            if (Array.isArray(m.material)) {
              m.material.forEach((mat) => {
                (mat as THREE.MeshStandardMaterial).map?.dispose();
                mat.dispose();
              });
            } else if (m.material) {
              (m.material as THREE.MeshStandardMaterial).map?.dispose();
              m.material.dispose();
            }
          }
        });
        stationsRoot.remove(child);
      }

      while (connectorsRoot.children.length > 0) {
        const child = connectorsRoot.children[0];
        child.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh || (obj as THREE.Line).isLine) {
            const m = obj as THREE.Mesh;
            m.geometry?.dispose();
            if (Array.isArray(m.material)) {
              m.material.forEach((mat) => mat.dispose());
            } else {
              m.material?.dispose();
            }
          }
        });
        connectorsRoot.remove(child);
      }

      interactiveMeshes.length = 0;
      stationGroups.length = 0;
      pulseTravelers.length = 0;
    };

    /**
     * Construye todas las Tarjetas 3D Holográficas en sus planos Z-Space reales
     * y traza los Conectores Curvos 3D (CubicBezierCurve3 + TubeGeometry + Pulsos)
     */
    syncBracketTo3DRef.current = (doc: OBFDocument, selId: string) => {
      clearDynamicScene();

      const entrantMap = new Map<string, OBFEntrant>();
      for (const e of doc.entrants) entrantMap.set(e.entrantID, e);

      const posMap = new Map<string, THREE.Vector3>();
      const cardW = 3.65;
      const cardH = 1.85;
      const cardD = 0.18;

      for (const set of doc.sets) {
        const [px, py, pz] = set.other.position3D || [0, 0, 0];
        const vec = new THREE.Vector3(px, py, pz);
        posMap.set(set.setID, vec);

        const p1 = set.entrant1ID ? entrantMap.get(set.entrant1ID) : undefined;
        const p2 = set.entrant2ID ? entrantMap.get(set.entrant2ID) : undefined;
        const isSelected = set.setID === selId;
        const theme = PHASE_PALETTE[set.phase] || PHASE_PALETTE.WINNERS;

        const stationGroup = new THREE.Group();
        stationGroup.position.copy(vec);
        // Orientación frontal limpia para que todos los rectángulos se distingan sin solaparse
        stationGroup.rotation.y = 0.02;

        // 1. Chasis 3D Biselado Metálico con Borde Emisivo
        const chassisGeo = new THREE.BoxGeometry(cardW, cardH, cardD);
        const sideMat = new THREE.MeshStandardMaterial({
          color: 0x0c1524,
          metalness: 0.85,
          roughness: 0.22,
          emissive: new THREE.Color(theme.num),
          emissiveIntensity: isSelected ? 0.75 : 0.28,
        });

        const frontTexture = createStationCardCanvasTexture(
          set,
          p1,
          p2,
          isSelected,
          maxAnisotropy
        );
        const frontMat = new THREE.MeshBasicMaterial({
          map: frontTexture,
        });
        const backMat = new THREE.MeshStandardMaterial({
          color: 0x070b14,
          metalness: 0.8,
          roughness: 0.4,
        });

        const boxMesh = new THREE.Mesh(chassisGeo, [
          sideMat, // right
          sideMat, // left
          sideMat, // top
          sideMat, // bottom
          frontMat, // front (+Z)
          backMat, // back (-Z)
        ]);
        boxMesh.userData = { setID: set.setID };
        interactiveMeshes.push(boxMesh);
        stationGroup.add(boxMesh);

        // 2. Marco Holográfico Exterior 3D (Wireframe / Rim Glow)
        const edgesGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(cardW + 0.05, cardH + 0.05, cardD + 0.02));
        const edgesMat = new THREE.LineBasicMaterial({
          color: isSelected ? 0xffffff : theme.num,
          transparent: true,
          opacity: isSelected ? 1.0 : 0.88,
        });
        const wireframe = new THREE.LineSegments(edgesGeo, edgesMat);
        stationGroup.add(wireframe);

        // 3. Baliza 3D Superior para la Estación Seleccionada o de Stream Principal
        if (isSelected || set.other.isStream) {
          const beaconGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
          const beaconMat = new THREE.MeshStandardMaterial({
            color: theme.num,
            emissive: theme.num,
            emissiveIntensity: 0.8,
            metalness: 0.5,
            roughness: 0.2,
          });
          const beacon = new THREE.Mesh(beaconGeo, beaconMat);
          beacon.position.set(0.65, cardH / 2 + 0.34, -0.1);
          stationGroup.add(beacon);
        }

        stationsRoot.add(stationGroup);
        stationGroups.push({
          group: stationGroup,
          baseY: py,
          phaseOffset: px * 0.4 + pz * 0.3,
        });
      }

      // CONECTORES CURVOS 3D EN Z-SPACE (Winners y Losers / Second Chance)
      for (const set of doc.sets) {
        const startCenter = posMap.get(set.setID);
        if (!startCenter) continue;
        const theme = PHASE_PALETTE[set.phase] || PHASE_PALETTE.WINNERS;

        // A. Conector 3D de Avance al Siguiente Set de Ganadores (nextWinSetID)
        if (set.nextWinSetID && posMap.has(set.nextWinSetID)) {
          const endCenter = posMap.get(set.nextWinSetID)!;
          const p0 = new THREE.Vector3(
            startCenter.x + cardW / 2,
            startCenter.y + 0.12,
            startCenter.z
          );
          const p3 = new THREE.Vector3(
            endCenter.x - cardW / 2,
            endCenter.y + (set.nextWinSlot === 1 ? 0.28 : set.nextWinSlot === 2 ? -0.28 : 0),
            endCenter.z
          );
          const midX = (p0.x + p3.x) * 0.5;
          const p1 = new THREE.Vector3(midX, p0.y, p0.z);
          const p2 = new THREE.Vector3(midX, p3.y, p3.z);

          const curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3);

          // Tubo 3D luminoso para el conector de victoria
          const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.036, 8, false);
          const tubeMat = new THREE.MeshBasicMaterial({
            color: theme.num,
            transparent: true,
            opacity: set.status === 'COMPLETED' ? 0.92 : 0.55,
          });
          const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
          connectorsRoot.add(tubeMesh);

          // Esfera viajera de pulso de datos a lo largo de la curva 3D
          const pulseGeo = new THREE.SphereGeometry(0.085, 10, 10);
          const pulseMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
          const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
          connectorsRoot.add(pulseMesh);
          pulseTravelers.push({
            mesh: pulseMesh,
            curve,
            speed: 0.42,
            offset: Math.random(),
          });
        }

        // B. Conector 3D de Caída a Losers Bracket o Second Chance (nextLoseSetID)
        if (set.nextLoseSetID && posMap.has(set.nextLoseSetID)) {
          const endCenter = posMap.get(set.nextLoseSetID)!;
          const p0 = new THREE.Vector3(
            startCenter.x + cardW / 2 - 0.2,
            startCenter.y - 0.35,
            startCenter.z
          );
          const p3 = new THREE.Vector3(
            endCenter.x - cardW / 2,
            endCenter.y,
            endCenter.z
          );
          const midX = (p0.x + p3.x) * 0.5;
          const p1 = new THREE.Vector3(midX, p0.y - 0.6, (p0.z + p3.z) * 0.35);
          const p2 = new THREE.Vector3(midX, p3.y + 0.3, (p0.z + p3.z) * 0.75);

          const loseCurve = new THREE.CubicBezierCurve3(p0, p1, p2, p3);
          const loseTubeGeo = new THREE.TubeGeometry(loseCurve, 28, 0.024, 6, false);
          const loseTubeMat = new THREE.MeshBasicMaterial({
            color: 0xff0055,
            transparent: true,
            opacity: 0.48,
          });
          const loseTubeMesh = new THREE.Mesh(loseTubeGeo, loseTubeMat);
          connectorsRoot.add(loseTubeMesh);
        }
      }

      // Render inmediato para reflejar el cambio de torneo o set al instante
      renderer.render(scene, camera);
    };

    syncBracketTo3DRef.current(obf, selectedSetID);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downX = 0;
    let downY = 0;

    const handlePointerDown = (ev: MouseEvent) => {
      downX = ev.clientX;
      downY = ev.clientY;
    };

    const handlePointerUp = (ev: MouseEvent) => {
      const dist = Math.hypot(ev.clientX - downX, ev.clientY - downY);
      if (dist > 7) return; // Fue un arrastre de cámara, no un clic de selección
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(interactiveMeshes, false);
      if (hits.length > 0) {
        const hitSetID = hits[0].object.userData?.setID;
        if (hitSetID) {
          onSelectRef.current(hitSetID);
        }
      }
    };

    const handlePointerMove = (ev: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(interactiveMeshes, false);
      if (hits.length > 0) {
        const hitSetID = hits[0].object.userData?.setID || null;
        renderer.domElement.style.cursor = 'pointer';
        setHoveredSetID(hitSetID);
      } else {
        renderer.domElement.style.cursor = 'grab';
        setHoveredSetID(null);
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 1020;
      const h = container.clientHeight || 680;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const clock = new THREE.Clock();
    let frameId = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function tick() {
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      if (cameraTargetRef.current.transitioning) {
        const alpha = 1 - Math.exp(-5.5 * delta);
        camera.position.lerp(cameraTargetRef.current.pos, alpha);
        controls.target.lerp(cameraTargetRef.current.look, alpha);
        if (
          camera.position.distanceTo(cameraTargetRef.current.pos) < 0.08 &&
          controls.target.distanceTo(cameraTargetRef.current.look) < 0.08
        ) {
          cameraTargetRef.current.transitioning = false;
        }
      }

      controls.autoRotate = autoRotateRef.current;
      controls.autoRotateSpeed = 1.4;
      controls.update();

      for (const item of stationGroups) {
        item.group.position.y =
          item.baseY + Math.sin(elapsed * 1.8 + item.phaseOffset) * 0.06;
      }

      for (const p of pulseTravelers) {
        const t = (elapsed * p.speed + p.offset) % 1;
        p.curve.getPoint(t, p.mesh.position);
      }

      trophyGroup.visible = celebrationRef.current;
      if (celebrationRef.current) {
        trophyGroup.rotation.y = elapsed * 1.8;
        haloRing.rotation.x = elapsed * 2.2;
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      clearDynamicScene();
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  // Re-encuadrar automáticamente la cámara cuando cambia el torneo, formato o número de sets
  useEffect(() => {
    setActivePreset('global');
    const globalFrame = computeGlobalFraming(obf.sets);
    cameraTargetRef.current = {
      pos: globalFrame.pos,
      look: globalFrame.look,
      transitioning: true,
    };
  }, [obf.event.tournamentSlug, obf.event.format, obf.sets.length]);

  // Actualizar las tarjetas 3D y conectores cuando cambia el documento OBF o el set seleccionado
  useEffect(() => {
    syncBracketTo3DRef.current?.(obf, selectedSetID);
  }, [obf, selectedSetID]);

  return (
    <div className="rounded-2xl border border-[#1E293B] bg-[#040810] overflow-hidden shadow-2xl">
      {/* Cabecera Superior WebGL 3D Z-Space */}
      <div className="px-4 py-3 bg-[#070B14] border-b border-[#1E293B] flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold tracking-wider uppercase text-white">
              CANVAS WEBGL 3D (Z-SPACE DEPTH)
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-[#00F0FF]/15 border border-[#00F0FF]/40 text-[#00F0FF] text-xs font-mono font-semibold">
              {obf.event.name} • {obf.entrants.length}P • {obf.sets.length} Sets ({obf.event.format})
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-amber-300">
              Seleccionado: {selectedSetID}
            </span>
            {hoveredSetID && (
              <span className="text-xs font-mono text-[#00F0FF]">
                Apuntando: {hoveredSetID}
              </span>
            )}
          </div>
        </div>

        {/* Botonera de Presets Espaciales por Niveles (Arriba Winners, Abajo Losers R2, Más Abajo 3ra Ronda/2nd Chance, Derecha Semis/Finales) */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => applyCameraPreset('global')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors whitespace-nowrap shrink-0 ${
              activePreset === 'global'
                ? 'border-[#00F0FF] bg-[#00F0FF]/15 text-[#00F0FF]'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-[#00F0FF]/60'
            }`}
          >
            Vista Global Completa
          </button>

          <button
            type="button"
            onClick={() => applyCameraPreset('winners')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono border transition-colors whitespace-nowrap shrink-0 ${
              activePreset === 'winners'
                ? 'border-[#00F0FF] bg-slate-800 text-white font-semibold'
                : 'border-slate-700 bg-slate-900/90 text-slate-300 hover:text-white'
            }`}
          >
            Ganadores (Arriba)
          </button>

          <button
            type="button"
            onClick={() => applyCameraPreset('losers')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono border transition-colors whitespace-nowrap shrink-0 ${
              activePreset === 'losers'
                ? 'border-[#FF0055] bg-[#FF0055]/20 text-[#FF0055] font-semibold'
                : 'border-slate-700 bg-slate-900/90 text-[#FF6B9B] hover:border-[#FF0055]/60'
            }`}
          >
            Losers 2da Ronda (Abajo)
          </button>

          <button
            type="button"
            onClick={() => applyCameraPreset('second_chance')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono border transition-colors whitespace-nowrap shrink-0 ${
              activePreset === 'second_chance'
                ? 'border-[#10B981] bg-[#10B981]/20 text-[#10B981] font-semibold'
                : 'border-slate-700 bg-slate-900/90 text-emerald-400 hover:border-[#10B981]/60'
            }`}
          >
            3ra Ronda / 2nd Chance (Más Abajo)
          </button>

          <button
            type="button"
            onClick={() => applyCameraPreset('finals')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono border transition-colors whitespace-nowrap shrink-0 ${
              activePreset === 'finals'
                ? 'border-[#F59E0B] bg-[#F59E0B]/20 text-amber-300 font-semibold'
                : 'border-slate-700 bg-slate-900/90 text-amber-300 hover:border-[#F59E0B]/60'
            }`}
          >
            Semifinales y Finales (Derecha)
          </button>

          <button
            type="button"
            onClick={() => applyCameraPreset('stream')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activePreset === 'stream'
                ? 'border-[#8A2BE2] bg-[#8A2BE2]/25 text-purple-200'
                : 'border-[#8A2BE2]/60 bg-[#8A2BE2]/15 text-purple-300 hover:bg-[#8A2BE2]/25'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            Focus Stream Station
          </button>

          <button
            type="button"
            onClick={() => setAutoRotate((prev) => !prev)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono border transition-colors whitespace-nowrap shrink-0 ${
              autoRotate
                ? 'border-sky-400 bg-sky-500/20 text-sky-300 font-semibold'
                : 'border-slate-700 bg-slate-900/90 text-slate-300'
            }`}
          >
            Órbita Auto: {autoRotate ? 'ON' : 'OFF'}
          </button>

          <button
            type="button"
            onClick={() => setCelebrationActive((prev) => !prev)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              celebrationActive
                ? 'border-[#F59E0B] bg-[#F59E0B]/25 text-amber-300'
                : 'border-[#F59E0B]/60 bg-[#F59E0B]/10 text-amber-400 hover:bg-[#F59E0B]/20'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            Celebración 3D
          </button>
        </div>
      </div>

      {/* Lienzo WebGL 3D Principal ampliado para ver los 3 niveles verticales y las finales a la derecha */}
      <div className="relative w-full h-[680px]">
        <div ref={mountRef} className="w-full h-full" />

        {/* Tarjeta flotante inferior izquierda de Controles Espaciales Z-Space */}
        <div className="absolute bottom-4 left-4 z-10 pointer-events-none rounded-xl border border-slate-700/80 bg-[#070B14]/95 px-4 py-3 text-xs font-mono shadow-xl max-w-md">
          <div className="font-bold text-[#00F0FF] mb-1">
            Jerarquía Espacial Z-Space (Sin Solapamientos):
          </div>
          <div className="text-slate-300 leading-relaxed">
            • Arriba (Cian): Suiza R1/R2 y Winners • Medio-Abajo (Carmesí): Losers R1/R2
          </div>
          <div className="text-slate-300 leading-relaxed">
            • Fondo-Abajo (Esmeralda): 2nd Chance / R3 • Derecha: Semifinales y Grand Finals
          </div>
          <div className="text-slate-400 leading-relaxed mt-0.5">
            • Clic Izq en Rectángulo: Seleccionar Set • Clic Der + Arrastrar: Desplazar (Pan)
          </div>
        </div>
      </div>
    </div>
  );
};
