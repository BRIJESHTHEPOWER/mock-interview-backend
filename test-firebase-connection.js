// ============================================
// BACKEND FIREBASE CONNECTION TEST
// ============================================
// Test script to verify Firebase Admin SDK connection

require("dotenv").config();
const { db } = require("./firebase");

async function testFirebaseConnection() {
    try {
        console.log("🔍 Testing Backend Firebase Admin SDK Connection...\n");

        // Test 1: Check environment variables
        console.log("✅ Step 1: Environment Variables");
        console.log(`   - FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID ? "✓" : "✗"}`);
        console.log(`   - FIREBASE_CLIENT_EMAIL: ${process.env.FIREBASE_CLIENT_EMAIL ? "✓" : "✗"}`);
        console.log(`   - FIREBASE_PRIVATE_KEY: ${process.env.FIREBASE_PRIVATE_KEY ? "✓ (exists)" : "✗"}\n`);

        // Test 2: Try to access Firestore
        console.log("✅ Step 2: Testing Firestore Connection");
        const testCollection = db.collection("_connection_test");
        const testDoc = testCollection.doc("test");

        await testDoc.set({
            timestamp: new Date().toISOString(),
            message: "Backend Firebase connection test"
        });
        console.log("   ✓ Successfully wrote to Firestore\n");

        const snapshot = await testDoc.get();
        if (snapshot.exists) {
            console.log("   ✓ Successfully read from Firestore");
            console.log(`   Data: ${JSON.stringify(snapshot.data())}\n`);
        }

        // Clean up test document
        await testDoc.delete();
        console.log("   ✓ Test document cleaned up\n");

        console.log("🎉 SUCCESS: Backend Firebase Admin SDK is properly connected!\n");
        process.exit(0);
    } catch (error) {
        console.error("❌ FAILED: Backend Firebase connection error");
        console.error("Error details:", error.message);
        console.error("\nFull error:", error);
        process.exit(1);
    }
}

testFirebaseConnection();
