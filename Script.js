// ── State ──────────────────────────────────────────────────────────────────────
let marketRates = {
    gold: null,
    silver: null,
    forex: null,
    euro: null
};

let allNews = [];
let bookmarks = JSON.parse(localStorage.getItem('nepalNewsBookmarks')) || [];
let userReactions = JSON.parse(localStorage.getItem('nepalNewsReactions')) || {};
let manualStories = JSON.parse(localStorage.getItem('manualStories')) || [];
let siteBanner = JSON.parse(localStorage.getItem('siteBanner')) || {};
let CONFIG_LANG = localStorage.getItem('siteLanguage') || 'en';
let siteSources = JSON.parse(localStorage.getItem('newsSources'));
let currentSort = 'newest';
let trendingNews = [];

const DEFAULT_SOURCES = [
    { id: 1, name: "The Himalayan Times", url: "https://thehimalayantimes.com/feed/", category: "english", active: true },
    { id: 2, name: "Nepali Times", url: "https://www.nepalitimes.com/feed/", category: "english", active: true },
    { id: 3, name: "Kathmandu Tribune", url: "https://kathmandutribune.com/feed/", category: "english", active: true },
    { id: 4, name: "Telegraph Nepal", url: "https://telegraphnepal.com/feed/", category: "english", active: true },
    { id: 5, name: "Online Khabar EN", url: "https://english.onlinekhabar.com/feed", category: "english", active: true },
    { id: 6, name: "Setopati EN", url: "https://en.setopati.com/feed", category: "english", active: true },
    { id: 7, name: "Rato Pati EN", url: "http://english.ratopati.com/rss/", category: "english", active: true },
    { id: 8, name: "Lokaantar EN", url: "http://english.lokaantar.com/feed/", category: "english", active: true },
    { id: 9, name: "Online Khabar", url: "https://onlinekhabar.com/feed", category: "nepali", active: true },
    { id: 10, name: "Rato Pati", url: "https://ratopati.com/feed", category: "nepali", active: true },
    { id: 11, name: "Lokaantar", url: "https://lokaantar.com/feed", category: "nepali", active: true },
    { id: 12, name: "Rajdhani", url: "https://rajdhani.com.np/feed", category: "nepali", active: true },
    { id: 13, name: "News of Nepal", url: "https://newsofnepal.com/feed", category: "nepali", active: true },
    { id: 14, name: "OS Nepal", url: "https://osnepal.com/feed", category: "nepali", active: true },
    { id: 15, name: "Nagarik News", url: "https://nagariknews.nagariknetwork.com/feed", category: "nepali", active: true },
    { id: 16, name: "Ujyaalo", url: "https://ujyaaloonline.com/feed", category: "nepali", active: true },
    { id: 17, name: "Abhiyan", url: "https://abhiyandaily.com/abhiyanrss", category: "nepali", active: true },
    { id: 18, name: "Artha Sarokar", url: "https://arthasarokar.com/feed", category: "business", active: true },
    { id: 19, name: "TechMandu", url: "https://techmandu.com/feed", category: "business", active: true },
    { id: 20, name: "Nepal Database", url: "https://nepaldatabase.com/rss/latest-posts", category: "business", active: true },
    { id: 21, name: "BBC Nepali", url: "https://www.bbc.com/nepali/index.xml", category: "intl", active: true }
];

const CACHE_KEY = 'nepalNewsCache';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

if (!siteSources) {
    siteSources = DEFAULT_SOURCES;
    localStorage.setItem('newsSources', JSON.stringify(DEFAULT_SOURCES));
}

const translations = {
    en: { loading: "Loading news...", no_news: "No news found", read_more: "Read More", just_now: "Just now", mins_ago: "m ago", hours_ago: "h ago" },
    np: { loading: "समाचार लोड हुँदैछ...", no_news: "कुनै समाचार फेला परेन", read_more: "पुरा पढ्नुहोस्", just_now: "अभैं", mins_ago: "मिनेट अगाडि", hours_ago: "घण्टा अगाडि" }
};

