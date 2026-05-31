// Predefined Named Landmarks for Exact Location Matching
const LANDMARKS = [
  { name: 'Kurusura Submarine Museum, RK Beach', latitude: 17.7182, longitude: 83.3308 },
  { name: 'Kali Temple, RK Beach', latitude: 17.7144, longitude: 83.3235 },
  { name: 'VUDA Park Beach Access, RK Beach', latitude: 17.7214, longitude: 83.3341 },
  { name: 'Yarada Beach Lighthouse, Yarada', latitude: 17.6531, longitude: 83.2721 },
  { name: 'Yarada Beach North Shore, Yarada', latitude: 17.6575, longitude: 83.2685 }
];

// Predefined GVMC Sector Offices for Beach Sanitation and Incident Response
const SECTORS = [
  {
    name: 'Sector 1 (North RK Beach)',
    office: 'GVMC Sector Office 1, near VUDA Park',
    latitude: 17.7225,
    longitude: 83.3352,
    contact: '+91 891 256 0001'
  },
  {
    name: 'Sector 2 (Central RK Beach)',
    office: 'GVMC Sector Office 2, near Kali Temple',
    latitude: 17.7145,
    longitude: 83.3238,
    contact: '+91 891 256 0002'
  },
  {
    name: 'Sector 3 (Yarada Beach / South)',
    office: 'GVMC Sector Office 3, Scindia / Yarada Road',
    latitude: 17.6560,
    longitude: 83.2680,
    contact: '+91 891 256 0003'
  }
];

// Haversine distance formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
};

// Simulate local tide schedules for Visakhapatnam Coast
const getTideStatus = () => {
  const currentHour = new Date().getHours();
  // Semi-diurnal tide cycles: high tide peaks roughly every 12 hours
  // Let's model high tides around 4:00 AM/PM and low tides around 10:00 AM/PM
  const diffToHigh = Math.min(Math.abs(currentHour - 4), Math.abs(currentHour - 16));
  const diffToLow = Math.min(Math.abs(currentHour - 10), Math.abs(currentHour - 22));

  if (diffToHigh <= 2) {
    return { status: 'HIGH_TIDE_RISK', description: 'Incoming high tide peaking shortly. Tidal drag risk is active.' };
  } else if (diffToLow <= 2) {
    return { status: 'LOW_TIDE', description: 'Low tide. Shoreline width is maximal. Low direct water contact risk.' };
  } else {
    return { status: 'NORMAL', description: 'Tide is transitioning. Moderate flow.' };
  }
};

export class RoutingAgent {
  constructor() {
    this.logs = [];
  }

  log(msg) {
    console.log(`[Routing Agent] ${msg}`);
    this.logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
  }

  getLogs() {
    return this.logs.join('\n');
  }

  async run(visionData) {
    this.logs = [];
    this.log("Starting Geo-Spatial Routing and Categorization...");
    this.log("Resolving geographical coordinates against landmarks directory...");

    // Step 1: Exact Location Name Matching (Proximity Check)
    let locationName = '';
    let closestLandmark = null;
    let landmarkDistance = Infinity;

    LANDMARKS.forEach(lm => {
      const dist = calculateDistance(
        visionData.latitude, 
        visionData.longitude, 
        lm.latitude, 
        lm.longitude
      );
      if (dist < landmarkDistance) {
        landmarkDistance = dist;
        closestLandmark = lm;
      }
    });

    if (closestLandmark && landmarkDistance <= 150) {
      locationName = closestLandmark.name;
      this.log(`Location Resolved: Coordinates match "${locationName}" (Distance: ${landmarkDistance.toFixed(1)}m)`);
    } else {
      locationName = visionData.landmark || 'Unspecified Beach Shoreline';
      this.log(`Location Resolved: No matching landmark within 150m. Falling back to visual description: "${locationName}"`);
    }

    this.log(`Input coordinates: ${visionData.latitude.toFixed(5)}° N, ${visionData.longitude.toFixed(5)}° E`);
    
    // Step 2: Sector Assignment (nearest sector office)
    let nearestSector = SECTORS[0];
    let minDistance = Infinity;

    SECTORS.forEach(sector => {
      const dist = calculateDistance(
        visionData.latitude, 
        visionData.longitude, 
        sector.latitude, 
        sector.longitude
      );
      this.log(`Distance to ${sector.name}: ${(dist / 1000).toFixed(2)} km`);
      if (dist < minDistance) {
        minDistance = dist;
        nearestSector = sector;
      }
    });

    this.log(`DECISION: Assigned to ${nearestSector.name} (Distance: ${(minDistance/1000).toFixed(2)} km).`);
    this.log(`Responding dispatch office: ${nearestSector.office}`);

    // Step 2: Tide Risk Assessment
    const tide = getTideStatus();
    this.log(`Local Coastline Oceanography: ${tide.description}`);

    // Step 3: Dynamic Priority Scaling
    let priority = 'MEDIUM';
    let priorityReason = 'Standard debris report.';

    const hType = visionData.hazardType;
    const isShore = visionData.landmark.toLowerCase().includes('shore') || 
                    visionData.landmark.toLowerCase().includes('sand') || 
                    visionData.landmark.toLowerCase().includes('tide') || 
                    visionData.hazardDescription.toLowerCase().includes('shore') ||
                    visionData.hazardDescription.toLowerCase().includes('tide');

    if (hType === 'medical_waste') {
      if (isShore && tide.status === 'HIGH_TIDE_RISK') {
        priority = 'CRITICAL';
        priorityReason = 'Medical waste located on active tide boundary with incoming high tide. High risk of oceanic washing.';
      } else {
        priority = 'CRITICAL';
        priorityReason = 'Biohazard risk. Medical waste poses immediate infection hazard to beach visitors.';
      }
    } else if (hType === 'rip_current') {
      priority = 'HIGH';
      priorityReason = 'Active rip current detected. Dangerous for swimming; requires immediate life-guard alert flags.';
    } else if (hType === 'broken_glass') {
      if (isShore) {
        priority = 'HIGH';
        priorityReason = 'Sharp glass shards on sandy shoreline with high visitor footfall.';
      } else {
        priority = 'MEDIUM';
        priorityReason = 'Broken glass bottles near pathway. Moderate injury risk.';
      }
    } else if (hType === 'plastic_debris') {
      if (isShore && tide.status === 'HIGH_TIDE_RISK') {
        priority = 'HIGH';
        priorityReason = 'Ghost fishing nets near water edge during high tide. Risk of marine wildlife entanglement.';
      } else {
        priority = 'MEDIUM';
        priorityReason = 'Plastic bottle/net heap on sandy beach area.';
      }
    } else if (hType === 'general_trash') {
      priority = 'LOW';
      priorityReason = 'General littering or minor trash items.';
    }

    this.log(`DECISION: Assigned Priority level to [${priority}]. Reason: ${priorityReason}`);

    // Compile Geo Data
    return {
      ...visionData,
      locationName,
      zone: nearestSector.name.split(' ')[1] || 'Zone 2', // Extract 'Sector 1' or default to Zone 2
      sectorName: nearestSector.name,
      dispatchOffice: nearestSector.office,
      contact: nearestSector.contact,
      distanceToOfficeMeters: minDistance,
      priority,
      priorityReason,
      tideStatus: tide.status,
      logs: this.getLogs()
    };
  }
}
