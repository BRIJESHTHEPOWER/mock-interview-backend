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
const SYSTEM_PROMPT = `You are an expert Interview Preparation Assistant. Your role is to help users prepare for job interviews by:

1. Explaining technical concepts (backend, frontend, databases, APIs, frameworks, etc.)
2. Providing interview tips and strategies
3. Teaching the STAR method for behavioral questions
4. Offering advice on common interview questions
5. Helping with salary negotiation, body language, and professional communication
6. Building confidence and reducing interview anxiety

Always be:
- Professional and encouraging
- Clear and concise in explanations
- Practical with actionable advice
- Supportive and motivating
- Focused on career development

When explaining technical concepts, provide:
- Clear definitions
- Real-world examples
- Interview tips related to the topic
- Common technologies/tools

Keep responses well-structured with bullet points and sections when appropriate.`;

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
                model: 'meta-llama/llama-3.3-70b-instruct:free',
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
