import requests
from dotenv import load_dotenv
load_dotenv()
from bs4 import BeautifulSoup
from qdrant_client import QdrantClient, models
import os
import time
import hashlib
from datetime import datetime
import logging
import feedparser

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configuration
QDRANT_URL = os.environ.get("QDRANT_URL", "https://6e0ab588-3e99-45a9-8671-3789714b9790.us-east-1-1.aws.cloud.qdrant.io:6333")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY")
COLLECTION = os.environ.get("QDRANT_COLLECTION", "news_articles")
JINA_API_KEY = os.environ.get("JINA_API_KEY")
MAX_ARTICLES = int(os.environ.get("MAX_ARTICLES", "50"))

if not JINA_API_KEY:
    raise ValueError("JINA_API_KEY environment variable is required")

# Initialize Qdrant client
qdrant = QdrantClient(
    url=QDRANT_URL,
    api_key=QDRANT_API_KEY,
)

def setup_collection():
    """Setup or recreate the Qdrant collection"""
    try:
        collections = qdrant.get_collections().collections
        collection_exists = any(col.name == COLLECTION for col in collections)
        
        if collection_exists:
            logger.info(f"Collection '{COLLECTION}' already exists. Recreating...")
            qdrant.delete_collection(collection_name=COLLECTION)
        
        qdrant.create_collection(
            collection_name=COLLECTION,
            vectors_config=models.VectorParams(size=768, distance=models.Distance.COSINE)
        )
        logger.info(f"✅ Collection '{COLLECTION}' created successfully")
    except Exception as e:
        logger.error(f"❌ Error setting up collection: {e}")
        raise

def get_news_from_rss():
    """Get news articles from various RSS feeds"""
    rss_feeds = [
        # BBC feeds
        'http://feeds.bbci.co.uk/news/rss.xml',
        'http://feeds.bbci.co.uk/news/world/rss.xml',
        'http://feeds.bbci.co.uk/news/business/rss.xml',
        'http://feeds.bbci.co.uk/news/technology/rss.xml',
        
        # NPR feeds  
        'https://feeds.npr.org/1001/rss.xml',
        'https://feeds.npr.org/1004/rss.xml',
        
        # The Guardian
        'https://www.theguardian.com/world/rss',
        'https://www.theguardian.com/business/rss',
        
        # Associated Press
        'https://feeds.apnews.com/rss/apf-topnews',
        'https://feeds.apnews.com/rss/apf-businessnews',
    ]
    
    articles = []
    
    for feed_url in rss_feeds:
        try:
            logger.info(f"📡 Fetching RSS feed: {feed_url}")
            
            # Use feedparser for better RSS handling
            feed = feedparser.parse(feed_url)
            
            if feed.entries:
                for entry in feed.entries[:8]:  # Limit per feed
                    if hasattr(entry, 'link') and hasattr(entry, 'title'):
                        article_data = {
                            'url': entry.link,
                            'title': entry.title,
                            'summary': getattr(entry, 'summary', ''),
                            'published': getattr(entry, 'published', ''),
                            'source': feed_url
                        }
                        articles.append(article_data)
                        
                logger.info(f"✅ Got {len(feed.entries[:8])} articles from {feed_url}")
            else:
                logger.warning(f"⚠️ No entries found in {feed_url}")
                
        except Exception as e:
            logger.warning(f"⚠️ Error fetching RSS feed {feed_url}: {e}")
            continue
        
        time.sleep(0.5)  # Rate limiting
    
    # Remove duplicates and limit
    unique_articles = []
    seen_urls = set()
    
    for article in articles:
        if article['url'] not in seen_urls:
            seen_urls.add(article['url'])
            unique_articles.append(article)
            
    logger.info(f"📰 Total unique articles collected: {len(unique_articles)}")
    return unique_articles[:MAX_ARTICLES]

