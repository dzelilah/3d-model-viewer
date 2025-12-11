import React, { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { TextBoxData } from "../hooks/useTextBoxes";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

export default function TextBox({
  box,
  selected,
  onSelect,
  onChange,
  onRemove,
  onDone,
  onDragStart,
  onDragEnd,
  modelDragging,
}: {
  box: TextBoxData;
  selected: boolean;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<TextBoxData>) => void;
  onRemove: (id: string) => void;
  onDone: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  modelDragging?: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const [dragging, setDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [textFieldHeight, setTextFieldHeight] = useState<number | undefined>(
    undefined
  );

  useEffect(() => {
    if (box.id) {
      const savedHeight = localStorage.getItem(`textbox-height-${box.id}`);
      if (savedHeight) {
        setTextFieldHeight(Number(savedHeight));
      }
    }
  }, [box.id]);
  const downInfoRef = useRef<{
    screenX: number;
    screenY: number;
    t: number;
  } | null>(null);
  const movedRef = useRef(false);
  const { camera, raycaster, gl } = useThree();

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    canvasRef.current = canvas;

    const texture = new THREE.CanvasTexture(canvas);
    texture.flipY = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    textureRef.current = texture;
    setTexture(texture);

    return () => {
      texture.dispose();
    };
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !textureRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const bgHex = box.backgroundColor;
    const bgOpacity = box.backgroundOpacity ?? 1;
    const r = parseInt(bgHex.slice(1, 3), 16);
    const g = parseInt(bgHex.slice(3, 5), 16);
    const b = parseInt(bgHex.slice(5, 7), 16);

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${bgOpacity})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (selected) {
      ctx.strokeStyle = "rgba(120, 180, 255, 0.8)";
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    }

    ctx.save();
    ctx.translate(0, canvas.height);
    ctx.scale(1, -1);

    ctx.fillStyle = box.textColor;
    ctx.font = "32px Arial, Helvetica, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = "32px Courier New, monospace";
    const maxWidth = canvas.width - 36;
    const lineHeight = 40;
    const words = box.text.split(" ");
    let currentLine = "";
    const lines: string[] = [];
    for (let i = 0; i < words.length; i++) {
      const testLine = currentLine + words[i] + " ";
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && i > 0) {
        lines.push(currentLine);
        currentLine = words[i] + " ";
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);

    const totalTextHeight = lines.length * lineHeight;
    const startY = (canvas.height - totalTextHeight) / 2;

    for (let l = 0; l < lines.length; l++) {
      const line = lines[l];
      const letterSpacing = 20;
      const lineWidth = line.length * letterSpacing;
      let x = (canvas.width - lineWidth) / 2;
      for (let c = 0; c < line.length; c++) {
        ctx.save();
        ctx.translate(x + letterSpacing / 2, startY + l * lineHeight);
        ctx.fillText(line[c], 0, 0);
        ctx.restore();
        x += letterSpacing;
      }
    }
    ctx.restore();

    textureRef.current.needsUpdate = true;
  }, [
    box.text,
    box.textColor,
    box.backgroundColor,
    box.backgroundOpacity,
    selected,
  ]);

  const handlePointerDown = (e: any) => {
    if (selected || modelDragging) return;
    e.stopPropagation();
    downInfoRef.current = {
      screenX: e.clientX,
      screenY: e.clientY,
      t: performance.now(),
    };
    movedRef.current = false;

    const handleMove = (me: MouseEvent) => {
      if (!downInfoRef.current) return;
      const dx = me.clientX - downInfoRef.current.screenX;
      const dy = me.clientY - downInfoRef.current.screenY;

      if (Math.hypot(dx, dy) > 3) {
        movedRef.current = true;
        if (!dragging) {
          setDragging(true);
          onDragStart?.();
        }

        const rect = gl.domElement.getBoundingClientRect();
        const ndc = new THREE.Vector2(
          ((me.clientX - rect.left) / rect.width) * 2 - 1,
          -((me.clientY - rect.top) / rect.height) * 2 + 1
        );
        raycaster.setFromCamera(ndc, camera);
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersection = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(plane, intersection)) {
          onChange(box.id, { position: [intersection.x, 0.5, intersection.z] });
        }
      }
    };

    const handleUp = () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
      window.removeEventListener("mouseup", handleUp);

      const wasDragging = dragging;
      const moved = movedRef.current;

      setDragging(false);
      onDragEnd?.();

      if (
        !moved &&
        downInfoRef.current &&
        performance.now() - downInfoRef.current.t < 300
      ) {
        onSelect(box.id);
      }

      downInfoRef.current = null;
      movedRef.current = false;
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    window.addEventListener("mouseup", handleUp);
  };

  const clampedY = Math.max(box.position[1] ?? 0.5, 0.5);

  return (
    <>
      <group
        position={[box.position[0], clampedY, box.position[2]]}
        rotation={box.rotation}
      >
        <mesh
          ref={meshRef}
          onPointerDown={handlePointerDown}
          onPointerOver={() => !modelDragging && setIsHovered(true)}
          onPointerOut={() => setIsHovered(false)}
        >
          <planeGeometry args={[1.8, 0.9]} />
          <meshBasicMaterial
            map={texture ?? undefined}
            transparent
            side={THREE.DoubleSide}
            depthTest
            depthWrite
          />
        </mesh>
      </group>
      {selected && (
        <Html
          center
          position={[box.position[0], clampedY, box.position[2] + 0.01]}
          style={{ pointerEvents: "auto" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: "12px 16px",
              backgroundColor: "rgba(20, 20, 20, 0.92)",
              border: "2px solid rgba(120, 180, 255, 0.85)",
              borderRadius: 10,
              minWidth: 180,
              maxWidth: 320,
              fontSize: 16,
            }}
          >
            <textarea
              value={box.text}
              onChange={(e) => {
                const el = e.target;
                el.style.height = "auto";
                const newHeight = el.scrollHeight;
                el.style.height = newHeight + "px";
                setTextFieldHeight(newHeight);
                localStorage.setItem(
                  `textbox-height-${box.id}`,
                  String(newHeight)
                );
                onChange(box.id, {
                  text: e.target.value,
                });
              }}
              style={{
                minWidth: 160,
                maxWidth: 300,
                fontSize: 16,
                marginBottom: 8,
                color: box.textColor,
                background: "transparent",
                border: "1px solid #888",
                outline: "none",
                fontFamily:
                  "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
                fontWeight: 500,
                resize: "none",
                overflow: "hidden",
                borderRadius: 4,
                height: textFieldHeight ? textFieldHeight : "auto",
              }}
              rows={1}
              ref={(el) => {
                if (el && textFieldHeight) {
                  el.style.height = textFieldHeight + "px";
                }
              }}
            />
            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 8,
                alignItems: "center",
                flexWrap: "wrap",
                fontSize: 16,
                lineHeight: "18px",
                flexDirection: "column",
              }}
            >
              <div style={{ display: "flex", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    title="Text color"
                    onClick={(e) => {
                      e.stopPropagation();
                      (
                        e.currentTarget.nextSibling as HTMLInputElement
                      )?.click();
                    }}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: "1px solid rgba(255,255,255,0.2)",
                      background: box.textColor,
                      cursor: "pointer",
                    }}
                  />
                  <input
                    type="color"
                    value={box.textColor}
                    onChange={(e) =>
                      onChange(box.id, { textColor: e.target.value })
                    }
                    style={{
                      position: "absolute",
                      opacity: 0,
                      width: 0,
                      height: 0,
                      pointerEvents: "none",
                    }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    title="Background color"
                    onClick={(e) => {
                      e.stopPropagation();
                      (
                        e.currentTarget.nextSibling as HTMLInputElement
                      )?.click();
                    }}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: "1px solid rgba(255,255,255,0.2)",
                      background: box.backgroundColor,
                      cursor: "pointer",
                    }}
                  />
                  <input
                    type="color"
                    value={box.backgroundColor}
                    onChange={(e) =>
                      onChange(box.id, { backgroundColor: e.target.value })
                    }
                    style={{
                      position: "absolute",
                      opacity: 0,
                      width: 0,
                      height: 0,
                      pointerEvents: "none",
                    }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 16, color: "#cfd8dc" }}>Opacity</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={box.backgroundOpacity ?? 1}
                  onChange={(e) =>
                    onChange(box.id, {
                      backgroundOpacity: Number(e.target.value),
                    })
                  }
                  style={{ width: 60, height: 12, padding: 0 }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 16, color: "#cfd8dc" }}>Rotation</span>
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={5}
                  value={box.rotation ? (box.rotation[1] * 180) / Math.PI : 0}
                  onChange={(e) => {
                    const angleRad = (Number(e.target.value) * Math.PI) / 180;
                    onChange(box.id, { rotation: [0, angleRad, 0] });
                  }}
                  style={{ width: 60, height: 12, padding: 0 }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 12,
                  marginTop: 12,
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(box.id);
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    background: "#ef4444",
                    color: "#fff",
                    border: "none",
                    fontSize: 16,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDone();
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    background: "#10b981",
                    color: "#fff",
                    border: "none",
                    fontSize: 16,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </Html>
      )}
    </>
  );
}
