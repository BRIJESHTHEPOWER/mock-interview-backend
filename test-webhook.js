// ============================================
// TEST RETELL WEBHOOK LOCALLY
// ============================================
// Simulates a Retell AI webhook call to test feedback generation

const axios = require('axios');

const BACKEND_URL = 'http://localhost:5000';

// Sample transcript for testing
const sampleTranscript = `
Interviewer: Hello! Thank you for joining us today. Let's start with a simple question - can you tell me about yourself and your experience as a Software Engineer?

Candidate: Sure! I have about 3 years of experience working as a full-stack developer. I've worked primarily with React and Node.js, building web applications for e-commerce platforms.

Interviewer: That's great! Can you describe a challenging project you worked on recently?

Candidate: Yes, I worked on optimizing our checkout flow which was experiencing high cart abandonment rates. I implemented lazy loading, reduced bundle sizes, and improved the API response times. This resulted in a 25% increase in completed transactions.

Interviewer: Excellent! How do you handle debugging in production environments?

Candidate: I use a combination of logging tools like Sentry for error tracking, and I always ensure we have proper monitoring in place. I also believe in writing comprehensive tests to catch issues before they reach production.

Interviewer: What's your experience with databases?

Candidate: I've worked with both SQL and NoSQL databases. Primarily PostgreSQL and MongoDB. I understand indexing, query optimization, and data modeling.

Interviewer: Great! Do you have any questions for me?

Candidate: Yes, what does the team structure look like and what technologies does the team primarily use?

Interviewer: We have a team of 8 engineers working in agile sprints. We use React, Node.js, and AWS primarily. Thank you for your time today!
`;

async function testWebhook() {
    try {
        console.log('🧪 Testing Retell Webhook...\n');

        // Simulate Retell AI webhook payload
        const webhookPayload = {
            event: 'call_analyzed',
            call: {
                call_id: `test_call_${Date.now()}`,
                transcript: sampleTranscript,
                call_duration: 420, // 7 minutes
                start_timestamp: Math.floor(Date.now() / 1000) - 420,
                retell_llm_dynamic_variables: {
                    job_role: 'Software Engineer'
                }
            }
        };

        console.log('📤 Sending webhook payload to backend...');
        console.log('Call ID:', webhookPayload.call.call_id);
        console.log('Transcript length:', sampleTranscript.length, 'chars\n');

        const response = await axios.post(
            `${BACKEND_URL}/retell/interview-complete`,
            webhookPayload,
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 60000 // 60 second timeout for AI generation
            }
        );

        console.log('✅ Webhook Response:');
        console.log(JSON.stringify(response.data, null, 2));

        if (response.data.success) {
            console.log('\n🎉 SUCCESS! Interview processed and stored in Firestore');
            console.log('Interview ID:', response.data.interviewId);
            console.log('\n📝 Feedback Preview:');
            console.log(response.data.feedbackPreview);
        } else {
            console.log('\n⚠️ Webhook received but processing may have failed');
        }

    } catch (error) {
        console.error('\n❌ Test Failed:');
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
    }
}

testWebhook();
