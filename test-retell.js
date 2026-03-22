require('dotenv').config();
const axios = require('axios');

async function testRetell() {
  const RETELL_API_KEY = process.env.RETELL_API_KEY;
  console.log("Testing Retell...");
  try {
    const llmResponse = await axios.post(
      "https://api.retellai.com/v2/create-retell-llm",
      {
        model: "gpt-4o-mini",
        general_prompt: "You are a software engineer.",
        general_tools: [],
        states: [],
      },
      {
        headers: {
          Authorization: `Bearer ${RETELL_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("LLM created:", llmResponse.data.llm_id);
  } catch (e) {
    console.error("LLM Error:", e.response?.data || e.message);
  }
}

testRetell();
