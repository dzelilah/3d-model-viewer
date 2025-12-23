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
    newPosition: Vector3
  ) => boolean,
  resetCollisionWarning: () => void,
  position: [number, number, number],
  setPosition: (position: [number, number, number]) => void,
  onDragStateChange?: (dragging: boolean) => void
) {
  const meshRef = useRef<Group>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [originalPosition, setOriginalPosition] =
    useState<[number, number, number]>(position);
  const { camera, raycaster, gl } = useThree();

  const handleModelPointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (event.button !== 0) return;
      if (!meshRef.current) return;


      // Only start drag if the pointer intersects the visible mesh geometry (not group or invisible children)
      const pointer = new Vector2();
      const rect = gl.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      // Collect all visible mesh children in the group
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

      event.stopPropagation();
      setIsDragging(true);
      onDragStateChange?.(true);
      setOriginalPosition(position);
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
        const mouse = new Vector2(
          ((moveEvent.clientX - rect.left) / rect.width) * 2 - 1,
          -((moveEvent.clientY - rect.top) / rect.height) * 2 + 1
        );

        raycaster.setFromCamera(mouse, camera);
        const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
        const intersection = new Vector3();

        if (
          raycaster.ray.intersectPlane(groundPlane, intersection) &&
          meshRef.current
        ) {
          const modelPosition = new Vector3(intersection.x, 0, intersection.z);
          const willCollide = checkCollisionAtPosition(meshRef.current, modelPosition);
          updateCollisionWarning(meshRef.current, modelPosition);
          if (!willCollide) {
            meshRef.current.position.set(intersection.x, 0, intersection.z);
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

  // No-op for compatibility with DraggableModel
  const handleModelPointerMove = useCallback(() => {}, []);
  const handleModelPointerUp = useCallback(() => {}, []);

  return {
    meshRef,
    isDragging,
    handleModelPointerDown,
    handleModelPointerMove,
    handleModelPointerUp,
  };
}