// ── Boot ───────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    applyLanguage(CONFIG_LANG);
    renderBanner();
    updateBookmarkCount();
    fetchMarketRates(); // Load market rates
    if (localStorage.getItem('dataSaver') === 'true') {
        document.getElementById('dataSaverToggle').checked = true;
        document.body.classList.add('data-saver-on');
    }
    document.getElementById('langSwitcher').value = CONFIG_LANG;

    // Initialize footer AdSense
    try {
        (adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {}

    // Show cached news instantly, then refresh in background
    const cached = loadFromCache();
    if (cached && cached.length > 0) {
        allNews = cached;
        calculateTrending();
        sortAndRender();
        updateTicker(allNews[0]?.title);
        createFloatingTrending();
        // Silent background refresh
        loadNews(true);
    } else {
        loadNews(false);
    }
});

function setupEventListeners() {
    document.getElementById('dataSaverToggle').addEventListener('change', (e) => {
        document.body.classList.toggle('data-saver-on', e.target.checked);
        localStorage.setItem('dataSaver', e.target.checked);
    });
    document.getElementById('searchInput').addEventListener('input', (e) => filterNewsBySearch(e.target.value));
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) sortSelect.addEventListener('change', (e) => { currentSort = e.target.value; sortAndRender(); });
    // Auto-refresh every 10 minutes
    setInterval(() => loadNews(true), 600000);
}

// ── Cache helpers ──────────────────────────────────────────────────────────────
function saveToCache(news) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), news }));
    } catch (e) { /* storage full, ignore */ }
}

function loadFromCache() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const { ts, news } = JSON.parse(raw);
        if (Date.now() - ts > CACHE_TTL) return null;
        // Restore Date objects
        return news.map(n => ({ ...n, pubDate: new Date(n.pubDate) }));
    } catch (e) { return null; }
}

// ── Fetch with timeout ─────────────────────────────────────────────────────────
async function fetchWithTimeout(url, ms = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        return res;
    } catch (e) {
        clearTimeout(timer);
        throw e;
    }
}

// ── Batch fetcher (avoids hitting rss2json rate limit) ─────────────────────────
async function fetchInBatches(sources, batchSize = 4, delayMs = 300) {
    const results = [];
    for (let i = 0; i < sources.length; i += batchSize) {
        const batch = sources.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
            batch.map(source => fetchSource(source))
        );
        results.push(...batchResults);
        if (i + batchSize < sources.length) {
            await new Promise(r => setTimeout(r, delayMs));
        }
    }
    return results;
}

