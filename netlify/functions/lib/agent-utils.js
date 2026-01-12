/**
 * Marga AI Agent System - Shared Utilities
 * Common functions used by all agents
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin (singleton)
let firebaseApp = null;
const getFirebaseApp = () => {
    if (!firebaseApp && admin.apps.length === 0) {
        const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: 'sah-spiritual-journal'
        });
    }
    return firebaseApp || admin.app();
};

const getDb = () => admin.firestore(getFirebaseApp());

// Agent IDs
const AGENTS = {
    MANAGER: 'manager',
    WEBSITE: 'website',
    SEARCH: 'search',
    GOOGLE: 'google',
    CONTENT: 'content',
    TRACKER: 'tracker',
    AI_SEARCH: 'ai_search'
};

// Status constants
const AGENT_STATUS = {
    IDLE: 'idle',
    RUNNING: 'running',
    ERROR: 'error'
};

const TASK_STATUS = {
    PENDING: 'pending',
    RUNNING: 'running',
    DONE: 'done',
    FAILED: 'failed'
};

const ISSUE_SEVERITY = {
    CRITICAL: 'critical',
    WARNING: 'warning',
    INFO: 'info'
};

const ISSUE_STATUS = {
    OPEN: 'open',
    IN_PROGRESS: 'in_progress',
    RESOLVED: 'resolved',
    WONT_FIX: 'wont_fix'
};

// ============ AGENT STATUS ============

async function updateAgentStatus(agentId, status, extras = {}) {
    const db = getDb();
    await db.collection('marga_agents').doc(agentId).set({
        status,
        lastActive: admin.firestore.FieldValue.serverTimestamp(),
        ...extras
    }, { merge: true });
}

async function getAgentStatus(agentId) {
    const db = getDb();
    const doc = await db.collection('marga_agents').doc(agentId).get();
    return doc.exists ? doc.data() : null;
}

async function getAllAgentsStatus() {
    const db = getDb();
    const snapshot = await db.collection('marga_agents').get();
    const agents = {};
    snapshot.forEach(doc => { agents[doc.id] = doc.data(); });
    return agents;
}

// ============ TASKS ============

async function createTask(task) {
    const db = getDb();
    const ref = await db.collection('marga_tasks').add({
        ...task,
        status: TASK_STATUS.PENDING,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
}

async function getPendingTasks(agentId) {
    const db = getDb();
    const snapshot = await db.collection('marga_tasks')
        .where('agent', '==', agentId)
        .where('status', '==', TASK_STATUS.PENDING)
        .orderBy('createdAt', 'asc')
        .limit(10)
        .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function updateTask(taskId, updates) {
    const db = getDb();
    await db.collection('marga_tasks').doc(taskId).update({
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
}

async function completeTask(taskId, result, success = true) {
    const db = getDb();
    await db.collection('marga_tasks').doc(taskId).update({
        status: success ? TASK_STATUS.DONE : TASK_STATUS.FAILED,
        result,
        completedAt: admin.firestore.FieldValue.serverTimestamp()
    });
}

// ============ ISSUES ============

async function createIssue(issue) {
    const db = getDb();
    const ref = await db.collection('marga_issues').add({
        ...issue,
        status: ISSUE_STATUS.OPEN,
        foundAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
}

async function getOpenIssues(limit = 20) {
    const db = getDb();
    // Simple query without orderBy to avoid index requirement
    const snapshot = await db.collection('marga_issues')
        .where('status', '==', ISSUE_STATUS.OPEN)
        .limit(limit)
        .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function updateIssue(issueId, updates) {
    const db = getDb();
    await db.collection('marga_issues').doc(issueId).update(updates);
}

// ============ SOLUTIONS ============

async function createSolution(solution) {
    const db = getDb();
    const ref = await db.collection('marga_solutions').add({
        ...solution,
        implementedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    if (solution.issueId) {
        await updateIssue(solution.issueId, {
            status: ISSUE_STATUS.RESOLVED,
            solutionId: ref.id
        });
    }
    return ref.id;
}

// ============ FOLLOW-UPS ============

async function createFollowup(followup) {
    const db = getDb();
    const ref = await db.collection('marga_followups').add({
        ...followup,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
}

async function getPendingFollowups() {
    const db = getDb();
    const now = new Date();
    const snapshot = await db.collection('marga_followups')
        .where('status', '==', 'pending')
        .where('checkDate', '<=', now)
        .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ============ RECOMMENDATIONS ============

async function createRecommendation(rec) {
    const db = getDb();
    const ref = await db.collection('marga_recommendations').add({
        ...rec,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
}

async function getPendingRecommendations() {
    const db = getDb();
    // Simple query without orderBy to avoid index requirement
    const snapshot = await db.collection('marga_recommendations')
        .where('status', '==', 'pending')
        .limit(20)
        .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function updateRecommendation(recId, updates) {
    const db = getDb();
    await db.collection('marga_recommendations').doc(recId).update(updates);
}

async function getRecommendation(recId) {
    const db = getDb();
    const doc = await db.collection('marga_recommendations').doc(recId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

// ============ ACTIVITY LOG ============

async function logActivity(agentId, action, details) {
    const db = getDb();
    await db.collection('marga_activity_log').add({
        agent: agentId,
        action,
        details,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
}

async function getRecentActivity(limit = 20) {
    const db = getDb();
    const snapshot = await db.collection('marga_activity_log')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ============ SHARED DATA ============

async function getSharedData(key) {
    const db = getDb();
    const doc = await db.collection('marga_shared').doc(key).get();
    return doc.exists ? doc.data() : null;
}

async function setSharedData(key, data) {
    const db = getDb();
    await db.collection('marga_shared').doc(key).set({
        ...data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

module.exports = {
    getFirebaseApp,
    getDb,
    AGENTS,
    AGENT_STATUS,
    TASK_STATUS,
    ISSUE_SEVERITY,
    ISSUE_STATUS,
    updateAgentStatus,
    getAgentStatus,
    getAllAgentsStatus,
    createTask,
    getPendingTasks,
    updateTask,
    completeTask,
    createIssue,
    getOpenIssues,
    updateIssue,
    createSolution,
    createFollowup,
    getPendingFollowups,
    createRecommendation,
    getPendingRecommendations,
    updateRecommendation,
    getRecommendation,
    logActivity,
    getRecentActivity,
    getSharedData,
    setSharedData
};
