import { useCallback } from 'react'

export function useVisualFeedback() {
  const setHoverCursor = useCallback((isHovering: boolean) => {
    document.body.style.cursor = isHovering ? 'grab' : 'auto'
  }, [])

  const setDragCursor = useCallback((isDragging: boolean) => {
    document.body.style.cursor = isDragging ? 'grabbing' : 'auto'
  }, [])

  const getModelMaterial = useCallback((
    isCollisionWarning: boolean, 
    isDragging: boolean, 
    isHovering: boolean
  ) => {
    if (isCollisionWarning) {
      return { color: '#ff4444', opacity: 0.8 }
    }
    if (isDragging) {
      return { color: '#4CAF50', opacity: 0.9 }
    }
    if (isHovering) {
      return { color: '#2196F3', opacity: 0.9 }
    }
    return { color: 'white', opacity: 1 }
  }, [])

  return {
    setHoverCursor,
    setDragCursor,
    getModelMaterial
  }
}