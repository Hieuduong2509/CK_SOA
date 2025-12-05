// API_BASE is defined in config.js (must load config.js first)
var API_BASE = window.API_BASE || window.location.origin;
let ws = null;
let conversationId = null;
let currentProject = null;
let currentUser = null;
let currentProjectId = null;
let currentFreelancerId = null;
let currentFreelancerProfile = null;
let hasSubmittedReview = false;
const profileCache = {};

// ======================================================================
// Overrides appended by assistant: improved workspace helpers and flows
// These definitions supersede earlier ones with the same name.
// ======================================================================

// API_BASE fallback (requires config.js loaded first)
var API_BASE = window.API_BASE || window.location.origin;

let ws = null;
let conversationId = null;
let currentProject = null;
let currentUser = null;
let currentProjectId = null;
let currentFreelancerId = null;
let currentFreelancerProfile = null;
let hasSubmittedReview = false;
const profileCache = {};
const workspaceAttachmentState = {};

// --- HELPER: làm sạch cover letter (ẩn DATA_JSON) ---
function cleanCoverLetterDisplay(text) {
  if (!text) return '';
  const parts = String(text).split('DATA_JSON:');
  return parts[0].trim();
}

function ensureProjectActionList() {
  const actionsDiv = document.getElementById('projectActions');
  if (!actionsDiv) return null;
  let actionList = actionsDiv.querySelector('.project-action-list');
  if (!actionList) {
    actionList = document.createElement('div');
    actionList.className = 'project-action-list';
    actionList.style.display = 'flex';
    actionList.style.flexDirection = 'column';
    actionList.style.gap = '0.75rem';
    actionsDiv.appendChild(actionList);
  }
  return { actionsDiv, actionList };
}

const IMAGE_EXTENSIONS = ['jpg','jpeg','png','gif','bmp','svg','webp','avif'];
const VIDEO_EXTENSIONS = ['mp4','mov','avi','mkv','webm','m4v'];
const MEDIA_PLACEHOLDER = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="800" height="600" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%236b7280" font-family="Arial" font-size="32">Preview</text></svg>';

async function fetchUserProfile(userId) {
  if (!userId) return null;
  if (profileCache[userId]) return profileCache[userId];
  try {
    const headers = {};
    const token = (typeof getToken === 'function' && getToken()) || localStorage.getItem('access_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(`${API_BASE}/api/v1/users/${userId}`, { headers });
    if (!response.ok) return null;
    const profile = await response.json();
    profileCache[userId] = profile;
    return profile;
  } catch (e) {
    console.error('fetchUserProfile error', e);
    return null;
  }
}

function normalizeAttachmentsList(rawAttachments) {
  if (!rawAttachments || !Array.isArray(rawAttachments)) return [];
  return rawAttachments.map(att => {
    if (typeof att === 'string') {
      const inferredName = att.split('/').pop() || 'File';
      return { url: att, filename: inferredName };
    }
    if (!att) return null;
    const url = att.url || att.preview_url || att.download_url || '';
    const fallbackName = url ? url.split('/').pop() : 'File';
    return { ...att, filename: att.filename || att.original_name || att.name || fallbackName };
  }).filter(Boolean);
}

function getAttachmentExtension(attachment) {
  if (!attachment) return '';
  const filename = attachment.filename || attachment.original_name || '';
  const parts = String(filename).split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function getAttachmentUrl(attachment) {
  if (!attachment) return '';
  return attachment.url || attachment.preview_url || attachment.download_url || attachment.presigned_url || '';
}

function getFileIconMeta(filename) {
  if (!filename) return { icon: 'fas fa-file', colorClass: 'file-icon-generic text-blue' };
  const ext = String(filename).split('.').pop().toLowerCase();
  if (IMAGE_EXTENSIONS.includes(ext)) return { icon: 'fas fa-file-image', colorClass: 'file-icon-image text-purple' };
  if (VIDEO_EXTENSIONS.includes(ext)) return { icon: 'fas fa-file-video', colorClass: 'file-icon-video text-indigo' };
  if (['pdf'].includes(ext)) return { icon: 'fas fa-file-pdf', colorClass: 'file-icon-pdf text-red' };
  if (['zip','rar','7z','tar','gz'].includes(ext)) return { icon: 'fas fa-file-archive', colorClass: 'file-icon-archive text-amber' };
  if (['doc','docx'].includes(ext)) return { icon: 'fas fa-file-word', colorClass: 'file-icon-doc text-blue' };
  if (['xls','xlsx','csv'].includes(ext)) return { icon: 'fas fa-file-excel', colorClass: 'file-icon-sheet text-green' };
  return { icon: 'fas fa-file', colorClass: 'file-icon-generic text-blue' };
}

function isImageAttachment(att) {
  const ct = ((att && att.content_type) || '').toLowerCase();
  if (ct.includes('image')) return true;
  return IMAGE_EXTENSIONS.includes(getAttachmentExtension(att));
}
function isVideoAttachment(att) {
  const ct = ((att && att.content_type) || '').toLowerCase();
  if (ct.includes('video')) return true;
  return VIDEO_EXTENSIONS.includes(getAttachmentExtension(att));
}

function formatCurrency(value) {
  if (!value) return '0 nghìn đồng';
  const thousands = Number(value) / 1000;
  return new Intl.NumberFormat('vi-VN',{minimumFractionDigits:0,maximumFractionDigits:1}).format(thousands) + ' nghìn đồng';
}
function formatDate(dateString) {
  if (!dateString) return 'Chưa có';
  const d = new Date(dateString);
  return d.toLocaleDateString('vi-VN',{year:'numeric',month:'long',day:'numeric'});
}

async function getProject(projectId) {
  try {
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (res.ok) return await res.json();
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `Failed to fetch project: ${res.status}`);
  } catch (e) {
    console.error('Error fetching project:', e);
    throw e;
  }
}
window.getProject = getProject;

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  const btn = document.querySelector(`[data-tab="${tabName}"]`);
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  const pane = document.getElementById(`tab-${tabName}`);
  if (pane) pane.classList.add('active');
  if (tabName === 'bidders' && currentProjectId) loadBidders(currentProjectId);
  else if (tabName === 'milestones' && currentProjectId) loadMilestones(currentProjectId);
  else if (tabName === 'files' && currentProjectId) loadProjectFiles(currentProjectId);
  else if (tabName === 'activity' && currentProjectId) loadProjectActivities(currentProjectId);
}
window.switchTab = switchTab;

function getUserRole(user) {
  if (!user || !user.role) return null;
  let role = user.role;
  if (typeof role === 'object' && role.value) role = role.value;
  else if (typeof role === 'object' && role.name) role = role.name;
  return String(role).toLowerCase();
}
function isFreelancer(user){ return getUserRole(user) === 'freelancer'; }
function isClient(user, project){
  if (!user || !project) return false;
  const role = getUserRole(user);
  if (role === 'client') return user.id === project.client_id;
  return false;
}

