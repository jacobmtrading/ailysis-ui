// Transactional email via Resend (https://resend.com).
// Requires env: RESEND_API_KEY, MAIL_FROM (e.g. "Ailysis <no-reply@yourdomain.com>").
// If RESEND_API_KEY is missing (e.g. local dev), we log the message instead of
// sending, so signup still works without crashing.

const RESEND_API_KEY = process.env.RESEND_API_KEY
const MAIL_FROM = process.env.MAIL_FROM || 'Ailysis <onboarding@resend.dev>'

export function appUrl() {
  // Base URL of the deployed app, used to build links inside emails.
  return (
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173')
  ).replace(/\/$/, '')
}

async function send({ to, subject, html, text }) {
  if (!RESEND_API_KEY) {
    console.log(`[mail] (no RESEND_API_KEY) would send to ${to}: ${subject}\n${text || ''}`)
    return { skipped: true }
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: MAIL_FROM, to, subject, html, text }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Email send failed (${res.status}): ${body}`)
  }
  return res.json()
}

function emailShell(heading, bodyHtml) {
  return `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin:0 0 12px">${heading}</h2>
      ${bodyHtml}
    </div>`
}

function ctaButton(link, label) {
  return `
    <p style="margin:0 0 24px">
      <a href="${link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">${label}</a>
    </p>
    <p style="margin:0 0 8px;font-size:13px;color:#666">Or paste this link into your browser:</p>
    <p style="margin:0 0 20px;font-size:13px;word-break:break-all"><a href="${link}">${link}</a></p>`
}

export async function sendLoginLinkEmail(email, token) {
  const link = `${appUrl()}/api/login-link?token=${encodeURIComponent(token)}`
  const subject = 'Your Ailysis login link'
  const text = `Log in to Ailysis with this link (expires in 15 minutes):\n${link}\n\nIf you didn't request this, you can ignore this email.`
  const html = emailShell(
    'Log in to Ailysis',
    `<p style="margin:0 0 20px;line-height:1.5;color:#333">Click the button below to log in. No password needed.</p>` +
      ctaButton(link, 'Log in') +
      `<p style="margin:0;font-size:12px;color:#999">This link expires in 15 minutes. If you didn't request it, you can ignore this email.</p>`,
  )
  return send({ to: email, subject, html, text })
}

export async function sendPasswordResetEmail(email, token) {
  const link = `${appUrl()}/?reset=${encodeURIComponent(token)}`
  const subject = 'Reset your Ailysis password'
  const text = `Reset your Ailysis password with this link (expires in 30 minutes):\n${link}\n\nIf you didn't request this, you can ignore this email — your password won't change.`
  const html = emailShell(
    'Reset your password',
    `<p style="margin:0 0 20px;line-height:1.5;color:#333">Click below to choose a new password.</p>` +
      ctaButton(link, 'Reset password') +
      `<p style="margin:0;font-size:12px;color:#999">This link expires in 30 minutes. If you didn't request it, ignore this email — your password won't change.</p>`,
  )
  return send({ to: email, subject, html, text })
}

export async function sendVerificationEmail(email, token) {
  const link = `${appUrl()}/api/verify?token=${encodeURIComponent(token)}`
  const subject = 'Confirm your email for Ailysis'
  const text = `Welcome to Ailysis!\n\nConfirm your email address to unlock subscriptions:\n${link}\n\nThis link expires in 24 hours. If you didn't create an account, you can ignore this email.`
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin:0 0 12px">Confirm your email</h2>
      <p style="margin:0 0 20px;line-height:1.5;color:#333">
        Welcome to Ailysis. Confirm your email address to unlock subscriptions and premium tools.
      </p>
      <p style="margin:0 0 24px">
        <a href="${link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">
          Confirm email
        </a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#666">Or paste this link into your browser:</p>
      <p style="margin:0 0 20px;font-size:13px;word-break:break-all"><a href="${link}">${link}</a></p>
      <p style="margin:0;font-size:12px;color:#999">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
    </div>`
  return send({ to: email, subject, html, text })
}
