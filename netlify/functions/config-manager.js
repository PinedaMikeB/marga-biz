/**
 * Marga AI - Configuration Manager
 * Central config storage in Firebase, AI-readable and writable
 * 
 * Config Sections:
 * - ai: Model settings, prompts, behaviors
 * - site: Website content, contact info, CTAs
 * - seo: Keywords, competitors, schedules
 * - history: Change log for all modifications
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const getFirebaseApp = () => {
    if (admin.apps.length === 0) {
        const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: 'sah-spiritual-journal'
        });
    }
    return admin.app();
};

/**
 * Default configuration schema
 */
const DEFAULT_CONFIG = {
    ai: {
        model: 'claude-sonnet-4-5-20250514',
        availableModels: [
            { id: 'claude-opus-4-5-20250514', name: 'Claude Opus 4.5', description: 'Most capable, complex analysis', costTier: 'high' },
            { id: 'claude-sonnet-4-5-20250514', name: 'Claude Sonnet 4.5', description: 'Balanced, daily tasks', costTier: 'medium' },
            { id: 'claude-haiku-4-5-20250514', name: 'Claude Haiku 4.5', description: 'Fast & cheap, simple queries', costTier: 'low' }
        ],
        smartRouting: true,
        routingRules: {
            simple: 'claude-haiku-4-5-20250514',
            standard: 'claude-sonnet-4-5-20250514',
            complex: 'claude-opus-4-5-20250514'
        },
        temperature: 0.7,
        maxTokens: 4000,
        systemPrompt: `You are an SEO specialist and web manager for Marga Enterprises, a B2B printer and copier rental company in Metro Manila, Philippines.

Key services: printer rental, copier rental, print-all-you-can plans
Target areas: Metro Manila, Cavite, Laguna, Bulacan, Batangas
Current ranking: #2 for "printer rental philippines" (protect this!)

Your capabilities:
- Analyze SEO data and provide recommendations
- Create and edit landing pages
- Update website content and settings
- Monitor competitors
- Track keyword rankings

Always be helpful, concise, and action-oriented.`,
        additionalInstructions: '',
        behaviors: {
            autoApproveMinor: true,
            notifyOnRankDrop: true,
            suggestContentWeekly: true,
            autoMonthlyReport: false
        }
    },
    
    seo: {
        competitors: [
            { domain: 'jmti.com.ph', notes: 'Main competitor, ranks #1', addedAt: new Date().toISOString() }
        ],
        keywords: {
            primary: ['printer rental philippines', 'copier rental manila'],
            growth: ['printer rental bgc', 'printer rental makati', 'print all you can manila', 'copier for rent']
        },
        schedules: {
            dailySnapshot: { enabled: true, time: '06:00', timezone: 'Asia/Manila' },
            competitorCheck: { enabled: true, schedule: 'weekly', day: 'monday', time: '08:00' },
            weeklyReport: { enabled: true, day: 'sunday', time: '21:00' },
            keywordAlerts: { enabled: false, time: '07:00' },
            contentGapAnalysis: { enabled: true, schedule: 'monthly', day: 1 }
        }
    },
    
    site: {
        contact: {
            phone: '0917-123-4567',
            email: 'inquiry@marga.biz',
            address: 'Metro Manila, Philippines',
            hours: 'Mon-Sat 8AM-6PM'
        },
        homepage: {
            headline: 'Printer & Copier Rental Philippines',
            subheadline: 'Same-day delivery in Metro Manila',
            ctaText: 'Get Instant Quote',
            ctaLink: '/quote/'
        },
        pricing: {
            showPrices: false,
            startingText: 'Starting at ₱2,500/month',
            disclaimer: 'Prices vary by model and rental terms'
        },
        serviceAreas: ['Metro Manila', 'Cavite', 'Laguna', 'Bulacan', 'Batangas'],
        branding: {
            primaryColor: '#1e40af',
            companyName: 'Marga Enterprises'
        }
    },
    
    notifications: {
        email: '',
        preferences: {
            rankingDrops: true,
            tasksComplete: true,
            dailyDigest: false,
            competitorAlerts: true
        }
    }
};

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => 
        current && current[key] !== undefined ? current[key] : undefined, obj);
}

