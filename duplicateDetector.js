const { db } = require("./firebase");

const geolib = require("geolib");

const DUPLICATE_RADIUS = 15;

async function findDuplicate(
  latitude,
  longitude,
  hazard_type
) {

  const snapshot =
    await db.collection("incidents").get();

  for (const doc of snapshot.docs) {

    const data = doc.data();

    // Match same hazard type
    if (
      data.hazard_type !== hazard_type
    ) {
      continue;
    }

    // Calculate distance
    const distance =
      geolib.getDistance(
        {
          latitude,
          longitude
        },
        {
          latitude: data.latitude,
          longitude: data.longitude
        }
      );

    // Duplicate found
    if (distance <= DUPLICATE_RADIUS) {

      return {
        id: doc.id,
        data
      };

    }

  }

  return null;
}

module.exports = findDuplicate;