const fs = require('fs');
const path = require('path');

const distIndex = path.join(__dirname, '..', 'dist', 'index.html');
const testQrSrc = path.join(__dirname, '..', 'test-qr-codes.html');
const testQrDest = path.join(__dirname, '..', 'dist', 'test-qr-codes.html');

if (fs.existsSync(distIndex)) {
  let html = fs.readFileSync(distIndex, 'utf8');
  const fontSnippet = `
    <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons" />
    <style id="kea-material-icons-font-fix">
      @font-face {
        font-family: 'material';
        src: url('https://fonts.gstatic.com/s/materialicons/v142/flUhRq6tzZclQEJ-Vdg-IuiaDsNc.woff2') format('woff2');
        font-display: block;
      }
      @font-face {
        font-family: 'MaterialIcons';
        src: url('https://fonts.gstatic.com/s/materialicons/v142/flUhRq6tzZclQEJ-Vdg-IuiaDsNc.woff2') format('woff2');
        font-display: block;
      }
      @font-face {
        font-family: 'Material Icons';
        src: url('https://fonts.gstatic.com/s/materialicons/v142/flUhRq6tzZclQEJ-Vdg-IuiaDsNc.woff2') format('woff2');
        font-display: block;
      }
    </style>
  `;

  if (!html.includes('kea-material-icons-font-fix')) {
    html = html.replace('</head>', `${fontSnippet}</head>`);
    fs.writeFileSync(distIndex, html, 'utf8');
    console.log('[post-build] Injected vector icon font definitions into dist/index.html');
  }
}

if (fs.existsSync(testQrSrc)) {
  fs.copyFileSync(testQrSrc, testQrDest);
  console.log('[post-build] Copied test-qr-codes.html to dist/test-qr-codes.html');
}
