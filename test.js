const GoogleImageScraper = require('./src/index');

async function test() {
  const scraper = new GoogleImageScraper({
    limit: 5,
    timeout: 15000
  });

  try {
    console.log('🔍 Searching for images...');
    const results = await scraper.searchImages('cat', 5);
    
    console.log(`✅ Found ${results.length} images:`);
    results.forEach((img, i) => {
      console.log(`${i + 1}. ${img.url}`);
    });

    // Download first image
    if (results.length > 0) {
      console.log('📥 Downloading first image...');
      const image = await scraper.downloadImage(results[0].url);
      console.log(`✅ Downloaded ${image.contentType} (${image.buffer.length} bytes)`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test();
