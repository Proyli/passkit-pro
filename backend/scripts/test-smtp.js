require('dotenv').config();
const nodemailer = require('nodemailer');

const t = nodemailer.createTransport({
  host: process.env.SMTP_HOST,           // smtp.office365.com
  port: Number(process.env.SMTP_PORT),   // 587
  secure: false,                         // STARTTLS
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

t.verify((err, ok) => {
  console.log(err || ok);
  process.exit(err ? 1 : 0);
});
