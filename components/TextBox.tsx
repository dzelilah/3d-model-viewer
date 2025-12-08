import React, { useEffect, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { TextBoxData } from '../hooks/useTextBoxes'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

export default function TextBox({ box, selected, onSelect, onChange, onRemove, onDone, onDragStart, onDragEnd, modelDragging }: {
  box: TextBoxData
  selected: boolean
  onSelect: (id: string) => void
  onChange: (id: string, patch: Partial<TextBoxData>) => void
  onRemove: (id: string) => void
  onDone: () => void
  onDragStart?: () => void
  onDragEnd?: () => void
  modelDragging?: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const textureRef = useRef<THREE.CanvasTexture | null>(null)
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null)
  const [dragging, setDragging] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const downInfoRef = useRef<{ screenX: number; screenY: number; t: number } | null>(null)
  const movedRef = useRef(false)
  const { camera, raycaster, gl } = useThree()

  // Create and update canvas texture
  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 256
    canvasRef.current = canvas
    
    const texture = new THREE.CanvasTexture(canvas)
    texture.flipY = false
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    textureRef.current = texture
    setTexture(texture)
    
    return () => {
      texture.dispose()
    }
  }, [])

  // Render text to canvas
  useEffect(() => {
    if (!canvasRef.current || !textureRef.current) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Parse background color with opacity
    const bgHex = box.backgroundColor
    const bgOpacity = box.backgroundOpacity ?? 1
    const r = parseInt(bgHex.slice(1, 3), 16)
    const g = parseInt(bgHex.slice(3, 5), 16)
    const b = parseInt(bgHex.slice(5, 7), 16)
    
    // Draw background
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${bgOpacity})`
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw border if selected
    if (selected) {
      ctx.strokeStyle = 'rgba(120, 180, 255, 0.8)'
      ctx.lineWidth = 4
      ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4)
    }

    // Draw text
    ctx.fillStyle = box.textColor
    ctx.font = '48px Inter, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    
    // Word wrap text
    const maxWidth = canvas.width - 40
    const lineHeight = 56
    const words = box.text.split(' ')
    let line = ''
    let y = 20

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' '
      const metrics = ctx.measureText(testLine)
      if (metrics.width > maxWidth && i > 0) {
        ctx.fillText(line, 20, y)
        line = words[i] + ' '
        y += lineHeight
      } else {
        line = testLine
      }
    }
    ctx.fillText(line, 20, y)

    // Update texture
    textureRef.current.needsUpdate = true
  }, [box.text, box.textColor, box.backgroundColor, box.backgroundOpacity, selected])

  const handlePointerDown = (e: any) => {
    if (selected || modelDragging) return
    e.stopPropagation()
    downInfoRef.current = { screenX: e.clientX, screenY: e.clientY, t: performance.now() }
    movedRef.current = false

    const handleMove = (me: MouseEvent) => {
      if (!downInfoRef.current) return
      const dx = me.clientX - downInfoRef.current.screenX
      const dy = me.clientY - downInfoRef.current.screenY
      
      if (Math.hypot(dx, dy) > 3) {
        movedRef.current = true
        if (!dragging) {
          setDragging(true)
          onDragStart?.()
        }
        
        // Raycast to ground plane
        const rect = gl.domElement.getBoundingClientRect()
        const ndc = new THREE.Vector2(
          ((me.clientX - rect.left) / rect.width) * 2 - 1,
          -((me.clientY - rect.top) / rect.height) * 2 + 1
        )
        raycaster.setFromCamera(ndc, camera)
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
        const intersection = new THREE.Vector3()
        if (raycaster.ray.intersectPlane(plane, intersection)) {
          onChange(box.id, { position: [intersection.x, 2.0, intersection.z] })
        }
      }
    }

    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
      
      const wasDragging = dragging
      const moved = movedRef.current
      
      if (wasDragging) {
        setDragging(false)
        onDragEnd?.()
      }
      
      if (!moved && downInfoRef.current && (performance.now() - downInfoRef.current.t) < 300) {
        // It was a click - enter edit mode
        onSelect(box.id)
      }
      
      downInfoRef.current = null
      movedRef.current = false
    }

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
  }

  const clampedY = Math.max(box.position[1] ?? 2.0, 2.0)

  return (
    <group position={[box.position[0], clampedY, box.position[2]]}>
      <mesh
        ref={meshRef}
        rotation={box.rotation ? new THREE.Euler(box.rotation[0], box.rotation[1], box.rotation[2]) : undefined}
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
      
      {/* Editing overlay when selected - stays unrotated */}
      {selected && (
        <Html center position={[0, 0, 0.01]} transform style={{ pointerEvents: 'auto' }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: '2px 4px',
              backgroundColor: 'rgba(20, 20, 20, 0.9)',
              border: '1px solid rgba(120, 180, 255, 0.8)',
              borderRadius: 3,
              minWidth: 60,
              maxWidth: 120,
              fontSize: 7
            }}
          >
            <div
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => {
                const val = (e.currentTarget as HTMLDivElement).innerText
                onChange(box.id, { text: val })
              }}
              style={{
                minWidth: 50,
                maxWidth: 120,
                background: 'transparent',
                outline: 'none',
                color: box.textColor,
                fontSize: 7,
                lineHeight: '11px',
                fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
                fontWeight: 500,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                marginBottom: 3
              }}
            >
              {box.text}
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 3, alignItems: 'center', flexWrap: 'wrap', fontSize: 7, lineHeight: '10px' }}>
              <div style={{ display: 'flex', gap: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <button
                    title="Text color"
                    onClick={(e) => {
                      e.stopPropagation();
                      (e.currentTarget.nextSibling as HTMLInputElement)?.click()
                    }}
                    style={{ width: 12, height: 12, borderRadius: 3, border: '1px solid rgba(255,255,255,0.2)', background: box.textColor, cursor: 'pointer' }}
                  />
                  <input
                    type="color"
                    value={box.textColor}
                    onChange={(e) => onChange(box.id, { textColor: e.target.value })}
                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <button
                    title="Background color"
                    onClick={(e) => {
                      e.stopPropagation();
                      (e.currentTarget.nextSibling as HTMLInputElement)?.click()
                    }}
                    style={{ width: 12, height: 12, borderRadius: 3, border: '1px solid rgba(255,255,255,0.2)', background: box.backgroundColor, cursor: 'pointer' }}
                  />
                  <input
                    type="color"
                    value={box.backgroundColor}
                    onChange={(e) => onChange(box.id, { backgroundColor: e.target.value })}
                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 7, color: '#cfd8dc' }}>Opacity</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={box.backgroundOpacity ?? 1}
                  onChange={(e) => onChange(box.id, { backgroundOpacity: Number(e.target.value) })}
                  style={{ width: 60, height: 10, padding: 0 }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 7, color: '#cfd8dc' }}>Rotation</span>
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={5}
                  value={box.rotation ? (box.rotation[1] * 180 / Math.PI) : 0}
                  onChange={(e) => {
                    const angleRad = (Number(e.target.value) * Math.PI) / 180
                    onChange(box.id, { rotation: [0, angleRad, 0] })
                  }}
                  style={{ width: 60, height: 10, padding: 0 }}
                />
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(box.id) }}
                style={{ padding: '3px 6px', borderRadius: 6, background: '#ef4444', color: '#fff', border: 'none', fontSize: 7, fontWeight: 600, cursor: 'pointer' }}
              >
                Delete
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDone() }}
                style={{ padding: '3px 6px', borderRadius: 6, background: '#10b981', color: '#fff', border: 'none', fontSize: 7, fontWeight: 600, cursor: 'pointer' }}
              >
                Done
              </button>
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}
