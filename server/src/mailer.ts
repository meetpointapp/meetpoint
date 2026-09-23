import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';
import { config } from './config';

const transport = config.smtp.host
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    })
  : null;


// Lokal geliştirmede e-posta sunucusu yok: mailler dev-mails/ klasörüne yazılır.
export async function sendMail(to: string, subject: string, text: string) {
  if (transport) {
    await transport.sendMail({ from: config.smtp.from, to, subject, text });
    return;
  }
  fs.mkdirSync(config.devMailDir, { recursive: true });
  const file = path.join(config.devMailDir, `${Date.now()}-${to.replace(/[^a-z0-9@.]/gi, '_')}.txt`);
  fs.writeFileSync(file, `To: ${to}\nSubject: ${subject}\n\n${text}\n`);
  console.log(`[dev-mail] ${to} · ${subject} → ${file}`);
}

type Purpose = 'verify' | 'reset';

const templates: Record<string, Record<Purpose, (code: string) => { subject: string; text: string }>> = {
  tr: {
    verify: (code) => ({
      subject: `MeetPoint doğrulama kodun: ${code}`,
      text: `Merhaba,\n\nMeetPoint hesabını doğrulamak için kodun: ${code}\n\nKod ${config.codeTtlMinutes} dakika geçerlidir. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.`,
    }),
    reset: (code) => ({
      subject: `MeetPoint şifre sıfırlama kodun: ${code}`,
      text: `Merhaba,\n\nŞifreni sıfırlamak için kodun: ${code}\n\nKod ${config.codeTtlMinutes} dakika geçerlidir. Bu isteği sen yapmadıysan hesabın güvende, bu e-postayı yok sayabilirsin.`,
    }),
  },
  en: {
    verify: (code) => ({
      subject: `Your MeetPoint verification code: ${code}`,
      text: `Hi,\n\nYour code to verify your MeetPoint account is: ${code}\n\nIt expires in ${config.codeTtlMinutes} minutes. If you didn't request this, you can ignore this email.`,
    }),
    reset: (code) => ({
      subject: `Your MeetPoint password reset code: ${code}`,
      text: `Hi,\n\nYour code to reset your password is: ${code}\n\nIt expires in ${config.codeTtlMinutes} minutes. If you didn't request this, your account is safe and you can ignore this email.`,
    }),
  },
};

export function codeMail(locale: string, purpose: Purpose, code: string) {
  return (templates[locale] ?? templates.en)[purpose](code);
}
