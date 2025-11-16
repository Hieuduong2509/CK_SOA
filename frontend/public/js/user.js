var API_BASE = window.API_BASE || window.location.origin;

// Requires config.js, auth.js, navbar.js already loaded
(function () {
    const overviewInput = document.getElementById('overviewInput');
    const overviewForm = document.getElementById('overviewForm');
    const overviewSuccess = document.getElementById('overviewSuccess');
    const reviewList = document.getElementById('reviewList');
    const favoritesList = document.getElementById('favoritesList');
    const briefsList = document.getElementById('briefsList');
    const ordersList = document.getElementById('ordersList');

    const summaryEl = {
        avatar: document.getElementById('userAvatar'),
        name: document.getElementById('userName'),
        role: document.getElementById('userRole'),
        email: document.getElementById('userEmail'),
        phone: document.getElementById('userPhone'),
        headline: document.getElementById('userHeadline'),
        joined: document.getElementById('userCreatedAt')
    };

    const statEl = {
        projects: document.getElementById('statProjects'),
        completed: document.getElementById('statCompleted'),
        rating: document.getElementById('statRating'),
        favorites: document.getElementById('statFavorites')
    };

    let currentUser = null;
    let profile = null;

    function initialsFromName(name) {
        if (!name) return 'U';
        const parts = name.trim().split(' ');
        if (parts.length === 1) return parts[0][0]?.toUpperCase() || 'U';
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }

    function renderSummary(user, profileData) {
        if (!user) return;
        summaryEl.name.textContent = user.name;
        summaryEl.role.textContent = user.role === 'freelancer' ? 'Freelancer' : user.role === 'client' ? 'Client' : 'Admin';
        summaryEl.email.textContent = user.email;
        summaryEl.phone.textContent = profileData.phone || user.phone || '—';
        summaryEl.headline.textContent = profileData.headline || user.headline || '—';
        summaryEl.joined.textContent = (user.created_at || '').split('T')[0] || '—';
        summaryEl.avatar.textContent = initialsFromName(user.name);
        overviewInput.value = profileData.bio || '';
    }

    function renderStats(profileData, favorites) {
        statEl.projects.textContent = profileData.total_projects || 0;
        statEl.completed.textContent = profileData.total_reviews || 0;
        const rating = profileData.rating ? profileData.rating.toFixed(1) : '—';
        statEl.rating.textContent = `${rating} (${profileData.total_reviews || 0} reviews)`;
        statEl.favorites.textContent = favorites.length;
    }

    function renderReviews(reviews) {
        if (!reviews.length) {
            reviewList.innerHTML = '<p style="color: var(--text-secondary);">No reviews yet.</p>';
            return;
        }
        reviewList.innerHTML = reviews.map(review => `
            <div class="review-item">
                <div class="review-rating">
                    ${'★'.repeat(Math.round(review.rating_overall))}${'☆'.repeat(5 - Math.round(review.rating_overall))}
                    <span>${review.rating_overall.toFixed(1)}</span>
                </div>
                <p>${review.comment || 'Không có nhận xét.'}</p>
                <div class="review-meta">${new Date(review.created_at).toLocaleDateString()}</div>
            </div>
        `).join('');
    }

    function renderFavorites(favorites) {
        if (!favorites.length) {
            favoritesList.innerHTML = '<p style="color: var(--text-secondary);">You haven\'t saved any freelancers yet.</p>';
            return;
        }
        favoritesList.innerHTML = favorites.map(fav => {
            const freelancer = fav.freelancer;
            return `
                <div class="favorite-card">
                    <div class="favorite-header">
                        <div class="avatar-circle">${initialsFromName(freelancer.display_name || freelancer.name)}</div>
                        <div>
                            <h3>${freelancer.display_name || freelancer.name || 'Freelancer'}</h3>
                            <p>${freelancer.headline || ''}</p>
                        </div>
                    </div>
                    <div class="favorite-meta">
                        <span><i class="fas fa-star"></i> ${freelancer.rating?.toFixed(1) || '—'} (${freelancer.total_reviews || 0})</span>
                        ${freelancer.level ? `<span>Level ${freelancer.level}</span>` : ''}
                        ${freelancer.badges && freelancer.badges.length ? `<span>${freelancer.badges.join(', ')}</span>` : ''}
                    </div>
                    <div class="favorite-actions">
                        <a class="btn btn-outline btn-small" href="freelancer_profile.html?id=${freelancer.user_id}">View Profile</a>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderPlaceholders() {
        briefsList.innerHTML = '<p style="color: var(--text-secondary);">Brief feature coming soon.</p>';
        ordersList.innerHTML = '<p style="color: var(--text-secondary);">Orders will appear here once you hire freelancers.</p>';
    }

    async function fetchProfile(userId) {
        const token = getToken();
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        const response = await fetch(`${API_BASE}/api/v1/users/${userId}`, {
            headers: headers
        });
        if (!response.ok) {
            if (response.status === 404) {
                // Profile not found, return empty profile data
                return {
                    id: null,
                    user_id: userId,
                    bio: '',
                    skills: [],
                    rating: 0,
                    total_reviews: 0,
                    total_projects: 0,
                    starting_price: null,
                    total_stars: 0,
                    level: 1
                };
            }
            throw new Error('Failed to load profile');
        }
        return await response.json();
    }

    async function fetchReviews(userId) {
        const response = await fetch(`${API_BASE}/api/v1/users/${userId}/reviews`);
        if (!response.ok) return [];
        return await response.json();
    }

    async function fetchFavorites(user) {
        if (!user) return [];
        try {
            const response = await fetch(`${API_BASE}/api/v1/users/${user.id}/favorites`, {
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });
            if (!response.ok) return [];
            return await response.json();
        } catch (error) {
            console.error('fetchFavorites error', error);
            return [];
        }
    }

    async function loadPage() {
        if (!getToken()) {
            window.location.href = 'login.html';
            return;
        }
        currentUser = getCurrentUserProfile();
        if (!currentUser) {
            currentUser = await fetchCurrentUser();
        }
        if (!currentUser) {
            window.location.href = 'login.html';
            return;
        }

        profile = await fetchProfile(currentUser.id);
        const [reviews, favorites] = await Promise.all([
            fetchReviews(currentUser.id),
            fetchFavorites(currentUser)
        ]);

        renderSummary(currentUser, profile);
        renderReviews(reviews);
        renderFavorites(favorites);
        renderStats(profile, favorites);
        renderPlaceholders();
    }

    if (overviewForm) {
        overviewForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!currentUser) return;
            const payload = {
                bio: overviewInput.value,
            };
            try {
                const response = await fetch(`${API_BASE}/api/v1/users/${currentUser.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${getToken()}`
                    },
                    body: JSON.stringify(payload)
                });
                if (response.ok) {
                    overviewSuccess.style.display = 'block';
                    setTimeout(() => overviewSuccess.style.display = 'none', 2000);
                }
            } catch (error) {
                console.error('update overview error', error);
            }
        });
    }

    document.addEventListener('DOMContentLoaded', loadPage);
})();
