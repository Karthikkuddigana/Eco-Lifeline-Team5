import React, { useState, useRef } from 'react';
import { VisionAgent } from '../agents/VisionAgent';
import { RoutingAgent } from '../agents/RoutingAgent';
import { FirebaseAgent } from '../agents/FirebaseAgent';
import { dbService } from '../services/firebase';

// Mock images for quick presets
const PRESET_MOCKS = [
  {
    name: '🔴 Medical Syringes (Yarada)',
    filename: 'yarada_medical_waste.jpg',
    image: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=600&q=80',
    description: 'A heap of plastic garbage, glass shards, and medical equipment on the wet sand.',
    size: 245000,
    latitude: 17.6531,
    longitude: 83.2721
  },
  {
    name: '🟡 Rip Current Wave (RK Beach)',
    filename: 'rkbeach_rip_current.jpg',
    image: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=600&q=80',
    description: 'Turbulent rip channel crossing near the shore. Waves are high and breaking unevenly.',
    size: 512000,
    latitude: 17.7144,
    longitude: 83.3235
  },
  {
    name: '🟢 Discarded Net (Submarine Area)',
    filename: 'rkbeach_submarine_ghostnet.jpg',
    image: 'https://images.unsplash.com/photo-1618477388954-7852f32655ec?auto=format&fit=crop&w=600&q=80',
    description: 'Ghost fishing nets and plastics entangled near the Kurusura Submarine pavement.',
    size: 320000,
    latitude: 17.7182,
    longitude: 83.3308
  },
  {
    name: '🚫 Rejection: Selfie at Cafe',
    filename: 'visitor_selfie.jpg',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    description: 'Citizen taking a selfie indoors in front of a coffee shop.',
    size: 154000,
    latitude: 0,
    longitude: 0
  }
];

