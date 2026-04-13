import type { Handler } from "@netlify/functions";
import nodemailer from "nodemailer";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { jmeno, telefon, email, dotaz } = JSON.parse(event.body ?? "{}");

  if (!telefon || telefon.trim() === "") {
    return { statusCode: 400, body: JSON.stringify({ error: "Telefon je povinný." }) };
  }

  const smtpHost = process.env["SMTP_HOST"];
  const smtpUser = process.env["SMTP_USER"];
  const smtpPass = process.env["SMTP_PASS"];
  const smtpPort = Number(process.env["SMTP_PORT"] ?? "465");

  if (!smtpHost || !smtpUser || !smtpPass) {
    return { statusCode: 500, body: JSON.stringify({ error: "SMTP není nakonfigurováno." }) };
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { type: "LOGIN", user: smtpUser, pass: smtpPass },
    tls: { rejectUnauthorized: false, ciphers: "DEFAULT@SECLEVEL=0", minDHSize: 512 },
  });

  const text = [
    jmeno ? `Jméno: ${jmeno}` : null,
    `Telefon: ${telefon}`,
    email ? `E-mail: ${email}` : null,
    dotaz ? `\nDotaz:\n${dotaz}` : null,
  ].filter(Boolean).join("\n");

  try {
    await transporter.sendMail({
      from: smtpUser,
      to: "borcovna@roberton.cz",
      subject: "Nová zpráva z webu Borcovna",
      text,
      replyTo: email ?? undefined,
    });
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error("Failed to send email:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Nepodařilo se odeslat zprávu." }) };
  }
};
