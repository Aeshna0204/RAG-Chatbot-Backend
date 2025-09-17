const express =require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const sessionRoutes = require("./src/routes/sessionRoutes.js");
const chatRoutes = require("./src/routes/chatRoutes.js");
const { initQdrantCollection } = require("./src/services/qdrantService.js");
const { initRedis } = require("./src/services/redisService.js");
const cors = require("cors");
dotenv.config();

const app = express();
app.use(bodyParser.json());

app.use(cors({
  origin: ["http://localhost:5173"],  // frontend ka URL
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));
app.options(/.*/, cors());


app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// health
app.get("/", (req, res) => res.json({ ok: true, now: new Date().toISOString() }));

app.use("/session", sessionRoutes);
app.use("/chat", chatRoutes);

const PORT = process.env.PORT || 5000;

(async () => {
  // initialize services
  await initRedis();
  await initQdrantCollection();

  app.listen(PORT, () => {
    console.log(`🚀 Backend running on http://localhost:${PORT}`);
  });
})();
