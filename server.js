import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import process from 'process';
import fs from 'fs';
import path from 'path';

// Import our agents
import { VisionAgent } from './src/agents/VisionAgent.js';
import { RoutingAgent } from './src/agents/RoutingAgent.js';
import { FirebaseAgent } from './src/agents/FirebaseAgent.js';

// Firebase SDK imports
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, query, orderBy } from 'firebase/firestore';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Setup Multer memory storage
const upload = multer({ storage: multer.memoryStorage() });

// File-based fallback database setup
const DATA_DIR = path.resolve('./data');
const TICKETS_FILE = path.join(DATA_DIR, 'tickets.json');

// Ensure database folders exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

if (!fs.existsSync(TICKETS_FILE)) {
  fs.writeFileSync(TICKETS_FILE, JSON.stringify([], null, 2));
}

// Database Helpers (Local JSON Fallback)
const readTickets = () => {
  try {
    const data = fs.readFileSync(TICKETS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
};

const writeTickets = (tickets) => {
  fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2));
};

// --- Firebase Firestore Initialization (Hybrid Mode) ---
let db = null;
let useFirestore = false;

let projectId = process.env.FIREBASE_PROJECT_ID;

// Auto-detect project ID from .firebaserc if not set in environment
if (!projectId) {
  try {
    const rcPath = path.resolve('./.firebaserc');
    if (fs.existsSync(rcPath)) {
      const rc = JSON.parse(fs.readFileSync(rcPath, 'utf-8'));
      if (rc.projects && rc.projects.default) {
        projectId = rc.projects.default;
        console.log(`ℹ️ Automatically detected Firebase Project ID from .firebaserc: "${projectId}"`);
      }
    }
  } catch {
    // Silent fail
  }
}

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: projectId,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

if (firebaseConfig.projectId) {
  try {
    // Connect using API key config if provided, otherwise fallback to project ID only
    const fApp = initializeApp(firebaseConfig.apiKey ? firebaseConfig : { projectId: firebaseConfig.projectId });
    db = getFirestore(fApp);
    useFirestore = true;
    console.log(`🔥 Firebase Firestore successfully connected (Project: ${firebaseConfig.projectId}).`);
  } catch (e) {
    console.error('⚠️ Failed to initialize Firebase Firestore. Using local database fallback.', e);
  }
} else {
  console.log('ℹ️ No Firebase credentials or .firebaserc detected in workspace. Falling back to local tickets.json.');
}

// --- Hybrid Database API Service Helpers ---

