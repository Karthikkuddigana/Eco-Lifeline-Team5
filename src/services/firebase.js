import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  doc, 
  query, 
  where, 
  onSnapshot,
  orderBy
} from 'firebase/firestore';

// Keys for local storage config
const SETTINGS_KEY = 'eco_lifeline_settings';
const TICKETS_KEY = 'eco_lifeline_local_tickets';

// Default mock tickets to seed the database if it is empty
const MOCK_SEEDS = [
  {
    id: 'GVMC-1001',
    image: 'https://images.unsplash.com/photo-1618477388954-7852f32655ec?auto=format&fit=crop&w=600&q=80',
    hazard: 'Scattered plastic trash and discarded nets near the tide line.',
    hazardType: 'plastic_debris',
    latitude: 17.7144,
    longitude: 83.3235,
    locationName: 'Kali Temple, RK Beach',
    landmark: 'RK Beach near Kali Temple',
    zone: 'Zone 2',
    priority: 'HIGH',
    status: 'PENDING',
    upvotes: 1,
    timestamp: Date.now() - 3600000 * 2, // 2 hours ago
    logs: 'Vision Agent: Verified location as RK Beach. Identified plastic hazard.\nRouting Agent: Categorized as HIGH priority. Assigned to Zone 2 office.\nFirebase Agent: Checked for duplicates. No duplicates. Committed new ticket GVMC-1001.'
  },
  {
    id: 'GVMC-1002',
    image: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=600&q=80',
    hazard: 'Shattered glass bottles and medical syringes on beach pathway.',
    hazardType: 'medical_waste',
    latitude: 17.6835,
    longitude: 83.3002,
    locationName: 'Yarada Beach Shoreline',
    landmark: 'Yarada Beach shoreline',
    zone: 'Zone 3',
    priority: 'CRITICAL',
    status: 'DISPATCHED',
    upvotes: 3,
    timestamp: Date.now() - 3600000 * 4, // 4 hours ago
    logs: 'Vision Agent: Verified location as Yarada Beach. Identified medical waste / glass.\nRouting Agent: Hazardous waste near shoreline. Escalated to CRITICAL.\nFirebase Agent: Dispatch alert triggered. Logged incident.'
  }
];

class DBService {
  constructor() {
    this.app = null;
    this.db = null;
    this.isMock = true;
    this.listeners = [];
    
    // Load config from settings
    this.init();
  }

  init() {
    try {
      const settingsStr = localStorage.getItem(SETTINGS_KEY);
      if (settingsStr) {
        const settings = JSON.parse(settingsStr);
        if (settings.useFirebase && settings.firebaseConfig) {
          const config = settings.firebaseConfig;
          // Simple validation of config fields
          if (config.apiKey && config.projectId && config.appId) {
            // Check if app already initialized
            const apps = getApps();
            if (apps.length === 0) {
              this.app = initializeApp(config);
            } else {
              this.app = apps[0];
            }
            this.db = getFirestore(this.app);
            this.isMock = false;
            console.log('Firebase DB Initialized successfully!');
            return;
          }
        }
      }
    } catch (e) {
      console.error('Failed to initialize Firebase SDK, falling back to LocalStorage', e);
    }
    
    // Fallback settings
    this.app = null;
    this.db = null;
    this.isMock = true;
    console.log('Using LocalStorage database fallback.');

    // Seed mock database if empty
    if (!localStorage.getItem(TICKETS_KEY)) {
      localStorage.setItem(TICKETS_KEY, JSON.stringify(MOCK_SEEDS));
    }
  }

  // Reload settings & re-initialize
  reloadConfig() {
    // Clean up active Firebase connections or subscriptions if necessary
    this.listeners = [];
    this.init();
  }

  // Get Settings
  getSettings() {
    try {
      const settings = localStorage.getItem(SETTINGS_KEY);
      return settings ? JSON.parse(settings) : {
        geminiApiKey: '',
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
      return { geminiApiKey: '', useFirebase: false };
    }
  }

  // Save Settings
  saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    this.reloadConfig();
  }

