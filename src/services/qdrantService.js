const axios =require("axios");


/**
 * Create collection if not exists
 */
async function initQdrantCollection() {
  try {
    const body = {
      vectors: {
        size: parseInt(process.env.EMBEDDING_DIM),
        distance: "Cosine",
      },
    };

    await axios.put(
      `${process.env.QDRANT_URL}/collections/${process.env.QDRANT_COLLECTION}`,
      body,
      {
        headers: {
          "api-key": process.env.QDRANT_API_KEY, // <--- include API key here
        },
        timeout: 10000,
      }
    );

    console.log("✅ Qdrant collection initialized:", process.env.QDRANT_COLLECTION);
  } catch (err) {
    console.warn("Qdrant init warning:", err.response?.data || err.message);
  }
}


/**
 * Search top-k vectors in qdrant
 * @param {number[]} vector
 * @param {number} k
 * @returns array of payload objects {id, payload}
 */
 async function searchVectors(vector, k = 3) {
  try {
    const res = await axios.post(`${process.env.QDRANT_URL}/collections/${process.env.QDRANT_COLLECTION}/points/search`, {
      vector,
      limit: k,
      with_payload: true
    }, {
        headers: {
          "api-key": process.env.QDRANT_API_KEY,   // <--- ye line missing thi
        },
        timeout: 20000,
      });

    // Qdrant returns .result array with {id, payload, score}
    return (res.data?.result || []).map(r => ({
      id: r.id,
      score: r.score,
      payload: r.payload
    }));
  } catch (err) {
    console.error("Qdrant search error:", err.response?.data || err.message);
    return [];
  }
}

module.exports = { initQdrantCollection, searchVectors };