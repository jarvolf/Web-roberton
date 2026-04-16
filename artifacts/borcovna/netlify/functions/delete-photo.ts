import type { Handler, HandlerEvent } from "@netlify/functions";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const CORRECT_PASSWORD = "Borcovna2024!";

const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "DELETE") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { password, filename } = JSON.parse(event.body || "{}");

    if (password !== CORRECT_PASSWORD) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Nesprávné heslo" }),
      };
    }

    if (!filename) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Chybí název souboru" }),
      };
    }

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: "borcovna-photos",
        Key: filename,
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Foto smazáno" }),
    };
  } catch (error) {
    console.error("Delete error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Chyba při mazání" }),
    };
  }
};