async function loadWorkspace(projectId){
  currentProjectId = projectId;
  currentUser = (typeof getCurrentUserProfile === 'function' && getCurrentUserProfile()) || currentUser;
  if (!currentUser && typeof fetchCurrentUser === 'function') currentUser = await fetchCurrentUser();
  currentProject = await getProject(projectId);
  if (currentProject) {
    if (currentProject.freelancer_id) {
      currentFreelancerId = currentProject.freelancer_id;
      currentFreelancerProfile = await fetchUserProfile(currentFreelancerId);
    } else if (currentProject.accepted_bid_id) {
      try {
        const token = localStorage.getItem('access_token');
        const bidsResponse = await fetch(`${API_BASE}/api/v1/projects/${projectId}/bids`, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
        if (bidsResponse.ok) {
          const bids = await bidsResponse.json();
          const accepted = bids.find(b => b.id === currentProject.accepted_bid_id);
          if (accepted) {
            currentFreelancerId = accepted.freelancer_id;
            currentFreelancerProfile = await fetchUserProfile(currentFreelancerId);
          }
        }
      } catch (e) { console.error('Error fetching accepted bid:', e); }
    } else {
      currentFreelancerProfile = null;
    }
    const t = document.getElementById('projectTitle'); if (t) t.textContent = currentProject.title || '';
    const d = document.getElementById('projectDescription'); if (d) d.textContent = currentProject.description || 'Không có mô tả';

    const userIsFreelancer = isFreelancer(currentUser);
    const userIsClient = isClient(currentUser, currentProject);
    const isProjectFreelancer = userIsFreelancer && (currentProject.freelancer_id === currentUser.id || (currentProject.accepted_bid_id && currentFreelancerId === currentUser.id));

    if (userIsClient || isProjectFreelancer) {
      setupParticipantView();
      await loadProjectDetails(currentProject);
      loadBidders(projectId);
      loadMilestones(projectId);
      loadProjectFiles(projectId);
      await initializeChat(projectId);
      if (userIsClient) {
        if (typeof setupReviewControls === 'function') setupReviewControls();
        if (typeof maybeShowReviewButton === 'function') maybeShowReviewButton();
        if (typeof setupDeliveryControlsForClient === 'function') setupDeliveryControlsForClient();
      } else if (isProjectFreelancer) {
        if (typeof setupDeliveryControlsForFreelancer === 'function') setupDeliveryControlsForFreelancer();
      }
    } else if (userIsFreelancer) {
      setupFreelancerView();
      if (typeof preloadWorkspaceShowcase === 'function') preloadWorkspaceShowcase(currentProject, projectId);
    } else {
      alert('Bạn không có quyền truy cập workspace này.');
      window.location.href = 'index.html';
    }
  }
}
window.loadWorkspace = loadWorkspace;

function setupFreelancerView(){
  const chatContainer = document.getElementById('chatContainer'); if (chatContainer) chatContainer.style.display = 'none';
  const controlPanelWrapper = document.getElementById('controlPanelWrapper'); if (controlPanelWrapper) controlPanelWrapper.style.display = 'none';
  const mainGrid = document.getElementById('workspaceMainGrid'); if (mainGrid) mainGrid.style.gridTemplateColumns = '1fr';
  const showcaseWrapper = document.getElementById('workspaceShowcaseWrapper'); if (showcaseWrapper) showcaseWrapper.style.maxWidth = '100%';
}
function setupParticipantView(){
  const chatContainer = document.getElementById('chatContainer'); if (chatContainer) chatContainer.style.display = 'flex';
  const controlPanelWrapper = document.getElementById('controlPanelWrapper'); if (controlPanelWrapper) controlPanelWrapper.style.display = 'block';
  const mainGrid = document.getElementById('workspaceMainGrid'); if (mainGrid) mainGrid.style.gridTemplateColumns = '1fr 400px';
}

// --- LOAD BIDDERS ---
async function loadBidders(projectId){
  const biddersList = document.getElementById('biddersList');
  if (!biddersList) return;
  biddersList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Đang tải...</p>';
  try{
    const token = localStorage.getItem('access_token');
    if (!token){
      biddersList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Vui lòng đăng nhập để xem ứng viên.</p>';
      return;
    }
    const bidsResponse = await fetch(`${API_BASE}/api/v1/projects/${projectId}/bids`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!bidsResponse.ok) throw new Error('Failed to load bids');
    const bids = await bidsResponse.json();
    const project = currentProject || await getProject(projectId);
    if (!currentFreelancerId && project && project.accepted_bid_id){
      const acceptedBid = bids.find(b => b.id === project.accepted_bid_id);
      if (acceptedBid) currentFreelancerId = acceptedBid.freelancer_id;
    }
    if (!bids.length){
      biddersList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Chưa có ai apply cho dự án này.</p>';
      return;
    }
    const bidsWithProfiles = await Promise.all(
      bids.map(async (bid) => {
        try{
          const profileResponse = await fetch(`${API_BASE}/api/v1/users/${bid.freelancer_id}`, { headers: { 'Authorization': `Bearer ${token}` } });
          if (profileResponse.ok){
            const profile = await profileResponse.json();
            return { ...bid, profile };
          }
        }catch(e){ console.error(`Error fetching profile for freelancer ${bid.freelancer_id}:`, e); }
        return { ...bid, profile: null };
      })
    );
    biddersList.innerHTML = bidsWithProfiles.map(bid => {
      const profile = bid.profile;
      const projectStatus = ((project && project.status) || '').toLowerCase();
      const canAccept = projectStatus === 'open' || projectStatus === 'pending_approval';
      const displayCoverLetter = cleanCoverLetterDisplay(bid.cover_letter);
      return `
        <div class="bidder-card" style="border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.5rem; margin-bottom: 1rem; background: var(--bg-gray);">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:1rem;">
            <div style="flex:1;">
              <h4 style="margin:0 0 0.5rem 0; color:var(--text-primary);">
                ${profile ? `<a href="freelancer_profile.html?id=${profile.user_id}" target="_blank" style="color:var(--primary-color); text-decoration:none;">${profile.headline || profile.display_name || 'Freelancer'}</a>` : `Freelancer #${bid.freelancer_id}`}
              </h4>
              <p style="color:var(--text-secondary); margin:0.5rem 0; font-size:0.9375rem;">
                <strong>Giá đề xuất:</strong> ${formatCurrency(bid.price)} | <strong>Thời gian:</strong> ${bid.timeline_days} ngày
              </p>
            </div>
            <div style="display:flex;gap:0.5rem;flex-shrink:0;flex-direction:column;">
              <button class="btn btn-primary btn-small" onclick="startChatWithBidder(${bid.freelancer_id}, ${projectId})" title="Nhắn tin" style="white-space:nowrap;">
                <i class="fas fa-comment"></i> Nhắn tin
              </button>
              ${canAccept ? `
                <button class="btn btn-success btn-small" onclick="acceptBid(${projectId}, ${bid.id})" title="Duyệt" style="white-space:nowrap;">
                  <i class="fas fa-check"></i> Duyệt
                </button>` : ''}
            </div>
          </div>
          ${displayCoverLetter ? `
            <div style="background:white; padding:1rem; border-radius:var(--radius-md); margin-top:1rem; border-left:3px solid var(--primary-color);">
              <strong style="color:var(--text-primary); font-size:0.875rem;">Thư giới thiệu & Kế hoạch:</strong>
              <p style="margin:0.5rem 0 0 0; color:var(--text-secondary); white-space:pre-wrap; font-size:0.9375rem; line-height:1.6;">${escapeHtml(displayCoverLetter)}</p>
            </div>` : ''}
        </div>`;
    }).join('');
  }catch(e){
    console.error('Error loading bidders:', e);
    biddersList.innerHTML = '<p style="text-align:center;color:var(--danger-color);padding:2rem;">Có lỗi xảy ra khi tải danh sách ứng viên.</p>';
  }
}

// --- LOAD MILESTONES ---
async function loadMilestones(projectId){
  const milestonesList = document.getElementById('milestonesList');
  if (!milestonesList) return;
  milestonesList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Đang tải...</p>';
  try{
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/milestones`, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
    if (response.ok){
      const milestones = await response.json();
      if (!milestones.length){
        milestonesList.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:2rem;">Chưa có milestone nào.</p>';
        return;
      }
      const user = currentUser || (typeof getCurrentUserProfile === 'function' && getCurrentUserProfile());
      let normalizedRole = '';
      if (user && user.role){
        if (typeof user.role === 'string') normalizedRole = user.role;
        else normalizedRole = user.role.value || user.role.name || '';
      }
      normalizedRole = String(normalizedRole).toLowerCase();
      const isClientRole = normalizedRole === 'client';
      const isFreelancerRole = normalizedRole === 'freelancer';
      milestonesList.innerHTML = milestones.map(m => {
        const status = (m.status || '').toLowerCase();
        const statusLabels = {
          'pending':   { label: 'Chờ nạp tiền',    class: 'status-pending',   color: '#9CA3AF' },
          'in_progress': { label: 'Đang thực hiện', class: 'status-progress', color: '#3B82F6' },
          'submitted': { label: 'Đã nộp bài',      class: 'status-submitted', color: '#F59E0B' },
          'approved':  { label: 'Đã hoàn thành',   class: 'status-approved',  color: '#10B981' },
          'paid':      { label: 'Đã thanh toán',   class: 'status-paid',      color: '#10B981' },
          'rejected':  { label: 'Yêu cầu sửa',     class: 'status-rejected',  color: '#EF4444' }
        };
        const info = statusLabels[status] || { label: status, class: 'status-default', color: '#6B7280' };
        let actionButton = '';
        if (isClientRole && status === 'pending'){
          actionButton = `<button class="btn btn-primary btn-small" onclick="depositMilestone(${projectId}, ${m.id}, ${m.amount})"><i class="fas fa-wallet"></i> Nạp tiền (Deposit)</button>`;
        } else if (isClientRole && status === 'submitted'){
          actionButton = `
            <button class="btn btn-success btn-small" onclick="approveMilestone(${projectId}, ${m.id})"><i class="fas fa-check"></i> Duyệt & Trả tiền</button>
            <button class="btn btn-outline btn-small" onclick="requestRevision(${projectId}, ${m.id})" style="margin-left:5px; border-color:#f59e0b; color:#f59e0b;"><i class="fas fa-redo"></i> Yêu cầu sửa</button>`;
        } else if (isFreelancerRole && status === 'pending'){
          actionButton = `<span style="font-style:italic; color:#666; font-size:0.9em;"><i class="fas fa-hourglass-half"></i> Chờ khách hàng nạp tiền...</span>`;
        } else if (isFreelancerRole && (status === 'in_progress' || status === 'rejected')){
          actionButton = `<button class="btn btn-primary btn-small" onclick="submitMilestone(${projectId}, ${m.id})"><i class="fas fa-file-upload"></i> Nộp sản phẩm</button>`;
        }
        return `
          <div style="background: var(--bg-gray); padding: 1.5rem; border-radius: var(--radius-lg); margin-bottom: 1rem; border-left: 4px solid ${info.color}; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.5rem;">
              <div>
                <h4 style="margin:0 0 0.25rem 0; color: var(--text-primary); font-size:1.1em;">${m.title}</h4>
                <div style="color:var(--primary-color); font-weight:700; font-size:1.1em;">${formatCurrency(m.amount)}</div>
              </div>
              <span style="padding:0.25rem 0.75rem;background:${info.color}15;color:${info.color};border-radius:99px;font-size:0.85rem;font-weight:600;border:1px solid ${info.color}30;">
                ${info.label}
              </span>
            </div>
            ${m.description ? `<p style="margin:0.5rem 0; color:var(--text-secondary); font-size:0.95rem; line-height:1.5;">${m.description}</p>` : ''}
            <div style="border-top:1px solid #e5e7eb;margin-top:1rem;padding-top:1rem;display:flex;justify-content:space-between;align-items:center;">
              <div style="font-size:0.85rem;color:var(--text-secondary);">
                ${m.submitted_at ? `<span><i class="fas fa-clock"></i> Nộp: ${formatDate(m.submitted_at)}</span>` : ''}
              </div>
              <div>${actionButton}</div>
            </div>
          </div>`;
      }).join('');
    }
  }catch(e){
    console.error('Error loading milestones:', e);
    milestonesList.innerHTML = '<p style="text-align:center;color:var(--danger-color);padding:2rem;">Có lỗi xảy ra khi tải milestones.</p>';
  }
}

// --- Nạp tiền milestone ---
async function depositMilestone(projectId, milestoneId, amount){
  if (!confirm(`Xác nhận nạp ${formatCurrency(amount)} vào hệ thống để bắt đầu giai đoạn này? Tiền sẽ được giữ an toàn (Escrow).`)) return;
  const token = localStorage.getItem('access_token');
  try{
    const res = await fetch(`${API_BASE}/api/v1/payments/escrow/deposit`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ project_id: projectId, milestone_id: milestoneId, amount: amount, from_wallet: true })
    });
    if (res.ok){
      alert('Nạp tiền thành công! Milestone đã được kích hoạt.');
      loadMilestones(projectId);
    } else {
      const err = await res.json().catch(() => ({}));
      if (res.status === 400 && String(err.detail || '').includes('balance')){
        if (confirm('Số dư ví không đủ. Nạp thêm tiền?')) window.location.href = 'payment.html';
      } else {
        alert(err.detail || 'Lỗi khi nạp tiền.');
      }
    }
  } catch(e){ alert('Lỗi kết nối.'); }
}
window.depositMilestone = depositMilestone;

