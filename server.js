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

    console.log(`🎯 Creating interview for role: ${jobRole}`);

    // ─── Step 1: Create a Retell LLM with job-specific prompt ──────────────
    // In Retell API v2 the LLM (prompt/instructions) is a separate resource.
    // We must create it first, then attach it to an agent.
    const agentPrompt = `You are a professional AI interviewer conducting a ${jobRole} interview.

IMPORTANT — INTERVIEW TYPE:
- This is a ${jobRole} interview. Always remember this.
- If the candidate asks "which interview is this?", "what kind of interview is this?", "what role is this interview for?", or any similar question, always clearly answer: "This is a ${jobRole} interview."
- Always introduce yourself as the AI interviewer for the "${jobRole}" position at the very beginning.

INTERVIEW STRUCTURE:
1. Start with: "Welcome! This is your ${jobRole} interview. I'll be your AI interviewer today." Then ask the candidate to briefly introduce themselves.
2. Ask 3-4 technical questions specifically for a ${jobRole} role.
3. Ask 1-2 behavioral / situational questions.
4. Wrap up by thanking the candidate and ending politely.

SPEAKING RULES:
- Keep every response SHORT (1-3 sentences max).
- Only ask ONE question at a time — wait for the full answer before continuing.
- Acknowledge answers briefly ("Great, thank you." / "Interesting.") before moving on.
- Speak clearly and at a moderate pace.
- Do NOT repeat yourself.
- Do NOT give away answers or hints.
- If asked what interview is going on, ALWAYS say it is a "${jobRole}" interview.

TECHNICAL AREAS TO COVER FOR ${jobRole}:
- Core concepts and fundamentals specific to the ${jobRole} field.
- Practical, real-world scenarios and problem-solving.
- Tools, frameworks, and best practices used in ${jobRole} roles.

END THE INTERVIEW after completing the structure above. Thank the candidate professionally.`;

    let customAgentId = RETELL_AGENT_ID; // fallback

    try {
      // Step 1a: Create the Retell LLM (prompt engine)
      console.log("📝 Creating Retell LLM with job-specific prompt...");
      const llmResponse = await axios.post(
        "https://api.retellai.com/v2/create-retell-llm",
        {
          model: "gpt-4o-mini",
          general_prompt: agentPrompt,
          begin_message: `Hello! Welcome. This is your ${jobRole} interview. I'm your AI interviewer today. To get us started, could you please give me a brief introduction about yourself and your background in ${jobRole}?`,
          general_tools: [],
          states: [],
        },
        {
          headers: {
            Authorization: `Bearer ${RETELL_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 20000,
        }
      );

      const llmId = llmResponse.data.llm_id;
      console.log(`✅ Created Retell LLM: ${llmId}`);

      // Step 1b: Create the Agent referencing the LLM
      console.log("🤖 Creating Retell Agent...");
      const agentResponse = await axios.post(
        "https://api.retellai.com/v2/create-agent",
        {
          agent_name: `${jobRole} Interviewer`,
          voice_id: "openai-Alloy",
          language: "en-US",
          response_engine: {
            type: "retell-llm",
            llm_id: llmId,
          },
          // Conversation behaviour
          responsiveness: 0.5,
          interruption_sensitivity: 0.3,
          enable_backchannel: false,
          // Audio
          normalize_for_speech: true,
          voice_speed: 0.95,
          voice_temperature: 0.7,
          // Timing
          reminder_trigger_ms: 10000,
          reminder_max_count: 2,
          end_call_after_silence_ms: 30000,
          max_call_duration_ms: 600000,
        },
        {
          headers: {
            Authorization: `Bearer ${RETELL_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 20000,
        }
      );

      customAgentId = agentResponse.data.agent_id;
      console.log(`✅ Created custom agent: ${customAgentId}`);

    } catch (agentErr) {
      console.error(
        "⚠️ Failed to create custom agent — falling back to default agent:",
        agentErr.response?.data || agentErr.message
      );
      // Fallback to generic agent; job role is still passed as dynamic variable below
      customAgentId = RETELL_AGENT_ID;
    }

    // ─── Step 2: Create the web call ───────────────────────────────────────
    const response = await axios.post(
      "https://api.retellai.com/v2/create-web-call",
      {
        agent_id: customAgentId,
        // Pass jobRole as a dynamic variable so the default agent
        // can also reference it if needed. Provide both formats to be safe.
        retell_llm_dynamic_variables: { 
            job_role: jobRole,
            jobRole: jobRole
        },
        sample_rate: 24000,
        enable_update: true,
      },
      {
        headers: {
          Authorization: `Bearer ${RETELL_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 20000,
      }
    );

    console.log(`✅ Web call created: ${response.data.call_id}`);

    res.json({
      success: true,
      callId: response.data.call_id,
      accessToken: response.data.access_token,
      agentId: customAgentId,
    });

  } catch (err) {
    console.error("❌ Create interview error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to create interview" });
  }
});

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
      endedAt: new Date(),
    };

    // Only set duration if it wasn't already set by the frontend
    // The frontend calculates it accurately, so we preserve it
    if (!existingQuery.empty) {
      const existingData = existingQuery.docs[0].data();
      if (!existingData.duration || existingData.duration === 0) {
        // Only use backend duration if frontend didn't set it
        interviewData.duration = duration;
      }
      // Otherwise, preserve the frontend's duration (don't overwrite)
    } else {
      // New document, use backend duration
      interviewData.duration = duration;
    }

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
      console.log(`🔍 VERIFICATION - Saved feedback length: ${savedData.feedback?.length || 0}`);
      console.log(`🔍 VERIFICATION - Saved userId: ${savedData.userId || 'MISSING!'}`);
      console.log(`🔍 VERIFICATION - Saved status: ${savedData.status}`);
      console.log(`🔍 VERIFICATION - Document ID: ${docRef.id}`);

      if (savedData.status !== 'completed') {
        console.error(`❌ ERROR: Status was not set to 'completed'! Current status: ${savedData.status}`);
      }
      if (!savedData.feedback) {
        console.error(`❌ ERROR: Feedback was not saved to Firestore!`);
      }
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

    // Wait longer for Retell to process (3s for better reliability on Render)
    console.log('⏳ Waiting 3 seconds for Retell to process transcript...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Retry logic for fetching call data
    let callData;
    let retries = 3;

    for (let i = 0; i < retries; i++) {
      try {
        console.log(`🔄 Attempt ${i + 1}/${retries} to fetch call data...`);
        const retellResponse = await axios.get(
          `https://api.retellai.com/v2/get-call/${callId}`,
          {
            headers: { Authorization: `Bearer ${RETELL_API_KEY}` },
            timeout: 15000 // 15 second timeout
          }
        );
        callData = retellResponse.data;
        console.log('✅ Call data fetched successfully');
        break;
      } catch (err) {
        console.error(`❌ Attempt ${i + 1} failed:`, err.message);
        if (i === retries - 1) {
          throw new Error('Failed to fetch call data from Retell after 3 attempts');
        }
        // Wait 2 seconds before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

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
    console.log(`📊 Transcript length: ${safeTranscript.length} chars`);

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "You are a concise interview evaluator." },
        { role: "user", content: prompt },
      ],
      model: "llama-3.3-70b-versatile", // Fast, high-quality Groq model
      temperature: 0.7,
      max_tokens: 500
    });

    const feedback = chatCompletion.choices[0]?.message?.content;

    if (!feedback || feedback.trim().length === 0) {
      throw new Error('Empty feedback received from Groq');
    }

    console.log('✅ Groq feedback generated successfully');
    console.log(`📝 Feedback length: ${feedback.length} chars`);
    return feedback;

  } catch (error) {
    console.error('❌ Groq API Error:', error.message);
    console.error('Error details:', {
      name: error.name,
      code: error.code,
      status: error.status
    });

    // Return fallback feedback instead of failing completely
    return `Interview Feedback for ${jobRole}:

We encountered an issue generating detailed AI feedback. However, your interview was recorded successfully.

Transcript Summary:
- Interview duration: ${Math.round(safeTranscript.length / 100)} minutes (estimated)
- Topics discussed: ${jobRole} related questions

Please try again or contact support if this issue persists.

Note: This is a fallback message due to AI service unavailability.`;
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
