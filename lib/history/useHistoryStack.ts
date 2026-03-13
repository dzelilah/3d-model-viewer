"use client";

import { useState, useCallback, useRef } from "react";
import type { SceneSnapshot } from "./types";

const MAX_HISTORY = 100;

export function useHistoryStack() {
  const pastRef = useRef<SceneSnapshot[]>([]);
  const futureRef = useRef<SceneSnapshot[]>([]);
  const [, setVersion] = useState(0);
  const tick = useCallback(() => setVersion((v) => v + 1), []);

  const push = useCallback((snapshot: SceneSnapshot) => {
    pastRef.current = [...pastRef.current, snapshot].slice(-MAX_HISTORY);
    futureRef.current = [];
    tick();
  }, [tick]);

  /** Pop previous state from past; push current state to future. Returns state to restore. */
  const undo = useCallback((current: SceneSnapshot): SceneSnapshot | null => {
    if (pastRef.current.length === 0) return null;
    const result = pastRef.current.pop()!;
    futureRef.current = [...futureRef.current, current];
    tick();
    return result;
  }, [tick]);

  /** Pop next state from future; push current state to past. Returns state to restore. */
  const redo = useCallback((current: SceneSnapshot): SceneSnapshot | null => {
    if (futureRef.current.length === 0) return null;
    const result = futureRef.current.pop()!;
    pastRef.current = [...pastRef.current, current];
    tick();
    return result;
  }, [tick]);

  const clearFuture = useCallback(() => {
    futureRef.current = [];
    tick();
  }, [tick]);

  return {
    push,
    undo,
    redo,
    clearFuture,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    pastLength: pastRef.current.length,
    futureLength: futureRef.current.length,
  };
}
