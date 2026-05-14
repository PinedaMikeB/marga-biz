const SALES_STYLE_INSTRUCTIONS = [
    'Use Mike Pineda sales style: qualify before offering, understand the pain, and recommend only if rental benefits the customer.',
    'Ask why they are requesting a quotation: existing rental issue, bad provider experience, new office, curiosity, urgent replacement, or real purchasing timeline.',
    'Ask what they currently use: brand/model, rented or purchased, current monthly cost, monthly volume, and what is frustrating them.',
    'If they share frustration, validate it naturally. Many Marga customers moved because of slow service, toner delays, billing confusion, downtime, or poor follow-up.',
    'After understanding the pain, explain the managed-care app: quick issue reports, usage monitoring, bill and delivery visibility, assigned technician or messenger follow-up, performance reviews, and customer approval before closing service schedules.',
    'If monthly volume is very low, such as around 300 pages, warn honestly that rental may be expensive and buying a small printer may be better.',
    'For copy-center plans, ask whether it is a side income for an existing store or the main reason they will rent a space. Warn them to study volume carefully if rental will be the main business cost.',
    'Do not invent exact inventory or final availability. Pricing may be discussed as a draft based on the internal guide, but official quotation must wait for Mike approval.'
];

const PRICING_PLANS = [
    {
        code: 'Essential A',
        category: 'A4/Legal Mono/Black Printer',
        monthly: 1250,
        included: '1,500 pages',
        excess: 'PHP 0.83/page',
        speed: '30 ppm',
        contract: '12 months',
        delivery: 1000,
        deposit: 1250,
        initialCashOut: 2250,
        bestFor: 'light black-only office printer rental'
    },
    {
        code: 'Elite A',
        category: 'A4/Legal Mono/Black Printer',
        monthly: 1625,
        included: '2,500 pages',
        excess: 'PHP 0.65/page',
        speed: '30 ppm',
        contract: '12 months',
        delivery: 1000,
        deposit: 1625,
        initialCashOut: 2625,
        bestFor: 'higher light-volume black-only office printing'
    },
    {
        code: 'Infinite A',
        category: 'A4/Legal Mono/Black Printer',
        monthly: 2900,
        included: 'unlimited prints',
        excess: 'none',
        speed: '30 ppm',
        contract: '12 months',
        delivery: 1000,
        deposit: 2900,
        initialCashOut: 3900,
        bestFor: 'steady black-only A4/legal printing'
    },
    {
        code: 'Essential B',
        category: 'A4/Legal Color Printer',
        monthly: 2500,
        included: 'unlimited prints',
        excess: 'none listed',
        speed: '15 ppm',
        contract: '10 months',
        delivery: 1000,
        deposit: 2500,
        initialCashOut: 3500,
        bestFor: 'entry A4/legal color printing'
    },
    {
        code: 'Elite B',
        category: 'A4/Legal Color Printer',
        monthly: 3000,
        included: 'unlimited prints',
        excess: 'none listed',
        speed: '27 ppm',
        contract: '8 months',
        delivery: 1000,
        deposit: 3000,
        initialCashOut: 4000,
        bestFor: 'faster A4/legal color printing'
    },
    {
        code: 'Infinite B',
        category: 'A4/Legal Color Printer',
        monthly: 3500,
        included: 'unlimited prints',
        excess: 'none listed',
        speed: '35 ppm',
        contract: '6 months',
        delivery: 1000,
        deposit: 3500,
        initialCashOut: 4500,
        bestFor: 'higher-speed A4/legal color printing'
    },
    {
        code: 'Essential C',
        category: 'A3 Color Printer',
        monthly: 3900,
        included: 'unlimited prints',
        excess: 'none listed',
        speed: '27 ppm',
        contract: '10 months',
        delivery: 1000,
        deposit: 5000,
        initialCashOut: 6000,
        bestFor: 'entry A3 color printer rental'
    },
    {
        code: 'Elite C',
        category: 'A3 Color Printer',
        monthly: 4200,
        included: 'unlimited prints',
        excess: 'none listed',
        speed: '35 ppm',
        contract: '8 months',
        delivery: 1000,
        deposit: 5500,
        initialCashOut: 6500,
        bestFor: 'faster A3 color printer rental'
    },
    {
        code: 'Infinite C',
        category: 'A3 Color Printer',
        monthly: 4900,
        included: 'unlimited prints',
        excess: 'none listed',
        speed: '40 ppm',
        contract: '6 months',
        delivery: 1000,
        deposit: 6200,
        initialCashOut: 7200,
        bestFor: 'highest A3 color printer speed in the guide'
    },
    {
        code: 'Essential D',
        category: 'A3 Color Laser Copier',
        monthly: 4550,
        included: '3,000 black pages and 400 color pages',
        excess: 'mono PHP 0.65/page, color PHP 6.50/page',
        speed: '35 ppm',
        contract: '8 months',
        delivery: 1000,
        deposit: 5000,
        initialCashOut: 6000,
        bestFor: 'shared copier needs with mixed black and color use'
    },
    {
        code: 'Elite D',
        category: 'A3 Color Laser Copier',
        monthly: 5530,
        included: '4,600 black pages and 500 color pages',
        excess: 'mono PHP 0.55/page, color PHP 6.00/page',
        speed: '35 ppm',
        contract: '10 months',
        delivery: 1000,
        deposit: 5500,
        initialCashOut: 6500,
        bestFor: 'higher mixed-volume copier use'
    },
    {
        code: 'Infinite D',
        category: 'A3 Color Laser Copier',
        monthly: 6000,
        included: '7,000 black pages and 500 color pages',
        excess: 'mono PHP 0.50/page, color PHP 5.00/page',
        speed: '35 ppm',
        contract: '12 months',
        delivery: 1000,
        deposit: 6200,
        initialCashOut: 7200,
        bestFor: 'heavier mixed black/color copier use'
    },
    {
        code: 'Essential E',
        category: 'Monochrome/Black Laser Copier',
        monthly: 4225,
        included: '6,500 pages',
        excess: 'PHP 0.65/page',
        speed: '28 ppm',
        contract: '24 months',
        delivery: 1500,
        deposit: 4550,
        initialCashOut: 6050,
        bestFor: 'entry black-only A3 copier rental'
    },
    {
        code: 'Elite E',
        category: 'Monochrome/Black Laser Copier',
        monthly: 4800,
        included: '8,000 pages',
        excess: 'PHP 0.60/page',
        speed: '28 ppm',
        contract: '24 months',
        delivery: 1500,
        deposit: 5600,
        initialCashOut: 7100,
        bestFor: 'higher black-only copier volume'
    },
    {
        code: 'Infinite E',
        category: 'Monochrome/Black Laser Copier',
        monthly: 5500,
        included: '10,000 pages',
        excess: 'PHP 0.55/page',
        speed: '28 ppm',
        contract: '24 months',
        delivery: 1500,
        deposit: 6500,
        initialCashOut: 8000,
        bestFor: 'heavy black-only copier volume'
    }
];

