const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'EventSphereX/1.0 (+https://eventspherex.com)' }
});

// Google News RSS for government event tenders
const TENDER_FEEDS = [
  { url: 'https://news.google.com/rss/search?q=event+management+tender+India+government&hl=en-IN&gl=IN&ceid=IN:en', category: 'Event Management' },
  { url: 'https://news.google.com/rss/search?q=exhibition+tender+government+India&hl=en-IN&gl=IN&ceid=IN:en', category: 'Exhibitions' },
  { url: 'https://news.google.com/rss/search?q=%22GeM%22+%22event+management%22+OR+%22tent%22+OR+%22pandal%22+OR+%22catering%22+tender&hl=en-IN&gl=IN&ceid=IN:en', category: 'GeM Portal' },
  { url: 'https://news.google.com/rss/search?q=CPPP+eprocure+event+OR+exhibition+OR+conference+tender&hl=en-IN&gl=IN&ceid=IN:en', category: 'CPPP' },
  { url: 'https://news.google.com/rss/search?q=government+event+organizer+empanelment+India&hl=en-IN&gl=IN&ceid=IN:en', category: 'Empanelment' }
];

// Direct tender portal URLs (for reference links)
const TENDER_PORTALS = [
  { name: 'GeM Portal', url: 'https://gem.gov.in/search?q=event+management', description: 'Government e-Marketplace - Search for event management services' },
  { name: 'CPPP (Central)', url: 'https://eprocure.gov.in/eprocure/app?page=FrontEndTendersByKeyword&keyword=event+management', description: 'Central Public Procurement Portal' },
  { name: 'Maharashtra Tenders', url: 'https://mahatenders.gov.in', description: 'Maharashtra state e-Procurement' },
  { name: 'Karnataka Tenders', url: 'https://eproc.karnataka.gov.in', description: 'Karnataka state e-Procurement' },
  { name: 'Tamil Nadu Tenders', url: 'https://tntenders.gov.in', description: 'Tamil Nadu state e-Procurement' },
  { name: 'UP Tenders', url: 'https://etender.up.nic.in', description: 'Uttar Pradesh e-Tender Portal' },
  { name: 'Delhi Tenders', url: 'https://govtprocurement.delhi.gov.in', description: 'Delhi Government e-Procurement' },
  { name: 'Gujarat Tenders', url: 'https://www.nprocure.com', description: 'Gujarat state e-Procurement (nProcure)' }
];

const TENDER_KEYWORDS = [
  'event management', 'tent', 'pandal', 'catering', 'stage', 'sound system',
  'LED wall', 'lighting', 'exhibition', 'trade fair', 'conference', 'seminar',
  'workshop', 'inauguration', 'cultural', 'festival', 'celebration',
  'audio visual', 'AV equipment', 'photography', 'videography',
  'decoration', 'flower', 'furniture rental', 'hospitality'
];

function isRelevant(title, snippet) {
  const text = (title + ' ' + (snippet || '')).toLowerCase();
  return TENDER_KEYWORDS.some(kw => text.includes(kw));
}

function cleanTitle(title) {
  return title.replace(/\s*[-|]\s*[^-|]+$/, '').trim();
}

function getSourceFromTitle(title) {
  const match = title.match(/\s*[-|]\s*([^-|]+)$/);
  return match ? match[1].trim() : '';
}

function extractState(text) {
  const states = {
    'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Maharashtra'],
    'Delhi': ['Delhi', 'New Delhi'],
    'Karnataka': ['Bangalore', 'Bengaluru', 'Karnataka'],
    'Tamil Nadu': ['Chennai', 'Tamil Nadu', 'Coimbatore'],
    'Uttar Pradesh': ['Lucknow', 'Noida', 'UP', 'Uttar Pradesh'],
    'Gujarat': ['Ahmedabad', 'Gujarat', 'Surat', 'Vadodara'],
    'Rajasthan': ['Jaipur', 'Rajasthan', 'Jodhpur', 'Udaipur'],
    'West Bengal': ['Kolkata', 'West Bengal'],
    'Telangana': ['Hyderabad', 'Telangana'],
    'Kerala': ['Kerala', 'Kochi', 'Thiruvananthapuram'],
    'Madhya Pradesh': ['Bhopal', 'Indore', 'Madhya Pradesh'],
    'Haryana': ['Gurgaon', 'Gurugram', 'Haryana'],
    'Central': ['Central Government', 'Ministry', 'CPPP', 'GeM']
  };

  const textLower = text.toLowerCase();
  for (const [state, keywords] of Object.entries(states)) {
    for (const kw of keywords) {
      if (textLower.includes(kw.toLowerCase())) return state;
    }
  }
  return 'Pan India';
}

async function fetchAllTenders() {
  const allTenders = [];
  const seenTitles = new Set();

  for (const feed of TENDER_FEEDS) {
    try {
      console.log(`Fetching tenders: ${feed.category}...`);
      const result = await parser.parseURL(feed.url);

      for (const item of (result.items || [])) {
        const rawTitle = item.title || '';
        const title = cleanTitle(rawTitle);
        const source = getSourceFromTitle(rawTitle) || 'Government Portal';

        const titleKey = title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 50);
        if (seenTitles.has(titleKey)) continue;
        seenTitles.add(titleKey);

        const fullText = title + ' ' + (item.contentSnippet || '');

        // Only keep if relevant to events
        if (!isRelevant(title, item.contentSnippet) && feed.category !== 'GeM Portal') continue;

        allTenders.push({
          title: title,
          link: item.link || '',
          source: source,
          category: feed.category,
          state: extractState(fullText),
          snippet: (item.contentSnippet || '').substring(0, 250),
          pubDate: item.isoDate || item.pubDate || new Date().toISOString()
        });
      }
    } catch (err) {
      console.error(`Failed to fetch ${feed.category} tenders: ${err.message}`);
    }
  }

  // Sort by date
  allTenders.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  const topTenders = allTenders.slice(0, 40);

  const outPath = path.join(__dirname, '..', 'src', '_data', 'tenders.json');
  fs.writeFileSync(outPath, JSON.stringify({
    lastUpdated: new Date().toISOString(),
    count: topTenders.length,
    tenders: topTenders,
    portals: TENDER_PORTALS
  }, null, 2));

  console.log(`Saved ${topTenders.length} tenders to ${outPath}`);
  return topTenders;
}

fetchAllTenders().catch(console.error);
