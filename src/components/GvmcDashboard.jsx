import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { dbService } from '../services/firebase';

export default function GvmcDashboard() {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [filter, setFilter] = useState('ALL'); // ALL, CRITICAL, PENDING, DISPATCHED, RESOLVED

  const mapContainerRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef({});

  // Real-time Database subscription
  useEffect(() => {
    const unsubscribe = dbService.subscribeTickets((updatedTickets) => {
      setTickets(updatedTickets);
    });
    return () => unsubscribe();
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Centered around RK Beach Visakhapatnam area
    mapInstance.current = L.map(mapContainerRef.current, {
      center: [17.7160, 83.3250],
      zoom: 13,
      zoomControl: true
    });

    // Dark-themed tile layer (CartoDB Positron Dark)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(mapInstance.current);

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Sync Markers with Filtered Tickets
  useEffect(() => {
    if (!mapInstance.current) return;

    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => {
      mapInstance.current.removeLayer(marker);
    });
    markersRef.current = {};

    const filteredTickets = getFilteredTickets();

    filteredTickets.forEach(ticket => {
      const { id, latitude, longitude, priority, locationName, landmark, hazard } = ticket;
      
      // Marker color coding
      let color = '#2ecc71'; // Low
      if (priority === 'CRITICAL') color = '#ff3838';
      else if (priority === 'HIGH') color = '#ff9f1a';
      else if (priority === 'MEDIUM') color = '#ffe066';

      const customIcon = L.divIcon({
        className: `marker-${id}`,
        html: `<div style="
          width: 18px; 
          height: 18px; 
          background-color: ${color}; 
          border: 2px solid #ffffff; 
          border-radius: 50%; 
          box-shadow: 0 0 10px ${color}, 0 0 20px ${color};
          cursor: pointer;
        "></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });

      const marker = L.marker([latitude, longitude], { icon: customIcon })
        .addTo(mapInstance.current)
        .bindPopup(`
          <div style="color: #000; font-family: sans-serif; font-size: 13px; max-width: 220px;">
            <strong style="color: #0c1830;">${id} - ${priority}</strong><br/>
            <span style="font-size: 12px; font-weight: 600; color: #111;">📍 ${locationName || landmark}</span><br/>
            ${locationName && locationName !== landmark ? `<span style="font-size: 10px; color: #666;">Visual: ${landmark}</span><br/>` : ''}
            <p style="margin: 5px 0 0 0; font-weight: 500;">${hazard.substring(0, 50)}...</p>
          </div>
        `);
      
      marker.on('click', () => {
        setSelectedTicket(ticket);
      });

      markersRef.current[id] = marker;
    });

    // Auto fit bounds if markers exist
    if (filteredTickets.length > 0) {
      const coords = filteredTickets.map(t => [t.latitude, t.longitude]);
      try {
        const bounds = L.latLngBounds(coords);
        mapInstance.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      } catch (e) {
        console.error("Failed to fit bounds", e);
      }
    }
  }, [tickets, filter]);

  const getFilteredTickets = () => {
    return tickets.filter(ticket => {
      if (filter === 'ALL') return true;
      if (filter === 'CRITICAL') return ticket.priority === 'CRITICAL' || ticket.priority === 'HIGH';
      return ticket.status === filter;
    });
  };

  const handleTicketClick = (ticket) => {
    setSelectedTicket(ticket);
    if (mapInstance.current) {
      mapInstance.current.setView([ticket.latitude, ticket.longitude], 15);
      if (markersRef.current[ticket.id]) {
        markersRef.current[ticket.id].openPopup();
      }
    }
  };

  const updateStatus = async (id, newStatus) => {
    let logsUpdate = '';
    const dateStr = new Date().toLocaleTimeString();

    if (newStatus === 'DISPATCHED') {
      logsUpdate = `\n\n[GVMC Dispatch - ${dateStr}]: Crew has been dispatched. Transit estimation: 15 mins.`;
    } else if (newStatus === 'RESOLVED') {
      logsUpdate = `\n\n[GVMC Dispatch - ${dateStr}]: Sanitation operations complete. Hazard mitigated. Ticket marked as RESOLVED.`;
    }

    const currentTicket = tickets.find(t => t.id === id);
    const updatedLogs = currentTicket ? (currentTicket.logs + logsUpdate) : '';

    await dbService.updateTicket(id, { 
      status: newStatus,
      logs: updatedLogs
    });
    
    // Update local modal state
    setSelectedTicket(prev => prev && prev.id === id ? { ...prev, status: newStatus, logs: updatedLogs } : prev);
  };

  // Stats Counters
  const totalCount = tickets.length;
  const criticalCount = tickets.filter(t => t.priority === 'CRITICAL' || t.priority === 'HIGH').length;
  const resolvedCount = tickets.filter(t => t.status === 'RESOLVED').length;
  const pendingCount = tickets.filter(t => t.status === 'PENDING' || t.status === 'DISPATCHED').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Stats Widgets */}
      <div className="stats-container">
        <div className="stat-widget">
          <span className="stat-val" style={{ color: '#ffffff' }}>{totalCount}</span>
          <span className="stat-label">Total Reports</span>
        </div>
        <div className="stat-widget" style={{ borderColor: 'rgba(255, 56, 56, 0.2)', background: 'rgba(255, 56, 56, 0.02)' }}>
          <span className="stat-val" style={{ color: 'var(--color-critical)' }}>{criticalCount}</span>
          <span className="stat-label">Urgent Hazards</span>
        </div>
        <div className="stat-widget" style={{ borderColor: 'rgba(52, 152, 219, 0.2)', background: 'rgba(52, 152, 219, 0.02)' }}>
          <span className="stat-val" style={{ color: 'var(--color-dispatched)' }}>{pendingCount}</span>
          <span className="stat-label">Active Dispatches</span>
        </div>
        <div className="stat-widget" style={{ borderColor: 'rgba(46, 204, 113, 0.2)', background: 'rgba(46, 204, 113, 0.02)' }}>
          <span className="stat-val" style={{ color: 'var(--color-resolved)' }}>{resolvedCount}</span>
          <span className="stat-label">Resolved cases</span>
        </div>
      </div>

      <div className="grid-two-cols">
        {/* Incident List Column */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem', fontWeight: '700' }}>📋 Incidents Directory</h2>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Live updates from the Field</span>
          </div>

          {/* Filter Bar */}
          <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            {['ALL', 'CRITICAL', 'PENDING', 'DISPATCHED', 'RESOLVED'].map(tab => (
              <button 
                key={tab} 
                className={`nav-tab ${filter === tab ? 'active' : ''}`}
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', whiteSpace: 'nowrap' }}
                onClick={() => setFilter(tab)}
              >
                {tab === 'CRITICAL' ? '🔥 Critical / High' : tab}
              </button>
            ))}
          </div>

          {/* Incident Tickets list */}
          <div className="ticket-list">
            {getFilteredTickets().length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                📭 No incidents match this filter.
              </div>
            ) : (
              getFilteredTickets().map(ticket => (
                <div 
                  key={ticket.id} 
                  className={`ticket-card ${selectedTicket && selectedTicket.id === ticket.id ? 'selected' : ''}`}
                  onClick={() => handleTicketClick(ticket)}
                >
                  <img src={ticket.image} className="ticket-thumb" alt="incident" />
                  <div className="ticket-details">
                    <div className="ticket-meta">
                      <span className="ticket-id">{ticket.id}</span>
                      <div className="ticket-tags">
                        {ticket.upvotes > 1 && (
                          <span className="ticket-votes">🔥 {ticket.upvotes} reports</span>
                        )}
                        <span className={`badge-priority ${ticket.priority.toLowerCase()}`}>
                          {ticket.priority}
                        </span>
                      </div>
                    </div>
                    <div className="ticket-location" style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                      📍 {ticket.locationName || ticket.landmark}
                    </div>
                    {ticket.locationName && ticket.locationName !== ticket.landmark && (
                      <div className="ticket-location" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '-4px', marginBottom: '4px' }}>
                        Visual: {ticket.landmark}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="gvmc-badge-sec">{ticket.zone}</span>
                      <span className={`badge-status ${ticket.status.toLowerCase()}`}>
                        {ticket.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Map Column */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem', fontWeight: '700' }}>🗺️ GIS Incident Mapping</h2>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Visual telemetry & dispatch zones</span>
          </div>

          <div className="map-container" ref={mapContainerRef}></div>
        </div>
      </div>

      {/* Ticket Action Dialog Modal */}
      {selectedTicket && (
        <div className="settings-backdrop" style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSelectedTicket(null)}>
          <div className="glass-panel" style={{ 
            width: '90%', 
            maxWidth: '800px', 
            maxHeight: '90vh', 
            overflowY: 'auto', 
            background: 'var(--bg-deep)', 
            border: '1px solid var(--border-active)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.8)'
          }} onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '700', textTransform: 'uppercase' }}>
                  {selectedTicket.zone} Dispatch File
                </span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#fff' }}>Case Ref: {selectedTicket.id}</h3>
              </div>
              <button className="btn-icon" onClick={() => setSelectedTicket(null)}>✕</button>
            </div>

            <hr style={{ border: '0', borderTop: '1px solid var(--border-light)', marginBottom: '1.25rem' }} />

            {/* Modal Content */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              {/* Image & Detail */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <img src={selectedTicket.image} style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--border-light)', maxHeight: '250px', objectFit: 'cover' }} alt="Incident File" />
                
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span className={`badge-priority ${selectedTicket.priority.toLowerCase()}`} style={{ padding: '0.25rem 0.6rem' }}>
                    Priority: {selectedTicket.priority}
                  </span>
                  <span className={`badge-status ${selectedTicket.status.toLowerCase()}`} style={{ padding: '0.25rem 0.6rem' }}>
                    Status: {selectedTicket.status}
                  </span>
                  <span className="badge-status pending" style={{ padding: '0.25rem 0.6rem', color: '#fff', background: 'rgba(255,255,255,0.05)' }}>
                    Reports: {selectedTicket.upvotes}
                  </span>
                </div>

                <div>
                  <span className="form-label">Resolved Location</span>
                  <p style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--primary)' }}>📍 {selectedTicket.locationName || selectedTicket.landmark}</p>
                  {selectedTicket.locationName && selectedTicket.locationName !== selectedTicket.landmark && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Visual Landmark: {selectedTicket.landmark}
                    </p>
                  )}
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Coordinates: {selectedTicket.latitude.toFixed(5)}° N, {selectedTicket.longitude.toFixed(5)}° E ({selectedTicket.locationSource || 'Estimated'})
                  </p>
                </div>

                <div>
                  <span className="form-label">Debris/Hazard Description</span>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{selectedTicket.hazard}</p>
                </div>

                <div>
                  <span className="form-label">Dispatch Office</span>
                  <p style={{ fontSize: '0.9rem', fontWeight: '500' }}>🏢 {selectedTicket.dispatchOffice}</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>📞 Hotline: {selectedTicket.contact}</p>
                </div>
              </div>

              {/* Agent Logs Log Box */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', height: '100%' }}>
                <span className="form-label">Multi-Agent Sentinel Logs</span>
                <pre style={{ 
                  flex: 1, 
                  fontFamily: 'var(--font-mono)', 
                  fontSize: '0.75rem', 
                  color: 'var(--text-secondary)', 
                  background: 'rgba(0,0,0,0.3)', 
                  padding: '1rem', 
                  borderRadius: '8px', 
                  border: '1px solid var(--border-light)', 
                  whiteSpace: 'pre-wrap',
                  maxHeight: '380px',
                  overflowY: 'auto'
                }}>
                  {selectedTicket.logs}
                </pre>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                  {selectedTicket.status === 'PENDING' && (
                    <button 
                      className="btn-primary" 
                      style={{ flex: 1, fontSize: '0.85rem' }} 
                      onClick={() => updateStatus(selectedTicket.id, 'DISPATCHED')}
                    >
                      🚒 Dispatch Crew
                    </button>
                  )}
                  {selectedTicket.status === 'DISPATCHED' && (
                    <button 
                      className="btn-primary" 
                      style={{ flex: 1, fontSize: '0.85rem', background: 'var(--color-resolved)', color: '#000', boxShadow: 'none' }} 
                      onClick={() => updateStatus(selectedTicket.id, 'RESOLVED')}
                    >
                      ✅ Mark as Resolved
                    </button>
                  )}
                  <button className="btn-secondary" style={{ flex: selectedTicket.status === 'RESOLVED' ? 1 : 0.5 }} onClick={() => setSelectedTicket(null)}>
                    Close
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
