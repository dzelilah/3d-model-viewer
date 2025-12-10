import { useEffect, useState } from "react";
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";

export interface TextBoxData {
  id: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  text: string;
  textColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
}

export function useTextBoxes(sceneId: string) {
  const [boxes, setBoxes] = useState<TextBoxData[]>([]);
  const [activeTool, setActiveTool] = useState<"none" | "text-box">("none");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const colRef = collection(db, "scenes", sceneId, "textBoxes");
    const unsub = onSnapshot(colRef, (snap) => {
      const list: TextBoxData[] = [];
      snap.forEach((d) => list.push(d.data() as TextBoxData));
      setBoxes(list);
    });
    return () => unsub();
  }, [sceneId]);

  const addBox = async (position: [number, number, number]) => {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    const box: TextBoxData = {
      id,
      position,
      text: "New Text",
      textColor: "#ffffff",
      backgroundColor: "#000000",
      backgroundOpacity: 0.5,
    };
    setBoxes((prev) => [...prev, box]);
    await setDoc(doc(db, "scenes", sceneId, "textBoxes", id), box);
    setSelectedId(id);
  };

  const updateBox = async (id: string, patch: Partial<TextBoxData>) => {
    setBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    const existing = boxes.find((b) => b.id === id);
    const merged = { ...(existing as TextBoxData), ...patch };
    await setDoc(doc(db, "scenes", sceneId, "textBoxes", id), merged);
  };

  const removeBox = async (id: string) => {
    setBoxes((prev) => prev.filter((b) => b.id !== id));
    await deleteDoc(doc(db, "scenes", sceneId, "textBoxes", id));
    if (selectedId === id) setSelectedId(null);
  };

  return {
    boxes,
    activeTool,
    setActiveTool,
    selectedId,
    setSelectedId,
    addBox,
    updateBox,
    removeBox,
  };
}