const CONTRACT_TERMS = [
    'Marga provides parts, toner or ink, drum where applicable, toner delivery, cleaning, repair, and onsite labor under the approved rental agreement.',
    'Rental charges start from installation date based on delivery receipt and/or field service report.',
    'Equipment, spare parts, and consumables remain Marga property.',
    'Accounts are usually payable within three to seven days from billing or invoice receipt, depending on the approved template.',
    'Early termination can carry a PHP 5,000 pre-termination fee unless Mike approves different terms.',
    'Security deposit may be applied to unpaid charges or refunded after reconciliation.'
];

function money(value) {
    return `PHP ${Number(value || 0).toLocaleString('en-PH')}`;
}

function transcriptText(transcript = []) {
    return transcript
        .map((item) => `${item.label || item.role || 'Speaker'}: ${item.text || ''}`)
        .join('\n')
        .trim();
}

function extractVolume(text) {
    const normalized = String(text || '').replace(/,/g, '');
    const matches = [...normalized.matchAll(/\b(\d{3,6})\s*(?:pages|page|copies|copy|prints|print)?\b/gi)];
    const values = matches.map((match) => Number(match[1])).filter((value) => value >= 100 && value <= 100000);
    if (!values.length) return null;
    return Math.max(...values);
}

function choosePlan(lead = {}) {
    const combined = [
        lead.service,
        lead.message,
        transcriptText(lead.transcript)
    ].join(' ').toLowerCase();
    const volume = extractVolume(combined);
    const wantsColor = /\bcolor|colored|colour\b/.test(combined);
    const wantsA3 = /\ba3\b/.test(combined);
    const wantsCopier = /\bcopier|copy|xerox|photocop/i.test(combined) || String(lead.service || '').toLowerCase().includes('copier');
    const wantsUnlimited = /unlimited|print all you can|high volume/.test(combined);

    if (volume && volume < 1000 && !wantsUnlimited) {
        return {
            plan: PRICING_PLANS[0],
            confidence: 'low',
            warning: 'Volume appears low. Mike should warn that rental may be expensive versus buying a small printer.'
        };
    }

    if (wantsCopier && wantsColor) {
        if (volume && volume >= 6500) return { plan: PRICING_PLANS.find((plan) => plan.code === 'Infinite D'), confidence: 'medium' };
        if (volume && volume >= 4500) return { plan: PRICING_PLANS.find((plan) => plan.code === 'Elite D'), confidence: 'medium' };
        return { plan: PRICING_PLANS.find((plan) => plan.code === 'Essential D'), confidence: 'medium' };
    }

    if (wantsCopier || wantsA3) {
        if (wantsColor) return { plan: PRICING_PLANS.find((plan) => plan.code === 'Essential D'), confidence: 'medium' };
        if (volume && volume >= 9000) return { plan: PRICING_PLANS.find((plan) => plan.code === 'Infinite E'), confidence: 'medium' };
        if (volume && volume >= 7500) return { plan: PRICING_PLANS.find((plan) => plan.code === 'Elite E'), confidence: 'medium' };
        return { plan: PRICING_PLANS.find((plan) => plan.code === 'Essential E'), confidence: 'medium' };
    }

    if (wantsColor) {
        if (wantsA3) return { plan: PRICING_PLANS.find((plan) => plan.code === 'Essential C'), confidence: 'medium' };
        if (wantsUnlimited || (volume && volume >= 5000)) return { plan: PRICING_PLANS.find((plan) => plan.code === 'Infinite B'), confidence: 'medium' };
        return { plan: PRICING_PLANS.find((plan) => plan.code === 'Essential B'), confidence: 'medium' };
    }

    if (wantsUnlimited || (volume && volume >= 3000)) return { plan: PRICING_PLANS.find((plan) => plan.code === 'Infinite A'), confidence: 'medium' };
    if (volume && volume >= 2000) return { plan: PRICING_PLANS.find((plan) => plan.code === 'Elite A'), confidence: 'medium' };
    return { plan: PRICING_PLANS.find((plan) => plan.code === 'Essential A'), confidence: volume ? 'medium' : 'low' };
}