async function startChatWithBidder(freelancerId, projectId){
  try{
    const token = localStorage.getItem('access_token');
    if (!token){ alert('Vui lòng đăng nhập để nhắn tin.'); return; }
    const res = await fetch(`${API_BASE}/api/v1/chat/start`, {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
      body: JSON.stringify({ participant2_id: freelancerId, project_id: projectId })
    });
    if (res.ok){
      const conv = await res.json();
      conversationId = conv.id;
      connectWebSocket(conversationId, token);
      loadMessages(conversationId);
      alert('Đã bắt đầu cuộc trò chuyện!');
    } else {
      const err = await res.json().catch(()=>({}));
      alert(err.detail || 'Không thể bắt đầu cuộc trò chuyện.');
    }
  }catch(e){
    console.error('Error starting chat:', e);
    alert('Có lỗi xảy ra khi bắt đầu cuộc trò chuyện.');
  }
}
window.startChatWithBidder = startChatWithBidder;

async function acceptBid(projectId, bidId){
  if (!confirm('Bạn có chắc chắn muốn DUYỆT freelancer này cho dự án? Hành động này sẽ tạo ra các mốc thanh toán (Milestone) nhưng chưa trừ tiền ngay.')) return;
  const token = localStorage.getItem('access_token');
  try{
    const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/accept`, {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
      body: JSON.stringify({ bid_id: bidId })
    });
    if (res.ok){
      alert("Đã chấp nhận thầu thành công! Vui lòng vào tab 'Lộ trình & Thanh toán' để nạp tiền cho giai đoạn đầu tiên.");
      location.reload();
    } else {
      alert("Lỗi khi duyệt thầu.");
    }
  }catch(e){
    console.error(e);
    alert("Lỗi kết nối.");
  }
}
window.acceptBid = acceptBid;

async function initializeChat(projectId){
  try{
    const token = localStorage.getItem('access_token');
    if (!token) return;
    const project = currentProject || await getProject(projectId);
    if (!project) return;
    const userIsClient = isClient(currentUser, project);
    const userIsFreelancer = isFreelancer(currentUser);
    let participant2Id = null;
    if (userIsClient){
      participant2Id = project.freelancer_id || currentFreelancerId;
      if (!participant2Id && project.accepted_bid_id){
        // will be set when bids loaded
      }
    } else if (userIsFreelancer){
      participant2Id = project.client_id;
    }
    if (!participant2Id) return;
    const res = await fetch(`${API_BASE}/api/v1/chat/start`, {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
      body: JSON.stringify({ participant2_id: participant2Id, project_id: projectId })
    });
    if (res.ok){
      const conv = await res.json();
      conversationId = conv.id;
      connectWebSocket(conversationId, token);
      loadMessages(conversationId);
    }
  }catch(e){ console.error('Error initializing chat:', e); }
}

function connectWebSocket(convId, token){
  if (!convId || !token) return;
  const base = API_BASE.replace(/^http/i, API_BASE.startsWith('https') ? 'wss' : 'ws');
  const normalized = base.endsWith('/') ? base.slice(0,-1) : base;
  const wsUrl = `${normalized}/api/v1/chat/ws/${convId}?token=${encodeURIComponent(token)}`;
  if (ws) { try{ ws.close(); }catch(_){} ws = null; }
  try{
    ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      try{
        const data = JSON.parse(event.data);
        if (data.type === 'message' && data.message) displayMessage(data.message);
        else if (data.id && data.content) displayMessage(data);
      }catch(_){}
    };
  }catch(e){ console.error(e); }
}

const displayedMessageIds = new Set();
function displayMessage(message){
  try{
    const messagesList = document.getElementById('messagesList');
    if (!messagesList) return;
    const isCurrentUser = currentUser && message.sender_id === currentUser.id;
    const messageId = message.id ? String(message.id) : null;
    if (messageId && displayedMessageIds.has(messageId)) return;
    if (messageId) displayedMessageIds.add(messageId);
    const messageDiv = document.createElement('div');
    messageDiv.className = 'workspace-message-row';
    messageDiv.style.cssText = `display:flex;flex-direction:column;align-items:${isCurrentUser?'flex-end':'flex-start'};margin-bottom:0.75rem;width:100%;`;
    const bubbleStyle = isCurrentUser
      ? `background: linear-gradient(135deg, var(--primary-color) 0%, #6a82fb 100%); color: white; border-radius: 1rem 1rem 0.25rem 1rem;`
      : `background: #f1f3f5; color: #1a202c; border-radius: 1rem 1rem 1rem 0.25rem;`;
    messageDiv.innerHTML = `<div style="${bubbleStyle} padding:0.75rem 1rem; box-shadow:0 2px 4px rgba(0,0,0,0.1); max-width:80%; word-wrap:break-word;">${escapeHtml(message.content)}</div>`;
    messagesList.appendChild(messageDiv);
    setTimeout(() => messagesList.scrollTop = messagesList.scrollHeight, 100);
  }catch(_){}
}

function escapeHtml(text){
  const div = document.createElement('div');
  div.textContent = String(text || '');
  return div.innerHTML;
}

async function loadMessages(convId){
  try{
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${API_BASE}/api/v1/chat/${convId}/messages`, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
    if (res.ok){
      const messages = await res.json();
      const list = document.getElementById('messagesList');
      if (list){
        list.innerHTML = '';
        displayedMessageIds.clear();
        messages.forEach(msg => displayMessage(msg));
      }
    }
  }catch(_){}
}

function sendMessage(){
  const input = document.getElementById('messageInput');
  if (!input) return;
  const content = input.value.trim();
  if (!content || !ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ content, attachments: [] }));
  displayMessage({ id: 'temp_'+Date.now(), sender_id: currentUser?.id, content });
  input.value = '';
}
window.sendMessage = sendMessage;

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('messageInput');
  if (input) input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const tabName = this.getAttribute('data-tab-name') || this.getAttribute('data-tab');
      if (tabName) switchTab(tabName);
    });
  });
  const sendBtn = document.getElementById('sendMessageBtn');
  if (sendBtn) sendBtn.addEventListener('click', sendMessage);
});

function ensureProjectActionList() {
    const actionsDiv = document.getElementById('projectActions');
    if (!actionsDiv) return null;
    let actionList = actionsDiv.querySelector('.project-action-list');
    if (!actionList) {
        actionList = document.createElement('div');
        actionList.className = 'project-action-list';
        actionList.style.display = 'flex';
        actionList.style.flexDirection = 'column';
        actionList.style.gap = '0.75rem';
        actionsDiv.appendChild(actionList);
    }
    return { actionsDiv, actionList };
}
const workspaceAttachmentState = {};

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'avif'];
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'];
const MEDIA_PLACEHOLDER = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="800" height="600" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%236b7280" font-family="Arial" font-size="32">Preview</text></svg>';
async function fetchUserProfile(userId) {
    if (!userId) return null;
    if (profileCache[userId]) {
        return profileCache[userId];
    }
    try {
        const headers = {};
        const token = (typeof getToken === 'function' && getToken()) || localStorage.getItem('access_token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        const response = await fetch(`${API_BASE}/api/v1/users/${userId}`, { headers });
        if (!response.ok) {
            return null;
        }
        const profile = await response.json();
        profileCache[userId] = profile;
        return profile;
    } catch (error) {
        console.error('fetchUserProfile error', error);
        return null;
    }
}

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

// Helper: chọn icon cho file theo extension
function getFileIconMeta(filename) {
    if (!filename) {
        return { icon: 'fas fa-file', colorClass: 'file-icon-generic text-blue' };
    }
    const ext = filename.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'avif'].includes(ext)) {
        return { icon: 'fas fa-file-image', colorClass: 'file-icon-image text-purple' };
    }
    if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'].includes(ext)) {
        return { icon: 'fas fa-file-video', colorClass: 'file-icon-video text-indigo' };
    }
    if (['pdf'].includes(ext)) {
        return { icon: 'fas fa-file-pdf', colorClass: 'file-icon-pdf text-red' };
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
        return { icon: 'fas fa-file-archive', colorClass: 'file-icon-archive text-amber' };
    }
    if (['doc', 'docx'].includes(ext)) {
        return { icon: 'fas fa-file-word', colorClass: 'file-icon-doc text-blue' };
    }
    if (['xls', 'xlsx', 'csv'].includes(ext)) {
        return { icon: 'fas fa-file-excel', colorClass: 'file-icon-sheet text-green' };
    }
    return { icon: 'fas fa-file', colorClass: 'file-icon-generic text-blue' };
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
    } else if (tabName === 'activity' && currentProjectId) {
        loadProjectActivities(currentProjectId);
    }
}
// Expose immediately
window.switchTab = switchTab;

// Helper function to get user role
function getUserRole(user) {
    if (!user || !user.role) return null;
    let role = user.role;
    if (typeof role === 'object' && role.value) {
        role = role.value;
    } else if (typeof role === 'object' && role.name) {
        role = role.name;
    }
    return String(role).toLowerCase();
}

// Helper function to check if user is freelancer
function isFreelancer(user) {
    return getUserRole(user) === 'freelancer';
}

// Helper function to check if user is client/owner
function isClient(user, project) {
    if (!user || !project) return false;
    const role = getUserRole(user);
    if (role === 'client') {
        // Check if user is the owner of the project
        return user.id === project.client_id;
    }
    return false;
}

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
        // For bidding projects, check accepted_bid_id to get freelancer_id
        if (currentProject.freelancer_id) {
            currentFreelancerId = currentProject.freelancer_id;
            currentFreelancerProfile = await fetchUserProfile(currentFreelancerId);
        } else if (currentProject.accepted_bid_id) {
            // Fetch bids to get freelancer_id from accepted bid
            try {
                const token = localStorage.getItem('access_token');
                const bidsResponse = await fetch(`${API_BASE}/api/v1/projects/${projectId}/bids`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                });
                if (bidsResponse.ok) {
                    const bids = await bidsResponse.json();
                    const acceptedBid = bids.find(b => b.id === currentProject.accepted_bid_id);
                    if (acceptedBid) {
                        currentFreelancerId = acceptedBid.freelancer_id;
                        currentFreelancerProfile = await fetchUserProfile(currentFreelancerId);
                    }
                }
            } catch (error) {
                console.error('Error fetching accepted bid:', error);
            }
        } else {
            currentFreelancerProfile = null;
        }
        // Update project header
        document.getElementById('projectTitle').textContent = currentProject.title;
        document.getElementById('projectDescription').textContent = currentProject.description || 'Không có mô tả';
        
        // Check user role and adjust UI accordingly
        const userIsFreelancer = isFreelancer(currentUser);
        const userIsClient = isClient(currentUser, currentProject);
        // For bidding projects, check if user is the freelancer from accepted bid
        const isProjectFreelancer = userIsFreelancer && (
            currentProject.freelancer_id === currentUser.id || 
            (currentProject.accepted_bid_id && currentFreelancerId === currentUser.id)
        );
        
        if (userIsClient || isProjectFreelancer) {
            // Participant view (client & assigned freelancer): full workspace + chat
            setupParticipantView();
            // Load project details tab
            await loadProjectDetails(currentProject);
            // Load initial tab content
            loadBidders(projectId);
            loadMilestones(projectId);
            loadProjectFiles(projectId);
            // Start conversation and connect WebSocket
            await initializeChat(projectId);
            if (userIsClient) {
                setupReviewControls();
                maybeShowReviewButton();
                setupDeliveryControlsForClient();
            } else if (isProjectFreelancer) {
                setupDeliveryControlsForFreelancer();
            }
        } else if (userIsFreelancer) {
            // Freelancer khác (không phải freelancer được chọn) chỉ xem media
            setupFreelancerView();
            preloadWorkspaceShowcase(currentProject, projectId);
        } else {
            // Unauthorized or unknown role
            alert('Bạn không có quyền truy cập workspace này.');
            window.location.href = 'index.html';
            return;
        }
    }
}

// Setup freelancer view - only show media showcase
function setupFreelancerView() {
    // Hide chat container
    const chatContainer = document.getElementById('chatContainer');
    if (chatContainer) {
        chatContainer.style.display = 'none';
    }
    
    // Hide control panel wrapper (sidebar with tabs)
    const controlPanelWrapper = document.getElementById('controlPanelWrapper');
    if (controlPanelWrapper) {
        controlPanelWrapper.style.display = 'none';
    }
    
    // Adjust grid layout to full width for media showcase
    const mainGrid = document.getElementById('workspaceMainGrid');
    if (mainGrid) {
        mainGrid.style.gridTemplateColumns = '1fr';
    }
    
    // Make media showcase full width
    const showcaseWrapper = document.getElementById('workspaceShowcaseWrapper');
    if (showcaseWrapper) {
        showcaseWrapper.style.maxWidth = '100%';
    }
}

// Setup participant view (client + assigned freelancer) - show full workspace
function setupParticipantView() {
    // Show chat container
    const chatContainer = document.getElementById('chatContainer');
    if (chatContainer) {
        chatContainer.style.display = 'flex';
    }
    
    // Show control panel wrapper
    const controlPanelWrapper = document.getElementById('controlPanelWrapper');
    if (controlPanelWrapper) {
        controlPanelWrapper.style.display = 'block';
    }
    
    // Restore grid layout
    const mainGrid = document.getElementById('workspaceMainGrid');
    if (mainGrid) {
        mainGrid.style.gridTemplateColumns = '1fr 400px';
    }
}
// Expose immediately
window.loadWorkspace = loadWorkspace;

function setupReviewControls() {
    const starsContainer = document.getElementById('ratingStars');
    if (!starsContainer) return;
    const stars = starsContainer.querySelectorAll('.star');
    stars.forEach(function (star) {
        star.addEventListener('click', function () {
            const value = this.getAttribute('data-value');
            const ratingInput = document.getElementById('ratingValue');
            if (ratingInput) {
                ratingInput.value = value;
            }
            stars.forEach(function (s) {
                const sVal = s.getAttribute('data-value');
                s.style.color = Number(sVal) <= Number(value) ? '#F59E0B' : '#d1d5db';
            });
        });
    });
}

function maybeShowReviewButton() {
    if (!currentUser || !currentProject || hasSubmittedReview) return;
    const userIsClient = isClient(currentUser, currentProject);
    if (!userIsClient) return;
    const status = String(currentProject.status || '').toUpperCase();
    const containers = ensureProjectActionList();
    if (!containers) return;
    const { actionsDiv, actionList } = containers;
    
    if (status === 'COMPLETED') {
        if (actionsDiv.dataset.hasReviewLink === 'true') return;
        actionsDiv.dataset.hasReviewLink = 'true';
        actionList.insertAdjacentHTML('beforeend', `
            <button class="btn btn-primary" type="button" onclick="goToReviewPage()">
                <i class="fas fa-star"></i> Đánh giá Freelancer
            </button>
        `);
        return;
    }
    
    if (actionsDiv.dataset.hasCompleteButton === 'true') return;
    actionsDiv.dataset.hasCompleteButton = 'true';
    actionList.insertAdjacentHTML('beforeend', `
        <button class="btn btn-success" type="button" onclick="completeProjectAndReview()">
            <i class="fas fa-check-circle"></i> Hoàn thành & Đánh giá
        </button>
    `);
}

function openReviewModal() {
    const modal = document.getElementById('reviewModal');
    if (!modal) return;
    modal.style.display = 'flex';
}

function closeReviewModal() {
    const modal = document.getElementById('reviewModal');
    if (!modal) return;
    modal.style.display = 'none';
}

function goToReviewPage() {
    if (!currentProject || !currentProject.id) return;
    const params = new URLSearchParams();
    params.set('project_id', currentProject.id);
    if (currentFreelancerId) {
        params.set('freelancer_id', currentFreelancerId);
    }
    window.location.href = `review_project.html?${params.toString()}`;
}

async function submitReview() {
    alert('Bạn sẽ được chuyển đến trang đánh giá riêng cho dự án này.');
    goToReviewPage();
}

window.openReviewModal = openReviewModal;
window.closeReviewModal = closeReviewModal;
window.submitReview = submitReview;
window.goToReviewPage = goToReviewPage;

async function completeProjectAndReview() {
    if (!currentProject || !currentProject.id) return;
    if (currentProject.deadline) {
        const deadline = new Date(currentProject.deadline);
        const now = new Date();
        if (deadline > now) {
            const proceedEarly = confirm('Dự án vẫn chưa đến hạn theo kế hoạch. Bạn vẫn muốn đánh dấu hoàn thành sớm?');
            if (!proceedEarly) {
                return;
            }
        }
    }
    if (!confirm('Xác nhận hoàn thành và kết thúc dự án này?')) return;
    const token = getToken ? getToken() : localStorage.getItem('access_token');
    if (!token) {
        alert('Vui lòng đăng nhập để thực hiện thao tác này.');
        return;
    }
    try {
        const resp = await fetch(`${API_BASE}/api/v1/projects/${currentProject.id}/close`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!resp.ok) {
            const err = await resp.json().catch(function () { return {}; });
            alert(err.detail || 'Không thể hoàn thành dự án.');
            return;
        }
        goToReviewPage();
    } catch (e) {
        console.error('completeProjectAndReview error', e);
        alert('Không thể hoàn thành dự án ngay lúc này.');
    }
}

window.completeProjectAndReview = completeProjectAndReview;

// Delivery Flow for GIG_ORDER
function setupDeliveryControlsForFreelancer() {
    if (!currentProject || !currentUser) return;
    const projectType = String(currentProject.project_type || '').toUpperCase();
    const status = String(currentProject.status || '').toUpperCase();
    
    // Only show for GIG_ORDER projects in IN_PROGRESS status
    if (projectType !== 'GIG_ORDER' || status !== 'IN_PROGRESS') return;
    
    const containers = ensureProjectActionList();
    if (!containers) return;
    const { actionsDiv, actionList } = containers;
    if (actionsDiv.dataset.hasDeliverButton === 'true') return;
    actionsDiv.dataset.hasDeliverButton = 'true';
    
    actionList.insertAdjacentHTML('beforeend', `
        <button class="btn btn-primary btn-large" type="button" onclick="openDeliverModal()" style="width: 100%; padding: 1rem; font-size: 1.125rem;">
            <i class="fas fa-paper-plane"></i> Giao hàng ngay
        </button>
    `);
}

function setupDeliveryControlsForClient() {
    if (!currentProject || !currentUser) return;
    const projectType = String(currentProject.project_type || '').toUpperCase();
    const status = String(currentProject.status || '').toUpperCase();
    
    // Only show for GIG_ORDER projects in DELIVERED status
    if (projectType !== 'GIG_ORDER' || status !== 'DELIVERED') return;
    
    const containers = ensureProjectActionList();
    if (!containers) return;
    const { actionsDiv, actionList } = containers;
    if (actionsDiv.dataset.hasDeliveryActions === 'true') return;
    actionsDiv.dataset.hasDeliveryActions = 'true';
    
    actionList.insertAdjacentHTML('beforeend', `
        <div style="display: flex; gap: 0.75rem; flex-direction: column;">
            <button class="btn btn-success btn-large" type="button" onclick="acceptDelivery()" style="width: 100%; padding: 1rem; font-size: 1.125rem;">
                <i class="fas fa-check-circle"></i> Chấp nhận giao hàng
            </button>
            <button class="btn btn-warning" type="button" onclick="openRequestRevisionModal()" style="width: 100%;">
                <i class="fas fa-redo"></i> Yêu cầu sửa lại
            </button>
        </div>
    `);
}

function openDeliverModal() {
    const modal = document.getElementById('deliverModal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('deliverDescription').value = '';
        document.getElementById('deliverFiles').value = '';
    }
}

function closeDeliverModal() {
    const modal = document.getElementById('deliverModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function submitDelivery() {
    if (!currentProject || !currentProjectId) {
        alert('Không tìm thấy thông tin dự án.');
        return;
    }
    
    const token = localStorage.getItem('access_token');
    if (!token) {
        alert('Vui lòng đăng nhập lại.');
        window.location.href = 'login.html';
        return;
    }
    
    const description = document.getElementById('deliverDescription').value.trim();
    const fileInput = document.getElementById('deliverFiles');
    const files = fileInput.files;
    
    if (files.length === 0) {
        const confirmNoFiles = confirm('Bạn chưa chọn file nào. Bạn có chắc muốn giao hàng mà không có file đính kèm?');
        if (!confirmNoFiles) return;
    }
    
    const submitBtn = document.querySelector('#deliverModal .btn-primary');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
    
    try {
        const formData = new FormData();
        if (description) {
            formData.append('description', description);
        }
        for (let i = 0; i < files.length; i++) {
            formData.append('files', files[i]);
        }
        
        const response = await fetch(`${API_BASE}/api/v1/projects/${currentProjectId}/deliver`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || 'Không thể giao hàng. Vui lòng thử lại.');
        }
        
        const updatedProject = await response.json();
        alert('Giao hàng thành công! Khách hàng sẽ được thông báo để xem xét.');
        closeDeliverModal();
        
        // Reload workspace
        await loadWorkspace(currentProjectId);
    } catch (error) {
        console.error('submitDelivery error', error);
        alert('Lỗi: ' + (error.message || 'Không thể giao hàng. Vui lòng thử lại.'));
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

function openRequestRevisionModal() {
    const modal = document.getElementById('requestRevisionModal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('revisionReason').value = '';
    }
}

function closeRequestRevisionModal() {
    const modal = document.getElementById('requestRevisionModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function submitRevisionRequest() {
    if (!currentProject || !currentProjectId) {
        alert('Không tìm thấy thông tin dự án.');
        return;
    }
    
    const token = localStorage.getItem('access_token');
    if (!token) {
        alert('Vui lòng đăng nhập lại.');
        window.location.href = 'login.html';
        return;
    }
    
    const reason = document.getElementById('revisionReason').value.trim();
    if (!reason) {
        alert('Vui lòng nhập lý do yêu cầu chỉnh sửa.');
        return;
    }
    
    const submitBtn = document.querySelector('#requestRevisionModal .btn-warning');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
    
    try {
        const response = await fetch(`${API_BASE}/api/v1/projects/${currentProjectId}/request-revision`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason: reason })
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || 'Không thể yêu cầu chỉnh sửa. Vui lòng thử lại.');
        }
        
        const updatedProject = await response.json();
        alert('Yêu cầu chỉnh sửa đã được gửi. Freelancer sẽ được thông báo.');
        closeRequestRevisionModal();
        
        // Reload workspace
        await loadWorkspace(currentProjectId);
    } catch (error) {
        console.error('submitRevisionRequest error', error);
        alert('Lỗi: ' + (error.message || 'Không thể yêu cầu chỉnh sửa. Vui lòng thử lại.'));
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

async function acceptDelivery() {
    if (!currentProject || !currentProjectId) {
        alert('Không tìm thấy thông tin dự án.');
        return;
    }
    
    const confirmAccept = confirm('Bạn có chắc chắn muốn chấp nhận giao hàng này? Sau khi chấp nhận, dự án sẽ được đánh dấu hoàn thành và thanh toán sẽ được giải phóng.');
    if (!confirmAccept) return;
    
    const token = localStorage.getItem('access_token');
    if (!token) {
        alert('Vui lòng đăng nhập lại.');
        window.location.href = 'login.html';
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/v1/projects/${currentProjectId}/accept-delivery`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || 'Không thể chấp nhận giao hàng. Vui lòng thử lại.');
        }
        
        const updatedProject = await response.json();
        alert('Chấp nhận giao hàng thành công! Dự án đã được đánh dấu hoàn thành.');
        
        // Reload workspace
        await loadWorkspace(currentProjectId);
    } catch (error) {
        console.error('acceptDelivery error', error);
        alert('Lỗi: ' + (error.message || 'Không thể chấp nhận giao hàng. Vui lòng thử lại.'));
    }
}

