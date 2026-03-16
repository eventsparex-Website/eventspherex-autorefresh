/**
 * WordPress XML Export to Markdown Importer
 * Reads export.xml and generates markdown files with frontmatter for Eleventy
 */

const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const TurndownService = require('turndown');

const EXPORT_FILE = path.join(__dirname, '..', '..', 'export.xml');
const POSTS_DIR = path.join(__dirname, '..', 'src', 'posts');
const PAGES_DIR = path.join(__dirname, '..', 'src', 'pages');

// Initialize Turndown (HTML to Markdown)
const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced'
});

// Remove WordPress block comments
turndown.addRule('wpBlocks', {
  filter: function(node) {
    return node.nodeType === 8; // Comment nodes
  },
  replacement: function() { return ''; }
});

// Ensure output directories exist
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Clean HTML content - strip WP block comments and clean up
function cleanHtml(html) {
  if (!html) return '';
  // Remove WordPress block comments
  html = html.replace(/<!-- \/?wp:[^>]*-->/g, '');
  // Remove empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');
  // Remove privacy-policy-tutorial strong tags
  html = html.replace(/<strong class="privacy-policy-tutorial">Suggested text: <\/strong>/g, '');
  return html.trim();
}

// Convert HTML to Markdown
function htmlToMarkdown(html) {
  const cleaned = cleanHtml(html);
  if (!cleaned) return '';
  return turndown.turndown(cleaned);
}

// Generate excerpt from content
function generateExcerpt(content, maxWords) {
  maxWords = maxWords || 30;
  if (!content) return '';
  // Strip HTML tags
  const text = content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const words = text.split(' ');
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '...';
}

// Sanitize slug
function sanitizeSlug(slug) {
  if (!slug) return 'untitled';
  return slug
    .replace(/__trashed$/, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Map category slug to badge class
function categoryToBadge(catSlug) {
  const map = {
    'exhibitions-trade-shows': 'badge-exhibitions',
    'corporate-events': 'badge-corporate',
    'event-technology-innovation': 'badge-tech',
    'event-technology': 'badge-tech',
    'mice-conferences': 'badge-mice',
    'weddings-social': 'badge-weddings',
    'brand-activations': 'badge-brand',
    'opinion-editorial': 'badge-opinion',
    'venues-infrastructure': 'badge-venues',
    'interviews-profiles': 'badge-interviews',
    'industry-reports': 'badge-reports'
  };
  return map[catSlug] || 'badge-exhibitions';
}

// Escape YAML string
function yamlString(str) {
  if (!str) return '""';
  // If it contains special chars, wrap in quotes
  if (/[:#\[\]{}|>*&!%@`"']/.test(str) || str.includes('\n')) {
    return '"' + str.replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
  }
  return '"' + str + '"';
}

async function main() {
  console.log('Reading export.xml...');
  const xmlData = fs.readFileSync(EXPORT_FILE, 'utf8');

  console.log('Parsing XML...');
  const parser = new xml2js.Parser({
    explicitArray: false,
    tagNameProcessors: [function(name) {
      return name.replace(':', '_');
    }]
  });

  const result = await parser.parseStringPromise(xmlData);
  const channel = result.rss.channel;
  const items = Array.isArray(channel.item) ? channel.item : [channel.item];

  console.log('Found ' + items.length + ' items in export.');

  ensureDir(POSTS_DIR);
  ensureDir(PAGES_DIR);

  let postCount = 0;
  let pageCount = 0;
  let skippedCount = 0;

  for (const item of items) {
    const postType = item['wp_post_type'] || 'post';
    const status = item['wp_status'] || 'draft';
    const title = item.title || 'Untitled';
    const slug = sanitizeSlug(item['wp_post_name'] || '');
    const date = item['wp_post_date'] || '';
    const creator = item['dc_creator'] || 'EventSphereX';

    // Extract content from CDATA
    const contentEncoded = item['content_encoded'] || '';
    const excerptEncoded = item['excerpt_encoded'] || '';

    // Extract categories
    let categories = [];
    let categorySlug = '';
    if (item.category) {
      const cats = Array.isArray(item.category) ? item.category : [item.category];
      for (const cat of cats) {
        if (typeof cat === 'object' && cat.$ && cat.$.domain === 'category') {
          categories.push(cat._);
          if (!categorySlug) categorySlug = cat.$.nicename || '';
        } else if (typeof cat === 'string') {
          categories.push(cat);
        }
      }
    }

    // Extract featured image from postmeta
    let featuredImage = '';
    if (item['wp_postmeta']) {
      const metas = Array.isArray(item['wp_postmeta']) ? item['wp_postmeta'] : [item['wp_postmeta']];
      for (const meta of metas) {
        if (meta['wp_meta_key'] === '_thumbnail_id') {
          // We don't have the attachment URL mapping, so skip
        }
      }
    }

    // Skip nav_menu_item, attachment, etc.
    if (postType !== 'post' && postType !== 'page') {
      skippedCount++;
      continue;
    }

    // Skip trash
    if (status === 'trash') {
      skippedCount++;
      continue;
    }

    // Convert content to markdown
    const markdown = htmlToMarkdown(contentEncoded);
    const excerpt = excerptEncoded ? excerptEncoded.trim() : generateExcerpt(contentEncoded, 30);
    const categoryName = categories.length > 0 ? categories[0] : 'News';
    const badgeClass = categoryToBadge(categorySlug);

    if (postType === 'post' && (status === 'publish' || status === 'draft')) {
      const frontmatter = [
        '---',
        'title: ' + yamlString(title),
        'date: ' + (date || '2025-01-01'),
        'slug: ' + yamlString(slug),
        'author: ' + yamlString(creator),
        'category: ' + yamlString(categoryName),
        'categorySlug: ' + yamlString(categorySlug),
        'badgeClass: ' + yamlString(badgeClass),
        'excerpt: ' + yamlString(excerpt),
        'featured_image: ' + yamlString(featuredImage),
        'status: ' + status,
        'tags:',
        '  - posts',
        '---',
        '',
        markdown
      ].join('\n');

      const filename = slug + '.md';
      fs.writeFileSync(path.join(POSTS_DIR, filename), frontmatter, 'utf8');
      postCount++;
      console.log('  POST: ' + slug);
    }

    if (postType === 'page' && (status === 'publish' || status === 'draft')) {
      const frontmatter = [
        '---',
        'title: ' + yamlString(title),
        'date: ' + (date || '2025-01-01'),
        'slug: ' + yamlString(slug),
        'layout: base.njk',
        'status: ' + status,
        '---',
        '',
        markdown
      ].join('\n');

      const filename = slug + '.md';
      fs.writeFileSync(path.join(PAGES_DIR, filename), frontmatter, 'utf8');
      pageCount++;
      console.log('  PAGE: ' + slug);
    }
  }

  console.log('\nImport complete!');
  console.log('  Posts: ' + postCount);
  console.log('  Pages: ' + pageCount);
  console.log('  Skipped: ' + skippedCount);
}

main().catch(function(err) {
  console.error('Import failed:', err);
  process.exit(1);
});
