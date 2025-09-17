const axios = require("axios");

async function callGemini(prompt, maxTokens = 512) {
  if (!process.env.GEMINI_API_URL || !process.env.GEMINI_API_KEY) {
    throw new Error("Gemini API not configured. Set GEMINI_API_URL and GEMINI_API_KEY");
  }

  try {
    const res = await axios.post(
      process.env.GEMINI_API_URL,
      {
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          maxOutputTokens: maxTokens
        }
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY   // ✅ fixed
        },
        timeout: 60000
      }
    );

    // Gemini response structure
    const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text 
              || JSON.stringify(res.data);

    return text;
  } catch (err) {
    console.error("Gemini call error:", err.response?.data || err.message);
    throw err;
  }
}

module.exports = { callGemini };
