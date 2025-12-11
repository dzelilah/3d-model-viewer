"use client";
import { Canvas } from "@react-three/fiber";
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
}: DraggableModelProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { scene: gltfScene } = useGLTF(modelPath);
  const [position, setPosition] =
    useState<[number, number, number]>(externalPosition);
  const {
    isCollisionWarning,
    checkCollisionAtPosition,
    updateCollisionWarning,
    resetCollisionWarning,
  } = useCollisionDetection(otherModelRef);
  const { setHoverCursor } = useVisualFeedback();
  const {
    meshRef,
    isDragging,
    handleModelPointerDown,
    handleModelPointerMove,
    handleModelPointerUp,
  } = useDragControls(
    orbitControlsRef,
    onPositionChange,
    updateCollisionWarning,
    checkCollisionAtPosition,
    resetCollisionWarning,
    position,
    setPosition,
    onDragStateChange
  );

  useEffect(() => {
    if (modelRef && meshRef.current) modelRef.current = meshRef.current;
  }, [modelRef, meshRef]);

  useEffect(() => {
    if (!meshRef.current) return;
    meshRef.current.position.set(...position);
    meshRef.current.rotation.set(0, (externalRotation / 100) * Math.PI * 2, 0);
  }, [position, externalRotation]);

  useEffect(() => setPosition(externalPosition), [externalPosition]);

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

  return (
    <>
      <group
        ref={meshRef}
        onPointerDown={handleModelPointerDown}
        onPointerMove={handleModelPointerMove}
        onPointerUp={handleModelPointerUp}
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
              color={isCollisionWarning ? "#ff4444" : "#44ff44"}
              transparent
              opacity={0.3}
            />
          </mesh>
        )}
      </group>
    </>
  );
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
}) {
  const orbitControlsRef = useRef<any>(null);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -5]} intensity={0.3} />

      <OrbitControls
        ref={orbitControlsRef}
        enablePan={viewMode === "3d"}
        enableRotate={viewMode === "3d"}
        enableZoom={true}
        target={[0, 0, 0]}
        maxPolarAngle={viewMode === "2d" ? 0 : Math.PI}
        minPolarAngle={viewMode === "2d" ? 0 : 0}
        enabled={!textboxDragging && selectedId === null}
      />

      <Environment preset="sunset" />

      <mesh
        rotation={viewMode === "2d" ? [0, 0, 0] : [-Math.PI / 2, 0, 0]}
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
        onDragStateChange={onModelDragChange}
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
        onDragStateChange={onModelDragChange}
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
                  const g = model1Ref.current;
                  const prevY = g.rotation.y;
                  g.rotation.y = (proposed / 100) * Math.PI * 2;
                  const intersects = checkGroupsIntersectXZ(
                    g,
                    model2Ref.current,
                    { margin: 0.8 }
                  );
                  g.rotation.y = prevY;
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
                  const g = model2Ref.current;
                  const prevY = g.rotation.y;
                  g.rotation.y = (proposed / 100) * Math.PI * 2;
                  const intersects = checkGroupsIntersectXZ(
                    g,
                    model1Ref.current,
                    { margin: 0.8 }
                  );
                  g.rotation.y = prevY;
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
