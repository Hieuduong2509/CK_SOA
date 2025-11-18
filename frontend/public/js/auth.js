// API_BASE is defined in config.js (must load config.js first)
var API_BASE = window.API_BASE || window.location.origin;

// Store token in localStorage
function setToken(token) {
    localStorage.setItem('access_token', token);
}

function setRefreshToken(token) {
    localStorage.setItem('refresh_token', token);
}

function setCurrentUser(user) {
    localStorage.setItem('current_user', JSON.stringify(user));
}

function getToken() {
    return localStorage.getItem('access_token');
}

function getRefreshToken() {
    return localStorage.getItem('refresh_token');
}

function getCurrentUserProfile() {
    const stored = localStorage.getItem('current_user');
    if (!stored) return null;
    try {
        return JSON.parse(stored);
    } catch {
        return null;
    }
}

function clearToken() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('current_user');
}

function logout() {
    clearToken();
    window.location.href = 'login.html';
}

async function login(email, password) {
    try {
        const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        if (response.ok) {
            const data = await response.json();
            setToken(data.access_token);
            if (data.refresh_token) setRefreshToken(data.refresh_token);
            if (data.user) setCurrentUser(data.user);
            return { success: true, data };
        } else {
            const error = await response.json();
            return { success: false, error: error.detail || 'Login failed' };
        }
    } catch (error) {
        return { success: false, error: 'Network error' };
    }
}

async function signup(email, password, name, role = 'client', phone = null, headline = null) {
    try {
        const response = await fetch(`${API_BASE}/api/v1/auth/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password, name, role, phone, headline })
        });
        
        if (response.ok) {
            const data = await response.json();
            return { success: true, data };
        } else {
            const error = await response.json();
            return { success: false, error: error.detail || 'Signup failed' };
        }
    } catch (error) {
        return { success: false, error: 'Network error' };
    }
}

function isAuthenticated() {
    return !!getToken();
}

function redirectIfNotAuthenticated() {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
    }
}

async function fetchCurrentUser() {
    const token = getToken();
    if (!token) return null;
    try {
        const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (response.ok) {
            const user = await response.json();
            setCurrentUser(user);
            return user;
        }
    } catch (error) {
        console.error('fetchCurrentUser error', error);
    }
    return null;
}

// Redirect user to appropriate page based on role
function redirectByRole(user) {
    console.log('redirectByRole called with user:', user);
    
    if (!user) {
        console.log('No user object, redirecting to index.html');
        window.location.href = 'index.html';
        return;
    }
    
    // Handle role - could be string or enum object
    let role = user.role;
    if (typeof role === 'object' && role.value) {
        role = role.value;
    } else if (typeof role === 'object' && role.name) {
        role = role.name.toLowerCase();
    }
    
    if (!role) {
        console.log('No role found, redirecting to index.html');
        window.location.href = 'index.html';
        return;
    }
    
    role = String(role).toLowerCase();
    console.log('Redirecting based on role:', role);
    
    switch (role) {
        case 'admin':
            window.location.href = 'admin.html';
            break;
        case 'freelancer':
            window.location.href = 'dashboard_freelancer.html';
            break;
        case 'client':
        default:
            window.location.href = 'index.html';
            break;
    }
}

window.logout = logout;
window.getToken = getToken;
window.getCurrentUserProfile = getCurrentUserProfile;
window.fetchCurrentUser = fetchCurrentUser;
window.setCurrentUser = setCurrentUser;
window.redirectByRole = redirectByRole;

