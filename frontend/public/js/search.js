// API_BASE is defined in config.js (must load config.js first)
var API_BASE = window.API_BASE || window.location.origin;

async function searchFreelancers(query, filters = {}) {
    // If no query and no filters, load all freelancers directly from user-service
    const hasQuery = query && query.trim().length > 0;
    const hasFilters = filters.skills || filters.rating || filters.price_min || filters.price_max || 
                       filters.categories || filters.badges || filters.experience_level || filters.location;
    
    if (!hasQuery && !hasFilters) {
        // Load all freelancers directly
        try {
            const response = await fetch(`${API_BASE}/api/v1/users?limit=100`);
            if (response.ok) {
                const freelancers = await response.json();
                console.log('Loaded all freelancers:', freelancers.length);
                return freelancers;
            }
        } catch (error) {
            console.error('Error loading all freelancers:', error);
        }
        return [];
    }
    
    // Use search service when there's a query or filters
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (filters.skills) params.append('skills', filters.skills);
    if (filters.rating) params.append('rating', filters.rating);
    if (filters.price_min) params.append('price_min', filters.price_min);
    if (filters.price_max) params.append('price_max', filters.price_max);
    if (filters.categories) params.append('categories', filters.categories);
    if (filters.badges) params.append('badges', filters.badges);
    if (filters.experience_level) params.append('experience_level', filters.experience_level);
    if (filters.location) params.append('location', filters.location);
    
    try {
        const response = await fetch(`${API_BASE}/api/v1/search/freelancers?${params}`);
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error('Search error:', error);
    }
    return [];
}

async function autocomplete(query) {
    if (query.length < 2) return [];
    try {
        const response = await fetch(`${API_BASE}/api/v1/search/autocomplete?query=${encodeURIComponent(query)}`);
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error('Autocomplete error:', error);
    }
    return [];
}

