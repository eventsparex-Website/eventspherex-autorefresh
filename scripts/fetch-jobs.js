const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'EventSphereX/1.0 (+https://eventspherex.com)' }
});

// Indeed RSS feeds for event industry jobs in India
const JOB_FEEDS = [
  { url: 'https://www.indeed.co.in/rss?q=event+manager&l=India&sort=date', role: 'Event Manager' },
  { url: 'https://www.indeed.co.in/rss?q=exhibition+designer&l=India&sort=date', role: 'Exhibition Designer' },
  { url: 'https://www.indeed.co.in/rss?q=wedding+planner&l=India&sort=date', role: 'Wedding Planner' },
  { url: 'https://www.indeed.co.in/rss?q=event+coordinator&l=India&sort=date', role: 'Event Coordinator' },
  { url: 'https://www.indeed.co.in/rss?q=MICE+conference+manager&l=India&sort=date', role: 'MICE Manager' },
  { url: 'https://www.indeed.co.in/rss?q=event+marketing&l=India&sort=date', role: 'Event Marketing' },
  { url: 'https://www.indeed.co.in/rss?q=event+production&l=India&sort=date', role: 'Event Production' },
  { url: 'https://www.indeed.co.in/rss?q=stall+fabrication+exhibition&l=India&sort=date', role: 'Stall Fabrication' }
];

// Google News RSS for event jobs (backup source)
const BACKUP_FEEDS = [
  { url: 'https://news.google.com/rss/search?q=event+management+jobs+India+hiring&hl=en-IN&gl=IN&ceid=IN:en', role: 'Various' }
];

function extractLocation(text) {
  const cities = [
    'Mumbai', 'Delhi', 'Bangalore', 'Bengaluru', 'Hyderabad', 'Chennai',
    'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Gurgaon',
    'Gurugram', 'Noida', 'Goa', 'Chandigarh', 'Kochi', 'Indore',
    'Nagpur', 'Surat', 'Coimbatore', 'Vadodara', 'Bhopal', 'Vizag',
    'Thiruvananthapuram', 'Remote', 'Pan India', 'New Delhi'
  ];
  for (const city of cities) {
    if (text && text.toLowerCase().includes(city.toLowerCase())) return city;
  }
  return 'India';
}

function extractCompany(item) {
  // Indeed RSS often has company in source or content
  if (item.creator) return item.creator;
  if (item.author) return item.author;
  // Try to extract from content
  const content = item.contentSnippet || item.content || '';
  const match = content.match(/^([^-]+)\s*-/);
  if (match && match[1].length < 50) return match[1].trim();
  return '';
}

function extractSalary(text) {
  if (!text) return '';
  // Match Indian salary patterns
  const patterns = [
    /(?:Rs\.?|INR|₹)\s*[\d,.]+ *(?:- *(?:Rs\.?|INR|₹)?\s*[\d,.]+)?\s*(?:per|a|\/)\s*(?:month|year|annum)/i,
    /[\d,.]+ *(?:- *[\d,.]+)?\s*(?:LPA|lakh|lakhs)/i,
    /(?:Rs\.?|INR|₹)\s*[\d,.]+ *- *[\d,.]+/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return '';
}

async function fetchAllJobs() {
  const allJobs = [];
  const seenTitles = new Set();

  // Fetch from Indeed
  for (const feed of JOB_FEEDS) {
    try {
      console.log(`Fetching jobs: ${feed.role}...`);
      const result = await parser.parseURL(feed.url);

      for (const item of (result.items || [])) {
        const title = (item.title || '').trim();
        const titleKey = title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 40);
        if (seenTitles.has(titleKey)) continue;
        seenTitles.add(titleKey);

        const fullText = title + ' ' + (item.contentSnippet || '');

        allJobs.push({
          title: title,
          link: item.link || '',
          company: extractCompany(item),
          location: extractLocation(fullText),
          salary: extractSalary(item.contentSnippet || ''),
          role: feed.role,
          source: 'Indeed',
          snippet: (item.contentSnippet || '').substring(0, 200),
          pubDate: item.isoDate || item.pubDate || new Date().toISOString()
        });
      }
    } catch (err) {
      console.error(`Failed to fetch ${feed.role} jobs: ${err.message}`);
    }
  }

  // If Indeed fails or returns too few, try backup
  if (allJobs.length < 10) {
    for (const feed of BACKUP_FEEDS) {
      try {
        console.log('Fetching backup job news...');
        const result = await parser.parseURL(feed.url);
        for (const item of (result.items || []).slice(0, 10)) {
          allJobs.push({
            title: (item.title || '').replace(/\s*[-|]\s*[^-|]+$/, '').trim(),
            link: item.link || '',
            company: '',
            location: extractLocation(item.title + ' ' + (item.contentSnippet || '')),
            salary: '',
            role: 'Various',
            source: 'Google News',
            snippet: (item.contentSnippet || '').substring(0, 200),
            pubDate: item.isoDate || item.pubDate || new Date().toISOString()
          });
        }
      } catch (err) {
        console.error(`Backup job fetch failed: ${err.message}`);
      }
    }
  }

  // Sort by date
  allJobs.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  // Keep top 50
  const topJobs = allJobs.slice(0, 50);

  const outPath = path.join(__dirname, '..', 'src', '_data', 'jobs.json');
  fs.writeFileSync(outPath, JSON.stringify({
    lastUpdated: new Date().toISOString(),
    count: topJobs.length,
    jobs: topJobs
  }, null, 2));

  console.log(`Saved ${topJobs.length} jobs to ${outPath}`);
  return topJobs;
}

fetchAllJobs().catch(console.error);
