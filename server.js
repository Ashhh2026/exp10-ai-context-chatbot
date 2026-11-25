const path = require("path");
const express = require("express");
const cors = require("cors");
const {
  PERSONAS,
  getOrCreateSession,
  resetSession,
  generateAssistantTurn,
  extractMemoryFacts,
} = require("./lib/chatEngine");

const app = express();
const PORT = process.env.PORT || 4010;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    experiment: 10,
    student: "Ashwarya Agrawal (23BCON1659)",
    personas: Object.keys(PERSONAS),
  });
});

app.get("/api/chat/:sessionId", (req, res) => {
  const session = getOrCreateSession(req.params.sessionId, req.query.persona || "tutor");
  const memoryFacts = extractMemoryFacts(session.messages.filter((m) => m.role === "user"));
  res.json({ session, memoryFacts });
});

app.post("/api/chat/:sessionId/message", async (req, res, next) => {
  try {
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const persona = typeof req.body?.persona === "string" ? req.body.persona.trim() : undefined;
    if (!message) {
      return res.status(400).json({ error: "Validation Error", details: { message: "Message is required." } });
    }
    const payload = await generateAssistantTurn(req.params.sessionId, message, persona);
    return res.status(201).json(payload);
  } catch (err) {
    return next(err);
  }
});

app.post("/api/chat/:sessionId/reset", (req, res) => {
  const persona = typeof req.body?.persona === "string" ? req.body.persona.trim() : "tutor";
  const session = resetSession(req.params.sessionId, persona);
  return res.status(200).json({ session, memoryFacts: [] });
});

app.use((err, req, res, next) => {
  res.status(500).json({ error: "Internal Server Error", message: err?.message || "Chat error" });
});

app.listen(PORT, () => {
  console.log(`Exp 10 Context Chatbot running at http://localhost:${PORT}`);
});
