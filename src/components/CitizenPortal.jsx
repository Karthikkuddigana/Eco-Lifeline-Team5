import React, { useState, useRef } from 'react';
import { VisionAgent } from '../agents/VisionAgent';
import { RoutingAgent } from '../agents/RoutingAgent';
import { FirebaseAgent } from '../agents/FirebaseAgent';
import { dbService } from '../services/firebase';



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



  // Run the multi-agent pipeline sequential workflow
  const launchPipeline = async () => {
    if (!selectedFile) return;

    setPipelineActive(true);
    setPipelineStep(1);
    
    // --- SECURE BACKEND AGENTS PIPELINE EXECUTION ---
    setVisionState({ status: 'running', logs: 'Connecting to secure Sentinel backend...', result: null });
    
    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      const response = await fetch('/api/report', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Server returned error ${response.status}: ${response.statusText}`);
      }

      const res = await response.json();

      if (!res.isValid) {
        setVisionState({ 
          status: 'failed', 
          logs: res.logs || 'Image analysis failed verification.', 
          result: null 
        });
        setPipelineStep(5);
        setFinalStatus(`Rejected: ${res.reason}`);
        return;
      }

      // Parse merged logs back into separate agent states
      const logSections = res.logs.split('=== Agent ');
      let visionLogs = 'Running on backend...';
      let routingLogs = 'Awaiting activation...';
      let firebaseLogs = 'Awaiting activation...';

      logSections.forEach(section => {
        if (section.startsWith('1: Vision')) {
          visionLogs = '=== Agent ' + section.trim();
        } else if (section.startsWith('2: Geo-Spatial')) {
          routingLogs = '=== Agent ' + section.trim();
        } else if (section.startsWith('3: Firebase')) {
          firebaseLogs = '=== Agent ' + section.trim();
        }
      });

      // Animate the stepping sequence for premium UX
      setVisionState({ status: 'running', logs: 'Extracting metadata on backend...', result: null });
      await new Promise(resolve => setTimeout(resolve, 1000));
      setVisionState({ status: 'completed', logs: visionLogs, result: res });

      setPipelineStep(2);
      setRoutingState({ status: 'running', logs: 'Calculating geofences & priorities...', result: null });
      await new Promise(resolve => setTimeout(resolve, 1200));
      setRoutingState({ status: 'completed', logs: routingLogs, result: res });

      setPipelineStep(3);
      setFirebaseState({ status: 'running', logs: 'Auditing replication constraints...', result: null });
      await new Promise(resolve => setTimeout(resolve, 1200));
      setFirebaseState({ status: 'completed', logs: firebaseLogs, result: res });

      // Finished
      setPipelineStep(4);
      if (res.actionTaken === 'UPVOTED_DUPLICATE') {
        setFinalStatus(`INCIDENT RE-SUBMITTED: Duplicate found. Added upvote to ticket ${res.ticketId}.`);
      } else {
        setFinalStatus(`SUCCESS: Incident logged as new ticket ${res.ticketId}. Dispatched Sector Response.`);
      }

    } catch (e) {
      console.error(e);
      setVisionState({ status: 'failed', logs: `Backend connection failure: ${e.message}`, result: null });
      setPipelineStep(5);
      setFinalStatus('Error: Failed to communicate with Sentinel backend.');
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
            {pipelineStep === 4 && firebaseState.result && firebaseState.result.ticket && (
              <div style={{ marginTop: '0.75rem', marginBottom: '0.25rem' }}>
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${firebaseState.result.ticket.latitude},${firebaseState.result.ticket.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--primary)', textDecoration: 'underline', fontSize: '0.85rem', fontWeight: '600' }}
                >
                  🗺️ View Submitted Location on Google Maps
                </a>
              </div>
            )}
            {pipelineStep === 4 && (
              <button 
                className="btn-secondary" 
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem', marginTop: '0.5rem' }}
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
