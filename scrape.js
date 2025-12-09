const puppeteer = require('puppeteer');

(async () => {
  let browser = null;
  let deals = [];

  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--single-process',
        '--no-zygote'
      ]
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    await page.goto('https://www.fmkorea.com/index.php?mid=hotdeal', { 
      waitUntil: 'networkidle2', 
      timeout: 90000 
    }).catch(() => {});

    await page.waitForFunction(
      () => document.title && (document.title.includes('핫딜') || document.title.includes('HOTDEAL')),
      { timeout: 90000 }
    ).catch(() => {});

    await page.evaluate(() => {
      const cf = document.querySelector('#cf-wrapper, .cf-browser-verification');
      if (cf) cf.remove();
      window.scrollBy(0, 1000);
    });

    await new Promise(r => setTimeout(r, 5000));

    deals = await page.evaluate(() => {
      const result = [];
      const links = document.querySelectorAll('a[href*="document_srl"]');
      
      links.forEach(a => {
        if (result.length >= 12) return;
        
        const title = a.innerText.trim();
        if (!title || title.length < 15 || 
            title.includes('추천') || title.includes('광고') || 
            title.includes('포텐 우대') || title.includes('회원들의 정보요구') || 
            title.includes('이슈에 편승')) return;

        let link = a.href;
        if (!link.startsWith('http')) link = 'https://www.fmkorea.com' + link;

        const img = a.closest('div')?.querySelector('img') || document.querySelector('img');
        const imgUrl = img ? (img.dataset.lazySrc || img.src || img.getAttribute('data-src') || '') : '';
        const fullImg = imgUrl.startsWith('//') ? 'https:' + imgUrl : imgUrl;

        const text = a.innerText;
        const prices = text.match(/(\d{1,3}(?:,\d{3})*)\s*원/g) || [];

        let old = '', newP = '', off = 'HOT';
        if (prices.length >= 2) {
          old = prices[0].replace(/[^\d]/g, '');
          newP = prices[1].replace(/[^\d]/g, '');
          off = Math.round((1 - newP/old)*100) + '% OFF';
        } else if (prices.length === 1) {
          newP = prices[0].replace(/[^\d]/g, '');
        }

        result.push({
          title,
          url: link,
          old_price: old,
          new_price: newP,
          discount: off,
          image_url: fullImg || '',
          content: title + "\n\n[btn]Xem deal ngay[/btn]"
        });
      });
      return result;
    });

  } catch (e) {
  } finally {
    if (browser) await browser.close();
    process.stdout.write(JSON.stringify(deals, null, 2));
  }
})();