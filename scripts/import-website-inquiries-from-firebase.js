#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { withClient } = require('../netlify/functions/lib/margabase-pg');
const {
    ensureWebsiteInquiriesTable,
    saveInquiry
} = require('../netlify/functions/lib/website-inquiries-store');

function getFirebaseApp() {
    if (admin.apps.length > 0) {
        return admin.app();
    }

    const localServiceAccountPath = path.join(process.cwd(), 'service-account-key.json');
    if (!fs.existsSync(localServiceAccountPath)) {
        throw new Error(`Missing Firebase service account: ${localServiceAccountPath}`);
    }

    const serviceAccount = JSON.parse(fs.readFileSync(localServiceAccountPath, 'utf8'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || 'sah-spiritual-journal'
    });
    return admin.app();
}

async function main() {
    await withClient(async (client) => {
        await ensureWebsiteInquiriesTable(client);
    });

    const db = admin.firestore(getFirebaseApp());
    const snapshot = await db.collection('website_inquiries').get();

    let imported = 0;
    for (const doc of snapshot.docs) {
        await saveInquiry(doc.id, doc.data());
        imported += 1;
    }

    console.log(`Imported ${imported} website inquiries from Firebase into Postgres.`);
}

main().catch((error) => {
    console.error('Inquiry import failed:', error.message);
    process.exit(1);
});