function consultantKnowledgeText() {
    return [
        'Sales style:',
        ...SALES_STYLE_INSTRUCTIONS.map((line) => `- ${line}`),
        '',
        'Internal pricing guide summary:',
        ...PRICING_PLANS.map((plan) => `- ${plan.code}: ${plan.category}, ${money(plan.monthly)}/month, includes ${plan.included}, excess ${plan.excess}, ${plan.contract}, initial cash-out ${money(plan.initialCashOut)}.`),
        '',
        'Contract terms:',
        ...CONTRACT_TERMS.map((line) => `- ${line}`)
    ].join('\n');
}

function buildDraftQuotation(lead = {}) {
    const selected = choosePlan(lead);
    const plan = selected.plan || PRICING_PLANS[0];
    const volume = extractVolume([lead.message, transcriptText(lead.transcript)].join(' '));
    const warning = selected.warning || (!volume ? 'Monthly volume was not clearly captured. Mike should confirm volume before approving.' : '');
    const prospectName = lead.fullName || 'there';
    const company = lead.company || 'your office';
    const service = lead.service || 'copier/printer rental';

    const subject = `Marga ${service} quotation draft for ${company}`;
    const prospectBody = [
        `Hi ${prospectName},`,
        '',
        `Thank you for discussing your ${service} requirement with Marga Enterprises.`,
        '',
        `Based on the initial details, the recommended starting option is ${plan.code} - ${plan.category}.`,
        '',
        `Draft quotation details:`,
        `- Monthly rental: ${money(plan.monthly)}`,
        `- Included volume: ${plan.included}`,
        `- Excess rate: ${plan.excess}`,
        `- Contract duration: ${plan.contract}`,
        `- Refundable deposit: ${money(plan.deposit)}`,
        `- Delivery and installation: ${money(plan.delivery)}`,
        `- Initial cash-out: ${money(plan.initialCashOut)}`,
        '',
        'Included support: maintenance, onsite repair, toner/ink where applicable, replacement parts, and service support based on the approved agreement.',
        '',
        'This quotation is subject to final availability check, exact unit assignment, site/access review, and approval of the final agreement.',
        '',
        'Best regards,',
        'Marga Enterprises'
    ].join('\n');

    const internalNotes = [
        `Plan confidence: ${selected.confidence}`,
        warning ? `Warning/check: ${warning}` : '',
        volume ? `Detected monthly volume: ${volume}` : 'Detected monthly volume: not captured',
        `Recommended plan rationale: ${plan.bestFor}`,
        'Before approving, confirm customer pain, current setup, location, timeline, and whether rental is genuinely better than buying.'
    ].filter(Boolean).join('\n');

    return {
        subject,
        prospectBody,
        internalNotes,
        plan,
        warning,
        createdAt: new Date().toISOString()
    };
}

module.exports = {
    SALES_STYLE_INSTRUCTIONS,
    PRICING_PLANS,
    CONTRACT_TERMS,
    buildDraftQuotation,
    choosePlan,
    consultantKnowledgeText,
    money,
    transcriptText
};
