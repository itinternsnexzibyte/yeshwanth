import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { resolveMx } from 'node:dns/promises';
import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto';
import { z } from 'zod';
import { ApprovalStatus, AssignmentStatus, EmailStatus, OpportunityStage, PrismaClient, RoleName, VisitStatus } from '@prisma/client';

const db = new PrismaClient();
const app = express();
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
const generatedRoot = path.join(process.cwd(), 'storage');
app.use('/generated', express.static(generatedRoot, { maxAge: '1d', immutable: false }));

const requestBuckets = new Map<string, { count: number; resetAt: number }>();
const rateLimit = (limit: number, windowMs: number) => (req: any, res: any, next: any) => {
  const key = `${req.ip}:${req.path}`; const now = Date.now(); const current = requestBuckets.get(key);
  if (!current || current.resetAt <= now) requestBuckets.set(key, { count: 1, resetAt: now + windowMs });
  else if (++current.count > limit) return res.status(429).json({ code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' });
  next();
};
app.use('/api/auth', rateLimit(30, 15 * 60_000));

const accessSecret = process.env.JWT_ACCESS_SECRET || 'development-access-secret';
const refreshSecret = process.env.JWT_REFRESH_SECRET || 'development-refresh-secret';
const managerRoles = [RoleName.ADMIN, RoleName.SALES_HEAD, RoleName.BD_MANAGER];
const quotationRoles = [...managerRoles, RoleName.TECHNICAL_TEAM];
const quotationStakeholderRoles = [RoleName.ADMIN, RoleName.SALES_HEAD, RoleName.BD_MANAGER, RoleName.TECHNICAL_TEAM];
const sign = (id: string, role: string) => jwt.sign({ sub: id, role }, accessSecret, { expiresIn: '15m' });
const production = process.env.NODE_ENV === 'production';
const accessCookie = { httpOnly: true, secure: production, sameSite: 'strict' as const, maxAge: 15 * 60_000, path: '/' };
const refreshCookie = { httpOnly: true, secure: production, sameSite: 'strict' as const, maxAge: 7 * 864e5, path: '/api/auth' };
const cleanUser = (u: any) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, approvalStatus: u.approvalStatus, isSalesTeam: u.isSalesTeam, emailVerified: u.emailVerified });
const sessionUser = (u: any) => ({ id: 'SELF', name: u.name, role: u.role, phone: u.phone, profilePhotoUrl: u.profilePhotoUrl });
const otpHash = (userId: string, code: string) => createHash('sha256').update(`${userId}:${code}:${accessSecret}`).digest('hex');
const newOtp = () => String(randomInt(100000, 1000000));
const publicTokenHash = (token: string) => createHash('sha256').update(`${token}:${accessSecret}`).digest('hex');
const appUrl = (process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
const mailer = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT || 587) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
}) : null;
const sendCode = async (to: string, code: string, purpose: 'verify' | 'reset') => {
  if (!mailer) throw new Error('Email service is not configured. Add SMTP settings to backend/.env.');
  const isVerify = purpose === 'verify';
  await mailer.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to,
    subject: isVerify ? 'Verify your NexziByte CRM email' : 'Reset your NexziByte CRM password',
    text: `Your NexziByte CRM ${isVerify ? 'email verification' : 'password reset'} code is ${code}. It expires in 10 minutes. Do not share this code.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:16px"><h2 style="color:#14245c">NexziByte Solutions</h2><p>Use this code to ${isVerify ? 'verify your email address' : 'reset your password'}:</p><div style="font-size:32px;font-weight:800;letter-spacing:8px;color:#4338ca;margin:24px 0">${code}</div><p>This code expires in 10 minutes. Do not share it with anyone.</p></div>`
  });
};
const audit = (actorId: string, entity: string, entityId: string, action: string, after?: any) => db.auditLog.create({ data: { actorId, entity, entityId, action, after } });
const activity = (companyId: string, event: string, payload: any, actorId?: string, entity?: string, entityId?: string, client: any = db) => client.activityLog.create({ data: { companyId, event, payload, actorId, entity, entityId } });
const notify = (userId: string, title: string, message: string, type: string, link?: string, client: any = db) => client.notification.create({ data: { userId, title, message, type, link } });
const emailFrom = process.env.EMAIL_FROM || process.env.SMTP_USER || 'NexziByte CRM <no-reply@nexzibyte.local>';
const voiceEmailTemplates = new Set(['MEETING_CONFIRMATION', 'MEETING_REMINDER', 'CLIENT_BOOKING_CONFIRMED']);
const queueEmail = (data: { template: string; to: string; subject: string; body: string; companyId: string; contactId?: string | null; opportunityId?: string | null; visitId?: string | null; sentBy?: string | null; voiceScript?: string | null; attachmentUrl?: string | null }, client: any = db) => client.emailLog.create({ data: { ...data, voiceScript: data.voiceScript ?? (voiceEmailTemplates.has(data.template) ? data.body : null), from: emailFrom, status: EmailStatus.QUEUED, nextAttemptAt: new Date() } });
const emailSignature = process.env.EMAIL_SIGNATURE || 'Regards,\nSales & Business Development Team\nNexziByte Solutions Pvt. Ltd.';
const voiceSecret = process.env.EMAIL_WEBHOOK_SECRET || accessSecret;
const apiUrl = (process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, '');
const brochureDirectory = path.join(generatedRoot, 'brochures');
const collateralDirectory = path.join(generatedRoot, 'collateral');
const brochurePath = process.env.COMPANY_BROCHURE_PATH || path.join(collateralDirectory, 'NexziByte-Sales-Brochure.pdf');
const brochureUrl = process.env.COMPANY_BROCHURE_URL || `${apiUrl}/generated/collateral/NexziByte-Sales-Brochure.pdf`;
const companyProfilePath = process.env.COMPANY_PROFILE_PATH || path.join(collateralDirectory, 'NexziByte-Company-Profile.pdf');
const companyProfileUrl = process.env.COMPANY_PROFILE_URL || `${apiUrl}/generated/collateral/NexziByte-Company-Profile.pdf`;
const visitingCardPath = process.env.COMPANY_VISITING_CARD_PATH || path.join(collateralDirectory, 'Tejaswini-Gangula-Visiting-Card.png');
const visitingCardUrl = process.env.COMPANY_VISITING_CARD_URL || `${apiUrl}/generated/collateral/Tejaswini-Gangula-Visiting-Card.png`;
const ensureDefaultBrochure = async () => {
  if (fs.existsSync(brochurePath)) return;
  await fs.promises.mkdir(path.dirname(brochurePath), { recursive: true });
  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: 'NexziByte Solutions Company Profile', Author: 'NexziByte Solutions Pvt. Ltd.' } });
    const stream = fs.createWriteStream(brochurePath); doc.pipe(stream); stream.on('finish', resolve); stream.on('error', reject);
    const navy = '#24206f', purple = '#4d46c7', muted = '#5f6675', pale = '#f4f4fb';
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(26).text('NEXZIBYTE', 56, 58);
    doc.fillColor(purple).fontSize(16).text('SOLUTIONS PVT. LTD.', 56, 91);
    doc.fillColor(navy).fontSize(23).text('Technology solutions built for\npractical business growth.', 56, 144, { width: 483, lineGap: 4 });
    doc.fillColor(muted).font('Helvetica').fontSize(11).text('NexziByte Solutions helps organizations plan, design and deliver secure digital products, business applications, automation and data-driven workflows.', 56, 222, { width: 483, lineGap: 4 });
    doc.roundedRect(56, 286, 483, 92, 8).fill(pale);
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(12).text('Core capabilities', 74, 305);
    doc.fillColor(muted).font('Helvetica').fontSize(10).text('Web & Mobile Applications   •   CRM & Workflow Automation   •   Cloud & API Integration\nData & Analytics   •   AI-enabled Business Solutions   •   Product Engineering', 74, 329, { width: 445, lineGap: 8 });
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(14).text('How we work', 56, 418);
    doc.fillColor(muted).font('Helvetica').fontSize(10.5).list(['Understand the business requirement and measurable outcome', 'Prepare scope, architecture, timeline and commercial proposal', 'Build in reviewable phases with clear ownership and status visibility', 'Test, deploy and support the delivered solution'], 56, 446, { width: 470, bulletRadius: 2, textIndent: 12, lineGap: 8 });
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(14).text('Contact NexziByte Solutions', 56, 590);
    doc.fillColor(muted).font('Helvetica').fontSize(10.5).text(`Hyderabad, India\nEmail: ${process.env.EMAIL_REPLY_TO || process.env.SMTP_USER || 'contact@nexzibyte.com'}\nThis profile was shared by the NexziByte Sales & Business Development team.`, 56, 618, { width: 483, lineGap: 6 });
    doc.fillColor('#85899a').fontSize(7.5).text('Temporary CRM brochure. Set COMPANY_BROCHURE_PATH to use the approved corporate brochure.', 56, 742, { width: 483, align: 'center' });
    doc.end();
  });
};
const checkEmailDomain = async (email: string) => {
  const domain = email.trim().toLowerCase().split('@')[1];
  if (!domain) return false;
  try { return (await resolveMx(domain)).length > 0; } catch { return false; }
};
const quotationSignaturePath = process.env.QUOTATION_SIGNATURE_PATH || path.join(generatedRoot, 'signatures', 'tejaswini-authorized-signature.png');
const quotationStampPath = process.env.QUOTATION_STAMP_PATH || '';
const quotationSignatoryName = process.env.QUOTATION_SIGNATORY_NAME || 'Tejaswini Gangula';
const quotationSignatoryDesignation = process.env.QUOTATION_SIGNATORY_DESIGNATION || 'Technical Director & Operations';
export const generateQuotationPdf = async (data: { id: string; version: number; company: string; opportunity: string; items: { description: string; quantity: number; unitPrice: number; amount: number }[]; subtotal: number; discountPercent: number; discountAmount: number; taxPercent: number; taxAmount: number; total: number; validUntil?: Date | null; paymentTerms?: string; deliveryTimeline?: string; notes?: string }) => {
  const directory = path.join(generatedRoot, 'quotations');
  await fs.promises.mkdir(directory, { recursive: true });
  const filename = `quotation-${data.id}-v${data.version}.pdf`;
  const outputPath = path.join(directory, filename);
  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `NexziByte Quotation v${data.version}`, Author: 'NexziByte Solutions Pvt. Ltd.' } });
    const stream = fs.createWriteStream(outputPath); doc.pipe(stream); stream.on('finish', resolve); stream.on('error', reject);
    const green = '#6842d8', navy = '#19275b', muted = '#5f6675', pale = '#f4f1ff', line = '#d9dcef';
    const money = (value: number) => `INR ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(22).text('NEXZIBYTE');
    doc.fillColor(green).fontSize(15).text('SOLUTIONS PVT. LTD.');
    doc.fillColor(navy).fontSize(21).text('QUOTATION', 390, 50, { width: 155, align: 'right' });
    doc.fillColor(muted).font('Helvetica').fontSize(9).text(`Version ${data.version}`, 390, 77, { width: 155, align: 'right' });
    doc.moveTo(48, 108).lineTo(547, 108).lineWidth(1.5).strokeColor(green).stroke();
    doc.roundedRect(48, 128, 499, 92, 7).fillAndStroke(pale, line);
    doc.fillColor(muted).font('Helvetica-Bold').fontSize(8).text('PREPARED FOR', 63, 145).text('QUOTATION DETAILS', 325, 145);
    doc.fillColor(navy).fontSize(11).text(data.company, 63, 165, { width: 220 });
    doc.fillColor(muted).font('Helvetica').fontSize(9).text(data.opportunity, 63, 183, { width: 220 });
    const issued = new Date().toLocaleDateString('en-IN');
    doc.fillColor(navy).text(`Issued: ${issued}`, 325, 165).text(`Valid until: ${data.validUntil ? data.validUntil.toLocaleDateString('en-IN') : 'As discussed'}`, 325, 182).text(`Quotation ID: ${data.id.slice(0, 8).toUpperCase()}`, 325, 199);
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(18).text(data.opportunity, 48, 258, { width: 499, align: 'center' });
    doc.fillColor(muted).font('Helvetica').fontSize(9.5).text('COMMERCIAL QUOTATION', 48, 291, { width: 499, align: 'center', characterSpacing: 1.2 });
    doc.addPage();
    let y = 54;
    const section = (title: string, body: string) => {
      if (y > 650) { doc.addPage(); y = 54; }
      doc.fillColor(navy).font('Helvetica-Bold').fontSize(12).text(title, 48, y, { width: 499 }); y += 19;
      doc.fillColor(muted).font('Helvetica').fontSize(9).text(body, 48, y, { width: 499, lineGap: 3 });
      y = doc.y + 17;
    };
    section('1. Executive Summary', `NexziByte Solutions proposes to design and deliver ${data.opportunity} for ${data.company}. The engagement will convert the agreed business requirement into a secure, scalable and maintainable digital solution. ${data.notes || ''}`.trim());
    section('2. Business Understanding', `The proposed solution is based on the requirements discussed with ${data.company}. Final workflows, user roles, integrations and acceptance criteria will be confirmed during requirement sign-off before development begins.`);
    section('3. Proposed Solution - Scope', `The current quotation covers the following deliverables:\n${data.items.map((item, index) => `${index + 1}. ${item.description}`).join('\n')}`);
    section('4. Delivery Approach', 'Discovery and requirement confirmation; solution architecture and UI/UX; iterative development; integration and quality assurance; user acceptance testing; deployment and handover. Activities may run in parallel according to the approved delivery plan.');
    section('5. Technical Architecture', 'The final architecture will be selected according to the approved scope. It may include responsive web or mobile applications, secure backend APIs, relational database storage, role-based access control, audit logging, file storage, notifications and approved third-party integrations.');
    doc.addPage(); y = 54;
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(12).text('Project scope and pricing', 48, y); y += 24;
    doc.rect(48, y, 499, 28).fill(navy);
    doc.fillColor('#ffffff').fontSize(8).text('DESCRIPTION', 58, y + 10).text('QTY', 355, y + 10, { width: 36, align: 'right' }).text('UNIT PRICE', 399, y + 10, { width: 65, align: 'right' }).text('AMOUNT', 472, y + 10, { width: 65, align: 'right' }); y += 28;
    doc.font('Helvetica').fontSize(8.5);
    for (const item of data.items) {
      const height = Math.max(36, doc.heightOfString(item.description, { width: 275 }) + 16);
      if (y + height > 690) { doc.addPage(); y = 55; }
      doc.rect(48, y, 499, height).fillAndStroke(data.items.indexOf(item) % 2 ? pale : '#ffffff', line);
      doc.fillColor(navy).text(item.description, 58, y + 9, { width: 275 }).text(String(item.quantity), 355, y + 9, { width: 36, align: 'right' }).text(money(item.unitPrice), 399, y + 9, { width: 65, align: 'right' }).text(money(item.amount), 472, y + 9, { width: 65, align: 'right' }); y += height;
    }
    y += 12;
    const totals = [['Subtotal', data.subtotal], [`Discount (${data.discountPercent}%)`, -data.discountAmount], [`GST (${data.taxPercent}%)`, data.taxAmount], ['GRAND TOTAL', data.total]] as const;
    totals.forEach(([label, value], index) => { const final = index === totals.length - 1; if (final) doc.rect(330, y - 4, 217, 25).fill(pale); doc.fillColor(final ? navy : muted).font(final ? 'Helvetica-Bold' : 'Helvetica').fontSize(final ? 10.5 : 9).text(label, 340, y + 3, { width: 100 }).text(money(value), 443, y + 3, { width: 94, align: 'right' }); y += final ? 32 : 23; });
    y += 5; doc.fillColor(navy).font('Helvetica-Bold').fontSize(11).text('Commercial terms', 48, y); y += 18;
    doc.fillColor(muted).font('Helvetica').fontSize(8.7).text(`Payment terms: ${data.paymentTerms || 'As mutually agreed'}`, 48, y, { width: 499 }); y += 17;
    doc.text(`Delivery timeline: ${data.deliveryTimeline || 'To be confirmed after approval'}`, 48, y, { width: 499 }); y += 17;
    if (data.notes) { doc.text(`Additional notes: ${data.notes}`, 48, y, { width: 499 }); y += doc.heightOfString(data.notes, { width: 499 }) + 12; }
    doc.roundedRect(48, y + 4, 499, 53, 6).fillAndStroke('#fff8e6', '#e6c968');
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(8).text('CLIENT ACTION', 61, y + 18);
    doc.fillColor(muted).font('Helvetica').fontSize(8.5).text('Use the secure link in the quotation email to approve, request negotiation, or decline. A specific reason is required for MAYBE and NO.', 145, y + 15, { width: 385 });
    y += 76;
    doc.addPage(); y = 52;
    section('6. Third-Party and Infrastructure Costs', 'Cloud hosting, databases, storage, mapping APIs, SMS/WhatsApp services, email services, domain, SSL, app-store fees, external integrations, hardware and other paid provider services are excluded unless explicitly included as a quotation item.');
    section('7. Timeline and Payment Terms', `Estimated delivery timeline: ${data.deliveryTimeline || 'To be confirmed after requirement sign-off'}.\nPayment terms: ${data.paymentTerms || 'As mutually agreed'}.`);
    section('8. Assumptions and Change Requests', 'The client will provide timely approvals, business rules, content, credentials and feedback. Any feature, integration, workflow or deliverable outside the approved scope will be handled as a change request and may affect cost and timeline.');
    section('9. Warranty and Support', 'A post-launch bug-fix warranty applies to the approved delivered functionality. New features, enhancements and third-party changes are not warranty items. Ongoing support or AMC can be proposed separately.');
    section('10. Acceptance of Quotation', `By signing below, ${data.company} confirms that it has reviewed and accepted the scope, commercial value, timeline, payment terms, assumptions and exclusions stated in this quotation.`);
    if (y > 300) { doc.addPage(); y = 52; }
    const clientY = y, boxH = 176;
    doc.rect(48, clientY, 499, boxH).strokeColor(line).stroke();
    doc.rect(48, clientY, 499, 27).fill(navy);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5).text('CLIENT ACCEPTANCE', 59, clientY + 10, { characterSpacing: 1.4 });
    doc.fillColor(muted).font('Helvetica').fontSize(8.5)
      .text('Name: ________________________________________________', 60, clientY + 43)
      .text('Designation: ___________________________________________', 60, clientY + 70)
      .text(`Company: ${data.company}`, 60, clientY + 97)
      .text('Signature: _____________________________________________', 60, clientY + 124)
      .text('Date: _________________________________________________', 60, clientY + 151);
    const companyY = clientY + boxH + 26;
    doc.rect(48, companyY, 499, 170).strokeColor(line).stroke();
    doc.rect(48, companyY, 499, 27).fill(navy);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5).text('FOR NEXZIBYTE SOLUTIONS PVT. LTD.', 59, companyY + 10, { characterSpacing: 1.25 });
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(8.5).text(`Authorized Representative - Name: ${quotationSignatoryName}`, 60, companyY + 43);
    doc.fillColor(muted).font('Helvetica').fontSize(8.5).text(`Designation: ${quotationSignatoryDesignation}`, 60, companyY + 69);
    doc.text('Signature:', 60, companyY + 101);
    if (quotationSignaturePath && fs.existsSync(quotationSignaturePath)) doc.image(quotationSignaturePath, 126, companyY + 83, { fit: [112, 53] });
    else doc.fillColor(muted).font('Helvetica-Oblique').fontSize(8).text('____________________________', 126, companyY + 101);
    if (quotationStampPath && fs.existsSync(quotationStampPath)) doc.image(quotationStampPath, 260, companyY + 79, { fit: [72, 58] });
    doc.fillColor(muted).font('Helvetica').fontSize(8.5).text(`Date: ${issued}`, 60, companyY + 143);
    doc.font('Helvetica-Oblique').fontSize(7.5).text('Signature above constitutes acceptance of this Commercial Quotation and approval to proceed with the agreed project scope, subject to the terms stated herein.', 48, companyY + 184, { width: 499 });
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(8).text('NexziByte Solutions Pvt. Ltd. | Hyderabad, India', 48, 760, { width: 499, align: 'center' });
    doc.end();
  });
  return { outputPath, documentUrl: `${apiUrl}/generated/quotations/${filename}` };
};
const createVoiceUrl = (text: string) => {
  const payload = Buffer.from(JSON.stringify({ text: text.slice(0, 1200), exp: Date.now() + 30 * 864e5 })).toString('base64url');
  const signature = createHmac('sha256', voiceSecret).update(payload).digest('base64url');
  return `${apiUrl}/api/public/voice-reminder?t=${encodeURIComponent(payload)}&s=${encodeURIComponent(signature)}`;
};
const safeEmailHtml = (text: string) => text.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!)).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="display:inline-block;margin:10px 0;padding:11px 17px;border-radius:9px;background:#312e81;color:#fff;text-decoration:none;font-weight:700">Open secure link</a>');
const renderEmail = (text: string, voiceUrl?: string) => `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;padding:28px;color:#172033"><h2 style="color:#312e81">NexziByte Solutions</h2><p style="white-space:pre-line;line-height:1.65">${safeEmailHtml(text)}</p>${voiceUrl ? `<div style="margin:24px 0;padding:18px;border:1px solid #dddaf6;border-radius:14px;background:#f7f6ff"><div style="font-size:13px;font-weight:700;color:#312e81;margin-bottom:11px">Voice reminder available</div><a href="${voiceUrl}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#312e81;color:#fff;text-decoration:none;font-size:14px;font-weight:700">▶ Play voice reminder</a><div style="font-size:11px;color:#6a756e;margin-top:10px">For security, this link expires after 30 days.</div></div>` : ''}<div style="border-top:1px solid #e5e7eb;margin-top:28px;padding-top:18px;white-space:pre-line;color:#536075;font-size:13px">${emailSignature.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!))}</div><p style="font-size:12px;color:#7b8494">Reply directly to this email to contact our team.</p></div>`;

