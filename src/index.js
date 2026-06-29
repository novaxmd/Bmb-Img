const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

class GoogleImageScraper {
  constructor(options = {}) {
    this.timeout = options.timeout || 10000;
    this.userAgent = options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    this.limit = options.limit || 10;
  }

  // Method 1: Using Cheerio (Faster but may not work always)
  async searchWithCheerio(query, limit = 10) {
    try {
      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent
        },
        timeout: this.timeout
      });

      const $ = cheerio.load(response.data);
      const images = [];

      // Extract image URLs from Google's JSON data
      $('script').each((i, elem) => {
        const scriptContent = $(elem).html();
        if (scriptContent && scriptContent.includes('AF_initDataCallback')) {
          try {
            const matches = scriptContent.match(/\["([^"]+\.(jpg|jpeg|png|gif|webp))"/gi);
            if (matches) {
              matches.forEach(match => {
                const url = match.replace(/\["|"$/g, '');
                if (url && !images.includes(url)) {
                  images.push(url);
                }
              });
            }
          } catch (e) {}
        }
      });

      return images.slice(0, limit);
    } catch (error) {
      console.error('Cheerio scraping failed:', error.message);
      return [];
    }
  }

  // Method 2: Using Puppeteer (More reliable)
  async searchWithPuppeteer(query, limit = 10) {
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      await page.setUserAgent(this.userAgent);
      await page.setViewport({ width: 1280, height: 800 });

      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: this.timeout });

      // Scroll to load more images
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;

            if (totalHeight >= scrollHeight || totalHeight > 3000) {
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      });

      // Extract image URLs
      const images = await page.evaluate(() => {
        const urls = [];
        const imgElements = document.querySelectorAll('img');
        imgElements.forEach(img => {
          const src = img.src || img.getAttribute('src');
          if (src && src.startsWith('http') && !src.includes('google') && !src.includes('gstatic')) {
            urls.push(src);
          }
        });
        return urls;
      });

      return images.slice(0, limit);
    } catch (error) {
      console.error('Puppeteer scraping failed:', error.message);
      return [];
    } finally {
      if (browser) await browser.close();
    }
  }

  // Main search method (tries both methods)
  async searchImages(query, limit = null) {
    const maxImages = limit || this.limit;
    
    // Try Cheerio first (faster)
    let results = await this.searchWithCheerio(query, maxImages);
    
    // If Cheerio fails, try Puppeteer
    if (results.length === 0) {
      console.log('Cheerio failed, trying Puppeteer...');
      results = await this.searchWithPuppeteer(query, maxImages);
    }

    // Format results
    return results.map((url, index) => ({
      id: index + 1,
      url: url,
      source: 'Google Images',
      query: query
    }));
  }

  // Download image to buffer
  async downloadImage(url) {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': this.userAgent
        },
        timeout: this.timeout
      });
      return {
        buffer: Buffer.from(response.data),
        contentType: response.headers['content-type'] || 'image/jpeg'
      };
    } catch (error) {
      throw new Error(`Failed to download image: ${error.message}`);
    }
  }
}

module.exports = GoogleImageScraper;
