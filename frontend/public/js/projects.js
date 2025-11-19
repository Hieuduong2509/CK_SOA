// API_BASE is defined in config.js (must load config.js first)
var API_BASE = window.API_BASE || window.location.origin;

async function createProject(projectData) {
    const token = localStorage.getItem('access_token');
    if (!token) {
        return { success: false, error: 'Vui lòng đăng nhập để đăng dự án' };
    }
    
    try {
        console.log('Creating project with data:', projectData);
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
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                return { success: false, error: `Lỗi ${response.status}: ${response.statusText}` };
            }
            
            console.error('Project creation error:', errorData);
            
            // Handle validation errors
            let errorMessage = 'Không thể tạo dự án. ';
            if (errorData && errorData.detail) {
                if (Array.isArray(errorData.detail)) {
                    // Pydantic validation errors
                    const errors = errorData.detail.map(e => {
                        const field = Array.isArray(e.loc) ? e.loc.slice(1).join('.') : 'unknown';
                        return `${field}: ${e.msg}`;
                    });
                    errorMessage += errors.join('; ');
                } else if (typeof errorData.detail === 'string') {
                    errorMessage += errorData.detail;
                } else {
                    errorMessage += JSON.stringify(errorData.detail);
                }
            } else if (errorData && errorData.message) {
                errorMessage += errorData.message;
            } else {
                errorMessage += 'Vui lòng kiểm tra lại thông tin.';
            }
            
            return { success: false, error: errorMessage, errorData: errorData };
        }
    } catch (error) {
        console.error('Network error:', error);
        return { success: false, error: 'Lỗi kết nối. Vui lòng thử lại sau.' };
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

