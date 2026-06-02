export const config = { api: { bodyParser: false } };

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const contentType = req.headers['content-type'] || '';
    const boundary = contentType.split('boundary=')[1];
    if (!boundary) { res.status(400).json({ error: 'No boundary' }); return; }

    const parts = buffer.toString('binary').split('--' + boundary);
    let fileBuffer = null;
    let fileName = 'upload_' + Date.now();
    let mimeType = 'application/octet-stream';

    for (const part of parts) {
      if (part.includes('Content-Disposition') && part.includes('filename=')) {
        const nameMatch = part.match(/filename="([^"]+)"/);
        if (nameMatch) fileName = nameMatch[1].replace(/[^a-zA-Z0-9._-]/g, '_');
        const mimeMatch = part.match(/Content-Type: ([^\r\n]+)/);
        if (mimeMatch) mimeType = mimeMatch[1].trim();
        const bodyStart = part.indexOf('\r\n\r\n') + 4;
        const bodyEnd = part.lastIndexOf('\r\n');
        if (bodyStart > 3 && bodyEnd > bodyStart) {
          fileBuffer = Buffer.from(part.slice(bodyStart, bodyEnd), 'binary');
        }
      }
    }

    if (!fileBuffer) { res.status(400).json({ error: 'No file found' }); return; }

    const key = `content/${Date.now()}_${fileName}`;
    const ACCOUNT_ID = 'f4ecf8d825ed354ee3f1b0dde9832eb4';
    const BUCKET = 'fitflux-content';
    const ACCESS_KEY = 'c16caf56327810b819ef8685aaedcbd4';
    const SECRET_KEY = '439aa829d17fb085ec496fc5c8798e7814aadb69a1d12e97c96cb6a1ac5b7ec2';

    // Use AWS Signature V4 via manual implementation
    const { createHmac, createHash } = require('crypto');
    
    const now = new Date();
    const dateStr = now.toISOString().slice(0,10).replace(/-/g,'');
    const timeStr = now.toISOString().replace(/[:-]/g,'').slice(0,15)+'Z';
    const region = 'auto';
    const service = 's3';
    const host = `${ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const endpoint = `https://${host}/${BUCKET}/${key}`;

    const payloadHash = createHash('sha256').update(fileBuffer).digest('hex');
    
    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${timeStr}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = `PUT\n/${BUCKET}/${key}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    
    const credentialScope = `${dateStr}/${region}/${service}/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${timeStr}\n${credentialScope}\n${createHash('sha256').update(canonicalRequest).digest('hex')}`;
    
    const hmac = (key, data) => createHmac('sha256', key).update(data).digest();
    const signingKey = hmac(hmac(hmac(hmac('AWS4' + SECRET_KEY, dateStr), region), service), 'aws4_request');
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    
    const authorization = `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const uploadRes = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Authorization': authorization,
        'x-amz-date': timeStr,
        'x-amz-content-sha256': payloadHash,
        'Content-Type': mimeType,
        'Content-Length': fileBuffer.length.toString()
      },
      body: fileBuffer
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      res.status(500).json({ error: errText });
      return;
    }

    const publicUrl = `https://pub-02e62ba81a454d63962f8fca6338b343.r2.dev/${key}`;
    res.status(200).json({ url: publicUrl, key });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
