// lib/component-library/contact.ts
// KRYPTON AI Component Library — Contact Components
// HTML always from component library. AI provides copy only.

import { ComponentContext, SPACING, RADIUS, SHADOW, wrapSection } from "./tokens";

export interface ContactContent {
  eyebrow?:     string;
  headline:     string;
  subheadline?: string;
  email?:       string;
  phone?:       string;
  address?:     string;
  // Form field labels (AI provides these)
  namePlaceholder?:    string;
  emailPlaceholder?:   string;
  subjectPlaceholder?: string;
  messagePlaceholder?: string;
  submitText?:         string;
  successMessage?:     string;
}

// ── Shared form JS (identical across all variants) ─────────────────
function formScript(): string {
  return `<script>
(function(){
  var form=document.getElementById('krypton-contact');
  if(!form)return;
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var btn=form.querySelector('button[type="submit"]');
    var status=document.getElementById('krypton-form-status');
    if(!btn||!status)return;
    btn.disabled=true;
    btn.textContent='Sending...';
    setTimeout(function(){
      btn.textContent='✓ Sent!';
      status.style.display='block';
      form.reset();
      setTimeout(function(){btn.disabled=false;btn.textContent=form.dataset.submit||'Send Message';status.style.display='none';},4000);
    },1200);
  });
})();
</script>`;
}

// ── Shared input style ────────────────────────────────────────────
const INPUT = `background:var(--bg);border:1px solid var(--border);border-radius:${RADIUS.sm};padding:12px 14px;color:var(--text);font-size:14px;width:100%;outline:none;font-family:inherit;transition:border-color .2s;`;
const LABEL = `font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-2);display:block;margin-bottom:6px;`;

