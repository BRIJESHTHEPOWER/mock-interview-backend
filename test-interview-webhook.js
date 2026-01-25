// ============================================
// TEST FIREBASE INTEGRATION
// ============================================
// Test the complete flow: webhook -> AI feedback -> Firestore storage

const axios = require("axios");

const BACKEND_URL = "http://localhost:10000";

async function testInterviewComplete() {
    console.log("🧪 Testing Interview Complete Webhook with Firebase Storage\n");

    const testData = {
        transcript: `
Interviewer: Tell me about yourself.
Candidate: I'm a software engineer with 5 years of experience in full-stack development. I specialize in React and Node.js.

Interviewer: What's your biggest achievement?
Candidate: I led a team that built a real-time collaboration platform that serves 10,000+ users daily.

Interviewer: How do you handle technical challenges?
Candidate: I break down complex problems into smaller parts, research best practices, and collaborate with my team.
    `.trim(),
        metadata: {
            jobRole: "Senior Software Engineer",
        },
        callId: "test_call_" + Date.now(),
        userId: "test_user_123",
    };

    try {
        console.log("📤 Sending interview data to webhook...");
        console.log(`   Job Role: ${testData.metadata.jobRole}`);
        console.log(`   Transcript length: ${testData.transcript.length} chars\n`);

        const response = await axios.post(
            `${BACKEND_URL}/retell/interview-complete`,
            testData,
            {
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );

        console.log("✅ SUCCESS! Webhook Response:");
        console.log(`   Status: ${response.status}`);
        console.log(`   Message: ${response.data.message}`);
        console.log(`   Interview ID: ${response.data.interviewId}`);
        console.log(`\n📝 AI Feedback Preview:`);
        console.log(response.data.feedback.substring(0, 300) + "...\n");

        console.log("🎉 Test completed successfully!");
        console.log(
            "\n💡 Check Firebase Console to verify the data was stored:"
        );
        console.log(
            "   https://console.firebase.google.com/project/mock-interview-88899/firestore"
        );
        console.log(`   Collection: interviews`);
        console.log(`   Document ID: ${response.data.interviewId}\n`);
    } catch (error) {
        console.error("❌ Test Failed!");
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
        } else {
            console.error(`   Error: ${error.message}`);
        }
        console.error("\n💡 Make sure:");
        console.error("   1. Backend server is running (npm run dev)");
        console.error("   2. Firebase credentials are correct in .env");
        console.error("   3. OpenRouter API key is valid\n");
    }
}

// Run the test
testInterviewComplete();
