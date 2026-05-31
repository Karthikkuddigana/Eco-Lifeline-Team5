import { dbService } from '../services/firebase.js';

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

    // Normalize and extract initial coordinates
    let lat = Number(visionData.latitude) || 0;
    let lng = Number(visionData.longitude) || 0;
    let locationSource = visionData.locationSource || 'Unknown';

    // Step 1: Landmark Coordinate Recovery (If coords are invalid/missing/zero)
    const isCoordinateInvalid = lat === 0 || lng === 0 || lat < 17.0 || lat > 18.0 || lng < 83.0 || lng > 84.0;
    if (isCoordinateInvalid) {
      this.log("Invalid/missing coordinates detected. Scanning visual description for landmark recovery...");
      const textToScan = `${visionData.landmark || ''} ${visionData.hazardDescription || ''}`.toLowerCase();
      
      let matchedRecovery = null;
      if (textToScan.includes('submarine') || textToScan.includes('kurusura')) {
        matchedRecovery = LANDMARKS[0]; // Kurusura
      } else if (textToScan.includes('kali') || textToScan.includes('temple')) {
        matchedRecovery = LANDMARKS[1]; // Kali Temple
      } else if (textToScan.includes('vuda') || textToScan.includes('park')) {
        matchedRecovery = LANDMARKS[2]; // VUDA Park
      } else if (textToScan.includes('lighthouse')) {
        matchedRecovery = LANDMARKS[3]; // Lighthouse
      } else if (textToScan.includes('yarada')) {
        matchedRecovery = LANDMARKS[4]; // Yarada North Shore/General
      }

      if (matchedRecovery) {
        lat = matchedRecovery.latitude;
        lng = matchedRecovery.longitude;
        locationSource = 'Landmark Recovery';
        this.log(`RECOVERY: Identified landmark visually. Resolved coordinates to: ${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E (${matchedRecovery.name})`);
      } else {
        this.log("Coordinate recovery failed: No recognizable landmarks in visual text.");
      }
    }

    // Load Settings to check for Google Maps API key
    const settings = dbService.getSettings();
    const apiKey = settings.googleMapsApiKey;

    // Optional dynamic Google APIs results
    let geocodedAddress = '';
    let resolvedLandmarkName = '';
    let resolvedLandmarkDist = Infinity;

    if (apiKey) {
      this.log("Google Maps API Key detected. Commencing live spatial queries...");

      // 1. Google Geocoding lookup
      try {
        this.log("Invoking Google Geocoding API for reverse geocoding...");
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
        const geocodeRes = await fetch(geocodeUrl);
        if (geocodeRes.ok) {
          const geocodeData = await geocodeRes.json();
          if (geocodeData.status === 'OK' && geocodeData.results && geocodeData.results.length > 0) {
            geocodedAddress = geocodeData.results[0].formatted_address;
            this.log(`Geocoding Successful! Address: "${geocodedAddress}"`);
          } else {
            this.log(`Geocoding API status: ${geocodeData.status}. Falling back to default address.`);
          }
        }
      } catch (e) {
        this.log(`Geocoding API call failed: ${e.message}.`);
      }

      // 2. Google Places Nearby Search lookup for landmarks
      try {
        this.log("Invoking Google Places API (Nearby Search) for landmark detection...");
        const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=300&key=${apiKey}`;
        const placesRes = await fetch(placesUrl);
        if (placesRes.ok) {
          const placesData = await placesRes.json();
          if (placesData.status === 'OK' && placesData.results && placesData.results.length > 0) {
            let closestPlace = null;
            let minPlaceDist = Infinity;
            placesData.results.forEach(place => {
              if (place.geometry && place.geometry.location) {
                const placeLat = place.geometry.location.lat;
                const placeLng = place.geometry.location.lng;
                const dist = calculateDistance(lat, lng, placeLat, placeLng);
                if (dist < minPlaceDist) {
                  minPlaceDist = dist;
                  closestPlace = place;
                }
              }
            });
            if (closestPlace) {
              resolvedLandmarkName = closestPlace.name;
              resolvedLandmarkDist = minPlaceDist;
              this.log(`Places Landmark Found: "${resolvedLandmarkName}" (Distance: ${resolvedLandmarkDist.toFixed(1)}m)`);
            }
          } else {
            this.log(`Places API status: ${placesData.status}.`);
          }
        }
      } catch (e) {
        this.log(`Places API call failed: ${e.message}.`);
      }
    } else {
      this.log("No Google Maps API Key found in settings. Running local spatial emulators...");
    }

    this.log("Resolving geographical coordinates against landmarks directory...");

    // Step 2: Proximity Check (Exact Location Name Matching)
    let locationName;

    if (resolvedLandmarkName && resolvedLandmarkDist <= 150) {
      locationName = resolvedLandmarkName;
      this.log(`Location Resolved (Google Places): Coordinates match "${locationName}" (Distance: ${resolvedLandmarkDist.toFixed(1)}m)`);
    } else {
      // Local landmark database fallback
      let closestLandmark = null;
      let landmarkDistance = Infinity;

      LANDMARKS.forEach(lm => {
        const dist = calculateDistance(lat, lng, lm.latitude, lm.longitude);
        if (dist < landmarkDistance) {
          landmarkDistance = dist;
          closestLandmark = lm;
        }
      });

      if (closestLandmark && landmarkDistance <= 150) {
        locationName = closestLandmark.name;
        this.log(`Location Resolved (Local Landmark): Coordinates match "${locationName}" (Distance: ${landmarkDistance.toFixed(1)}m)`);
      } else {
        // Step 2b: Text-based proximity fallback if coordinates are outside 150m
        const textToScan = `${visionData.landmark || ''} ${visionData.hazardDescription || ''}`.toLowerCase();
        let matchedTextLandmark = null;
        
        if (textToScan.includes('submarine') || textToScan.includes('kurusura')) {
          matchedTextLandmark = LANDMARKS[0];
        } else if (textToScan.includes('kali') || textToScan.includes('temple')) {
          matchedTextLandmark = LANDMARKS[1];
        } else if (textToScan.includes('vuda') || textToScan.includes('park')) {
          matchedTextLandmark = LANDMARKS[2];
        } else if (textToScan.includes('lighthouse')) {
          matchedTextLandmark = LANDMARKS[3];
        }

        if (matchedTextLandmark) {
          locationName = matchedTextLandmark.name;
          this.log(`Location Resolved (Text Fallback): Coordinate match was outside 150m (${landmarkDistance.toFixed(1)}m), but visual text matches landmark "${locationName}".`);
        } else {
          locationName = geocodedAddress || visionData.landmark || 'Unspecified Beach Shoreline';
          this.log(`Location Resolved: No matching landmark within 150m. Falling back to resolved address: "${locationName}"`);
        }
      }
    }

    this.log(`Working coordinates: ${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E`);
    
    // Step 3: Sector Assignment (nearest sector office)
    let nearestSector = SECTORS[0];
    let minDistance = Infinity;
    let transitTimeStr = '';
    let isDistanceMatrixUsed = false;

    SECTORS.forEach(sector => {
      const dist = calculateDistance(lat, lng, sector.latitude, sector.longitude);
      if (dist < minDistance) {
        minDistance = dist;
        nearestSector = sector;
      }
    });

    this.log(`Pre-assigned candidate office: ${nearestSector.name} (Direct Distance: ${(minDistance/1000).toFixed(2)} km).`);

    // 3. Google Distance Matrix lookup
    if (apiKey) {
      try {
        this.log(`Invoking Google Distance Matrix API for routing metrics from ${nearestSector.name} to coordinates...`);
        const origin = `${nearestSector.latitude},${nearestSector.longitude}`;
        const destination = `${lat},${lng}`;
        const distUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&key=${apiKey}`;
        
        const distRes = await fetch(distUrl);
        if (distRes.ok) {
          const distData = await distRes.json();
          if (distData.status === 'OK' && distData.rows && distData.rows[0].elements && distData.rows[0].elements[0].status === 'OK') {
            const element = distData.rows[0].elements[0];
            minDistance = element.distance.value; // road distance in meters
            transitTimeStr = element.duration.text; // road transit time string, e.g. "12 mins"
            isDistanceMatrixUsed = true;
            this.log(`Google Routing Matrix Success! Driving Distance: ${(minDistance/1000).toFixed(2)} km. Estimated Transit: ${transitTimeStr}.`);
          } else {
            this.log(`Distance Matrix status: ${distData.status} or element status not OK. Using straight-line distance fallback.`);
          }
        }
      } catch (e) {
        this.log(`Distance Matrix API call failed: ${e.message}. Using straight-line distance fallback.`);
      }
    }

    if (!isDistanceMatrixUsed) {
      // Offline fallback: estimate travel time locally based on 30 km/h average speed in Visakhapatnam coastal roads
      const travelHours = (minDistance / 1000) / 30; // hours
      const travelMins = Math.round(travelHours * 60) + 5; // round mins + 5m response dispatch buffer
      transitTimeStr = `${travelMins} mins`;
      this.log(`Local Routing Estimation: Direct Distance: ${(minDistance/1000).toFixed(2)} km. Estimated Transit: ${transitTimeStr}.`);
    }

    this.log(`DECISION: Assigned to ${nearestSector.name}. Responding dispatch office: ${nearestSector.office}`);

    // Step 4: Tide Risk Assessment
    const tide = getTideStatus();
    this.log(`Local Coastline Oceanography: ${tide.description}`);

    // Step 5: Peak Traffic Hour Detection (4 PM - 9 PM)
    const currentHour = new Date().getHours();
    const isPeakHour = currentHour >= 16 && currentHour <= 21;
    if (isPeakHour) {
      this.log(`Time Audit: Current hour is ${currentHour}:00 (Peak visitor hours active: 4:00 PM - 9:00 PM).`);
    }

    // Step 6: Dynamic Priority Scaling & Escalation
    let priority = 'MEDIUM';
    let priorityReason = 'Standard debris report.';

    const hType = visionData.hazardType;
    const isShore = (visionData.landmark || '').toLowerCase().includes('shore') || 
                    (visionData.landmark || '').toLowerCase().includes('sand') || 
                    (visionData.landmark || '').toLowerCase().includes('tide') || 
                    (visionData.hazardDescription || '').toLowerCase().includes('shore') ||
                    (visionData.hazardDescription || '').toLowerCase().includes('tide');

    if (hType === 'medical_waste') {
      if (isShore && tide.status === 'HIGH_TIDE_RISK') {
        priority = 'CRITICAL';
        priorityReason = 'Medical waste located on active tide boundary with incoming high tide. High risk of oceanic washing.';
      } else {
        priority = 'CRITICAL';
        priorityReason = 'Biohazard risk. Medical waste poses immediate infection hazard to beach visitors.';
      }
    } else if (hType === 'rip_current') {
      if (tide.status === 'HIGH_TIDE_RISK') {
        priority = 'CRITICAL';
        priorityReason = 'Active rip current detected during incoming high tide. Extremely high drowning hazard; urgent lifeguard warning flags required.';
      } else {
        priority = 'HIGH';
        priorityReason = 'Active rip current detected. Dangerous for swimming; requires immediate life-guard alert flags.';
      }
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

    // Peak traffic hour priority escalation
    if (isPeakHour && priority !== 'CRITICAL' && priority !== 'LOW') {
      const oldPriority = priority;
      if (priority === 'MEDIUM') priority = 'HIGH';
      else if (priority === 'HIGH') priority = 'CRITICAL';
      priorityReason += ` (Priority escalated from ${oldPriority} due to peak visitor hours with heavy foot traffic.)`;
      this.log(`ESCALATION: Peak tourist traffic hour detected. Escalated priority to [${priority}].`);
    }

    this.log(`DECISION: Assigned Priority level to [${priority}]. Reason: ${priorityReason}`);

    // Compile Geo Data
    return {
      ...visionData,
      latitude: lat,
      longitude: lng,
      locationSource,
      locationName,
      zone: nearestSector.name.split(' ')[1] || 'Zone 2', // Extract 'Sector 1' or default to Zone 2
      sectorName: nearestSector.name,
      dispatchOffice: nearestSector.office,
      contact: nearestSector.contact,
      distanceToOfficeMeters: minDistance,
      transitTime: transitTimeStr,
      priority,
      priorityReason,
      tideStatus: tide.status,
      logs_vision: visionData.logs,
      logs_routing: this.getLogs()
    };
  }
}
