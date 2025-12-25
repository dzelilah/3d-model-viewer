"use client";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, useGLTF } from "@react-three/drei";
import { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useState, useRef, useEffect } from "react";
import { Group } from "three";
import * as THREE from "three";
import { useModelSync } from "../hooks/useModelSync";
import {
  useCollisionDetection,
  checkGroupsIntersectXZ,
} from "../hooks/useCollisionDetection";
import { useDragControls } from "../hooks/useDragControls";
import { useVisualFeedback } from "../hooks/useVisualFeedback";
import TextBox from "./TextBox";
import { useTextBoxes } from "../hooks/useTextBoxes";

interface DualModelViewerProps {
  viewMode: "3d" | "2d";
  pointerEvents?: string;
}

interface DraggableModelProps {
  modelPath: string;
  position: [number, number, number];
  rotation: number;
  modelName: string;
  orbitControlsRef: React.MutableRefObject<OrbitControlsImpl | null>;
  otherModelRef: React.MutableRefObject<Group | null>;
  modelRef: React.MutableRefObject<Group | null>;
  onPositionChange: (position: [number, number, number]) => void;
  onDragStateChange?: (dragging: boolean) => void;
  viewMode: "3d" | "2d";
  model1Dragging2D?: boolean;
  model2Dragging2D?: boolean;
}

