import type { Handler } from "@netlify/functions";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const handler: Handler = async (event) => {
  const gallery = event.queryStringParameters?.gallery;
  if (!gallery) {
    return { statusCode: 400, body: JSON.stringify({ error: "Chybí parametr gallery" }) };
  }

  const command = new ListObjectsV2Command({
    Bucket: "roberton-photos",
    Prefix: `${gallery}/`,
  });

  const response = await s3.send(command);
  const urls = (response.Contents ?? [])
    .filter(obj => obj.Key && !obj.Key.endsWith("/"))
    .map(obj => `https://images.roberton.cz/${obj.Key}`);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photos: urls }),
  };
};