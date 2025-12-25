import { useState, useCallback, useRef } from "react";
import {
  Vector3,
  Group,
  Object3DEventMap,
  Box3,
  Mesh,
  BufferGeometry,
  Matrix4,
} from "three";

export function useCollisionDetection(
  otherModelRef: React.MutableRefObject<Group<Object3DEventMap> | null>
) {
  const [isCollisionWarning, setIsCollisionWarning] = useState(false);
  const otherHalfExtentsRef = useRef<{ hx: number; hz: number } | null>(null);
  const selfHalfExtentsRef = useRef<{ hx: number; hz: number } | null>(null);
  const otherCenterOffsetRef = useRef<{ cx: number; cz: number } | null>(null);
  const selfCenterOffsetRef = useRef<{ cx: number; cz: number } | null>(null);

  const computeXZFootprintHalfExtents = useCallback(
    (root: Group): { hx: number; hz: number } => {
      const worldMatrix = new Matrix4();
      let minX = Infinity,
        maxX = -Infinity;
      let minZ = Infinity,
        maxZ = -Infinity;

      root.updateWorldMatrix(true, true);

      root.traverse((obj) => {
        const mesh = obj as Mesh;
        if (!mesh || !(mesh.geometry instanceof BufferGeometry)) return;
        const geom = mesh.geometry;
        const posAttr = geom.getAttribute("position");
        if (!posAttr) return;

        worldMatrix.copy(mesh.matrixWorld);
        const v = new Vector3();
        for (let i = 0; i < posAttr.count; i++) {
          v.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
          v.applyMatrix4(worldMatrix);
          if (v.x < minX) minX = v.x;
          if (v.x > maxX) maxX = v.x;
          if (v.z < minZ) minZ = v.z;
          if (v.z > maxZ) maxZ = v.z;
        }
      });

      const hx = (maxX - minX) / 2;
      const hz = (maxZ - minZ) / 2;
      return { hx, hz };
    },
    []
  );

  const computeXZFootprintCenter = useCallback(
    (root: Group): { cx: number; cz: number } => {
      const worldMatrix = new Matrix4();
      let minX = Infinity,
        maxX = -Infinity;
      let minZ = Infinity,
        maxZ = -Infinity;

      root.updateWorldMatrix(true, true);
      root.traverse((obj) => {
        const mesh = obj as Mesh;
        if (!mesh || !(mesh.geometry instanceof BufferGeometry)) return;
        const posAttr = mesh.geometry.getAttribute("position");
        if (!posAttr) return;
        worldMatrix.copy(mesh.matrixWorld);
        const v = new Vector3();
        for (let i = 0; i < posAttr.count; i++) {
          v.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
          v.applyMatrix4(worldMatrix);
          if (v.x < minX) minX = v.x;
          if (v.x > maxX) maxX = v.x;
          if (v.z < minZ) minZ = v.z;
          if (v.z > maxZ) maxZ = v.z;
        }
      });
      return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 };
    },
    []
  );

  const computeXZFootprintPoints = useCallback(
    (root: Group, bandOverride?: number): Array<{ x: number; z: number }> => {
      const allPoints: Array<{ x: number; y: number; z: number }> = [];
      const worldMatrix = new Matrix4();
      root.updateWorldMatrix(true, true);
      root.traverse((obj) => {
        const mesh = obj as Mesh;
        if (!mesh || !(mesh.geometry instanceof BufferGeometry)) return;
        const posAttr = mesh.geometry.getAttribute("position");
        if (!posAttr) return;
        worldMatrix.copy(mesh.matrixWorld);
        const v = new Vector3();
        for (let i = 0; i < posAttr.count; i++) {
          v.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
          v.applyMatrix4(worldMatrix);
          allPoints.push({ x: v.x, y: v.y, z: v.z });
        }
      });
      if (allPoints.length === 0) return [];
      let minY = Infinity;
      for (const p of allPoints) if (p.y < minY) minY = p.y;
      const band = bandOverride !== undefined ? bandOverride : 0.02;
      const contact = allPoints.filter((p) => p.y <= minY + band);
      const source = contact.length >= 8 ? contact : allPoints;
      return source.map((p) => ({ x: p.x, z: p.z }));
    },
    []
  );

  const convexHullXZ = useCallback((pts: Array<{ x: number; z: number }>) => {
    if (pts.length <= 3) return pts;
    const sorted = pts
      .slice()
      .sort((a, b) => (a.x === b.x ? a.z - b.z : a.x - b.x));
    const cross = (o: any, a: any, b: any) =>
      (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
    const lower: any[] = [];
    for (const p of sorted) {
      while (
        lower.length >= 2 &&
        cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
      )
        lower.pop();
      lower.push(p);
    }
    const upper: any[] = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const p = sorted[i];
      while (
        upper.length >= 2 &&
        cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
      )
        upper.pop();
      upper.push(p);
    }
    upper.pop();
    lower.pop();
    return lower.concat(upper);
  }, []);

  const polygonsIntersectSAT = useCallback(
    (
      polyA: Array<{ x: number; z: number }>,
      polyB: Array<{ x: number; z: number }>,
      marginOverride?: number
    ) => {
      const axes: Array<{ x: number; z: number }> = [];
      const addAxes = (poly: any[]) => {
        for (let i = 0; i < poly.length; i++) {
          const p1 = poly[i];
          const p2 = poly[(i + 1) % poly.length];
          const edge = { x: p2.x - p1.x, z: p2.z - p1.z };
          const axis = { x: -edge.z, z: edge.x };
          const len = Math.hypot(axis.x, axis.z);
          if (len > 0) axes.push({ x: axis.x / len, z: axis.z / len });
        }
      };
      addAxes(polyA);
      addAxes(polyB);
      const project = (poly: any[], axis: any) => {
        let min = Infinity,
          max = -Infinity;
        for (const p of poly) {
          const proj = p.x * axis.x + p.z * axis.z;
          if (proj < min) min = proj;
          if (proj > max) max = proj;
        }
        return { min, max };
      };
      const margin = marginOverride !== undefined ? marginOverride : 0.5;
      for (const axis of axes) {
        const a = project(polyA, axis);
        const b = project(polyB, axis);
        if (a.max + margin <= b.min || b.max + margin <= a.min) return false;
      }
      return true;
    },
    []
  );

  const checkCollisionAtPosition = useCallback(
    (
      modelGroup: Group,
      newPosition: Vector3,
      marginOverride?: number,
      viewMode?: "2d" | "3d"
    ): boolean => {
      if (!otherModelRef.current || !modelGroup) return false;

      if (!otherHalfExtentsRef.current && otherModelRef.current) {
        otherHalfExtentsRef.current = computeXZFootprintHalfExtents(
          otherModelRef.current
        );
        const oc = computeXZFootprintCenter(otherModelRef.current);
        otherCenterOffsetRef.current = {
          cx: oc.cx - otherModelRef.current.position.x,
          cz: oc.cz - otherModelRef.current.position.z,
        };
      }
      selfHalfExtentsRef.current = computeXZFootprintHalfExtents(modelGroup);
      const sc = computeXZFootprintCenter(modelGroup);
      selfCenterOffsetRef.current = {
        cx: sc.cx - modelGroup.position.x,
        cz: sc.cz - modelGroup.position.z,
      };

      const band = 0.0001;
      const selfPoints = computeXZFootprintPoints(modelGroup, band).map(
        (p) => ({
          x: p.x + (newPosition.x - modelGroup.position.x),
          z: p.z + (newPosition.z - modelGroup.position.z),
        })
      );
      const otherPoints = computeXZFootprintPoints(otherModelRef.current, band);
      const selfHull = convexHullXZ(selfPoints);
      const otherHull = convexHullXZ(otherPoints);
      let margin = 0.7;
      if (viewMode === "3d") margin = 2.5;
      if (marginOverride !== undefined) margin = marginOverride;
      const intersects = polygonsIntersectSAT(selfHull, otherHull, margin);

      // Debug: log hulls and band
      console.log("Collision Debug", {
        band,
        selfHull,
        otherHull,
        selfHullCount: selfHull.length,
        otherHullCount: otherHull.length,
        intersects,
        marginOverride,
        viewMode,
        margin,
      });

      return intersects;
    },
    [otherModelRef]
  );
  const updateCollisionWarning = useCallback(
    (modelGroup: Group, position: Vector3) => {
      setIsCollisionWarning(checkCollisionAtPosition(modelGroup, position));
    },
    [checkCollisionAtPosition]
  );

  const resetCollisionWarning = useCallback(
    () => setIsCollisionWarning(false),
    []
  );

  return {
    isCollisionWarning,
    checkCollisionAtPosition,
    updateCollisionWarning,
    resetCollisionWarning,
  };
}

