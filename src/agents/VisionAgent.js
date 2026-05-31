import exifr from 'exifr';

// Helper to convert File to base64
const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => {
    const base64String = reader.result.split(',')[1];
    resolve(base64String);
  };
  reader.onerror = error => reject(error);
});

export class VisionAgent {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.logs = [];
  }

  log(msg) {
    console.log(`[Vision Agent] ${msg}`);
    this.logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
  }

  getLogs() {
    return this.logs.join('\n');
  }

  async run(file) {
    this.logs = [];
    this.log("Starting Vision & Inspection pipeline...");
    const fileName = file.originalname || file.name || 'uploaded_image.jpg';
    const fileSize = file.size || 0;
    this.log(`Received file: ${fileName} (${(fileSize / 1024).toFixed(1)} KB)`);

    // Step 1: Attempt EXIF parse to save API costs
    let coordinates = null;
    try {
      this.log("Parsing EXIF metadata for GPS coordinates...");
      const gps = await exifr.gps(file.buffer || file);
      if (gps && gps.latitude && gps.longitude) {
        coordinates = {
          latitude: gps.latitude,
          longitude: gps.longitude,
          source: 'EXIF Data'
        };
        this.log(`EXIF GPS found! Coordinates: ${gps.latitude.toFixed(5)}° N, ${gps.longitude.toFixed(5)}° E`);
      } else {
        this.log("EXIF metadata lacks GPS coordinates. Moving to Visual Landmark Analysis...");
      }
    } catch (e) {
      this.log(`EXIF parsing skipped/unsupported: ${e.message}. Moving to Visual Analysis...`);
    }

    // Step 2: visual analysis using Gemini Flash
    if (!this.apiKey) {
      this.log("ERROR: Gemini API Key is missing. Pipeline terminated.");
      return {
        isValid: false,
        reason: "Gemini API Key is not configured in the server .env file.",
        logs: this.getLogs()
      };
    }

    try {
      this.log("Converting image to base64 for Gemini Flash Vision API...");
      const base64Data = typeof window === 'undefined'
        ? file.buffer.toString('base64')
        : await fileToBase64(file);
      this.log("Invoking Gemini 2.5 Flash for landmark detection & hazard classification...");

      const schema = {
        type: "OBJECT",
        properties: {
          isBeachIssue: { 
            type: "BOOLEAN", 
            description: "Is this a beach safety (rip current) or civic sanitation (debris/trash/medical waste) issue at RK Beach or Yarada Beach in Visakhapatnam?" 
          },
          beachName: { 
            type: "STRING", 
            enum: ["RK Beach", "Yarada Beach", "Other"], 
            description: "Which beach is this? RK Beach or Yarada Beach? Base this on landmarks, pavement color, terrain, or visual features. If unrecognized or not in Vizag, output Other." 
          },
          landmarkDescription: { 
            type: "STRING", 
            description: "Visual details or landmarks identified (e.g. near Kurusura Submarine, Kali Temple, Yarada lighthouse, or specific pavement color/sand color)." 
          },
          hazardType: { 
            type: "STRING", 
            enum: ["plastic_debris", "medical_waste", "broken_glass", "rip_current", "general_trash", "none"], 
            description: "The category of hazard detected." 
          },
          hazardDescription: { 
            type: "STRING", 
            description: "A detailed description of the debris or safety risk seen in the photo." 
          },
          estimatedLatitude: { 
            type: "NUMBER", 
            description: "Estimate the latitude based on the landmark (e.g. RK Beach Kali Temple is ~17.7144, Kurusura Submarine is ~17.7182, Yarada beach center is ~17.6554). Return 0 if unable to estimate or not a beach." 
          },
          estimatedLongitude: { 
            type: "NUMBER", 
            description: "Estimate the longitude based on the landmark (e.g. RK Beach Kali Temple is ~83.3235, Kurusura Submarine is ~83.3308, Yarada beach center is ~83.2694). Return 0 if unable to estimate or not a beach." 
          }
        },
        required: ["isBeachIssue", "beachName", "landmarkDescription", "hazardType", "hazardDescription", "estimatedLatitude", "estimatedLongitude"]
      };

      const prompt = `You are the Vision & Inspection Agent of the Eco-Lifeline Sentinel beach safety ecosystem. Your role is to analyze the uploaded citizen/drone image and determine:
1. Is it a beach safety (rip current) or sanitation (marine debris, trash) issue at RK Beach or Yarada Beach in Visakhapatnam, Andhra Pradesh, India? (Look for key signs like specific sandy beach terrain, yellow-blue waves, brick pathways, VUDA park fences, Kurusura Submarine, Kali Temple, or shoreline settings).
2. Identify the specific hazard present (e.g. rip currents, plastic netting, medical waste, glass bottles, general debris).
3. If it is NOT a beach issue (e.g. someone uploaded a personal selfie, a document, or an interior room), flag isBeachIssue as false and set hazardType to none.
4. Estimate the coordinates based on visual landmarks if coordinates are not provided:
   - Kurusura Submarine: 17.7182, 83.3308
   - Kali Temple: 17.7144, 83.3235
   - VUDA Park area: 17.7214, 83.3341
   - Yarada Beach lighthouse area: 17.6531, 83.2721
   - General Yarada Beach: 17.6554, 83.2694
   - General RK Beach: 17.7160, 83.3250

Analyze carefully. If the image is a generic selfie or document, reject it by setting isBeachIssue to false.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: file.type || 'image/jpeg',
                    data: base64Data
                  }
                }
              ]
            }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: schema
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText} (${response.status})`);
      }

      const result = await response.json();
      const text = result.candidates[0].content.parts[0].text;
      const analysis = JSON.parse(text);

      this.log(`Visual verification complete!`);
      this.log(`Is Beach Issue: ${analysis.isBeachIssue}`);
      this.log(`Detected Beach: ${analysis.beachName}`);
      this.log(`Detected Hazard: ${analysis.hazardType} (${analysis.hazardDescription})`);
      this.log(`Visual Landmark: ${analysis.landmarkDescription}`);

      if (!analysis.isBeachIssue) {
        this.log("DECISION: Image flagged as irrelevant (not a beach issue or out-of-bounds). TERMINATING pipeline.");
        return {
          isValid: false,
          reason: "Image is not a relevant beach safety or sanitation hazard for RK Beach/Yarada.",
          logs: this.getLogs()
        };
      }

      // If EXIF coordinates exist, use them. Otherwise, use preset coordinates or Gemini estimated ones
      const finalLat = coordinates ? coordinates.latitude : (file.presetLatitude || analysis.estimatedLatitude);
      const finalLng = coordinates ? coordinates.longitude : (file.presetLongitude || analysis.estimatedLongitude);
      const locationSrc = coordinates ? 'EXIF Data' : (file.presetLatitude ? 'Preset Telemetry' : 'Landmark Estimation');

      this.log(`Assigned Location: ${finalLat.toFixed(5)}° N, ${finalLng.toFixed(5)}° E (${locationSrc})`);

      return {
        isValid: true,
        beachName: analysis.beachName,
        landmark: analysis.landmarkDescription,
        hazardType: analysis.hazardType,
        hazardDescription: analysis.hazardDescription,
        latitude: finalLat,
        longitude: finalLng,
        locationSource: locationSrc,
        logs: this.getLogs()
      };

    } catch (e) {
      this.log(`Gemini API call failed: ${e.message}. Pipeline aborted.`);
      return {
        isValid: false,
        reason: `Gemini API execution error: ${e.message}`,
        logs: this.getLogs()
      };
    }
  }
}
