import type { TextBoxData } from "../../hooks/useTextBoxes";

export interface ModelState {
  position: [number, number, number];
  rotation: number;
}

/** Full scene snapshot for undo/redo. Must be JSON-serializable. */
export interface SceneSnapshot {
  boxes: TextBoxData[];
  selectedId: string | null;
  model1: ModelState;
  model2: ModelState;
}
