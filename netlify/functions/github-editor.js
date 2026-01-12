/**
 * Marga AI - GitHub Editor API
 * Enables cloud-based file editing via GitHub API
 * Works from anywhere (phone, tablet, desktop)
 * 
 * Actions:
 * - get: Read file content
 * - list: List files in directory
 * - create: Create new file
 * - update: Update existing file
 * - delete: Delete file
 * - commit: Batch commit multiple files
 */

const GITHUB_API = 'https://api.github.com';
const REPO_OWNER = 'PinedaMikeB';
const REPO_NAME = 'marga-biz';
const BRANCH = 'main';

/**
 * Make authenticated GitHub API request
 */
async function githubRequest(endpoint, options = {}) {
    const token = process.env.GITHUB_TOKEN;
    
    if (!token) {
        throw new Error('GITHUB_TOKEN not configured');
    }

    const url = endpoint.startsWith('http') ? endpoint : `${GITHUB_API}${endpoint}`;
    
    const response = await fetch(url, {
        ...options,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
            ...options.headers
        }
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`GitHub API error ${response.status}: ${error}`);
    }

    return response.json();
}

/**
 * Get file content and metadata
 */
async function getFile(path) {
    try {
        const data = await githubRequest(
            `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${BRANCH}`
        );
        
        return {
            exists: true,
            path: data.path,
            sha: data.sha,
            size: data.size,
            content: Buffer.from(data.content, 'base64').toString('utf-8'),
            url: data.html_url
        };
    } catch (error) {
        if (error.message.includes('404')) {
            return { exists: false, path };
        }
        throw error;
    }
}

/**
 * List files in a directory
 */
async function listFiles(path = '') {
    const data = await githubRequest(
        `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${BRANCH}`
    );
    
    return data.map(item => ({
        name: item.name,
        path: item.path,
        type: item.type, // 'file' or 'dir'
        size: item.size,
        sha: item.sha
    }));
}

/**
 * Create or update a single file
 */
async function createOrUpdateFile(path, content, message, existingSha = null) {
    // Get existing SHA if not provided
    let sha = existingSha;
    if (!sha) {
        const existing = await getFile(path);
        if (existing.exists) {
            sha = existing.sha;
        }
    }

    const body = {
        message: message,
        content: Buffer.from(content).toString('base64'),
        branch: BRANCH
    };

    if (sha) {
        body.sha = sha;
    }

    const data = await githubRequest(
        `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
        {
            method: 'PUT',
            body: JSON.stringify(body)
        }
    );

    return {
        success: true,
        path: data.content.path,
        sha: data.content.sha,
        commit: data.commit.sha,
        commitUrl: data.commit.html_url,
        action: sha ? 'updated' : 'created'
    };
}

/**
 * Delete a file
 */
async function deleteFile(path, message) {
    const existing = await getFile(path);
    
    if (!existing.exists) {
        throw new Error(`File not found: ${path}`);
    }

    const data = await githubRequest(
        `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
        {
            method: 'DELETE',
            body: JSON.stringify({
                message: message,
                sha: existing.sha,
                branch: BRANCH
            })
        }
    );

    return {
        success: true,
        path: path,
        commit: data.commit.sha,
        action: 'deleted'
    };
}

/**
 * Batch commit multiple files using Git Tree API
 * More efficient for multiple file changes
 */
async function batchCommit(files, message) {
    // Get the latest commit SHA
    const refData = await githubRequest(
        `/repos/${REPO_OWNER}/${REPO_NAME}/git/ref/heads/${BRANCH}`
    );
    const latestCommitSha = refData.object.sha;

    // Get the tree SHA from the latest commit
    const commitData = await githubRequest(
        `/repos/${REPO_OWNER}/${REPO_NAME}/git/commits/${latestCommitSha}`
    );
    const baseTreeSha = commitData.tree.sha;

    // Create blobs for each file
    const treeItems = [];
    
    for (const file of files) {
        if (file.action === 'delete') {
            treeItems.push({
                path: file.path,
                mode: '100644',
                type: 'blob',
                sha: null  // null SHA deletes the file
            });
        } else {
            // Create blob for new/updated content
            const blobData = await githubRequest(
                `/repos/${REPO_OWNER}/${REPO_NAME}/git/blobs`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        content: file.content,
                        encoding: 'utf-8'
                    })
                }
            );
            
            treeItems.push({
                path: file.path,
                mode: '100644',
                type: 'blob',
                sha: blobData.sha
            });
        }
    }

    // Create new tree
    const newTree = await githubRequest(
        `/repos/${REPO_OWNER}/${REPO_NAME}/git/trees`,
        {
            method: 'POST',
            body: JSON.stringify({
                base_tree: baseTreeSha,
                tree: treeItems
            })
        }
    );

    // Create commit
    const newCommit = await githubRequest(
        `/repos/${REPO_OWNER}/${REPO_NAME}/git/commits`,
        {
            method: 'POST',
            body: JSON.stringify({
                message: message,
                tree: newTree.sha,
                parents: [latestCommitSha]
            })
        }
    );

    // Update branch reference
    await githubRequest(
        `/repos/${REPO_OWNER}/${REPO_NAME}/git/refs/heads/${BRANCH}`,
        {
            method: 'PATCH',
            body: JSON.stringify({
                sha: newCommit.sha
            })
        }
    );

    return {
        success: true,
        commit: newCommit.sha,
        filesChanged: files.length,
        message: message
    };
}

/**
 * Main handler
 */
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const params = event.queryStringParameters || {};
        const action = params.action;
        const path = params.path || '';

        let body = {};
        if (event.body) {
            body = JSON.parse(event.body);
        }

        let result;

        switch (action) {
            case 'get':
                result = await getFile(path);
                break;

            case 'list':
                result = await listFiles(path);
                break;

            case 'create':
            case 'update':
                if (!body.content) {
                    throw new Error('Content is required');
                }
                const message = body.message || `AI: ${action} ${path}`;
                result = await createOrUpdateFile(path, body.content, message, body.sha);
                break;

            case 'delete':
                const deleteMsg = body.message || `AI: Delete ${path}`;
                result = await deleteFile(path, deleteMsg);
                break;

            case 'batch':
                if (!body.files || !Array.isArray(body.files)) {
                    throw new Error('Files array is required for batch commit');
                }
                const batchMsg = body.message || `AI: Batch update (${body.files.length} files)`;
                result = await batchCommit(body.files, batchMsg);
                break;

            case 'test':
                // Test connection without making changes
                const testData = await githubRequest(
                    `/repos/${REPO_OWNER}/${REPO_NAME}`
                );
                result = {
                    success: true,
                    repo: testData.full_name,
                    branch: BRANCH,
                    private: testData.private,
                    permissions: testData.permissions
                };
                break;

            default:
                throw new Error(`Unknown action: ${action}. Valid actions: get, list, create, update, delete, batch, test`);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, data: result })
        };

    } catch (error) {
        console.error('GitHub Editor Error:', error);
        return {
            statusCode: error.message.includes('404') ? 404 : 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: error.message 
            })
        };
    }
};
