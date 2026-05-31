const { db } = require("./firebase");

async function sendNotification(
  incidentData
) {

  try {

    let assignedTeam =
      "General Cleanup Team";

    // Team Assignment Logic
    if (
      incidentData.priority ===
      "CRITICAL"
    ) {

      assignedTeam =
        "Emergency Hazard Response Team";

    } else if (
      incidentData.priority ===
      "HIGH"
    ) {

      assignedTeam =
        "Zone Priority Cleanup Team";

    }

    // Save notification log
    await db.collection(
      "notifications"
    ).add({

      incident_id:
        incidentData.incident_id,

      hazard_type:
        incidentData.hazard_type,

      priority:
        incidentData.priority,

      zone:
        incidentData.zone || "Unknown",

      assigned_team:
        assignedTeam,

      status: "SENT",

      timestamp: new Date()

    });

    console.log(
      `Notification sent to ${assignedTeam}`
    );

  } catch (error) {

    console.log(
      "Notification Error:",
      error.message
    );

  }

}

module.exports = sendNotification;