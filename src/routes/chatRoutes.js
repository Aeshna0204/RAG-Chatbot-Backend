const express = require('express');
const { processQuery } = require("../services/ragService.js");
const { saveMessage, getCachedAnswer, setCachedAnswer } = require("../services/redisService.js");

const router = express.Router();

// POST /chat/:sessionId  { message: "..." }
router.post("/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  const { message } = req.body;

  if (!message) return res.status(400).json({ error: "message required" });

  try {
    // Save user message in session history
    await saveMessage(sessionId, { role: "user", text: message });

    // 🔹 Check cache
    let answer = await getCachedAnswer(message);

    if (!answer) {
      console.log("🟡 Cache miss → calling RAG pipeline");
      answer = await processQuery(message);
      await setCachedAnswer(message, answer); // store in cache
    } else {
      console.log("⚡ Cache hit → instant answer");
    }

    // Save bot response in history
    await saveMessage(sessionId, { role: "bot", text: answer });

    res.json({ answer });

    // // Process query (embed -> qdrant -> gemini)
    // const answer = await processQuery(message);

    // // Save bot response
    // await saveMessage(sessionId, { role: "bot", text: answer });

    // res.json({ answer });
  } catch (err) {
    console.error("chat error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
