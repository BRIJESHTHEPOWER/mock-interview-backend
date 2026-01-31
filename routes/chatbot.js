// ============================================
// CHATBOT API ROUTE
// ============================================
// Handles AI chat requests using OpenRouter API

const express = require('express');
const router = express.Router();
const axios = require('axios');

// OpenRouter API configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// System prompt for the AI assistant
const SYSTEM_PROMPT = `You are an expert Interview Preparation Assistant and Technical Mentor. Your SOLE purpose is to help users prepare for job interviews and master coding concepts.

STRICT GUIDELINES:
1. ONLY answer questions related to:
   - Job interviews (behavioral, technical, system design)
   - Coding languages (syntax, logic, debugging, best practices)
   - Software development concepts
   - Resume building and career advice
2. DO NOT answer questions about movies, sports, entertainment, politics, general trivia, or any non-technical/non-career topics.
3. If a user asks about an off-topic subject (e.g., "What is the best movie?"), politely refuse by saying: "I specialize only in interview preparation and coding. Let's focus on your career goals."

YOUR ROLE:
1. Explain technical concepts clearly with code examples where applicable.
2. Provide constructive "build" advice—how to structure code, how to design systems, how to answer interview questions.
3. Teach the STAR method for behavioral questions.
4. Be professional, direct, and focused on skill-building.

When explaining code or technical concepts:
- Provide clear definitions.
- Use real-world examples.
- Show code snippets for "build" related questions.
- Relate topics back to what interviewers look for.

Keep responses professional, well-structured, and strictly focused on the user's technical and professional growth.`;

// POST /api/chatbot/message
router.post('/message', async (req, res) => {
    try {
        const { message, conversationHistory = [] } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                error: 'Message is required and must be a string'
            });
        }

        if (!OPENROUTER_API_KEY) {
            return res.status(500).json({
                error: 'OpenRouter API key not configured'
            });
        }

        // Build messages array with system prompt and conversation history
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...conversationHistory,
            { role: 'user', content: message }
        ];

        // Call OpenRouter API
        const response = await axios.post(
            OPENROUTER_API_URL,
            {
                model: 'tngtech/deepseek-r1t2-chimera:free',
                messages: messages,
                temperature: 0.7,
                max_tokens: 1000
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'HTTP-Referer': 'http://localhost:5173', // Your app URL
                    'X-Title': 'Interview Prep Assistant',
                    'Content-Type': 'application/json'
                }
            }
        );

        // Log the full response for debugging
        console.log('OpenRouter Response Status:', response.status);
        console.log('OpenRouter Response Data:', JSON.stringify(response.data, null, 2));

        if (!response.data || !response.data.choices || !response.data.choices.length) {
            console.error('❌ Unexpected OpenRouter response structure:', response.data);
            return res.status(502).json({
                error: 'Invalid response from AI provider. Please try again.'
            });
        }

        const aiResponse = response.data.choices[0].message.content;

        res.json({
            response: aiResponse,
            success: true
        });

    } catch (error) {
        console.error('OpenRouter API Error:', error.response?.data || error.message);

        if (error.response?.status === 401) {
            return res.status(401).json({
                error: 'Invalid OpenRouter API key'
            });
        }

        if (error.response?.status === 429) {
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
