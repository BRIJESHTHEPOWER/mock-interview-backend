const axios = require("axios");

async function testHealth() {
    console.log("Testing server health check...\n");

    try {
        const response = await axios.get("http://localhost:10000/");
        console.log("✅ Server is running!");
        console.log("Response:", response.data);
        return true;
    } catch (error) {
        console.log("❌ Server not responding on port 10000");
        console.log("Error:", error.message);
        return false;
    }
}

async function testWebhook() {
    console.log("\nTesting webhook endpoint...\n");

    try {
        const response = await axios.post("http://localhost:10000/retell/interview-complete", {
            transcript: "Interviewer: Tell me about yourself. Candidate: I am a software engineer with 5 years of experience in React and Node.js. I have worked on several full-stack projects.",
            userId: "test_user_123",
            jobRole: "Software Engineer",
            callId: "test_" + Date.now()
        }, {
            timeout: 30000
        });

        console.log("✅ Webhook SUCCESS!");
        console.log("Interview ID:", response.data.interviewId);
        console.log("Feedback preview:", response.data.feedback?.substring(0, 200) + "...");
    } catch (error) {
        console.log("❌ Webhook FAILED!");
        if (error.response) {
            console.log("Status:", error.response.status);
            console.log("Error:", error.response.data);
        } else {
            console.log("Error:", error.message);
        }
    }
}

async function runTests() {
    const serverOk = await testHealth();
    if (serverOk) {
        await testWebhook();
    } else {
        console.log("\n⚠️ Please make sure the backend server is running:");
        console.log("   cd backend && npm run dev");
    }
}

runTests();
