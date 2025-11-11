import * as cheerio from 'cheerio';

/*
 * Robust author extraction that always finds a valid author name
 */

// Common website patterns for author extraction
const AUTHOR_PATTERNS = [
  // Structured data selectors (highest priority)
  'span[itemprop="author"] span[itemprop="name"]',
  'span[itemprop="author"]',
  '[itemtype*="Person"] [itemprop="name"]',
  
  // Recipe-specific selectors
  '.recipe-author .author-name',
  '.recipe-byline .author',
  '.recipe-credit .author',
  '.by-author .author-name',
  '.author-bio .author-name',
  
  // General author selectors
  '.author-name',
  '.byline-author',
  '.post-author',
  '.entry-author',
  'a[rel="author"]',
  '.byline .author',
  
  // Meta tags
  'meta[name="author"]',
  'meta[property="article:author"]',
  'meta[name="twitter:creator"]'
];

// Website-specific extraction rules
const SITE_SPECIFIC_RULES: { [domain: string]: (html: string) => string | null } = {
  'allrecipes.com': (html) => {
    const $ = cheerio.load(html);
    // Try recipe attribution first
    const attribution = $('.recipe-attribution .author-name').first().text().trim();
    if (attribution && isValidAuthorName(attribution)) return attribution;
    
    // Try community member
    const member = $('.community-member-name').first().text().trim();
    if (member && isValidAuthorName(member)) return member;
    
    return null;
  },
  
  'foodnetwork.com': (html) => {
    const $ = cheerio.load(html);
    // Try chef name
    const chef = $('.o-Attribution__a-Name').first().text().trim();
    if (chef && isValidAuthorName(chef)) return chef;
    
    // Try byline
    const byline = $('.o-Attribution__a-Author').first().text().trim();
    if (byline && isValidAuthorName(byline)) return byline;
    
    return null;
  },
  
  'seriouseats.com': (html) => {
    const $ = cheerio.load(html);
    // Try author link
    const author = $('.author-name a').first().text().trim();
    if (author && isValidAuthorName(author)) return author;
    
    // Try byline
    const byline = $('.byline .author').first().text().trim();
    if (byline && isValidAuthorName(byline)) return byline;
    
    return null;
  },
  
  'bonappetit.com': (html) => {
    const $ = cheerio.load(html);
    const author = $('.byline-name').first().text().trim();
    if (author && isValidAuthorName(author)) return author;
    return null;
  },
  
  'epicurious.com': (html) => {
    const $ = cheerio.load(html);
    const author = $('.by-author').first().text().trim();
    if (author && isValidAuthorName(author)) return author;
    return null;
  }
};

/*
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '';
  }
}

/*
 * Clean and validate author name
 */
function cleanAuthorName(name: string): string {
  return name
    .replace(/\s+/g, ' ')
    .replace(/^\s*by\s+/i, '')
    .replace(/\s*\|\s*.*$/, '')
    .replace(/\s*-\s*.*$/, '')
    .trim();
}

/*
 * Validate if a string is a proper author name
 */