const getTicketsList = async () => {
  if (useFirestore) {
    try {
      const ticketsCol = collection(db, 'tickets');
      const q = query(ticketsCol, orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(docSnapshot => ({
        id: docSnapshot.id,
        ...docSnapshot.data()
      }));
    } catch (e) {
      console.error('Failed to query tickets from Firestore, falling back to local file:', e);
      return readTickets();
    }
  }
  return readTickets();
};

const createTicketInDb = async (ticketData) => {
  const timestamp = ticketData.timestamp || Date.now();
  if (useFirestore) {
    try {
      const ticketsCol = collection(db, 'tickets');
      const docRef = await addDoc(ticketsCol, {
        ...ticketData,
        timestamp
      });
      return { id: docRef.id, ...ticketData, timestamp };
    } catch (e) {
      console.error('Failed to write ticket to Firestore, falling back to local file:', e);
    }
  }
  // Local file fallback
  const tickets = readTickets();
  const newTicket = {
    ...ticketData,
    id: ticketData.id || `GVMC-${Math.floor(1000 + Math.random() * 9000)}`,
    timestamp
  };
  tickets.unshift(newTicket);
  writeTickets(tickets);
  return newTicket;
};

const updateTicketInDb = async (id, updates) => {
  if (useFirestore) {
    try {
      const ticketRef = doc(db, 'tickets', id);
      await updateDoc(ticketRef, updates);
      return true;
    } catch (e) {
      console.error(`Failed to update ticket ${id} in Firestore, falling back to local file:`, e);
    }
  }
  // Local file fallback
  const tickets = readTickets();
  const index = tickets.findIndex(t => t.id === id);
  if (index !== -1) {
    tickets[index] = { ...tickets[index], ...updates };
    writeTickets(tickets);
    return true;
  }
  return false;
};

// --- API Endpoints ---

// 1. Get all tickets
app.get('/api/tickets', async (req, res) => {
  try {
    const tickets = await getTicketsList();
    res.json(tickets);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2. Add / Update a ticket directly
app.post('/api/tickets', async (req, res) => {
  try {
    const newTicket = await createTicketInDb(req.body);
    res.status(201).json(newTicket);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 3. Patch ticket (status updates or upvotes)
app.patch('/api/tickets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await updateTicketInDb(id, req.body);
    if (success) {
      res.json({ id, ...req.body });
    } else {
      res.status(404).json({ error: 'Ticket not found' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 4. Secure multi-agent report pipeline trigger
app.post('/api/report', upload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No image file uploaded.' });
    }

    // Attach custom preset coordinates if forwarded by preset loader
    if (req.body.presetLatitude) {
      file.presetLatitude = parseFloat(req.body.presetLatitude);
      file.presetLongitude = parseFloat(req.body.presetLongitude);
    }

    console.log(`\n--- Incoming Incident Report Pipeline [${file.originalname}] ---`);

    // Step 1: Vision & Inspection Agent
    const visionAgent = new VisionAgent(GEMINI_API_KEY);
    const visionResult = await visionAgent.run(file);

    if (!visionResult.isValid) {
      console.log(`Pipeline Interrupted: ${visionResult.reason}`);
      return res.json({
        isValid: false,
        reason: visionResult.reason,
        logs: visionAgent.getLogs()
      });
    }

    // Step 2: Geo-Spatial & Routing Agent
    const routingAgent = new RoutingAgent();
    const routingResult = await routingAgent.run(visionResult);

    // Validate coordinates resolved by Routing Agent
    const lat = routingResult.latitude;
    const lng = routingResult.longitude;
    const isOutofBounds = lat === 0 || lng === 0 || lat < 17.0 || lat > 18.0 || lng < 83.0 || lng > 84.0;

    if (isOutofBounds) {
      console.log(`Pipeline Interrupted: Location is out of bounds or missing GPS coordinates. Resolved: (${lat}, ${lng}).`);
      return res.json({
        isValid: false,
        reason: "No valid GPS coordinates or Visakhapatnam beach landmarks could be resolved. Ticket dispatch aborted.",
        logs: [
          `=== Agent 1: Vision & Inspection ===\n${visionAgent.getLogs()}`,
          `=== Agent 2: Geo-Spatial & Routing ===\n${routingAgent.getLogs()}\n[Routing Agent] DECISION: Location is out-of-bounds of GVMC jurisdiction (${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E). Recommending rejection.`
        ].join('\n\n')
      });
    }

    // Step 3: Firebase Agent (Checks duplicates in local/Firestore database)
    const firebaseAgent = new FirebaseAgent();

    // Inject hybrid DB methods
    const cutoff = Date.now() - (3 * 3600000); // 3 hours
    firebaseAgent.getRecentPendingTickets = async () => {
      const tickets = await getTicketsList();
      return tickets.filter(t => t.status === 'PENDING' && t.timestamp >= cutoff);
    };
    firebaseAgent.updateTicket = async (id, updates) => {
      return await updateTicketInDb(id, updates);
    };
    firebaseAgent.saveTicket = async (ticket) => {
      return await createTicketInDb(ticket);
    };

    // For images uploaded locally, create a data URL or simulate storage path
    const imageUrl = file.presetLatitude ? req.body.image : `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

    const firebaseResult = await firebaseAgent.run(routingResult, imageUrl);

    console.log(`Pipeline Complete! Action: ${firebaseResult.actionTaken}. Ticket: ${firebaseResult.ticketId}`);

    // Return merged results to frontend client
    res.json({
      isValid: true,
      actionTaken: firebaseResult.actionTaken,
      ticketId: firebaseResult.ticketId,
      ticket: firebaseResult.ticket,
      logs: [
        `=== Agent 1: Vision & Inspection ===\n${visionAgent.getLogs()}`,
        `=== Agent 2: Geo-Spatial & Routing ===\n${routingAgent.getLogs()}`,
        `=== Agent 3: Firebase & Dispatch ===\n${firebaseAgent.getLogs()}`
      ].join('\n\n')
    });

  } catch (e) {
    console.error('Pipeline Execution Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`🛡️ Eco-Lifeline Sentinel Backend Server running on port ${PORT}`);
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
    console.log('⚠️ Warning: GEMINI_API_KEY is not configured in .env.');
  } else {
    console.log('✅ Gemini Flash API Key successfully loaded.');
  }
  if (useFirestore) {
    console.log('🔥 Connected to live Firebase Firestore database collection: [tickets].');
  } else {
    console.log('ℹ️ Running in fallback mode using local tickets.json file.');
  }
});
