// ============================================
// VOICE-BASED AI MOCK INTERVIEW PLATFORM
// FINAL PRODUCTION BACKEND
// ============================================

const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();
const { db } = require("./firebase");

const app = express();
const PORT = process.env.PORT || 10000;

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors({ origin: "*", credentials: true }));

// Allow large webhook payloads from Retell
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================
// ENV VALIDATION
// ============================================

const RETELL_API_KEY = process.env.RETELL_API_KEY;
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!RETELL_API_KEY || !RETELL_AGENT_ID || !OPENROUTER_API_KEY) {
  console.error("❌ Missing required environment variables");
  process.exit(1);
}

// ============================================
// HEALTH CHECK
// ============================================

app.get("/", (req, res) => {
  res.json({ status: "Mock Interview Backend Running" });
});

// ============================================
// CREATE INTERVIEW (RETELL)
// ============================================

app.post("/create-interview", async (req, res) => {
  try {
    const { jobRole } = req.body;

    if (!jobRole) {
      return res.status(400).json({ error: "jobRole required" });
    }

    const response = await axios.post(
      "https://api.retellai.com/v2/create-web-call",
      {
        agent_id: RETELL_AGENT_ID,
        retell_llm_dynamic_variables: {
          job_role: jobRole,
        },
        metadata: { jobRole },
      },
      {
        headers: {
          Authorization: `Bearer ${RETELL_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({
      success: true,
      callId: response.data.call_id,
      accessToken: response.data.access_token,
    });
  } catch (err) {
    console.error("❌ Create interview error:", err.message);
    res.status(500).json({ error: "Failed to create interview" });
  }
});

// ============================================
// RETELL WEBHOOK (FINAL + SAFE)
// ============================================

app.post("/retell/interview-complete", async (req, res) => {
  try {
    console.log("📩 Retell webhook received");

    // Only handle final event
    if (req.body.event !== "call_ended") {
      console.log("⏭️ Ignored event:", req.body.event);
      return res.status(200).json({ ignored: true });
    }

    const jobRole = req.body.metadata?.jobRole || "Software Engineer";
    const callId = req.body.call?.call_id || null;

    const transcript =
      req.body.call?.transcript ||
      req.body.call?.transcript_text ||
      null;

    if (!transcript) {
      console.error("❌ Transcript missing after call ended");
      return res.status(400).json({ error: "Transcript missing" });
    }

    console.log("🎙️ Interview ended for:", jobRole);

    const feedback = await generateFeedback(transcript, jobRole);
    console.log("🧠 Feedback generated");

    const docRef = await db.collection("interviews").add({
      jobRole,
      transcript,
      feedback,
      callId,
      createdAt: new Date(),
    });

    console.log("✅ Stored in Firestore:", docRef.id);

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Webhook error:", err.message);
    res.status(500).json({ error: "Webhook failed" });
  }
});

// ============================================
// FETCH LATEST FEEDBACK (FOR FRONTEND)
// ============================================

app.get("/interviews/latest", async (req, res) => {
  try {
    const snapshot = await db
      .collection("interviews")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.json({ success: true, feedback: null });
    }

    const data = snapshot.docs[0].data();

    res.json({
      success: true,
      jobRole: data.jobRole,
      feedback: data.feedback,
      createdAt: data.createdAt,
    });
  } catch (err) {
    console.error("❌ Fetch feedback error:", err.message);
    res.status(500).json({ error: "Failed to fetch feedback" });
  }
});

// ============================================
// OPENROUTER FEEDBACK GENERATOR
// ============================================

async function generateFeedback(transcript, jobRole) {
  const prompt = `
You are a professional interviewer.

Evaluate the completed interview for the role of ${jobRole}.

Provide:
- Strengths
- Weaknesses
- Communication
- Problem-solving
- Areas to improve
- Practical suggestions
- Overall summary
- Final score out of 10

Transcript:
${transcript}
`;

  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "meta-llama/llama-3.3-70b-instruct:free",
      max_tokens: 600,
      temperature: 0.7,
      messages: [
        { role: "system", content: "You are an interview evaluator." },
        { role: "user", content: prompt },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    }
  );

  return response.data.choices[0].message.content;
}

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log("=".repeat(50));
  console.log("🚀 Mock Interview Backend Started");
  console.log(`🎙️ Retell Agent: ${RETELL_AGENT_ID}`);
  console.log("=".repeat(50));
});
