const express = require("express");

const cors = require("cors");

const incidentRoutes =
require("./routes/incidents");

const app = express();

app.use(cors());

app.use(express.json());

app.use(
  "/api/incidents",
  incidentRoutes
);

app.get("/", (req, res) => {

  res.json({
    message:
      "Firebase Dispatch Agent Running"
  });

});

const PORT = 3000;

app.listen(PORT, () => {

  console.log(
    `Server running on port ${PORT}`
  );

});