export function checkGroupsIntersectXZ(
  a: Group,
  b: Group,
  options?: { margin?: number; band?: number }
): boolean {
  const worldMatrix = new Matrix4();
  const gatherPoints = (
    root: Group
  ): Array<{ x: number; y: number; z: number }> => {
    const pts: Array<{ x: number; y: number; z: number }> = [];
    root.updateWorldMatrix(true, true);
    root.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh || !(mesh.geometry instanceof BufferGeometry)) return;
      const posAttr = mesh.geometry.getAttribute("position");
      if (!posAttr) return;
      worldMatrix.copy(mesh.matrixWorld);
      const v = new Vector3();
      for (let i = 0; i < posAttr.count; i++) {
        v.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
        v.applyMatrix4(worldMatrix);
        pts.push({ x: v.x, y: v.y, z: v.z });
      }
    });
    return pts;
  };

  const toGroundFootprint = (
    all: Array<{ x: number; y: number; z: number }>
  ): Array<{ x: number; z: number }> => {
    if (all.length === 0) return [];
    let minY = Infinity;
    for (const p of all) if (p.y < minY) minY = p.y;
    const band = options?.band ?? 0.001;
    const contact = all.filter((p) => p.y <= minY + band);
    const src = contact.length >= 8 ? contact : all;
    return src.map((p) => ({ x: p.x, z: p.z }));
  };

  const convexHullXZ = (pts: Array<{ x: number; z: number }>) => {
    if (pts.length <= 3) return pts;
    const sorted = pts
      .slice()
      .sort((a, b) => (a.x === b.x ? a.z - b.z : a.x - b.x));
    const cross = (o: any, a: any, b: any) =>
      (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
    const lower: any[] = [];
    for (const p of sorted) {
      while (
        lower.length >= 2 &&
        cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
      )
        lower.pop();
      lower.push(p);
    }
    const upper: any[] = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const p = sorted[i];
      while (
        upper.length >= 2 &&
        cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
      )
        upper.pop();
      upper.push(p);
    }
    upper.pop();
    lower.pop();
    return lower.concat(upper);
  };

  const polygonsIntersectSAT = (
    polyA: Array<{ x: number; z: number }>,
    polyB: Array<{ x: number; z: number }>,
    marginOverride?: number,
    viewMode?: "2d" | "3d"
  ) => {
    const axes: Array<{ x: number; z: number }> = [];
    const addAxes = (poly: any[]) => {
      for (let i = 0; i < poly.length; i++) {
        const p1 = poly[i];
        const p2 = poly[(i + 1) % poly.length];
        const edge = { x: p2.x - p1.x, z: p2.z - p1.z };
        const axis = { x: -edge.z, z: edge.x };
        const len = Math.hypot(axis.x, axis.z);
        if (len > 0) axes.push({ x: axis.x / len, z: axis.z / len });
      }
    };
    addAxes(polyA);
    addAxes(polyB);
    const project = (poly: any[], axis: any) => {
      let min = Infinity,
        max = -Infinity;
      for (const p of poly) {
        const proj = p.x * axis.x + p.z * axis.z;
        if (proj < min) min = proj;
        if (proj > max) max = proj;
      }
      return { min, max };
    };
    let margin = 2.5;
    if (viewMode === "2d") margin = 0.7;
    if (marginOverride !== undefined) margin = marginOverride;
    for (const axis of axes) {
      const aProj = project(polyA, axis);
      const bProj = project(polyB, axis);
      if (aProj.max + margin <= bProj.min || bProj.max + margin <= aProj.min)
        return false;
    }
    return true;
  };

  const aPts = toGroundFootprint(gatherPoints(a));
  const bPts = toGroundFootprint(gatherPoints(b));
  const aHull = convexHullXZ(aPts);
  const bHull = convexHullXZ(bPts);
  const viewMode = (options && (options as any).viewMode) || undefined;
  return polygonsIntersectSAT(aHull, bHull, options?.margin, viewMode);
}
