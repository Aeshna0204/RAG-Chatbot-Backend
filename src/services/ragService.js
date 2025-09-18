const { embedText } = require("./embeddingService.js");
const { searchVectors } = require("./qdrantService.js");
const { callGemini } = require("./geminiService.js");

/**
 * processQuery: main runtime RAG processing that will be used by chatRoutes
 */
async function processQuery(query, topK = 2) {
  // 1) Handle special cases for "current/latest/breaking news"
  const lowerQ = query.toLowerCase();
  if (
    lowerQ.includes("current news") ||
    lowerQ.includes("latest") ||
    lowerQ.includes("breaking")
  ) {
    return "I provide summaries only from my ingested news articles, not live updates. The news I know is up to the date of ingestion.";
  }

  // 2) embed the user query
  const qEmb = await embedText(query);

  // 3) search Qdrant
  const results = await searchVectors(qEmb, topK);

  // 4) apply relevance threshold
  const threshold = 0.75; // adjust if needed
  const filtered = results.filter((r) => r.score >= threshold);

  if (filtered.length === 0) {
    return "I’m a news assistant and I don’t have information on that topic in my news corpus.";
  }

  // 5) build context (concatenate payload.text or payload.content)
  const passages = filtered
    .map((r, i) => {
      const txt =
        r.payload?.text || r.payload?.content || JSON.stringify(r.payload);
      return `--- passage ${i + 1} (score: ${r.score.toFixed(3)}) ---\n${txt}\n`;
    })
    .join("\n");

  // 6) build improved prompt
  const prompt = `
You are a helpful news assistant. 
Answer based only on the provided passages. 
- If the question is about news outside these passages, clearly say: 
  "I only have access to the news corpus I was trained on, and cannot provide live or unrelated updates." 
- Keep the tone conversational and concise. 
- Summarize the relevant passages in 2–3 sentences. 

User question:
${query}

Context passages:
${passages}

Now provide the final answer:
`;

  // 7) call Gemini
  const answer = await callGemini(prompt);
  return answer;
}

module.exports = { processQuery };
