// Helper to resolve absolute URLs when fetch is called inside the Node.js backend
const getBaseUrl = () => {
  if (typeof window === 'undefined') {
    // In Node.js backend
    return `http://localhost:${process.env.PORT || 5000}`;
  }
  return ''; // In browser
};

class DBService {
  constructor() {
    this.listeners = [];
    this.intervalId = null;
  }

  // Get UI settings (stored locally for layout states only)
  getSettings() {
    try {
      const settings = localStorage.getItem(SETTINGS_KEY);
      return settings ? JSON.parse(settings) : {
        useFirebase: false,
        firebaseConfig: {
          apiKey: '',
          authDomain: '',
          projectId: '',
          storageBucket: '',
          messagingSenderId: '',
          appId: ''
        }
      };
    } catch {
      return { useFirebase: false };
    }
  }

  saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    // Settings can be extended to backend configuration if needed
  }

  // Save new ticket via backend API
  async saveTicket(ticket) {
    try {
      const res = await fetch(getBaseUrl() + '/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ticket)
      });
      if (!res.ok) throw new Error('Failed to save ticket on backend.');
      return await res.json();
    } catch (e) {
      console.error('Error saving ticket:', e);
      throw e;
    }
  }

  // Update existing ticket via backend API
  async updateTicket(id, updates) {
    try {
      const res = await fetch(getBaseUrl() + `/api/tickets/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      });
      return res.ok;
    } catch (e) {
      console.error(`Error updating ticket ${id}:`, e);
      return false;
    }
  }

  // Fetch tickets list from backend
  async getTickets() {
    try {
      const res = await fetch(getBaseUrl() + '/api/tickets');
      if (!res.ok) throw new Error('Failed to retrieve tickets.');
      return await res.json();
    } catch (e) {
      console.error('Error fetching tickets:', e);
      return [];
    }
  }

  // Real-time listener using HTTP Polling (every 3 seconds)
  subscribeTickets(onUpdate) {
    const poll = async () => {
      const tickets = await this.getTickets();
      onUpdate(tickets);
    };

    poll(); // Initial load
    const interval = setInterval(poll, 3000);

    return () => {
      clearInterval(interval);
    };
  }

  // Helper for duplicate analysis (queries backend tickets)
  async getRecentPendingTickets(hours = 3) {
    const tickets = await this.getTickets();
    const cutoff = Date.now() - (hours * 3600000);
    return tickets.filter(t => t.status === 'PENDING' && t.timestamp >= cutoff);
  }
}

export const dbService = new DBService();