function DraggableModel({
  modelPath,
  position: externalPosition,
  rotation: externalRotation,
  modelName,
  orbitControlsRef,
  otherModelRef,
  modelRef,
  onPositionChange,
  onDragStateChange,
  viewMode,
  model1Dragging2D,
  model2Dragging2D,
  }: DraggableModelProps) {
    // Flatten model in 2D mode (sticker effect), but only slightly for the table
    useEffect(() => {
      if (!meshRef.current) return;
      // Only scale Y, do not touch rotation
      if (viewMode === "2d") {
        if (modelName === "Table") {
          meshRef.current.scale.y = 0.12; // slightly flattened for table
        } else {
          meshRef.current.scale.y = 0.001; // full flatten for ottoman or others
        }
      } else {
        meshRef.current.scale.y = 1;
      }
    }, [viewMode, modelName]);
  const [isHovered, setIsHovered] = useState(false);
  const { scene: gltfScene } = useGLTF(modelPath);
  // Remove local position state; always use externalPosition and onPositionChange
  const {
    isCollisionWarning,
    checkCollisionAtPosition: baseCheckCollisionAtPosition,
    updateCollisionWarning,
    resetCollisionWarning,
  } = useCollisionDetection(otherModelRef);

  // Always provide a 3-argument version for useDragControls, with correct types
  // Set a global flag for 2d/3d mode so collision detection can use it
  if (typeof window !== 'undefined') {
    window.__DUAL_MODEL_VIEW_MODE = viewMode;
  }
  const checkCollisionAtPosition = (
    modelGroup: Group,
    newPosition: THREE.Vector3,
    margin?: number
  ): boolean => baseCheckCollisionAtPosition(modelGroup, newPosition, margin);
  const { setHoverCursor } = useVisualFeedback();
  // Local state for drag, but always render from Firestore except while dragging
  const [dragPosition, setDragPosition] = useState(externalPosition);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!dragging) setDragPosition(externalPosition);
  }, [externalPosition, dragging]);

  const {
    meshRef,
    isDragging,
    handleModelPointerDown,
    handleModelPointerMove,
    handleModelPointerUp,
  } = useDragControls(
    orbitControlsRef,
    (pos) => { setDragPosition(pos); }, // Only update local drag state
    updateCollisionWarning,
    checkCollisionAtPosition,
    resetCollisionWarning,
    dragging ? dragPosition : externalPosition,
    // On drop, sync to Firestore and stop using local drag state
    (pos) => { setDragPosition(pos); onPositionChange(pos); setDragging(false); },
    (d) => { setDragging(d); onDragStateChange?.(d); },
    viewMode
  );

  useEffect(() => {
    if (modelRef && meshRef.current) modelRef.current = meshRef.current;
  }, [modelRef, meshRef]);

  useEffect(() => {
    if (!meshRef.current) return;
    const pos = dragging ? dragPosition : externalPosition;
    meshRef.current.position.set(...pos);
    // Always apply rotation around Y axis for both 2D and 3D
    meshRef.current.rotation.set(0, (externalRotation / 100) * Math.PI * 2, 0);
    // Also apply rotation to the gltfScene primitive for 2D
    if (gltfScene) {
      gltfScene.rotation.set(0, (externalRotation / 100) * Math.PI * 2, 0);
    }
  }, [dragging, dragPosition, externalPosition, externalRotation, gltfScene]);

  // No local position state to sync

  useEffect(() => {
    if (!gltfScene || !meshRef.current) return;
    const box = new THREE.Box3().setFromObject(gltfScene);
    const center = box.getCenter(new THREE.Vector3());

    gltfScene.position.set(-center.x, 0, -center.z);
  }, [gltfScene]);

  const handlePointerEnter = () => {
    setIsHovered(true);
    setHoverCursor(true);
  };

  const handlePointerLeave = () => {
    setIsHovered(false);
    setHoverCursor(false);
  };

  // Conditionally disable pointer event handlers for non-draggable model in 2D
  const pointerHandlers =
    viewMode === "2d"
      ? modelName === "Table"
        ? (model2Dragging2D
            ? {
                onPointerDown: undefined,
                onPointerMove: undefined,
                onPointerUp: undefined,
              }
            : {
                onPointerDown: handleModelPointerDown,
                onPointerMove: handleModelPointerMove,
                onPointerUp: handleModelPointerUp,
              })
        : modelName === "Ottoman"
        ? (model1Dragging2D
            ? {
                onPointerDown: undefined,
                onPointerMove: undefined,
                onPointerUp: undefined,
              }
            : {
                onPointerDown: handleModelPointerDown,
                onPointerMove: handleModelPointerMove,
                onPointerUp: handleModelPointerUp,
              })
        : {
            onPointerDown: handleModelPointerDown,
            onPointerMove: handleModelPointerMove,
            onPointerUp: handleModelPointerUp,
          }
      : {
          onPointerDown: handleModelPointerDown,
          onPointerMove: handleModelPointerMove,
          onPointerUp: handleModelPointerUp,
        };

  return (
    <>
      <group
        ref={meshRef}
        {...pointerHandlers}
        onPointerEnter={() => {
          setIsHovered(true);
          setHoverCursor(true);
        }}
        onPointerLeave={() => {
          setIsHovered(false);
          setHoverCursor(false);
        }}
      >
        <mesh position={[0, 0, 0]} visible={false}>
          <boxGeometry args={[3, 3, 3]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>

        <primitive
          object={gltfScene}
          scale={[0.05, 0.05, 0.05]}
          onPointerDown={handleModelPointerDown}
          onPointerMove={handleModelPointerMove}
          onPointerUp={handleModelPointerUp}
        />

        {isDragging && (
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[2.0, 32]} />
            <meshBasicMaterial
              color="#44ff44"
              transparent
              opacity={0.3}
            />
          </mesh>
        )}
      </group>
    </>
  );
}

interface SceneContentProps {
  viewMode: "3d" | "2d";
  model1Position: [number, number, number];
  model1Rotation: number;
  model2Position: [number, number, number];
  model2Rotation: number;
  onModel1PositionChange: (position: [number, number, number]) => void;
  onModel2PositionChange: (position: [number, number, number]) => void;
  model1Ref: React.MutableRefObject<Group | null>;
  model2Ref: React.MutableRefObject<Group | null>;
  activeTool: "none" | "text-box";
  addBox: (position: [number, number, number]) => void;
  setActiveTool: (tool: "none" | "text-box") => void;
  textboxDragging: boolean;
  selectedId: string | null;
  onModelDragChange: (dragging: boolean) => void;
  model1Dragging2D: boolean;
  model2Dragging2D: boolean;
  setModel1Dragging2D: (dragging: boolean) => void;
  setModel2Dragging2D: (dragging: boolean) => void;
}

