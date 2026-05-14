function getNodemailer() {
    return require('nodemailer');
}

function getSmtpConfig() {
    const url = process.env.SMTP_URL || process.env.EMAIL_SMTP_URL || process.env.MAIL_SMTP_URL;
    if (url) return { url };

    const host = process.env.SMTP_HOST || process.env.EMAIL_SMTP_HOST || process.env.MAIL_SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || process.env.EMAIL_SMTP_PORT || process.env.MAIL_SMTP_PORT || 587);
    const user = process.env.SMTP_USER || process.env.EMAIL_SMTP_USER || process.env.MAIL_SMTP_USER;
    const pass = process.env.SMTP_PASS || process.env.EMAIL_SMTP_PASS || process.env.MAIL_SMTP_PASS;

    if (!host || !user || !pass) return null;

    return {
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
    };
}

function getFromAddress() {
    return process.env.EMAIL_FROM
        || process.env.SMTP_FROM
        || process.env.REPORT_EMAIL_FROM
        || process.env.SMTP_USER
        || process.env.EMAIL_SMTP_USER
        || process.env.MAIL_SMTP_USER;
}

function getApprovalRecipient() {
    return process.env.QUOTE_APPROVAL_EMAIL
        || process.env.SALES_EMAIL
        || process.env.EMAIL_TO
        || process.env.REPORT_EMAIL_TO
        || process.env.SEO_REPORT_EMAIL_TO
        || 'michael.marga@gmail.com';
}

function getBccRecipient() {
    return process.env.QUOTE_BCC_EMAIL
        || process.env.QUOTE_APPROVAL_EMAIL
        || process.env.SALES_EMAIL
        || process.env.EMAIL_TO
        || 'michael.marga@gmail.com';
}

async function sendMail(message) {
    const config = getSmtpConfig();
    const from = getFromAddress();
    if (!config || !from) {
        const error = new Error('SMTP is not configured for quotation email delivery');
        error.code = 'SMTP_NOT_CONFIGURED';
        throw error;
    }

    const nodemailer = getNodemailer();
    const transporter = config.url
        ? nodemailer.createTransport(config.url)
        : nodemailer.createTransport(config);

    return transporter.sendMail({
        from,
        ...message
    });
}

module.exports = {
    getApprovalRecipient,
    getBccRecipient,
    sendMail
};
