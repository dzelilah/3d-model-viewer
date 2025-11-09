import { useState, useCallback } from 'react'
import { Vector3, Group, Object3DEventMap } from 'three'

export function useCollisionDetection(otherModelRef: React.MutableRefObject<Group<Object3DEventMap> | null>) {
  const [isCollisionWarning, setIsCollisionWarning] = useState(false)

  const checkCollision = useCallback((position: Vector3): boolean => {
    if (!otherModelRef.current) return false
    
    const distance = position.distanceTo(otherModelRef.current.position)
    const circleRadius = 2.0
    const minDistance = (circleRadius * 2) + 0.2
    
    return distance < minDistance
  }, [otherModelRef])

  const updateCollisionWarning = useCallback((position: Vector3) => {
    setIsCollisionWarning(checkCollision(position))
  }, [checkCollision])

  const resetCollisionWarning = useCallback(() => setIsCollisionWarning(false), [])

  return {
    isCollisionWarning,
    checkCollision,
    updateCollisionWarning,
    resetCollisionWarning
  }
}