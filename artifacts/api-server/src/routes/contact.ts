import { Router, type IRouter } from "express";
import nodemailer from "nodemailer";

const router: IRouter = Router();

router.post("/contact", async (req, res) => {
  const { jmeno, telefon, email, dotaz } = req.body as {
    jmeno?: string;
    telefon?: string;
    email?: string;
    dotaz?: string;
  };

  if (!telefon || telefon.trim() === "") {
    res.status(400).json({ error: "Telefon je povinný." });
    return;
  }

  const smtpHost = process.env["SMTP_HOST"];
  const smtpUser = process.env["SMTP_USER"];
  const smtpPass = process.env["SMTP_PASS"];
  const smtpPort = Number(process.env["SMTP_PORT"] ?? "587");

  if (!smtpHost || !smtpUser || !smtpPass) {
    req.log.warn("SMTP not configured – logging contact form submission");
    req.log.info({ jmeno, telefon, email, dotaz }, "Contact form submission");
    res.json({ ok: true });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { type: "LOGIN", user: smtpUser, pass: smtpPass },
    tls: {
      rejectUnauthorized: false,
      ciphers: "DEFAULT@SECLEVEL=0",
      minDHSize: 512,
    },
  });

  const text = [
    jmeno ? `Jméno: ${jmeno}` : null,
    `Telefon: ${telefon}`,
    email ? `E-mail: ${email}` : null,
    dotaz ? `\nDotaz:\n${dotaz}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await transporter.sendMail({
      from: smtpUser,
      to: "borcovna@roberton.cz",
      subject: "Nová zpráva z webu Borcovna",
      text,
      replyTo: email ?? undefined,
    });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to send contact email");
    res.status(500).json({ error: "Nepodařilo se odeslat zprávu." });
  }
});

export default router;
