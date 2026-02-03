// Test Groq API connection
const Groq = require('groq-sdk');
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function testGroq() {
    try {
        console.log('Testing Groq API...');
        console.log('API Key:', process.env.GROQ_API_KEY ? 'Configured ✅' : 'Missing ❌');

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: 'user', content: 'Say "Hello, Groq is working!"' }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.7,
            max_tokens: 50,
        });

        console.log('\n✅ Groq API Response:');
        console.log(chatCompletion.choices[0]?.message?.content);
        console.log('\n✅ Groq is working correctly!');

    } catch (error) {
        console.error('\n❌ Groq API Error:');
        console.error('Message:', error.message);
        console.error('Status:', error.status);
        console.error('\nFull error:', error);
    }
}

testGroq();