function isValidAuthorName(name: string): boolean {
  if (!name || name.length < 2) return false;
  
  const cleaned = cleanAuthorName(name.toLowerCase());
  
  // Invalid terms
  const invalidTerms = [
    'recipe', 'course', 'ingredient', 'equipment', 'menu', 'navigation',
    'home', 'about', 'contact', 'blog', 'category', 'tag', 'share', 'print',
    'directions', 'steps', 'prep', 'cook', 'time', 'servings', 'yield',
    'kitchen', 'food', 'cooking', 'chef', 'recipes', 'editorial', 'staff',
    'team', 'magazine', 'website', 'network', 'company', 'inc', 'llc'
  ];
  
  if (invalidTerms.some(term => cleaned.includes(term))) return false;
  
  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(cleaned)) return false;
  
  // Should not be just numbers or symbols
  if (/^[\d\s\-_.,!@#$%^&*()]+$/.test(cleaned)) return false;
  
  return true;
}

/*
 * Generate fallback author name based on domain
 */
function generateFallbackAuthor(url: string): string {
  const domain = extractDomain(url);
  
  const domainToAuthor: { [key: string]: string } = {
    'allrecipes.com': 'Allrecipes Community',
    'foodnetwork.com': 'Food Network Kitchen',
    'seriouseats.com': 'Serious Eats Team',
    'bonappetit.com': 'Bon Appétit',
    'epicurious.com': 'Epicurious',
    'foodandwine.com': 'Food & Wine',
    'delish.com': 'Delish',
    'eatingwell.com': 'EatingWell',
    'myrecipes.com': 'MyRecipes',
    'cookinglight.com': 'Cooking Light',
    'southernliving.com': 'Southern Living',
    'realsimple.com': 'Real Simple',
    'tasteofhome.com': 'Taste of Home',
    'betterhomesandgardens.com': 'Better Homes & Gardens',
    'pillsbury.com': 'Pillsbury',
    'kraftrecipes.com': 'Kraft Recipes',
    'campbells.com': 'Campbell\'s Kitchen'
  };
  
  return domainToAuthor[domain] || `${domain.split('.')[0]} Chef`;
}

/*
 * Extract author with multiple fallback strategies
 */
export function extractRobustAuthor(html: string, url: string): string {
  const $ = cheerio.load(html);
  const domain = extractDomain(url);
  
  // Strategy 1: Try site-specific extraction
  if (SITE_SPECIFIC_RULES[domain]) {
    const siteAuthor = SITE_SPECIFIC_RULES[domain](html);
    if (siteAuthor) return cleanAuthorName(siteAuthor);
  }
  
  // Strategy 2: Try JSON-LD structured data
  const jsonLdElements = $('script[type="application/ld+json"]');
  for (let i = 0; i < jsonLdElements.length; i++) {
    const jsonLd = $(jsonLdElements[i]).html();
    if (jsonLd) {
      try {
        const data = JSON.parse(jsonLd);
        const graph = Array.isArray(data) ? data : (data['@graph'] || [data]);
        const recipe = graph.find((item: any) => 
          item['@type'] === 'Recipe' || 
          (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))
        );
        
        if (recipe?.author) {
          let authorName = '';
          if (typeof recipe.author === 'string') {
            authorName = recipe.author;
          } else if (recipe.author.name) {
            authorName = recipe.author.name;
          } else if (Array.isArray(recipe.author) && recipe.author[0]?.name) {
            authorName = recipe.author[0].name;
          }
          
          if (authorName && isValidAuthorName(authorName)) {
            return cleanAuthorName(authorName);
          }
        }
      } catch (e) {
        // Continue to next strategy
      }
    }
  }
  
  // Strategy 3: Try common CSS selectors
  for (const selector of AUTHOR_PATTERNS) {
    const element = $(selector).first();
    if (element.length > 0) {
      const text = element.text().trim() || element.attr('content')?.trim() || '';
      if (text && isValidAuthorName(text)) {
        return cleanAuthorName(text);
      }
    }
  }
  
  // Strategy 4: Try regex patterns in text
  const bodyText = $('body').text();
  const patterns = [
    /Recipe\s+by\s+([A-Z][a-zA-Z\s]{2,30})/i,
    /Created\s+by\s+([A-Z][a-zA-Z\s]{2,30})/i,
    /Chef\s+([A-Z][a-zA-Z\s]{2,30})/i,
    /By\s+([A-Z][a-zA-Z\s]{2,30})/i
  ];
  
  for (const pattern of patterns) {
    const match = bodyText.match(pattern);
    if (match && match[1] && isValidAuthorName(match[1])) {
      return cleanAuthorName(match[1]);
    }
  }
  
  // Strategy 5: Use domain-based fallback
  return generateFallbackAuthor(url);
}
