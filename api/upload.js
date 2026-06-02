const { createHmac, createHash } = require('crypto');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { fileName, fileType } = req.body;
    if (!fileName || !fileType) { res.status(400).json({ error: 'fileName and fileType required' }); return; }

    const ACCESS_KEY = 'c16caf56327810b819ef8685aaedcbd4';
    const SECRET_KEY = '439aa829d17fb085ec496fc5c8798e7814aadb69a1d12e97c96cb6a1ac5b7ec2';
    const ACCOUNT_ID = 'f4ecf8d825ed354ee3f1b0dde9832eb4';
    const BUCKET = 'fitflux-content';
    const PUBLIC_URL = 'https://pub-02e62ba81a454d63962f8fca6338b343.r2.dev';

    const key = `content/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const host = `${ACCOUNT_ID}.r2.cloudflarestorage.com`;

    const now = new Date();
    const dateStr = now.toISOString().slice(0,10).replace(/-/g,'');
    const timeStr = now.toISOString().replace(/[:-]/g,'').slice(0,15)+'Z';
    const region = 'auto';
    const service = 's3';

    const expiry = 900; // 15 minutes
    const credentialScope = `${dateStr}/${region}/${service}/aws4_request`;
    const credential = `${ACCESS_KEY}/${credentialScope}`;

    const queryParams = [
      `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
      `X-Amz-Credential=${encodeURIComponent(credential)}`,
      `X-Amz-Date=${timeStr}`,
      `X-Amz-Expires=${expiry}`,
      `X-Amz-SignedHeaders=host`,
    ].join('&');

    const canonicalRequest = [
      'PUT',
      `/${BUCKET}/${key}`,
      queryParams,
      `host:${host}\n`,
      'host',
      'UNSIGNED-PAYLOAD'
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      timeStr,
      credentialScope,
      createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');

    const hmac = (k, d) => createHmac('sha256', k).update(d).digest();
    const signingKey = hmac(hmac(hmac(hmac('AWS4' + SECRET_KEY, dateStr), region), service), 'aws4_request');
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    const presignedUrl = `https://${host}/${BUCKET}/${key}?${queryParams}&X-Amz-Signature=${signature}`;
    const publicUrl = `${PUBLIC_URL}/${key}`;

    res.status(200).json({ presignedUrl, publicUrl, key });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
};
