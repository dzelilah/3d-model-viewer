'use client'

import { Suspense, useState, useCallback } from 'react'
import DualModelViewer from '../components/DualModelViewer'

export default function Home() {
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d')

  const handleViewModeChange = useCallback((mode: '3d' | '2d') => {
    console.log('Changing view mode to:', mode)
    setViewMode(mode)
  }, [])

  console.log('Current view mode:', viewMode)

  return (
    <div className="main-container">
      <header className="header">
        <h1>3D Model Viewer</h1>
        <div className="view-toggle">
          <button 
            className={`toggle-btn ${viewMode === '3d' ? 'active' : ''}`}
            onClick={() => handleViewModeChange('3d')}
          >
            3D view
          </button>
          <button 
            className={`toggle-btn ${viewMode === '2d' ? 'active' : ''}`}
            onClick={() => handleViewModeChange('2d')}
          >
            2D view
          </button>
        </div>
        <div style={{ 
          color: 'white', 
          fontSize: '14px', 
          marginTop: '10px',
          opacity: 0.7 
        }}>
          Current mode: {viewMode.toUpperCase()}
        </div>
      </header>
      
      <div className="content">
        <Suspense fallback={<div className="loading">Loading 3D Models...</div>}>
          <DualModelViewer viewMode={viewMode} />
        </Suspense>
      </div>
    </div>
  )
}