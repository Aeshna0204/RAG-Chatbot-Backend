
// src/services/embeddingService.js
const axios = require("axios");
const JINA_URL = "https://api.jina.ai/v1/embeddings";
const MODEL = "jina-embeddings-v2-base-en"; // free-tier model

/**
 * Generate embedding for a single text
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function embedText(text) {
  if (!process.env.JINA_API_KEY) {
  throw new Error("JINA_API_KEY is not set in environment variables");
}
  const embeddings = await embedBatch([text]);
  return embeddings[0]; // return only first one
}

/**
 * Generate embeddings for multiple texts in one API call
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
async function embedBatch(texts) {
  try {
    const response = await axios.post(
      JINA_URL,
      {
        model: MODEL,
        input: texts, // 👈 array of strings
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.JINA_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    const embeddings = response.data?.data?.map(d => d.embedding);
    if (!embeddings || embeddings.length !== texts.length) {
      throw new Error("Mismatch in embeddings length from Jina API");
    }
    return embeddings;
  } catch (err) {
    console.error("❌ Jina embedding error:", err.response?.data || err.message);
    throw err;
  }
}

module.exports = { embedText, embedBatch };
