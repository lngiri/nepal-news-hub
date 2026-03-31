/* =========================================
   NEPAL NEWS HUB - CORE ENGINE
   ========================================= */

const FOREX_KEY = "45402a89d5d63895741ed560";
const METAL_KEY = "goldapi-ajzp2ismmsnrn7c-io";

// Optimized RSS Sources
const SOURCES = [
    { name: "The Himalayan Times", url: "https://thehimalayantimes.com/feed/" },
    { name: "Online Khabar", url: "https://onlinekhabar.com/feed" },
    { name: "Nepali Times", url: "https://www.nepalitimes.com/feed/" },
    { name: "Rato Pati", url: "https://ratopati.com/feed" },
    { name: "Nagarik News", url: "https://nagariknews.nagariknetwork.com/feed" }
];

let forexData = null;
let metalData = null;

/* 1. INITIALIZE */
document.addEventListener('DOMContentLoaded', () => {
    updateMarketData();
    loadNews();
    
    // Auto-update every 15 minutes
    setInterval(() => {
        updateMarketData();
        loadNews();
    }, 900000);
});

/* 2. MARKET DATA LOGIC */
async function updateMarketData() {
    // Fetch Forex
    try {
        const fRes = await fetch(`https://v6.exchangerate-api.com/v6/${FOREX_KEY}/latest/USD`);
        const fData = await fRes.json();
        if(fData.result === "success") {
            forexData = fData.conversion_rates;
            document.getElementById('forex-row').innerHTML = 
                `USD/NPR: <b>${forexData.NPR}</b> &nbsp;&nbsp;&nbsp;&nbsp; USD/INR: <b>${forexData.INR}</b> &nbsp;&nbsp;&nbsp;&nbsp; USD/EUR: <b>${forexData.EUR}</b> &nbsp;&nbsp;&nbsp;&nbsp; USD/GBP: <b>${forexData.GBP}</b>`;
        }
    } catch (err) { console.error("Forex error"); }

    // Fetch Metals
    try {
        const mRes = await fetch("https://www.goldapi.io/api/XAU/NPR", {
            headers: { "x-access-token": METAL_KEY }
        });
        const mData = await mRes.json();
        if (mData && mData.price) {
            metalData = mData;
            const tola = Math.round(mData.price / 2.66);
            document.getElementById('metal-row').innerHTML = 
                `GOLD (24K): <b>रू ${tola.toLocaleString()} /tola</b> &nbsp;&nbsp;&nbsp;&nbsp; SILVER: <b>रू ${Math.round(mData.price_gram_24k * 11.66).toLocaleString()} /tola</b> &nbsp;&nbsp;&nbsp;&nbsp; SPOT: <b>$${Math.round(mData.price_usd)}/oz</b>`;
        }
    } catch (err) { console.error("Metal error"); }
}

/* 3. NEWS AGGREGATOR LOGIC */
async function loadNews() {
    const grid = document.getElementById('newsGrid');
    if(!grid) return;

    const fetchPromises = SOURCES.map(async (source) => {
        try {
            const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(source.url)}`);
            const data = await res.json();
            return data.items.map(item => ({
                title: item.title,
                link: item.link,
                source: source.name,
                date: new Date(item.pubDate),
                image: item.enclosure?.link || item.thumbnail || 'https://via.placeholder.com/600x400?text=Nepal+News'
            }));
        } catch (e) { return []; }
    });

    const results = await Promise.all(fetchPromises);
    const combinedNews = results.flat().sort((a, b) => b.date - a.date).slice(0, 21);
    
    grid.innerHTML = '';
    combinedNews.forEach(news => {
        const article = document.createElement('article');
        article.className = 'news-card';
        article.innerHTML = `
            <div class="card-image-wrapper" style="height: 200px; overflow: hidden; border-radius: 8px 8px 0 0;">
                <img src="${news.image}" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
            <div class="card-content" style="padding: 15px;">
                <small style="color: #DC143C; font-weight: bold; text-transform: uppercase;">${news.source}</small>
                <h3 style="margin: 10px 0; font-size: 1.1rem; line-height: 1.4;">${news.title}</h3>
                <a href="${news.link}" target="_blank" style="color: #2563eb; text-decoration: none; font-weight: 500; font-size: 0.9rem;">Read Full Story →</a>
            </div>`;
        grid.appendChild(article);
    });
}

/* 4. POPUP SYSTEM */
function openPopup(type) {
    const modal = document.getElementById('data-modal');
    const container = document.getElementById('modal-table-container');
    const title = document.getElementById('modal-title');
    
    modal.style.display = "block";
    
    if(type === 'forex' && forexData) {
        title.innerText = "Currency Exchange Rates (1 USD)";
        container.innerHTML = `
            <div style="font-size: 1.1rem; line-height: 2;">
                <p>🇳🇵 Nepalese Rupee: <b>रू ${forexData.NPR}</b></p>
                <p>🇮🇳 Indian Rupee: <b>₹ ${forexData.INR}</b></p>
                <p>🇪🇺 Euro: <b>€ ${forexData.EUR}</b></p>
                <p>🇬🇧 British Pound: <b>£ ${forexData.GBP}</b></p>
            </div>`;
    } else if (type === 'metals' && metalData) {
        title.innerText = "Gold & Silver Prices (Nepal)";
        const tola = Math.round(metalData.price / 2.66);
        container.innerHTML = `
            <div style="font-size: 1.1rem; line-height: 2;">
                <p>🟡 Gold (24K): <b>रू ${tola.toLocaleString()} /tola</b></p>
                <p>🟠 Gold (22K): <b>रू ${Math.round(tola * 0.92).toLocaleString()} /tola</b></p>
                <p>⚪ Silver: <b>रू ${Math.round(metalData.price_gram_24k * 11.66).toLocaleString()} /tola</b></p>
            </div>`;
    }
}

function closePopup() {
    document.getElementById('data-modal').style.display = "none";
}

// Global Exports
window.openPopup = openPopup;
window.closePopup = closePopup;
window.onclick = (e) => { if(e.target == document.getElementById('data-modal')) closePopup(); }