// ── Variant 1: Full Contact Form — name, email, subject, message ──
export function contactFullForm(ctx: ComponentContext, c: ContactContent): string {
  const inner = `
  <div style="text-align:center;max-width:560px;margin:0 auto ${SPACING.lg};">
    ${c.eyebrow ? `<p style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--primary);margin-bottom:12px;">${c.eyebrow}</p>` : ""}
    <h2 style="font-family:var(--heading-font);font-weight:var(--heading-weight);font-size:clamp(26px,4vw,42px);color:var(--text);margin-bottom:${c.subheadline ? "12px" : "0"};">${c.headline}</h2>
    ${c.subheadline ? `<p style="font-size:16px;color:var(--text-2);">${c.subheadline}</p>` : ""}
  </div>

  <form id="krypton-contact" data-submit="${c.submitText || "Send Message"}"
    style="max-width:680px;margin:0 auto;background:var(--card);border:1px solid var(--border);border-radius:${RADIUS.xl};padding:${SPACING.lg};display:flex;flex-direction:column;gap:20px;">

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;" class="contact-row">
      <div>
        <label style="${LABEL}">${c.namePlaceholder ? "Name" : "Name"}</label>
        <input type="text" required placeholder="${c.namePlaceholder || "Your name"}" aria-label="Full name"
          style="${INPUT}" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'">
      </div>
      <div>
        <label style="${LABEL}">Email</label>
        <input type="email" required placeholder="${c.emailPlaceholder || "your@email.com"}" aria-label="Email address"
          style="${INPUT}" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'">
      </div>
    </div>

    <div>
      <label style="${LABEL}">Subject</label>
      <input type="text" placeholder="${c.subjectPlaceholder || "How can we help?"}" aria-label="Subject"
        style="${INPUT}" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'">
    </div>

    <div>
      <label style="${LABEL}">Message</label>
      <textarea required rows="5" placeholder="${c.messagePlaceholder || "Tell us about your project..."}"
        aria-label="Message" style="${INPUT}resize:vertical;min-height:120px;"
        onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'"></textarea>
    </div>

    <button type="submit"
      style="background:var(--grad);color:#fff;border:none;padding:15px 32px;border-radius:${RADIUS.md};font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s;align-self:flex-start;"
      onmouseenter="this.style.opacity='.85';this.style.transform='translateY(-1px)'"
      onmouseleave="this.style.opacity='1';this.style.transform='none'">
      ${c.submitText || "Send Message"}
    </button>

    <div id="krypton-form-status" style="display:none;padding:12px 16px;border-radius:${RADIUS.sm};background:rgba(76,175,138,0.1);border:1px solid rgba(76,175,138,0.3);color:#4CAF8A;font-size:13px;font-weight:600;">
      ${c.successMessage || "✓ Message sent! We'll get back to you within 24 hours."}
    </div>
  </form>

  ${c.email || c.phone || c.address ? `
  <div style="display:flex;justify-content:center;gap:${SPACING.lg};flex-wrap:wrap;margin-top:${SPACING.md};">
    ${c.email ? `<div style="display:flex;align-items:center;gap:10px;"><span style="font-size:18px;">📧</span><span style="font-size:14px;color:var(--text-2);">${c.email}</span></div>` : ""}
    ${c.phone ? `<div style="display:flex;align-items:center;gap:10px;"><span style="font-size:18px;">📞</span><span style="font-size:14px;color:var(--text-2);">${c.phone}</span></div>` : ""}
    ${c.address ? `<div style="display:flex;align-items:center;gap:10px;"><span style="font-size:18px;">📍</span><span style="font-size:14px;color:var(--text-2);">${c.address}</span></div>` : ""}
  </div>` : ""}

  <style>@media(max-width:640px){.contact-row{grid-template-columns:1fr !important;}}</style>
  ${formScript()}`;

  return wrapSection("contact", inner);
}

// ── Variant 2: Split — copy left, form right ──────────────────────
export function contactSplit(ctx: ComponentContext, c: ContactContent): string {
  const inner = `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:${SPACING.xl};align-items:start;" class="contact-split">
    <div>
      ${c.eyebrow ? `<p style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--primary);margin-bottom:12px;">${c.eyebrow}</p>` : ""}
      <h2 style="font-family:var(--heading-font);font-weight:var(--heading-weight);font-size:clamp(28px,4vw,44px);color:var(--text);margin-bottom:16px;">${c.headline}</h2>
      ${c.subheadline ? `<p style="font-size:16px;color:var(--text-2);line-height:1.75;margin-bottom:${SPACING.md};">${c.subheadline}</p>` : ""}
      <div style="display:flex;flex-direction:column;gap:16px;">
        ${c.email ? `<div style="display:flex;align-items:center;gap:12px;"><div style="width:40px;height:40px;border-radius:${RADIUS.sm};background:var(--card);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">📧</div><div><div style="font-size:11px;color:var(--text-2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px;">Email</div><div style="font-size:14px;color:var(--text);">${c.email}</div></div></div>` : ""}
        ${c.phone ? `<div style="display:flex;align-items:center;gap:12px;"><div style="width:40px;height:40px;border-radius:${RADIUS.sm};background:var(--card);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">📞</div><div><div style="font-size:11px;color:var(--text-2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px;">Phone</div><div style="font-size:14px;color:var(--text);">${c.phone}</div></div></div>` : ""}
        ${c.address ? `<div style="display:flex;align-items:center;gap:12px;"><div style="width:40px;height:40px;border-radius:${RADIUS.sm};background:var(--card);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">📍</div><div><div style="font-size:11px;color:var(--text-2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px;">Address</div><div style="font-size:14px;color:var(--text);">${c.address}</div></div></div>` : ""}
      </div>
    </div>

    <form id="krypton-contact" data-submit="${c.submitText || "Send Message"}"
      style="background:var(--card);border:1px solid var(--border);border-radius:${RADIUS.xl};padding:${SPACING.md};display:flex;flex-direction:column;gap:16px;">
      <input type="text" required placeholder="${c.namePlaceholder || "Your name"}"
        style="${INPUT}" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'">
      <input type="email" required placeholder="${c.emailPlaceholder || "your@email.com"}"
        style="${INPUT}" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'">
      <textarea required rows="4" placeholder="${c.messagePlaceholder || "Tell us about your project..."}"
        style="${INPUT}resize:vertical;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'"></textarea>
      <button type="submit"
        style="background:var(--grad);color:#fff;border:none;padding:14px;border-radius:${RADIUS.md};font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:opacity .2s;"
        onmouseenter="this.style.opacity='.85'" onmouseleave="this.style.opacity='1'">
        ${c.submitText || "Send Message"}
      </button>
      <div id="krypton-form-status" style="display:none;padding:10px 14px;border-radius:${RADIUS.sm};background:rgba(76,175,138,0.1);border:1px solid rgba(76,175,138,0.3);color:#4CAF8A;font-size:13px;font-weight:600;">
        ${c.successMessage || "✓ Sent! We'll reply within 24 hours."}
      </div>
    </form>
  </div>
  <style>@media(max-width:768px){.contact-split{grid-template-columns:1fr !important;}}</style>
  ${formScript()}`;

  return wrapSection("contact", inner);
}

export const CONTACT_VARIANTS = {
  "full-form": contactFullForm,
  "split":     contactSplit,
} as const;

export type ContactVariant = keyof typeof CONTACT_VARIANTS;

