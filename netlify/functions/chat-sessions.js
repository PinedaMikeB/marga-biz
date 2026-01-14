/**
 * Chat Sessions API - Store and retrieve chat history in Firebase
 * Syncs across all devices for the user
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

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const app = getFirebaseApp();
        const db = admin.firestore(app);
        const sessionsRef = db.collection('chat_sessions');
        
        // GET - List sessions or get specific session
        if (event.httpMethod === 'GET') {
            const params = event.queryStringParameters || {};
            
            if (params.sessionId) {
                // Get specific session
                const doc = await sessionsRef.doc(params.sessionId).get();
                if (!doc.exists) {
                    return {
                        statusCode: 404,
                        headers,
                        body: JSON.stringify({ success: false, error: 'Session not found' })
                    };
                }
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ success: true, session: { id: doc.id, ...doc.data() } })
                };
            } else {
                // List all sessions (most recent first)
                const limit = parseInt(params.limit) || 50;
                const snapshot = await sessionsRef
                    .orderBy('updatedAt', 'desc')
                    .limit(limit)
                    .get();
                
                const sessions = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    sessions.push({
                        id: doc.id,
                        title: data.title || 'New Chat',
                        preview: data.preview || '',
                        messageCount: data.messageCount || 0,
                        createdAt: data.createdAt,
                        updatedAt: data.updatedAt
                    });
                });
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ success: true, sessions })
                };
            }
        }
        
        // POST - Create or update session
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            const { sessionId, messages, title } = body;
            
            const now = new Date().toISOString();
            
            // Generate preview from last user message
            const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
            const preview = lastUserMsg ? lastUserMsg.content.substring(0, 100) : '';
            
            // Auto-generate title from first user message if not provided
            const firstUserMsg = messages.find(m => m.role === 'user');
            const autoTitle = title || (firstUserMsg ? firstUserMsg.content.substring(0, 50) : 'New Chat');
            
            if (sessionId) {
                // Update existing session
                await sessionsRef.doc(sessionId).update({
                    messages,
                    title: autoTitle,
                    preview,
                    messageCount: messages.length,
                    updatedAt: now
                });
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ success: true, sessionId })
                };
            } else {
                // Create new session
                const docRef = await sessionsRef.add({
                    messages,
                    title: autoTitle,
                    preview,
                    messageCount: messages.length,
                    createdAt: now,
                    updatedAt: now
                });
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ success: true, sessionId: docRef.id })
                };
            }
        }
        
        // DELETE - Delete a session
        if (event.httpMethod === 'DELETE') {
            const params = event.queryStringParameters || {};
            if (!params.sessionId) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, error: 'sessionId required' })
                };
            }
            
            await sessionsRef.doc(params.sessionId).delete();
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true })
            };
        }
        
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
        };
        
    } catch (error) {
        console.error('Chat sessions API error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
