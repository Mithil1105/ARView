import './App.css';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useGLTF } from '@react-three/drei';
import '@google/model-viewer';
import * as THREE from 'three';

function Home() {
  const navigate = useNavigate();
  return (
    <div className="page centered">
      <h1 className="title">AI Visualization Test</h1>
      <button className="primary" onClick={() => navigate('/viewer')}>View Model</button>
    </div>
  );
}

function Model({ url }) {
  const gltf = useGLTF(url);
  // Center and fit model: compute bounding box and scale to unit size
  const scene = gltf.scene;
  if (scene) {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const maxAxis = Math.max(size.x, size.y, size.z) || 1;
    const scale = 1 / maxAxis;
    scene.position.sub(center); // center at origin
    scene.scale.setScalar(scale * 2); // fit nicely in view
  }
  return <primitive object={scene} />;
}

function Viewer() {
  const modelUrl = `${process.env.PUBLIC_URL || ''}/model.glb`;
  const [arMode, setArMode] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [canActivateAr, setCanActivateAr] = useState(false);
  const modelViewerRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const mediaStreamRef = useRef(null);

  const uaCanDoAR = useMemo(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isAndroid = /Android/.test(navigator.userAgent);
    return isIOS || isAndroid;
  }, []);
  const effectiveAr = arMode && canActivateAr;

  useEffect(() => {
    const el = modelViewerRef.current;
    if (!el) return;
    const applyCapability = () => {
      try {
        const available = !!el.canActivateAR;
        setCanActivateAr(available);
      } catch {
        setCanActivateAr(false);
      }
    };
    applyCapability();

    const onArStatus = (e) => {
      const status = e?.detail?.status;
      if (status === 'failed' || status === 'not-presenting') {
        if (arMode) {
          startCameraPreview();
        }
      }
    };
    el.addEventListener('ar-status', onArStatus);
    return () => {
      el.removeEventListener('ar-status', onArStatus);
    };
  }, [arMode]);

  const startCameraPreview = async () => {
    try {
      stopCameraPreview();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      mediaStreamRef.current = stream;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        await cameraVideoRef.current.play();
      }
      setCameraError('');
      setCameraActive(true);
    } catch (err) {
      setCameraError(err?.message || 'Camera access denied');
      setCameraActive(false);
    }
  };

  const stopCameraPreview = () => {
    const stream = mediaStreamRef.current;
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
  };

  return (
    <div className="page">
      <div className="topbar">
        <Link to="/" className="link">← Back to Home</Link>
        <div className="spacer" />
        <button
          className="secondary"
          onClick={async () => {
            if (effectiveAr) {
              setArMode(false);
              stopCameraPreview();
              return;
            }
            const el = modelViewerRef.current;
            if (canActivateAr && el && el.activateAR) {
              setArMode(true);
              try { await el.activateAR(); } catch { await startCameraPreview(); }
            } else {
              await startCameraPreview();
            }
          }}
        >
          {effectiveAr ? 'Exit AR' : (canActivateAr ? 'View in AR' : (cameraActive ? 'Stop Camera' : 'Open Camera'))}
        </button>
      </div>

      {!effectiveAr && !cameraActive && (
        <div className="viewer">
          <Canvas camera={{ position: [0, 1.5, 3], fov: 45 }} style={{ width: '100%', height: '100%' }}>
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 5, 5]} intensity={1} />
            <Suspense fallback={null}>
              <Model url={modelUrl} />
            </Suspense>
            <OrbitControls enableDamping makeDefault />
          </Canvas>
        </div>
      )}

      {effectiveAr && (
        <div className="viewer">
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <model-viewer
            ref={modelViewerRef}
            src={modelUrl}
            ar
            ar-modes="webxr scene-viewer quick-look"
            ar-scale="auto"
            camera-controls
            exposure="1"
            shadow-intensity="1"
            style={{ width: '100%', height: '100%' }}
          >
          </model-viewer>
        </div>
      )}

      {!effectiveAr && cameraActive && (
        <div className="viewer">
          <video ref={cameraVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          {cameraError && <div className="note">{cameraError}</div>}
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/viewer" element={<Viewer />} />
    </Routes>
  );
}

export default App;
