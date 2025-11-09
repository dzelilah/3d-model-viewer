import { useState, useRef, useCallback } from 'react'
import { useThree, ThreeEvent } from '@react-three/fiber'
import { Group, Vector2, Vector3, Plane } from 'three'
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

export function useDragControls(
  orbitControlsRef: React.MutableRefObject<OrbitControlsImpl | null>,
  onPositionChange: (position: [number, number, number]) => void,
  updateCollisionWarning: (position: Vector3) => void,
  isCollisionWarning: boolean,
  resetCollisionWarning: () => void,
  position: [number, number, number],
  setPosition: (position: [number, number, number]) => void
) {
  const meshRef = useRef<Group>(null)
  const [isDragging, setIsDragging] = useState(false)
  const { camera, raycaster, gl } = useThree()

  const startDrag = useCallback(() => {
    setIsDragging(true)
    gl.domElement.style.cursor = 'grabbing'
    
    if (orbitControlsRef.current) orbitControlsRef.current.enabled = false

    const handleMouseMove = (moveEvent: MouseEvent) => {
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
        // Prosledi trenutnu poziciju modela za collision detection
        const modelPosition = new Vector3(intersection.x, 0, intersection.z)
        updateCollisionWarning(modelPosition)
      }
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    
    const cleanup = () => document.removeEventListener('mousemove', handleMouseMove)
    ;(gl.domElement as HTMLCanvasElement & { _cleanupDrag?: () => void })._cleanupDrag = cleanup
  }, [orbitControlsRef, gl, camera, raycaster, updateCollisionWarning])

  const finishDrag = useCallback(() => {
    setIsDragging(false)
    gl.domElement.style.cursor = 'auto'
    
    if (orbitControlsRef.current) orbitControlsRef.current.enabled = true
    
    // Sprečavanje pozicioniranja ako postoji kolizija
    if (meshRef.current && !isCollisionWarning) {
      const newPosition: [number, number, number] = [
        meshRef.current.position.x,
        meshRef.current.position.y,
        meshRef.current.position.z
      ]
      setPosition(newPosition)
      onPositionChange(newPosition)
    }
    
    // Reset collision warning tek posle proveravanja
    resetCollisionWarning()
    
    const element = gl.domElement as HTMLCanvasElement & { _cleanupDrag?: () => void }
    if (element._cleanupDrag) {
      element._cleanupDrag()
      delete element._cleanupDrag
    }
  }, [isCollisionWarning, resetCollisionWarning, orbitControlsRef, gl, onPositionChange, setPosition])

  const handleModelClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    isDragging ? finishDrag() : startDrag()
  }, [isDragging, startDrag, finishDrag])

  return { meshRef, isDragging, handleModelClick }
}