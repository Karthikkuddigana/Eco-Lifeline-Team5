import React, { useState, useEffect } from 'react';
import CitizenPortal from './components/CitizenPortal';
import GvmcDashboard from './components/GvmcDashboard';
import Settings from './components/Settings';

export default function App() {
  const [currentRoute, setCurrentRoute] = useState('LAUNCHER'); // LAUNCHER, CITIZEN, GVMC
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#/citizen') {
        setCurrentRoute('CITIZEN');
      } else if (hash === '#/gvmc') {
        setCurrentRoute('GVMC');
      } else {
        setCurrentRoute('LAUNCHER');
        if (hash !== '#/' && hash !== '') {
          window.location.hash = '#/';
        }
      }
    };

    // Check routing on load
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (route) => {
    if (route === 'CITIZEN') {
      window.location.hash = '#/citizen';
    } else if (route === 'GVMC') {
      window.location.hash = '#/gvmc';
    } else {
      window.location.hash = '#/';
    }
  };

  // Render Launcher Landing Hub
  if (currentRoute === 'LAUNCHER') {
    return (
      <div className="app-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'radial-gradient(circle at center, #0e1b35 0%, #060b19 100%)' }}>
        <div style={{ position: 'absolute', top: '1.5rem', right: '2rem' }}>
          <button className="btn-icon" onClick={() => setIsSettingsOpen(true)} title="Configure Sentinel Settings">
            ⚙️
          </button>
        </div>

        <div className="main-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2.5rem', textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '4.5rem', height: '4.5rem', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', borderRadius: '16px', display: 'flex', alignItems: 'center', justifycontent: 'center', justifyContent: 'center', fontSize: '2.25rem', boxShadow: '0 0 30px rgba(0, 242, 254, 0.3)' }}>
              🛡️
            </div>
            <h1 style={{ fontSize: '3rem', fontWeight: '800', letterSpacing: '-1px', background: 'linear-gradient(to right, #ffffff, #88c0ff, var(--primary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginTop: '1rem' }}>
              Eco-Lifeline Sentinel
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '650px', lineHeight: '1.6', margin: '0 auto' }}>
              Coastal Safety & Public Sanitation Multi-Agent Coordination Hub for RK Beach and Yarada Beach, Visakhapatnam.
            </p>
          </div>

          <div className="grid-two-cols" style={{ width: '100%', maxWidth: '1000px', gap: '2rem' }}>
            
            {/* Citizen Portal Access Card */}
            <div className="glass-panel interactive" style={{ padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left', cursor: 'pointer' }} onClick={() => navigateTo('CITIZEN')}>
              <div style={{ fontSize: '2.5rem' }}>📢</div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: '700' }}>Citizen Reporting Portal</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5', flex: 1 }}>
                Public platform to report beach debris, plastic pollution, and hazardous rip wave conditions. Upload drone pictures or phone snapshots to trigger immediate municipal response.
              </p>
              <button className="btn-primary" style={{ marginTop: '1rem', alignSelf: 'flex-start' }}>
                Access Reporting Tool →
              </button>
            </div>

            {/* GVMC Dashboard Access Card */}
            <div className="glass-panel interactive" style={{ padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left', cursor: 'pointer' }} onClick={() => navigateTo('GVMC')}>
              <div style={{ fontSize: '2.5rem' }}>🏢</div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: '700' }}>GVMC Response Command</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5', flex: 1 }}>
                Internal administration console for GVMC officers. Track live incident coordinate maps, monitor real-time multi-agent log audit lines, and deploy sanitation response teams.
              </p>
              <button className="btn-primary" style={{ marginTop: '1rem', alignSelf: 'flex-start', background: 'linear-gradient(135deg, var(--secondary), #7f00ff)', boxShadow: '0 4px 15px rgba(79, 172, 254, 0.25)' }}>
                Open Command Center →
              </button>
            </div>

          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2rem' }}>
            Greater Visakhapatnam Municipal Corporation (GVMC) Coastal Safety Initiative • Powered by Multi-Agent AI
          </div>
        </div>

        <Settings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      </div>
    );
  }

  // Render Citizen or GVMC page (Separate Header without tabs)
  return (
    <div className="app-container">
      {/* Portal Independent Header */}
      <header>
        <div className="logo-container" style={{ cursor: 'pointer' }} onClick={() => navigateTo('LAUNCHER')}>
          <div className="logo-icon">{currentRoute === 'CITIZEN' ? '📢' : '🏢'}</div>
          <div>
            <h1 className="logo-text">
              {currentRoute === 'CITIZEN' ? 'Citizen Portal' : 'GVMC Command'}
            </h1>
            <div className="logo-tagline">Eco-Lifeline Sentinel</div>
          </div>
        </div>

        {/* Back and Configuration Actions */}
        <div className="header-actions">
          <button 
            className="btn-secondary" 
            style={{ fontSize: '0.85rem', padding: '0.45rem 1rem' }}
            onClick={() => navigateTo('LAUNCHER')}
          >
            🏠 Exit to Hub
          </button>
          <button 
            className="btn-icon" 
            onClick={() => setIsSettingsOpen(true)}
            title="Configure System Keys"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* View Injection */}
      <main className="main-content">
        {currentRoute === 'CITIZEN' ? <CitizenPortal /> : <GvmcDashboard />}
      </main>

      <Settings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
