// ============================================
// VOICE-BASED AI MOCK INTERVIEW PLATFORM
// Backend Server - Node.js + Express (FIXED)
// ============================================

const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();
const { db } = require("./firebase");

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// MIDDLEWARE (FIXED PAYLOAD LIMIT)
// ============================================

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

// ✅ FIX: Allow large Retell webhook payload
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Request logger
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

if (!RETELL_API_KEY || !RETELL_AGENT_ID) {
  console.error("❌ Missing RETELL_API_KEY or RETELL_AGENT_ID");
  process.exit(1);
}

if (!OPENROUTER_API_KEY) {
  console.error("❌ Missing OPENROUTER_API_KEY");
  process.exit(1);
}

// ============================================
// HEALTH CHECK
// ============================================

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Mock Interview Backend Running",
    time: new Date().toISOString(),
  });
});

// ============================================
// CREATE INTERVIEW (RETELL)
// ============================================

app.post("/create-interview", async (req, res) => {
  try {
    const { jobRole } = req.body;

    if (!jobRole || typeof jobRole !== "string") {
      return res.status(400).json({
        success: false,
        error: "jobRole is required",
      });
    }

    const response = await axios.post(
      "https://api.retellai.com/v2/create-web-call",
      {
        agent_id: RETELL_AGENT_ID,
        retell_llm_dynamic_variables: {
          job_role: jobRole.trim(),
          candidate_name: "Candidate",
        },
        metadata: { jobRole: jobRole.trim() },
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
      agentId: RETELL_AGENT_ID,
    });
  } catch (err) {
    console.error("❌ Retell Error:", err.response?.data || err.message);
    res.status(500).json({
      success: false,
      error: "Failed to create interview",
    });
  }
});

// ============================================
// RETELL INTERVIEW COMPLETED WEBHOOK (FIXED)
// ============================================

app.post("/retell/interview-complete", async (req, res) => {
  try {
    console.log("📩 Retell webhook received");

    const metadata = req.body.metadata || {};
    const jobRole = metadata.jobRole || "Software Engineer";
    const callId = req.body.call_id || null;

    // ✅ FIX: Correct transcript extraction
    const transcript =
      req.body.transcript_object?.transcript ||
      req.body.transcript ||
      null;

    if (!transcript) {
      console.error("❌ Transcript missing in webhook payload");
      return res.status(400).json({ error: "Transcript missing" });
    }

    console.log("🎙️ Interview completed for:", jobRole);

    // Generate AI feedback
    const feedback = await generateFeedback(transcript, jobRole);
    console.log("🧠 Feedback generated");

    // Store in Firestore
    const interviewData = {
      userId: req.body.user_id || "anonymous",
      jobRole,
      transcript,
      feedback,
      callId,
      createdAt: new Date(),
    };

    const docRef = await db.collection("interviews").add(interviewData);
    console.log("✅ Stored in Firestore:", docRef.id);

    res.status(200).json({
      success: true,
      interviewId: docRef.id,
    });
  } catch (err) {
    console.error("❌ Webhook Error:", err.message);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// ============================================
// OPENROUTER FEEDBACK GENERATOR (HARDENED)
// ============================================

async function generateFeedback(transcript, jobRole) {
  const prompt = `
You are an experienced interviewer and career coach.

Evaluate the completed interview for the role of ${jobRole}.

Provide:
- Strengths
- Weaknesses
- Communication
- Problem-solving
- Improvements
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
        { role: "system", content: "You are a professional interview evaluator." },
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
// 404 + GLOBAL ERROR
// ============================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
  });
});

app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log("=".repeat(50));
  console.log("🚀 Mock Interview Backend Started");
  console.log(`🎙️ Retell Agent: ${RETELL_AGENT_ID}`);
  console.log("=".repeat(50));
});
