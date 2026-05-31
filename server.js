import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Import our agents
import { VisionAgent } from './src/agents/VisionAgent.js';
import { RoutingAgent } from './src/agents/RoutingAgent.js';
import { FirebaseAgent } from './src/agents/FirebaseAgent.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.use(cors());
app.use(express.json());

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

// Database Helpers
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

// --- API Endpoints ---

// 1. Get all tickets
app.get('/api/tickets', (req, res) => {
  try {
    const tickets = readTickets();
    res.json(tickets);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2. Add / Update a ticket directly
app.post('/api/tickets', (req, res) => {
  try {
    const tickets = readTickets();
    const newTicket = {
      ...req.body,
      id: req.body.id || `GVMC-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: req.body.timestamp || Date.now()
    };
    tickets.unshift(newTicket);
    writeTickets(tickets);
    res.status(201).json(newTicket);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 3. Patch ticket (status updates or upvotes)
app.patch('/api/tickets/:id', (req, res) => {
  try {
    const { id } = req.params;
    const tickets = readTickets();
    const index = tickets.findIndex(t => t.id === id);
    if (index !== -1) {
      tickets[index] = { ...tickets[index], ...req.body };
      writeTickets(tickets);
      res.json(tickets[index]);
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

    // Step 3: Firebase Agent (Checks duplicates in local file database)
    const firebaseAgent = new FirebaseAgent();
    
    // We override dbService methods for the Firebase agent on the backend to use our file database!
    // This allows the agent to run identically on the backend using tickets.json!
    const originalGetRecentPendingTickets = firebaseAgent.getRecentPendingTickets;
    const originalUpdateTicket = firebaseAgent.updateTicket;
    const originalSaveTicket = firebaseAgent.saveTicket;

    // Inject file-based DB methods
    const cutoff = Date.now() - (3 * 3600000); // 3 hours
    firebaseAgent.getRecentPendingTickets = async () => {
      return readTickets().filter(t => t.status === 'PENDING' && t.timestamp >= cutoff);
    };
    firebaseAgent.updateTicket = async (id, updates) => {
      const tickets = readTickets();
      const index = tickets.findIndex(t => t.id === id);
      if (index !== -1) {
        tickets[index] = { ...tickets[index], ...updates };
        writeTickets(tickets);
        return true;
      }
      return false;
    };
    firebaseAgent.saveTicket = async (ticket) => {
      const tickets = readTickets();
      const newTicket = {
        ...ticket,
        id: `GVMC-${Math.floor(1000 + Math.random() * 9000)}`
      };
      tickets.unshift(newTicket);
      writeTickets(tickets);
      return newTicket;
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
    console.log('⚠️ Warning: GEMINI_API_KEY is not configured in .env. Falling back to simulation.');
  } else {
    console.log('✅ Gemini Flash API Key successfully loaded.');
  }
});
