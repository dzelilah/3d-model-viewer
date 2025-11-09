# 3D Model Viewer

An interactive 3D web application for managing and manipulating GLB 3D models with real-time Firebase synchronization.

## 🎯 Overview

This application provides an intuitive interface for viewing and manipulating two 3D models in both 3D and 2D perspectives. All model positions and rotations are automatically synchronized with Firebase Firestore for persistence across sessions.

## ✨ Features

### 🎮 Interactive Controls
- **Drag & Drop**: Click and drag models to reposition them within the scene
- **Collision Detection**: Visual feedback prevents models from overlapping
- **Rotation Controls**: Intuitive sliders for precise model rotation
- **Dual View Modes**: Toggle between 3D perspective and 2D top-down views

### 🔄 Real-time Synchronization
- **Firebase Integration**: All changes automatically saved to Firestore
- **Persistent State**: Model positions and rotations preserved between sessions
- **No Authentication Required**: Public access for all users

### 🎨 Visual Feedback
- **Color-coded Indicators**: Green circles for safe positioning, red for collisions
- **Hover Effects**: Visual cues for interactive elements
- **Responsive Design**: Optimized for various screen sizes

## 🛠️ Tech Stack

- **Frontend Framework**: Next.js 14.2.8 with TypeScript
- **3D Rendering**: Three.js 0.168.0 + React-Three-Fiber 8.15.11
- **Database**: Firebase Firestore 10.7.1
- **Styling**: CSS Modules with global styles
- **Development**: ESLint, TypeScript strict mode

## 📁 Project Structure

```
3d-web-app/
├── app/
│   ├── globals.css          # Global styles and animations
│   ├── layout.tsx           # Root layout component
│   └── page.tsx             # Main application page
├── components/
│   └── DualModelViewer.tsx  # Core 3D scene component
├── hooks/
│   ├── useCollisionDetection.ts  # Collision detection logic
│   ├── useDragControls.ts       # Drag and drop functionality
│   ├── useModelSync.ts          # Firebase synchronization
│   └── useVisualFeedback.ts     # UI feedback management
├── lib/
│   └── firebase.ts          # Firebase configuration
├── public/
│   └── models/
│       ├── bust_of_a_rhetorician.glb
│       └── lion_crushing_a_serpent.glb
├── .env.example             # Environment variables template
└── package.json
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Firebase project with Firestore enabled

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/dzelilah/3d-model-viewer.git
   cd 3d-model-viewer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   ```bash
   # Copy environment template
   cp .env.example .env.local
   
   # Edit .env.local with your Firebase credentials
   NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-domain.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-bucket.firebasestorage.app
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
   ```

4. **Set up Firebase Firestore**
   - Create a new Firebase project at https://console.firebase.google.com
   - Enable Firestore Database
   - Set security rules to allow public read/write access:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open application**
   Navigate to `http://localhost:3000` in your browser

## 🎮 Usage Guide

### Basic Operations

1. **View Toggle**
   - Use the "3D view" / "2D view" buttons to switch perspectives
   - 3D view: Full orbital camera controls
   - 2D view: Top-down orthographic projection

2. **Model Manipulation**
   - **Move**: Click and drag any model to reposition
   - **Rotate**: Use the sliders below the scene
   - **Collision**: Red circles indicate invalid positions

3. **Visual Indicators**
   - **Green circles**: Safe to drop model
   - **Red circles**: Collision detected, drop prevented
   - **Blue outline**: Model hover state

### Advanced Features

- **Automatic Saving**: All changes save instantly to Firebase
- **Session Persistence**: Reload the page to see saved positions
- **Multi-user Support**: Changes visible to all users in real-time

## 🔧 Development

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

### Architecture Overview

The application follows a modular hook-based architecture:

- **`useModelSync`**: Manages Firebase state synchronization
- **`useDragControls`**: Handles mouse interactions and model movement
- **`useCollisionDetection`**: Prevents model overlap with spatial calculations
- **`useVisualFeedback`**: Manages UI states and visual indicators

### Code Quality

- **TypeScript**: Strict type checking enabled
- **ESLint**: Code quality and consistency rules
- **Modular Design**: Reusable hooks and components
- **Performance Optimized**: useCallback for event handlers

## 🔥 Firebase Configuration

### Firestore Structure

```
models/
├── model1/
│   ├── position: { x: number, y: number, z: number }
│   ├── rotation: number (0-100)
│   └── updatedAt: timestamp
└── model2/
    ├── position: { x: number, y: number, z: number }
    ├── rotation: number (0-100)
    └── updatedAt: timestamp
```

### Security Considerations

- Environment variables prefixed with `NEXT_PUBLIC_` for client-side access
- Firebase API keys are safe for public exposure
- Firestore rules configured for public access (as per requirements)

## 🌐 Deployment

### Vercel (Recommended)

1. **Connect to Vercel**
   ```bash
   npm i -g vercel
   vercel
   ```

2. **Configure Environment Variables**
   - Add all `NEXT_PUBLIC_` variables in Vercel dashboard
   - Deploy automatically on git push

### Alternative Platforms

- **Netlify**: Drag & drop the `dist` folder after `npm run build`
- **Firebase Hosting**: Use `firebase deploy` after setting up Firebase CLI

## 📝 API Reference

### Core Hooks

#### `useModelSync(modelId, defaultPosition, defaultRotation)`
Manages Firebase synchronization for model state.

**Parameters:**
- `modelId`: Unique identifier for the model
- `defaultPosition`: Initial position [x, y, z]
- `defaultRotation`: Initial rotation (0-100)

**Returns:**
- `position`: Current model position
- `rotation`: Current model rotation
- `setSyncedPosition`: Function to update position
- `setSyncedRotation`: Function to update rotation
- `isLoading`: Loading state
- `error`: Error state

#### `useDragControls(orbitControlsRef, onPositionChange, ...)`
Handles drag and drop functionality with collision detection.

#### `useCollisionDetection(otherModelRef)`
Provides collision detection between models.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Troubleshooting

### Common Issues

**Models not loading:**
- Check that GLB files are in `public/models/`
- Verify file paths in component imports

**Firebase connection errors:**
- Ensure `.env.local` has correct credentials
- Check Firestore security rules allow read/write

**Collision detection not working:**
- Verify model refs are properly assigned
- Check console for JavaScript errors

**Performance issues:**
- Enable React StrictMode is disabled in production
- Check browser console for Three.js warnings

### Getting Help

- Open an issue on GitHub for bugs
- Check the browser console for error messages
- Verify Firebase console for database connectivity

## 📊 Performance

- **Bundle Size**: Optimized with Next.js automatic code splitting
- **3D Rendering**: Hardware-accelerated WebGL via Three.js
- **Database**: Efficient Firestore queries with minimal data transfer
- **Loading**: Progressive model loading with fallback states

---

**Built with ❤️ using Next.js, Three.js, and Firebase**