// API_BASE is defined in config.js (must load config.js first)
var API_BASE = window.API_BASE || window.location.origin;

async function createProject(projectData) {
    const token = localStorage.getItem('access_token');
    try {
        const response = await fetch(`${API_BASE}/api/v1/projects`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(projectData)
        });
        
        if (response.ok) {
            const data = await response.json();
            return { success: true, data };
        } else {
            const error = await response.json();
            return { success: false, error: error.detail || 'Failed to create project' };
        }
    } catch (error) {
        return { success: false, error: 'Network error' };
    }
}

async function getProject(projectId) {
    try {
        const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}`);
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error('Error fetching project:', error);
    }
    return null;
}

async function submitBid(projectId, bidData) {
    const token = localStorage.getItem('access_token');
    try {
        const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/bids`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(bidData)
        });
        
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error('Error submitting bid:', error);
    }
    return null;
}

