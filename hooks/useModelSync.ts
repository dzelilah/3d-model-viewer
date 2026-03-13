import { useState, useEffect, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

type Position = [number, number, number];

interface ModelData {
  position: { x: number; y: number; z: number };
  rotation: number;
  updatedAt: number;
}

export function useModelSync(
  modelId: string,
  defaultPosition: Position = [0, 0, 0],
  defaultRotation: number = 0
) {
  const [position, setPosition] = useState<Position>(defaultPosition);
  const [rotation, setRotation] = useState<number>(defaultRotation);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log(`Firebase: Loading data for ${modelId}`);
        setIsLoading(true);
        setError(null);

        const docRef = doc(db, "models", modelId);
        const snapshot = await getDoc(docRef);

        if (snapshot.exists()) {
          const data = snapshot.data() as ModelData;
          console.log(`Firebase: Data found for ${modelId}:`, data);

          if (data.position) {
            setPosition([data.position.x, data.position.y, data.position.z]);
          }

          if (typeof data.rotation === "number") {
            setRotation(data.rotation);
          }
        } else {
          console.log(
            `Firebase: No data found for ${modelId}, using defaults`
          );
        }
      } catch (err) {
        console.error(`Firebase Error for ${modelId}:`, err);
        setError(`Failed to load model ${modelId}`);
      } finally {
        setIsLoading(false);
        console.log(`Firebase: Finished loading ${modelId}`);
      }
    };

    loadData();
  }, [modelId]);

  const updateFirestore = useCallback(
    async (newPosition: Position, newRotation: number) => {
      try {
        await setDoc(doc(db, "models", modelId), {
          position: {
            x: newPosition[0],
            y: newPosition[1],
            z: newPosition[2],
          },
          rotation: newRotation,
          updatedAt: Date.now(),
        });
      } catch (err) {
        console.error(`Error saving model ${modelId}:`, err);
        setError(`Failed to save model ${modelId}`);
      }
    },
    [modelId]
  );

  const setSyncedPosition = useCallback(
    async (newPos: Position) => {
      setPosition(newPos);
      await updateFirestore(newPos, rotation);
    },
    [updateFirestore, rotation]
  );

  const setSyncedRotation = useCallback(
    async (newRot: number) => {
      setRotation(newRot);
      await updateFirestore(position, newRot);
    },
    [updateFirestore, position]
  );

  /** Set position and rotation in one update (e.g. for undo/redo). */
  const setSyncedState = useCallback(
    async (newPos: Position, newRot: number) => {
      setPosition(newPos);
      setRotation(newRot);
      await updateFirestore(newPos, newRot);
    },
    [updateFirestore]
  );

  return {
    position,
    rotation,
    isLoading,
    error,
    setSyncedPosition,
    setSyncedRotation,
    setSyncedState,
  };
}
