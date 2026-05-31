# Eco-Lifeline Sentinel

**Eco-Lifeline Sentinel** is a Coastal Safety & Public Sanitation Multi-Agent Coordination Hub designed for RK Beach and Yarada Beach in Visakhapatnam. It utilizes a collaborative multi-agent AI system to analyze citizen/drone hazard reports, estimate locations, categorize urgency, handle geo-routing, and update GVMC response pipelines.

---

## 🛡️ The Multi-Agent Blueprint

We define three distinct agents, each with a specific role, backstory, and toolset. They communicate asynchronously in a chain to resolve incidents.

### 1. 👁️ The Vision & Inspection Agent
* **The Problem:** Many images uploaded by citizens or drones won't have crisp EXIF data (e.g., screenshots, images compressed by WhatsApp, or night shots). A standard script would just crash or reject them.
* **The Agentic Solution:** Equipped with a Vision LLM (e.g., Gemini Flash), this agent:
  * **EXIF Parser:** Instantly parses EXIF metadata if present to save token costs and get high-accuracy geo-tags.
  * **Visual Landmark Analysis:** If EXIF is missing, it analyzes visual features of the image, identifying landmarks (e.g., the Kursura Submarine, the VUDA park fence, or the specific color of the RK Beach pavement) to estimate the location (e.g., *"definite RK Beach, likely near the Kali temple"*).
  * **Decision Power (Gatekeeper):** Flags and terminates the chain early if the image is irrelevant (e.g., an accidental selfie or unrelated file).

### 2. 🗺️ The Geo-Spatial & Routing Agent
* **The Problem:** Raw coordinates ($17.7144^\circ\text{ N}, 83.3235^\circ\text{ E}$) mean nothing to a ground-level GVMC cleanup crew. Furthermore, some waste requires immediate attention (medical waste, hazardous glass), while others (a plastic bottle) can wait.
* **The Agentic Solution:** Takes the coordinates and visual description from Agent 1 and uses tools like the Google Maps API or a local GeoJSON fence.
  * **Zone Routing:** Calculates the nearest GVMC sector office and maps the report to the correct cleanup zone.
  * **Categorization & Priority Escalation:** Analyzes description/tags. If Agent 1 highlights a *"large pile of medical waste/broken glass near the shoreline,"* this agent dynamically escalates the priority to **CRITICAL** due to high tide risks.

### 3. 💾 The Firebase & Dispatch Agent
* **The Problem:** Database entries need to be perfectly structured, and notifications need to be smart—not spammy.
* **The Agentic Solution:** Acts as the coordinator with the database and external communication channels.
  * **Smart Deduplication:** Before writing a new entry, it queries pending tickets from the last 3 hours. If it finds another ticket within a 15-meter radius reporting the same hazard, it flags it as a duplicate.
  * **Action:** Instead of spamming the database, it upvotes the existing ticket (`upvote_count: +1`) or appends the new image frame to the existing ticket, keeping the GVMC command console clean.

---

## 🔄 How They Talk to Each Other (The Agentic Workflow)

```
       [Incoming Image File]
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│             Vision & Inspection Agent                  │
│  - Task: "Identify if this is RK Beach & what the      │
│     hazard is."                                        │
└────────────────────────────────────────────────────────┘
                 │
                 ├─► [Decision: Irrelevant Image] ──► Terminate & Log
                 │
                 ▼ (Passes: {hazard, est_loc, EXIF/vision data})
┌────────────────────────────────────────────────────────┐
│             Geo-Spatial & Routing Agent                │
│  - Task: "Determine precise GVMC Zone and assign       │
│     urgency level based on tide/location."             │
└────────────────────────────────────────────────────────┘
                 │
                 ▼ (Passes: {zone, priority, coords, description})
┌────────────────────────────────────────────────────────┐
│             Firebase & Dispatch Agent                  │
│  - Task: "Check for duplicates in Firestore. Commit    │
│     or update ticket. Alert corresponding zone team."  │
└────────────────────────────────────────────────────────┘
```

---

## 🚀 Setup & Execution

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed.

### Installation
Install project dependencies:
```bash
npm install
```

### Development Server
Run the local Vite development server:
```bash
npm run dev
```

### Building for Production
Build the optimized production assets:
```bash
npm run build
```