def fetch_full_article(url):
    """Fetch full article content from URL"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
        }
        
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove unwanted elements
        for element in soup(['script', 'style', 'nav', 'header', 'footer', 'aside', 'ads']):
            element.decompose()
        
        # Try different selectors for article content
        content_selectors = [
            'article p', '.article-body p', '.story-body p', 
            '[data-component="text-block"]', '.content p',
            'main p', '.post-content p', '.entry-content p'
        ]
        
        content = ""
        for selector in content_selectors:
            paragraphs = soup.select(selector)
            if paragraphs:
                content = ' '.join([p.get_text().strip() for p in paragraphs])
                if len(content) > 200:
                    break
        
        # Fallback to all paragraphs
        if len(content) < 200:
            paragraphs = soup.find_all('p')
            content = ' '.join([p.get_text().strip() for p in paragraphs if len(p.get_text().strip()) > 20])
        
        return content.strip() if len(content.strip()) > 100 else None
        
    except Exception as e:
        logger.warning(f"⚠️ Error fetching full article from {url}: {e}")
        return None

def create_chunks(text, chunk_size=500, overlap=50):
    """Create text chunks with overlap"""
    if not text or len(text) < chunk_size:
        return [text] if text else []
    
    chunks = []
    start = 0
    
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        
        if end < len(text):
            # Try to break at sentence boundary
            last_period = chunk.rfind('.')
            if last_period > start + chunk_size // 2:
                chunk = text[start:last_period + 1]
                end = last_period + 1
        
        chunks.append(chunk.strip())
        start = end - overlap
        
        if start >= len(text):
            break
    
    return [chunk for chunk in chunks if len(chunk.strip()) > 50]

def get_embedding(text):
    """Get embedding from Jina AI"""
    try:
        response = requests.post(
            "https://api.jina.ai/v1/embeddings",
            headers={"Authorization": f"Bearer {JINA_API_KEY}"},
            json={"model": "jina-embeddings-v2-base-en", "input": [text[:8192]]},
            timeout=30
        )
        response.raise_for_status()
        return response.json()['data'][0]['embedding']
    except Exception as e:
        logger.error(f"❌ Error getting embedding: {e}")
        raise

def generate_chunk_id(url, chunk_text):
    """Generate unique ID for chunk"""
    content = f"{url}:{chunk_text[:100]}"
    return int(hashlib.md5(content.encode()).hexdigest()[:8], 16)

def process_articles(articles):
    """Process articles and create embeddings"""
    points = []
    successful = 0
    
    for i, article in enumerate(articles):
        logger.info(f"📖 Processing article {i+1}/{len(articles)}: {article['title'][:60]}...")
        
        # Use RSS summary if available, otherwise fetch full content
        content = article.get('summary', '')
        if len(content) < 200:
            full_content = fetch_full_article(article['url'])
            if full_content:
                content = full_content
        
        if not content or len(content) < 100:
            logger.warning(f"❌ Skipping article with insufficient content")
            continue
        
        try:
            # Combine title and content
            full_text = f"{article['title']}\n\n{content}"
            chunks = create_chunks(full_text)
            
            for j, chunk in enumerate(chunks):
                try:
                    embedding = get_embedding(chunk)
                    
                    payload = {
                        "url": article['url'],
                        "title": article['title'],
                        "text": chunk,
                        "chunk_index": j,
                        "total_chunks": len(chunks),
                        "published": article.get('published', ''),
                        "source_feed": article.get('source', ''),
                        "ingestion_date": datetime.now().isoformat()
                    }
                    
                    point_id = generate_chunk_id(article['url'], chunk)
                    point = models.PointStruct(id=point_id, vector=embedding, payload=payload)
                    points.append(point)
                    
                    time.sleep(0.1)  # Rate limiting
                    
                except Exception as e:
                    logger.error(f"❌ Error processing chunk: {e}")
                    continue
            
            successful += 1
            logger.info(f"✅ Processed: {len(chunks)} chunks created")
            
            # Batch upsert
            if len(points) >= 25:
                qdrant.upsert(collection_name=COLLECTION, points=points)
                logger.info(f"📤 Upserted {len(points)} points to Qdrant")
                points = []
            
        except Exception as e:
            logger.error(f"❌ Error processing article: {e}")
            continue
        
        time.sleep(0.5)
    
    # Upsert remaining points
    if points:
        qdrant.upsert(collection_name=COLLECTION, points=points)
        logger.info(f"📤 Upserted final {len(points)} points to Qdrant")
    
    logger.info(f"🎉 Successfully processed {successful} articles")

def main():
    """Main function"""
    logger.info("🚀 Starting RSS-based news ingestion")
    
    try:
        setup_collection()
        articles = get_news_from_rss()
        
        if not articles:
            logger.error("❌ No articles found. Exiting.")
            return
        
        process_articles(articles)
        
        # Verify
        collection_info = qdrant.get_collection(collection_name=COLLECTION)
        logger.info(f"✅ Collection now contains {collection_info.points_count} points")
        
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")
        raise

if __name__ == "__main__":
    main()