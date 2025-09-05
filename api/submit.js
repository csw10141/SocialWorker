// api/submit.js
// npm i googleapis
const { google } = require('googleapis');

// --- 유틸 ---
function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim();
  if (Array.isArray(xf) && xf.length) return String(xf[0]).trim();
  return (req.socket && req.socket.remoteAddress) || '';
}

function sanitizePhoneDigits(p) {
  return String(p || '').replace(/[^0-9]/g, '').slice(0, 11);
}

// --- 구글 인증 & 시트 핸들러 ---
async function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  if (!clientEmail || !privateKeyRaw) {
    throw new Error('missing_google_env: GOOGLE_SHEETS_CLIENT_EMAIL/PRIVATE_KEY');
  }
  // \n 복원
  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  return sheets;
}

// --- 메인 핸들러 ---
module.exports = async function handler(req, res) {
  // CORS (필요 시 도메인 제한)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  try {
    // 입력 파싱
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const name = String((body.name || '')).trim();
    const phoneDigits = sanitizePhoneDigits(body.phone);
    const device = (body.device === 'mobile' || body.device === 'pc') ? body.device : 'unknown';
    // education -> 시트의 'Other' 컬럼에 저장할 값으로 정규화
    const rawArr = Array.isArray(body.education)
      ? body.education.map(v => String(v || '')).filter(Boolean)
      : (body.education != null && String(body.education).trim().length > 0
          ? [String(body.education)]
          : []);
    // 문자열 내 콤마 구분 처리 + 코드→한글 라벨 매핑
    const MAP = { highschool: '고졸', associate: '초대졸', college: '대졸', other: '기타' };
    const toKorean = (s) => {
      const t = String(s || '').trim();
      const key = t.toLowerCase();
      return MAP[key] || t; // 이미 한글이면 그대로 유지
    };
    const educationArr = rawArr
      .flatMap(v => String(v).split(','))
      .map(s => s.trim())
      .filter(Boolean)
      .map(toKorean);
    const otherValue = educationArr.join(',');

    if (!name) return res.status(400).json({ ok: false, error: 'name_required' });
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      return res.status(400).json({ ok: false, error: 'phone_invalid' });
    }

    // 메타
    const ip = getClientIp(req);
    const created_at = new Date().toISOString(); // 서버 기준 UTC (원하면 KST 포맷으로 변환 가능)

    // 구글 시트에 Append
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || 'Responses';
    if (!spreadsheetId) throw new Error('missing_google_env: GOOGLE_SHEETS_SPREADSHEET_ID');

    const sheets = await getSheetsClient();

    // 헤더 보장(선택): 첫 행이 비어 있다면 헤더 한 번 세팅
    // 필요 없으면 이 블록 제거해도 됩니다.
    await ensureHeadersIfEmpty(sheets, spreadsheetId, sheetName, [
      'created_at','name','phone','Other','device','ip','user_agent','referer'
    ]);

    // 행 추가
    const userAgent = String(req.headers['user-agent'] || '');
    const referer = String(req.headers['referer'] || '');
    const values = [[created_at, name, phoneDigits, otherValue, device, ip, userAgent, referer]];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });

    return res.status(200).json({
      ok: true,
      data: { name, phone: phoneDigits, education: otherValue, device, ip, created_at }
    });
  } catch (err) {
    console.error('submit error:', err?.message || err, err?.stack || '');
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
};

// 첫 행에 헤더 없으면 생성
async function ensureHeadersIfEmpty(sheets, spreadsheetId, sheetName, headers) {
  const get = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:Z1`,
    majorDimension: 'ROWS',
  }).catch(() => null);

  const firstRow = get?.data?.values?.[0] || [];
  if (firstRow.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    });
  }
}
