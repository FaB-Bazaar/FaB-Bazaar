#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://fabbazaar.app';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Check if sitemap is accessible
async function checkSitemap() {
  log('🔍 Checking sitemap...', 'blue');
  
  return new Promise((resolve) => {
    https.get(`${SITE_URL}/sitemap.xml`, (res) => {
      if (res.statusCode === 200) {
        log('✅ Sitemap is accessible', 'green');
        resolve(true);
      } else {
        log(`❌ Sitemap returned status: ${res.statusCode}`, 'red');
        resolve(false);
      }
    }).on('error', (err) => {
      log(`❌ Error checking sitemap: ${err.message}`, 'red');
      resolve(false);
    });
  });
}

// Check if robots.txt is accessible
async function checkRobots() {
  log('🤖 Checking robots.txt...', 'blue');
  
  return new Promise((resolve) => {
    https.get(`${SITE_URL}/robots.txt`, (res) => {
      if (res.statusCode === 200) {
        log('✅ Robots.txt is accessible', 'green');
        resolve(true);
      } else {
        log(`❌ Robots.txt returned status: ${res.statusCode}`, 'red');
        resolve(false);
      }
    }).on('error', (err) => {
      log(`❌ Error checking robots.txt: ${err.message}`, 'red');
      resolve(false);
    });
  });
}

// Check if manifest.json is accessible
async function checkManifest() {
  log('📱 Checking manifest.json...', 'blue');
  
  return new Promise((resolve) => {
    https.get(`${SITE_URL}/manifest.json`, (res) => {
      if (res.statusCode === 200) {
        log('✅ Manifest.json is accessible', 'green');
        resolve(true);
      } else {
        log(`❌ Manifest.json returned status: ${res.statusCode}`, 'red');
        resolve(false);
      }
    }).on('error', (err) => {
      log(`❌ Error checking manifest.json: ${err.message}`, 'red');
      resolve(false);
    });
  });
}

// Check page load time
async function checkPageSpeed() {
  log('⚡ Checking page load time...', 'blue');
  
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    https.get(SITE_URL, (res) => {
      const loadTime = Date.now() - startTime;
      
      if (res.statusCode === 200) {
        if (loadTime < 1000) {
          log(`✅ Page loads in ${loadTime}ms (Fast)`, 'green');
        } else if (loadTime < 3000) {
          log(`⚠️ Page loads in ${loadTime}ms (Moderate)`, 'yellow');
        } else {
          log(`❌ Page loads in ${loadTime}ms (Slow)`, 'red');
        }
        resolve(loadTime);
      } else {
        log(`❌ Page returned status: ${res.statusCode}`, 'red');
        resolve(null);
      }
    }).on('error', (err) => {
      log(`❌ Error checking page speed: ${err.message}`, 'red');
      resolve(null);
    });
  });
}

// Generate SEO report
async function generateReport() {
  log('\n📊 Generating SEO Report for FaB Bazaar', 'blue');
  log('=' .repeat(50), 'blue');
  
  const results = {
    sitemap: await checkSitemap(),
    robots: await checkRobots(),
    manifest: await checkManifest(),
    pageSpeed: await checkPageSpeed()
  };
  
  log('\n📋 SEO Report Summary:', 'blue');
  log(`Sitemap: ${results.sitemap ? '✅' : '❌'}`);
  log(`Robots.txt: ${results.robots ? '✅' : '❌'}`);
  log(`Manifest.json: ${results.manifest ? '✅' : '❌'}`);
  log(`Page Speed: ${results.pageSpeed ? `${results.pageSpeed}ms` : '❌'}`);
  
  const allGood = results.sitemap && results.robots && results.manifest && results.pageSpeed;
  
  if (allGood) {
    log('\n🎉 All SEO checks passed!', 'green');
  } else {
    log('\n⚠️ Some SEO checks failed. Review the issues above.', 'yellow');
  }
  
  return results;
}

// Main CLI logic
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'check':
    case 'report':
      await generateReport();
      break;
    case 'sitemap':
      await checkSitemap();
      break;
    case 'robots':
      await checkRobots();
      break;
    case 'manifest':
      await checkManifest();
      break;
    case 'speed':
      await checkPageSpeed();
      break;
    default:
      log('🔧 FaB Bazaar SEO CLI', 'blue');
      log('Usage:', 'yellow');
      log('  node scripts/seo-cli.js check    - Run all SEO checks');
      log('  node scripts/seo-cli.js sitemap  - Check sitemap');
      log('  node scripts/seo-cli.js robots   - Check robots.txt');
      log('  node scripts/seo-cli.js manifest - Check manifest.json');
      log('  node scripts/seo-cli.js speed    - Check page load time');
      break;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  checkSitemap,
  checkRobots,
  checkManifest,
  checkPageSpeed,
  generateReport
}; 