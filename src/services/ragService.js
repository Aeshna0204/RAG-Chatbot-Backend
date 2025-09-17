const { embedText } = require("./embeddingService.js");
const { searchVectors } = require("./qdrantService.js");
const { callGemini } = require("./geminiService.js");

/**
 * processQuery: main runtime RAG processing that will be used by chatRoutes
 */
 async function processQuery(query, topK = 2) {
  // 1) embed the user query
  const qEmb = await embedText(query);

  // 2) search Qdrant
  const results = await searchVectors(qEmb, topK);

  // 3) build context (concatenate payload.text or payload.content)
  const passages = results.map((r, i) => {
    const txt = r.payload?.text || r.payload?.content || JSON.stringify(r.payload);
    return `--- passage ${i + 1} (score: ${r.score}) ---\n${txt}\n`;
  }).join("\n");

  // 4) build prompt
  const prompt = `
You are a friendly news assistant. 
Read the following passages and answer the user in a natural, conversational tone. 
Summarize in 2-3 sentences.If the question asked is not related to the passages or news topic then say I am a news assistant and cannot answer that.

User question:
${query}

Context passages:
${passages}

Provide the final answer now:
`;

  // 5) call Gemini
  const answer = await callGemini(prompt);
  return answer;
}

module.exports = { processQuery };