// API_BASE is defined in config.js (must load config.js first)
var API_BASE = window.API_BASE || window.location.origin;

async function loadDisputes() {
    try {
        const response = await fetch(`${API_BASE}/api/v1/admin/disputes`);
        if (response.ok) {
            const disputes = await response.json();
            const list = document.getElementById('disputesList');
            list.innerHTML = disputes.map(d => `
                <div style="background: white; padding: 1.5rem; border-radius: var(--radius-lg); margin-bottom: 1rem; box-shadow: var(--shadow-md);">
                    <h3 style="margin-bottom: 0.5rem;">Project #${d.project_id}</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 1rem;">${d.reason}</p>
                    <button class="btn btn-primary btn-small" onclick="resolveDispute(${d.id})">
                        Resolve
                    </button>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading disputes:', error);
    }
}

async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/api/v1/analytics/summary`);
        if (response.ok) {
            const stats = await response.json();
            document.getElementById('stats').innerHTML = `
                <div style="background: white; padding: 1.5rem; border-radius: var(--radius-lg); box-shadow: var(--shadow-md);">
                    <div style="margin-bottom: 1rem;">
                        <div style="color: var(--text-secondary); font-size: 0.875rem;">Total Users</div>
                        <div style="font-size: 2rem; font-weight: 700;">${stats.total_users}</div>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <div style="color: var(--text-secondary); font-size: 0.875rem;">Total Projects</div>
                        <div style="font-size: 2rem; font-weight: 700;">${stats.total_projects}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.875rem;">Total Revenue</div>
                        <div style="font-size: 2rem; font-weight: 700; color: var(--success-color);">$${stats.total_revenue.toFixed(2)}</div>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

function resolveDispute(disputeId) {
    const resolution = prompt('Enter resolution:');
    if (resolution) {
        fetch(`${API_BASE}/api/v1/admin/resolve_dispute?dispute_id=${disputeId}&resolution=${encodeURIComponent(resolution)}&escrow_action=release_to_freelancer`, {
            method: 'POST'
        }).then(() => {
            loadDisputes();
        });
    }
}

// Load on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        loadDisputes();
        loadStats();
    });
} else {
    loadDisputes();
    loadStats();
}

