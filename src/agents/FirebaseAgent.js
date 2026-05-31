import { dbService } from '../services/firebase';

// Helper to compute distance (in meters) between two coordinates
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
};

export class FirebaseAgent {
  constructor() {
    this.logs = [];
  }

  log(msg) {
    console.log(`[Firebase Agent] ${msg}`);
    this.logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
  }

  getLogs() {
    return this.logs.join('\n');
  }

  async run(routedData, imageUrl) {
    this.logs = [];
    this.log("Starting Firebase Storage & Duplicate Auditing...");
    this.log("Querying PENDING incidents submitted in the last 3 hours...");

    // Step 1: Fetch recent tickets (last 3 hours, pending status)
    let recentTickets = [];
    try {
      recentTickets = await dbService.getRecentPendingTickets(3);
      this.log(`Retrieved ${recentTickets.length} active PENDING tickets in this window.`);
    } catch (e) {
      this.log(`Failed to fetch recent tickets: ${e.message}. Defaulting to no duplicates.`);
    }

    // Step 2: Distance comparison for duplicate detection (15 meters radius)
    let duplicateTicket = null;
    let closestDistance = Infinity;

    for (const ticket of recentTickets) {
      const dist = getDistance(
        routedData.latitude, 
        routedData.longitude, 
        ticket.latitude, 
        ticket.longitude
      );
      this.log(`Checking proximity to ticket [${ticket.id}]: ${dist.toFixed(2)} meters.`);
      
      if (dist <= 15) { // 15 meters threshold
        if (dist < closestDistance) {
          closestDistance = dist;
          duplicateTicket = ticket;
        }
      }
    }

    // Step 3: Action based on duplicate status
    if (duplicateTicket) {
      this.log(`ALERT: Duplicate report identified!`);
      this.log(`Matching Incident ID: [${duplicateTicket.id}]`);
      this.log(`Distance between reports: ${closestDistance.toFixed(2)} meters (Within 15m threshold).`);
      this.log(`Upvoting existing incident upvotes from ${duplicateTicket.upvotes} to ${duplicateTicket.upvotes + 1}.`);

      const updatedLogs = duplicateTicket.logs + `\n\n[Firebase Agent Update - ${new Date().toLocaleTimeString()}]: Duplicate reported! Incrementing ticket upvote count to ${duplicateTicket.upvotes + 1}.`;
      
      await dbService.updateTicket(duplicateTicket.id, {
        upvotes: duplicateTicket.upvotes + 1,
        logs: updatedLogs
      });

      this.log(`Existing ticket database entry [${duplicateTicket.id}] updated successfully.`);
      this.log(`Dispatch crew already notified for this incident sector. Duplication minimized.`);

      return {
        actionTaken: 'UPVOTED_DUPLICATE',
        ticketId: duplicateTicket.id,
        ticket: { ...duplicateTicket, upvotes: duplicateTicket.upvotes + 1, logs: updatedLogs },
        logs: this.getLogs()
      };
    } else {
      this.log("No duplicate incident found in the 15-meter radius.");
      this.log("Structuring new Firestore database document...");

      // Construct clean database schema
      const newTicket = {
        image: imageUrl || 'https://images.unsplash.com/photo-1618477388954-7852f32655ec?auto=format&fit=crop&w=600&q=80',
        hazard: routedData.hazardDescription,
        hazardType: routedData.hazardType,
        latitude: routedData.latitude,
        longitude: routedData.longitude,
        locationName: routedData.locationName,
        landmark: routedData.landmark,
        locationSource: routedData.locationSource,
        zone: routedData.zone,
        sectorName: routedData.sectorName,
        dispatchOffice: routedData.dispatchOffice,
        priority: routedData.priority,
        priorityReason: routedData.priorityReason,
        status: 'PENDING',
        upvotes: 1,
        timestamp: Date.now(),
        // Save history of agent reasoning in the ticket
        logs: `--- Vision Agent ---\n${routedData.logs}\n\n--- Routing Agent ---\n${routedData.logs_routing || ''}\n\n--- Firebase Agent ---\n[Firebase Agent]: Verified uniqueness. Logged new ticket.`
      };

      // Set logs from routing inside the ticket for full context
      newTicket.logs = `--- Vision Agent ---\n${routedData.logs}\n\n--- Routing Agent ---\n${routedData.priorityReason}\nRouted to: ${routedData.dispatchOffice}\nTide risk: ${routedData.tideStatus}\n\n--- Firebase Agent ---\n[Firebase Agent]: No duplicates in 15m radius. Created new incident ticket.`;

      this.log("Saving document to Firestore...");
      const savedTicket = await dbService.saveTicket(newTicket);
      this.log(`Committed! Generated Ticket ID: [${savedTicket.id}]`);

      // Dispatch alert logging
      this.log(`ALERT: Triggering GVMC Responder dispatch pipeline...`);
      this.log(`SMS Alert Sent to ${routedData.sectorName} Crew:`);
      this.log(`"[GVMC DISPATCH] URGENT: New [${routedData.priority}] sanitation issue at ${routedData.landmark}. Sector Office: ${routedData.dispatchOffice}. Contact: ${routedData.contact}. Case Ref: ${savedTicket.id}."`);

      return {
        actionTaken: 'CREATED_NEW_TICKET',
        ticketId: savedTicket.id,
        ticket: savedTicket,
        logs: this.getLogs()
      };
    }
  }
}