export default function CitizenPortal() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Agent State
  const [pipelineActive, setPipelineActive] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0); // 0: Idle, 1: Vision, 2: Routing, 3: Firebase, 4: Done, 5: Rejected
  const [visionState, setVisionState] = useState({ status: 'idle', logs: '', result: null });
  const [routingState, setRoutingState] = useState({ status: 'idle', logs: '', result: null });
  const [firebaseState, setFirebaseState] = useState({ status: 'idle', logs: '', result: null });
  const [finalStatus, setFinalStatus] = useState('');

  const resetPipeline = () => {
    setPipelineActive(false);
    setPipelineStep(0);
    setVisionState({ status: 'idle', logs: '', result: null });
    setRoutingState({ status: 'idle', logs: '', result: null });
    setFirebaseState({ status: 'idle', logs: '', result: null });
    setFinalStatus('');
  };

  const handleFileChange = (e) => {
    resetPipeline();
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    resetPipeline();
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const loadPreset = (preset) => {
    resetPipeline();
    setSelectedFile({
      name: preset.filename,
      size: preset.size,
      type: 'image/jpeg',
      presetUrl: preset.image,
      presetLatitude: preset.latitude,
      presetLongitude: preset.longitude
    });
    setPreviewUrl(preset.image);
  };

  // Run the multi-agent pipeline sequential workflow
  const launchPipeline = async () => {
    if (!selectedFile) return;

    setPipelineActive(true);
    setPipelineStep(1);
    
    // Get Settings for API Keys
    const settings = dbService.getSettings();
    const apiKey = settings.geminiApiKey;

    // --- AGENT 1: Vision & Inspection Agent ---
    setVisionState({ status: 'running', logs: 'Initializing Vision & Inspection Agent...', result: null });
    const visionAgent = new VisionAgent(apiKey);
    
    let fileToProcess = selectedFile;
    if (selectedFile.presetUrl) {
      // For preset images, create a fake File object to pass
      fileToProcess = new File([new Blob()], selectedFile.name, { type: 'image/jpeg' });
      fileToProcess.presetLatitude = selectedFile.presetLatitude;
      fileToProcess.presetLongitude = selectedFile.presetLongitude;
    }

    // Capture logs via polling/callbacks in a simpler format
    const checkVisionInterval = setInterval(() => {
      setVisionState(prev => ({ ...prev, logs: visionAgent.getLogs() }));
    }, 200);

    const visionResult = await visionAgent.run(fileToProcess);
    clearInterval(checkVisionInterval);
    setVisionState({ 
      status: visionResult.isValid ? 'completed' : 'failed', 
      logs: visionAgent.getLogs(),
      result: visionResult 
    });

    if (!visionResult.isValid) {
      setPipelineStep(5); // Rejected
      setFinalStatus(`Rejected: ${visionResult.reason}`);
      return;
    }

    // Delay 1.5 seconds for visual pacing
    await new Promise(resolve => setTimeout(resolve, 1500));

    // --- AGENT 2: Geo-Spatial & Routing Agent ---
    setPipelineStep(2);
    setRoutingState({ status: 'running', logs: 'Initializing Geo-Spatial & Routing Agent...', result: null });
    const routingAgent = new RoutingAgent();

    const checkRoutingInterval = setInterval(() => {
      setRoutingState(prev => ({ ...prev, logs: routingAgent.getLogs() }));
    }, 200);

    const routingResult = await routingAgent.run(visionResult);
    clearInterval(checkRoutingInterval);
    setRoutingState({ 
      status: 'completed', 
      logs: routingAgent.getLogs(),
      result: routingResult 
    });

    // Delay 1.5 seconds for pacing
    await new Promise(resolve => setTimeout(resolve, 1500));

    // --- AGENT 3: Firebase & Dispatch Agent ---
    setPipelineStep(3);
    setFirebaseState({ status: 'running', logs: 'Initializing Firebase & Dispatch Agent...', result: null });
    const firebaseAgent = new FirebaseAgent();

    const checkFirebaseInterval = setInterval(() => {
      setFirebaseState(prev => ({ ...prev, logs: firebaseAgent.getLogs() }));
    }, 200);

    // If preset, use preset URL, else default to preview
    const dbImageUrl = selectedFile.presetUrl || previewUrl;
    const firebaseResult = await firebaseAgent.run(routingResult, dbImageUrl);
    clearInterval(checkFirebaseInterval);
    setFirebaseState({ 
      status: 'completed', 
      logs: firebaseAgent.getLogs(),
      result: firebaseResult 
    });

    // Finished
    setPipelineStep(4);
    if (firebaseResult.actionTaken === 'UPVOTED_DUPLICATE') {
      setFinalStatus(`INCIDENT RE-SUBMITTED: Duplicate found. Added upvote to ticket ${firebaseResult.ticketId}.`);
    } else {
      setFinalStatus(`SUCCESS: Incident logged as new ticket ${firebaseResult.ticketId}. Dispatched Sector Response.`);
    }
  };

  return (
    <div className="grid-two-cols">
      {/* Upload Column */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', fontWeight: '700' }}>📤 File Submission</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Upload drone surveillance photos or geo-tagged citizen images to verify, catalog, and alert municipal crews.
          </p>
        </div>

        {/* Preset quick test buttons */}
        <div>
          <span className="form-label" style={{ marginBottom: '0.75rem' }}>Try Preset Scenarios</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {PRESET_MOCKS.map((preset, index) => (
              <button 
                key={index} 
                className="btn-secondary" 
                style={{ fontSize: '0.8rem', padding: '0.5rem', justifyContent: 'flex-start' }}
                onClick={() => loadPreset(preset)}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* Drag & Drop Box */}
        <div 
          className={`upload-zone ${isDragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            accept="image/*"
            onChange={handleFileChange}
          />
          {previewUrl ? (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <img src={previewUrl} className="upload-preview" alt="Preview" />
              <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '600' }}>
                📁 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </span>
            </div>
          ) : (
            <>
              <div className="upload-icon">📷</div>
              <div>
                <p style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Drag & Drop Image or Click to Browse</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Supports GPS tags automatically</p>
              </div>
            </>
          )}
        </div>

        <button 
          className="btn-primary" 
          disabled={!selectedFile || pipelineStep > 0 && pipelineStep < 4}
          style={{ width: '100%' }}
          onClick={launchPipeline}
        >
          {pipelineActive && pipelineStep < 4 ? (
            <>
              <span className="pulse-indicator" style={{ marginRight: '0.5rem' }}></span>
              Orchestrating Multi-Agent Pipeline...
            </>
          ) : '🚀 Launch Sentinel Scan'}
        </button>

        {selectedFile && pipelineStep === 0 && (
          <button className="btn-secondary" style={{ width: '100%' }} onClick={resetPipeline}>
            Clear Selection
          </button>
        )}
      </div>

      {/* Multi-Agent Live Execution Status Column */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="pipeline-header">
          <div className="pipeline-title">
            🧬 Sequential Multi-Agent Flow
          </div>
          <span className={`pipeline-status ${
            pipelineStep === 0 ? 'badge-status pending' : 
            pipelineStep === 4 ? 'badge-status resolved' : 
            pipelineStep === 5 ? 'badge-status critical' : 'badge-status dispatched'
          }`}>
            {pipelineStep === 0 && 'Awaiting Input'}
            {pipelineStep === 1 && 'Agent 1 Running'}
            {pipelineStep === 2 && 'Agent 2 Running'}
            {pipelineStep === 3 && 'Agent 3 Running'}
            {pipelineStep === 4 && 'Complete'}
            {pipelineStep === 5 && 'Rejected'}
          </span>
        </div>

        {/* Visual Pipeline Stack */}
        <div className="agent-pipeline">
          {/* Agent 1 Node */}
          <div className={`agent-node ${
            pipelineStep === 1 ? 'active' : 
            pipelineStep > 1 && pipelineStep !== 5 ? 'completed' : 
            pipelineStep === 5 && visionState.status === 'failed' ? 'failed' : ''
          }`}>
            <div className="agent-avatar">🔍</div>
            <div className="agent-info">
              <div className="agent-name">
                Agent 1: Vision & Inspection
                {visionState.status === 'running' && <span className="pulse-indicator"></span>}
                {visionState.status === 'completed' && <span style={{ color: 'var(--color-resolved)' }}>✓</span>}
                {visionState.status === 'failed' && <span style={{ color: 'var(--color-critical)' }}>✕</span>}
              </div>
              <div className="agent-role">Visual verification & GPS parsing</div>
              
              {(pipelineActive || visionState.logs) && (
                <pre className="agent-log">{visionState.logs || 'Initializing...'}</pre>
              )}
            </div>
          </div>

          {/* Agent 2 Node */}
          <div className={`agent-node ${
            pipelineStep === 2 ? 'active' : 
            pipelineStep > 2 && pipelineStep !== 5 ? 'completed' : ''
          }`}>
            <div className="agent-avatar">📍</div>
            <div className="agent-info">
              <div className="agent-name">
                Agent 2: Geo-Spatial & Routing
                {routingState.status === 'running' && <span className="pulse-indicator"></span>}
                {routingState.status === 'completed' && <span style={{ color: 'var(--color-resolved)' }}>✓</span>}
              </div>
              <div className="agent-role">Sectors, tide risk & dynamic priority</div>
              
              {pipelineStep >= 2 && (
                <pre className="agent-log">{routingState.logs || 'Awaiting Vision Agent verification...'}</pre>
              )}
            </div>
          </div>

          {/* Agent 3 Node */}
          <div className={`agent-node ${
            pipelineStep === 3 ? 'active' : 
            pipelineStep > 3 && pipelineStep !== 5 ? 'completed' : ''
          }`}>
            <div className="agent-avatar">💾</div>
            <div className="agent-info">
              <div className="agent-name">
                Agent 3: Firebase & Dispatch Coordinator
                {firebaseState.status === 'running' && <span className="pulse-indicator"></span>}
                {firebaseState.status === 'completed' && <span style={{ color: 'var(--color-resolved)' }}>✓</span>}
              </div>
              <div className="agent-role">Deduplication & database commit</div>
              
              {pipelineStep >= 3 && (
                <pre className="agent-log">{firebaseState.logs || 'Awaiting Routing metrics...'}</pre>
              )}
            </div>
          </div>
        </div>

        {/* Success / Rejection Final Banner */}
        {pipelineStep >= 4 && (
          <div className={`glass-panel`} style={{ 
            borderColor: pipelineStep === 4 ? 'var(--color-resolved)' : 'var(--color-critical)',
            background: pipelineStep === 4 ? 'rgba(46, 204, 113, 0.05)' : 'rgba(255, 56, 56, 0.05)',
            textAlign: 'center',
            padding: '1.25rem',
            animation: 'float 4s ease-in-out infinite'
          }}>
            <h3 style={{ 
              color: pipelineStep === 4 ? 'var(--color-resolved)' : 'var(--color-critical)', 
              fontSize: '1.1rem', 
              fontWeight: '700',
              marginBottom: '0.25rem'
            }}>
              {pipelineStep === 4 ? '🛡️ Pipeline Complete' : '⚠️ Pipeline Interrupted'}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
              {finalStatus}
            </p>
            {pipelineStep === 4 && (
              <button 
                className="btn-secondary" 
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem', marginTop: '0.75rem' }}
                onClick={resetPipeline}
              >
                File Another Report
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
