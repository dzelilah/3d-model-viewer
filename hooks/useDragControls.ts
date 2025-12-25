import { useState, useRef, useCallback } from "react";
import { useThree, ThreeEvent } from "@react-three/fiber";
import { Group, Vector2, Vector3, Plane, Object3D } from "three";
import { OrbitControls as OrbitControlsImpl } from "three-stdlib";

export function useDragControls(
  orbitControlsRef: React.MutableRefObject<OrbitControlsImpl | null>,
  onPositionChange: (position: [number, number, number]) => void,
  updateCollisionWarning: (modelGroup: Group, position: Vector3) => void,
  checkCollisionAtPosition: (
    modelGroup: Group,
    newPosition: Vector3,
    margin?: number
  ) => boolean,
  resetCollisionWarning: () => void,
  position: [number, number, number],
  setPosition: (position: [number, number, number]) => void,
  onDragStateChange?: (dragging: boolean) => void,
  viewMode?: "3d" | "2d",
  activeCameraRef?: React.MutableRefObject<any>,
  modelLocalOffsetRef?: React.MutableRefObject<Vector3 | null>
) {
  const last2DDragPosition = useRef<[number, number, number] | null>(null);
  const meshRef = useRef<Group>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [originalPosition, setOriginalPosition] =
    useState<[number, number, number]>(position);
  const { camera, raycaster, gl } = useThree();
  const toPointer = (clientX: number, clientY: number) => {
    const rect = gl.domElement.getBoundingClientRect();
    return new Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
  };

  const handleModelPointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (event.button !== 0) return;
      if (!meshRef.current) return;

      const activeCamera = activeCameraRef?.current ?? camera;
      activeCamera.updateMatrixWorld(true);
      const pointer = toPointer(event.clientX, event.clientY);
      raycaster.setFromCamera(pointer, activeCamera);

      let meshList: Object3D[] = [];
      if (meshRef.current) {
        meshRef.current.traverse((obj) => {
          if (obj.type === "Mesh" && obj.visible) {
            meshList.push(obj);
          }
        });
      }
      if (meshList.length === 0) return;
      const intersects = raycaster.intersectObjects(meshList, false);
      if (!intersects.length) return;

      if (viewMode === "2d") {
        event.stopPropagation();
      }
      setIsDragging(true);
      onDragStateChange?.(true);
      if (viewMode !== "2d") {
        setOriginalPosition(position);
      }
      gl.domElement.style.cursor = "grabbing";

      if (orbitControlsRef.current) {
        const oc = orbitControlsRef.current;
        oc.enabled = false;
        (oc as any)._prevRotate = oc.enableRotate;
        (oc as any)._prevZoom = oc.enableZoom;
        (oc as any)._prevPan = oc.enablePan;
        oc.enableRotate = false;
        oc.enableZoom = false;
        oc.enablePan = false;
      }

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const is2D = viewMode === "2d";
        const activeCamera = activeCameraRef?.current ?? camera;
        activeCamera.updateMatrixWorld(true);
        const mouse = toPointer(moveEvent.clientX, moveEvent.clientY);
        raycaster.setFromCamera(mouse, activeCamera);

        if (is2D) {
          const groundPlane = new Plane(new Vector3(0, 1, 0), 0); 
          const intersection = new Vector3();
          if (raycaster.ray.intersectPlane(groundPlane, intersection)) {
            const min = -7.5, max = 7.5;
            let x = Math.max(min, Math.min(max, intersection.x));
            let z = Math.max(min, Math.min(max, intersection.z));
            const offset = modelLocalOffsetRef?.current || new Vector3(0,0,0);
            x -= offset.x;
            z -= offset.z;
            x = Math.max(min, Math.min(max, x));
            z = Math.max(min, Math.min(max, z));
            const newPos: [number, number, number] = [x, 0, z];
            let blocked = false;
            if (meshRef.current) {
              const testVec = new Vector3(x, 0, z);
              blocked = checkCollisionAtPosition(meshRef.current, testVec, 1.0);
            }
            if (!blocked) {
              last2DDragPosition.current = newPos;
              onPositionChange(newPos);
            } else if (last2DDragPosition.current) {
              onPositionChange(last2DDragPosition.current);
            }
          }
        } else if (meshRef.current) {
          const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
          const intersection = new Vector3();
          if (raycaster.ray.intersectPlane(groundPlane, intersection)) {
            const min = -7.5, max = 7.5;
            let x = Math.max(min, Math.min(max, intersection.x));
            let z = Math.max(min, Math.min(max, intersection.z));
            const modelPosition = new Vector3(x, 0, z);
            const willCollide = checkCollisionAtPosition(meshRef.current, modelPosition);
            updateCollisionWarning(meshRef.current, modelPosition);
            if (!willCollide) {
              meshRef.current.position.set(x, 0, z);
            }
          }
        }
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        onDragStateChange?.(false);
        gl.domElement.style.cursor = "auto";

        if (orbitControlsRef.current) {
          const oc = orbitControlsRef.current;
          oc.enabled = true;
          oc.enableRotate = (oc as any)._prevRotate ?? true;
          oc.enableZoom = (oc as any)._prevZoom ?? true;
          oc.enablePan = (oc as any)._prevPan ?? true;
          delete (oc as any)._prevRotate;
          delete (oc as any)._prevZoom;
          delete (oc as any)._prevPan;
        }

        if (meshRef.current) {
          if (viewMode === "2d") {
            const dropPos = last2DDragPosition.current ?? [meshRef.current.position.x, 0, meshRef.current.position.z];
            setPosition(dropPos);
            onPositionChange(dropPos);
            last2DDragPosition.current = null;
          } else {
            const finalPosition = new Vector3(
              meshRef.current.position.x,
              meshRef.current.position.y,
              meshRef.current.position.z
            );
            const hasCollision = checkCollisionAtPosition(
              meshRef.current,
              finalPosition
            );
            if (hasCollision) {
              meshRef.current.position.set(...originalPosition);
              setPosition(originalPosition);
            } else {
              const newPosition: [number, number, number] = [
                meshRef.current.position.x,
                meshRef.current.position.y,
                meshRef.current.position.z,
              ];
              setPosition(newPosition);
              onPositionChange(newPosition);
            }
          }
        }

        resetCollisionWarning();

        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [
      orbitControlsRef,
      gl,
      camera,
      raycaster,
      updateCollisionWarning,
      position,
      setPosition,
      setOriginalPosition,
      onPositionChange,
      onDragStateChange,
      checkCollisionAtPosition,
      resetCollisionWarning,
      originalPosition,
    ]
  );


  const handleModelPointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (!isDragging) return;
    event.stopPropagation();
  }, [isDragging]);

  const handleModelPointerUp = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (!isDragging) return;
    event.stopPropagation();
  }, [isDragging]);

  return {
    meshRef,
    isDragging,
    handleModelPointerDown,
    handleModelPointerMove,
    handleModelPointerUp,
  };
}