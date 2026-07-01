/**
 * Marga AI Agent System - Shared Utilities
 * Common functions used by all agents
 */

const admin = require('firebase-admin');
const {
    addDoc,
    getDoc,
    listDocs,
    nowIso,
    setDoc,
    updateDoc
} = require('./marga-doc-store');

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
    const existing = await getDoc('marga_agents', agentId);
    await setDoc('marga_agents', agentId, {
        ...(existing || {}),
        status,
        lastActive: nowIso(),
        ...extras
    }, { merge: true });
}

async function getAgentStatus(agentId) {
    const doc = await getDoc('marga_agents', agentId);
    return doc || null;
}

async function getAllAgentsStatus() {
    const snapshot = await listDocs('marga_agents', { limit: 500 });
    const agents = {};
    snapshot.forEach(({ id, ...data }) => { agents[id] = data; });
    return agents;
}

// ============ TASKS ============

async function createTask(task) {
    const ref = await addDoc('marga_tasks', {
        ...task,
        status: TASK_STATUS.PENDING,
        createdAt: nowIso()
    });
    return ref.id;
}

async function getPendingTasks(agentId) {
    const docs = await listDocs('marga_tasks', {
        filters: [
            { field: 'agent', op: '==', value: agentId },
            { field: 'status', op: '==', value: TASK_STATUS.PENDING }
        ],
        orderBy: { field: 'createdAt', direction: 'asc' },
        limit: 10
    });
    return docs.map(({ id, ...data }) => ({ id, ...data }));
}

async function updateTask(taskId, updates) {
    await updateDoc('marga_tasks', taskId, {
        ...updates,
        updatedAt: nowIso()
    });
}

async function completeTask(taskId, result, success = true) {
    await updateDoc('marga_tasks', taskId, {
        status: success ? TASK_STATUS.DONE : TASK_STATUS.FAILED,
        result,
        completedAt: nowIso()
    });
}

// ============ ISSUES ============

async function createIssue(issue) {
    const ref = await addDoc('marga_issues', {
        ...issue,
        status: ISSUE_STATUS.OPEN,
        foundAt: nowIso()
    });
    return ref.id;
}

async function getOpenIssues(limit = 20) {
    const docs = await listDocs('marga_issues', {
        filters: [{ field: 'status', op: '==', value: ISSUE_STATUS.OPEN }],
        limit
    });
    return docs.map(({ id, ...data }) => ({ id, ...data }));
}

async function updateIssue(issueId, updates) {
    await updateDoc('marga_issues', issueId, updates);
}

// ============ SOLUTIONS ============

async function createSolution(solution) {
    const ref = await addDoc('marga_solutions', {
        ...solution,
        implementedAt: nowIso()
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
    const ref = await addDoc('marga_followups', {
        ...followup,
        status: 'pending',
        createdAt: nowIso()
    });
    return ref.id;
}

async function getPendingFollowups() {
    const now = new Date();
    const docs = await listDocs('marga_followups', {
        filters: [
            { field: 'status', op: '==', value: 'pending' },
            { field: 'checkDate', op: '<=', value: now.toISOString() }
        ]
    });
    return docs.map(({ id, ...data }) => ({ id, ...data }));
}

// ============ RECOMMENDATIONS ============

async function createRecommendation(rec) {
    const ref = await addDoc('marga_recommendations', {
        ...rec,
        status: 'pending',
        createdAt: nowIso()
    });
    return ref.id;
}

async function getPendingRecommendations() {
    const docs = await listDocs('marga_recommendations', {
        filters: [{ field: 'status', op: '==', value: 'pending' }],
        limit: 20
    });
    return docs.map(({ id, ...data }) => ({ id, ...data }));
}

async function updateRecommendation(recId, updates) {
    await updateDoc('marga_recommendations', recId, updates);
}

async function getRecommendation(recId) {
    const doc = await getDoc('marga_recommendations', recId);
    return doc ? { ...doc, id: recId } : null;
}

// ============ ACTIVITY LOG ============

async function logActivity(agentId, action, details) {
    await addDoc('marga_activity_log', {
        agent: agentId,
        action,
        details,
        timestamp: nowIso()
    });
}

async function getRecentActivity(limit = 20) {
    const docs = await listDocs('marga_activity_log', {
        orderBy: { field: 'timestamp', direction: 'desc' },
        limit
    });
    return docs.map(({ id, ...data }) => ({ id, ...data }));
}

// ============ SHARED DATA ============

async function getSharedData(key) {
    const doc = await getDoc('marga_shared', key);
    return doc || null;
}

async function setSharedData(key, data) {
    const existing = await getDoc('marga_shared', key);
    await setDoc('marga_shared', key, {
        ...(existing || {}),
        ...data,
        updatedAt: nowIso()
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
