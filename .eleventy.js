module.exports = function(eleventyConfig) {

  // Ignore tools HTML files from template processing (they are passthrough only)
  eleventyConfig.ignores.add("src/tools/**");
  eleventyConfig.ignores.add("src/admin/**");
  eleventyConfig.ignores.add("src/pages/.md");

  // Passthrough copy
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/images");
  eleventyConfig.addPassthroughCopy("src/tools");
  eleventyConfig.addPassthroughCopy("src/admin");
  eleventyConfig.addPassthroughCopy({ "src/.htaccess": ".htaccess" });

  // Posts collection (sorted by date descending)
  eleventyConfig.addCollection("posts", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/posts/*.md")
      .filter(function(item) {
        return item.data.status !== 'draft' || !item.data.status;
      })
      .sort(function(a, b) {
        return new Date(b.data.date) - new Date(a.data.date);
      });
  });

  // Categories collection
  eleventyConfig.addCollection("categories", function(collectionApi) {
    var catMap = {};
    collectionApi.getFilteredByGlob("src/posts/*.md").forEach(function(item) {
      var cat = item.data.category || "News";
      var slug = item.data.categorySlug || "news";
      if (!catMap[slug]) {
        catMap[slug] = { name: cat, slug: slug, badgeClass: item.data.badgeClass || '', posts: [] };
      }
      catMap[slug].posts.push(item);
    });
    // Sort posts within each category by date desc
    Object.keys(catMap).forEach(function(slug) {
      catMap[slug].posts.sort(function(a, b) {
        return new Date(b.data.date) - new Date(a.data.date);
      });
    });
    return Object.values(catMap);
  });

  // Date filter
  eleventyConfig.addFilter("dateFormat", function(date, format) {
    if (!date) return '';
    var d = new Date(date);
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var monthsShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    if (format === 'long') {
      return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }
    if (format === 'short') {
      return monthsShort[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }
    if (format === 'iso') {
      return d.toISOString().split('T')[0];
    }
    return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  });

  // Time ago filter
  eleventyConfig.addFilter("timeAgo", function(date) {
    if (!date) return '';
    var now = new Date();
    var then = new Date(date);
    var diff = now - then;
    var seconds = Math.floor(diff / 1000);
    var minutes = Math.floor(seconds / 60);
    var hours = Math.floor(minutes / 60);
    var days = Math.floor(hours / 24);
    var months = Math.floor(days / 30);

    if (months > 0) return months + (months === 1 ? ' month ago' : ' months ago');
    if (days > 0) return days + (days === 1 ? ' day ago' : ' days ago');
    if (hours > 0) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
    if (minutes > 0) return minutes + (minutes === 1 ? ' min ago' : ' mins ago');
    return 'Just now';
  });

  // Read time filter
  eleventyConfig.addFilter("readTime", function(content) {
    if (!content) return '1 min read';
    var words = content.replace(/<[^>]+>/g, '').split(/\s+/).length;
    var mins = Math.ceil(words / 200);
    return mins + ' min read';
  });

  // Excerpt filter
  eleventyConfig.addFilter("excerpt", function(content, maxWords) {
    maxWords = maxWords || 25;
    if (!content) return '';
    var text = content.replace(/<[^>]+>/g, '').replace(/[#*_\[\]]/g, '').replace(/\s+/g, ' ').trim();
    var words = text.split(' ');
    if (words.length <= maxWords) return text;
    return words.slice(0, maxWords).join(' ') + '...';
  });

  // Initials filter
  eleventyConfig.addFilter("initials", function(name) {
    if (!name) return 'ES';
    var parts = name.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  });

  // Limit filter
  eleventyConfig.addFilter("limit", function(arr, limit) {
    if (!arr) return [];
    return arr.slice(0, limit);
  });

  // Offset filter
  eleventyConfig.addFilter("offset", function(arr, offset) {
    if (!arr) return [];
    return arr.slice(offset);
  });

  // URL encode filter
  eleventyConfig.addFilter("urlencode", function(str) {
    return encodeURIComponent(str || '');
  });

  // Slug filter
  eleventyConfig.addFilter("categoryUrl", function(slug) {
    return '/category/' + (slug || 'news') + '/';
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data"
    },
    templateFormats: ["njk", "md", "html"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};
