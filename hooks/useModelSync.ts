import { useState, useEffect, useCallback } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

type Position = [number, number, number]

interface ModelData {
  position: { x: number; y: number; z: number }
  rotation: number
  updatedAt: number
}

export function useModelSync(
  modelId: string, 
  defaultPosition: Position = [0, 0, 0], 
  defaultRotation: number = 0
) {
  const [position, setPosition] = useState<Position>(defaultPosition)
  const [rotation, setRotation] = useState<number>(defaultRotation)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const docRef = doc(db, 'models', modelId)
        const snapshot = await getDoc(docRef)
        
        if (snapshot.exists()) {
          const data = snapshot.data() as ModelData
          
          if (data.position) {
            setPosition([data.position.x, data.position.y, data.position.z])
          }
          
          if (typeof data.rotation === 'number') {
            setRotation(data.rotation)
          }
        }
      } catch (err) {
        console.error(`Error loading model ${modelId}:`, err)
        setError(`Failed to load model ${modelId}`)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [modelId])

  const updateFirestore = useCallback(async (newPosition: Position, newRotation: number) => {
    try {
      await setDoc(doc(db, 'models', modelId), {
        position: { 
          x: newPosition[0], 
          y: newPosition[1], 
          z: newPosition[2] 
        },
        rotation: newRotation,
        updatedAt: Date.now(),
      })
    } catch (err) {
      console.error(`Error saving model ${modelId}:`, err)
      setError(`Failed to save model ${modelId}`)
    }
  }, [modelId])

  const setSyncedPosition = useCallback(async (newPos: Position) => {
    setPosition(newPos)
    await updateFirestore(newPos, rotation)
  }, [updateFirestore, rotation])

  const setSyncedRotation = useCallback(async (newRot: number) => {
    setRotation(newRot)
    await updateFirestore(position, newRot)
  }, [updateFirestore, position])

  return {
    position,
    rotation,
    isLoading,
    error,
    setSyncedPosition,
    setSyncedRotation,
  }
}