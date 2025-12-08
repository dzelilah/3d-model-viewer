import { useState, useRef, useCallback } from 'react'
import { useThree, ThreeEvent } from '@react-three/fiber'
import { Group, Vector2, Vector3, Plane } from 'three'
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

export function useDragControls(
  orbitControlsRef: React.MutableRefObject<OrbitControlsImpl | null>,
  onPositionChange: (position: [number, number, number]) => void,
  updateCollisionWarning: (modelGroup: Group, position: Vector3) => void,
  checkCollisionAtPosition: (modelGroup: Group, newPosition: Vector3) => boolean,
  resetCollisionWarning: () => void,
  position: [number, number, number],
  setPosition: (position: [number, number, number]) => void,
  onDragStateChange?: (dragging: boolean) => void
) {
  const meshRef = useRef<Group>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [originalPosition, setOriginalPosition] = useState<[number, number, number]>(position)
  const { camera, raycaster, gl } = useThree()
  const downInfoRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const movedEnoughRef = useRef<boolean>(false)

  const startDrag = useCallback((startClient: { x: number; y: number }) => {
    setIsDragging(true)
    onDragStateChange?.(true)
    setOriginalPosition(position)
    gl.domElement.style.cursor = 'grabbing'
    
    // Disable all camera interactions during drag
    if (orbitControlsRef.current) {
      const oc = orbitControlsRef.current
      oc.enabled = false
      // Also disable specific interactions to be safe
      ;(oc as any)._prevRotate = oc.enableRotate
      ;(oc as any)._prevZoom = oc.enableZoom
      ;(oc as any)._prevPan = oc.enablePan
      oc.enableRotate = false
      oc.enableZoom = false
      oc.enablePan = false
    }

    // Track initial mouse to gate accidental drags when orbiting
    const startX = startClient.x
    const startY = startClient.y
    const dragThreshold = 3 // pixels

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Only engage drag logic after small movement threshold
      const moved = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) >= dragThreshold
      if (!moved) return
      const rect = gl.domElement.getBoundingClientRect()
      const mouse = new Vector2(
        ((moveEvent.clientX - rect.left) / rect.width) * 2 - 1,
        -((moveEvent.clientY - rect.top) / rect.height) * 2 + 1
      )
      
      raycaster.setFromCamera(mouse, camera)
      const groundPlane = new Plane(new Vector3(0, 1, 0), 0)
      const intersection = new Vector3()
      
      if (raycaster.ray.intersectPlane(groundPlane, intersection) && meshRef.current) {
        meshRef.current.position.set(intersection.x, 0, intersection.z)
        // Check collision during drag with the model group
        const modelPosition = new Vector3(intersection.x, 0, intersection.z)
        updateCollisionWarning(meshRef.current, modelPosition)
      }
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    
    const cleanup = () => document.removeEventListener('mousemove', handleMouseMove)
    ;(gl.domElement as HTMLCanvasElement & { _cleanupDrag?: () => void })._cleanupDrag = cleanup
  }, [orbitControlsRef, gl, camera, raycaster, updateCollisionWarning, position, onDragStateChange])

  const finishDrag = useCallback(() => {
    setIsDragging(false)
    onDragStateChange?.(false)
    gl.domElement.style.cursor = 'auto'
    
    // Re-enable camera interactions after drag
    if (orbitControlsRef.current) {
      const oc = orbitControlsRef.current
      oc.enabled = true
      oc.enableRotate = (oc as any)._prevRotate ?? true
      oc.enableZoom = (oc as any)._prevZoom ?? true
      oc.enablePan = (oc as any)._prevPan ?? true
      delete (oc as any)._prevRotate
      delete (oc as any)._prevZoom
      delete (oc as any)._prevPan
    }
    
    // Check for collision at the final position
    if (meshRef.current) {
      const finalPosition = new Vector3(
        meshRef.current.position.x,
        meshRef.current.position.y,
        meshRef.current.position.z
      )
      
      const hasCollision = checkCollisionAtPosition(meshRef.current, finalPosition)
      
      if (hasCollision) {
        // Collision detected - snap back to original position
        meshRef.current.position.set(...originalPosition)
        setPosition(originalPosition)
      } else {
        // No collision - commit the new position
        const newPosition: [number, number, number] = [
          meshRef.current.position.x,
          meshRef.current.position.y,
          meshRef.current.position.z
        ]
        setPosition(newPosition)
        onPositionChange(newPosition)
      }
    }
    
    // Reset collision warning after checking
    resetCollisionWarning()
    
    const element = gl.domElement as HTMLCanvasElement & { _cleanupDrag?: () => void }
    if (element._cleanupDrag) {
      element._cleanupDrag()
      delete element._cleanupDrag
    }
  }, [checkCollisionAtPosition, resetCollisionWarning, orbitControlsRef, gl, onPositionChange, setPosition, originalPosition, onDragStateChange])

  const handleModelPointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return
    if (!meshRef.current) return
    event.stopPropagation()
    downInfoRef.current = { x: event.clientX, y: event.clientY, t: performance.now() }
    movedEnoughRef.current = false
  }, [])

  const handleModelPointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (!downInfoRef.current) return
    const dx = event.clientX - downInfoRef.current.x
    const dy = event.clientY - downInfoRef.current.y
    if (Math.hypot(dx, dy) >= 4) movedEnoughRef.current = true
  }, [])

  const handleModelPointerUp = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (!downInfoRef.current) return
    event.stopPropagation()
    const info = downInfoRef.current
    downInfoRef.current = null
    const duration = performance.now() - info.t
    const isClick = !movedEnoughRef.current && duration < 300
    movedEnoughRef.current = false
    if (!isClick) return

    // Toggle pick/drop only on true click
    if (isDragging) {
      finishDrag()
    } else {
      startDrag({ x: event.clientX, y: event.clientY })
    }
  }, [isDragging, startDrag, finishDrag])

  return { meshRef, isDragging, handleModelPointerDown, handleModelPointerMove, handleModelPointerUp }
}