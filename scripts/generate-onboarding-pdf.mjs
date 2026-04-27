import puppeteer from 'puppeteer';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.resolve(__dirname, '../public/saas-onboarding-guide.html');
const pdfPath = path.resolve(__dirname, '../public/saas-onboarding-guide.pdf');

// Find system Chromium
let executablePath;
try {
  executablePath = execSync('which chromium').toString().trim();
  if (!executablePath) executablePath = execSync('which chromium-browser').toString().trim();
} catch (e) {
  console.error('System Chromium not found, using Puppeteer bundled Chrome');
  executablePath = undefined;
}

console.log('Launching Puppeteer with:', executablePath || 'bundled Chrome');

const browser = await puppeteer.launch({
  headless: true,
  executablePath: executablePath || undefined,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
    '--single-process',
  ],
});

const page = await browser.newPage();
await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0', timeout: 30000 });

await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
  displayHeaderFooter: false,
});

await browser.close();
console.log('PDF generated:', pdfPath);