function SceneContent({
  viewMode,
  model1Position,
  model1Rotation,
  model2Position,
  model2Rotation,
  onModel1PositionChange,
  onModel2PositionChange,
  model1Ref,
  model2Ref,
  activeTool,
  addBox,
  setActiveTool,
  textboxDragging,
  selectedId,
  onModelDragChange,
  model1Dragging2D,
  model2Dragging2D,
  setModel1Dragging2D,
  setModel2Dragging2D,
}: SceneContentProps) {
  const orbitControlsRef = useRef<any>(null);
  const { camera } = useThree();
  // Store initial 3D camera state
  const initial3DCamera = useRef<{ position: THREE.Vector3; rotation: THREE.Euler; up: THREE.Vector3 } | null>(null);
  const prevViewMode = useRef(viewMode);

  useEffect(() => {
    // On first mount, store the initial 3D camera state
    if (!initial3DCamera.current && viewMode === "3d") {
      initial3DCamera.current = {
        position: camera.position.clone(),
        rotation: camera.rotation.clone(),
        up: camera.up.clone(),
      };
    }
  }, [camera, viewMode]);

  useEffect(() => {
    // When switching to 2d, set top-down camera
    if (viewMode === "2d") {
      camera.position.set(0, 20, 0);
      camera.rotation.set(-Math.PI / 2, 0, 0);
      camera.up.set(0, 0, -1);
      camera.updateProjectionMatrix();
    }
    // When switching to 3d, restore initial camera state
    if (viewMode === "3d" && prevViewMode.current === "2d" && initial3DCamera.current) {
      camera.position.copy(initial3DCamera.current.position);
      camera.rotation.copy(initial3DCamera.current.rotation);
      camera.up.copy(initial3DCamera.current.up);
      camera.updateProjectionMatrix();
      // Also reset OrbitControls if available
      if (orbitControlsRef.current) {
        orbitControlsRef.current.target.set(0, 0, 0);
        orbitControlsRef.current.update();
      }
    }
    prevViewMode.current = viewMode;
  }, [viewMode, camera]);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -5]} intensity={0.3} />

      <OrbitControls
        ref={orbitControlsRef}
        enableRotate={viewMode === "3d"}
        enablePan={false}
        enableZoom={true}
        screenSpacePanning={false}
        enableDamping={false}
        target={[0, 0, 0]}
        enabled={!textboxDragging && selectedId === null}
      />

      <Environment preset="sunset" />

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        onPointerDown={(e) => {
          if (activeTool !== "text-box") return;
          e.stopPropagation();
          const point = (e as any).point as THREE.Vector3;
          addBox([point.x, point.y, point.z]);
          setActiveTool("none");
        }}
      >
        <planeGeometry args={[15, 15]} />
        <meshStandardMaterial color="#333" transparent opacity={0.3} />
      </mesh>

      {viewMode === "2d" && (
        <gridHelper
          args={[15, 30, 0x444444, 0x444444]}
          position={[0, 0, 0]}
          rotation={[0, 0, 0]}
          key="fixed-2d-grid"
        />
      )}

      <DraggableModel
        modelPath="/models/hedra_bedside_table_grey_and_brass.glb"
        position={model1Position}
        rotation={model1Rotation}
        modelName="Table"
        orbitControlsRef={orbitControlsRef}
        otherModelRef={model2Ref}
        modelRef={model1Ref}
        onPositionChange={onModel1PositionChange}
        onDragStateChange={(dragging) => {
          onModelDragChange?.(dragging);
          if (viewMode === "2d") {
            setModel1Dragging2D(dragging);
            if (dragging) setModel2Dragging2D(false);
          }
        }}
        viewMode={viewMode}
        model1Dragging2D={model1Dragging2D}
        model2Dragging2D={model2Dragging2D}
      />

      <DraggableModel
        modelPath="/models/branagh_large_ottoman_pearl_grey.glb"
        position={model2Position}
        rotation={model2Rotation}
        modelName="Ottoman"
        orbitControlsRef={orbitControlsRef}
        otherModelRef={model1Ref}
        modelRef={model2Ref}
        onPositionChange={onModel2PositionChange}
        onDragStateChange={(dragging) => {
          onModelDragChange?.(dragging);
          if (viewMode === "2d") {
            setModel2Dragging2D(dragging);
            if (dragging) setModel1Dragging2D(false);
          }
        }}
        viewMode={viewMode}
        model1Dragging2D={model1Dragging2D}
        model2Dragging2D={model2Dragging2D}
      />
    </>
  );
}

