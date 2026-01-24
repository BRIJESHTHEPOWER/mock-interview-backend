// ============================================
// VOICE-BASED AI MOCK INTERVIEW PLATFORM
// Backend Server - Node.js + Express (FIXED)
// ============================================

const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// MIDDLEWARE
// ============================================

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

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
// RETELL INTERVIEW COMPLETED WEBHOOK
// ============================================

app.post("/retell/interview-complete", async (req, res) => {
  try {
    const { transcript, metadata } = req.body;
    const jobRole = metadata?.jobRole || "Software Engineer";

    if (!transcript) {
      return res.status(400).json({
        success: false,
        error: "Transcript missing",
      });
    }

    console.log("🎙️ Interview completed for:", jobRole);

    const feedback = await generateFeedback(transcript, jobRole);

    // For now just log (later store in Firebase)
    console.log("🧠 FEEDBACK RESULT:\n", feedback);

    res.json({
      success: true,
      message: "Feedback generated successfully",
    });
  } catch (err) {
    console.error("❌ Feedback Generation Error:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to generate feedback",
    });
  }
});

// ============================================
// OPENROUTER FEEDBACK GENERATOR
// ============================================

async function generateFeedback(transcript, jobRole) {
  const prompt = `
You are an experienced interviewer and career coach specializing in hiring for the role of ${jobRole}.

Analyze the following completed voice-based mock interview transcript and generate structured feedback.

Evaluate the candidate on:
1. Role-specific strengths
2. Role-specific weaknesses
3. Communication skills
4. Problem-solving ability
5. Areas to improve
6. Practical suggestions
7. Overall summary
8. Final score out of 10

Interview Transcript:
${transcript}
`;

  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "meta-llama/llama-3.3-70b-instruct:free",
      messages: [
        {
          role: "system",
          content: "You are a professional interview evaluator.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
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
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🎙️ Retell Agent: ${RETELL_AGENT_ID}`);
  console.log("=".repeat(50));
});
