const express =require("express");
const { createSession, getHistory, clearSession , listSessions,resetChatHistory} =require("../services/redisService.js");

const router = express.Router();

// POST /session -> create new sessionId
router.post("/create-session", async (req, res) => {
  try {
    const sessionId = await createSession();
    res.json({ sessionId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create session" });
  }
});

// GET /session/:id/history
router.get("/:id/history", async (req, res) => {
  try {
    const history = await getHistory(req.params.id);
    res.json({ history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

router.get("/list-sessions",async(req,res)=>{
  try{
    const sessions=await listSessions();
    res.json({sessions});
  }catch(err){
    console.error(err);
    res.status(500).json({error:err.message || "Failed to list sessions"});
  }
})

router.post("/:sessionId/reset", async (req, res) => {
  const { sessionId } = req.params;
  try {
    await resetChatHistory(sessionId);
    res.json({ success: true, message: "Chat history reset successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to reset chat" });
  }
});


// DELETE /session/:id
router.delete("/:id", async (req, res) => {
  try {
    await clearSession(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to clear session" });
  }
});

module.exports=router;
