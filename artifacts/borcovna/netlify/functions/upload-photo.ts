import type { Handler } from "@netlify/functions";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const UPLOAD_PASSWORD = process.env.UPLOAD_PASSWORD!;

/** Musí odpovídat `GALLERIES` v `src/pages/upload.tsx` / `sections` v `App.tsx` + allowlistu na workeru upload-photo. */
const ALLOWED_GALLERIES = [
  "kuchyne",
  "predsine",
  "detske",
  "skrine",
  "koupelny",
  "loznice",
  "obyvaci",
  "recepce",
  "satny",
];

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { password, gallery, filename, contentType } = JSON.parse(event.body ?? "{}");

  if (password !== UPLOAD_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: "Nesprávné heslo" }) };
  }

  if (!ALLOWED_GALLERIES.includes(gallery)) {
    return { statusCode: 400, body: JSON.stringify({ error: "Neplatná galerie" }) };
  }

  const key = `${gallery}/${Date.now()}-${filename}`;
  const command = new PutObjectCommand({
    Bucket: "roberton-photos",
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 300 });

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadUrl: url, key }),
  };
};