// API_BASE is defined in config.js (must load config.js first)
var API_BASE = window.API_BASE || window.location.origin;
let ws = null;
let conversationId = null;
let currentProject = null;
let currentUser = null;
let currentProjectId = null;
const workspaceAttachmentState = {};

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'avif'];
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'];
const MEDIA_PLACEHOLDER = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="800" height="600" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%236b7280" font-family="Arial" font-size="32">Preview</text></svg>';

function normalizeAttachmentsList(rawAttachments) {
    if (!rawAttachments || !Array.isArray(rawAttachments)) {
        return [];
    }
    return rawAttachments.map(att => {
        if (typeof att === 'string') {
            const inferredName = att.split('/').pop() || 'File';
            return {
                url: att,
                filename: inferredName
            };
        }
        if (!att) return null;
        const url = att.url || att.preview_url || att.download_url || '';
        const fallbackName = url ? url.split('/').pop() : 'File';
        return {
            ...att,
            filename: att.filename || att.original_name || att.name || fallbackName
        };
    }).filter(Boolean);
}

function getAttachmentExtension(attachment) {
    if (!attachment) return '';
    const filename = attachment.filename || attachment.original_name || '';
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function getAttachmentUrl(attachment) {
    if (!attachment) return '';
    return attachment.url || attachment.preview_url || attachment.download_url || attachment.presigned_url || '';
}

function isImageAttachment(attachment) {
    const contentType = ((attachment && attachment.content_type) || '').toLowerCase();
    if (contentType.includes('image')) return true;
    const ext = getAttachmentExtension(attachment);
    return IMAGE_EXTENSIONS.includes(ext);
}

function isVideoAttachment(attachment) {
    const contentType = ((attachment && attachment.content_type) || '').toLowerCase();
    if (contentType.includes('video')) return true;
    const ext = getAttachmentExtension(attachment);
    return VIDEO_EXTENSIONS.includes(ext);
}

// Format currency to "nghìn đồng"
function formatCurrency(value) {
    if (!value) return '0 nghìn đồng';
    const thousands = value / 1000;
    return new Intl.NumberFormat('vi-VN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1
    }).format(thousands) + ' nghìn đồng';
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'Chưa có';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

// Get project from API
async function getProject(projectId) {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (response.ok) {
            return await response.json();
        } else {
            const error = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
            console.error('Error fetching project:', error);
            throw new Error(error.detail || `Failed to fetch project: ${response.status}`);
        }
    } catch (error) {
        console.error('Error fetching project:', error);
        throw error;
    }
}
// Expose immediately
window.getProject = getProject;

// Switch tabs
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    document.getElementById(`tab-${tabName}`).classList.add('active');

    // Load content for specific tabs
    if (tabName === 'bidders' && currentProjectId) {
        loadBidders(currentProjectId);
    } else if (tabName === 'milestones' && currentProjectId) {
        loadMilestones(currentProjectId);
    } else if (tabName === 'files' && currentProjectId) {
        loadProjectFiles(currentProjectId);
    }
}
// Expose immediately
window.switchTab = switchTab;

// Main function to load workspace
async function loadWorkspace(projectId) {
    currentProjectId = projectId;
    
    // Get current user
    currentUser = getCurrentUserProfile();
    if (!currentUser) {
        currentUser = await fetchCurrentUser();
    }

    // Load project details
    currentProject = await getProject(projectId);
    if (currentProject) {
        // Update project header
        document.getElementById('projectTitle').textContent = currentProject.title;
        document.getElementById('projectDescription').textContent = currentProject.description || 'Không có mô tả';
        
        // Load project details tab
        loadProjectDetails(currentProject);

        // Prefill media showcase as soon as project data có sẵn
        preloadWorkspaceShowcase(currentProject, projectId);
    }

    // Load initial tab content
    loadBidders(projectId);
    loadMilestones(projectId);
    loadProjectFiles(projectId);

    // Start conversation and connect WebSocket
    await initializeChat(projectId);
}
// Expose immediately
window.loadWorkspace = loadWorkspace;