/**
 * Set nested value in object using dot notation
 */
function setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
        if (current[key] === undefined) current[key] = {};
        return current[key];
    }, obj);
    target[lastKey] = value;
    return obj;
}

/**
 * Get configuration
 */
async function getConfig(db, path = null) {
    const configDoc = await db.collection('marga_config').doc('settings').get();
    
    let config;
    if (!configDoc.exists) {
        // Initialize with defaults
        await db.collection('marga_config').doc('settings').set(DEFAULT_CONFIG);
        config = DEFAULT_CONFIG;
    } else {
        config = configDoc.data();
    }
    
    if (path) {
        return getNestedValue(config, path);
    }
    return config;
}

/**
 * Update configuration
 */
async function updateConfig(db, path, value, source = 'api') {
    // Get current config
    const configDoc = await db.collection('marga_config').doc('settings').get();
    let config = configDoc.exists ? configDoc.data() : { ...DEFAULT_CONFIG };
    
    // Get old value for history
    const oldValue = getNestedValue(config, path);
    
    // Update value
    setNestedValue(config, path, value);
    
    // Save config
    await db.collection('marga_config').doc('settings').set(config);
    
    // Log change to history
    await logChange(db, {
        type: 'config_update',
        path: path,
        oldValue: oldValue,
        newValue: value,
        source: source,
        timestamp: new Date().toISOString()
    });
    
    return { path, oldValue, newValue: value };
}

/**
 * Log change to history
 */
async function logChange(db, change) {
    const historyRef = db.collection('marga_history').doc();
    await historyRef.set({
        ...change,
        id: historyRef.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return historyRef.id;
}

/**
 * Get change history
 */
async function getHistory(db, limit = 50, type = null) {
    let query = db.collection('marga_history')
        .orderBy('createdAt', 'desc')
        .limit(limit);
    
    if (type) {
        query = query.where('type', '==', type);
    }
    
    const snapshot = await query.get();
    const history = [];
    snapshot.forEach(doc => history.push({ id: doc.id, ...doc.data() }));
    return history;
}

/**
 * Reset config section to defaults
 */
async function resetConfig(db, section = null) {
    if (section) {
        const defaultValue = DEFAULT_CONFIG[section];
        if (!defaultValue) {
            throw new Error(`Unknown config section: ${section}`);
        }
        return await updateConfig(db, section, defaultValue, 'reset');
    } else {
        await db.collection('marga_config').doc('settings').set(DEFAULT_CONFIG);
        await logChange(db, {
            type: 'config_reset',
            path: 'all',
            timestamp: new Date().toISOString()
        });
        return DEFAULT_CONFIG;
    }
}

/**
 * Main handler
 */
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const app = getFirebaseApp();
        const db = admin.firestore(app);
        
        const params = event.queryStringParameters || {};
        const action = params.action || 'get';
        const path = params.path || null;

        let body = {};
        if (event.body) {
            body = JSON.parse(event.body);
        }

        let result;

        switch (action) {
            case 'get':
                result = await getConfig(db, path);
                break;

            case 'set':
            case 'update':
                if (!path) {
                    throw new Error('Path is required for update');
                }
                if (body.value === undefined) {
                    throw new Error('Value is required for update');
                }
                result = await updateConfig(db, path, body.value, body.source || 'api');
                break;

            case 'history':
                const limit = parseInt(params.limit) || 50;
                const type = params.type || null;
                result = await getHistory(db, limit, type);
                break;

            case 'reset':
                const section = params.section || null;
                result = await resetConfig(db, section);
                break;

            case 'defaults':
                result = DEFAULT_CONFIG;
                break;

            default:
                throw new Error(`Unknown action: ${action}. Valid: get, set, update, history, reset, defaults`);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, data: result })
        };

    } catch (error) {
        console.error('Config Manager Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
