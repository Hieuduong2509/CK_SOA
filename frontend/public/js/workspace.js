// API_BASE is defined in config.js (must load config.js first)
var API_BASE = window.API_BASE || window.location.origin;
let ws = null;
let conversationId = null;

async function loadWorkspace(projectId) {
    // Load project details
    const project = await getProject(projectId);
    if (project) {
        document.getElementById('projectTitle').textContent = project.title;
    }

    // Start conversation and connect WebSocket
    try {
        const response = await fetch(`${API_BASE}/api/v1/chat/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            },
            body: JSON.stringify({
                participant2_id: project.freelancer_id || 2,
                project_id: projectId
            })
        });
        if (response.ok) {
            const conversation = await response.json();
            conversationId = conversation.id;
            connectWebSocket(conversationId);
            loadMessages(conversationId);
        }
    } catch (error) {
        console.error('Error starting conversation:', error);
    }

    // Load milestones
    loadMilestones(projectId);
}

function connectWebSocket(convId) {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/${convId}`;
    ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        displayMessage(message);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

function displayMessage(message) {
    const messagesList = document.getElementById('messagesList');
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = 'padding: 0.75rem; margin-bottom: 0.5rem; background: var(--bg-gray); border-radius: var(--radius-lg);';
    messageDiv.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 0.25rem;">User ${message.sender_id}</div>
        <div>${message.content}</div>
    `;
    messagesList.appendChild(messageDiv);
    messagesList.scrollTop = messagesList.scrollHeight;
}

async function loadMessages(convId) {
    try {
        const response = await fetch(`${API_BASE}/api/v1/chat/${convId}/messages`);
        if (response.ok) {
            const messages = await response.json();
            messages.forEach(msg => displayMessage(msg));
        }
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    if (content && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ content, attachments: [] }));
        input.value = '';
    }
}

async function loadMilestones(projectId) {
    try {
        const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/milestones`);
        if (response.ok) {
            const milestones = await response.json();
            const list = document.getElementById('milestonesList');
            list.innerHTML = milestones.map(m => `
                <div style="background: white; padding: 1rem; border-radius: var(--radius-lg); margin-bottom: 1rem; box-shadow: var(--shadow-sm);">
                    <h4 style="margin-bottom: 0.5rem;">${m.title}</h4>
                    <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 0.5rem;">$${m.amount}</p>
                    <span style="padding: 0.25rem 0.75rem; background: var(--bg-gray); border-radius: var(--radius-md); font-size: 0.75rem;">
                        ${m.status}
                    </span>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading milestones:', error);
    }
}

// Allow Enter key to send message
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('messageInput');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
});

