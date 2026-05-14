const crypto = require('crypto');
const admin = require('firebase-admin');
const { getBccRecipient, sendMail } = require('./lib/mailer');

function getFirebaseApp() {
    if (admin.apps.length === 0) {
        const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: 'sah-spiritual-journal'
        });
    }
    return admin.app();
}

function html(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'text/html; charset=utf-8'
        },
        body
    };
}

function clean(value) {
    return String(value || '').trim();
}

function tokenHash(token) {
    return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function timingSafeEqual(a, b) {
    const left = Buffer.from(String(a || ''), 'hex');
    const right = Buffer.from(String(b || ''), 'hex');
    if (left.length !== right.length) return false;
    return crypto.timingSafeEqual(left, right);
}

function page(title, message) {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
body{font-family:Arial,sans-serif;background:#f6f8fb;color:#172033;margin:0;padding:40px}
.card{max-width:680px;margin:0 auto;background:#fff;border:1px solid #d9e2ee;border-radius:8px;padding:28px;box-shadow:0 12px 30px rgba(16,24,39,.1)}
h1{margin:0 0 12px;color:#0055a5}
p{line-height:1.6}
a{color:#0055a5}
</style>
</head>
<body><main class="card"><h1>${title}</h1><p>${message}</p><p><a href="/admin/inquiries.html">Open inquiries</a></p></main></body>
</html>`;
}

exports.handler = async (event) => {
    try {
        const action = clean(event.queryStringParameters?.action).toLowerCase();
        const leadId = clean(event.queryStringParameters?.leadId);
        const token = clean(event.queryStringParameters?.token);
        if (!['approve', 'reject'].includes(action) || !leadId || !token) {
            return html(400, page('Invalid request', 'The approval link is missing required information.'));
        }

        const app = getFirebaseApp();
        const db = admin.firestore(app);
        const ref = db.collection('website_inquiries').doc(leadId);
        const snap = await ref.get();
        if (!snap.exists) return html(404, page('Lead not found', 'This quote approval link does not match an existing inquiry.'));

        const lead = snap.data();
        const approval = lead.quoteApproval || {};
        const draft = lead.quoteDraft || {};

        if (!approval.tokenHash || !timingSafeEqual(tokenHash(token), approval.tokenHash)) {
            return html(403, page('Approval denied', 'This approval link is invalid or expired.'));
        }

        if (approval.status === 'approved' || approval.status === 'sent') {
            return html(200, page('Already approved', 'This quotation was already approved or sent.'));
        }

        if (action === 'reject') {
            await ref.set({
                quoteApproval: {
                    ...approval,
                    status: 'rejected',
                    rejectedAt: new Date().toISOString()
                },
                leadStatus: 'quote_draft_rejected',
                nextAction: 'Mike rejected the draft quotation; revise manually.',
                updatedAt: new Date().toISOString()
            }, { merge: true });
            return html(200, page('Draft rejected', 'The draft quotation was marked rejected. It was not sent to the prospect.'));
        }

        if (!lead.email) {
            return html(400, page('Missing prospect email', 'The quotation cannot be sent because the inquiry has no prospect email address.'));
        }

        await sendMail({
            to: lead.email,
            bcc: getBccRecipient(),
            subject: draft.subject || 'Marga Enterprises rental quotation',
            text: draft.prospectBody || 'Thank you for your inquiry. Marga Enterprises will follow up with your quotation.'
        });

        await ref.set({
            quoteApproval: {
                ...approval,
                status: 'sent',
                approvedAt: new Date().toISOString(),
                sentAt: new Date().toISOString(),
                sentTo: lead.email,
                bcc: getBccRecipient()
            },
            leadStatus: 'quotation_sent',
            nextAction: 'Quotation approved by Mike and sent to prospect.',
            updatedAt: new Date().toISOString()
        }, { merge: true });

        return html(200, page('Quotation sent', `The quotation was sent to ${lead.email} and BCC was added for Mike.`));
    } catch (error) {
        console.error('Quote approval failed:', error);
        return html(500, page('Quotation action failed', error.message));
    }
};
