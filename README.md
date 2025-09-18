# RAG-Powered Chatbot Backend for News Website

A production-ready RAG (Retrieval-Augmented Generation) chatbot backend designed specifically for news websites. This system combines vector search capabilities with conversational AI to provide intelligent, context-aware responses about news content.

##  Features

- **RAG Architecture**: Advanced retrieval-augmented generation for accurate, contextual responses
- **Session Management**: Persistent conversation sessions with configurable TTLs
- **Intelligent Caching**: Query-response caching system to improve performance
- **Redis Integration**: High-performance data storage and session management
- **Scalable Design**: Built for production environments with news websites
- **Real-time Responses**: Optimized for fast query processing and response generation

##  Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │───▶│   Backend   │───▶│    Redis    │
│             │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
                           │
                           ▼
                   ┌─────────────┐    ┌─────────────┐
                   │ Vector DB   │    │     LLM     │
                   │ (News Data) │    │  Service    │
                   └─────────────┘    └─────────────┘
```

##  Quick Start

### Prerequisites

- Node.js 16+ 
- Redis server
- Environment variables configured

### Installation

```bash
git clone https://github.com/Aeshna0204/RAG-Chatbot-Backend.git
cd RAG-Chatbot-Backend
npm install
```

### Environment Setup

Create a `.env` file:

```env
# Server
PORT=5000

# Redis
# REDIS_URL=redis://localhost:6379
# Qdrant
# QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=news_articles
EMBEDDING_DIM=768

# Gemini (LLM) API
GEMINI_API_URL=""
GEMINI_API_KEY=""

JINA_API_KEY=""



```

### Running the Application

```bash
# Development
npm run dev

# Production
npm start
```

## Configuration

### Session Management

Sessions are automatically managed using the Redis service with configurable TTLs:

```javascript
// Default session TTL: 1 hour (from createSession function)
await createSession(); // Uses default 60 * 60 seconds

// Custom TTL: 30 minutes
await createSession(1800);

// No expiration
await createSession(0);
```

### Cache Configuration

The system includes intelligent query-response caching using the existing Redis service:

```javascript
// Default cache TTL: 30 minutes (from redisService.js)
await setCachedAnswer(query, answer); // Uses default 1800 seconds

// Custom cache TTL examples
await setCachedAnswer(query, answer, 60 * 60); // 1 hour
await setCachedAnswer(query, answer, 5 * 60);  // 5 minutes
```

##  TTL Configuration Guide

### Session TTLs

Based on the `redisService.js` implementation, sessions are configured with TTL:

```javascript
// Default session creation - 1 hour TTL
async function createSession(ttlSeconds = 60 * 60) {
  const sessionId = uuidv4();
  const key = `session:${sessionId}:history`;
  
  await redisClient.del(key).catch(() => { });
  if (ttlSeconds > 0) await redisClient.expire(key, ttlSeconds);
  
  return sessionId;
}
```

**Usage Examples:**

```javascript
// Default TTL: 1 hour
const sessionId = await createSession();

// Custom TTL: 30 minutes for guest users
const guestSessionId = await createSession(30 * 60);

// Custom TTL: 2 hours for registered users  
const userSessionId = await createSession(2 * 60 * 60);

// No expiration (ttlSeconds = 0)
const permanentSessionId = await createSession(0);
```

### Cache TTLs

Query-response caching with configurable TTL:

```javascript
// Default cache TTL: 30 minutes (1800 seconds)
async function setCachedAnswer(query, answer, ttlSeconds = 1800) {
  const qHash = hashQuery(query);
  const cacheKey = `cache:query:${qHash}`;
  await redisClient.setEx(cacheKey, ttlSeconds, JSON.stringify({ 
    answer, 
    ts: Date.now() 
  }));
}
```

**Cache Usage Examples:**

```javascript
// Default cache: 30 minutes
await setCachedAnswer(query, answer);

// Short cache for breaking news: 5 minutes
await setCachedAnswer(query, answer, 5 * 60);

// Long cache for historical data: 4 hours
await setCachedAnswer(query, answer, 4 * 60 * 60);
```



## 🔌 API Endpoints

### Session Management
- `POST /session/create-session` -> create new sessionId
- `GET /session/list-sessions` - List all sessions
- `DELETE /session/:id` - delete specific session
- `POST /sessions/:sessionId/reset` - Reset chat history
- `GET /session/:id/history`- get history of a session

### Chat Operations
- `POST /chat/:sessionId` - Send message to chatbot




