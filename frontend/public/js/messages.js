(function () {
    const LAST_CONVERSATION_KEY = 'messages:lastConversationId';
    const state = {
        conversations: [],
        messages: [],
        activeConversationId: null,
        currentUser: null,
        socket: null,
        participantCache: {},
        pendingConversationId: null,
        isConnecting: false
    };

    const selectors = {
        conversationList: document.getElementById('conversationList'),
        conversationsEmpty: document.getElementById('conversationsEmptyState'),
        chatPlaceholder: document.getElementById('chatPlaceholder'),
        chatWindow: document.getElementById('chatWindow'),
        chatPartnerName: document.getElementById('chatPartnerName'),
        chatPartnerMeta: document.getElementById('chatPartnerMeta'),
        chatProjectTag: document.getElementById('chatProjectTag'),
        messageThread: document.getElementById('messageThread'),
        messageForm: document.getElementById('messageComposer'),
        messageInput: document.getElementById('messageInput'),
        conversationSearchInput: document.getElementById('conversationSearchInput')
    };

    document.addEventListener('DOMContentLoaded', initMessagesPage);

    async function initMessagesPage() {
        const token = getToken();
        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        state.currentUser = getCurrentUserProfile() || await fetchCurrentUser();
        if (!state.currentUser) {
            window.location.href = 'login.html';
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const storedConversationId = Number(localStorage.getItem(LAST_CONVERSATION_KEY) || 0);
        state.pendingConversationId = params.get('conversation_id')
            ? Number(params.get('conversation_id'))
            : (storedConversationId || null);

        bindEvents();
        await loadConversations();
        ensureActiveConversation();

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                loadConversations(true);
            }
        });
    }

    function bindEvents() {
        if (selectors.messageForm) {
            selectors.messageForm.addEventListener('submit', handleSendMessage);
        }
        if (selectors.conversationSearchInput) {
            selectors.conversationSearchInput.addEventListener('input', () => {
                renderConversationList(selectors.conversationSearchInput.value.trim().toLowerCase());
            });
        }
    }

    async function loadConversations(preserveActive = false) {
        if (!selectors.conversationList) return;
        selectors.conversationList.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-spinner fa-spin"></i> Đang tải hội thoại...
            </div>
        `;
        try {
            const response = await fetch(`${API_BASE}/api/v1/chat/conversations`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (!response.ok) {
                throw new Error('Không thể tải danh sách hội thoại');
            }
            state.conversations = await response.json();
            await preloadParticipants(state.conversations);
            renderConversationList();
            if (!preserveActive) {
                ensureActiveConversation();
            } else {
                const exists = state.conversations.some(c => c.id === state.activeConversationId);
                if (!exists) {
                    ensureActiveConversation();
                } else {
                    highlightActiveConversation();
                }
            }
        } catch (error) {
            console.error('loadConversations error', error);
            selectors.conversationList.innerHTML = `
                <div class="empty-state small">
                    <i class="fas fa-triangle-exclamation"></i>
                    <p>${error.message || 'Không thể tải hội thoại.'}</p>
                </div>
            `;
        }
    }

    async function preloadParticipants(conversations) {
        const requests = conversations.map(conv => {
            const counterpart = getCounterpartId(conv);
            return counterpart ? fetchParticipant(counterpart) : null;
        });
        await Promise.all(requests);
    }

    function getCounterpartId(conversation) {
        if (!state.currentUser) return null;
        return conversation.participant1_id === state.currentUser.id
            ? conversation.participant2_id
            : conversation.participant1_id;
    }

    async function fetchParticipant(userId) {
        if (!userId || state.participantCache[userId]) {
            return state.participantCache[userId];
        }
        const token = getToken();
        if (!token) return null;
        try {
            const response = await fetch(`${API_BASE}/api/v1/users/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (response.ok) {
                const profile = await response.json();
                state.participantCache[userId] = profile;
                return profile;
            }
            if (response.status === 404) {
                // Will be updated when profile is loaded
                state.participantCache[userId] = { id: userId, display_name: null };
                return state.participantCache[userId];
            }
        } catch (error) {
            console.error('fetchParticipant error', error);
        }
        return null;
    }

    function renderConversationList(filterText = '') {
        if (!selectors.conversationList) return;
        const filtered = state.conversations.filter(conv => {
            if (!filterText) return true;
            const participant = state.participantCache[getCounterpartId(conv)];
            const name = participant?.display_name || 'User';
            return name.toLowerCase().includes(filterText);
        });

        if (!filtered.length) {
            selectors.conversationsEmpty.style.display = 'block';
            selectors.conversationList.innerHTML = '';
            return;
        }
        selectors.conversationsEmpty.style.display = 'none';

        selectors.conversationList.innerHTML = filtered.map(conv => {
            const counterpart = state.participantCache[getCounterpartId(conv)];
            const name = counterpart?.display_name || 'User';
            const avatar = counterpart?.avatar_url
                ? `<img src="${counterpart.avatar_url}" alt="${name}">`
                : `<span class="avatar-placeholder">${name.charAt(0) || 'U'}</span>`;
            const preview = conv.last_message?.content || (conv.project_id ? `Dự án #${conv.project_id}` : 'Chưa có tin nhắn');
            const time = conv.last_message?.created_at
                ? formatTimestamp(conv.last_message.created_at, true)
                : 'Chưa có tin nhắn';
            const unread = conv.unread_count || 0;
            const unreadBadge = unread
                ? `<span class="conversation-unread">${unread > 99 ? '99+' : unread}</span>`
                : '';
            const active = conv.id === state.activeConversationId ? 'active' : '';
            return `
                <article class="conversation-item ${active}" data-conversation="${conv.id}">
                    <div class="conversation-avatar">${avatar}</div>
                    <div class="conversation-body">
                        <div class="conversation-row">
                            <h4>${name}</h4>
                            <div class="conversation-meta">
                                ${unreadBadge}
                                <time>${time}</time>
                            </div>
                        </div>
                        <p>${preview}</p>
                    </div>
                </article>
            `;
        }).join('');

        selectors.conversationList.querySelectorAll('.conversation-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = Number(item.dataset.conversation);
                openConversation(id);
            });
        });
    }

    async function openConversation(conversationId, updateUrl = true) {
        if (!conversationId) {
            console.warn('openConversation: invalid conversationId');
            return;
        }
        
        console.log('openConversation: opening conversation', conversationId, 'current active:', state.activeConversationId);
        
        if (conversationId === state.activeConversationId && state.messages.length) {
            console.log('openConversation: already open, skipping');
            return;
        }
        
        // Clear messages from previous conversation (except temp messages which will be filtered)
        const previousConversationId = state.activeConversationId;
        state.activeConversationId = conversationId;
        
        console.log('openConversation: switched from', previousConversationId, 'to', conversationId);
        
        // Clear messages that don't belong to the new conversation
        const beforeFilter = state.messages.length;
        state.messages = state.messages.filter(m => {
            // Keep temp messages that belong to the new conversation
            if (m.id && String(m.id).startsWith('temp_')) {
                return m.conversation_id === conversationId;
            }
            // Remove all non-temp messages (they will be reloaded)
            return false;
        });
        console.log('openConversation: filtered messages', beforeFilter, '->', state.messages.length);
        
        if (updateUrl) {
            const params = new URLSearchParams(window.location.search);
            params.set('conversation_id', conversationId);
            const base = window.location.pathname;
            window.history.replaceState({}, '', `${base}?${params.toString()}`);
        }
        localStorage.setItem(LAST_CONVERSATION_KEY, String(conversationId));
        highlightActiveConversation();
        await loadMessages(conversationId);
        setupWebSocket(conversationId);
    }

    function highlightActiveConversation() {
        if (!selectors.conversationList) return;
        selectors.conversationList.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.toggle('active', Number(item.dataset.conversation) === state.activeConversationId);
        });
    }

    async function loadMessages(conversationId) {
        if (!selectors.messageThread) return;
        // Only load if this is still the active conversation
        if (conversationId !== state.activeConversationId) {
            console.log('Conversation changed, skipping loadMessages');
            return;
        }
        selectors.chatPlaceholder.style.display = 'none';
        selectors.chatWindow.style.display = 'flex';
        selectors.messageThread.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-spinner fa-spin"></i> Đang tải tin nhắn...
            </div>
        `;
        try {
            const response = await fetch(`${API_BASE}/api/v1/chat/${conversationId}/messages`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (!response.ok) {
                throw new Error('Không thể tải tin nhắn');
            }
            const messages = await response.json();
            // Only update if this is still the active conversation
            if (conversationId === state.activeConversationId) {
                // Keep temp messages that belong to this conversation
                const tempMessages = state.messages.filter(m => 
                    m.id && String(m.id).startsWith('temp_') && 
                    m.conversation_id === conversationId
                );
                state.messages = [...tempMessages, ...messages];
                renderChatHeader(conversationId);
                renderMessages();
                setConversationRead(conversationId);
            }
        } catch (error) {
            console.error('loadMessages error', error);
            if (conversationId === state.activeConversationId) {
                selectors.messageThread.innerHTML = `
                    <div class="empty-state small">
                        <i class="fas fa-triangle-exclamation"></i>
                        <p>${error.message || 'Không thể tải tin nhắn.'}</p>
                    </div>
                `;
            }
        }
    }

    function renderChatHeader(conversationId) {
        const conversation = state.conversations.find(c => c.id === conversationId);
        if (!conversation) return;
        const partner = state.participantCache[getCounterpartId(conversation)];
        selectors.chatPartnerName.textContent = partner?.display_name || 'User';
        selectors.chatPartnerMeta.textContent = partner?.headline || 'Đang hoạt động';
        if (conversation.project_id) {
            selectors.chatProjectTag.style.display = 'inline-flex';
            selectors.chatProjectTag.textContent = `Dự án #${conversation.project_id}`;
        } else {
            selectors.chatProjectTag.style.display = 'none';
        }
    }

    function renderMessages() {
        if (!selectors.messageThread) return;
        
        // Filter messages to only show messages from the active conversation
        const activeMessages = state.messages.filter(msg => {
            if (!msg || !msg.conversation_id) {
                return false;
            }
            // Strict check: conversation_id must match exactly
            const matches = msg.conversation_id === state.activeConversationId;
            if (!matches) {
                console.log('renderMessages: filtering out message from different conversation', {
                    msgConvId: msg.conversation_id,
                    activeConvId: state.activeConversationId,
                    msgContent: msg.content?.substring(0, 20)
                });
            }
            return matches;
        });
        
        if (!activeMessages.length) {
            selectors.messageThread.innerHTML = `
                <div class="empty-state small">
                    <i class="fas fa-comment-dots"></i>
                    <p>Hãy gửi tin nhắn đầu tiên để bắt đầu cuộc trò chuyện.</p>
                </div>
            `;
            return;
        }

        // Sort by created_at
        activeMessages.sort((a, b) => {
            const timeA = new Date(a.created_at || 0);
            const timeB = new Date(b.created_at || 0);
            return timeA - timeB;
        });

        selectors.messageThread.innerHTML = activeMessages.map(msg => {
            const isOwn = msg.sender_id === state.currentUser?.id;
            const messageIdStr = msg.id ? String(msg.id) : '';
            const tempIdAttr = messageIdStr.startsWith('temp_') ? `data-temp-id="${msg.id}"` : '';
            const messageIdAttr = msg.id && !messageIdStr.startsWith('temp_') ? `data-message-id="${msg.id}"` : '';
            const pendingClass = msg.isPending ? 'pending-message' : '';
            const pendingIndicator = msg.isPending ? '<span class="pending-indicator"><i class="fas fa-clock"></i></span>' : '';
            return `
                <div class="message-row ${isOwn ? 'own' : ''} ${msg.isPending ? 'pending' : ''}" ${tempIdAttr} ${messageIdAttr}>
                    <div class="message-bubble ${pendingClass}" style="position: relative;">
                        ${pendingIndicator}
                        <p>${escapeHtml(msg.content || '')}</p>
                        <span class="message-time">${formatTimestamp(msg.created_at, true)}</span>
                    </div>
                </div>
            `;
        }).join('');
        // Auto-scroll to bottom after rendering
        setTimeout(() => {
            if (selectors.messageThread) {
                selectors.messageThread.scrollTop = selectors.messageThread.scrollHeight;
            }
        }, 0);
    }

    function appendMessage(message) {
        if (!message || typeof message !== 'object') {
            console.warn('appendMessage: invalid message object');
            return;
        }
        if (!message.conversation_id || message.conversation_id !== state.activeConversationId) {
            console.log('appendMessage: skipping message - conversation_id mismatch', {
                messageConvId: message.conversation_id,
                activeConvId: state.activeConversationId,
                messageContent: message.content?.substring(0, 20)
            });
            return;
        }
        if (!message.content && !message.sender_id) {
            console.warn('appendMessage: message missing required fields');
            return;
        }
        // Check if message already exists (avoid duplicates)
        const existingIndex = state.messages.findIndex(m => {
            if (!m || !m.id) return false;
            // Direct ID match
            if (m.id === message.id) return true;
            // Check if both are temp messages with same content
            const mIdStr = String(m.id);
            const msgIdStr = message.id ? String(message.id) : '';
            if (mIdStr.startsWith('temp_') && msgIdStr.startsWith('temp_') && m.content === message.content) {
                try {
                    const timeDiff = Math.abs(new Date(m.created_at) - new Date(message.created_at || Date.now()));
                    return timeDiff < 1000;
                } catch (e) {
                    return false;
                }
            }
            return false;
        });
        
        if (existingIndex !== -1) {
            // Update existing message (replace temp with real)
            state.messages[existingIndex] = message;
            // Update DOM if it's a temp message
            if (selectors.messageThread) {
                const tempNode = selectors.messageThread.querySelector(`[data-temp-id="${state.messages[existingIndex].id}"]`);
                if (tempNode) {
                    const isOwn = message.sender_id === state.currentUser?.id;
                    tempNode.className = `message-row ${isOwn ? 'own' : ''}`;
                    tempNode.innerHTML = `
                        <div class="message-bubble">
                            <p>${escapeHtml(message.content || '')}</p>
                            <span class="message-time">${formatTimestamp(message.created_at, true)}</span>
                        </div>
                    `;
                    tempNode.removeAttribute('data-temp-id');
                    if (message.id) {
                        tempNode.setAttribute('data-message-id', message.id);
                    }
                    // Scroll to show updated message
                    // Auto-scroll to bottom when new message is added
                    setTimeout(() => {
                        if (selectors.messageThread) {
                            selectors.messageThread.scrollTop = selectors.messageThread.scrollHeight;
                        }
                    }, 0);
                }
            }
            return;
        }
        
        state.messages.push(message);
        if (selectors.messageThread) {
            const isOwn = message.sender_id === state.currentUser?.id;
            const node = document.createElement('div');
            node.className = `message-row ${isOwn ? 'own' : ''} ${message.isPending ? 'pending' : ''}`;
            const messageIdStr = message.id ? String(message.id) : '';
            if (messageIdStr.startsWith('temp_')) {
                node.setAttribute('data-temp-id', message.id);
            } else if (message.id) {
                node.setAttribute('data-message-id', message.id);
            }
            node.innerHTML = `
                <div class="message-bubble ${message.isPending ? 'pending-message' : ''}" style="position: relative;">
                    ${message.isPending ? '<span class="pending-indicator"><i class="fas fa-clock"></i></span>' : ''}
                    <p>${escapeHtml(message.content || '')}</p>
                    <span class="message-time">${formatTimestamp(message.created_at, true)}</span>
                </div>
            `;
            selectors.messageThread.appendChild(node);
            // Auto-scroll to bottom when new message is added
            setTimeout(() => {
                if (selectors.messageThread) {
                    selectors.messageThread.scrollTop = selectors.messageThread.scrollHeight;
                }
            }, 0);
        }
        // Only update conversation meta if this message belongs to the active conversation
        // or if it's from another conversation (for unread count)
        if (message.conversation_id === state.activeConversationId) {
            const markAsRead = true; // Always mark as read if it's the active conversation
            updateConversationMeta(message.conversation_id, message, markAsRead);
        } else if (message.conversation_id) {
            // Update meta for other conversations (for unread count and last message)
            updateConversationMeta(message.conversation_id, message, false);
        }
    }

    function setupWebSocket(conversationId) {
        if (!conversationId) return;
        
        // If already connecting, wait
        if (state.isConnecting) {
            console.log('WebSocket connection already in progress, skipping...');
            return;
        }
        
        // If socket is already open for this conversation, don't recreate it
        if (state.socket && state.socket.readyState === WebSocket.OPEN) {
            // Check if we're already connected to the same conversation
            if (conversationId === state.activeConversationId) {
                console.log('WebSocket already connected for conversation', conversationId);
                return;
            }
        }
        
        // Close existing socket properly
        if (state.socket) {
            // Only close if socket is open or connecting
            if (state.socket.readyState === WebSocket.OPEN || state.socket.readyState === WebSocket.CONNECTING) {
                // Remove all event handlers to prevent conflicts
                state.socket.onopen = null;
                state.socket.onmessage = null;
                state.socket.onerror = null;
                state.socket.onclose = null;
                try {
                    state.socket.close();
                } catch (e) {
                    console.warn('Error closing socket:', e);
                }
            }
            state.socket = null;
        }
        
        // Set connecting flag
        state.isConnecting = true;
        
        try {
            const wsUrl = buildWebSocketUrl(conversationId);
            console.log('setupWebSocket: Connecting to', wsUrl, 'for conversation', conversationId);
            state.socket = new WebSocket(wsUrl);
            
            // Store conversation ID in socket for verification
            state.socket._conversationId = conversationId;
            
            state.socket.onopen = () => {
                if (!state.socket) {
                    console.warn('WebSocket onopen called but socket is null');
                    return;
                }
                console.log('WebSocket connected for conversation', conversationId, 'URL:', state.socket.url);
                state.isConnecting = false;
                // Verify conversation ID matches
                if (state.socket._conversationId !== conversationId) {
                    console.warn('WebSocket conversation ID mismatch on open', {
                        expected: conversationId,
                        actual: state.socket._conversationId
                    });
                }
            };
            
            state.socket.onmessage = (event) => {
                try {
                    if (!event || !event.data) {
                        console.warn('WebSocket message missing data');
                        return;
                    }
                    const payload = JSON.parse(event.data);
                    if (!payload || typeof payload !== 'object') {
                        console.warn('WebSocket message invalid payload format');
                        return;
                    }
                    
                    // If this is a message we sent (same content and recent), replace temp message
                    if (payload.sender_id === state.currentUser?.id && payload.content) {
                        const tempMessage = state.messages.find(m => {
                            if (!m || !m.id) return false;
                            const mIdStr = String(m.id);
                            return mIdStr.startsWith('temp_') && 
                                   m.content === payload.content &&
                                   (() => {
                                       try {
                                           return Math.abs(new Date(m.created_at) - new Date(payload.created_at || Date.now())) < 5000;
                                       } catch (e) {
                                           return false;
                                       }
                                   })();
                        });
                        if (tempMessage) {
                            // Remove temp message
                            const tempIndex = state.messages.findIndex(m => m.id === tempMessage.id);
                            if (tempIndex !== -1) {
                                state.messages.splice(tempIndex, 1);
                            }
                            // Remove from DOM
                            if (selectors.messageThread) {
                                const tempNode = selectors.messageThread.querySelector(`[data-temp-id="${tempMessage.id}"]`);
                                if (tempNode) {
                                    tempNode.remove();
                                }
                            }
                        }
                    }
                    
                    // Only append if this message belongs to the active conversation
                    if (payload.conversation_id === state.activeConversationId) {
                        console.log('WebSocket: appending message to active conversation', payload.conversation_id);
                        appendMessage(payload);
                    } else {
                        // Update conversation meta for other conversations (but don't append to current view)
                        console.log('WebSocket: message from different conversation, updating meta only', {
                            messageConvId: payload.conversation_id,
                            activeConvId: state.activeConversationId
                        });
                        updateConversationMeta(payload.conversation_id, payload, false);
                    }
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error, event);
                }
            };
            
            state.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                state.isConnecting = false;
            };
            
            state.socket.onclose = (event) => {
                console.log('WebSocket closed', event.code, event.reason);
                state.socket = null;
                state.isConnecting = false;
                
                // Only reconnect if it was an unexpected close and we're still on this conversation
                if (event.code !== 1000 && conversationId === state.activeConversationId) {
                    // Wait a bit before reconnecting
                    setTimeout(() => {
                        if (conversationId === state.activeConversationId && !state.socket && !state.isConnecting) {
                            console.log('Attempting to reconnect WebSocket...');
                            setupWebSocket(conversationId);
                        }
                    }, 2000);
                }
            };
        } catch (error) {
            console.error('setupWebSocket error', error);
            state.socket = null;
            state.isConnecting = false;
        }
    }

    function buildWebSocketUrl(conversationId) {
        const token = getToken();
        const base = API_BASE.replace(/^http/i, API_BASE.startsWith('https') ? 'wss' : 'ws');
        const normalized = base.endsWith('/') ? base.slice(0, -1) : base;
        return `${normalized}/api/v1/chat/ws/${conversationId}?token=${encodeURIComponent(token)}`;
    }

    async function handleSendMessage(event) {
        event.preventDefault();
        const content = (selectors.messageInput.value || '').trim();
        if (!content) return;
        
        if (!state.activeConversationId) {
            console.error('handleSendMessage: No active conversation!');
            alert('Vui lòng chọn một cuộc trò chuyện trước khi gửi tin nhắn.');
            return;
        }
        
        console.log('handleSendMessage: Sending message to conversation', state.activeConversationId, 'content:', content.substring(0, 20));
        
        // Clear input immediately for better UX
        selectors.messageInput.value = '';
        
        // Create temporary message for optimistic update
        const tempMessage = {
            id: 'temp_' + Date.now(),
            conversation_id: state.activeConversationId,
            sender_id: state.currentUser?.id,
            content: content,
            created_at: new Date().toISOString(),
            isPending: true
        };
        
        // Optimistic update: show message immediately
        appendMessage(tempMessage);
        
        // Verify WebSocket is connected to the correct conversation
        const wsConversationId = state.socket?._conversationId || (state.socket?.url ? state.socket.url.match(/\/ws\/(\d+)/)?.[1] : null);
        if (wsConversationId && parseInt(wsConversationId) !== state.activeConversationId) {
            console.warn('WebSocket connected to different conversation!', {
                wsConvId: wsConversationId,
                activeConvId: state.activeConversationId
            });
            // Close and reconnect to correct conversation
            if (state.socket) {
                // Remove all handlers to prevent errors
                state.socket.onopen = null;
                state.socket.onmessage = null;
                state.socket.onerror = null;
                state.socket.onclose = null;
                try {
                    state.socket.close();
                } catch (e) {
                    console.warn('Error closing socket:', e);
                }
                state.socket = null;
            }
            // Wait a bit for socket to close, then reconnect
            await new Promise(resolve => setTimeout(resolve, 100));
            setupWebSocket(state.activeConversationId);
            // Wait for WebSocket to connect before sending
            await new Promise((resolve) => {
                const checkConnection = () => {
                    if (state.socket && state.socket.readyState === WebSocket.OPEN && state.socket._conversationId === state.activeConversationId) {
                        resolve();
                    } else if (state.socket && state.socket.readyState === WebSocket.CONNECTING) {
                        setTimeout(checkConnection, 50);
                    } else {
                        // Timeout after 2 seconds
                        setTimeout(resolve, 2000);
                    }
                };
                checkConnection();
            });
        }
        
        // Try to send via WebSocket first
        if (state.socket && state.socket.readyState === WebSocket.OPEN && state.socket._conversationId === state.activeConversationId) {
            try {
                const payload = { content };
                state.socket.send(JSON.stringify(payload));
                console.log('Message sent via WebSocket to conversation', state.activeConversationId);
            } catch (error) {
                console.error('Error sending via WebSocket:', error);
                // Remove temp message on error
                if (tempMessage && tempMessage.id) {
                    const tempIndex = state.messages.findIndex(m => m.id === tempMessage.id);
                    if (tempIndex !== -1) {
                        state.messages.splice(tempIndex, 1);
                    }
                    if (selectors.messageThread) {
                        const tempNode = selectors.messageThread.querySelector(`[data-temp-id="${tempMessage.id}"]`);
                        if (tempNode) {
                            tempNode.remove();
                        }
                    }
                }
                alert('Không thể gửi tin nhắn. Vui lòng thử lại.');
            }
        } else {
            console.warn('WebSocket not available or wrong conversation, cannot send message', {
                socketExists: !!state.socket,
                readyState: state.socket?.readyState,
                wsConvId: state.socket?._conversationId,
                activeConvId: state.activeConversationId
            });
            // Remove temp message
            if (tempMessage && tempMessage.id) {
                const tempIndex = state.messages.findIndex(m => m.id === tempMessage.id);
                if (tempIndex !== -1) {
                    state.messages.splice(tempIndex, 1);
                }
                if (selectors.messageThread) {
                    const tempNode = selectors.messageThread.querySelector(`[data-temp-id="${tempMessage.id}"]`);
                    if (tempNode) {
                        tempNode.remove();
                    }
                }
            }
            alert('Không thể gửi tin nhắn. WebSocket chưa kết nối. Vui lòng đợi một chút và thử lại.');
        }
    }
    
    async function sendMessageViaHTTP(content, tempMessage) {
        // Note: HTTP endpoint for sending messages doesn't exist
        // Messages can only be sent via WebSocket
        console.warn('sendMessageViaHTTP: HTTP endpoint not available, messages must be sent via WebSocket');
        
        // Remove temp message since we can't send via HTTP
        if (tempMessage && tempMessage.id) {
            const tempIndex = state.messages.findIndex(m => m.id === tempMessage.id);
            if (tempIndex !== -1) {
                state.messages.splice(tempIndex, 1);
            }
            if (selectors.messageThread) {
                const tempNode = selectors.messageThread.querySelector(`[data-temp-id="${tempMessage.id}"]`);
                if (tempNode) {
                    tempNode.remove();
                }
            }
        }
    }

    function ensureActiveConversation() {
        if (!state.conversations.length) {
            selectors.chatPlaceholder.style.display = 'grid';
            selectors.chatWindow.style.display = 'none';
            return;
        }
        let targetId = null;
        if (state.pendingConversationId) {
            const exists = state.conversations.find(c => c.id === state.pendingConversationId);
            if (exists) {
                targetId = state.pendingConversationId;
            }
            state.pendingConversationId = null;
        }
        if (!targetId && state.activeConversationId) {
            const exists = state.conversations.find(c => c.id === state.activeConversationId);
            if (exists) {
                targetId = state.activeConversationId;
            }
        }
        if (!targetId) {
            targetId = state.conversations[0].id;
        }
        if (targetId) {
            openConversation(targetId, false);
        }
    }

    function setConversationRead(conversationId) {
        const conv = state.conversations.find(c => c.id === conversationId);
        if (conv) {
            conv.unread_count = 0;
            renderConversationList(selectors.conversationSearchInput?.value.trim().toLowerCase() || '');
            highlightActiveConversation();
        }
    }

    function updateConversationMeta(conversationId, message, markAsRead) {
        if (!conversationId || !message) {
            console.warn('updateConversationMeta: invalid parameters', conversationId, message);
            return;
        }
        
        // Ensure conversationId matches message.conversation_id
        const targetConversationId = message.conversation_id || conversationId;
        if (targetConversationId !== conversationId) {
            console.warn('updateConversationMeta: conversation_id mismatch', conversationId, message.conversation_id);
            // Use message.conversation_id if available
            if (message.conversation_id) {
                conversationId = message.conversation_id;
            }
        }
        
        const index = state.conversations.findIndex(c => c.id === conversationId);
        if (index === -1) {
            console.log('Conversation not found, reloading conversations');
            loadConversations(true);
            return;
        }
        const conv = state.conversations[index];
        
        // Only update if this message is newer
        if (conv.last_message_at && message.created_at) {
            const lastMsgTime = new Date(conv.last_message_at);
            const newMsgTime = new Date(message.created_at);
            if (newMsgTime <= lastMsgTime) {
                // Message is older, don't update last_message but still update unread count
                if (!markAsRead && message.sender_id !== state.currentUser?.id) {
                    conv.unread_count = (conv.unread_count || 0) + 1;
                }
                return;
            }
        }
        
        conv.last_message = {
            id: message.id,
            conversation_id: message.conversation_id || conversationId,
            sender_id: message.sender_id,
            content: message.content,
            attachments: message.attachments || [],
            created_at: message.created_at
        };
        conv.last_message_at = message.created_at;
        if (markAsRead || message.sender_id === state.currentUser?.id) {
            conv.unread_count = 0;
        } else {
            conv.unread_count = (conv.unread_count || 0) + 1;
        }
        state.conversations.splice(index, 1);
        state.conversations.unshift(conv);
        renderConversationList(selectors.conversationSearchInput?.value.trim().toLowerCase() || '');
        highlightActiveConversation();
    }

    function formatTimestamp(value, includeTimeOnly = false) {
        if (!value) return '';
        const date = new Date(value);
        if (includeTimeOnly) {
            return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit'
        });
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
})();