export default function DualModelViewer({ viewMode }: DualModelViewerProps) {
  const {
    boxes,
    activeTool,
    setActiveTool,
    selectedId,
    setSelectedId,
    addBox,
    updateBox,
    removeBox,
  } = useTextBoxes("default");
  const model1 = useModelSync("model1", [-3, 0, 0], 0);
  const model2 = useModelSync("model2", [3, 0, 0], 0);
  const model1Ref = useRef<Group>(null);
  const model2Ref = useRef<Group>(null);
  const [textboxDragging, setTextboxDragging] = useState(false);
  const [modelDragging, setModelDragging] = useState(false);
  const [model1Dragging2D, setModel1Dragging2D] = useState(false);
  const [model2Dragging2D, setModel2Dragging2D] = useState(false);

  if (model1.isLoading || model2.isLoading) {
    return (
      <div
        style={{
          width: "100%",
          height: "600px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ color: "white", fontSize: "18px" }}>
          Loading models...
        </div>
      </div>
    );
  }

  if (model1.error || model2.error) {
    return (
      <div
        style={{
          width: "100%",
          height: "600px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ color: "red", fontSize: "18px" }}>
          Error loading models: {model1.error || model2.error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "600px", position: "relative" }}>
      <div
        style={{
          position: "absolute",
          top: 24,
          left: 24,
          zIndex: 10,
          minWidth: 260,
        }}
      >
        <button
          onClick={() =>
            setActiveTool(activeTool === "text-box" ? "none" : "text-box")
          }
          style={{
            width: "100%",
            padding: "12px 0",
            fontSize: "1.1rem",
            fontWeight: 600,
            background: activeTool === "text-box" ? "#222" : "#222",
            color: "#fff",
            border: "1px solid #444",
            borderRadius: 12,
            boxShadow: "0 2px 12px rgba(0,0,0,0.22)",
            letterSpacing: "0.02em",
            cursor: "pointer",
            marginBottom: 18,
            transition: "background 0.2s",
            outline: activeTool === "text-box" ? "2px solid #66aaff" : "none",
          }}
        >
          Text Box Tool
        </button>
      </div>
      <Canvas
        orthographic={viewMode === "2d"}
        camera={
          viewMode === "2d"
            ? {
                position: [0, 20, 0] as [number, number, number],
                up: [0, 0, -1] as [number, number, number],
                near: 0.1,
                far: 1000,
                zoom: 60,
              }
            : {
                position: [0, 4, 12] as [number, number, number],
                fov: 60,
                zoom: 1,
              }
        }
        style={{ width: "100%", height: "100%" }}
        onPointerDown={(e) => {
          if (activeTool !== "text-box") return;
          const ndc = {
            x: (e.clientX / (e.target as HTMLElement).clientWidth) * 2 - 1,
            y: -(e.clientY / (e.target as HTMLElement).clientHeight) * 2 + 1,
          };
          const point = (e as any).point as THREE.Vector3 | undefined;
          const pos: [number, number, number] = point
            ? [point.x, Math.max(point.y, 0.01), point.z]
            : [0, 0.01, 0];
          addBox(pos);
          setActiveTool("none");
        }}
      >
        <SceneContent
          viewMode={viewMode}
          model1Position={model1.position}
          model1Rotation={model1.rotation}
          model2Position={model2.position}
          model2Rotation={model2.rotation}
          onModel1PositionChange={model1.setSyncedPosition}
          onModel2PositionChange={model2.setSyncedPosition}
          model1Ref={model1Ref}
          model2Ref={model2Ref}
          activeTool={activeTool}
          addBox={addBox}
          setActiveTool={setActiveTool}
          textboxDragging={textboxDragging}
          selectedId={selectedId}
          onModelDragChange={setModelDragging}
          model1Dragging2D={model1Dragging2D}
          model2Dragging2D={model2Dragging2D}
          setModel1Dragging2D={setModel1Dragging2D}
          setModel2Dragging2D={setModel2Dragging2D}
        />
        {boxes.map((b) => (
          <TextBox
            key={b.id}
            box={b}
            selected={selectedId === b.id}
            onSelect={setSelectedId}
            onChange={updateBox}
            onRemove={removeBox}
            onDone={() => setSelectedId(null)}
            onDragStart={() => setTextboxDragging(true)}
            onDragEnd={() => setTextboxDragging(false)}
            modelDragging={modelDragging}
          />
        ))}
      </Canvas>

      <div className="dual-rotation-controls">
        <h3>Model Rotation Controls</h3>

        <div className="dual-model-control">
          <label>Bedside Table</label>
          <div className="dual-slider-container">
            <input
              type="range"
              min="0"
              max="100"
              value={model1.rotation}
              onChange={(e) => {
                const proposed = Number(e.target.value);
                if (model1Ref.current && model2Ref.current) {
                  // In 2D, block rotation if it would cause intersection, using the same margin as drag
                  const g = model1Ref.current;
                  const prevY = g.rotation.y;
                  g.rotation.y = (proposed / 100) * Math.PI * 2;
                  g.updateMatrixWorld(true); // Ensure collision uses updated rotation
                  const margin = viewMode === "2d" ? 1.2 : 1.2;
                  const band = viewMode === "2d" ? 0.001 : undefined;
                  if (viewMode === "2d") {
                    console.log('2D Rotation Debug', {
                      margin,
                      band,
                      g1: g,
                      g2: model2Ref.current,
                      rot: proposed
                    });
                  }
                  const intersects = checkGroupsIntersectXZ(
                    g,
                    model2Ref.current,
                    { margin, band }
                  );
                  g.rotation.y = prevY;
                  g.updateMatrixWorld(true);
                  if (!intersects) {
                    model1.setSyncedRotation(proposed);
                  }
                } else {
                  model1.setSyncedRotation(proposed);
                }
              }}
              className="dual-rotation-slider"
            />
          </div>
        </div>

        <div className="dual-model-control">
          <label>Ottoman (Pearl Grey)</label>
          <div className="dual-slider-container">
            <input
              type="range"
              min="0"
              max="100"
              value={model2.rotation}
              onChange={(e) => {
                const proposed = Number(e.target.value);
                if (model2Ref.current && model1Ref.current) {
                  // In 2D, block rotation if it would cause intersection, using the same margin as drag
                  const g = model2Ref.current;
                  const prevY = g.rotation.y;
                  g.rotation.y = (proposed / 100) * Math.PI * 2;
                  g.updateMatrixWorld(true); // Ensure collision uses updated rotation
                  const margin = viewMode === "2d" ? 1.2 : 1.2;
                  const band = viewMode === "2d" ? 0.001 : undefined;
                  if (viewMode === "2d") {
                    console.log('2D Rotation Debug', {
                      margin,
                      band,
                      g1: g,
                      g2: model1Ref.current,
                      rot: proposed
                    });
                  }
                  const intersects = checkGroupsIntersectXZ(
                    g,
                    model1Ref.current,
                    { margin, band }
                  );
                  g.rotation.y = prevY;
                  g.updateMatrixWorld(true);
                  if (!intersects) {
                    model2.setSyncedRotation(proposed);
                  }
                } else {
                  model2.setSyncedRotation(proposed);
                }
              }}
              className="dual-rotation-slider"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