app.get('/api/public/voice-reminder', rateLimit(60, 15 * 60_000), (req, res) => {
  try {
    const token = String(req.query.t || ''), signature = String(req.query.s || '');
    const expected = createHmac('sha256', voiceSecret).update(token).digest('base64url');
    if (!token || !signature || signature.length !== expected.length || !Buffer.from(signature).equals(Buffer.from(expected))) return res.status(401).send('Invalid voice reminder link');
    const payload = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    if (!payload.text || Number(payload.exp) < Date.now()) return res.status(410).send('This voice reminder link has expired');
    const safeText = String(payload.text).replace(/[<>&'"`]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&#39;', '"': '&quot;', '`': '&#96;' }[c]!));
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'none'; connect-src 'none'");
    res.type('html').send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>NexziByte Voice Reminder</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#eef4f0;font-family:Arial,sans-serif;color:#17221b}.card{width:min(560px,calc(100% - 36px));box-sizing:border-box;padding:34px;border:1px solid #d8e4dc;border-radius:22px;background:#fff;box-shadow:0 24px 70px rgba(26,58,40,.12)}small{font-weight:800;letter-spacing:.12em;color:#347258}h1{font-size:28px;margin:10px 0}p{line-height:1.65;color:#5e6962;white-space:pre-line}button{width:100%;border:0;border-radius:12px;padding:15px;background:#174d38;color:#fff;font-size:15px;font-weight:800;cursor:pointer}button:hover{background:#103d2c}.status{text-align:center;margin-top:14px;font-size:12px;color:#6d776f}</style></head><body><main class="card"><small>NEXZIBYTE SOLUTIONS</small><h1>Meeting voice reminder</h1><p id="message">${safeText}</p><button id="play">▶ Play voice reminder</button><div class="status" id="status">Sound starts only after you press Play.</div></main><script>const button=document.getElementById('play'),status=document.getElementById('status'),text=document.getElementById('message').innerText;button.onclick=()=>{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='en-IN';u.rate=.92;u.onstart=()=>{status.textContent='Playing reminder…';button.textContent='■ Stop voice reminder'};u.onend=()=>{status.textContent='Voice reminder completed.';button.textContent='▶ Play again'};u.onerror=()=>{status.textContent='Voice playback is not supported in this browser.'};speechSynthesis.speak(u)};</script></body></html>`);
  } catch { res.status(400).send('Invalid voice reminder link'); }
});
let processingEmailQueue = false;
const flagVisitEmailProblem = async (row: any, reason: string) => {
  if (!row.visitId || !row.sentBy) return;
  const visit = await db.visit.findUnique({ where: { id: row.visitId }, include: { company: true, user: { select: { id: true, name: true, email: true } } } });
  if (!visit || visit.emailCorrectionRequired) return;
  await db.visit.update({ where: { id: visit.id }, data: { emailCorrectionRequired: true, emailCorrectionReason: reason.slice(0, 500), emailCorrectionNotifiedAt: new Date() } });
  await notify(visit.userId, 'Correct client email now', `${visit.company.name}: the email ${row.to} could not be delivered. Re-enter the correct company/contact email while the visit details are fresh.`, 'CLIENT_EMAIL_CORRECTION', '/visits');
  if (visit.user.email) await queueEmail({ template: 'CLIENT_EMAIL_CORRECTION', to: visit.user.email, subject: `Correct client email: ${visit.company.name}`, body: `Hello ${visit.user.name},\n\nThe client email entered for ${visit.company.name} could not be delivered.\nEntered email: ${row.to}\nDelivery error: ${reason}\n\nOpen Visits in the NexziByte CRM and use Correct email to update the address. The brochure and visit email will be re-sent automatically.`, companyId: visit.companyId, visitId: visit.id, sentBy: visit.userId });
  await activity(visit.companyId, 'CLIENT_EMAIL_CORRECTION_REQUIRED', { visitId: visit.id, email: row.to, reason }, visit.userId, 'Visit', visit.id);
};
const processEmailQueue = async () => {
  if (processingEmailQueue || !mailer) return; processingEmailQueue = true;
  try {
    const rows = await db.emailLog.findMany({ where: { status: { in: [EmailStatus.QUEUED, EmailStatus.FAILED] }, attempts: { lt: 3 }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }] }, take: 25, orderBy: { createdAt: 'asc' } });
    for (const row of rows) try {
      const voiceUrl = row.voiceScript ? createVoiceUrl(row.voiceScript) : undefined;
      const isBrochure = row.template === 'COMPANY_BROCHURE';
      const collateralAttachments = isBrochure ? [
        fs.existsSync(brochurePath) ? { filename: 'NexziByte-Sales-Brochure.pdf', path: brochurePath } : null,
        fs.existsSync(companyProfilePath) ? { filename: 'NexziByte-Company-Profile.pdf', path: companyProfilePath } : null,
        fs.existsSync(visitingCardPath) ? { filename: 'Tejaswini-Gangula-Visiting-Card.png', path: visitingCardPath } : null
      ].filter(Boolean) as { filename: string; path: string }[] : undefined;
      const sent = await mailer.sendMail({ from: row.from, to: row.to, cc: process.env.EMAIL_CC || undefined, replyTo: process.env.EMAIL_REPLY_TO || process.env.SMTP_USER, subject: row.subject, text: `${row.body}${voiceUrl ? `\n\nPlay voice reminder: ${voiceUrl}` : ''}\n\n${emailSignature}`, html: renderEmail(row.body, voiceUrl), attachments: isBrochure ? collateralAttachments : row.attachmentUrl ? [{ filename: 'NexziByte-Quotation.pdf', path: row.attachmentUrl }] : undefined });
      await db.emailLog.update({ where: { id: row.id }, data: { status: EmailStatus.SENT, sentAt: new Date(), attempts: { increment: 1 }, providerMessageId: sent.messageId, lastError: null } });
      await activity(row.companyId, 'EMAIL_SENT', { emailId: row.id, template: row.template, to: row.to }, row.sentBy || undefined, 'EmailLog', row.id);
    } catch (error: any) {
      const attempts = row.attempts + 1;
      await db.emailLog.update({ where: { id: row.id }, data: { status: EmailStatus.FAILED, attempts, lastError: String(error.message || error).slice(0, 500), nextAttemptAt: attempts < 3 ? new Date(Date.now() + attempts * 15 * 60_000) : null } });
      if (row.visitId) await flagVisitEmailProblem(row, String(error.message || error));
    }
  } finally { processingEmailQueue = false; }
};
const xmlEscape = (value: string) => value.replace(/[<>&'\"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!));
let processingAiCalls = false;
const processAiCallQueue = async () => {
  if (processingAiCalls || process.env.AI_CALLS_ENABLED !== 'true') return;
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) return;
  processingAiCalls = true;
  try {
    const rows = await db.aiCallLog.findMany({ where: { status: 'QUEUED', scheduledFor: { lte: new Date() }, attempts: { lt: 3 } }, take: 10, orderBy: { scheduledFor: 'asc' } });
    for (const row of rows) try {
      const voiceUrl = process.env.VOICE_SERVICE_PUBLIC_URL;
      const voiceToken = process.env.VOICE_SERVICE_TOKEN;
      const statusCallback = process.env.PUBLIC_API_URL ? `${process.env.PUBLIC_API_URL.replace(/\/$/, '')}/api/webhooks/ai-calls` : undefined;
      const body = voiceUrl && voiceToken
        ? new URLSearchParams({ To: row.toPhone, From: from, Url: `${voiceUrl.replace(/\/$/, '')}/twiml?token=${encodeURIComponent(voiceToken)}&text=${encodeURIComponent(row.script)}`, ...(statusCallback ? { StatusCallback: statusCallback, StatusCallbackEvent: 'initiated ringing answered completed' } : {}) })
        : new URLSearchParams({ To: row.toPhone, From: from, Twiml: `<Response><Say voice="alice" language="en-IN">${xmlEscape(row.script)}</Say></Response>`, ...(statusCallback ? { StatusCallback: statusCallback, StatusCallbackEvent: 'initiated ringing answered completed' } : {}) });
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body });
      const result: any = await response.json();
      if (!response.ok) throw new Error(result.message || 'Telephony provider rejected the call');
      await db.aiCallLog.update({ where: { id: row.id }, data: { status: 'INITIATED', providerCallId: result.sid, initiatedAt: new Date(), attempts: { increment: 1 }, lastError: null } });
      await activity(row.companyId, 'AI_REMINDER_CALL_INITIATED', { callId: row.id, followUpId: row.followUpId, providerCallId: result.sid }, undefined, 'AiCallLog', row.id);
    } catch (error: any) {
      await db.aiCallLog.update({ where: { id: row.id }, data: { status: 'FAILED', attempts: { increment: 1 }, lastError: String(error.message || error).slice(0, 500) } });
    }
  } finally { processingAiCalls = false; }
};
const auth = async (req: any, res: any, next: any) => {
  try {
    const tokenValue = req.cookies?.nexzi_access;
    if (!tokenValue) return res.status(401).json({ message: 'Login required' });
    const token: any = jwt.verify(tokenValue, accessSecret);
    const user = await db.user.findUnique({ where: { id: token.sub } });
    if (!user?.isActive || user.approvalStatus !== ApprovalStatus.APPROVED) return res.status(401).json({ message: 'Your account is not active' });
    req.user = user; next();
  } catch { res.status(401).json({ message: 'Invalid or expired session' }); }
};
const allow = (...roles: RoleName[]) => (req: any, res: any, next: any) => roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'You do not have permission for this action' });