// Expose functions
window.openDeliverModal = openDeliverModal;
window.closeDeliverModal = closeDeliverModal;
window.submitDelivery = submitDelivery;
window.openRequestRevisionModal = openRequestRevisionModal;
window.closeRequestRevisionModal = closeRequestRevisionModal;
window.submitRevisionRequest = submitRevisionRequest;
window.acceptDelivery = acceptDelivery;

// Load project details
async function loadProjectDetails(project) {
    const detailsDiv = document.getElementById('projectDetails');
    const assignmentBlock = await renderFreelancerAssignment(project);
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
            ${assignmentBlock}
            <div id="projectActions" style="margin-top: 1.5rem;"></div>
        </div>
    `;

    // Load and display requirements for freelancer
    loadProjectRequirements(project);
}

async function renderFreelancerAssignment(project) {
    let freelancerId = currentFreelancerId || project.freelancer_id || (project.service_snapshot && project.service_snapshot.freelancer && project.service_snapshot.freelancer.id);
    
    // For bidding projects, if no freelancer_id but has accepted_bid_id, fetch from bids
    if (!freelancerId && project.accepted_bid_id) {
        try {
            const token = localStorage.getItem('access_token');
            const bidsResponse = await fetch(`${API_BASE}/api/v1/projects/${project.id}/bids`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (bidsResponse.ok) {
                const bids = await bidsResponse.json();
                const acceptedBid = bids.find(b => b.id === project.accepted_bid_id);
                if (acceptedBid) {
                    freelancerId = acceptedBid.freelancer_id;
                    if (!currentFreelancerProfile) {
                        currentFreelancerProfile = await fetchUserProfile(freelancerId);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching accepted bid for freelancer assignment:', error);
        }
    }
    
    const snapshotFreelancer = (project.service_snapshot && project.service_snapshot.freelancer) || {};
    const profile = currentFreelancerProfile || snapshotFreelancer || {};

    if (!freelancerId) {
        return `
            <div style="border: 1px dashed var(--border-color); border-radius: var(--radius-xl); padding: 1.25rem; background: var(--bg-gray);">
                <h4 style="margin: 0 0 0.5rem 0; color: var(--text-primary);">
                    <i class="fas fa-user-clock" style="color: var(--warning-color); margin-right: 0.5rem;"></i>
                    Chưa có freelancer nào được giao
                </h4>
                <p style="margin: 0; color: var(--text-secondary);">Vui lòng duyệt một freelancer trong tab Ứng viên để bắt đầu dự án.</p>
            </div>
        `;
    }

    const name = profile.display_name || profile.name || snapshotFreelancer.name || `Freelancer #${freelancerId}`;
    const headline = profile.headline || snapshotFreelancer.headline || 'Freelancer đang thực hiện dự án này.';
    const avatar = profile.avatar_url || snapshotFreelancer.avatar || `https://ui-avatars.com/api/?background=random&name=${encodeURIComponent(name)}`;
    const rating = typeof profile.rating === 'number' ? profile.rating.toFixed(1) : (snapshotFreelancer.rating ? Number(snapshotFreelancer.rating).toFixed(1) : '—');
    const experience = profile.experience_level || snapshotFreelancer.experience_level || 'Đang cập nhật';

    return `
        <div style="border: 1px solid var(--border-color); border-radius: var(--radius-2xl); padding: 1.25rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <img src="${avatar}" alt="${name}" style="width: 56px; height: 56px; border-radius: 50%; object-fit: cover; border: 2px solid var(--bg-gray);">
                    <div>
                        <p style="margin: 0; font-size: 0.825rem; color: var(--text-secondary); text-transform: uppercase;">Freelancer phụ trách</p>
                        <h3 style="margin: 0; font-size: 1.25rem;">${name}</h3>
                        <p style="margin: 0.25rem 0 0 0; color: var(--text-secondary); font-size: 0.95rem;">${headline}</p>
                    </div>
                </div>
                <div style="text-align: right;">
                    <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary);">Trạng thái dự án</p>
                    <strong style="font-size: 1.05rem;">${formatProjectStatusLabel(project.status)}</strong>
                </div>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 1rem;">
                <div style="flex: 1;">
                    <p style="margin: 0; font-size: 0.825rem; color: var(--text-secondary); text-transform: uppercase;">Đánh giá</p>
                    <p style="margin: 0.25rem 0 0 0; font-size: 1.25rem; color: var(--primary-color); font-weight: 600;">
                        <i class="fas fa-star"></i> ${rating}
                    </p>
                </div>
                <div style="flex: 1;">
                    <p style="margin: 0; font-size: 0.825rem; color: var(--text-secondary); text-transform: uppercase;">Kinh nghiệm</p>
                    <p style="margin: 0.25rem 0 0 0; font-size: 1rem;">${experience}</p>
                </div>
                <div style="flex: 1; display: flex; align-items: flex-end; justify-content: flex-end; gap: 0.5rem;">
                    <a class="btn btn-secondary btn-small" href="freelancer_profile.html?id=${freelancerId}" target="_blank">
                        <i class="fas fa-user"></i> Xem hồ sơ
                    </a>
                </div>
            </div>
        </div>
    `;
}

