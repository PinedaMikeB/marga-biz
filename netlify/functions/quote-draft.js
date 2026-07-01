const crypto = require('crypto');
const { buildDraftQuotation, transcriptText } = require('./lib/sales-knowledge');
const { getApprovalRecipient, sendMail } = require('./lib/mailer');
const { getInquiry, mergeInquiry, tokenHash } = require('./lib/website-inquiries-store');

function json(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    };
}

function clean(value) {
    return String(value || '').trim();
}

function getBaseUrl(event) {
    const configured = clean(process.env.SITE_URL || process.env.URL);
    if (configured) return configured.replace(/\/$/, '');
    const host = event.headers?.host || event.headers?.Host || 'marga.biz';
    const proto = event.headers?.['x-forwarded-proto'] || 'https';
    return `${proto}://${host}`;
}

function buildApprovalEmail({ leadId, lead, draft, token, baseUrl }) {
    const approveUrl = `${baseUrl}/.netlify/functions/quote-approval?action=approve&leadId=${encodeURIComponent(leadId)}&token=${encodeURIComponent(token)}`;
    const rejectUrl = `${baseUrl}/.netlify/functions/quote-approval?action=reject&leadId=${encodeURIComponent(leadId)}&token=${encodeURIComponent(token)}`;
    const transcript = transcriptText(lead.transcript).slice(0, 6000) || 'No transcript captured yet.';

    return [
        'New Talk to Sales quotation draft needs approval.',
        '',
        `Lead ID: ${leadId}`,
        `Name: ${lead.fullName || 'N/A'}`,
        `Company: ${lead.company || 'N/A'}`,
        `Email: ${lead.email || 'N/A'}`,
        `Phone: ${lead.phone || lead.rawPhone || 'N/A'}`,
        `Service: ${lead.service || 'N/A'}`,
        '',
        'Internal notes:',
        draft.internalNotes,
        '',
        'Draft email to prospect:',
        '---',
        `Subject: ${draft.subject}`,
        '',
        draft.prospectBody,
        '---',
        '',
        `Approve and send: ${approveUrl}`,
        `Reject draft: ${rejectUrl}`,
        '',
        'Transcript:',
        transcript
    ].join('\n');
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return json(200, {});
    if (event.httpMethod !== 'POST') return json(405, { success: false, error: 'Method not allowed' });

    try {
        const body = JSON.parse(event.body || '{}');
        const leadId = clean(body.leadId);
        if (!leadId) return json(400, { success: false, error: 'leadId is required' });

        const storedLead = await getInquiry(leadId);
        if (!storedLead) return json(404, { success: false, error: 'Lead not found' });
        const lead = {
            ...storedLead,
            transcript: Array.isArray(body.transcript) ? body.transcript : storedLead.transcript,
            usage: body.usage || storedLead.usage
        };
        const draft = buildDraftQuotation(lead);
        const token = crypto.randomBytes(24).toString('hex');
        const approval = {
            status: 'pending',
            tokenHash: tokenHash(token),
            requestedAt: new Date().toISOString(),
            approvalEmailTo: getApprovalRecipient()
        };

        await mergeInquiry(leadId, {
            transcript: lead.transcript || storedLead.transcript || [],
            usage: lead.usage || storedLead.usage || null,
            quoteDraft: draft,
            quoteApproval: approval,
            leadStatus: 'quote_draft_pending_approval',
            nextAction: 'Mike approval required before sending quotation to prospect',
            updatedAt: new Date().toISOString()
        });

        const emailBody = buildApprovalEmail({
            leadId,
            lead,
            draft,
            token,
            baseUrl: getBaseUrl(event)
        });

        let emailSent = false;
        let emailWarning = '';
        try {
            await sendMail({
                to: getApprovalRecipient(),
                subject: `[Marga Quote Approval] ${draft.subject}`,
                text: emailBody
            });
            emailSent = true;
        } catch (error) {
            emailWarning = error.message;
            console.warn('Quote approval email failed:', error);
            await mergeInquiry(leadId, {
                quoteApproval: {
                    ...approval,
                    emailWarning
                },
                nextAction: 'Quote draft saved, but approval email could not be sent. Check SMTP configuration.',
                updatedAt: new Date().toISOString()
            });
        }

        return json(200, {
            success: true,
            leadId,
            emailSent,
            emailWarning,
            draft
        });
    } catch (error) {
        console.error('Quote draft failed:', error);
        return json(500, { success: false, error: error.message });
    }
};
