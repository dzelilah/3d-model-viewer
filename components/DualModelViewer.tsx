'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, useGLTF } from '@react-three/drei'
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useState, useRef, useEffect } from 'react'
import { Group } from 'three'
import * as THREE from 'three'
import { useModelSync } from '../hooks/useModelSync'
import { useCollisionDetection } from '../hooks/useCollisionDetection'
import { useDragControls } from '../hooks/useDragControls'
import { useVisualFeedback } from '../hooks/useVisualFeedback'

interface DualModelViewerProps {
  viewMode: '3d' | '2d'
}

interface DraggableModelProps {
  modelPath: string
  position: [number, number, number]
  rotation: number
  modelName: string
  orbitControlsRef: React.MutableRefObject<OrbitControlsImpl | null>
  otherModelRef: React.MutableRefObject<Group | null>
  modelRef: React.MutableRefObject<Group | null>
  onPositionChange: (position: [number, number, number]) => void
}

function DraggableModel({ 
  modelPath, 
  position: externalPosition,
  rotation: externalRotation,
  orbitControlsRef,
  otherModelRef,
  modelRef,
  onPositionChange
}: DraggableModelProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [position, setPosition] = useState<[number, number, number]>(externalPosition)
  const { scene: gltfScene } = useGLTF(modelPath)

  const { updateCollisionWarning, resetCollisionWarning, isCollisionWarning } = useCollisionDetection(otherModelRef)
  const { setHoverCursor } = useVisualFeedback()
  const { meshRef, isDragging, handleModelClick } = useDragControls(
    orbitControlsRef,
    onPositionChange,
    updateCollisionWarning,
    isCollisionWarning,
    resetCollisionWarning,
    position,
    setPosition
  )

  useEffect(() => {
    if (modelRef && meshRef.current) modelRef.current = meshRef.current
  }, [modelRef, meshRef])

  useEffect(() => {
    if (!meshRef.current) return
    meshRef.current.position.set(...position)
    meshRef.current.rotation.set(0, (externalRotation / 100) * Math.PI * 2, 0)
  }, [position, externalRotation])

  // Sync with external position changes
  useEffect(() => setPosition(externalPosition), [externalPosition])

  useEffect(() => {
    if (!gltfScene || !meshRef.current) return
    const box = new THREE.Box3().setFromObject(gltfScene)
    const center = box.getCenter(new THREE.Vector3())
    
    gltfScene.position.set(-center.x, -box.min.y, -center.z)
  }, [gltfScene])

  const handlePointerEnter = () => {
    setIsHovered(true)
    setHoverCursor(true)
  }

  const handlePointerLeave = () => {
    setIsHovered(false)
    setHoverCursor(false)
  }

  return (
    <>
      <group
        ref={meshRef}
        onClick={handleModelClick}
        onPointerEnter={() => {
          setIsHovered(true)
          setHoverCursor(true)
        }}
        onPointerLeave={() => {
          setIsHovered(false)
          setHoverCursor(false)
        }}
      >
        <mesh position={[0, 0, 0]} visible={false}>
          <boxGeometry args={[3, 3, 3]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
        
        <primitive 
          object={gltfScene} 
          scale={[0.2, 0.2, 0.2]}
          onClick={handleModelClick}
        />
        
        {isDragging && (
          <>
            <mesh position={[0, -0.45, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[2.0, 32]} />
              <meshBasicMaterial 
                color={isCollisionWarning ? "#ff4444" : "#44ff44"}
                transparent 
                opacity={0.3} 
              />
            </mesh>
            
            <mesh position={[0, -0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.3, 16]} />
              <meshBasicMaterial 
                color={isCollisionWarning ? "#ff0000" : "#00ff00"}
                transparent 
                opacity={0.7} 
              />
            </mesh>
            
            <mesh position={[0, -0.44, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[1.6, 2.0, 32]} />
              <meshBasicMaterial 
                color={isCollisionWarning ? "#ff4444" : "#44ff44"}
                transparent 
                opacity={0.8} 
              />
            </mesh>
          </>
        )}
        
        {isHovered && !isDragging && (
          <mesh position={[0, -0.45, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.4, 1.6, 32]} />
            <meshBasicMaterial 
              color="#4f7df3" 
              transparent 
              opacity={0.6} 
            />
          </mesh>
        )}
      </group>
    </>
  )
}

function SceneContent({ 
  viewMode, 
  model1Position,
  model1Rotation,
  model2Position,
  model2Rotation,
  onModel1PositionChange,
  onModel2PositionChange
}: { 
  viewMode: '3d' | '2d'
  model1Position: [number, number, number]
  model1Rotation: number
  model2Position: [number, number, number]  
  model2Rotation: number
  onModel1PositionChange: (position: [number, number, number]) => void
  onModel2PositionChange: (position: [number, number, number]) => void
}) {
  const orbitControlsRef = useRef<any>(null)
  const model1Ref = useRef<Group>(null)
  const model2Ref = useRef<Group>(null)

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -5]} intensity={0.3} />
      
      <OrbitControls 
        ref={orbitControlsRef}
        enablePan={viewMode === '3d'} 
        enableRotate={viewMode === '3d'}
        enableZoom={true}
        target={[0, 0, 0]}
        maxPolarAngle={viewMode === '2d' ? 0 : Math.PI}
        minPolarAngle={viewMode === '2d' ? 0 : 0}
      />
      
      <Environment preset="sunset" />
      
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#333" transparent opacity={0.3} />
      </mesh>
      
      {/* Grid for 2D view */}
      {viewMode === '2d' && (
        <gridHelper args={[10, 20, 0x444444, 0x444444]} position={[0, -0.99, 0]} />
      )}
      
      <DraggableModel
        modelPath="/models/bust_of_a_rhetorician.glb"
        position={model1Position}
        rotation={model1Rotation}
        modelName="Bust of Rhetorician"
        orbitControlsRef={orbitControlsRef}
        otherModelRef={model2Ref}
        modelRef={model1Ref}
        onPositionChange={onModel1PositionChange}
      />
      
      <DraggableModel
        modelPath="/models/lion_crushing_a_serpent.glb"
        position={model2Position}
        rotation={model2Rotation}
        modelName="Lion Crushing Serpent"
        orbitControlsRef={orbitControlsRef}
        otherModelRef={model1Ref}
        modelRef={model2Ref}
        onPositionChange={onModel2PositionChange}
      />
    </>
  )
}