function formatProjectStatusLabel(status) {
    const normalized = String(status || '').toUpperCase();
    const map = {
        'PENDING_APPROVAL': 'Đang chờ duyệt',
        'OPEN': 'Đang tìm freelancer',
        'IN_PROGRESS': 'Đang thực hiện',
        'DELIVERED': 'Đã giao hàng',
        'COMPLETED': 'Đã hoàn thành',
        'CANCELLED': 'Đã hủy',
        'DISPUTED': 'Tranh chấp'
    };
    return map[normalized] || normalized || 'Không xác định';
}

// Load and display project requirements (for freelancer to view client answers)
function loadProjectRequirements(project) {
    const requirementsSection = document.getElementById('projectRequirements');
    const requirementsDisplay = document.getElementById('requirementsDisplay');
    if (!requirementsSection || !requirementsDisplay) return;

    // Only show for freelancer (not client)
    const user = currentUser || getCurrentUserProfile();
    const userIsFreelancer = user && isFreelancer(user) && project.freelancer_id === user.id;
    
    if (!userIsFreelancer) {
        requirementsSection.style.display = 'none';
        return;
    }

    const requirementsAnswers = project.requirements_answers || [];
    if (!requirementsAnswers || requirementsAnswers.length === 0) {
        requirementsSection.style.display = 'none';
        return;
    }

    requirementsSection.style.display = 'block';
    requirementsDisplay.innerHTML = requirementsAnswers.map((req, index) => {
        let answerHtml = '';
        if (Array.isArray(req.answer)) {
            // Checkbox answers (multiple)
            answerHtml = `
                <ul style="margin: 0.5rem 0 0 0; padding-left: 1.5rem; color: var(--text-primary);">
                    ${req.answer.map(ans => `<li>${escapeHtml(ans)}</li>`).join('')}
                </ul>
            `;
        } else {
            // Text/textarea/select answers (single)
            answerHtml = `
                <p style="margin: 0.5rem 0 0 0; color: var(--text-primary); padding: 0.75rem; background: var(--bg-gray); border-radius: var(--radius-md); white-space: pre-wrap;">
                    ${escapeHtml(req.answer || 'Chưa có câu trả lời')}
                </p>
            `;
        }

        return `
            <div class="requirement-display-item" style="margin-bottom: 1.5rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; align-items: start; gap: 0.75rem;">
                    <div style="flex-shrink: 0; width: 32px; height: 32px; border-radius: 50%; background: var(--primary-color); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.875rem;">
                        ${index + 1}
                    </div>
                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 0.5rem 0; font-size: 1rem; color: var(--text-primary); font-weight: 500;">
                            ${escapeHtml(req.question || `Câu hỏi ${index + 1}`)}
                        </h4>
                        ${answerHtml}
                    </div>
                </div>
            </div>
        `;
    }).join('') || '<p class="text-muted">Chưa có yêu cầu nào từ khách hàng.</p>';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

        // If project has accepted bid, determine freelancer id
        if (!currentFreelancerId && project && project.accepted_bid_id) {
            const acceptedBid = bids.find(b => b.id === project.accepted_bid_id);
            if (acceptedBid) {
                currentFreelancerId = acceptedBid.freelancer_id;
            }
        }

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

// Accept bid - redirect to payment page
async function acceptBid(projectId, bidId) {
    if (!confirm('Bạn có chắc chắn muốn duyệt người apply này không? Bạn sẽ được chuyển đến trang thanh toán.')) {
        return;
    }

    // Redirect to payment page with project_id and bid_id
    window.location.href = `payment.html?project_id=${projectId}&bid_id=${bidId}`;
}
// Expose immediately
window.acceptBid = acceptBid;

// Initialize chat
async function initializeChat(projectId) {
    try {
        const token = localStorage.getItem('access_token');
        if (!token) {
            console.warn('No token available for chat');
            return;
        }

        // Get project to find the other participant
        const project = currentProject || await getProject(projectId);
        if (!project) {
            console.warn('Project not found for chat initialization');
            return;
        }

        // Determine current user role
        const userIsClient = isClient(currentUser, project);
        const userIsFreelancer = isFreelancer(currentUser);
        
        let participant2Id = null;

        if (userIsClient) {
            // Client needs to chat with freelancer
            // Find freelancer_id: check direct assignment first, then accepted bid
            participant2Id = project.freelancer_id || currentFreelancerId;
            
            if (!participant2Id && project.accepted_bid_id) {
                try {
                    const bidsResponse = await fetch(`${API_BASE}/api/v1/projects/${projectId}/bids`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (bidsResponse.ok) {
                        const bids = await bidsResponse.json();
                        const acceptedBid = bids.find(b => b.id === project.accepted_bid_id);
                        if (acceptedBid) {
                            participant2Id = acceptedBid.freelancer_id;
                        }
                    }
                } catch (error) {
                    console.error('Error fetching bids for chat:', error);
                }
            }
        } else if (userIsFreelancer) {
            // Freelancer needs to chat with client (project owner)
            participant2Id = project.client_id;
        }

        if (!participant2Id) {
            console.warn('No participant found for chat initialization', {
                userIsClient,
                userIsFreelancer,
                projectUserId: project.user_id,
                projectOwnerId: project.owner_id,
                projectFreelancerId: project.freelancer_id
            });
            return;
        }

        // Get or create conversation
        const response = await fetch(`${API_BASE}/api/v1/chat/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                participant2_id: participant2Id,
                project_id: projectId
            })
        });
        
        if (response.ok) {
            const conversation = await response.json();
            conversationId = conversation.id;
            connectWebSocket(conversationId, token);
            loadMessages(conversationId);
            console.log('Chat initialized successfully', {
                conversationId,
                participant2Id,
                userRole: userIsClient ? 'client' : 'freelancer'
            });
        } else {
            const error = await response.json().catch(() => ({}));
            console.error('Error starting conversation:', error);
        }
    } catch (error) {
        console.error('Error initializing chat:', error);
    }
}

// Connect WebSocket
function connectWebSocket(convId, token) {
    if (!convId || !token) {
        console.error('Missing conversation ID or token for WebSocket');
        return;
    }

    // Build WebSocket URL (same format as messages.js)
    const base = API_BASE.replace(/^http/i, API_BASE.startsWith('https') ? 'wss' : 'ws');
    const normalized = base.endsWith('/') ? base.slice(0, -1) : base;
    const wsUrl = `${normalized}/api/v1/chat/ws/${convId}?token=${encodeURIComponent(token)}`;
    
    // Close existing connection if any
    if (ws) {
        ws.onclose = null; // Prevent reconnect loop
        ws.close();
        ws = null;
    }
    
    try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('Workspace WebSocket connected for conversation', convId);
        };

        ws.onmessage = (event) => {
            try {
                if (!event || !event.data) {
                    console.warn('WebSocket message missing data');
                    return;
                }
                
                // Skip if data is not a string (might be from extension interference)
                if (typeof event.data !== 'string') {
                    console.warn('WebSocket message data is not a string, skipping');
                    return;
                }
                
                const data = JSON.parse(event.data);
                
                // Validate message structure
                if (!data || typeof data !== 'object') {
                    console.warn('WebSocket message invalid structure');
                    return;
                }
                
                // Handle different message formats
                if (data.type === 'message' && data.message && typeof data.message === 'object') {
                    // Validate message object
                    if (data.message.content !== undefined && data.message.sender_id !== undefined) {
                        displayMessage(data.message);
                    }
                } else if (data.id && data.content !== undefined && data.sender_id !== undefined) {
                    // Direct message object - validate required fields
                    displayMessage(data);
                } else {
                    console.warn('WebSocket message invalid format:', data);
                }
            } catch (error) {
                // Silently ignore errors from external extensions
                if (error && error.message && !error.message.includes('payload')) {
                    console.error('Error parsing WebSocket message:', error);
                }
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        ws.onclose = (event) => {
            console.log('Workspace WebSocket closed', event.code, event.reason);
            ws = null;
        };
    } catch (error) {
        console.error('Error creating WebSocket:', error);
        ws = null;
    }
}

// Track displayed messages to prevent duplicates
const displayedMessageIds = new Set();

// Display message with chat bubbles
function displayMessage(message) {
    try {
        if (!message || typeof message !== 'object') {
            console.warn('displayMessage: invalid message object');
            return;
        }
        
        // Validate required fields
        if (message.sender_id === undefined || message.content === undefined) {
            console.warn('displayMessage: message missing required fields', message);
            return;
        }
        
        const messagesList = document.getElementById('messagesList');
        if (!messagesList) {
            console.warn('messagesList element not found');
            return;
        }

        const isCurrentUser = currentUser && message.sender_id === currentUser.id;
        
        // Generate unique message identifier
        const messageId = message.id ? String(message.id) : null;
        const messageContent = String(message.content || '').trim();
        const messageSenderId = String(message.sender_id || '');
        const messageCreatedAt = message.created_at || new Date().toISOString();
        
        // Check if message already exists (avoid duplicates)
        // Check by ID first
        if (messageId) {
            const existingById = messagesList.querySelector(`[data-message-id="${messageId}"]`);
            if (existingById) {
                // Update existing message if it's a temp message being replaced
                if (existingById.hasAttribute('data-temp-message')) {
                    existingById.removeAttribute('data-temp-message');
                    existingById.setAttribute('data-message-id', messageId);
                    // Update content if needed
                    const contentDiv = existingById.querySelector('div[style*="word-wrap"]');
                    if (contentDiv && contentDiv.textContent !== messageContent) {
                        contentDiv.textContent = messageContent;
                    }
                }
                return; // Message already displayed
            }
            
            // Also check in our tracking set
            if (displayedMessageIds.has(messageId)) {
                return; // Already processed
            }
        }
        
        // For temp messages or messages without ID, check by content + sender + time
        const allMessages = messagesList.querySelectorAll('.workspace-message-row');
        for (const msgEl of allMessages) {
            const msgContent = (msgEl.querySelector('div[style*="word-wrap"]')?.textContent || '').trim();
            const msgSender = msgEl.getAttribute('data-sender-id') || '';
            const msgTime = msgEl.getAttribute('data-created-at') || '';
            const msgId = msgEl.getAttribute('data-message-id') || '';
            
            // Skip if checking against itself
            if (messageId && msgId === messageId) {
                continue;
            }
            
            // Check for duplicate: same content, same sender, similar time
            if (msgContent === messageContent && 
                msgSender === messageSenderId &&
                Math.abs(new Date(msgTime || 0).getTime() - new Date(messageCreatedAt).getTime()) < 5000) {
                return; // Duplicate found
            }
        }

        // Mark as displayed
        if (messageId) {
            displayedMessageIds.add(messageId);
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = 'workspace-message-row';
        if (messageId) {
            messageDiv.setAttribute('data-message-id', messageId);
        } else {
            messageDiv.setAttribute('data-temp-message', 'true');
            messageDiv.setAttribute('data-message-id', `temp_${Date.now()}_${Math.random()}`);
        }
        messageDiv.setAttribute('data-sender-id', messageSenderId);
        messageDiv.setAttribute('data-created-at', messageCreatedAt);
        messageDiv.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: ${isCurrentUser ? 'flex-end' : 'flex-start'};
            margin-bottom: 0.75rem;
            width: 100%;
            padding: 0;
        `;

        const bubbleStyle = isCurrentUser ? `
            background: linear-gradient(135deg, var(--primary-color) 0%, #6a82fb 100%);
            color: white;
            border-radius: 1rem 1rem 0.25rem 1rem;
            max-width: 80%;
            min-width: 60px;
            word-wrap: break-word;
            white-space: pre-wrap;
            margin-left: auto;
            margin-right: 0;
        ` : `
            background: #f1f3f5;
            color: #1a202c;
            border-radius: 1rem 1rem 1rem 0.25rem;
            max-width: 80%;
            min-width: 60px;
            word-wrap: break-word;
            white-space: pre-wrap;
            margin-left: 0;
            margin-right: auto;
        `;

        const time = new Date(messageCreatedAt).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
        });

        messageDiv.innerHTML = `
            <div style="${bubbleStyle} padding: 0.75rem 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: inline-block;">
                <div style="word-wrap: break-word; white-space: pre-wrap; line-height: 1.5; margin: 0;">${escapeHtml(messageContent)}</div>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem; padding: 0 0.75rem; text-align: ${isCurrentUser ? 'right' : 'left'};">
                ${time}
            </div>
        `;

        messagesList.appendChild(messageDiv);
        // Scroll to bottom
        setTimeout(() => {
            messagesList.scrollTop = messagesList.scrollHeight;
        }, 100);
    } catch (error) {
        // Silently ignore errors from external extensions
        if (error && error.message && !error.message.includes('payload')) {
            console.error('Error displaying message:', error, message);
        }
    }
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
                // Clear existing messages and tracking
                messagesList.innerHTML = '';
                displayedMessageIds.clear();
                // Display all messages
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
    if (!input) return;
    
    const content = input.value.trim();
    if (!content) return;

    if (!conversationId) {
        alert('Chưa có cuộc trò chuyện. Vui lòng đợi hệ thống khởi tạo chat.');
        return;
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
        try {
            // Send via WebSocket
            ws.send(JSON.stringify({ content, attachments: [] }));
            
            // Optimistically display message
            const tempMessage = {
                id: 'temp_' + Date.now(),
                sender_id: currentUser?.id,
                content: content,
                created_at: new Date().toISOString()
            };
            displayMessage(tempMessage);
            
            input.value = '';
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Không thể gửi tin nhắn. Vui lòng thử lại.');
        }
    } else {
        alert('Kết nối chat chưa sẵn sàng. Vui lòng đợi một chút và thử lại.');
        console.warn('WebSocket not ready:', {
            wsExists: !!ws,
            readyState: ws?.readyState,
            conversationId: conversationId
        });
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
            const meta = getFileIconMeta(attachment.filename || '');
            return `
                <div class="file-item">
                    <div class="file-item-main">
                        <div class="file-item-icon ${meta.colorClass}">
                            <i class="${meta.icon}"></i>
                        </div>
                        <div class="file-item-text">
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

async function loadProjectActivities(projectId) {
    const container = document.getElementById('activityList');
    if (!container) return;

    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Đang tải lịch sử hoạt động...</p>';

    const token = localStorage.getItem('access_token');
    if (!token) {
        container.innerHTML = '<p style="text-align: center; color: var(--danger-color); padding: 2rem;">Vui lòng đăng nhập để xem hoạt động dự án.</p>';
        return;
    }

    try {
        const resp = await fetch(`${API_BASE}/api/v1/projects/${projectId}/activities`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            container.innerHTML = `<p style="text-align: center; color: var(--danger-color); padding: 2rem;">Không thể tải hoạt động: ${err.detail || resp.status}</p>`;
            return;
        }

        const activities = await resp.json();
        if (!Array.isArray(activities) || activities.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Chưa có hoạt động nào cho dự án này.</p>';
            return;
        }

        const itemsHtml = activities
            .map((act) => {
                const timeStr = act.created_at ? new Date(act.created_at).toLocaleString('vi-VN') : '';
                return `
                    <div class="activity-item">
                        <div class="activity-icon">
                            <i class="fas fa-circle"></i>
                        </div>
                        <div class="activity-body">
                            <div class="activity-main">
                                <div class="activity-description">${act.description || act.action_type}</div>
                                <div class="activity-time">${timeStr}</div>
                            </div>
                        </div>
                    </div>
                `;
            })
            .join('');

        container.innerHTML = `
            <div class="activity-timeline">
                ${itemsHtml}
            </div>
        `;
    } catch (error) {
        console.error('Error loading activities:', error);
        container.innerHTML = '<p style="text-align: center; color: var(--danger-color); padding: 2rem;">Có lỗi xảy ra khi tải lịch sử hoạt động.</p>';
    }
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
// --- THÊM HÀM NÀY VÀO TRƯỚC HÀM loadBidders ---

function cleanCoverLetterDisplay(text) {
    if (!text) return '';
    // Tìm vị trí của chuỗi DATA_JSON và cắt bỏ toàn bộ phần sau nó
    const parts = text.split('DATA_JSON:');
    return parts[0].trim();
}

// --- CẬP NHẬT LẠI HÀM loadBidders ---

async function loadBidders(projectId) {
    const biddersList = document.getElementById('biddersList');
    if (!biddersList) return; // Safety check

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

        // If project has accepted bid, determine freelancer id
        if (!currentFreelancerId && project && project.accepted_bid_id) {
            const acceptedBid = bids.find(b => b.id === project.accepted_bid_id);
            if (acceptedBid) {
                currentFreelancerId = acceptedBid.freelancer_id;
            }
        }

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
            
            // SỬ DỤNG HÀM CLEAN DATA TẠI ĐÂY
            const displayCoverLetter = cleanCoverLetterDisplay(bid.cover_letter);

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
                    ${displayCoverLetter ? `
                        <div style="background: white; padding: 1rem; border-radius: var(--radius-md); margin-top: 1rem; border-left: 3px solid var(--primary-color);">
                            <strong style="color: var(--text-primary); font-size: 0.875rem;">Thư giới thiệu & Kế hoạch:</strong>
                            <p style="margin: 0.5rem 0 0 0; color: var(--text-secondary); white-space: pre-wrap; font-size: 0.9375rem; line-height: 1.6;">${escapeHtml(displayCoverLetter)}</p>
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
