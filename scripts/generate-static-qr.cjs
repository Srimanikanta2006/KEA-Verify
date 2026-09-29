const fs = require('fs');
const QRCode = require('qrcode');

async function run() {
  const validCandidates = [
    { name: 'ANANYA SHETTY', rollNo: 'KAR-24-91000', room: 'Room 01', exam: 'Civil Police Constable - RPC 2026', centreId: 'centre_an0081' },
    { name: 'MOHAMMED ZEYAN', rollNo: 'KAR-24-91137', room: 'Room 02', exam: 'Civil Police Constable - RPC 2026', centreId: 'centre_an0081' },
    { name: 'PRIYANKA K. V.', rollNo: 'KAR-24-91274', room: 'Room 03', exam: 'Civil Police Constable - RPC 2026', centreId: 'centre_an0081' },
    { name: 'RAHUL GOWDA', rollNo: 'KAR-24-91411', room: 'Room 04', exam: 'Civil Police Constable - RPC 2026', centreId: 'centre_an0081' },
    { name: 'SNEHA HEGDE', rollNo: 'KAR-24-91548', room: 'Room 05', exam: 'Civil Police Constable - RPC 2026', centreId: 'centre_an0081' },
    { name: 'KARTHIK RAO', rollNo: 'KAR-24-91685', room: 'Room 06', exam: 'Civil Police Constable - RPC 2026', centreId: 'centre_an0081' }
  ];

  const invalidTests = [
    {
      title: 'Non-Existent Roll Number',
      desc: 'Proper KEA format, but roll number is not in Firestore or offline roster.',
      payload: 'KEA|KAR-24-99999|Civil Police Constable - RPC 2026|centre_an0081|Room 99'
    },
    {
      title: 'Random Non-KEA QR Code',
      desc: 'Standard website URL (e.g. google.com).',
      payload: 'https://google.com'
    }
  ];

  for (const c of validCandidates) {
    c.payload = `KEA|${c.rollNo}|${c.exam}|${c.centreId}|${c.room}`;
    c.qr = await QRCode.toDataURL(c.payload, { width: 220, margin: 1, color: { dark: '#151c27', light: '#ffffff' } });
  }

  for (const t of invalidTests) {
    t.qr = await QRCode.toDataURL(t.payload, { width: 180, margin: 1, color: { dark: '#ba1a1a', light: '#ffffff' } });
  }

  const validCardsHtml = validCandidates.map(c => `
      <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center text-center space-y-3">
        <div class="w-full text-left border-b border-slate-100 pb-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-orange-600 tracking-wider">${c.room}</span>
            <span class="text-[11px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-semibold">${c.rollNo}</span>
          </div>
          <h3 class="font-bold text-slate-800 text-base mt-1 truncate">${c.name}</h3>
        </div>

        <div class="p-3 bg-white border border-slate-100 rounded-xl shadow-inner my-2 flex items-center justify-center">
          <img src="${c.qr}" alt="QR Code for ${c.name}" class="w-48 h-48 block object-contain" />
        </div>

        <div class="w-full text-left bg-slate-50 p-2.5 rounded-lg border border-slate-100">
          <span class="text-[10px] text-slate-400 font-mono block uppercase">Raw QR Payload:</span>
          <code class="text-[11px] text-slate-700 font-mono break-all leading-tight select-all">${c.payload}</code>
        </div>
      </div>
  `).join('\n');

  const invalidCardsHtml = invalidTests.map(t => `
      <div class="bg-white p-5 rounded-2xl shadow-sm border border-rose-100 flex flex-col md:flex-row items-center gap-5">
        <div class="p-2 bg-white border border-slate-200 rounded-xl flex-shrink-0">
          <img src="${t.qr}" alt="QR Code for ${t.title}" class="w-36 h-36 block object-contain" />
        </div>
        <div class="text-left space-y-2 flex-1">
          <span class="text-xs font-bold text-rose-600 uppercase tracking-wide bg-rose-50 px-2 py-0.5 rounded">Error Test</span>
          <h3 class="font-bold text-slate-800 text-base">${t.title}</h3>
          <p class="text-xs text-slate-500">${t.desc}</p>
          <div class="bg-slate-50 p-2 rounded border border-slate-100">
            <code class="text-[11px] text-slate-700 font-mono break-all select-all">${t.payload}</code>
          </div>
        </div>
      </div>
  `).join('\n');

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KEA Verify — Test Hall Ticket QR Codes</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; background-color: #f9f9ff; }
  </style>
</head>
<body class="p-6 md:p-12 text-[#151c27]">
  <div class="max-w-5xl mx-auto space-y-8">
    <!-- Header -->
    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <span class="inline-block w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
          <span class="text-xs font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Feature 2 Test Bench</span>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 mt-2">KEA Verify — Candidate QR Test Bench</h1>
        <p class="text-sm text-slate-500 mt-1">Point your camera running the KEA Verify app at any QR code below to test instant candidate lookup.</p>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-xs font-medium text-slate-400">Centre:</span>
        <span class="text-xs font-semibold bg-orange-100 text-orange-900 px-3 py-1.5 rounded-lg border border-orange-200">AN0081 · Govt SHVNM Girls PU College</span>
      </div>
    </div>

    <!-- Candidate Cards Grid -->
    <div>
      <h2 class="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
        <span>Valid Seeded Candidates (Centre AN0081)</span>
        <span class="text-xs font-normal text-slate-500">(Will trigger Candidate Found card)</span>
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="candidateList">
${validCardsHtml}
      </div>
    </div>

    <!-- Negative / Error Test Cases -->
    <div class="pt-6 border-t border-slate-200">
      <h2 class="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
        <span>Negative / Error Test Cases</span>
        <span class="text-xs font-normal text-slate-500">(Will trigger "QR Not Found" error card)</span>
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6" id="invalidList">
${invalidCardsHtml}
      </div>
    </div>
  </div>
</body>
</html>
`;

  fs.writeFileSync('test-qr-codes.html', fullHtml, 'utf8');
  console.log('Successfully wrote test-qr-codes.html with embedded base64 QR codes!');
}

run().catch(console.error);
