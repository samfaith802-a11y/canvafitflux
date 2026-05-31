const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const R2 = new S3Client({
  region: "auto",
  endpoint: "https://f4ecf8d825ed354ee3f1b0dde9832eb4.r2.cloudflarestorage.com",
  credentials: {
    accessKeyId: "c16caf56327810b819ef8685aaedcbd4",
    secretAccessKey: "439aa829d17fb085ec496fc5c8798e7814aadb69a1d12e97c96cb6a1ac5b7ec2",
  },
});

const BUCKET = "fitflux-content";
const PUBLIC_URL = "https://pub-02e62ba81a454d63962f8fca6338b343.r2.dev";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const contentType = req.headers["content-type"] || "";
    const boundary = contentType.split("boundary=")[1];
    if (!boundary) { res.status(400).json({ error: "No boundary found" }); return; }

    const parts = buffer.toString("binary").split("--" + boundary);
    let fileBuffer = null;
    let fileName = "upload_" + Date.now();
    let mimeType = "application/octet-stream";

    for (const part of parts) {
      if (part.includes("Content-Disposition") && part.includes("filename=")) {
        const nameMatch = part.match(/filename="([^"]+)"/);
        if (nameMatch) fileName = nameMatch[1].replace(/[^a-zA-Z0-9._-]/g, "_");
        const mimeMatch = part.match(/Content-Type: ([^\r\n]+)/);
        if (mimeMatch) mimeType = mimeMatch[1].trim();
        const bodyStart = part.indexOf("\r\n\r\n") + 4;
        const bodyEnd = part.lastIndexOf("\r\n");
        if (bodyStart > 3 && bodyEnd > bodyStart) {
          fileBuffer = Buffer.from(part.slice(bodyStart, bodyEnd), "binary");
        }
      }
    }

    if (!fileBuffer) { res.status(400).json({ error: "No file found" }); return; }

    const key = `content/${Date.now()}_${fileName}`;
    await R2.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
    }));

    res.status(200).json({ url: `${PUBLIC_URL}/${key}`, key });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