export default function DualModelViewer({ viewMode }: DualModelViewerProps) {
  const model1 = useModelSync('model1', [-3, 0, 0], 0)
  const model2 = useModelSync('model2', [3, 0, 0], 0)

  if (model1.isLoading || model2.isLoading) {
    return (
      <div style={{ width: '100%', height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'white', fontSize: '18px' }}>Loading models...</div>
      </div>
    )
  }

  if (model1.error || model2.error) {
    return (
      <div style={{ width: '100%', height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'red', fontSize: '18px' }}>
          Error loading models: {model1.error || model2.error}
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '600px', position: 'relative' }}>
      <Canvas
        orthographic={viewMode === '2d'}
        camera={{
          ...(viewMode === '2d' 
            ? {
                position: [0, 10, 0] as [number, number, number],
                rotation: [-Math.PI / 2, 0, 0] as [number, number, number],
                fov: 50,
                near: 0.1,
                far: 1000,
                zoom: 100
              }
            : {
                position: [0, 4, 12] as [number, number, number], 
                fov: 60,
                zoom: 1
              }
          )
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <SceneContent 
          viewMode={viewMode} 
          model1Position={model1.position}
          model1Rotation={model1.rotation}
          model2Position={model2.position}
          model2Rotation={model2.rotation}
          onModel1PositionChange={model1.setSyncedPosition}
          onModel2PositionChange={model2.setSyncedPosition}
        />
      </Canvas>
      
      <div className="dual-rotation-controls">
        <h3>Model Rotation Controls</h3>
        
        <div className="dual-model-control">
          <label>Bust of Rhetorician</label>
          <div className="dual-slider-container">
            <input
              type="range"
              min="0"
              max="100"
              value={model1.rotation}
              onChange={(e) => model1.setSyncedRotation(Number(e.target.value))}
              className="dual-rotation-slider"
            />
          </div>
        </div>
        
        <div className="dual-model-control">
          <label>Lion Crushing Serpent</label>
          <div className="dual-slider-container">
            <input
              type="range"
              min="0"
              max="100"
              value={model2.rotation}
              onChange={(e) => model2.setSyncedRotation(Number(e.target.value))}
              className="dual-rotation-slider"
            />
          </div>
        </div>
      </div>
    </div>
  )
}