async function fetchSource(source) {
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(source.url)}&count=5`;
    const res = await fetchWithTimeout(apiUrl, 8000);
    const data = await res.json();
    if (data.status === 'ok' && data.items) {
        return data.items.slice(0, 5).map(item => {
            const processed = processNewsItem(item, source.category);
            processed.sourceName = source.name;
            processed.sourceIcon = "fas fa-newspaper";
            return processed;
        });
    }
    return [];
}

// ── Main loader ────────────────────────────────────────────────────────────────
async function loadNews(silent = false) {
    const grid = document.getElementById('newsGrid');

    if (!silent) {
        grid.innerHTML = `<div class="loading-state"><i class="fas fa-circle-notch fa-spin"></i><span>${translations[CONFIG_LANG].loading}</span></div>`;
    }

    const manualMapped = manualStories.map(story => ({
        ...story,
        id: 'manual-' + story.title,
        summary: story.summary || "Breaking news.",
        image: story.image || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&q=80',
        pubDate: new Date(story.date),
        sourceName: "Editor's Pick",
        sourceIcon: "fas fa-thumbtack",
        language: CONFIG_LANG
    }));

    const activeSources = siteSources.filter(s => s.active);
    if (activeSources.length === 0) {
        grid.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>No active sources</h3><p>Enable in Admin</p></div>';
        return;
    }

    // Fetch in batches of 4 to respect rate limits
    const results = await fetchInBatches(activeSources, 4, 300);
    const rssNews = results
        .filter(r => r.status === 'fulfilled')
        .flatMap(r => r.value || []);

    let combinedNews = [...manualMapped, ...rssNews];
    combinedNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    // Deduplicate
    const uniqueNews = [];
    const seenTitles = new Set();
    combinedNews.forEach(news => {
        const titleKey = news.title.substring(0, 50).toLowerCase();
        if (!seenTitles.has(titleKey)) { seenTitles.add(titleKey); uniqueNews.push(news); }
    });

    if (uniqueNews.length === 0 && silent) return; // Don't replace good cached data with nothing

    allNews = uniqueNews.slice(0, 100);
    saveToCache(allNews);
    calculateTrending();
    sortAndRender();
    if (allNews.length > 0) updateTicker(allNews[0].title);
    createFloatingTrending();
}

// ── Trending ───────────────────────────────────────────────────────────────────
function calculateTrending() {
    trendingNews = allNews.map(news => {
        const reactionCount = userReactions[news.id] ? 1 : 0;
        const hoursOld = (Date.now() - new Date(news.pubDate)) / (1000 * 60 * 60);
        const recencyScore = Math.max(0, 10 - hoursOld);
        return { ...news, trendingScore: reactionCount * 5 + recencyScore };
    });
    trendingNews.sort((a, b) => b.trendingScore - a.trendingScore);
    trendingNews = trendingNews.slice(0, 10);
}

// ── Process RSS item ───────────────────────────────────────────────────────────
function processNewsItem(item, sourceCategory) {
    const text = (item.title + " " + (item.description || "")).toLowerCase();
    let category = 'general';
    let image = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&q=80';

    if (text.includes('cricket') || text.includes('क्रिकेट') || text.includes('football') || text.includes('खेल')) {
        category = 'sports'; image = 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&q=80';
    } else if (text.includes('share') || text.includes('सेयर') || text.includes('bank') || text.includes('बैंक') || text.includes('नेप्से')) {
        category = 'business'; image = 'https://images.unsplash.com/photo-1611974765270-ca12586343bb?w=600&q=80';
    } else if (text.includes('minister') || text.includes('मन्त्री') || text.includes('सरकार') || text.includes('चुनाव')) {
        category = 'politics'; image = 'https://images.unsplash.com/photo-1541872703-74c5963631df?w=600&q=80';
    } else if (text.includes('tech') || text.includes('mobile') || text.includes('मोबाइल') || text.includes('इन्टरनेट')) {
        category = 'tech'; image = 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&q=80';
    } else if (text.includes('health') || text.includes('स्वास्थ्य') || text.includes('अस्पताल')) {
        category = 'health'; image = 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=600&q=80';
    }

    // Try to extract image from RSS item
    if (item.enclosure && item.enclosure.link && item.enclosure.type && item.enclosure.type.startsWith('image')) {
        image = item.enclosure.link;
    } else if (item.thumbnail && item.thumbnail.startsWith('http')) {
        image = item.thumbnail;
    }

    return {
        id: item.guid || item.link || Math.random().toString(36),
        title: item.title || 'Untitled',
        summary: item.description ? item.description.replace(/<[^>]*>?/gm, '').trim().substring(0, 120) + '...' : '',
        link: item.link || '#',
        category,
        image,
        pubDate: new Date(item.pubDate || Date.now()),
        language: sourceCategory === 'nepali' ? 'np' : 'en'
    };
}

// ── Sort & Render ──────────────────────────────────────────────────────────────
function sortAndRender() {
    let sorted = [...allNews];
    switch (currentSort) {
        case 'newest': sorted.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)); break;
        case 'oldest': sorted.sort((a, b) => new Date(a.pubDate) - new Date(b.pubDate)); break;
        case 'trending': sorted = [...trendingNews]; break;
        case 'source': sorted.sort((a, b) => (a.sourceName || '').localeCompare(b.sourceName || '')); break;
    }
    if (CONFIG_LANG === 'np') sorted.sort((a, b) => (b.language === 'np' ? 1 : 0) - (a.language === 'np' ? 1 : 0));
    renderNews(sorted);
}

function renderNews(newsList) {
    const grid = document.getElementById('newsGrid');
    const emptyState = document.getElementById('emptyState');
    if (!newsList || newsList.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    grid.style.display = 'grid';
    emptyState.style.display = 'none';
    grid.innerHTML = '';

    const adSlotIds = [
        'YOUR_IN_FEED_AD_SLOT_ID_1',
        'YOUR_IN_FEED_AD_SLOT_ID_2',
        'YOUR_IN_FEED_AD_SLOT_ID_3',
        'YOUR_IN_FEED_AD_SLOT_ID_4'
    ];
    let adIndex = 0;
    let newsCount = 0;

    newsList.forEach((news, index) => {
        const isBookmarked = bookmarks.includes(news.id);
        const userVote = userReactions[news.id];
        const timeAgo = getTimeAgo(news.pubDate);
        const card = document.createElement('article');
        card.className = 'news-card';
        card.style.opacity = '0';
        card.style.transform = 'translateY(25px)';
        const langBadge = news.language === 'np' ? '<span class="lang-badge np">NP</span>' : '<span class="lang-badge en">EN</span>';
        const safeTitle = news.title.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        card.innerHTML = `
            <div class="card-bookmark ${isBookmarked ? 'active' : ''}" onclick="toggleBookmark('${news.id}', event)"><i class="fas fa-bookmark"></i></div>
            <div class="card-image-wrapper"><img src="${news.image}" alt="${safeTitle}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&q=80'"></div>
            <div class="card-content">
                <div class="card-meta"><span class="card-category">${news.category}</span><span class="card-time">${timeAgo}</span></div>
                <div class="card-source"><i class="${news.sourceIcon || 'fas fa-globe'}"></i><span>${news.sourceName || 'News'}</span>${langBadge}</div>
                <h3 class="card-title">${news.title}</h3>
                <p class="card-summary">${news.summary}</p>
                <div class="card-actions">
                    <div class="reaction-group">
                        <button class="react-btn ${userVote === 'like' ? 'voted' : ''}" data-news-id="${news.id}" data-reaction="like" onclick="addReaction(event, '${news.id}', 'like')">👍</button>
                        <button class="react-btn ${userVote === 'love' ? 'voted' : ''}" data-news-id="${news.id}" data-reaction="love" onclick="addReaction(event, '${news.id}', 'love')">❤️</button>
                        <button class="react-btn ${userVote === 'sad' ? 'voted' : ''}" data-news-id="${news.id}" data-reaction="sad" onclick="addReaction(event, '${news.id}', 'sad')">😢</button>
                        <button class="react-btn ${userVote === 'angry' ? 'voted' : ''}" data-news-id="${news.id}" data-reaction="angry" onclick="addReaction(event, '${news.id}', 'angry')">😡</button>
                    </div>
                    <button class="share-btn" onclick="openShareModal('${news.link}', '${safeTitle}')"><i class="fas fa-share-alt"></i></button>
                </div>
                <a href="${news.link}" target="_blank" rel="noopener" class="read-more">${translations[CONFIG_LANG].read_more} →</a>
            </div>
        `;
        grid.appendChild(card);

        newsCount++;
        if (newsCount % 6 === 0 && adIndex < adSlotIds.length) {
            const adCard = createAdCard(adSlotIds[adIndex]);
            adIndex++;
            grid.appendChild(adCard);
            try {
                (adsbygoogle = window.adsbygoogle || []).push({});
            } catch (e) {}
        }

        setTimeout(() => {
            card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 40 + (index * 30));
    });
    updateBookmarkCount();
}

// ── Filters ────────────────────────────────────────────────────────────────────
function filterNews(category) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    const filtered = category === 'all' ? allNews : allNews.filter(item => item.category === category);
    renderNews(filtered);
}

function filterNewsBySearch(query) {
    const term = query.toLowerCase().trim();
    if (term.length < 2) { sortAndRender(); return; }
    const filtered = allNews.filter(item =>
        item.title.toLowerCase().includes(term) || item.summary.toLowerCase().includes(term)
    );
    renderNews(filtered);
}

function performSearch() { filterNewsBySearch(document.getElementById('searchInput').value); }

// ── Bookmarks ──────────────────────────────────────────────────────────────────
function toggleBookmark(id, event) {
    if (event) event.stopPropagation();
    if (bookmarks.includes(id)) bookmarks = bookmarks.filter(bid => bid !== id);
    else bookmarks.push(id);
    localStorage.setItem('nepalNewsBookmarks', JSON.stringify(bookmarks));
    updateBookmarkCount();
    const btn = document.querySelector(`.card-bookmark[onclick*="'${id}'"]`);
    if (btn) btn.classList.toggle('active');
}

function updateBookmarkCount() {
    const count = bookmarks.length;
    const btn = document.querySelector('.icon-btn[onclick="showBookmarks()"]');
    if (btn) btn.innerHTML = count > 0 ? `<i class="fas fa-bookmark"></i><span class="bookmark-badge">${count > 99 ? '99+' : count}</span>` : `<i class="fas fa-bookmark"></i>`;
}

function showBookmarks() {
    const bookmarkedNews = allNews.filter(item => bookmarks.includes(item.id));
    if (bookmarkedNews.length === 0) { alert('No bookmarks yet!'); return; }
    renderNews(bookmarkedNews);
}

// ── Reactions ──────────────────────────────────────────────────────────────────
function addReaction(event, newsId, reactionType) {
    if (event) { event.stopPropagation(); event.preventDefault(); }
    if (userReactions[newsId] === reactionType) delete userReactions[newsId];
    else userReactions[newsId] = reactionType;
    localStorage.setItem('nepalNewsReactions', JSON.stringify(userReactions));
    updateReactionButton(newsId, reactionType);
    calculateTrending();
}

function updateReactionButton(newsId, newReaction) {
    document.querySelectorAll(`.react-btn[data-news-id="${newsId}"]`).forEach(btn => {
        btn.classList.remove('voted');
        if (btn.dataset.reaction === newReaction && userReactions[newsId] === newReaction) btn.classList.add('voted');
    });
}

// ── Trending modal ─────────────────────────────────────────────────────────────
function createFloatingTrending() {
    document.querySelector('.floating-trending')?.remove();
    const fab = document.createElement('div');
    fab.className = 'floating-trending';
    fab.innerHTML = `<i class="fas fa-fire"></i><span class="badge">${trendingNews.length}</span>`;
    fab.onclick = openTrendingModal;
    document.body.appendChild(fab);
}

function openTrendingModal() {
    document.querySelector('.trending-modal-overlay')?.remove();
    const modal = document.createElement('div');
    modal.className = 'trending-modal-overlay';
    const trendingHTML = trendingNews.slice(0, 10).map((news, i) => `
        <div class="trending-item" onclick="window.open('${news.link}', '_blank')">
            <div class="trending-rank">${i + 1}</div>
            <div class="trending-info"><h4>${news.title}</h4><p>${news.sourceName || 'Unknown'} • ${getTimeAgo(news.pubDate)}</p></div>
        </div>
    `).join('');
    modal.innerHTML = `<div class="trending-modal"><div class="trending-header"><h3>🔥 Trending</h3><button onclick="this.closest('.trending-modal-overlay').remove()">&times;</button></div><div class="trending-content">${trendingHTML || '<p style="text-align:center;color:#999;">No trending yet!</p>'}</div></div>`;
    document.body.appendChild(modal);
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

// ── Language ───────────────────────────────────────────────────────────────────
function changeLanguage(lang) {
    CONFIG_LANG = lang;
    localStorage.setItem('siteLanguage', lang);
    document.body.classList.toggle('lang-np', lang === 'np');
    applyLanguage(lang);
    sortAndRender();
}

function applyLanguage(lang) {
    const t = translations[lang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        if (t[el.getAttribute('data-i18n')]) el.textContent = t[el.getAttribute('data-i18n')];
    });
}

// ── Banner ─────────────────────────────────────────────────────────────────────
function renderBanner() {
    const container = document.getElementById('topBannerContainer');
    if (!container) return;
    if (siteBanner && siteBanner.active === 'true' && siteBanner.img) {
        container.style.display = 'flex';
        container.innerHTML = `<a href="${siteBanner.link || '#'}" target="_blank"><img src="${siteBanner.img}" alt="Ad"></a>`;
    } else container.style.display = 'none';
}

// ── Ticker ─────────────────────────────────────────────────────────────────────
function updateTicker(headline) {
    const ticker = document.getElementById('tickerContent');
    if (headline) ticker.textContent = headline.length > 100 ? headline.substring(0, 100) + '...' : headline;
}

// ── Time helper ────────────────────────────────────────────────────────────────
function getTimeAgo(date) {
    if (!date) return translations[CONFIG_LANG].just_now;
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return translations[CONFIG_LANG].just_now;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + translations[CONFIG_LANG].mins_ago;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + translations[CONFIG_LANG].hours_ago;
    return Math.floor(hours / 24) + 'd ago';
}

// ── Share modal ────────────────────────────────────────────────────────────────
function openShareModal(url, title) {
    document.querySelector('.share-modal-overlay')?.remove();
    const modal = document.createElement('div');
    modal.className = 'share-modal-overlay';
    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(title + ' ' + url);
    modal.innerHTML = `<div class="share-modal"><div class="share-header"><h3>Share</h3><button onclick="this.closest('.share-modal-overlay').remove()">&times;</button></div><div class="share-options"><button class="share-option" onclick="navigator.clipboard.writeText('${url}').then(() => alert('Copied!'))"><i class="fas fa-link"></i> Copy Link</button><button class="share-option" onclick="window.open('https://wa.me/?text=${encodedTitle}', '_blank')"><i class="fab fa-whatsapp"></i> WhatsApp</button><button class="share-option" onclick="window.open('https://facebook.com/sharer/sharer.php?u=${encodedUrl}', '_blank')"><i class="fab fa-facebook-f"></i> Facebook</button></div></div>`;
    document.body.appendChild(modal);
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

// ── Market Rates ───────────────────────────────────────────────────────────────
async function fetchMarketRates() {
    const adminRates = JSON.parse(localStorage.getItem('marketRates')) || {};
    
    // Set manual rates from admin if they exist
    if (adminRates.gold) document.getElementById('goldValue').textContent = adminRates.gold;
    if (adminRates.silver) document.getElementById('silverValue').textContent = adminRates.silver;
    if (adminRates.forex) document.getElementById('forexValue').textContent = 'Rs. ' + adminRates.forex;
    if (adminRates.euro) document.getElementById('euroValue').textContent = 'Rs. ' + adminRates.euro;

    // If any rates are still "Loading...", try to fetch forex from API
    const goldVal = document.getElementById('goldValue').textContent;
    const silverVal = document.getElementById('silverValue').textContent;
    const forexVal = document.getElementById('forexValue').textContent;
    const euroVal = document.getElementById('euroValue').textContent;

    if (forexVal === 'Loading...' || euroVal === 'Loading...') {
        try {
            const forexCache = localStorage.getItem('forexCache');
            const cacheTime = localStorage.getItem('forexCacheTime');
            const now = Date.now();

            let forexRates = null;
            if (forexCache && cacheTime && (now - parseInt(cacheTime)) < 30 * 60 * 1000) {
                forexRates = JSON.parse(forexCache);
            } else {
                const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
                if (response.ok) {
                    const data = await response.json();
                    forexRates = data.rates;
                    localStorage.setItem('forexCache', JSON.stringify(forexRates));
                    localStorage.setItem('forexCacheTime', now.toString());
                }
            }

            if (forexRates) {
                if (forexVal === 'Loading...' && forexRates.NPR) {
                    document.getElementById('forexValue').textContent = 'Rs. ' + forexRates.NPR.toFixed(2);
                }
                if (euroVal === 'Loading...' && forexRates.EUR && forexRates.NPR) {
                    const euroRate = forexRates.NPR / forexRates.EUR;
                    document.getElementById('euroValue').textContent = 'Rs. ' + euroRate.toFixed(2);
                }
            }
        } catch (error) {
            console.log('Market rates fetch error:', error);
            if (forexVal === 'Loading...') document.getElementById('forexValue').textContent = 'N/A';
            if (euroVal === 'Loading...') document.getElementById('euroValue').textContent = 'N/A';
        }
    }

    // Fallback for gold/silver if still loading
    if (document.getElementById('goldValue').textContent === 'Loading...') {
        document.getElementById('goldValue').textContent = 'N/A';
    }
    if (document.getElementById('silverValue').textContent === 'Loading...') {
        document.getElementById('silverValue').textContent = 'N/A';
    }
}

// ── Ad Card Generator ─────────────────────────────────────────────────────────
function createAdCard(slotId) {
    const adCard = document.createElement('div');
    adCard.className = 'ad-card';
    adCard.innerHTML = `
        <ins class="adsbygoogle"
             style="display:block; width:100%; height:250px;"
             data-ad-client="ca-pub-3036335622208432"
             data-ad-slot="${slotId}"
             data-ad-format="auto"
             data-full-width-responsive="true"></ins>
    `;
    return adCard;
}

// ── Exports ────────────────────────────────────────────────────────────────────
window.filterNews = filterNews;
window.toggleBookmark = toggleBookmark;
window.showBookmarks = showBookmarks;
window.addReaction = addReaction;
window.changeLanguage = changeLanguage;
window.performSearch = performSearch;
window.openTrendingModal = openTrendingModal;
