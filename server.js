// ============================================
// VOICE-BASED AI MOCK INTERVIEW PLATFORM
// FINAL PRODUCTION BACKEND (FIXED)
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
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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
// CREATE INTERVIEW
// ============================================

app.post("/create-interview", async (req, res) => {
  try {
    const { jobRole } = req.body;
    if (!jobRole) return res.status(400).json({ error: "jobRole required" });

    // ✅ REMOVED metadata field - this was causing the decoder error
    const response = await axios.post(
      "https://api.retellai.com/v2/create-web-call",
      {
        agent_id: RETELL_AGENT_ID,
        retell_llm_dynamic_variables: { job_role: jobRole },
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
// CHATBOT API ROUTE
// ============================================

const chatbotRouter = require('./routes/chatbot');
app.use('/api/chatbot', chatbotRouter);

// ============================================
// RETELL WEBHOOK (COMPLETELY REWRITTEN)
// ============================================

app.post("/retell/interview-complete", async (req, res) => {
  console.log("📩 Retell webhook received");
  console.log("📦 Full Payload:", JSON.stringify(req.body, null, 2));

  try {
    const payload = req.body;

    // ✅ HANDLE RETELL AI WEBHOOK FORMAT
    // Retell sends: { event: "call_ended", call: { call_id, transcript, ... } }
    let transcript, jobRole, callId, userId, duration, startedAt;

    // Extract from Retell webhook structure
    const callData = payload.call || payload;

    transcript = callData.transcript || callData.transcript_text || "";
    callId = callData.call_id || callData.callId || `call_${Date.now()}`;

    // Try to get jobRole from multiple sources (supports both Retell webhook and internal calls)
    const dynamicVars = callData.retell_llm_dynamic_variables || {};
    jobRole = payload.jobRole || callData.jobRole || dynamicVars.job_role || callData.job_role || "Frontend Developer";

    // Get userId if available (we'll need to match with existing interview record)
    userId = payload.userId || callData.userId || null;

    // Get call duration and start time if available
    duration = callData.call_duration || callData.duration || 0;
    startedAt = callData.start_timestamp ? new Date(callData.start_timestamp * 1000) : new Date();

    console.log(`📞 Call ID: ${callId}`);
    console.log(`🎙️ Job Role: ${jobRole}`);
    console.log(`📝 Transcript length: ${transcript.length} chars`);
    console.log(`⏱️ Duration: ${duration}s`);

    // Validate transcript
    if (!transcript || transcript.trim().length < 10) {
      console.warn("⚠️ Transcript missing or too short, skipping feedback");
      return res.status(200).json({
        received: true,
        message: "Transcript too short, skipped"
      });
    }

    // Generate AI feedback
    console.log("🧠 Generating AI feedback...");
    const feedback = await generateFeedback(transcript, jobRole);
    console.log("✅ Feedback generated successfully");
    console.log(`📄 Feedback preview: ${feedback.substring(0, 200)}...`);

    // Find existing interview by callId or create new one
    const interviewsRef = db.collection("interviews");
    const existingQuery = await interviewsRef.where("callId", "==", callId).limit(1).get();

    let docRef;
    const interviewData = {
      jobRole,
      transcript,
      feedback,
      callId,
      status: 'completed',
      duration,
      endedAt: new Date(),
    };

    if (!existingQuery.empty) {
      // Update existing interview
      docRef = existingQuery.docs[0].ref;
      await docRef.update(interviewData);
      console.log(`✅ Updated existing interview in Firestore: ${docRef.id}`);
    } else {
      // Create new interview
      interviewData.startedAt = startedAt;
      if (userId) interviewData.userId = userId;

      docRef = await interviewsRef.add(interviewData);
      console.log(`✅ Created new interview in Firestore: ${docRef.id}`);
    }

    // Return success with data for testing
    res.status(200).json({
      received: true,
      success: true,
      message: "Interview processed successfully",
      interviewId: docRef.id,
      feedbackPreview: feedback.substring(0, 300)
    });

  } catch (err) {
    console.error("❌ Webhook processing failed:", err.message);
    console.error("Stack:", err.stack);

    // Still return 200 to Retell to prevent retries
    res.status(200).json({
      received: true,
      error: err.message
    });
  }
});

// ============================================
// PROCESS INTERVIEW (Fetch from Retell + Generate Feedback)
// ============================================

app.post("/process-interview", async (req, res) => {
  try {
    const { callId, userId, jobRole } = req.body;

    if (!callId) {
      return res.status(400).json({ error: "callId required" });
    }

    console.log(`📞 Processing interview for callId: ${callId}`);
    console.log(`👤 User ID: ${userId}`);
    console.log(`💼 Job Role: ${jobRole}`);

    // Add a small delay to allow Retell to process the transcript
    console.log('⏳ Waiting 3 seconds for Retell to process transcript...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Fetch transcript from Retell
    console.log('🔄 Fetching transcript from Retell...');
    const retellResponse = await axios.get(
      `https://api.retellai.com/v2/get-call/${callId}`,
      {
        headers: {
          Authorization: `Bearer ${RETELL_API_KEY}`,
        },
      }
    );

    console.log('📦 Retell Response Status:', retellResponse.status);
    const transcript = retellResponse.data.transcript || retellResponse.data.transcript_text;

    if (!transcript || transcript.trim().length < 10) {
      console.warn('⚠️ Transcript too short or unavailable');
      console.log('Transcript length:', transcript ? transcript.length : 0);
      return res.json({
        success: false,
        message: "Transcript too short or unavailable"
      });
    }

    console.log(`✅ Transcript fetched successfully (${transcript.length} chars)`);

    // Trigger webhook processing
    const webhookPayload = {
      transcript,
      callId,
      userId,
      jobRole: jobRole || "Frontend Developer",
    };

    console.log('🔄 Triggering internal webhook processing...');
    // Process via webhook internally
    const webhookResponse = await axios.post(
      `http://localhost:${PORT}/retell/interview-complete`,
      webhookPayload
    );

    console.log('✅ Webhook processing completed:', webhookResponse.data);

    res.json({
      success: true,
      message: "Interview processing started",
      interviewId: webhookResponse.data.interviewId
    });

  } catch (err) {
    console.error("❌ Process interview error:", err.message);
    console.error("Error details:", err.response?.data || err);
    res.status(500).json({ error: "Failed to process interview", details: err.message });
  }
});

// ============================================
// FETCH LATEST FEEDBACK
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
      duration: data.duration, // Include duration
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
      temperature: 0.7,
      max_tokens: 600,
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
  console.log(`🌐 Listening on port ${PORT}`);
  console.log("=".repeat(50));
});