// Load project details
function loadProjectDetails(project) {
    const detailsDiv = document.getElementById('projectDetails');
    detailsDiv.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
            <div>
                <h4 style="margin: 0 0 0.5rem 0; color: var(--text-primary);">
                    <i class="fas fa-info-circle" style="color: var(--primary-color); margin-right: 0.5rem;"></i>
                    Thông tin dự án
                </h4>
                <p style="margin: 0; color: var(--text-secondary); line-height: 1.6;">${project.description || 'Không có mô tả'}</p>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div>
                    <strong style="color: var(--text-secondary); font-size: 0.875rem;">Ngân sách:</strong>
                    <p style="margin: 0.25rem 0 0 0; font-size: 1.125rem; color: var(--primary-color); font-weight: 600;">
                        ${formatCurrency(project.budget)}
                    </p>
                </div>
                <div>
                    <strong style="color: var(--text-secondary); font-size: 0.875rem;">Loại ngân sách:</strong>
                    <p style="margin: 0.25rem 0 0 0; font-size: 1.125rem; color: var(--text-primary);">
                        ${project.budget_type === 'FIXED' ? 'Cố định' : 'Theo giờ'}
                    </p>
                </div>
            </div>

            ${project.deadline ? `
                <div>
                    <strong style="color: var(--text-secondary); font-size: 0.875rem;">Thời hạn:</strong>
                    <p style="margin: 0.25rem 0 0 0; color: var(--text-primary);">${formatDate(project.deadline)}</p>
                </div>
            ` : ''}

            ${project.category ? `
                <div>
                    <strong style="color: var(--text-secondary); font-size: 0.875rem;">Danh mục:</strong>
                    <p style="margin: 0.25rem 0 0 0; color: var(--text-primary);">${project.category}</p>
                </div>
            ` : ''}

            ${project.skills_required && project.skills_required.length > 0 ? `
                <div>
                    <strong style="color: var(--text-secondary); font-size: 0.875rem;">Kỹ năng yêu cầu:</strong>
                    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">
                        ${project.skills_required.map(skill => `
                            <span style="background: rgba(0, 102, 255, 0.1); color: var(--primary-color); padding: 0.25rem 0.75rem; border-radius: var(--radius-md); font-size: 0.875rem;">
                                ${skill}
                            </span>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

function preloadWorkspaceShowcase(project, projectIdOverride) {
    if (!project) return;
    const normalizedAttachments = normalizeAttachmentsList(project.attachments || []);
    const user = currentUser || getCurrentUserProfile();
    const isOwner = user && project.client_id === user.id;
    updateWorkspaceShowcase(projectIdOverride || project.id, normalizedAttachments, isOwner);
}

function updateWorkspaceShowcase(projectId, attachments, isOwner) {
    const showcaseGallery = document.getElementById('workspaceShowcaseGallery');
    const showcaseStatus = document.getElementById('workspaceShowcaseStatus');

    if (!workspaceAttachmentState[projectId]) {
        workspaceAttachmentState[projectId] = { currentIndex: 0 };
    }

    if (!attachments || attachments.length === 0) {
        workspaceAttachmentState[projectId].attachments = [];
        if (showcaseGallery) {
            showcaseGallery.innerHTML = `
                <div class="workspace-gallery-empty">
                    <p>Chưa có media nào. Hãy tải ảnh/video để hiển thị tại đây.</p>
                </div>
            `;
        }
        if (showcaseStatus) {
            showcaseStatus.innerHTML = '<span>Chưa có tệp đính kèm</span>';
        }
        return;
    }

    workspaceAttachmentState[projectId].attachments = attachments.slice();
    workspaceAttachmentState[projectId].isOwner = isOwner;

    if (workspaceAttachmentState[projectId].currentIndex >= attachments.length) {
        workspaceAttachmentState[projectId].currentIndex = Math.max(attachments.length - 1, 0);
    }

    if (showcaseStatus) {
        showcaseStatus.innerHTML = `
            <i class="fas fa-check-circle" style="color: var(--success-color);"></i>
            <span>${attachments.length} tệp đính kèm</span>
        `;
    }

    renderWorkspaceGallery(projectId, 'workspaceShowcaseGallery');
}

// Load bidders (applicants)
async function loadBidders(projectId) {
    const biddersList = document.getElementById('biddersList');
    biddersList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Đang tải...</p>';

    try {
        const token = localStorage.getItem('access_token');
        if (!token) {
            biddersList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Vui lòng đăng nhập để xem ứng viên.</p>';
            return;
        }

        // Fetch bids
        const bidsResponse = await fetch(`${API_BASE}/api/v1/projects/${projectId}/bids`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!bidsResponse.ok) {
            throw new Error('Failed to load bids');
        }

        const bids = await bidsResponse.json();

        // Fetch project to check status
        const project = currentProject || await getProject(projectId);

        if (bids.length === 0) {
            biddersList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Chưa có ai apply cho dự án này.</p>';
            return;
        }

        // Fetch freelancer profiles for each bid
        const bidsWithProfiles = await Promise.all(
            bids.map(async (bid) => {
                try {
                    const profileResponse = await fetch(`${API_BASE}/api/v1/users/${bid.freelancer_id}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (profileResponse.ok) {
                        const profile = await profileResponse.json();
                        return { ...bid, profile };
                    }
                } catch (error) {
                    console.error(`Error fetching profile for freelancer ${bid.freelancer_id}:`, error);
                }
                return { ...bid, profile: null };
            })
        );

        // Render bidders
        biddersList.innerHTML = bidsWithProfiles.map(bid => {
            const profile = bid.profile;
            const projectStatus = ((project && project.status) || '').toLowerCase();
            const canAccept = projectStatus === 'open' || projectStatus === 'pending_approval';

            return `
                <div class="bidder-card" style="border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.5rem; margin-bottom: 1rem; background: var(--bg-gray);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                        <div style="flex: 1;">
                            <h4 style="margin: 0 0 0.5rem 0; color: var(--text-primary);">
                                ${profile ? `<a href="freelancer_profile.html?id=${profile.user_id}" target="_blank" style="color: var(--primary-color); text-decoration: none;">${profile.headline || profile.display_name || 'Freelancer'}</a>` : `Freelancer #${bid.freelancer_id}`}
                            </h4>
                            ${profile ? `
                                <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.5rem; font-size: 0.875rem; color: var(--text-secondary);">
                                    ${profile.rating ? `<span><i class="fas fa-star" style="color: #FFD700;"></i> ${profile.rating.toFixed(1)} (${profile.total_reviews || 0})</span>` : ''}
                                    ${profile.level ? `<span><i class="fas fa-level-up-alt"></i> Level ${profile.level}</span>` : ''}
                                    ${profile.location ? `<span><i class="fas fa-map-marker-alt"></i> ${profile.location}</span>` : ''}
                                </div>
                                ${profile.badges && profile.badges.length > 0 ? `
                                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem;">
                                        ${profile.badges.map(badge => `<span style="background: rgba(0, 102, 255, 0.1); color: var(--primary-color); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">${badge}</span>`).join('')}
                                    </div>
                                ` : ''}
                            ` : ''}
                            <p style="color: var(--text-secondary); margin: 0.5rem 0; font-size: 0.9375rem;">
                                <strong>Giá đề xuất:</strong> ${formatCurrency(bid.price)} | 
                                <strong>Thời gian:</strong> ${bid.timeline_days} ngày
                            </p>
                        </div>
                        <div style="display: flex; gap: 0.5rem; flex-shrink: 0; flex-direction: column;">
                            <button class="btn btn-primary btn-small" onclick="startChatWithBidder(${bid.freelancer_id}, ${projectId})" title="Nhắn tin" style="white-space: nowrap;">
                                <i class="fas fa-comment"></i> Nhắn tin
                            </button>
                            ${canAccept ? `
                                <button class="btn btn-success btn-small" onclick="acceptBid(${projectId}, ${bid.id})" title="Duyệt" style="white-space: nowrap;">
                                    <i class="fas fa-check"></i> Duyệt
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    ${bid.cover_letter ? `
                        <div style="background: white; padding: 1rem; border-radius: var(--radius-md); margin-top: 1rem; border-left: 3px solid var(--primary-color);">
                            <strong style="color: var(--text-primary); font-size: 0.875rem;">Thư giới thiệu:</strong>
                            <p style="margin: 0.5rem 0 0 0; color: var(--text-secondary); white-space: pre-wrap; font-size: 0.9375rem; line-height: 1.6;">${bid.cover_letter}</p>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading bidders:', error);
        biddersList.innerHTML = '<p style="text-align: center; color: var(--danger-color); padding: 2rem;">Có lỗi xảy ra khi tải danh sách ứng viên.</p>';
    }
}

// Start chat with bidder
async function startChatWithBidder(freelancerId, projectId) {
    try {
        const token = localStorage.getItem('access_token');
        if (!token) {
            alert('Vui lòng đăng nhập để nhắn tin.');
            return;
        }

        const response = await fetch(`${API_BASE}/api/v1/chat/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                participant2_id: freelancerId,
                project_id: projectId
            })
        });

        if (response.ok) {
            const conversation = await response.json();
            // Reload chat with new conversation
            conversationId = conversation.id;
            connectWebSocket(conversationId);
            loadMessages(conversationId);
            alert('Đã bắt đầu cuộc trò chuyện!');
        } else {
            const error = await response.json();
            alert(error.detail || 'Không thể bắt đầu cuộc trò chuyện.');
        }
    } catch (error) {
        console.error('Error starting chat:', error);
        alert('Có lỗi xảy ra khi bắt đầu cuộc trò chuyện.');
    }
}
// Expose immediately
window.startChatWithBidder = startChatWithBidder;

// Accept bid
async function acceptBid(projectId, bidId) {
    if (!confirm('Bạn có chắc chắn muốn duyệt người apply này không?')) {
        return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/accept`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ bid_id: bidId })
        });

        if (response.ok) {
            alert('Đã duyệt thành công! Dự án đã được chuyển sang trạng thái "Đang thực hiện".');
            // Reload bidders and milestones
            loadBidders(projectId);
            loadMilestones(projectId);
            // Reload project
            currentProject = await getProject(projectId);
            loadProjectDetails(currentProject);
        } else {
            const error = await response.json();
            alert(error.detail || 'Không thể duyệt. Vui lòng thử lại.');
        }
    } catch (error) {
        console.error('Error accepting bid:', error);
        alert('Có lỗi xảy ra khi duyệt.');
    }
}
// Expose immediately
window.acceptBid = acceptBid;

// Initialize chat
async function initializeChat(projectId) {
    try {
        const token = localStorage.getItem('access_token');
        if (!token) return;

        // Get project to find freelancer_id
        const project = currentProject || await getProject(projectId);
        if (!project) return;

        // Try to find existing conversation or start new one
        // For now, we'll try to start a conversation with the accepted freelancer
        const freelancerId = project.accepted_bid_id ? 
            (await fetch(`${API_BASE}/api/v1/projects/${projectId}/bids`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(r => r.json()).then(bids => {
                const acceptedBid = bids.find(b => b.id === project.accepted_bid_id);
                return acceptedBid ? acceptedBid.freelancer_id : undefined;
            })) : null;

        if (freelancerId) {
            const response = await fetch(`${API_BASE}/api/v1/chat/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    participant2_id: freelancerId,
                    project_id: projectId
                })
            });
            if (response.ok) {
                const conversation = await response.json();
                conversationId = conversation.id;
                connectWebSocket(conversationId);
                loadMessages(conversationId);
            }
        }
    } catch (error) {
        console.error('Error initializing chat:', error);
    }
}

// Connect WebSocket
function connectWebSocket(convId) {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/${convId}`;
    
    if (ws) {
        ws.close();
    }
    
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        displayMessage(message);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
        console.log('WebSocket closed');
    };
}

// Display message with chat bubbles
function displayMessage(message) {
    const messagesList = document.getElementById('messagesList');
    if (!messagesList) return;

    const isCurrentUser = currentUser && message.sender_id === currentUser.id;
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message-bubble';
    messageDiv.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: ${isCurrentUser ? 'flex-end' : 'flex-start'};
        margin-bottom: 0.75rem;
    `;

    const bubbleStyle = isCurrentUser ? `
        background: var(--primary-color);
        color: white;
        border-radius: 1rem 1rem 0.25rem 1rem;
        max-width: 70%;
    ` : `
        background: var(--bg-gray);
        color: var(--text-primary);
        border-radius: 1rem 1rem 1rem 0.25rem;
        max-width: 70%;
    `;

    const time = new Date(message.created_at || Date.now()).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit'
    });

    messageDiv.innerHTML = `
        <div style="${bubbleStyle} padding: 0.75rem 1rem; box-shadow: var(--shadow-sm);">
            ${!isCurrentUser ? `<div style="font-size: 0.75rem; font-weight: 600; margin-bottom: 0.25rem; opacity: 0.9;">User ${message.sender_id}</div>` : ''}
            <div style="word-wrap: break-word; white-space: pre-wrap;">${message.content || ''}</div>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem; padding: 0 0.5rem;">
            ${time}
        </div>
    `;

    messagesList.appendChild(messageDiv);
    messagesList.scrollTop = messagesList.scrollHeight;
}

// Load messages
async function loadMessages(convId) {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${API_BASE}/api/v1/chat/${convId}/messages`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (response.ok) {
            const messages = await response.json();
            const messagesList = document.getElementById('messagesList');
            if (messagesList) {
                messagesList.innerHTML = '';
                messages.forEach(msg => displayMessage(msg));
            }
        }
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

// Send message
function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    if (content && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ content, attachments: [] }));
        input.value = '';
    } else if (content && !conversationId) {
        alert('Chưa có cuộc trò chuyện. Vui lòng chọn một ứng viên để nhắn tin.');
    }
}
// Expose immediately
window.sendMessage = sendMessage;

// Load milestones
async function loadMilestones(projectId) {
    const milestonesList = document.getElementById('milestonesList');
    milestonesList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Đang tải...</p>';

    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/milestones`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        
        if (response.ok) {
            const milestones = await response.json();
            
            if (milestones.length === 0) {
                milestonesList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Chưa có milestone nào.</p>';
                return;
            }

            const user = currentUser || getCurrentUserProfile();
            let normalizedRole = '';
            if (user && user.role) {
                if (typeof user.role === 'string') {
                    normalizedRole = user.role;
                } else {
                    normalizedRole = user.role.value || user.role.name || '';
                }
            }
            normalizedRole = normalizedRole.toLowerCase();
            const isClient = normalizedRole === 'client';
            const isFreelancer = normalizedRole === 'freelancer';

            milestonesList.innerHTML = milestones.map(m => {
                const status = (m.status || '').toLowerCase();
                const statusLabels = {
                    'pending': { label: 'Chờ thực hiện', class: 'status-pending', color: '#6B7280' },
                    'submitted': { label: 'Đã nộp', class: 'status-submitted', color: '#F59E0B' },
                    'approved': { label: 'Đã duyệt', class: 'status-approved', color: '#10B981' },
                    'rejected': { label: 'Từ chối', class: 'status-rejected', color: '#EF4444' },
                    'paid': { label: 'Đã thanh toán', class: 'status-paid', color: '#10B981' }
                };
                const statusInfo = statusLabels[status] || { label: status, class: 'status-default', color: '#6B7280' };

                return `
                    <div style="background: var(--bg-gray); padding: 1.5rem; border-radius: var(--radius-lg); margin-bottom: 1rem; border-left: 4px solid ${statusInfo.color};">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
                            <div style="flex: 1;">
                                <h4 style="margin: 0 0 0.5rem 0; color: var(--text-primary);">${m.title}</h4>
                                ${m.description ? `<p style="margin: 0 0 0.5rem 0; color: var(--text-secondary); font-size: 0.9375rem;">${m.description}</p>` : ''}
                                <p style="margin: 0; color: var(--primary-color); font-weight: 600; font-size: 1.125rem;">${formatCurrency(m.amount)}</p>
                            </div>
                            <span style="padding: 0.375rem 0.75rem; background: ${statusInfo.color}15; color: ${statusInfo.color}; border-radius: var(--radius-md); font-size: 0.875rem; font-weight: 500; white-space: nowrap;">
                                ${statusInfo.label}
                            </span>
                        </div>
                        ${m.submitted_at ? `
                            <p style="margin: 0.5rem 0 0 0; font-size: 0.875rem; color: var(--text-secondary);">
                                <i class="fas fa-clock"></i> Nộp: ${formatDate(m.submitted_at)}
                            </p>
                        ` : ''}
                        ${m.approved_at ? `
                            <p style="margin: 0.5rem 0 0 0; font-size: 0.875rem; color: var(--text-secondary);">
                                <i class="fas fa-check-circle"></i> Duyệt: ${formatDate(m.approved_at)}
                            </p>
                        ` : ''}
                        <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                            ${isClient && status === 'submitted' ? `
                                <button class="btn btn-success btn-small" onclick="approveMilestone(${projectId}, ${m.id})" style="white-space: nowrap;">
                                    <i class="fas fa-check"></i> Duyệt & Thanh toán
                                </button>
                            ` : ''}
                            ${isFreelancer && status === 'pending' ? `
                                <button class="btn btn-primary btn-small" onclick="submitMilestone(${projectId}, ${m.id})" style="white-space: nowrap;">
                                    <i class="fas fa-upload"></i> Nộp bài
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            throw new Error('Failed to load milestones');
        }
    } catch (error) {
        console.error('Error loading milestones:', error);
        milestonesList.innerHTML = '<p style="text-align: center; color: var(--danger-color); padding: 2rem;">Có lỗi xảy ra khi tải milestones.</p>';
    }
}

// Approve milestone (Client)
async function approveMilestone(projectId, milestoneId) {
    if (!confirm('Bạn có chắc chắn muốn duyệt và thanh toán milestone này không?')) {
        return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/milestones/${milestoneId}/approve`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            alert('Đã duyệt và thanh toán milestone thành công!');
            loadMilestones(projectId);
        } else {
            const error = await response.json();
            alert(error.detail || 'Không thể duyệt milestone.');
        }
    } catch (error) {
        console.error('Error approving milestone:', error);
        alert('Có lỗi xảy ra khi duyệt milestone.');
    }
}
// Expose immediately
window.approveMilestone = approveMilestone;

// Submit milestone (Freelancer)
async function submitMilestone(projectId, milestoneId) {
    const description = prompt('Nhập mô tả công việc đã hoàn thành:');
    if (!description) return;

    const token = localStorage.getItem('access_token');
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/milestones/${milestoneId}/submit`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ description })
        });

        if (response.ok) {
            alert('Đã nộp milestone thành công!');
            loadMilestones(projectId);
        } else {
            const error = await response.json();
            alert(error.detail || 'Không thể nộp milestone.');
        }
    } catch (error) {
        console.error('Error submitting milestone:', error);
        alert('Có lỗi xảy ra khi nộp milestone.');
    }
}
// Expose immediately
window.submitMilestone = submitMilestone;

// Load project files/attachments
async function loadProjectFiles(projectId) {
    const filesList = document.getElementById('filesList');
    if (!filesList) return;
    
    filesList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Đang tải...</p>';

    try {
        let project = currentProject;
        if (!project) {
            try {
                project = await getProject(projectId);
            } catch (error) {
                console.error('Error fetching project in loadProjectFiles:', error);
                filesList.innerHTML = '<p style="text-align: center; color: var(--danger-color); padding: 2rem;">Không thể tải thông tin dự án. Vui lòng refresh trang.</p>';
                return;
            }
        }
        
        if (!project) {
            filesList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Không tìm thấy dự án.</p>';
            return;
        }

        const attachments = normalizeAttachmentsList(project.attachments || []);
        
        const user = currentUser || getCurrentUserProfile();
        const isOwner = user && project.client_id === user.id;

        updateWorkspaceShowcase(projectId, attachments, isOwner);

        if (attachments.length === 0) {
            filesList.innerHTML = `
                <div class="workspace-empty-attachments">
                    <p>Chưa có tệp đính kèm.</p>
                    ${isOwner ? renderAttachmentUploadControls(projectId) : ''}
                </div>
            `;
            return;
        }

        const uploadControlsHtml = isOwner ? renderAttachmentUploadControls(projectId) : '';

        const fileItemsHtml = attachments.map((attachment, index) => {
            const fileSize = attachment.size ? formatFileSize(attachment.size) : '';
            const uploadedDate = attachment.uploaded_at ? formatDate(attachment.uploaded_at) : '';
            return `
                <div class="file-item">
                    <div class="file-item-main">
                        <div class="file-item-icon">
                            <i class="fas fa-file"></i>
                        </div>
                        <div>
                            <a href="#" onclick="downloadProjectFile(${projectId}, ${index}, event)" class="file-item-title">
                                ${attachment.filename || 'File'}
                            </a>
                            <div class="file-item-meta">
                                ${fileSize ? `${fileSize} • ` : ''}${uploadedDate || ''}
                            </div>
                        </div>
                    </div>
                    <div class="file-item-actions">
                        <button onclick="downloadProjectFile(${projectId}, ${index}, event)" class="btn btn-secondary btn-small" title="Tải xuống">
                            <i class="fas fa-download"></i>
                        </button>
                        ${isOwner ? `
                            <button class="btn btn-danger btn-small" onclick="deleteProjectFile(${projectId}, ${index}, '${(attachment.filename || '').replace(/'/g, "\\'")}')" title="Xóa">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        filesList.innerHTML = `
            ${uploadControlsHtml}
            <div class="workspace-files-section">
                <div class="workspace-files-header">
                    <h4>Danh sách tệp (${attachments.length})</h4>
                </div>
                <div class="workspace-file-list">
                    ${fileItemsHtml}
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Error loading project files:', error);
        filesList.innerHTML = '<p style="text-align: center; color: var(--danger-color); padding: 2rem;">Có lỗi xảy ra khi tải danh sách tệp.</p>';
    }
}

function renderWorkspaceGallery(projectId, targetContainerId) {
    const galleryContainer = document.getElementById(targetContainerId || `workspace-media-gallery-${projectId}`);
    if (!galleryContainer) return;

    const state = workspaceAttachmentState[projectId];
    if (!state || !state.attachments || state.attachments.length === 0) {
        galleryContainer.innerHTML = `
            <div class="workspace-gallery-empty">
                <p>Chưa có media để hiển thị.</p>
            </div>
        `;
        return;
    }

    if (state.currentIndex == null) {
        state.currentIndex = 0;
    }

    const attachments = state.attachments;
    const activeIndex = Math.min(Math.max(state.currentIndex, 0), attachments.length - 1);
    state.currentIndex = activeIndex;
    const activeAttachment = attachments[activeIndex] || {};
    const activeUrl = getAttachmentUrl(activeAttachment) || MEDIA_PLACEHOLDER;
    const activeIsVideo = isVideoAttachment(activeAttachment);
    const activeIsImage = isImageAttachment(activeAttachment);
    const badgeImageCount = attachments.filter(att => isImageAttachment(att)).length;
    const badgeVideoCount = attachments.filter(att => isVideoAttachment(att)).length;

    const metaParts = [];
    if (activeIsVideo) {
        metaParts.push('Video');
    } else if (activeIsImage) {
        metaParts.push('Ảnh');
    } else if (activeAttachment && activeAttachment.content_type) {
        metaParts.push(activeAttachment.content_type);
    }
    if (activeAttachment && activeAttachment.size) {
        metaParts.push(formatFileSize(activeAttachment.size));
    }
    if (activeAttachment && activeAttachment.uploaded_at) {
        metaParts.push(formatDate(activeAttachment.uploaded_at));
    }
    const metaText = metaParts.join(' • ');
    const filenameSafe = ((activeAttachment && activeAttachment.filename) || 'Tệp đa phương tiện').replace(/'/g, "\\'");
    const canNavigate = attachments.length > 1;

    const posterUrl = (activeAttachment && activeAttachment.poster_url) || MEDIA_PLACEHOLDER;
    const displayName = (activeAttachment && activeAttachment.filename) || 'Tệp đa phương tiện';
    const mediaHtml = activeIsVideo
        ? `
            <video controls playsinline preload="metadata" poster="${posterUrl}">
                <source src="${activeUrl}">
                Trình duyệt của bạn không hỗ trợ video.
            </video>
        `
        : `
            <img src="${activeUrl}" alt="${displayName}" onerror="this.src='${MEDIA_PLACEHOLDER}'">
        `;

    const thumbnailsHtml = attachments.map((attachment, index) => {
        const isActive = index === activeIndex ? 'active' : '';
        const attachmentUrl = getAttachmentUrl(attachment) || MEDIA_PLACEHOLDER;
        const attachmentIsImage = isImageAttachment(attachment);
        const attachmentIsVideo = isVideoAttachment(attachment);
        return `
            <button class="gallery-thumb ${isActive}" onclick="setWorkspaceAttachmentIndex(${projectId}, ${index})" title="${attachment.filename || 'Tệp'}">
                ${attachmentIsImage ? `
                    <img src="${attachmentUrl}" alt="${attachment.filename || 'Attachment'}" onerror="this.src='${MEDIA_PLACEHOLDER}'">
                ` : `
                    <div class="gallery-thumb-placeholder">
                        <i class="${attachmentIsVideo ? 'fas fa-play' : 'fas fa-file'}"></i>
                    </div>
                `}
            </button>
        `;
    }).join('');

    galleryContainer.innerHTML = `
        <div class="workspace-gallery">
            <div class="workspace-gallery-badges">
                <div class="gallery-badge">
                    <div class="badge-icon">
                        <i class="fas fa-image"></i>
                    </div>
                    <div>
                        <p class="badge-title">Hình ảnh nổi bật</p>
                        <small>${badgeImageCount || 0} ảnh</small>
                    </div>
                </div>
                <div class="gallery-badge">
                    <div class="badge-icon">
                        <i class="fas fa-play-circle"></i>
                    </div>
                    <div>
                        <p class="badge-title">Video trình diễn</p>
                        <small>${badgeVideoCount || 0} video</small>
                    </div>
                </div>
                <div class="gallery-badge">
                    <div class="badge-icon">
                        <i class="fas fa-cloud-upload-alt"></i>
                    </div>
                    <div>
                        <p class="badge-title">Tổng cộng</p>
                        <small>${attachments.length} tệp</small>
                    </div>
                </div>
            </div>
            <div class="gallery-main-wrapper">
                <button class="gallery-nav prev ${canNavigate ? '' : 'disabled'}" onclick="changeWorkspaceAttachment(${projectId}, -1)" ${canNavigate ? '' : 'disabled'}>
                    <i class="fas fa-chevron-left"></i>
                </button>
                <div class="gallery-main-media ${activeIsVideo ? 'type-video' : 'type-image'}">
                    ${mediaHtml}
                </div>
                <button class="gallery-nav next ${canNavigate ? '' : 'disabled'}" onclick="changeWorkspaceAttachment(${projectId}, 1)" ${canNavigate ? '' : 'disabled'}>
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
            <div class="gallery-meta">
                <div>
                    <h3>${displayName}</h3>
                    <p>${metaText || 'Được tải lên bởi khách hàng'}</p>
                </div>
                <div class="gallery-meta-actions">
                    <button class="btn btn-secondary btn-small" onclick="downloadProjectFile(${projectId}, ${activeIndex})">
                        <i class="fas fa-download"></i> Tải xuống
                    </button>
                    ${state.isOwner ? `
                        <button class="btn btn-danger btn-small" onclick="deleteProjectFile(${projectId}, ${activeIndex}, '${filenameSafe}')">
                            <i class="fas fa-trash"></i> Xóa
                        </button>
                    ` : ''}
                </div>
            </div>
            <div class="gallery-thumbnails">
                ${thumbnailsHtml}
            </div>
        </div>
    `;
}

function changeWorkspaceAttachment(projectId, direction) {
    const state = workspaceAttachmentState[projectId];
    if (!state || !state.attachments || state.attachments.length <= 1) return;
    const total = state.attachments.length;
    const nextIndex = (state.currentIndex + direction + total) % total;
    state.currentIndex = nextIndex;
    renderWorkspaceGallery(projectId);
}

function setWorkspaceAttachmentIndex(projectId, index) {
    const state = workspaceAttachmentState[projectId];
    if (!state || !state.attachments) return;
    if (index < 0 || index >= state.attachments.length) return;
    state.currentIndex = index;
    renderWorkspaceGallery(projectId);
}

// Format file size
function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

function renderAttachmentUploadControls(projectId) {
    return `
        <div class="workspace-upload-control">
            <label for="fileUpload" class="btn btn-primary btn-small">
                <i class="fas fa-upload"></i> Tải tệp lên
            </label>
            <input type="file" id="fileUpload" multiple style="display: none;" onchange="handleFileUpload(${projectId}, this.files)">
            <span>Giới hạn: 50MB mỗi file</span>
        </div>
    `;
}

// Handle file upload
async function handleFileUpload(projectId, files) {
    if (!files || files.length === 0) return;

    const token = localStorage.getItem('access_token');
    if (!token) {
        alert('Vui lòng đăng nhập để tải tệp lên.');
        window.location.href = 'login.html';
        return;
    }

    // Verify token is still valid before uploading
    try {
        const verifyResponse = await fetch(`${API_BASE}/api/v1/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!verifyResponse.ok) {
            alert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('current_user');
            window.location.href = 'login.html';
            return;
        }
    } catch (error) {
        console.error('Token verification error:', error);
        alert('Không thể xác thực phiên đăng nhập. Vui lòng đăng nhập lại.');
        window.location.href = 'login.html';
        return;
    }

    const filesList = document.getElementById('filesList');
    const uploadBtn = document.querySelector('#fileUpload');
    
    // Disable upload button
    if (uploadBtn) uploadBtn.disabled = true;
    if (filesList) {
        filesList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Đang tải lên...</p>';
    }

    // Maximum file size: 50MB
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
    
    // Validate file sizes before uploading
    const oversizedFiles = Array.from(files).filter(file => file.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
        const fileNames = oversizedFiles.map(f => f.name).join(', ');
        const fileSizes = oversizedFiles.map(f => (f.size / (1024 * 1024)).toFixed(2) + 'MB').join(', ');
        alert(`Các file sau vượt quá giới hạn 50MB:\n${fileNames}\nKích thước: ${fileSizes}\n\nVui lòng chọn file nhỏ hơn 50MB.`);
        if (uploadBtn) uploadBtn.disabled = false;
        if (filesList) await loadProjectFiles(projectId);
        return;
    }

    try {
        // Upload each file
        const uploadPromises = Array.from(files).map(async (file) => {
            const formData = new FormData();
            formData.append('file', file);

            console.log('Uploading file:', file.name, 'Size:', (file.size / (1024 * 1024)).toFixed(2) + 'MB', 'to project:', projectId);

            const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/attachments`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                    // Don't set Content-Type - browser will set it automatically with boundary for FormData
                },
                body: formData
            });

            console.log('Upload response status:', response.status);

            if (!response.ok) {
                let errorDetail = 'Failed to upload file';
                try {
                    const error = await response.json();
                    errorDetail = error.detail || error.message || errorDetail;
                    console.error('Upload error:', error);
                    
                    // If token expired during upload, redirect to login
                    if (response.status === 401) {
                        alert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
                        localStorage.removeItem('access_token');
                        localStorage.removeItem('refresh_token');
                        localStorage.removeItem('current_user');
                        window.location.href = 'login.html';
                        return;
                    }
                } catch (e) {
                    console.error('Failed to parse error response:', e);
                    errorDetail = `HTTP ${response.status}: ${response.statusText}`;
                }
                throw new Error(errorDetail);
            }

            return await response.json();
        });

        await Promise.all(uploadPromises);
        
        // Reload project to get updated attachments
        try {
            currentProject = await getProject(projectId);
        } catch (error) {
            console.error('Error reloading project after upload:', error);
            // Continue anyway, we'll reload files list
        }
        
        // Reload files list
        await loadProjectFiles(projectId);
        
        alert('Đã tải tệp lên thành công!');
    } catch (error) {
        console.error('Error uploading files:', error);
        alert('Có lỗi xảy ra khi tải tệp lên: ' + (error.message || 'Unknown error'));
        // Reload files list on error
        await loadProjectFiles(projectId);
    } finally {
        // Re-enable upload button
        if (uploadBtn) uploadBtn.disabled = false;
        // Clear file input
        if (uploadBtn) uploadBtn.value = '';
    }
}

// Download project file
async function downloadProjectFile(projectId, attachmentIndex, event) {
    if (event) {
        event.preventDefault();
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
        alert('Vui lòng đăng nhập để tải file.');
        return;
    }

    try {
        // Get download URL (presigned URL)
        const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/attachments/${attachmentIndex}/download`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            // Open download URL in new tab
            window.open(data.download_url, '_blank');
        } else {
            const error = await response.json();
            alert(error.detail || 'Không thể tải file.');
        }
    } catch (error) {
        console.error('Error downloading file:', error);
        alert('Có lỗi xảy ra khi tải file.');
    }
}

// Delete project file
async function deleteProjectFile(projectId, attachmentIndex, filename) {
    if (!confirm(`Bạn có chắc chắn muốn xóa tệp "${filename}" không?`)) {
        return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
        alert('Vui lòng đăng nhập để xóa file.');
        return;
    }

    console.log(`Deleting file at index ${attachmentIndex} from project ${projectId}`);

    try {
        const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/attachments/${attachmentIndex}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log(`Delete response status: ${response.status}`);

        if (response.ok) {
            const result = await response.json();
            console.log('Delete successful:', result);
            console.log('Deleted project attachments:', result.project ? result.project.attachments : undefined);
            
            // Reload project first to get updated data
            try {
                currentProject = await getProject(projectId);
                console.log('Project reloaded after delete, attachments:', currentProject ? currentProject.attachments : undefined);
            } catch (error) {
                console.error('Error reloading project after delete:', error);
            }
            
            // Force reload files list by fetching fresh project data
            try {
                const freshProject = await getProject(projectId);
                await loadProjectFiles(projectId);
                console.log('Files list reloaded');
            } catch (error) {
                console.error('Error reloading files list:', error);
            }
            
            alert('Đã xóa tệp thành công!');
        } else {
            let errorDetail = 'Không thể xóa tệp.';
            try {
                const error = await response.json();
                errorDetail = error.detail || errorDetail;
                console.error('Delete error:', error);
            } catch (e) {
                errorDetail = `HTTP ${response.status}: ${response.statusText}`;
            }
            alert(errorDetail);
        }
    } catch (error) {
        console.error('Error deleting file:', error);
        alert('Có lỗi xảy ra khi xóa tệp: ' + (error.message || 'Unknown error'));
    }
}

// Expose immediately
window.loadProjectFiles = loadProjectFiles;
window.handleFileUpload = handleFileUpload;
window.deleteProjectFile = deleteProjectFile;
window.downloadProjectFile = downloadProjectFile;
window.changeWorkspaceAttachment = changeWorkspaceAttachment;
window.setWorkspaceAttachmentIndex = setWorkspaceAttachmentIndex;

// Allow Enter key to send message and setup event listeners
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('messageInput');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    // Setup tab button click handlers
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab-name') || this.getAttribute('data-tab');
            if (tabName && typeof switchTab === 'function') {
                switchTab(tabName);
            }
        });
    });

    // Setup send message button
    const sendBtn = document.getElementById('sendMessageBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', function() {
            if (typeof sendMessage === 'function') {
                sendMessage();
            }
        });
    }
});

// All functions are already exposed immediately after definition above
