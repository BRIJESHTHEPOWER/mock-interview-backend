// ============================================
// CHATBOT API ROUTE
// ============================================
// Handles AI chat requests using Groq SDK

const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');

// Initialize Groq client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// System prompt for the AI assistant
const SYSTEM_PROMPT = `You are a professional mock interview and technical mentor. Your goal is to help users prepare for job interviews and master coding concepts.

SPEAKING & INTERACTION RULES:
1. Speak clearly and use short, manageable sentences.
2. Ask ONE question at a time and wait for a full response.
3. If input is unclear, say: "Take your time — please continue when you're ready."
4. Be calm, patient, and professional. Avoid long monologues.

STRICT GUIDELINES:
1. ONLY answer questions related to interviews, coding, software development, and careers.
2. DO NOT answer questions about unrelated topics (movies, sports, politics, etc.).
3. Transition clearly: "Next question", "Moving on".

YOUR ROLE:
1. Explain technical concepts with code examples.
2. Teach the STAR method for behavioral questions.
3. Provide constructive feedback only after the user finishes their thought.`;

// POST /api/chatbot/message
router.post('/message', async (req, res) => {
    console.log('🤖 Chatbot request received');
    console.log('Request body:', req.body);

    try {
        const { message, conversationHistory = [] } = req.body;

        if (!message || typeof message !== 'string') {
            console.log('❌ Invalid message:', message);
            return res.status(400).json({
                error: 'Message is required and must be a string'
            });
        }

        if (!process.env.GROQ_API_KEY) {
            console.log('❌ Groq API key not found in environment');
            return res.status(500).json({
                error: 'Groq API key not configured'
            });
        }

        console.log('✅ Groq API key is configured');

        // Build messages array with system prompt and conversation history
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...conversationHistory,
            { role: 'user', content: message }
        ];

        // Call Groq API
        const chatCompletion = await groq.chat.completions.create({
            messages: messages,
            model: 'llama-3.3-70b-versatile', // Fast, high-quality Groq model
            temperature: 0.7,
            max_tokens: 1000
        });

        console.log('✅ Groq chatbot response generated');

        const aiResponse = chatCompletion.choices[0]?.message?.content;

        if (!aiResponse) {
            console.error('❌ No response from Groq');
            return res.status(502).json({
                error: 'Invalid response from AI provider. Please try again.'
            });
        }

        res.json({
            response: aiResponse,
            success: true
        });

    } catch (error) {
        console.error('Groq API Error:', error.message);

        if (error.status === 401) {
            return res.status(401).json({
                error: 'Invalid Groq API key'
            });
        }

        if (error.status === 429) {
            return res.status(429).json({
                error: 'Rate limit exceeded. Please try again later.'
            });
        }

        res.status(500).json({
            error: 'Failed to get AI response. Please try again.'
        });
    }
});

module.exports = router;
