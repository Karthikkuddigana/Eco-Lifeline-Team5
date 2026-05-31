import fs from 'fs';
import path from 'path';
import exifr from 'exifr';

// Verify arguments
if (process.argv.length < 3) {
  console.log('\n❌ Error: Please specify an image file path.');
  console.log('Usage:');
  console.log('  Windows PowerShell:');
  console.log('    $env:GEMINI_API_KEY="your_api_key_here"; node scratch/test-vision.js path/to/image.jpg\n');
  process.exit(1);
}

const imagePath = path.resolve(process.argv[2]);
const apiKey = process.env.GEMINI_API_KEY;

if (!fs.existsSync(imagePath)) {
  console.error(`\n❌ Error: File not found at "${imagePath}"\n`);
  process.exit(1);
}

console.log('\n==================================================');
console.log('🛡️ Eco-Lifeline Sentinel: Vision Agent CLI Tester');
console.log('==================================================\n');

async function testPipeline() {
  // Step 1: EXIF Metadata Extraction
  console.log(`[EXIF] Loading image: ${path.basename(imagePath)}`);
  try {
    const gps = await exifr.gps(imagePath);
    if (gps && gps.latitude && gps.longitude) {
      console.log('✅ EXIF GPS Coordinates Extracted!');
      console.log(`   Latitude:  ${gps.latitude.toFixed(5)}° N`);
      console.log(`   Longitude: ${gps.longitude.toFixed(5)}° E`);
    } else {
      console.log('⚠️ No EXIF GPS metadata found in this image.');
    }
  } catch (e) {
    console.log(`⚠️ EXIF reading error: ${e.message}`);
  }

  // Step 2: Visual Analysis via Gemini Flash
  if (!apiKey) {
    console.log('\n⚠️ GEMINI_API_KEY environment variable is missing.');
    console.log('Skipping visual landmark/hazard analysis.');
    console.log('To run, set the environment variable: $env:GEMINI_API_KEY="your_key"');
    console.log('==================================================\n');
    return;
  }

  console.log('\n[Gemini] Preparing image for Gemini 2.5 Flash...');
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    const schema = {
      type: "OBJECT",
      properties: {
        isBeachIssue: { type: "BOOLEAN" },
        beachName: { type: "STRING", enum: ["RK Beach", "Yarada Beach", "Other"] },
        landmarkDescription: { type: "STRING" },
        hazardType: { type: "STRING", enum: ["plastic_debris", "medical_waste", "broken_glass", "rip_current", "general_trash", "none"] },
        hazardDescription: { type: "STRING" },
        estimatedLatitude: { type: "NUMBER" },
        estimatedLongitude: { type: "NUMBER" }
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
   - General RK Beach: 17.7160, 83.3250`;

    console.log('[Gemini] Requesting analysis from Gemini API...');
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: base64Image
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
      throw new Error(`API returned error ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    const text = result.candidates[0].content.parts[0].text;
    const analysis = JSON.parse(text);

    console.log('✅ Gemini Visual Verification Complete!');
    console.log('--------------------------------------------------');
    console.log(`Is Beach Issue:      ${analysis.isBeachIssue}`);
    console.log(`Beach:               ${analysis.beachName}`);
    console.log(`Landmark:            ${analysis.landmarkDescription}`);
    console.log(`Hazard Type:         ${analysis.hazardType}`);
    console.log(`Hazard Description:  ${analysis.hazardDescription}`);
    console.log(`Estimated Location:  ${analysis.estimatedLatitude.toFixed(5)}° N, ${analysis.estimatedLongitude.toFixed(5)}° E`);
    console.log('--------------------------------------------------');

  } catch (e) {
    console.error(`❌ Gemini Error: ${e.message}`);
  }
  console.log('==================================================\n');
}

testPipeline();