  // Save a new ticket
  async saveTicket(ticket) {
    if (!this.isMock && this.db) {
      try {
        const docRef = await addDoc(collection(this.db, 'tickets'), ticket);
        return { ...ticket, id: docRef.id };
      } catch (e) {
        console.error('Firebase save failed, saving to local fallback', e);
      }
    }

    // Local Storage Mock
    const tickets = this.getLocalTickets();
    const newTicket = {
      ...ticket,
      id: `GVMC-${Math.floor(1000 + Math.random() * 9000)}`
    };
    tickets.unshift(newTicket);
    this.saveLocalTickets(tickets);
    this.notifyListeners();
    return newTicket;
  }

  // Update existing ticket
  async updateTicket(id, updates) {
    if (!this.isMock && this.db) {
      try {
        const docRef = doc(this.db, 'tickets', id);
        await updateDoc(docRef, updates);
        return true;
      } catch (e) {
        console.error('Firebase update failed, updating local fallback', e);
      }
    }

    // Local Storage Mock
    const tickets = this.getLocalTickets();
    const index = tickets.findIndex(t => t.id === id);
    if (index !== -1) {
      tickets[index] = { ...tickets[index], ...updates };
      this.saveLocalTickets(tickets);
      this.notifyListeners();
      return true;
    }
    return false;
  }

  // Query tickets matching nearby coordinates
  async getTickets() {
    if (!this.isMock && this.db) {
      try {
        const q = query(collection(this.db, 'tickets'), orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q);
        const list = [];
        querySnapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        return list;
      } catch (e) {
        console.error('Firebase getTickets failed, using local', e);
      }
    }

    return this.getLocalTickets();
  }

  // Real-time listener
  subscribeTickets(onUpdate) {
    if (!this.isMock && this.db) {
      try {
        const q = query(collection(this.db, 'tickets'));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
          const list = [];
          querySnapshot.forEach((doc) => {
            list.push({ id: doc.id, ...doc.data() });
          });
          // Sort by timestamp desc in JS because composite query indexing might be missing
          list.sort((a, b) => b.timestamp - a.timestamp);
          onUpdate(list);
        });
        return unsubscribe;
      } catch (e) {
        console.error('Firebase subscribe failed, subscribing to local', e);
      }
    }

    // Local Storage subscription
    this.listeners.push(onUpdate);
    onUpdate(this.getLocalTickets());
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== onUpdate);
    };
  }

  // Query PENDING tickets in the last X hours
  async getRecentPendingTickets(hours = 3) {
    const cutoff = Date.now() - (hours * 3600000);
    
    if (!this.isMock && this.db) {
      try {
        const q = query(
          collection(this.db, 'tickets'), 
          where('status', '==', 'PENDING'),
          where('timestamp', '>=', cutoff)
        );
        const querySnapshot = await getDocs(q);
        const list = [];
        querySnapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        return list;
      } catch (e) {
        console.error('Firebase getRecentPendingTickets failed, fallback to local', e);
      }
    }

    // Local Storage Mock
    return this.getLocalTickets().filter(t => t.status === 'PENDING' && t.timestamp >= cutoff);
  }

  // Helpers for LocalStorage
  getLocalTickets() {
    try {
      const ticketsStr = localStorage.getItem(TICKETS_KEY);
      return ticketsStr ? JSON.parse(ticketsStr) : [];
    } catch {
      return [];
    }
  }

  saveLocalTickets(tickets) {
    localStorage.setItem(TICKETS_KEY, JSON.stringify(tickets));
  }

  notifyListeners() {
    const tickets = this.getLocalTickets();
    this.listeners.forEach(listener => {
      try {
        listener(tickets);
      } catch (e) {
        console.error(e);
      }
    });
  }
}

export const dbService = new DBService();
