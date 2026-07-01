/**
 * Chat Sessions API - Store and retrieve chat history in Firebase
 * Syncs across all devices for the user
 */

const { addDoc, deleteDoc, getDoc, listDocs, setDoc } = require('./lib/marga-doc-store');

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
        // GET - List sessions or get specific session
        if (event.httpMethod === 'GET') {
            const params = event.queryStringParameters || {};
            
            if (params.sessionId) {
                // Get specific session
                const session = await getDoc('chat_sessions', params.sessionId);
                if (!session) {
                    return {
                        statusCode: 404,
                        headers,
                        body: JSON.stringify({ success: false, error: 'Session not found' })
                    };
                }
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ success: true, session })
                };
            } else {
                // List all sessions (most recent first)
                const limit = parseInt(params.limit) || 50;
                const docs = await listDocs('chat_sessions', {
                    orderBy: { field: 'updatedAt', direction: 'desc' },
                    limit
                });
                const sessions = docs.map((data) => ({
                    id: data.id,
                    title: data.title || 'New Chat',
                    preview: data.preview || '',
                    messageCount: data.messageCount || 0,
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt
                }));
                
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
                const existing = await getDoc('chat_sessions', sessionId);
                await setDoc('chat_sessions', sessionId, {
                    ...(existing || {}),
                    messages,
                    title: autoTitle,
                    preview,
                    messageCount: messages.length,
                    createdAt: existing?.createdAt || now,
                    updatedAt: now
                });
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ success: true, sessionId })
                };
            } else {
                // Create new session
                const docRef = await addDoc('chat_sessions', {
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
            
            await deleteDoc('chat_sessions', params.sessionId);
            
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
