import nodemailer from "nodemailer"
import { env } from "../config/env"

export async function sendInviteEmail(to: string, inviteUrl: string): Promise<void> {
  const subject = "You've been invited to Growteq"
  const text = `You've been invited to join Growteq.\n\nClick the link below to set your password and activate your account:\n\n${inviteUrl}\n\nThis link expires in 24 hours.`
  const html = `<p>You've been invited to join Growteq.</p><p><a href="${inviteUrl}">Click here to set your password</a> and activate your account.</p><p>This link expires in 24 hours.</p>`

  if (!env.smtpHost) {
    console.info("[email] SMTP not configured; invite link (not sent via mail):", inviteUrl)
    return
  }

  const transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth:
      env.smtpUser && env.smtpPass
        ? {
            user: env.smtpUser,
            pass: env.smtpPass,
          }
        : undefined,
  })

  await transporter.sendMail({
    from: env.smtpFrom || env.smtpUser || "noreply@growteq.local",
    to,
    subject,
    text,
    html,
  })
}