app.get('/health', (_req, res) => res.json({ ok: true }));
app.post('/api/auth/register', async (req, res) => {
  const p = z.object({ name: z.string().min(2), email: z.string().email(), phone: z.string().min(8).optional(), password: z.string().min(8), requestedRole: z.enum(['ADMIN', 'BD_MANAGER', 'SALES_BD_EXECUTIVE', 'TECHNICAL_TEAM', 'MANAGEMENT_VIEWER']) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Enter valid registration details', details: p.error.flatten() });
  const email = p.data.email.toLowerCase();
  if (await db.user.findUnique({ where: { email } })) return res.status(409).json({ message: 'This email is already registered' });
  const user = await db.user.create({ data: { name: p.data.name, email, phone: p.data.phone, passwordHash: await bcrypt.hash(p.data.password, 12), role: p.data.requestedRole, requestedRole: p.data.requestedRole, emailVerified: false } });
  const code = newOtp();
  await db.emailVerificationCode.create({ data: { userId: user.id, codeHash: otpHash(user.id, code), expiresAt: new Date(Date.now() + 10 * 60_000) } });
  try { await sendCode(email, code, 'verify'); }
  catch (error: any) { await db.user.delete({ where: { id: user.id } }); return res.status(503).json({ message: error.message }); }
  res.status(201).json({ message: 'A 6-digit verification code was sent to your email.', email: user.email, requiresVerification: true });
});
app.post('/api/auth/verify-email', async (req, res) => {
  const p = z.object({ email: z.string().email(), code: z.string().regex(/^\d{6}$/) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Enter the valid 6-digit verification code' });
  const user = await db.user.findUnique({ where: { email: p.data.email.toLowerCase() } });
  if (!user) return res.status(400).json({ message: 'Verification request is invalid' });
  if (user.emailVerified) return res.json({ message: 'Email is already verified. Wait for administrator approval.' });
  const token = await db.emailVerificationCode.findFirst({ where: { userId: user.id, usedAt: null }, orderBy: { createdAt: 'desc' } });
  if (!token || token.expiresAt < new Date() || token.attempts >= 5) return res.status(400).json({ message: 'Code expired. Request a new verification code.' });
  if (token.codeHash !== otpHash(user.id, p.data.code)) { await db.emailVerificationCode.update({ where: { id: token.id }, data: { attempts: { increment: 1 } } }); return res.status(400).json({ message: 'Verification code is incorrect' }); }
  await db.$transaction([db.emailVerificationCode.update({ where: { id: token.id }, data: { usedAt: new Date() } }), db.user.update({ where: { id: user.id }, data: { emailVerified: true, emailVerifiedAt: new Date() } })]);
  const registrationStatusToken = jwt.sign({ sub: user.id, purpose: 'registration-status' }, accessSecret, { expiresIn: '24h' });
  res.json({ message: 'Email verified successfully. Your registration is now waiting for administrator approval.', registrationStatusToken });
});
app.post('/api/auth/registration-status', async (req, res) => {
  const p = z.object({ token: z.string().min(20) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Registration status token is required' });
  try {
    const payload: any = jwt.verify(p.data.token, accessSecret);
    if (payload.purpose !== 'registration-status') throw new Error('Invalid token purpose');
    const user = await db.user.findUnique({ where: { id: payload.sub }, select: { emailVerified: true, approvalStatus: true, rejectionReason: true } });
    if (!user) return res.status(404).json({ message: 'Registration was not found' });
    res.json(user);
  } catch {
    res.status(401).json({ message: 'Registration status link expired. Please try signing in.' });
  }
});
app.post('/api/auth/resend-verification', async (req, res) => {
  const p = z.object({ email: z.string().email() }).safeParse(req.body); if (!p.success) return res.status(400).json({ message: 'Enter a valid email address' });
  const user = await db.user.findUnique({ where: { email: p.data.email.toLowerCase() } });
  if (!user || user.emailVerified) return res.json({ message: 'If verification is required, a code has been sent.' });
  const latest = await db.emailVerificationCode.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
  if (latest && Date.now() - latest.createdAt.getTime() < 60_000) return res.status(429).json({ message: 'Please wait one minute before requesting another code' });
  const code = newOtp(); await db.emailVerificationCode.create({ data: { userId: user.id, codeHash: otpHash(user.id, code), expiresAt: new Date(Date.now() + 10 * 60_000) } }); await sendCode(user.email, code, 'verify');
  res.json({ message: 'A new verification code was sent.' });
});
app.post('/api/auth/forgot-password', async (req, res) => {
  const p = z.object({ email: z.string().email() }).safeParse(req.body); if (!p.success) return res.status(400).json({ message: 'Enter a valid email address' });
  const user = await db.user.findUnique({ where: { email: p.data.email.toLowerCase() } });
  if (user) { const latest = await db.passwordResetCode.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }); if (!latest || Date.now() - latest.createdAt.getTime() >= 60_000) { const code = newOtp(); await db.passwordResetCode.create({ data: { userId: user.id, codeHash: otpHash(user.id, code), expiresAt: new Date(Date.now() + 10 * 60_000) } }); await sendCode(user.email, code, 'reset'); } }
  res.json({ message: 'If this email is registered, a 6-digit reset code has been sent.' });
});
app.post('/api/auth/reset-password', async (req, res) => {
  const p = z.object({ email: z.string().email(), code: z.string().regex(/^\d{6}$/), password: z.string().min(8) }).safeParse(req.body); if (!p.success) return res.status(400).json({ message: 'Enter the email, 6-digit code and a password of at least 8 characters' });
  const user = await db.user.findUnique({ where: { email: p.data.email.toLowerCase() } }); if (!user) return res.status(400).json({ message: 'Reset request is invalid or expired' });
  const token = await db.passwordResetCode.findFirst({ where: { userId: user.id, usedAt: null }, orderBy: { createdAt: 'desc' } });
  if (!token || token.expiresAt < new Date() || token.attempts >= 5) return res.status(400).json({ message: 'Reset code is invalid or expired' });
  if (token.codeHash !== otpHash(user.id, p.data.code)) { await db.passwordResetCode.update({ where: { id: token.id }, data: { attempts: { increment: 1 } } }); return res.status(400).json({ message: 'Reset code is incorrect' }); }
  await db.$transaction([db.passwordResetCode.update({ where: { id: token.id }, data: { usedAt: new Date() } }), db.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }), db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(p.data.password, 12) } })]);
  res.json({ message: 'Password changed successfully. You can now sign in.' });
});
app.post('/api/auth/login', async (req, res) => {
  const p = z.object({ email: z.string().email(), password: z.string().min(6) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Enter a valid email and password' });
  const user = await db.user.findUnique({ where: { email: p.data.email.toLowerCase() } });
  if (!user || !await bcrypt.compare(p.data.password, user.passwordHash)) return res.status(401).json({ message: 'Email or password is incorrect' });
  if (!user.emailVerified) return res.status(403).json({ message: 'Verify your email before signing in' });
  if (user.approvalStatus === 'PENDING') return res.status(403).json({ message: 'Your registration is waiting for administrator approval' });
  if (user.approvalStatus === 'REJECTED') return res.status(403).json({ message: `Registration rejected${user.rejectionReason ? `: ${user.rejectionReason}` : ''}` });
  if (!user.isActive) return res.status(403).json({ message: 'Your account has been disabled' });
  const accessToken = sign(user.id, user.role);
  const refreshToken = jwt.sign({ sub: user.id }, refreshSecret, { expiresIn: '7d' });
  await db.refreshToken.create({ data: { tokenHash: await bcrypt.hash(refreshToken, 8), userId: user.id, expiresAt: new Date(Date.now() + 7 * 864e5) } });
  res.cookie('nexzi_access', accessToken, accessCookie);
  res.cookie('nexzi_refresh', refreshToken, refreshCookie);
  res.json({ user: sessionUser(user) });
});
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const value = req.cookies?.nexzi_refresh;
    if (!value) return res.status(401).json({ message: 'Session expired' });
    const payload: any = jwt.verify(value, refreshSecret);
    const user = await db.user.findUnique({ where: { id: payload.sub } });
    if (!user?.isActive || user.approvalStatus !== ApprovalStatus.APPROVED) return res.status(401).json({ message: 'Session expired' });
    const records = await db.refreshToken.findMany({ where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } } });
    const valid = (await Promise.all(records.map(record => bcrypt.compare(value, record.tokenHash)))).some(Boolean);
    if (!valid) return res.status(401).json({ message: 'Session expired' });
    res.cookie('nexzi_access', sign(user.id, user.role), accessCookie);
    res.json({ user: sessionUser(user) });
  } catch { res.status(401).json({ message: 'Session expired' }); }
});
app.post('/api/auth/logout', async (req, res) => {
  const value = req.cookies?.nexzi_refresh;
  if (value) {
    try {
      const payload: any = jwt.verify(value, refreshSecret);
      const records = await db.refreshToken.findMany({ where: { userId: payload.sub, revokedAt: null } });
      for (const record of records) if (await bcrypt.compare(value, record.tokenHash)) await db.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
    } catch { /* Expired or invalid cookies are cleared below. */ }
  }
  res.clearCookie('nexzi_access', { ...accessCookie, maxAge: undefined });
  res.clearCookie('nexzi_refresh', { ...refreshCookie, maxAge: undefined });
  res.status(204).end();
});
app.get('/api/me', auth, (req: any, res) => res.json({ user: sessionUser(req.user) }));
app.patch('/api/me/profile', auth, async (req: any, res) => {
  const p = z.object({ name: z.string().trim().min(2).max(80), phone: z.string().trim().min(8).max(20).optional().or(z.literal('')), profilePhotoUrl: z.string().startsWith('data:image/').max(3_000_000).nullable() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Enter valid profile details and use an image under 2MB' });
  const before = sessionUser(req.user);
  const user = await db.user.update({ where: { id: req.user.id }, data: { name: p.data.name, phone: p.data.phone || null, profilePhotoUrl: p.data.profilePhotoUrl } });
  await db.auditLog.create({ data: { actorId: req.user.id, entity: 'UserProfile', entityId: req.user.id, action: 'PROFILE_UPDATED', before, after: sessionUser(user) } });
  res.json({ user: sessionUser(user), message: 'Profile updated successfully' });
});
app.patch('/api/me/password', auth, async (req: any, res) => {
  const p = z.object({ currentPassword: z.string().min(8), newPassword: z.string().min(8).max(128) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Enter your current password and a new password of at least 8 characters' });
  if (!await bcrypt.compare(p.data.currentPassword, req.user.passwordHash)) return res.status(401).json({ message: 'Current password is incorrect' });
  if (await bcrypt.compare(p.data.newPassword, req.user.passwordHash)) return res.status(422).json({ message: 'New password must be different from the current password' });
  await db.$transaction([db.user.update({ where: { id: req.user.id }, data: { passwordHash: await bcrypt.hash(p.data.newPassword, 12) } }), db.refreshToken.updateMany({ where: { userId: req.user.id, revokedAt: null }, data: { revokedAt: new Date() } }), db.auditLog.create({ data: { actorId: req.user.id, entity: 'User', entityId: req.user.id, action: 'PASSWORD_CHANGED', after: { changedAt: new Date().toISOString() } } })]);
  res.clearCookie('nexzi_access', { ...accessCookie, maxAge: undefined });
  res.clearCookie('nexzi_refresh', { ...refreshCookie, maxAge: undefined });
  res.json({ message: 'Password changed successfully. Please sign in again.' });
});

app.get('/api/admin/users', auth, allow(RoleName.ADMIN), async (_req, res) => res.json(await db.user.findMany({ select: { id: true, name: true, email: true, phone: true, role: true, requestedRole: true, approvalStatus: true, emailVerified: true, isActive: true, isSalesTeam: true, managerId: true, createdAt: true }, orderBy: { createdAt: 'desc' } })));
app.patch('/api/admin/users/:id/approval', auth, allow(RoleName.ADMIN), async (req: any, res) => {
  const p = z.object({ approvalStatus: z.enum(['APPROVED', 'REJECTED']), role: z.nativeEnum(RoleName), isSalesTeam: z.boolean(), managerId: z.string().nullable().optional(), rejectionReason: z.string().optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Invalid approval details' });
  const current = await db.user.findUnique({ where: { id: req.params.id } });
  if (!current) return res.status(404).json({ message: 'User not found' });
  if (p.data.approvalStatus === 'APPROVED' && !current.emailVerified) return res.status(422).json({ message: 'The user must verify their email before approval' });
  const user = await db.user.update({ where: { id: req.params.id }, data: { ...p.data, managerId: p.data.managerId || null, approvedById: req.user.id, approvedAt: p.data.approvalStatus === 'APPROVED' ? new Date() : null, isActive: p.data.approvalStatus === 'APPROVED' } });
  await audit(req.user.id, 'User', user.id, `REGISTRATION_${p.data.approvalStatus}`, cleanUser(user)); res.json(user);
});
app.patch('/api/admin/users/:id', auth, allow(RoleName.ADMIN), async (req: any, res) => {
  const p = z.object({ name: z.string().min(2).optional(), role: z.nativeEnum(RoleName).optional(), isActive: z.boolean().optional(), isSalesTeam: z.boolean().optional(), managerId: z.string().nullable().optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Invalid user update' });
  const user = await db.user.update({ where: { id: req.params.id }, data: p.data }); await audit(req.user.id, 'User', user.id, 'USER_UPDATED', cleanUser(user)); res.json(user);
});

const normalizePhone = (value?: string | null) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;
  return digits.length > 10 ? digits.slice(-10) : digits;
};
const findDuplicateCompanyPhone = async (phoneNormalized: string, excludeId?: string) => {
  const direct = await db.company.findFirst({ where: { archivedAt: null, phoneNormalized, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true, name: true } });
  if (direct) return direct;
  const legacyRows = await db.company.findMany({ where: { archivedAt: null, phone: { not: null }, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true, name: true, phone: true }, take: 2000 });
  return legacyRows.find(company => normalizePhone(company.phone) === phoneNormalized) || null;
};
const companySchema = z.object({ name: z.string().min(2), city: z.string().min(2), phone: z.string().optional().refine(value => !value || normalizePhone(value)!.length >= 8, 'Enter a valid phone number'), email: z.string().email().optional().or(z.literal('')), website: z.string().optional(), industryId: z.string().optional(), addressLine: z.string().optional(), state: z.string().optional(), pincode: z.string().optional() });
app.get('/api/companies', auth, async (req: any, res) => {
  const q = String(req.query.q || '');
  const assigned = req.user.role === RoleName.SALES_BD_EXECUTIVE ? { assignments: { some: { assignedToId: req.user.id, status: { not: AssignmentStatus.CANCELLED } } } } : {};
  res.json(await db.company.findMany({ where: { archivedAt: null, ...assigned, ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}) }, include: { industry: true, contacts: true, assignments: { where: { assignedToId: req.user.id } }, _count: { select: { visits: true, requirements: true, opportunities: true } } }, orderBy: { updatedAt: 'desc' }, take: 100 }));
});
app.post('/api/companies', auth, allow(RoleName.ADMIN, RoleName.SALES_HEAD, RoleName.BD_MANAGER), async (req: any, res) => {
  const p = companySchema.safeParse(req.body); if (!p.success) return res.status(400).json({ message: 'Enter valid company details' });
  const { addressLine, state, pincode, email, ...data } = p.data;
  const phoneNormalized = normalizePhone(data.phone);
  if (phoneNormalized) {
    const duplicate = await findDuplicateCompanyPhone(phoneNormalized);
    if (duplicate) {
      await db.companyDuplicateAttempt.create({ data: { attemptedName: data.name, attemptedPhone: data.phone || '', normalizedPhone: phoneNormalized, matchedCompanyId: duplicate.id, matchedCompanyName: duplicate.name, createdById: req.user.id, createdByName: req.user.name } });
      await audit(req.user.id, 'Company', duplicate.id, 'DUPLICATE_PHONE_BLOCKED', { attemptedName: data.name, normalizedPhone: phoneNormalized });
      return res.status(409).json({ code: 'DUPLICATE_PHONE', message: `This mobile number already belongs to ${duplicate.name}. The duplicate attempt was blocked and added to Spam & Duplicates.` });
    }
  }
  if (await db.company.findFirst({ where: { name: { equals: data.name, mode: 'insensitive' }, city: data.city } })) return res.status(409).json({ message: 'A company with this name and city already exists' });
  const company = await db.company.create({ data: { ...data, phoneNormalized, email: email || null, addresses: addressLine ? { create: { addressLine, city: data.city, state, pincode } } : undefined } });
  await audit(req.user.id, 'Company', company.id, 'COMPANY_CREATED', company); res.status(201).json(company);
});
app.patch('/api/companies/:id', auth, async (req: any, res) => {
  if (req.user.role === RoleName.MANAGEMENT_VIEWER) return res.status(403).json({ message: 'Management Viewer has read-only access' });
  if (req.user.role === RoleName.SALES_BD_EXECUTIVE && !await db.workAssignment.findFirst({ where: { companyId: req.params.id, assignedToId: req.user.id, status: { not: AssignmentStatus.CANCELLED } } })) return res.status(403).json({ message: 'You can edit only companies assigned to you' });
  const p = companySchema.partial().safeParse(req.body); if (!p.success) return res.status(400).json({ message: 'Invalid company update' });
  const { addressLine, state, pincode, email, ...data } = p.data;
  const phoneNormalized = data.phone === undefined ? undefined : normalizePhone(data.phone);
  if (phoneNormalized) {
    const duplicate = await findDuplicateCompanyPhone(phoneNormalized, req.params.id);
    if (duplicate) {
      await db.companyDuplicateAttempt.create({ data: { attemptedName: data.name || 'Company update', attemptedPhone: data.phone || '', normalizedPhone: phoneNormalized, matchedCompanyId: duplicate.id, matchedCompanyName: duplicate.name, createdById: req.user.id, createdByName: req.user.name } });
      return res.status(409).json({ code: 'DUPLICATE_PHONE', message: `This mobile number already belongs to ${duplicate.name}. The update was blocked and added to Spam & Duplicates.` });
    }
  }
  const company = await db.company.update({ where: { id: req.params.id }, data: { ...data, phoneNormalized, email: email || undefined } }); await audit(req.user.id, 'Company', company.id, 'COMPANY_UPDATED', company); res.json(company);
});
app.get('/api/companies-spam', auth, allow(RoleName.ADMIN, RoleName.SALES_HEAD, RoleName.BD_MANAGER), async (_req, res) => {
  res.json(await db.companyDuplicateAttempt.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }));
});
app.delete('/api/companies/:id', auth, allow(RoleName.ADMIN), async (req: any, res) => {
  const company = await db.company.findFirst({ where: { id: req.params.id, archivedAt: null }, select: { id: true, name: true } });
  if (!company) return res.status(404).json({ message: 'Company not found or already deleted' });
  await db.$transaction(async tx => {
    await tx.workAssignment.updateMany({ where: { companyId: company.id, status: { notIn: [AssignmentStatus.COMPLETED, AssignmentStatus.CANCELLED] } }, data: { status: AssignmentStatus.CANCELLED } });
    await tx.followUp.updateMany({ where: { companyId: company.id, status: { notIn: ['COMPLETED', 'CLOSED'] } }, data: { status: 'CLOSED', completedAt: new Date(), outcome: 'Company removed by administrator' } });
    await tx.company.update({ where: { id: company.id }, data: { archivedAt: new Date() } });
    await audit(req.user.id, 'Company', company.id, 'COMPANY_DELETED', { name: company.name, archived: true });
  });
  res.status(204).end();
});
app.post('/api/companies/:id/contacts', auth, async (req, res) => {
  const p = z.object({ name: z.string().min(2), designation: z.string().optional(), phone: z.string().min(8), email: z.string().email() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Contact name, phone and email are required' });
  res.status(201).json(await db.contact.create({ data: { ...p.data, companyId: req.params.id } }));
});

app.get('/api/assignments', auth, async (req: any, res) => {
  const where = req.user.role === RoleName.SALES_BD_EXECUTIVE ? { assignedToId: req.user.id } : req.user.role === RoleName.BD_MANAGER ? { OR: [{ assignedById: req.user.id }, { assignedToId: req.user.id }] } : {};
  res.json(await db.workAssignment.findMany({ where, include: { company: { include: { industry: true, contacts: true } }, assignedTo: { select: { id: true, name: true, email: true, role: true } }, assignedBy: { select: { id: true, name: true } }, visits: { orderBy: { checkInAt: 'desc' }, take: 1 } }, orderBy: { scheduledAt: 'asc' } }));
});
app.post('/api/assignments', auth, allow(...managerRoles), async (req: any, res) => {
  const p = z.object({ companyId: z.string(), assignedToId: z.string(), title: z.string().min(3), description: z.string().optional(), scheduledAt: z.string(), dueAt: z.string().optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Complete all assignment fields' });
  const assignee = await db.user.findUnique({ where: { id: p.data.assignedToId } }); if (!assignee?.isSalesTeam || !assignee.isActive) return res.status(422).json({ message: 'Select an approved active sales-team member' });
  const company = await db.company.findUnique({ where: { id: p.data.companyId } }); if (!company) return res.status(404).json({ message: 'Company not found' });
  const assignment = await db.workAssignment.create({ data: { ...p.data, scheduledAt: new Date(p.data.scheduledAt), dueAt: p.data.dueAt ? new Date(p.data.dueAt) : null, assignedById: req.user.id } });
  const when = assignment.scheduledAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const email = await queueEmail({ template: 'WORK_ASSIGNMENT', to: assignee.email, subject: `New work assigned: ${company.name}`, body: `Hello ${assignee.name},\n\nA new company visit has been assigned to you.\nCompany: ${company.name}\nWork: ${assignment.title}\nScheduled for: ${when}\n${assignment.description ? `Instructions: ${assignment.description}\n` : ''}\nPlease sign in to the NexziByte CRM to review and start the work.`, companyId: company.id, sentBy: req.user.id });
  const notification = await notify(assignee.id, 'New work assigned', `${company.name}: ${assignment.title} — ${when}`, 'WORK_ASSIGNMENT', '/assignments');
  await activity(company.id, 'SALESPERSON_ASSIGNMENT_EMAIL_QUEUED', { assignmentId: assignment.id, emailId: email.id, assignedTo: assignee.id }, req.user.id, 'WorkAssignment', assignment.id);
  await activity(company.id, 'SALESPERSON_ASSIGNMENT_NOTIFICATION_CREATED', { assignmentId: assignment.id, notificationId: notification.id, assignedTo: assignee.id }, req.user.id, 'WorkAssignment', assignment.id);
  await audit(req.user.id, 'WorkAssignment', assignment.id, 'WORK_ASSIGNED', assignment); void processEmailQueue(); res.status(201).json(assignment);
});
app.patch('/api/assignments/:id', auth, async (req: any, res) => {
  const p = z.object({ status: z.nativeEnum(AssignmentStatus) }).safeParse(req.body); if (!p.success) return res.status(400).json({ message: 'Invalid status' });
  const current = await db.workAssignment.findUnique({ where: { id: req.params.id } }); if (!current) return res.status(404).json({ message: 'Assignment not found' });
  if (current.assignedToId !== req.user.id && !managerRoles.includes(req.user.role)) return res.status(403).json({ message: 'Not permitted' });
  res.json(await db.workAssignment.update({ where: { id: current.id }, data: p.data }));
});

app.post('/api/visits', auth, allow(RoleName.ADMIN, RoleName.SALES_HEAD, RoleName.BD_MANAGER, RoleName.SALES_BD_EXECUTIVE), async (req: any, res) => {
  const p = z.object({ assignmentId: z.string().optional(), companyId: z.string(), contactId: z.string().optional(), latitude: z.number(), longitude: z.number(), accuracy: z.number().nonnegative(), visitPurpose: z.string().min(3) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Company, purpose and GPS location are required' });
  if (await db.visit.findFirst({ where: { userId: req.user.id, status: VisitStatus.OPEN } })) return res.status(409).json({ message: 'Check out from the current visit before starting another' });
  if (req.user.role === RoleName.SALES_BD_EXECUTIVE && !await db.workAssignment.findFirst({ where: { id: p.data.assignmentId, assignedToId: req.user.id, companyId: p.data.companyId, status: { in: [AssignmentStatus.ASSIGNED, AssignmentStatus.IN_PROGRESS] } } })) return res.status(403).json({ message: 'Start visits only for work assigned to you' });
  const visit = await db.visit.create({ data: { assignmentId: p.data.assignmentId, companyId: p.data.companyId, contactId: p.data.contactId, visitPurpose: p.data.visitPurpose, userId: req.user.id, status: VisitStatus.OPEN, locations: { create: { latitude: p.data.latitude, longitude: p.data.longitude, accuracyM: p.data.accuracy, kind: 'CHECK_IN' } }, hourlyActivities: { create: { userId: req.user.id, status: 'REACHED_COMPANY', note: 'Visit check-in', latitude: p.data.latitude, longitude: p.data.longitude, accuracyM: p.data.accuracy } } } });
  if (p.data.assignmentId) await db.workAssignment.update({ where: { id: p.data.assignmentId }, data: { status: AssignmentStatus.IN_PROGRESS } });
  await db.activityLog.create({ data: { companyId: visit.companyId, event: 'VISIT_STARTED', payload: { visitId: visit.id, userId: req.user.id } } }); res.status(201).json(visit);
});
app.post('/api/visits/:id/activity', auth, async (req: any, res) => {
  const p = z.object({ status: z.enum(['TRAVELLING', 'REACHED_COMPANY', 'WAITING_FOR_CONTACT', 'MEETING_IN_PROGRESS', 'REQUIREMENT_DISCUSSION', 'FOLLOW_UP_DISCUSSION', 'BREAK']), note: z.string().trim().optional().or(z.literal('')), latitude: z.number().optional(), longitude: z.number().optional(), accuracy: z.number().nonnegative().optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Choose your current activity' });
  const visit = await db.visit.findUnique({ where: { id: req.params.id } }); if (!visit || visit.userId !== req.user.id || visit.status !== VisitStatus.OPEN) return res.status(403).json({ message: 'This active visit does not belong to you' });
  res.status(201).json(await db.hourlyActivity.create({ data: { visitId: visit.id, userId: req.user.id, status: p.data.status, note: p.data.note?.trim() || null, latitude: p.data.latitude, longitude: p.data.longitude, accuracyM: p.data.accuracy } }));
});
app.post('/api/visits/:id/photo', auth, async (req: any, res) => {
  const p = z.object({ fileUrl: z.string().min(20), photoType: z.enum(['COMPANY', 'MEETING', 'SELFIE']) }).safeParse(req.body); if (!p.success) return res.status(400).json({ message: 'Upload a valid visit proof photo' });
  const visit = await db.visit.findUnique({ where: { id: req.params.id } }); if (!visit || (visit.userId !== req.user.id && !managerRoles.includes(req.user.role))) return res.status(403).json({ message: 'Not permitted' });
  res.status(201).json(await db.visitPhoto.create({ data: { visitId: visit.id, uploadedBy: req.user.id, ...p.data } }));
});
app.patch('/api/visits/:id/checkout', auth, async (req: any, res) => {
  const p = z.object({ projectRequired: z.enum(['YES', 'NO', 'MAYBE', 'COLLABORATION']), contact: z.object({ name: z.string().min(2), phone: z.string().min(8).optional().or(z.literal('')), email: z.string().email().optional().or(z.literal('')), designation: z.string().min(2) }).optional(), emailUnavailableReason: z.string().optional(), industryId: z.string().optional(), companyPhone: z.string().optional(), companyEmail: z.string().email().optional().or(z.literal('')), companyAddress: z.string().min(5).optional(), projectType: z.string().optional(), requirementDescription: z.string().optional(), collaborationType: z.string().optional(), collaborationDetails: z.string().optional(), timeline: z.string().optional(), decisionMakerStatus: z.enum(['YES', 'PARTIAL', 'NO']).optional(), budgetDiscussed: z.boolean().optional(), budgetMin: z.number().nonnegative().optional(), budgetMax: z.number().nonnegative().optional(), leadQuality: z.enum(['HOT', 'WARM', 'COLD', 'NOT_QUALIFIED', 'NEGATIVE']).optional(), nextFollowUpAt: z.string().datetime().optional(), followUpType: z.enum(['CALL', 'EMAIL', 'WHATSAPP', 'F2F', 'TEAMS', 'ZOOM', 'DEMO', 'QUOTATION_FOLLOWUP', 'PAYMENT_FOLLOWUP']).optional(), followUpPurpose: z.string().optional(), noRequirementReason: z.string().optional(), revisitAfter: z.enum(['30_DAYS', '90_DAYS', '180_DAYS', 'NEVER', 'PARTNERSHIP', 'STAFFING']).optional(), remarks: z.string().optional(), latitude: z.number(), longitude: z.number(), accuracy: z.number() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Complete the checkout form', details: p.error.flatten() });
  const visit = await db.visit.findUnique({ where: { id: req.params.id }, include: { photos: true } }); if (!visit || visit.userId !== req.user.id || visit.status !== VisitStatus.OPEN) return res.status(403).json({ message: 'Active visit not found' });
  if (!visit.photos.some(x => x.photoType === 'COMPANY')) return res.status(422).json({ message: 'Company photo proof is mandatory before check-out' });
  const d = p.data;
  if (d.contact && !d.contact.email && !d.emailUnavailableReason) return res.status(422).json({ message: 'Enter the contact email or a reason why it is unavailable' });
  if (d.projectRequired === 'YES' && (!d.contact || (!d.contact.phone && !d.contact.email) || !d.industryId || !d.companyPhone || !d.companyAddress || !d.projectType || !d.requirementDescription || d.requirementDescription.trim().length < 20 || !d.timeline || !d.decisionMakerStatus || d.budgetDiscussed === undefined || !d.leadQuality || !d.nextFollowUpAt || !d.followUpType || !d.followUpPurpose || d.followUpPurpose.trim().length < 5)) return res.status(422).json({ message: 'YES requires company/contact details, project type, a 20-character requirement, decision maker, timeline, budget status, lead quality and next follow-up' });
  if (d.projectRequired === 'NO' && (!d.noRequirementReason || !d.revisitAfter)) return res.status(422).json({ message: 'NO requires a reason and revisit choice' });
  if (d.projectRequired === 'MAYBE' && (!d.nextFollowUpAt || new Date(d.nextFollowUpAt).getTime() > Date.now() + 7 * 864e5 || !d.followUpType || !d.followUpPurpose)) return res.status(422).json({ message: 'MAYBE requires a follow-up within 7 days' });
  if (d.projectRequired === 'COLLABORATION' && (!d.contact || (!d.contact.phone && !d.contact.email) || !d.collaborationType || !d.collaborationDetails || d.collaborationDetails.trim().length < 10 || !d.nextFollowUpAt || !d.followUpType || !d.followUpPurpose)) return res.status(422).json({ message: 'COLLABORATION requires contact details, collaboration type, details and a next follow-up' });
  const enteredEmails = [...new Set([d.contact?.email, d.companyEmail].filter(Boolean) as string[])];
  for (const email of enteredEmails) if (!await checkEmailDomain(email)) return res.status(422).json({ code: 'EMAIL_DOMAIN_INVALID', message: `${email} does not have a working email domain. Please confirm the address with the company and correct it before checkout.` });
  const salesperson = await db.user.findUniqueOrThrow({ where: { id: visit.userId }, select: { name: true, email: true } });
  const visitCompany = await db.company.findUniqueOrThrow({ where: { id: visit.companyId }, select: { name: true } });
  const checkout = new Date();
  const result = await db.$transaction(async tx => {
    let contactId = visit.contactId;
    if (d.contact) contactId = (await tx.contact.create({ data: { ...d.contact, companyId: visit.companyId } })).id;
    if (d.projectRequired === 'YES') {
      await tx.company.update({ where: { id: visit.companyId }, data: { industryId: d.industryId, phone: d.companyPhone, email: d.companyEmail || undefined, photoUrl: visit.photos.find(x => x.photoType === 'COMPANY')?.fileUrl } });
      const existingAddress = await tx.companyAddress.findFirst({ where: { companyId: visit.companyId }, orderBy: { id: 'asc' } });
      if (existingAddress) await tx.companyAddress.update({ where: { id: existingAddress.id }, data: { addressLine: d.companyAddress!, latitude: d.latitude, longitude: d.longitude } });
      else await tx.companyAddress.create({ data: { companyId: visit.companyId, addressLine: d.companyAddress!, city: (await tx.company.findUniqueOrThrow({ where: { id: visit.companyId } })).city || 'Not specified', latitude: d.latitude, longitude: d.longitude } });
    }
    const updated = await tx.visit.update({ where: { id: visit.id }, data: { contactId, projectRequired: d.projectRequired, decisionMakerStatus: d.decisionMakerStatus, leadQuality: d.leadQuality, budgetDiscussed: d.budgetDiscussed, budgetMin: d.budgetMin, budgetMax: d.budgetMax, noRequirementReason: d.noRequirementReason, revisitAfter: d.revisitAfter, emailUnavailableReason: d.emailUnavailableReason, collaborationType: d.collaborationType, collaborationDetails: d.collaborationDetails, remarks: d.remarks, checkOutAt: checkout, durationMinutes: Math.max(0, Math.round((checkout.getTime() - visit.checkInAt.getTime()) / 60000)), status: VisitStatus.COMPLETED, locations: { create: { latitude: d.latitude, longitude: d.longitude, accuracyM: d.accuracy, kind: 'CHECK_OUT' } }, hourlyActivities: { create: { userId: req.user.id, status: 'VISIT_COMPLETED', note: d.remarks || 'Visit completed', latitude: d.latitude, longitude: d.longitude, accuracyM: d.accuracy } } } });
    if (visit.assignmentId) await tx.workAssignment.update({ where: { id: visit.assignmentId }, data: { status: AssignmentStatus.COMPLETED } });
    let opportunityId: string | null = null; let leadId: string | null = null;
    if (d.projectRequired === 'YES') {
      const lead = await tx.lead.create({ data: { companyId: visit.companyId, visitId: visit.id, ownerId: visit.userId, status: d.leadQuality } }); leadId = lead.id;
      const requirement = await tx.requirement.create({ data: { companyId: visit.companyId, visitId: visit.id, leadId: lead.id, projectType: d.projectType, description: d.requirementDescription!, timeline: d.timeline, budgetDiscussed: d.budgetDiscussed, budgetMin: d.budgetMin, budgetMax: d.budgetMax } });
      const opportunity = await tx.opportunity.create({ data: { companyId: visit.companyId, visitId: visit.id, leadId: lead.id, requirementId: requirement.id, ownerId: visit.userId, name: `${d.projectType} Opportunity`, projectType: d.projectType, probability: d.leadQuality === 'HOT' ? 75 : d.leadQuality === 'WARM' ? 50 : 25, stage: 'REQUIREMENT_COLLECTED' } }); opportunityId = opportunity.id;
      await activity(visit.companyId, 'LEAD_CREATED', { leadId: lead.id, quality: d.leadQuality }, req.user.id, 'Lead', lead.id, tx);
      await activity(visit.companyId, 'REQUIREMENT_CREATED', { requirementId: requirement.id, projectType: d.projectType }, req.user.id, 'Requirement', requirement.id, tx);
      await activity(visit.companyId, 'OPPORTUNITY_CREATED', { opportunityId: opportunity.id, stage: opportunity.stage }, req.user.id, 'Opportunity', opportunity.id, tx);
    } else if (d.projectRequired === 'MAYBE') {
      const lead = await tx.lead.create({ data: { companyId: visit.companyId, visitId: visit.id, ownerId: visit.userId, status: d.leadQuality || 'WARM' } }); leadId = lead.id;
      let requirementId: string | undefined;
      if (d.requirementDescription?.trim()) {
        const requirement = await tx.requirement.create({ data: { companyId: visit.companyId, visitId: visit.id, leadId: lead.id, projectType: d.projectType || 'To be confirmed', description: d.requirementDescription.trim(), timeline: d.timeline, budgetDiscussed: d.budgetDiscussed, budgetMin: d.budgetMin, budgetMax: d.budgetMax } });
        requirementId = requirement.id;
        await activity(visit.companyId, 'TENTATIVE_REQUIREMENT_CREATED', { requirementId: requirement.id, projectType: requirement.projectType }, req.user.id, 'Requirement', requirement.id, tx);
      }
      const opportunity = await tx.opportunity.create({ data: { companyId: visit.companyId, visitId: visit.id, leadId: lead.id, requirementId, ownerId: visit.userId, name: `${d.projectType || 'Potential project'} Opportunity`, projectType: d.projectType, probability: 35, stage: requirementId ? 'REQUIREMENT_COLLECTED' : 'NEW' } }); opportunityId = opportunity.id;
      await activity(visit.companyId, 'MAYBE_LEAD_CREATED', { leadId: lead.id, opportunityId: opportunity.id, followUpRequiredWithinDays: 7 }, req.user.id, 'Opportunity', opportunity.id, tx);
    }
    let scheduledAt = d.nextFollowUpAt ? new Date(d.nextFollowUpAt) : null;
    if (d.projectRequired === 'NO' && d.revisitAfter !== 'NEVER') { const days = d.revisitAfter === '30_DAYS' ? 30 : d.revisitAfter === '90_DAYS' ? 90 : d.revisitAfter === '180_DAYS' ? 180 : 30; scheduledAt = new Date(Date.now() + days * 864e5); }
    if (scheduledAt) {
      const followup = await tx.followUp.create({ data: { companyId: visit.companyId, contactId, leadId, opportunityId, visitId: visit.id, assignedTo: visit.userId, originalOwnerId: visit.userId, type: d.followUpType || 'CALL', scheduledAt, purpose: d.followUpPurpose || `Re-engage after ${d.revisitAfter}`, handoverNotes: d.remarks, createdBy: req.user.id } });
      await activity(visit.companyId, 'FOLLOWUP_SCHEDULED', { followupId: followup.id, scheduledAt }, req.user.id, 'FollowUp', followup.id, tx);
      await notify(visit.userId, 'Follow-up scheduled', `${d.followUpPurpose || 'Client re-engagement'} on ${scheduledAt.toLocaleString()}`, 'FOLLOWUP', '/followups', tx);
      const salespersonWhen = scheduledAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const salespersonEmail = await queueEmail({ template: 'FOLLOWUP_ASSIGNED', to: salesperson.email, subject: `Next follow-up scheduled: ${visitCompany.name}`, body: `Hello ${salesperson.name},\n\nYour next follow-up has been scheduled after the completed visit.\nCompany: ${visitCompany.name}\nType: ${followup.type.replaceAll('_', ' ')}\nScheduled for: ${salespersonWhen}\nPurpose: ${followup.purpose}\n\nOpen the NexziByte CRM for complete details.`, companyId: visit.companyId, contactId, opportunityId, sentBy: req.user.id }, tx);
      await activity(visit.companyId, 'SALESPERSON_FOLLOWUP_EMAIL_QUEUED', { followupId: followup.id, emailId: salespersonEmail.id, assignedTo: visit.userId }, req.user.id, 'FollowUp', followup.id, tx);
      const meetingRecipient = d.contact?.email || d.companyEmail;
      if (meetingRecipient && ['F2F', 'TEAMS', 'ZOOM', 'DEMO'].includes(followup.type)) {
        const when = scheduledAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const email = await queueEmail({ template: 'MEETING_CONFIRMATION', to: meetingRecipient, subject: `Meeting scheduled for ${when}`, body: `Your ${followup.type.replaceAll('_', ' ')} meeting with NexziByte Solutions is scheduled for ${when}.\nPurpose: ${followup.purpose}\nWe look forward to meeting you.`, companyId: visit.companyId, contactId, opportunityId, visitId: visit.id, sentBy: req.user.id }, tx);
        await activity(visit.companyId, 'MEETING_CONFIRMATION_QUEUED', { followupId: followup.id, emailId: email.id, scheduledAt }, req.user.id, 'FollowUp', followup.id, tx);
      }
    }
    const recipient = d.contact?.email || d.companyEmail;
    if (recipient) await queueEmail({ template: 'COMPANY_BROCHURE', to: recipient, subject: `NexziByte Solutions profile, brochure and contact details`, body: `Hello ${d.contact?.name || 'there'},\n\nThank you for meeting our representative ${salesperson.name}. We recorded the visit outcome as ${d.projectRequired}.${d.projectRequired === 'YES' ? `\nProject discussed: ${d.projectType}\nOur team will follow up as scheduled.` : d.projectRequired === 'COLLABORATION' ? `\nCollaboration discussed: ${d.collaborationType}` : '\nPlease keep our company information for future requirements.'}\n\nSales brochure: ${brochureUrl}\nCompany profile: ${companyProfileUrl}\nVisiting card: ${visitingCardUrl}\n\nAll three files are attached for convenient offline access.`, companyId: visit.companyId, contactId, opportunityId, visitId: visit.id, sentBy: req.user.id, attachmentUrl: brochurePath }, tx);
    if (d.projectRequired === 'COLLABORATION') await activity(visit.companyId, 'COLLABORATION_RECORDED', { visitId: visit.id, collaborationType: d.collaborationType, details: d.collaborationDetails }, req.user.id, 'Visit', visit.id, tx);
    await activity(visit.companyId, 'VISIT_COMPLETED', { visitId: visit.id, projectRequired: d.projectRequired, proofPhoto: true }, req.user.id, 'Visit', visit.id, tx); return updated;
  }); void processEmailQueue(); res.json(result);
});
app.get('/api/visits', auth, async (req: any, res) => {
  const where = req.user.role === RoleName.SALES_BD_EXECUTIVE ? { userId: req.user.id } : {};
  const rows = await db.visit.findMany({ where, include: { company: { include: { industry: true, addresses: true } }, contact: true, requirement: true, opportunity: true, followups: { where: { status: { not: 'CLOSED' } }, orderBy: { scheduledAt: 'asc' }, take: 1 }, user: { select: { id: true, name: true, email: true, role: true } }, locations: true, photos: true, hourlyActivities: { orderBy: { capturedAt: 'desc' } }, assignment: true }, orderBy: { checkInAt: 'desc' }, take: 200 });
  res.json(rows.map(({ photos, contact, requirement, opportunity, followups, company, ...visit }) => ({
    ...visit,
    isMine: visit.userId === req.user.id,
    userId: undefined,
    company: req.user.role === RoleName.ADMIN ? company : { id: company.id, name: company.name, city: company.city, email: visit.userId === req.user.id ? company.email : undefined },
    hasProof: photos.length > 0,
    proofPhotos: req.user.role === RoleName.ADMIN ? photos : undefined,
    editableEmails: visit.userId === req.user.id || managerRoles.includes(req.user.role) ? { companyEmail: company.email || '', contactEmail: contact?.email || '', contactName: contact?.name || '' } : undefined,
    canCorrectEmail: visit.status === VisitStatus.COMPLETED && (visit.userId === req.user.id || managerRoles.includes(req.user.role)),
    adminDetails: req.user.role === RoleName.ADMIN && ['YES', 'MAYBE', 'COLLABORATION'].includes(String(visit.projectRequired)) ? { contact, requirement, opportunity, followUp: followups[0] || null } : undefined
  })));
});

app.patch('/api/visits/:id/contact-email', auth, async (req: any, res) => {
  const p = z.object({ contactEmail: z.string().email().optional().or(z.literal('')), companyEmail: z.string().email().optional().or(z.literal('')) }).refine(value => Boolean(value.contactEmail || value.companyEmail), { message: 'Enter a contact or company email address' }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Enter a valid contact or company email address' });
  const visit = await db.visit.findUnique({ where: { id: req.params.id }, include: { company: true, contact: true, user: { select: { id: true, name: true, email: true } }, opportunity: true } });
  if (!visit) return res.status(404).json({ message: 'Visit not found' });
  if (visit.userId !== req.user.id && !managerRoles.includes(req.user.role)) return res.status(403).json({ message: 'Only the assigned salesperson or a manager can correct these emails' });
  if (visit.status !== VisitStatus.COMPLETED) return res.status(409).json({ message: 'Email correction is available after visit checkout' });
  const emails = [...new Set([p.data.contactEmail, p.data.companyEmail].filter(Boolean) as string[])];
  for (const email of emails) if (!await checkEmailDomain(email)) return res.status(422).json({ message: `${email} does not have a working email domain. Confirm the address with the company.` });
  const recipient = p.data.contactEmail || p.data.companyEmail!;
  const updated = await db.$transaction(async tx => {
    if (p.data.companyEmail) await tx.company.update({ where: { id: visit.companyId }, data: { email: p.data.companyEmail.toLowerCase() } });
    if (visit.contactId && p.data.contactEmail) await tx.contact.update({ where: { id: visit.contactId }, data: { email: p.data.contactEmail.toLowerCase() } });
    const saved = await tx.visit.update({ where: { id: visit.id }, data: { emailCorrectionRequired: false, emailCorrectionReason: null, emailLastCorrectedAt: new Date() } });
    await queueEmail({ template: 'COMPANY_BROCHURE', to: recipient.toLowerCase(), subject: 'NexziByte Solutions profile, brochure and contact details', body: `Hello ${visit.contact?.name || 'there'},\n\nThank you for meeting our representative ${visit.user.name}. Your email address has been corrected in our records.\nVisit outcome: ${visit.projectRequired || 'Recorded'}\n\nSales brochure: ${brochureUrl}\nCompany profile: ${companyProfileUrl}\nVisiting card: ${visitingCardUrl}\n\nAll three files are attached for convenient offline access.`, companyId: visit.companyId, contactId: visit.contactId, opportunityId: visit.opportunity?.id, visitId: visit.id, sentBy: req.user.id, attachmentUrl: brochurePath }, tx);
    await activity(visit.companyId, 'CLIENT_EMAIL_CORRECTED', { visitId: visit.id, previousReason: visit.emailCorrectionReason, recipient }, req.user.id, 'Visit', visit.id, tx);
    return saved;
  });
  await notify(visit.userId, 'Client email updated', `${visit.company.name}: brochure re-send queued for ${recipient}.`, 'CLIENT_EMAIL_CORRECTED', '/visits');
  void processEmailQueue();
  res.json({ message: 'Email updated. The company brochure has been queued again.', visit: updated });
});

app.patch('/api/admin/visits/:id/project', auth, allow(RoleName.ADMIN), async (req: any, res) => {
  const p = z.object({
    company: z.object({ name: z.string().min(2), city: z.string().min(2), phone: z.string().optional(), email: z.string().email().optional().or(z.literal('')), addressLine: z.string().min(5) }),
    contact: z.object({ name: z.string().min(2), designation: z.string().min(2), phone: z.string().min(8).optional().or(z.literal('')), email: z.string().email().optional().or(z.literal('')) }),
    projectType: z.string().min(2),
    requirementDescription: z.string().min(20),
    timeline: z.string().min(2),
    decisionMakerStatus: z.enum(['YES', 'PARTIAL', 'NO']),
    budgetDiscussed: z.boolean(),
    budgetMin: z.number().nonnegative().nullable(),
    budgetMax: z.number().nonnegative().nullable(),
    leadQuality: z.enum(['HOT', 'WARM', 'COLD', 'NOT_QUALIFIED', 'NEGATIVE']),
    opportunityName: z.string().min(2),
    estimatedValue: z.number().nonnegative().nullable(),
    probability: z.number().int().min(0).max(100).nullable(),
    stage: z.nativeEnum(OpportunityStage),
    followUp: z.object({ id: z.string(), type: z.enum(['CALL', 'EMAIL', 'WHATSAPP', 'F2F', 'TEAMS', 'ZOOM', 'DEMO', 'QUOTATION_FOLLOWUP', 'PAYMENT_FOLLOWUP']), scheduledAt: z.string().datetime(), purpose: z.string().min(5), reminderOffsetMinutes: z.number().int().min(0).max(10080) }).nullable()
  }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Complete all admin project fields with valid values' });
  const before = await db.visit.findUnique({ where: { id: req.params.id }, include: { company: { include: { addresses: true } }, contact: true, requirement: true, opportunity: true, followups: { orderBy: { scheduledAt: 'asc' }, take: 1 } } });
  if (!before || before.projectRequired !== 'YES' || !before.requirement || !before.opportunity || !before.contact) return res.status(404).json({ message: 'Completed YES project details were not found' });
  if (p.data.budgetDiscussed && p.data.budgetMin !== null && p.data.budgetMax !== null && p.data.budgetMin > p.data.budgetMax) return res.status(422).json({ message: 'Minimum budget cannot be greater than maximum budget' });
  if (p.data.followUp && !before.followups.some(x => x.id === p.data.followUp!.id)) return res.status(403).json({ message: 'The selected follow-up does not belong to this visit' });
  const d = p.data;
  const oldFollowUp = before.followups[0];
  const followUpChanged = !!(d.followUp && oldFollowUp && (d.followUp.type !== oldFollowUp.type || new Date(d.followUp.scheduledAt).getTime() !== oldFollowUp.scheduledAt.getTime() || d.followUp.purpose !== oldFollowUp.purpose || d.followUp.reminderOffsetMinutes !== oldFollowUp.reminderOffsetMinutes));
  const result = await db.$transaction(async tx => {
    await tx.company.update({ where: { id: before.companyId }, data: { name: d.company.name, city: d.company.city, phone: d.company.phone || null, email: d.company.email || null } });
    const address = before.company.addresses[0];
    if (address) await tx.companyAddress.update({ where: { id: address.id }, data: { addressLine: d.company.addressLine, city: d.company.city } });
    else await tx.companyAddress.create({ data: { companyId: before.companyId, addressLine: d.company.addressLine, city: d.company.city } });
    await tx.contact.update({ where: { id: before.contact!.id }, data: { name: d.contact.name, designation: d.contact.designation, phone: d.contact.phone || null, email: d.contact.email || null } });
    await tx.visit.update({ where: { id: before.id }, data: { decisionMakerStatus: d.decisionMakerStatus, budgetDiscussed: d.budgetDiscussed, budgetMin: d.budgetDiscussed ? d.budgetMin : null, budgetMax: d.budgetDiscussed ? d.budgetMax : null, leadQuality: d.leadQuality } });
    await tx.requirement.update({ where: { id: before.requirement!.id }, data: { projectType: d.projectType, description: d.requirementDescription, timeline: d.timeline, budgetDiscussed: d.budgetDiscussed, budgetMin: d.budgetDiscussed ? d.budgetMin : null, budgetMax: d.budgetDiscussed ? d.budgetMax : null } });
    await tx.opportunity.update({ where: { id: before.opportunity!.id }, data: { name: d.opportunityName, projectType: d.projectType, estimatedValue: d.estimatedValue, probability: d.probability, stage: d.stage } });
    if (d.followUp && followUpChanged) {
      await tx.followUp.update({ where: { id: d.followUp.id }, data: { type: d.followUp.type, scheduledAt: new Date(d.followUp.scheduledAt), purpose: d.followUp.purpose, reminderOffsetMinutes: d.followUp.reminderOffsetMinutes, status: 'RESCHEDULED', remindedAt: null, reminderEmailQueuedAt: null } });
      const assignee = await tx.user.findUnique({ where: { id: oldFollowUp!.assignedTo }, select: { id: true, name: true, email: true } });
      if (assignee) await queueEmail({ template: 'FOLLOWUP_RESCHEDULED', to: assignee.email, subject: `Follow-up updated: ${d.company.name}`, body: `Hello ${assignee.name},\n\nYour assigned follow-up has been updated by the administrator.\nCompany: ${d.company.name}\nType: ${d.followUp.type.replaceAll('_', ' ')}\nNew date and time: ${new Date(d.followUp.scheduledAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\nPurpose: ${d.followUp.purpose}\n\nPlease review the updated work in the NexziByte CRM.`, companyId: before.companyId, contactId: before.contact!.id, opportunityId: before.opportunity!.id, sentBy: req.user.id }, tx);
      if (d.contact.email && ['F2F', 'TEAMS', 'ZOOM', 'DEMO'].includes(d.followUp.type)) {
        await queueEmail({ template: 'MEETING_CONFIRMATION', to: d.contact.email, subject: `Updated meeting schedule with NexziByte Solutions`, body: `Hello ${d.contact.name},\n\nYour ${d.followUp.type} meeting with NexziByte Solutions has been updated.\nDate and time: ${new Date(d.followUp.scheduledAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\nPurpose: ${d.followUp.purpose}\n\nPlease contact our team if you need any clarification.`, companyId: before.companyId, contactId: before.contact!.id, opportunityId: before.opportunity!.id, sentBy: req.user.id }, tx);
      }
    }
    const after = await tx.visit.findUnique({ where: { id: before.id }, include: { company: { include: { addresses: true } }, contact: true, requirement: true, opportunity: true, followups: { orderBy: { scheduledAt: 'asc' }, take: 1 } } });
    await tx.auditLog.create({ data: { actorId: req.user.id, entity: 'VisitProject', entityId: before.id, action: 'ADMIN_PROJECT_UPDATED', before: JSON.parse(JSON.stringify(before)), after: JSON.parse(JSON.stringify(after)) } });
    await activity(before.companyId, 'ADMIN_PROJECT_UPDATED', { visitId: before.id, requirementId: before.requirement!.id, opportunityId: before.opportunity!.id, budgetDiscussed: d.budgetDiscussed, budgetMin: d.budgetMin, budgetMax: d.budgetMax }, req.user.id, 'Visit', before.id, tx);
    return after;
  });
  void processEmailQueue();
  res.json(result);
});

app.get('/api/followups', auth, async (req: any, res) => {
  const where = req.user.role === RoleName.SALES_BD_EXECUTIVE ? { OR: [{ originalOwnerId: req.user.id }, { assignedTo: req.user.id }, { delegatedToId: req.user.id }] } : {};
  const rows = await db.followUp.findMany({ where, include: { company: true, contact: true, opportunity: true, booking: true, user: { select: { name: true } }, originalOwner: { select: { name: true } }, delegatedTo: { select: { name: true } }, completedBy: { select: { name: true } } }, orderBy: [{ status: 'asc' }, { scheduledAt: 'asc' }] });
  res.json(rows.map(({ assignedTo, originalOwnerId, delegatedToId, completedById, createdBy, ...row }) => ({ ...row, assignedTo: assignedTo === req.user.id ? 'SELF' : undefined, isAssignee: assignedTo === req.user.id, isOwner: originalOwnerId === req.user.id, canAccept: row.status === 'PENDING_ACCEPTANCE' && assignedTo === req.user.id, canComplete: ['ACCEPTED', 'SCHEDULED', 'RESCHEDULED'].includes(row.status) && (assignedTo === req.user.id || req.user.role === RoleName.ADMIN), canRequestBooking: ['ACCEPTED', 'SCHEDULED', 'RESCHEDULED', 'CLIENT_NOT_AVAILABLE', 'NO_RESPONSE'].includes(row.status) && (assignedTo === req.user.id || req.user.role === RoleName.ADMIN) })));
});
app.post('/api/followups', auth, allow(RoleName.ADMIN, RoleName.SALES_HEAD, RoleName.BD_MANAGER, RoleName.SALES_BD_EXECUTIVE), async (req: any, res) => {
  const p = z.object({ companyId: z.string(), assignedToId: z.string(), type: z.enum(['CALL', 'EMAIL', 'WHATSAPP', 'F2F', 'TEAMS', 'ZOOM', 'DEMO', 'QUOTATION_FOLLOWUP', 'PAYMENT_FOLLOWUP']), scheduledAt: z.string(), purpose: z.string().min(5), instructions: z.string().min(5), contactId: z.string().optional(), opportunityId: z.string().optional(), visitId: z.string().optional(), aiCallEnabled: z.boolean().optional(), aiCallConsent: z.boolean().optional(), aiCallOffsetMinutes: z.number().int().min(15).max(1440).optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Complete the company, salesperson, schedule, purpose and instructions' });
  const assignee = await db.user.findUnique({ where: { id: p.data.assignedToId } });
  if (!assignee?.isActive || !assignee.isSalesTeam) return res.status(422).json({ message: 'Select an approved active sales-team member' });
  const company = await db.company.findUnique({ where: { id: p.data.companyId }, include: { contacts: true } }); if (!company) return res.status(404).json({ message: 'Company not found' });
  if (p.data.aiCallEnabled && !p.data.aiCallConsent) return res.status(422).json({ message: 'Client consent is required before scheduling an automated reminder call' });
  const callContact = p.data.contactId ? company.contacts.find(x => x.id === p.data.contactId) : company.contacts.find(x => x.phone);
  const callPhone = callContact?.phone || company.phone;
  if (p.data.aiCallEnabled && !callPhone) return res.status(422).json({ message: 'Add a valid client or company phone number before enabling AI reminder calling' });
  const requiresAcceptance = assignee.id !== req.user.id;
  const followup = await db.followUp.create({ data: { companyId: p.data.companyId, contactId: p.data.contactId || callContact?.id || null, opportunityId: p.data.opportunityId || null, visitId: p.data.visitId || null, assignedTo: assignee.id, delegatedToId: requiresAcceptance ? assignee.id : null, originalOwnerId: req.user.id, type: p.data.type, scheduledAt: new Date(p.data.scheduledAt), purpose: p.data.purpose, handoverNotes: p.data.instructions, status: requiresAcceptance ? 'PENDING_ACCEPTANCE' : 'SCHEDULED', acceptedAt: requiresAcceptance ? null : new Date(), aiCallEnabled: !!p.data.aiCallEnabled, aiCallConsent: !!p.data.aiCallConsent, aiCallOffsetMinutes: p.data.aiCallOffsetMinutes || 60, createdBy: req.user.id } });
  if (followup.aiCallEnabled && callPhone && !requiresAcceptance) {
    const when = followup.scheduledAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });
    const script = `Hello ${callContact?.name || 'there'}. This is an automated reminder from NexziByte Solutions. Your ${followup.type.replaceAll('_', ' ').toLowerCase()} follow-up regarding ${followup.purpose} is scheduled for ${when}. Please reply to the confirmation email or contact your NexziByte representative if you need to reschedule. Thank you.`;
    await db.aiCallLog.create({ data: { followUpId: followup.id, companyId: company.id, contactId: callContact?.id, toPhone: callPhone, script, scheduledFor: new Date(followup.scheduledAt.getTime() - followup.aiCallOffsetMinutes * 60_000) } });
  }
  const assigneeWhen = followup.scheduledAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const assigneeEmail = await queueEmail({ template: 'FOLLOWUP_ASSIGNED', to: assignee.email, subject: `Action required: follow-up assigned for ${company.name}`, body: `Hello ${assignee.name},\n\nA follow-up has been assigned to you.\nCompany: ${company.name}\nType: ${followup.type.replaceAll('_', ' ')}\nProposed schedule: ${assigneeWhen}\nPurpose: ${followup.purpose}\nInstructions: ${p.data.instructions}\n\nOpen the NexziByte CRM and accept or decline this follow-up.`, companyId: company.id, contactId: followup.contactId, opportunityId: followup.opportunityId, sentBy: req.user.id });
  await activity(company.id, 'SALESPERSON_FOLLOWUP_EMAIL_QUEUED', { followupId: followup.id, emailId: assigneeEmail.id, assignedTo: assignee.id }, req.user.id, 'FollowUp', followup.id);
  if (!requiresAcceptance && ['F2F', 'TEAMS', 'ZOOM', 'DEMO'].includes(followup.type)) {
    const contact = followup.contactId ? await db.contact.findUnique({ where: { id: followup.contactId } }) : null;
    const recipient = contact?.email || company.email;
    if (recipient) {
      const when = followup.scheduledAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const email = await queueEmail({ template: 'MEETING_CONFIRMATION', to: recipient, subject: `Meeting scheduled for ${when}`, body: `Your ${followup.type.replaceAll('_', ' ')} meeting with NexziByte Solutions is scheduled for ${when}.\nPurpose: ${followup.purpose}\nWe look forward to meeting you.`, companyId: company.id, contactId: contact?.id, opportunityId: followup.opportunityId, sentBy: req.user.id });
      await activity(company.id, 'MEETING_CONFIRMATION_QUEUED', { followupId: followup.id, emailId: email.id, scheduledAt: followup.scheduledAt }, req.user.id, 'FollowUp', followup.id);
    }
  }
  await audit(req.user.id, 'FollowUp', followup.id, 'FOLLOWUP_DELEGATED', { companyId: followup.companyId, assignedTo: followup.assignedTo, scheduledAt: followup.scheduledAt });
  void processEmailQueue(); res.status(201).json(followup);
});

app.patch('/api/followups/:id/respond', auth, async (req: any, res) => {
  const p = z.object({ action: z.enum(['ACCEPT', 'DECLINE']), reason: z.string().max(500).optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Select accept or decline' });
  const current = await db.followUp.findUnique({ where: { id: req.params.id }, include: { company: true, originalOwner: { select: { name: true, email: true } }, user: { select: { name: true } } } });
  if (!current) return res.status(404).json({ message: 'Follow-up not found' });
  if (current.assignedTo !== req.user.id) return res.status(403).json({ message: 'Only the assigned salesperson can respond' });
  if (current.status !== 'PENDING_ACCEPTANCE') return res.status(409).json({ message: 'This follow-up has already been responded to' });
  if (p.data.action === 'DECLINE' && (!p.data.reason || p.data.reason.trim().length < 5)) return res.status(422).json({ message: 'Add a clear reason for declining' });
  const accepted = p.data.action === 'ACCEPT';
  const updated = await db.followUp.update({ where: { id: current.id }, data: accepted ? { status: 'ACCEPTED', acceptedAt: new Date(), declinedAt: null, declineReason: null } : { status: 'CLIENT_NOT_AVAILABLE', declinedAt: new Date(), declineReason: p.data.reason } });
  const subject = accepted ? `Follow-up accepted: ${current.company.name}` : `Follow-up declined: ${current.company.name}`;
  const body = accepted
    ? `Hello ${current.originalOwner.name},\n\n${req.user.name} accepted the ${current.type.replaceAll('_', ' ')} follow-up for ${current.company.name}.\nScheduled for: ${current.scheduledAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\nPurpose: ${current.purpose}`
    : `Hello ${current.originalOwner.name},\n\n${req.user.name} declined the follow-up for ${current.company.name}.\nReason: ${p.data.reason}\nPlease reassign or reschedule the work.`;
  await queueEmail({ template: accepted ? 'FOLLOWUP_ACCEPTED' : 'FOLLOWUP_DECLINED', to: current.originalOwner.email, subject, body, companyId: current.companyId, contactId: current.contactId, opportunityId: current.opportunityId, sentBy: req.user.id });
  await notify(current.originalOwnerId, subject, accepted ? `${req.user.name} accepted the task.` : `${req.user.name} declined: ${p.data.reason}`, accepted ? 'FOLLOWUP_ACCEPTED' : 'FOLLOWUP_DECLINED', '/followups');
  await activity(current.companyId, accepted ? 'FOLLOWUP_ACCEPTED' : 'FOLLOWUP_DECLINED', { followUpId: current.id, assignedTo: current.assignedTo, reason: p.data.reason }, req.user.id, 'FollowUp', current.id);
  void processEmailQueue();
  res.json(updated);
});

app.post('/api/followups/:id/request-booking', auth, async (req: any, res) => {
  const p = z.object({ slots: z.array(z.string().datetime()).min(2).max(10), message: z.string().max(1000).optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Provide between 2 and 10 valid future time slots' });
  const current = await db.followUp.findUnique({ where: { id: req.params.id }, include: { company: true, contact: true, originalOwner: { select: { email: true } }, user: { select: { name: true, email: true } } } });
  if (!current) return res.status(404).json({ message: 'Follow-up not found' });
  if (current.assignedTo !== req.user.id && req.user.role !== RoleName.ADMIN) return res.status(403).json({ message: 'Only the assigned salesperson or administrator can request booking' });
  if (!['ACCEPTED', 'SCHEDULED', 'RESCHEDULED', 'CLIENT_NOT_AVAILABLE', 'NO_RESPONSE'].includes(current.status)) return res.status(409).json({ message: 'Accept the follow-up before requesting client availability' });
  const slots = p.data.slots.map(value => new Date(value)).filter(value => value.getTime() > Date.now() + 5 * 60_000).sort((a, b) => a.getTime() - b.getTime());
  if (slots.length < 2) return res.status(422).json({ message: 'Provide at least two future time slots' });
  const recipient = current.contact?.email || current.company.email;
  if (!recipient) return res.status(422).json({ message: 'Add the client email address before sending a booking request' });
  const token = randomBytes(32).toString('base64url');
  const booking = await db.meetingBooking.upsert({ where: { followUpId: current.id }, create: { followUpId: current.id, tokenHash: publicTokenHash(token), availableSlots: slots.map(x => x.toISOString()), expiresAt: new Date(slots[slots.length - 1].getTime() + 24 * 3600_000), createdBy: req.user.id }, update: { tokenHash: publicTokenHash(token), status: 'OPEN', availableSlots: slots.map(x => x.toISOString()), expiresAt: new Date(slots[slots.length - 1].getTime() + 24 * 3600_000), selectedSlot: null, bookedAt: null, clientName: null, clientEmail: null, clientNote: null, createdBy: req.user.id } });
  const bookingUrl = `${appUrl}/?booking=${encodeURIComponent(token)}`;
  await db.followUp.update({ where: { id: current.id }, data: { bookingRequestedAt: new Date() } });
  await queueEmail({ template: 'CLIENT_BOOKING_REQUEST', to: recipient, subject: `Choose a convenient meeting time with NexziByte Solutions`, body: `Hello ${current.contact?.name || 'there'},\n\n${current.user.name} would like to arrange the next discussion regarding ${current.purpose}.\n${p.data.message || 'Please choose the time that is most convenient for you.'}\n\nBook your preferred slot: ${bookingUrl}\n\nThis secure link expires after the offered slots.`, companyId: current.companyId, contactId: current.contactId, opportunityId: current.opportunityId, sentBy: req.user.id });
  await activity(current.companyId, 'CLIENT_BOOKING_REQUEST_SENT', { followUpId: current.id, bookingId: booking.id, slotCount: slots.length }, req.user.id, 'MeetingBooking', booking.id);
  void processEmailQueue();
  res.status(201).json({ message: 'Booking invitation sent to the client', bookingUrl, expiresAt: booking.expiresAt });
});

app.get('/api/public/bookings/:token', rateLimit(20, 15 * 60_000), async (req, res) => {
  const booking = await db.meetingBooking.findUnique({ where: { tokenHash: publicTokenHash(req.params.token) }, include: { followUp: { include: { company: { select: { name: true } }, contact: { select: { name: true, email: true } }, user: { select: { name: true } } } } } });
  if (!booking || booking.status === 'CANCELLED') return res.status(404).json({ message: 'This booking link is invalid or unavailable' });
  if (booking.expiresAt < new Date() && booking.status === 'OPEN') { await db.meetingBooking.update({ where: { id: booking.id }, data: { status: 'EXPIRED' } }); return res.status(410).json({ message: 'This booking link has expired. Contact the NexziByte representative for new slots.' }); }
  res.json({ status: booking.status, company: booking.followUp.company.name, contactName: booking.followUp.contact?.name, salesperson: booking.followUp.user.name, purpose: booking.followUp.purpose, type: booking.followUp.type, timezone: booking.timezone, slots: booking.availableSlots, selectedSlot: booking.selectedSlot });
});

app.post('/api/public/bookings/:token/confirm', rateLimit(10, 15 * 60_000), async (req, res) => {
  const p = z.object({ slot: z.string().datetime(), name: z.string().min(2).max(100), email: z.string().email(), note: z.string().max(500).optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Enter your name, email and select a valid slot' });
  const booking = await db.meetingBooking.findUnique({ where: { tokenHash: publicTokenHash(req.params.token) }, include: { followUp: { include: { company: true, contact: true, user: { select: { id: true, name: true, email: true } }, originalOwner: { select: { id: true, name: true, email: true } } } } } });
  if (!booking || booking.status !== 'OPEN' || booking.expiresAt < new Date()) return res.status(409).json({ message: 'This booking invitation is no longer available' });
  const selected = new Date(p.data.slot);
  const offered = (booking.availableSlots as string[]).some(slot => new Date(slot).getTime() === selected.getTime());
  if (!offered || selected.getTime() <= Date.now()) return res.status(422).json({ message: 'Select one of the available future time slots' });
  const f = booking.followUp;
  await db.$transaction([
    db.meetingBooking.update({ where: { id: booking.id }, data: { status: 'BOOKED', selectedSlot: selected, clientName: p.data.name, clientEmail: p.data.email.toLowerCase(), clientNote: p.data.note, bookedAt: new Date() } }),
    db.followUp.update({ where: { id: f.id }, data: { scheduledAt: selected, status: 'SCHEDULED', clientConfirmedAt: new Date(), remindedAt: null, reminderEmailQueuedAt: null, overdueAt: null } }),
    db.aiCallLog.updateMany({ where: { followUpId: f.id, status: 'QUEUED' }, data: { status: 'CANCELLED', lastError: 'Replaced after client selected a new meeting time' } })
  ]);
  if (f.aiCallEnabled && f.aiCallConsent && (f.contact?.phone || f.company.phone)) {
    const when = selected.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });
    await db.aiCallLog.create({ data: { followUpId: f.id, companyId: f.companyId, contactId: f.contactId, toPhone: f.contact?.phone || f.company.phone!, script: `Hello ${p.data.name}. This is a reminder from NexziByte Solutions. Your ${f.type.replaceAll('_', ' ').toLowerCase()} discussion regarding ${f.purpose} is scheduled for ${when}. Thank you.`, scheduledFor: new Date(selected.getTime() - f.aiCallOffsetMinutes * 60_000) } });
  }
  const when = selected.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const recipients = new Map<string, { name: string; role: string }>();
  recipients.set(f.user.email, { name: f.user.name, role: 'assigned salesperson' });
  recipients.set(f.originalOwner.email, { name: f.originalOwner.name, role: 'original owner' });
  const admins = await db.user.findMany({ where: { role: RoleName.ADMIN, isActive: true, approvalStatus: ApprovalStatus.APPROVED }, select: { name: true, email: true } });
  admins.forEach(admin => recipients.set(admin.email, { name: admin.name, role: 'administrator' }));
  recipients.set(p.data.email.toLowerCase(), { name: p.data.name, role: 'client' });
  for (const [email, recipient] of recipients) await queueEmail({ template: 'CLIENT_BOOKING_CONFIRMED', to: email, subject: `Meeting confirmed: ${f.company.name} — ${when}`, body: `Hello ${recipient.name},\n\n${p.data.name} confirmed the meeting with NexziByte Solutions.\nCompany: ${f.company.name}\nDate and time: ${when}\nType: ${f.type.replaceAll('_', ' ')}\nPurpose: ${f.purpose}\nAssigned representative: ${f.user.name}\n${p.data.note ? `Client note: ${p.data.note}` : ''}\n\nThis confirmation was shared with the client, assigned salesperson, original owner and administrator.`, companyId: f.companyId, contactId: f.contactId, opportunityId: f.opportunityId, sentBy: f.originalOwner.id });
  await notify(f.user.id, 'Client confirmed meeting', `${p.data.name} selected ${when} for ${f.company.name}.`, 'CLIENT_BOOKING_CONFIRMED', '/followups');
  if (f.originalOwner.id !== f.user.id) await notify(f.originalOwner.id, 'Client confirmed meeting', `${p.data.name} selected ${when}; ${f.user.name} is assigned.`, 'CLIENT_BOOKING_CONFIRMED', '/followups');
  await activity(f.companyId, 'CLIENT_BOOKING_CONFIRMED', { followUpId: f.id, bookingId: booking.id, selectedSlot: selected, clientEmail: p.data.email }, undefined, 'MeetingBooking', booking.id);
  void processEmailQueue();
  res.json({ message: 'Your meeting is confirmed. Confirmation emails are being sent.', selectedSlot: selected });
});

app.get('/api/ai-calls', auth, allow(RoleName.ADMIN, RoleName.SALES_HEAD, RoleName.BD_MANAGER), async (_req, res) => res.json(await db.aiCallLog.findMany({ include: { company: { select: { name: true } }, contact: { select: { name: true, phone: true } }, followUp: { select: { type: true, purpose: true, scheduledAt: true } } }, orderBy: { createdAt: 'desc' }, take: 250 })));
app.post('/api/webhooks/ai-calls', async (req, res) => {
  const p = z.object({ CallSid: z.string(), CallStatus: z.string() }).safeParse(req.body);
  if (!p.success) return res.status(400).end();
  const completed = ['completed'].includes(p.data.CallStatus), failed = ['busy', 'failed', 'no-answer', 'canceled'].includes(p.data.CallStatus);
  await db.aiCallLog.updateMany({ where: { providerCallId: p.data.CallSid }, data: { status: completed ? 'COMPLETED' : failed ? 'FAILED' : 'INITIATED', completedAt: completed ? new Date() : undefined, lastError: failed ? `Provider status: ${p.data.CallStatus}` : undefined } });
  res.status(204).end();
});
app.patch('/api/followups/:id/complete', auth, async (req: any, res) => {
  const p = z.object({ outcome: z.string().min(5), handoverNotes: z.string().min(5), close: z.boolean().optional(), requestQuotation: z.boolean().optional(), nextFollowUp: z.object({ type: z.enum(['CALL', 'EMAIL', 'WHATSAPP', 'F2F', 'TEAMS', 'ZOOM', 'DEMO', 'QUOTATION_FOLLOWUP', 'PAYMENT_FOLLOWUP']), scheduledAt: z.string().datetime(), purpose: z.string().min(5) }).optional() }).safeParse(req.body); if (!p.success || (!p.data.close && !p.data.nextFollowUp && !p.data.requestQuotation)) return res.status(400).json({ message: 'Complete with a next follow-up, quotation request or explicit close' });
  const current = await db.followUp.findUnique({ where: { id: req.params.id } }); if (!current) return res.status(404).json({ message: 'Follow-up not found' });
  if (current.assignedTo !== req.user.id && req.user.role !== RoleName.ADMIN) return res.status(403).json({ message: 'Only the assigned salesperson can complete this follow-up' });
  if (current.status === 'COMPLETED') return res.status(409).json({ message: 'This follow-up is already completed and returned' });
  const updated = await db.$transaction(async tx => {
    let nextFollowupId: string | null = null;
    if (p.data.nextFollowUp) { const next = await tx.followUp.create({ data: { companyId: current.companyId, contactId: current.contactId, leadId: current.leadId, opportunityId: current.opportunityId, visitId: current.visitId, assignedTo: current.originalOwnerId, originalOwnerId: current.originalOwnerId, type: p.data.nextFollowUp.type, scheduledAt: new Date(p.data.nextFollowUp.scheduledAt), purpose: p.data.nextFollowUp.purpose, createdBy: req.user.id } }); nextFollowupId = next.id; }
    if (p.data.requestQuotation && current.opportunityId) await tx.opportunity.update({ where: { id: current.opportunityId }, data: { stage: 'QUOTATION' } });
    return tx.followUp.update({ where: { id: current.id }, data: { status: p.data.close ? 'CLOSED' : 'COMPLETED', outcome: p.data.outcome, handoverNotes: p.data.handoverNotes, completedAt: new Date(), closedAt: p.data.close ? new Date() : null, returnedAt: new Date(), completedById: req.user.id, assignedTo: current.originalOwnerId, nextFollowupId, quotationRequestedAt: p.data.requestQuotation ? new Date() : null } });
  });
  if (updated.nextFollowupId) {
    const next = await db.followUp.findUnique({ where: { id: updated.nextFollowupId }, include: { company: true, user: { select: { name: true, email: true } } } });
    if (next) {
      const when = next.scheduledAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      await queueEmail({ template: 'FOLLOWUP_ASSIGNED', to: next.user.email, subject: `Next follow-up scheduled: ${next.company.name}`, body: `Hello ${next.user.name},\n\nYour next follow-up has been scheduled.\nCompany: ${next.company.name}\nType: ${next.type.replaceAll('_', ' ')}\nScheduled for: ${when}\nPurpose: ${next.purpose}\n\nOpen the NexziByte CRM for complete details.`, companyId: next.companyId, contactId: next.contactId, opportunityId: next.opportunityId, sentBy: req.user.id });
      void processEmailQueue();
    }
  }
  if (p.data.requestQuotation) {
    const company = await db.company.findUnique({ where: { id: current.companyId }, select: { name: true } });
    const admins = await db.user.findMany({ where: { role: RoleName.ADMIN, isActive: true }, select: { id: true, email: true, name: true } });
    for (const admin of admins) {
      await notify(admin.id, 'Quotation preparation requested', `${req.user.name} completed the meeting with ${company?.name || 'the client'} and requested quotation preparation.`, 'QUOTATION_REQUESTED', '/pipeline');
      await queueEmail({ template: 'QUOTATION_REQUESTED', to: admin.email, subject: `Quotation requested: ${company?.name || 'Client opportunity'}`, body: `Hello ${admin.name},\n\n${req.user.name} completed the client meeting and requested quotation preparation.\nOutcome: ${p.data.outcome}\nCommercial notes: ${p.data.handoverNotes}\n\nOpen the opportunity pipeline to prepare, approve and send the quotation.`, companyId: current.companyId, contactId: current.contactId, opportunityId: current.opportunityId, sentBy: req.user.id });
    }
    await activity(current.companyId, 'QUOTATION_REQUESTED_AFTER_MEETING', { followUpId: current.id, opportunityId: current.opportunityId, completedBy: req.user.id }, req.user.id, 'FollowUp', current.id);
    void processEmailQueue();
  }
  await audit(req.user.id, 'FollowUp', updated.id, 'FOLLOWUP_COMPLETED_AND_RETURNED', { originalOwnerId: updated.originalOwnerId, outcome: updated.outcome });
  res.json(updated);
});

app.get('/api/companies/:id/timeline', auth, async (req: any, res) => {
  const company = await db.company.findUnique({ where: { id: req.params.id }, include: { industry: true, addresses: true, contacts: true, visits: { include: { user: { select: { id: true, name: true } }, photos: req.user.role === RoleName.ADMIN, requirement: true, opportunity: true }, orderBy: { checkInAt: 'desc' } }, opportunities: { include: { quotations: { include: { items: true } } } }, followups: { orderBy: { scheduledAt: 'desc' } }, emails: { orderBy: { createdAt: 'desc' } }, activities: { orderBy: { createdAt: 'desc' } } } });
  if (!company) return res.status(404).json({ message: 'Company not found' });
  res.json(company);
});
app.get('/api/opportunities', auth, async (req: any, res) => res.json(await db.opportunity.findMany({ where: req.user.role === RoleName.SALES_BD_EXECUTIVE ? { ownerId: req.user.id } : {}, include: { company: { include: { contacts: true } }, requirement: true, followups: true, quotations: { include: { items: true }, orderBy: { version: 'desc' } } }, orderBy: { updatedAt: 'desc' } })));
app.patch('/api/opportunities/:id/stage', auth, async (req: any, res) => {
  const p = z.object({ stage: z.nativeEnum(OpportunityStage), reason: z.string().optional() }).safeParse(req.body); if (!p.success) return res.status(400).json({ message: 'Select a valid opportunity stage' });
  const current = await db.opportunity.findUnique({ where: { id: req.params.id } }); if (!current) return res.status(404).json({ message: 'Opportunity not found' });
  if (req.user.role === RoleName.SALES_BD_EXECUTIVE && current.ownerId !== req.user.id) return res.status(403).json({ message: 'Not permitted' });
  if (['WON', 'LOST'].includes(p.data.stage)) return res.status(422).json({ message: 'Record the client quotation decision to close an opportunity as Won or Lost' });
  if (['WON', 'LOST'].includes(current.stage)) return res.status(409).json({ message: 'A closed opportunity cannot be moved manually' });
  const order = Object.values(OpportunityStage); if (!['WON', 'LOST'].includes(p.data.stage) && order.indexOf(p.data.stage) < order.indexOf(current.stage)) return res.status(422).json({ message: 'Opportunity stages cannot move backwards' });
  const updated = await db.opportunity.update({ where: { id: current.id }, data: { stage: p.data.stage } }); await activity(current.companyId, 'OPPORTUNITY_STAGE_CHANGED', { from: current.stage, to: updated.stage, reason: p.data.reason }, req.user.id, 'Opportunity', current.id); await audit(req.user.id, 'Opportunity', current.id, 'STAGE_CHANGED', { from: current.stage, to: updated.stage }); res.json(updated);
});
app.get('/api/emails', auth, async (req: any, res) => res.json(await db.emailLog.findMany({ where: req.user.role === RoleName.SALES_BD_EXECUTIVE ? { sentBy: req.user.id } : {}, include: { company: { select: { id: true, name: true } }, contact: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 250 })));
app.post('/api/emails/send', auth, async (req: any, res) => { const p = z.object({ companyId: z.string(), contactId: z.string().optional(), opportunityId: z.string().optional(), to: z.string().email(), template: z.enum(['THANK_YOU', 'REQUIREMENT_DISCUSSION', 'MEETING_CONFIRMATION', 'MEETING_REMINDER', 'DEMO_FOLLOWUP', 'QUOTATION_SUBMISSION', 'QUOTATION_FOLLOWUP', 'PAYMENT_FOLLOWUP']), subject: z.string().min(3), body: z.string().min(10) }).safeParse(req.body); if (!p.success) return res.status(400).json({ message: 'Complete the email details' }); const row = await queueEmail({ ...p.data, sentBy: req.user.id }); await activity(p.data.companyId, 'EMAIL_QUEUED', { emailId: row.id, template: p.data.template }, req.user.id, 'EmailLog', row.id); void processEmailQueue(); res.status(202).json(row); });
app.post('/api/webhooks/email', async (req, res) => {
  const secret = req.header('x-webhook-secret');
  if (!process.env.EMAIL_WEBHOOK_SECRET || secret !== process.env.EMAIL_WEBHOOK_SECRET) return res.status(401).json({ message: 'Invalid webhook signature' });
  const p = z.object({ providerMessageId: z.string(), status: z.enum(['DELIVERED', 'OPENED', 'BOUNCED', 'FAILED']), reason: z.string().max(1000).optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Invalid delivery event' });
  const rows = await db.emailLog.findMany({ where: { providerMessageId: p.data.providerMessageId } });
  await db.emailLog.updateMany({ where: { providerMessageId: p.data.providerMessageId }, data: { status: p.data.status, lastError: ['BOUNCED', 'FAILED'].includes(p.data.status) ? p.data.reason || `Provider reported ${p.data.status}` : undefined } });
  if (['BOUNCED', 'FAILED'].includes(p.data.status)) for (const row of rows) await flagVisitEmailProblem(row, p.data.reason || `Email provider reported ${p.data.status}`);
  res.status(204).end();
});
app.get('/api/notifications', auth, async (req: any, res) => res.json(await db.notification.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 100 })));
app.patch('/api/notifications/:id/read', auth, async (req: any, res) => { const row = await db.notification.findFirst({ where: { id: req.params.id, userId: req.user.id } }); if (!row) return res.status(404).json({ message: 'Notification not found' }); res.json(await db.notification.update({ where: { id: row.id }, data: { status: 'READ', readAt: new Date() } })); });
app.get('/api/activity-logs', auth, allow(...managerRoles, RoleName.MANAGEMENT_VIEWER), async (req: any, res) => {
  const { search = '', event = '', companyId = '', entity = '', from = '', to = '' } = req.query as Record<string, string>;
  const createdAt: any = {};
  if (from) createdAt.gte = new Date(`${from}T00:00:00.000Z`);
  if (to) createdAt.lte = new Date(`${to}T23:59:59.999Z`);
  const where: any = {
    ...(event ? { event } : {}), ...(companyId ? { companyId } : {}), ...(entity ? { entity } : {}),
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
    ...(search ? { OR: [{ event: { contains: search, mode: 'insensitive' } }, { entity: { contains: search, mode: 'insensitive' } }, { company: { name: { contains: search, mode: 'insensitive' } } }] } : {})
  };
  const [rows, events, companies, entities] = await Promise.all([
    db.activityLog.findMany({ where, include: { company: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 500 }),
    db.activityLog.findMany({ distinct: ['event'], select: { event: true }, orderBy: { event: 'asc' } }),
    db.company.findMany({ where: { activities: { some: {} } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.activityLog.findMany({ where: { entity: { not: null } }, distinct: ['entity'], select: { entity: true }, orderBy: { entity: 'asc' } })
  ]);
  const actorIds = [...new Set(rows.map(row => row.actorId).filter(Boolean))] as string[];
  const actors = actorIds.length ? await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, role: true } }) : [];
  const actorMap = new Map(actors.map(actor => [actor.id, actor]));
  res.json({ rows: rows.map(row => ({ ...row, actor: row.actorId ? actorMap.get(row.actorId) || null : null })), filters: { events: events.map(x => x.event), companies, entities: entities.map(x => x.entity).filter(Boolean) } });
});
app.get('/api/audit-logs', auth, allow(RoleName.ADMIN), async (_req, res) => res.json(await db.auditLog.findMany({ include: { actor: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: 'desc' }, take: 500 })));
app.get('/api/map/visits', auth, allow(...managerRoles, RoleName.MANAGEMENT_VIEWER), async (_req, res) => res.json(await db.visitLocation.findMany({ where: { capturedAt: { gte: new Date(Date.now() - 30 * 864e5) } }, include: { visit: { include: { company: { select: { id: true, name: true } }, user: { select: { id: true, name: true } } } } }, orderBy: { capturedAt: 'desc' }, take: 500 })));
app.post('/api/quotations', auth, allow(...quotationRoles), async (req: any, res) => {
  const p = z.object({ opportunityId: z.string(), validUntil: z.string().datetime().optional(), discussionOwnerId: z.string().optional(), discountPercent: z.number().min(0).max(100).default(0), taxPercent: z.number().min(0).max(100).default(18), paymentTerms: z.string().min(3).max(1000), deliveryTimeline: z.string().min(2).max(500), notes: z.string().max(2000).optional(), items: z.array(z.object({ description: z.string().min(2), quantity: z.number().positive(), unitPrice: z.number().nonnegative() })).min(1).max(25) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Add at least one valid quotation item' });
  const opp = await db.opportunity.findUnique({ where: { id: p.data.opportunityId }, include: { company: true } });
  if (!opp || ['WON', 'LOST'].includes(opp.stage)) return res.status(409).json({ message: 'Only an open opportunity can receive a quotation' });
  const latest = await db.quotation.findFirst({ where: { opportunityId: opp.id }, orderBy: { version: 'desc' }, select: { version: true } });
  const subtotal = p.data.items.reduce((n, x) => n + x.quantity * x.unitPrice, 0);
  const discountAmount = subtotal * p.data.discountPercent / 100;
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * p.data.taxPercent / 100;
  const total = taxableAmount + taxAmount;
  const quote = await db.$transaction(async tx => {
    const created = await tx.quotation.create({ data: { opportunityId: opp.id, version: (latest?.version || 0) + 1, createdBy: req.user.id, discussionOwnerId: p.data.discussionOwnerId || opp.ownerId, validUntil: p.data.validUntil ? new Date(p.data.validUntil) : null, status: 'DRAFT', subtotalAmount: subtotal, discountPercent: p.data.discountPercent, discountAmount, taxPercent: p.data.taxPercent, taxAmount, totalAmount: total, paymentTerms: p.data.paymentTerms, deliveryTimeline: p.data.deliveryTimeline, notes: p.data.notes, items: { create: p.data.items.map(x => ({ ...x, amount: x.quantity * x.unitPrice })) } }, include: { items: true } });
    await tx.opportunity.update({ where: { id: opp.id }, data: { stage: 'QUOTATION', estimatedValue: total } });
    await activity(opp.companyId, 'QUOTATION_CREATED', { quotationId: created.id, version: created.version, total, discussionOwnerId: created.discussionOwnerId }, req.user.id, 'Quotation', created.id, tx);
    return created;
  });
  const generated = await generateQuotationPdf({ id: quote.id, version: quote.version, company: opp.company.name, opportunity: opp.name, items: quote.items.map(x => ({ description: x.description, quantity: Number(x.quantity), unitPrice: Number(x.unitPrice), amount: Number(x.amount) })), subtotal, discountPercent: p.data.discountPercent, discountAmount, taxPercent: p.data.taxPercent, taxAmount, total, validUntil: quote.validUntil, paymentTerms: p.data.paymentTerms, deliveryTimeline: p.data.deliveryTimeline, notes: p.data.notes });
  const completed = await db.quotation.update({ where: { id: quote.id }, data: { documentUrl: generated.documentUrl }, include: { items: true } });
  await activity(opp.companyId, 'QUOTATION_PDF_GENERATED', { quotationId: quote.id, documentUrl: generated.documentUrl }, req.user.id, 'Quotation', quote.id);
  res.status(201).json(completed);
});
app.post('/api/quotations/:id/regenerate-pdf', auth, allow(...quotationRoles), async (req: any, res) => {
  const quote = await db.quotation.findUnique({
    where: { id: req.params.id },
    include: { items: true, opportunity: { include: { company: true } } }
  });
  if (!quote) return res.status(404).json({ message: 'Quotation not found' });
  const generated = await generateQuotationPdf({
    id: quote.id,
    version: quote.version,
    company: quote.opportunity.company.name,
    opportunity: quote.opportunity.name,
    items: quote.items.map(item => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      amount: Number(item.amount)
    })),
    subtotal: Number(quote.subtotalAmount || 0),
    discountPercent: Number(quote.discountPercent || 0),
    discountAmount: Number(quote.discountAmount || 0),
    taxPercent: Number(quote.taxPercent || 0),
    taxAmount: Number(quote.taxAmount || 0),
    total: Number(quote.totalAmount || 0),
    validUntil: quote.validUntil,
    paymentTerms: quote.paymentTerms || undefined,
    deliveryTimeline: quote.deliveryTimeline || undefined,
    notes: quote.notes || undefined
  });
  const updated = await db.quotation.update({ where: { id: quote.id }, data: { documentUrl: generated.documentUrl }, include: { items: true } });
  await activity(quote.opportunity.companyId, 'QUOTATION_PDF_REGENERATED', { quotationId: quote.id, documentUrl: generated.documentUrl }, req.user.id, 'Quotation', quote.id);
  res.json(updated);
});
app.patch('/api/quotations/:id/status', auth, allow(...quotationRoles), async (req: any, res) => {
  const p = z.object({ status: z.enum(['PENDING_APPROVAL', 'APPROVED', 'SENT']) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Invalid quotation status' });
  const current = await db.quotation.findUnique({ where: { id: req.params.id }, include: { opportunity: { include: { company: { include: { contacts: true } } } } } });
  if (!current) return res.status(404).json({ message: 'Quotation not found' });
  const allowed: Record<string, string[]> = { DRAFT: ['PENDING_APPROVAL'], PENDING_APPROVAL: ['APPROVED'], APPROVED: ['SENT'] };
  if (!allowed[current.status]?.includes(p.data.status)) return res.status(409).json({ message: `Quotation cannot move from ${current.status} to ${p.data.status}` });
  const responseToken = p.data.status === 'SENT' ? randomBytes(32).toString('base64url') : null;
  const quote = await db.$transaction(async tx => {
    const updated = await tx.quotation.update({ where: { id: current.id }, data: { status: p.data.status, approvedAt: p.data.status === 'APPROVED' ? new Date() : undefined, sentAt: p.data.status === 'SENT' ? new Date() : undefined, responseTokenHash: responseToken ? publicTokenHash(responseToken) : undefined, responseTokenExpiresAt: responseToken ? new Date(Date.now() + 30 * 864e5) : undefined, responseTokenUsedAt: responseToken ? null : undefined }, include: { items: true } });
    if (p.data.status === 'SENT') await tx.opportunity.update({ where: { id: current.opportunityId }, data: { stage: 'NEGOTIATION' } });
    await activity(current.opportunity.companyId, 'QUOTATION_STATUS_CHANGED', { quotationId: current.id, from: current.status, to: p.data.status }, req.user.id, 'Quotation', current.id, tx);
    return updated;
  });
  if (p.data.status === 'SENT') {
    const recipient = current.opportunity.company.contacts.find(x => x.email)?.email || current.opportunity.company.email;
    const owner = await db.user.findUnique({ where: { id: current.opportunity.ownerId }, select: { name: true } });
    const responseUrl = `${appUrl}/?quotationResponse=${encodeURIComponent(responseToken!)}`;
    if (recipient) await queueEmail({ template: 'QUOTATION_SUBMISSION', to: recipient, subject: `Quotation and approval request - ${current.opportunity.name}`, body: `Hello,\n\nQuotation version ${current.version} for ${current.opportunity.name} has been shared for your review.\nAmount: INR ${Number(current.totalAmount || 0).toLocaleString('en-IN')}\n${current.documentUrl ? `Quotation PDF: ${current.documentUrl}\n` : ''}${current.validUntil ? `Valid until: ${current.validUntil.toLocaleDateString('en-IN')}\n` : ''}Discussion owner: ${owner?.name || 'NexziByte team'}\n\nConfirm whether the budget is acceptable (YES, MAYBE or NO) using this secure form:\n${responseUrl}\n\nFor MAYBE or NO, a specific reason is mandatory so our team can arrange the correct commercial follow-up.`, companyId: current.opportunity.companyId, opportunityId: current.opportunityId, sentBy: req.user.id, attachmentUrl: current.documentUrl });
    void processEmailQueue();
  }
  res.json(quote);
});
app.get('/api/public/quotations/respond/:token', rateLimit(60, 15 * 60_000), async (req, res) => {
  const quote = await db.quotation.findUnique({ where: { responseTokenHash: publicTokenHash(req.params.token) }, include: { items: true, opportunity: { include: { company: true } } } });
  if (!quote || !quote.responseTokenExpiresAt || quote.responseTokenExpiresAt < new Date()) return res.status(410).json({ message: 'This quotation response link is invalid or has expired' });
  res.json({ company: quote.opportunity.company.name, opportunity: quote.opportunity.name, version: quote.version, totalAmount: quote.totalAmount, documentUrl: quote.documentUrl, validUntil: quote.validUntil, status: quote.status, submitted: Boolean(quote.responseTokenUsedAt), decision: quote.clientDecision, items: quote.items.map(x => ({ description: x.description, quantity: x.quantity, unitPrice: x.unitPrice, amount: x.amount })) });
});
app.post('/api/public/quotations/respond/:token', rateLimit(20, 15 * 60_000), async (req, res) => {
  const p = z.object({ decision: z.enum(['YES', 'NO', 'MAYBE']), reason: z.string().max(1500).optional(), feedback: z.string().max(2000).optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Select YES, MAYBE or NO' });
  if (p.data.decision !== 'YES' && (!p.data.reason || p.data.reason.trim().length < 10)) return res.status(422).json({ message: `A specific reason of at least 10 characters is required for ${p.data.decision}` });
  const quote = await db.quotation.findUnique({ where: { responseTokenHash: publicTokenHash(req.params.token) }, include: { opportunity: { include: { company: true } } } });
  if (!quote || !quote.responseTokenExpiresAt || quote.responseTokenExpiresAt < new Date()) return res.status(410).json({ message: 'This quotation response link is invalid or has expired' });
  if (quote.responseTokenUsedAt) return res.status(409).json({ message: 'This quotation response has already been submitted' });
  if (quote.status !== 'SENT') return res.status(409).json({ message: 'This quotation is no longer awaiting a response' });
  const now = new Date();
  const reason = (p.data.reason || 'Budget and quotation approved by client').trim();
  const followUpAt = p.data.decision === 'YES' ? new Date(Date.now() + 7 * 864e5) : new Date(Date.now() + 2 * 864e5);
  const followUpOwner = quote.discussionOwnerId || quote.opportunity.ownerId;
  await db.$transaction(async tx => {
    await tx.quotation.update({ where: { id: quote.id }, data: { status: p.data.decision === 'YES' ? 'ACCEPTED' : p.data.decision === 'NO' ? 'REJECTED' : 'REVISION_REQUESTED', clientDecision: p.data.decision, decisionReason: reason, clientFeedback: p.data.feedback, respondedAt: now, responseTokenUsedAt: now, acceptedAt: p.data.decision === 'YES' ? now : null, rejectedAt: p.data.decision === 'NO' ? now : null } });
    await tx.opportunity.update({ where: { id: quote.opportunityId }, data: p.data.decision === 'YES' ? { stage: 'WON', wonAt: now, lostAt: null, lostReason: null, reengageAt: null, probability: 100 } : p.data.decision === 'NO' ? { stage: 'LOST', lostAt: now, wonAt: null, lostReason: reason, reengageAt: followUpAt, probability: 0 } : { stage: 'DECISION_PENDING', probability: 60 } });
    await tx.followUp.create({ data: { companyId: quote.opportunity.companyId, opportunityId: quote.opportunityId, assignedTo: followUpOwner, originalOwnerId: quote.opportunity.ownerId, type: p.data.decision === 'YES' ? 'PAYMENT_FOLLOWUP' : 'QUOTATION_FOLLOWUP', scheduledAt: followUpAt, purpose: p.data.decision === 'YES' ? 'Project kickoff and payment discussion after accepted quotation' : `Urgent commercial discussion after ${p.data.decision} quotation response: ${reason}. Discuss negotiable budget or other objections and update commercial terms.`, status: p.data.decision === 'YES' ? 'SCHEDULED' : 'PENDING_ACCEPTANCE', createdBy: quote.createdBy } });
    await activity(quote.opportunity.companyId, 'CLIENT_QUOTATION_RESPONSE', { quotationId: quote.id, decision: p.data.decision, reason, feedback: p.data.feedback, automatic: true, followUpAt }, undefined, 'Quotation', quote.id, tx);
  });
  const stakeholders = await db.user.findMany({ where: { isActive: true, approvalStatus: ApprovalStatus.APPROVED, OR: [{ role: { in: quotationStakeholderRoles } }, { id: { in: [quote.opportunity.ownerId, quote.discussionOwnerId || quote.opportunity.ownerId] } }] }, select: { id: true, name: true, email: true, role: true } });
  const alertType = p.data.decision === 'YES' ? 'QUOTATION_WON' : 'HOT_QUOTATION_ALERT';
  const alertTitle = p.data.decision === 'YES' ? `Deal won: ${quote.opportunity.company.name}` : `HOT ALERT: quotation ${p.data.decision}`;
  const alertMessage = p.data.decision === 'YES' ? `The client accepted quotation v${quote.version}. Kickoff follow-up was created automatically.` : `${quote.opportunity.company.name} responded ${p.data.decision}. Reason: ${reason}. An urgent commercial follow-up needs acceptance.`;
  for (const person of stakeholders) {
    await notify(person.id, alertTitle, alertMessage, alertType, '/pipeline');
    await queueEmail({ template: p.data.decision === 'YES' ? 'QUOTATION_ACCEPTED' : 'QUOTATION_HOT_ALERT', to: person.email, subject: alertTitle, body: `Hello ${person.name},\n\nClient quotation response: ${p.data.decision}\nCompany: ${quote.opportunity.company.name}\nOpportunity: ${quote.opportunity.name}\nQuotation version: ${quote.version}\nAmount: INR ${Number(quote.totalAmount || 0).toLocaleString('en-IN')}\nReason: ${reason}\n${p.data.feedback ? `Additional feedback: ${p.data.feedback}\n` : ''}\n${p.data.decision === 'YES' ? 'The opportunity is now WON and a kickoff/payment follow-up was created automatically.' : 'This is a HOT commercial alert. An urgent quotation discussion follow-up was created for Sales/Technical coordination.'}`, companyId: quote.opportunity.companyId, opportunityId: quote.opportunityId, sentBy: quote.createdBy });
  }
  void processEmailQueue();
  res.json({ message: p.data.decision === 'YES' ? 'Thank you. The quotation has been approved.' : 'Thank you. Your response has been shared with our commercial team.', decision: p.data.decision });
});
app.post('/api/quotations/:id/client-decision', auth, async (req: any, res) => {
  const p = z.object({ decision: z.enum(['YES', 'NO', 'MAYBE']), reason: z.string().min(5), feedback: z.string().optional(), revisitAfter: z.enum(['30_DAYS', '90_DAYS', '180_DAYS', 'NEVER']).optional(), followUpAt: z.string().datetime().optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Select Yes, No or Maybe and record the client reason' });
  const quote = await db.quotation.findUnique({ where: { id: req.params.id }, include: { opportunity: { include: { company: true } } } });
  if (!quote) return res.status(404).json({ message: 'Quotation not found' });
  if (req.user.role === RoleName.SALES_BD_EXECUTIVE && quote.opportunity.ownerId !== req.user.id) return res.status(403).json({ message: 'Not permitted' });
  if (!['SENT', 'CLIENT_REVIEW', 'REVISION_REQUESTED'].includes(quote.status)) return res.status(409).json({ message: 'Send the quotation before recording the client decision' });
  if (p.data.decision === 'NO' && !p.data.revisitAfter) return res.status(422).json({ message: 'NO requires a re-engagement choice' });
  if (p.data.decision === 'MAYBE' && (!p.data.followUpAt || new Date(p.data.followUpAt).getTime() > Date.now() + 7 * 864e5)) return res.status(422).json({ message: 'MAYBE requires a follow-up within 7 days' });
  const now = new Date();
  const result = await db.$transaction(async tx => {
    const quotationStatus = p.data.decision === 'YES' ? 'ACCEPTED' : p.data.decision === 'NO' ? 'REJECTED' : 'REVISION_REQUESTED';
    const updated = await tx.quotation.update({ where: { id: quote.id }, data: { status: quotationStatus, clientDecision: p.data.decision, clientFeedback: p.data.feedback, decisionReason: p.data.reason, respondedAt: now, acceptedAt: p.data.decision === 'YES' ? now : null, rejectedAt: p.data.decision === 'NO' ? now : null } });
    let scheduledAt: Date | null = null; let type: any = 'QUOTATION_FOLLOWUP'; let purpose = '';
    if (p.data.decision === 'YES') {
      scheduledAt = new Date(Date.now() + 7 * 864e5); type = 'PAYMENT_FOLLOWUP'; purpose = 'Project kickoff and payment follow-up';
      await tx.opportunity.update({ where: { id: quote.opportunityId }, data: { stage: 'WON', wonAt: now, lostAt: null, lostReason: null, reengageAt: null, probability: 100 } });
    } else if (p.data.decision === 'NO') {
      const days = p.data.revisitAfter === '30_DAYS' ? 30 : p.data.revisitAfter === '90_DAYS' ? 90 : p.data.revisitAfter === '180_DAYS' ? 180 : 0;
      scheduledAt = days ? new Date(Date.now() + days * 864e5) : null; purpose = `Re-engage after declined quotation: ${p.data.reason}`;
      await tx.opportunity.update({ where: { id: quote.opportunityId }, data: { stage: 'LOST', lostAt: now, wonAt: null, lostReason: p.data.reason, reengageAt: scheduledAt, probability: 0 } });
    } else {
      scheduledAt = new Date(p.data.followUpAt!); purpose = `Quotation discussion: ${p.data.reason}`;
      await tx.opportunity.update({ where: { id: quote.opportunityId }, data: { stage: 'DECISION_PENDING', probability: 60 } });
    }
    if (scheduledAt) await tx.followUp.create({ data: { companyId: quote.opportunity.companyId, opportunityId: quote.opportunityId, assignedTo: quote.opportunity.ownerId, originalOwnerId: quote.opportunity.ownerId, type, scheduledAt, purpose, status: 'SCHEDULED', createdBy: req.user.id } });
    await activity(quote.opportunity.companyId, 'QUOTATION_CLIENT_DECISION', { quotationId: quote.id, decision: p.data.decision, reason: p.data.reason, feedback: p.data.feedback, scheduledAt }, req.user.id, 'Quotation', quote.id, tx);
    return updated;
  });
  const owner = await db.user.findUnique({ where: { id: quote.opportunity.ownerId }, select: { name: true, email: true } });
  if (owner) {
    await notify(quote.opportunity.ownerId, `Quotation response: ${p.data.decision}`, `${quote.opportunity.company.name}: ${p.data.reason}`, 'QUOTATION_DECISION', '/pipeline');
    await queueEmail({ template: 'QUOTATION_FOLLOWUP', to: owner.email, subject: `Quotation response: ${quote.opportunity.company.name} - ${p.data.decision}`, body: `Hello ${owner.name},\n\nClient response: ${p.data.decision}\nOpportunity: ${quote.opportunity.name}\nReason: ${p.data.reason}\n${p.data.feedback ? `Feedback: ${p.data.feedback}\n` : ''}\nThe opportunity and next follow-up have been updated automatically.`, companyId: quote.opportunity.companyId, opportunityId: quote.opportunityId, sentBy: req.user.id });
    void processEmailQueue();
  }
  res.json(result);
});
app.get('/api/team/activity', auth, allow(...managerRoles, RoleName.MANAGEMENT_VIEWER), async (_req, res) => res.json(await db.visit.findMany({ where: { visitDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }, include: { company: true, user: { select: { id: true, name: true, role: true } }, hourlyActivities: { orderBy: { capturedAt: 'desc' } } }, orderBy: { checkInAt: 'desc' } })));
app.get('/api/dashboard/summary', auth, async (req: any, res) => {
  const userScope = req.user.role === RoleName.SALES_BD_EXECUTIVE ? { userId: req.user.id } : {};
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [visits, companies, requirements, hot, followups, overdue, activeUsers, pendingRegistrations, assignments, activeVisits] = await Promise.all([
    db.visit.count({ where: { ...userScope, visitDate: { gte: today } } }), db.company.count(), db.requirement.count({ where: req.user.role === RoleName.SALES_BD_EXECUTIVE ? { visit: userScope } : {} }), db.lead.count({ where: { ...(req.user.role === RoleName.SALES_BD_EXECUTIVE ? { ownerId: req.user.id } : {}), status: 'HOT' } }), db.followUp.count({ where: { ...(req.user.role === RoleName.SALES_BD_EXECUTIVE ? { assignedTo: req.user.id } : {}), status: 'SCHEDULED', scheduledAt: { gte: today } } }), db.followUp.count({ where: { ...(req.user.role === RoleName.SALES_BD_EXECUTIVE ? { assignedTo: req.user.id } : {}), status: 'SCHEDULED', scheduledAt: { lt: new Date() } } }), db.user.count({ where: { isActive: true } }), db.user.count({ where: { approvalStatus: 'PENDING' } }), db.workAssignment.count({ where: req.user.role === RoleName.SALES_BD_EXECUTIVE ? { assignedToId: req.user.id } : {} }), db.visit.count({ where: { ...userScope, status: VisitStatus.OPEN } })
  ]); res.json({ visits, companies, requirements, hot, followups, overdue, activeUsers, pendingRegistrations, assignments, activeVisits });
});
app.get('/api/reports', auth, allow(RoleName.ADMIN, RoleName.SALES_HEAD, RoleName.BD_MANAGER, RoleName.MANAGEMENT_VIEWER), async (_req, res) => {
  const rows = await db.visit.groupBy({ by: ['userId', 'status'], _count: true, _avg: { durationMinutes: true } }); const users = await db.user.findMany({ select: { id: true, name: true, role: true } }); res.json(rows.map(r => ({ ...r, user: users.find(u => u.id === r.userId) })));
});
app.get('/api/master-data', auth, async (_req, res) => res.json({ industries: await db.industry.findMany({ orderBy: { name: 'asc' } }), leadSources: await db.leadSource.findMany({ orderBy: { name: 'asc' } }), projectTypes: await db.projectType.findMany({ orderBy: { name: 'asc' } }), salesUsers: await db.user.findMany({ where: { isActive: true, OR: [{ isSalesTeam: true }, { role: RoleName.TECHNICAL_TEAM }] }, select: { id: true, name: true, email: true, role: true } }) }));

app.use((err: any, _req: any, res: any, _next: any) => { console.error(err); res.status(500).json({ message: 'Something went wrong' }); });
const runScheduledJobs = async () => {
  const now = new Date(); const reminderWindow = new Date(Date.now() + 15 * 60_000);
  const reminders = await db.followUp.findMany({ where: { status: { in: ['SCHEDULED', 'RESCHEDULED'] }, remindedAt: null, scheduledAt: { gte: now, lte: reminderWindow } }, include: { company: true, user: { select: { name: true, email: true } } } });
  for (const f of reminders) {
    await notify(f.assignedTo, 'Follow-up due soon', `${f.company.name}: ${f.purpose}`, 'FOLLOWUP_REMINDER', '/followups');
    const when = f.scheduledAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
    const email = await queueEmail({ template: 'SALESPERSON_FOLLOWUP_REMINDER', to: f.user.email, subject: `Reminder: ${f.company.name} follow-up at ${when}`, body: `Hello ${f.user.name},\n\nYour follow-up is due shortly.\nCompany: ${f.company.name}\nType: ${f.type.replaceAll('_', ' ')}\nTime: ${when}\nPurpose: ${f.purpose}\n\nPlease update the outcome in the NexziByte CRM after completion.`, companyId: f.companyId, contactId: f.contactId, opportunityId: f.opportunityId, sentBy: f.originalOwnerId });
    await activity(f.companyId, 'SALESPERSON_FOLLOWUP_REMINDER_QUEUED', { followupId: f.id, emailId: email.id, assignedTo: f.assignedTo }, f.originalOwnerId, 'FollowUp', f.id);
    await db.followUp.update({ where: { id: f.id }, data: { remindedAt: now } });
  }
  const meetingReminders = await db.followUp.findMany({ where: { status: { in: ['SCHEDULED', 'RESCHEDULED'] }, type: { in: ['F2F', 'TEAMS', 'ZOOM', 'DEMO'] }, reminderEmailQueuedAt: null, scheduledAt: { gt: now, lte: new Date(Date.now() + 24 * 3600_000) } }, include: { company: true, contact: true, user: { select: { name: true, email: true } }, originalOwner: { select: { name: true, email: true } } } });
  for (const f of meetingReminders) {
    const recipient = f.contact?.email || f.company.email;
    if (recipient) {
      const when = f.scheduledAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });
      const recipients = new Set([recipient, f.user.email, f.originalOwner.email]);
      let email: any = null;
      for (const to of recipients) email = await queueEmail({ template: 'MEETING_REMINDER', to, subject: `Reminder: meeting on ${when}`, body: `This is a reminder that the meeting between ${f.company.name} and NexziByte Solutions is scheduled for ${when}.\nPurpose: ${f.purpose}\nAssigned representative: ${f.user.name}`, companyId: f.companyId, contactId: f.contactId, opportunityId: f.opportunityId, sentBy: f.originalOwnerId });
      await db.followUp.update({ where: { id: f.id }, data: { reminderEmailQueuedAt: now } });
      await activity(f.companyId, 'MEETING_REMINDER_QUEUED', { followupId: f.id, emailId: email?.id, recipientCount: recipients.size, scheduledAt: f.scheduledAt }, f.originalOwnerId, 'FollowUp', f.id);
    }
  }
  const overdue = await db.followUp.findMany({ where: { status: { in: ['SCHEDULED', 'RESCHEDULED'] }, overdueAt: null, scheduledAt: { lt: now } }, include: { company: true } });
  for (const f of overdue) { await notify(f.assignedTo, 'Overdue follow-up', `${f.company.name}: ${f.purpose}`, 'FOLLOWUP_OVERDUE', '/followups'); await db.followUp.update({ where: { id: f.id }, data: { overdueAt: now } }); }
  const stale = await db.visit.findMany({ where: { status: VisitStatus.OPEN, checkInAt: { lt: new Date(Date.now() - 12 * 3600_000) } } });
  for (const v of stale) { await db.visit.update({ where: { id: v.id }, data: { status: VisitStatus.CANCELLED, checkOutAt: now, autoClosedAt: now, remarks: 'Automatically closed after 12 hours without checkout' } }); await activity(v.companyId, 'VISIT_AUTO_CLOSED', { visitId: v.id }, undefined, 'Visit', v.id); }
  await processEmailQueue();
  await processAiCallQueue();
};
setInterval(() => void runScheduledJobs().catch(console.error), 15 * 60_000).unref();
setInterval(() => void processEmailQueue().catch(console.error), 60_000).unref();
if (process.env.QUOTATION_PREVIEW_ONLY !== 'true') app.listen(Number(process.env.PORT || 4000), () => {
    console.log(`API running on http://localhost:${process.env.PORT || 4000}`);
    void ensureDefaultBrochure().then(() => console.log(`Company brochure ready: ${brochurePath}`)).catch(console.error);
    void runScheduledJobs().catch(console.error);
  });
