import { useState, useEffect } from 'react';
import { dbService } from '../services/firebase';

export default function Settings({ isOpen, onClose }) {
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState('');
  const [useFirebase, setUseFirebase] = useState(false);
  const [firebaseConfig, setFirebaseConfig] = useState({
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  });
  
  const [saveStatus, setSaveStatus] = useState('');

  // Load configuration on open
  useEffect(() => {
    if (isOpen) {
      const settings = dbService.getSettings();
      setTimeout(() => {
        setGeminiApiKey(settings.geminiApiKey || '');
        setGoogleMapsApiKey(settings.googleMapsApiKey || '');
        setUseFirebase(settings.useFirebase || false);
        if (settings.firebaseConfig) {
          setFirebaseConfig(settings.firebaseConfig);
        }
      }, 0);
    }
  }, [isOpen]);

  const handleConfigChange = (field, value) => {
    setFirebaseConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    try {
      dbService.saveSettings({
        geminiApiKey,
        googleMapsApiKey,
        useFirebase,
        firebaseConfig
      });
      setSaveStatus('Settings saved and database reloaded!');
      setTimeout(() => {
        setSaveStatus('');
        onClose();
      }, 1500);
    } catch (e) {
      setSaveStatus(`Error saving: ${e.message}`);
    }
  };

  return (
    <>
      {isOpen && <div className="settings-backdrop" onClick={onClose} />}
      <div className={`settings-drawer ${isOpen ? 'open' : ''}`}>
        <div className="settings-header">
          <h2 className="settings-title">⚙️ Sentinel Configuration</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto', flex: 1, paddingRight: '0.25rem' }}>
          {/* Gemini API Key */}
          <div className="form-group">
            <label className="form-label">Gemini API Key</label>
            <input 
              type="password" 
              className="form-input" 
              placeholder="Enter AI Gemini Flash API Key" 
              value={geminiApiKey} 
              onChange={(e) => setGeminiApiKey(e.target.value)} 
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
              Used by the <b>Vision & Inspection Agent</b> to estimate coordinates, describe hazards, and identify landmarks.
            </p>
          </div>

          {/* Google Maps API Key */}
          <div className="form-group">
            <label className="form-label">Google Maps API Key</label>
            <input 
              type="password" 
              className="form-input" 
              placeholder="Enter Google Maps API Key" 
              value={googleMapsApiKey} 
              onChange={(e) => setGoogleMapsApiKey(e.target.value)} 
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
              Used by the <b>Geo-Spatial & Routing Agent</b> to fetch real-world addresses, nearby landmarks, and calculate road distances.
            </p>
          </div>

          <hr style={{ border: '0', borderTop: '1px solid var(--border-light)' }} />

          {/* Firebase Toggle */}
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input 
              type="checkbox" 
              id="useFirebaseCheck"
              style={{ width: '1.2rem', height: '1.2rem', accentColor: 'var(--primary)' }}
              checked={useFirebase} 
              onChange={(e) => setUseFirebase(e.target.checked)} 
            />
            <label htmlFor="useFirebaseCheck" style={{ fontWeight: '600', cursor: 'pointer' }}>
              Connect to Live Firebase Firestore
            </label>
          </div>

          {useFirebase && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <div className="form-group">
                <label className="form-label">API Key</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={firebaseConfig.apiKey} 
                  onChange={(e) => handleConfigChange('apiKey', e.target.value)} 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Project ID</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={firebaseConfig.projectId} 
                  onChange={(e) => handleConfigChange('projectId', e.target.value)} 
                />
              </div>
              <div className="form-group">
                <label className="form-label">App ID</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={firebaseConfig.appId} 
                  onChange={(e) => handleConfigChange('appId', e.target.value)} 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Auth Domain</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={firebaseConfig.authDomain} 
                  placeholder="e.g. project.firebaseapp.com"
                  onChange={(e) => handleConfigChange('authDomain', e.target.value)} 
                />
              </div>
            </div>
          )}

          {!useFirebase && (
            <div style={{ fontSize: '0.8rem', background: 'rgba(0, 242, 254, 0.05)', color: 'var(--text-secondary)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-active)' }}>
              ℹ️ App is running in <b>Local Offline Sandbox</b> mode. All reports are cached in the browser's <code>localStorage</code> database emulator. Duplicate checking, upvoting, and status updates work perfectly!
            </div>
          )}
        </div>

        {saveStatus && (
          <div style={{ fontSize: '0.85rem', color: 'var(--primary)', textAlign: 'center', fontWeight: '500' }}>
            {saveStatus}
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', marginTop: 'auto' }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn-primary" style={{ flex: 1 }} onClick={handleSave}>Save Config</button>
        </div>
      </div>
    </>
  );
}
