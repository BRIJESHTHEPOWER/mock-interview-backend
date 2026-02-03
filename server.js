// ============================================
// VOICE-BASED AI MOCK INTERVIEW PLATFORM
// FINAL PRODUCTION BACKEND (FIXED)
// ============================================

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const Groq = require("groq-sdk");
require("dotenv").config();
const { db } = require("./firebase");

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// ENV VALIDATION
// ============================================

const RETELL_API_KEY = process.env.RETELL_API_KEY;
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${PORT}`;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

if (!RETELL_API_KEY || !RETELL_AGENT_ID || !GROQ_API_KEY) {
  console.error("❌ Missing required environment variables");
  process.exit(1);
}

// Initialize Groq client
const groq = new Groq({ apiKey: GROQ_API_KEY });

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors({
  origin: [
    FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:5000',
    'https://mock-interview-frontend-0e2x.onrender.com'
  ],
  credentials: true
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});



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

    // [NEW] Save initial interview state to Firestore to track "Live" status
    const callId = response.data.call_id;
    await db.collection("interviews").add({
      callId: callId,
      jobRole: jobRole,
      userId: req.body.userId, // Save userId from request
      status: "started", // Marks it as live
      createdAt: new Date(),
    });

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

// ============================================
// CHATBOT API ROUTE
// ============================================

const chatbotRouter = require('./routes/chatbot');
app.use('/api/chatbot', chatbotRouter);

// Feedback Submission Route (Public/Authenticated)
app.post('/api/feedback', async (req, res) => {
  try {
    const { userId, rating, message, category } = req.body;
    // Basic validation
    if (!rating || !message) {
      return res.status(400).json({ error: 'Rating and message are required' });
    }

    const feedbackData = {
      userId: userId || 'anonymous',
      rating: Number(rating),
      message,
      category: category || 'General',
      createdAt: new Date(),
      status: 'new' // new, read, archived
    };

    await db.collection('platform_feedback').add(feedbackData);
    res.json({ success: true, message: 'Feedback received' });
  } catch (error) {
    console.error("Feedback Error:", error);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

const adminRouter = require('./routes/admin');
app.use('/api/admin', adminRouter);

// ============================================
// NEWSLETTER SUBSCRIPTION
// ============================================
app.post('/api/subscribe', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    // Check if already subscribed
    const existing = await db.collection('newsletter_subscribers').doc(email).get();
    if (existing.exists) {
      return res.json({ success: true, message: "Already subscribed" });
    }

    await db.collection('newsletter_subscribers').doc(email).set({
      email,
      subscribedAt: new Date(),
      source: 'footer'
    });

    res.json({ success: true, message: "Subscribed successfully" });
  } catch (error) {
    console.error("Subscription Error:", error);
    res.status(500).json({ error: "Failed to subscribe" });
  }
});

// ============================================
// RETELL WEBHOOK (COMPLETELY REWRITTEN)
// ============================================

// Shared function to process interview data (to avoid HTTP round-trips)
async function processInterviewData(payload) {
  try {
    console.log("� Processing Interview Data Internal...");

    let transcript, jobRole, callId, userId, duration, startedAt;

    // Extract from payload (supports both Retell webhook and manual structure)
    const callData = payload.call || payload;

    transcript = callData.transcript || callData.transcript_text || "";
    callId = callData.call_id || callData.callId || `call_${Date.now()}`;
    userId = payload.userId || callData.userId || null;

    const dynamicVars = callData.retell_llm_dynamic_variables || {};
    jobRole = payload.jobRole || callData.jobRole || dynamicVars.job_role || callData.job_role || "Frontend Developer";

    // Extract duration - Retell returns it in seconds
    duration = callData.call_duration || callData.duration || callData.end_timestamp - callData.start_timestamp || 0;
    startedAt = callData.start_timestamp ? new Date(callData.start_timestamp * 1000) : new Date();

    console.log(`📞 Call ID: ${callId}`);
    console.log(`📝 Transcript length: ${transcript.length}`);
    console.log(`⏱️ Duration: ${duration} seconds`);

    // Handle short transcripts gracefully instead of skipping
    let feedback = "No feedback generated.";

    if (!transcript || transcript.trim().length < 5) {
      console.warn("⚠️ Transcript very short. Generating fallback feedback.");
      feedback = "The interview audio was too short or unclear to generate detailed feedback. Please ensure your microphone is working and try speaking in longer sentences.";
      // Still save it so user sees *something*
    } else {
      console.log("🧠 Generating AI feedback...");
      feedback = await generateFeedback(transcript, jobRole);
      console.log(`📊 Transcript preview (first 200 chars): ${transcript.substring(0, 200)}...`);
      console.log(`🎯 Feedback preview (first 200 chars): ${feedback.substring(0, 200)}...`);
    }

    // Save to Firestore
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
      docRef = existingQuery.docs[0].ref;
      // Preserve userId if it exists in the document
      const existingData = existingQuery.docs[0].data();
      if (existingData.userId) {
        interviewData.userId = existingData.userId;
      } else if (userId) {
        interviewData.userId = userId; // Add userId if missing
      }
      console.log('📝 Updating interview with data:', JSON.stringify(interviewData, null, 2));
      await docRef.update(interviewData);
      console.log(`✅ Updated existing interview: ${docRef.id}`);
      console.log(`✅ Feedback saved (${feedback.length} chars): ${feedback.substring(0, 100)}...`);

      // Verify the save by reading it back
      const verifyDoc = await docRef.get();
      const savedData = verifyDoc.data();
      console.log(`🔍 VERIFICATION - Saved feedback exists: ${!!savedData.feedback}`);
      console.log(`🔍 VERIFICATION - Saved userId: ${savedData.userId || 'MISSING!'}`);
      console.log(`🔍 VERIFICATION - Saved status: ${savedData.status}`);
    } else {
      interviewData.startedAt = startedAt;
      if (userId) interviewData.userId = userId;
      console.log('📝 Creating new interview with data:', JSON.stringify(interviewData, null, 2));
      docRef = await interviewsRef.add(interviewData);
      console.log(`✅ Created new interview: ${docRef.id}`);
      console.log(`✅ Feedback saved (${feedback.length} chars): ${feedback.substring(0, 100)}...`);
    }

    return { success: true, interviewId: docRef.id, feedbackPreview: feedback.substring(0, 50) };

  } catch (error) {
    console.error("❌ Internal Processing Error:", error);
    throw error;
  }
}

app.post("/retell/interview-complete", async (req, res) => {
  console.log("📩 Retell webhook received");
  try {
    const result = await processInterviewData(req.body);
    res.status(200).json(result);
  } catch (err) {
    console.error("Webhook Error:", err);
    res.status(200).json({ received: true, error: err.message }); // 200 to stop retries
  }
});

app.post("/process-interview", async (req, res) => {
  try {
    const { callId, userId, jobRole } = req.body;
    console.log(`📞 /process-interview called with:`, { callId, userId, jobRole });

    if (!callId) {
      console.error('❌ Missing callId in request');
      return res.status(400).json({ error: "callId required" });
    }

    console.log(`📞 Manual processing for: ${callId}`);

    // Wait for Retell (reduced from 3s to 1.5s for faster feedback)
    await new Promise(resolve => setTimeout(resolve, 1500));

    const retellResponse = await axios.get(
      `https://api.retellai.com/v2/get-call/${callId}`,
      { headers: { Authorization: `Bearer ${RETELL_API_KEY}` } }
    );

    const callData = retellResponse.data;

    // Merge with manual data
    const payload = {
      ...callData,
      userId,
      jobRole: jobRole || callData.retell_llm_dynamic_variables?.job_role
    };

    // Call internally directly
    const result = await processInterviewData(payload);

    res.json({ success: true, message: "Processed successfully", interviewId: result.interviewId });

  } catch (err) {
    console.error("Process Error:", err.message);
    res.status(500).json({ error: "Failed to process", details: err.message });
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
  // Truncate transcript to prevent context window overflow (approx 15k chars)
  const safeTranscript = transcript.length > 15000
    ? transcript.substring(0, 15000) + "...(truncated)"
    : transcript;

  // Streamlined prompt for faster generation
  const prompt = `Evaluate this ${jobRole} interview. Provide:
1. Overall Score (X/10)
2. Key Strengths (2-3 bullet points)
3. Areas to Improve (2-3 bullet points)
4. Brief Summary (2-3 sentences)

Transcript:
${safeTranscript}`;

  try {
    console.log('🧠 Generating feedback with Groq...');

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "You are a concise interview evaluator." },
        { role: "user", content: prompt },
      ],
      model: "llama-3.3-70b-versatile", // Fast, high-quality Groq model
      temperature: 0.7,
      max_tokens: 500,
    });

    console.log('✅ Groq feedback generated successfully');
    return chatCompletion.choices[0]?.message?.content || "Feedback generation failed.";

  } catch (error) {
    console.error('❌ Groq API Error:', error.message);
    return "Feedback generation failed due to AI provider error.";
  }
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
