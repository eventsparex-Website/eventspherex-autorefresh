const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'EventSphereX/1.0 (+https://eventspherex.com)' }
});

// RSS feeds for Indian event industry news
const FEEDS = [
  { url: 'https://news.google.com/rss/search?q=event+management+India&hl=en-IN&gl=IN&ceid=IN:en', source: 'Google News', category: 'Industry' },
  { url: 'https://news.google.com/rss/search?q=exhibition+trade+show+India&hl=en-IN&gl=IN&ceid=IN:en', source: 'Google News', category: 'Exhibitions' },
  { url: 'https://news.google.com/rss/search?q=MICE+conference+India&hl=en-IN&gl=IN&ceid=IN:en', source: 'Google News', category: 'MICE' },
  { url: 'https://news.google.com/rss/search?q=wedding+industry+India&hl=en-IN&gl=IN&ceid=IN:en', source: 'Google News', category: 'Weddings' },
  { url: 'https://news.google.com/rss/search?q=event+technology+innovation&hl=en-IN&gl=IN&ceid=IN:en', source: 'Google News', category: 'Technology' },
  { url: 'https://news.google.com/rss/search?q=brand+activation+experiential+marketing+India&hl=en-IN&gl=IN&ceid=IN:en', source: 'Google News', category: 'Brand Activations' },
  { url: 'https://news.google.com/rss/search?q=%22Pragati+Maidan%22+OR+%22India+Expo%22+OR+%22Bombay+Exhibition%22&hl=en-IN&gl=IN&ceid=IN:en', source: 'Google News', category: 'Venues' },
  { url: 'https://news.google.com/rss/search?q=corporate+event+India+summit+conference&hl=en-IN&gl=IN&ceid=IN:en', source: 'Google News', category: 'Corporate' }
];

// Keywords to boost relevance scoring
const BOOST_KEYWORDS = [
  'event', 'exhibition', 'trade show', 'conference', 'summit', 'MICE',
  'wedding', 'venue', 'stall', 'booth', 'expo', 'activation', 'launch',
  'Pragati Maidan', 'BIEC', 'IEML', 'Jio World', 'ITPO', 'FICCI', 'CII',
  'catering', 'hospitality', 'decor', 'lighting', 'AV', 'sound', 'LED',
  'planner', 'organizer', 'organiser', 'management', 'incentive'
];

// Words to filter out irrelevant results
const BLOCK_KEYWORDS = [
  'cricket', 'IPL', 'football', 'movie', 'film', 'Bollywood', 'stock market',
  'share price', 'sensex', 'nifty', 'murder', 'accident', 'rape', 'politics'
];

function scoreArticle(title, snippet) {
  const text = (title + ' ' + (snippet || '')).toLowerCase();
  let score = 0;

  // Block irrelevant
  for (const word of BLOCK_KEYWORDS) {
    if (text.includes(word.toLowerCase())) return -1;
  }

  // Boost relevant
  for (const word of BOOST_KEYWORDS) {
    if (text.includes(word.toLowerCase())) score += 2;
  }

  return score;
}

function cleanTitle(title) {
  // Remove source suffix from Google News titles (e.g., " - The Hindu")
  return title.replace(/\s*[-|]\s*[^-|]+$/, '').trim();
}

function getSourceFromTitle(title) {
  const match = title.match(/\s*[-|]\s*([^-|]+)$/);
  return match ? match[1].trim() : '';
}

async function fetchAllNews() {
  const allArticles = [];
  const seenTitles = new Set();

  for (const feed of FEEDS) {
    try {
      console.log(`Fetching: ${feed.category} from ${feed.source}...`);
      const result = await parser.parseURL(feed.url);

      for (const item of (result.items || [])) {
        const rawTitle = item.title || '';
        const title = cleanTitle(rawTitle);
        const source = getSourceFromTitle(rawTitle) || feed.source;

        // Deduplicate by title similarity
        const titleKey = title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 50);
        if (seenTitles.has(titleKey)) continue;
        seenTitles.add(titleKey);

        const score = scoreArticle(title, item.contentSnippet);
        if (score < 0) continue; // blocked

        allArticles.push({
          title: title,
          link: item.link || '',
          source: source,
          category: feed.category,
          snippet: (item.contentSnippet || '').substring(0, 200),
          pubDate: item.isoDate || item.pubDate || new Date().toISOString(),
          score: score
        });
      }
    } catch (err) {
      console.error(`Failed to fetch ${feed.category}: ${err.message}`);
    }
  }

  // Sort by score (relevance) then by date
  allArticles.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.pubDate) - new Date(a.pubDate);
  });

  // Keep top 60 articles
  const topArticles = allArticles.slice(0, 60);

  // Write to _data
  const outPath = path.join(__dirname, '..', 'src', '_data', 'news.json');
  fs.writeFileSync(outPath, JSON.stringify({
    lastUpdated: new Date().toISOString(),
    count: topArticles.length,
    articles: topArticles
  }, null, 2));

  console.log(`Saved ${topArticles.length} news articles to ${outPath}`);
  return topArticles;
}

fetchAllNews().catch(console.error);
