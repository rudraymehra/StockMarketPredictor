class CryptoTracker {
    constructor() {
        this.baseUrl = 'https://api.coingecko.com/api/v3';
        this.cryptoData = [];
        this.chart = null;
        this.hoveredCoin = null;
        this.watchlist = JSON.parse(localStorage.getItem('watchlist')) || [];
        this.init();
    }

    async init() {
        this.createInitialStructure();
        this.setupEventListeners();
        this.setupCustomCursor();
        await this.loadCryptoData();
        this.renderWatchlist();
        this.updateTopMovers();
        this.startAutoRefresh();
    }

    setupCustomCursor() {
        const cursor = document.createElement('div');
        cursor.className = 'custom-cursor';
        document.body.appendChild(cursor);

        document.addEventListener('mousemove', (e) => {
            cursor.style.left = e.clientX + 'px';
            cursor.style.top = e.clientY + 'px';
        });

        document.addEventListener('mouseover', (e) => {
            if (e.target.matches('button, a, input, .crypto-row, .watchlist-coin')) {
                cursor.style.width = '30px';
                cursor.style.height = '30px';
                cursor.style.filter = 'blur(4px)';
            }
        });

        document.addEventListener('mouseout', (e) => {
            if (e.target.matches('button, a, input, .crypto-row, .watchlist-coin')) {
                cursor.style.width = '20px';
                cursor.style.height = '20px';
                cursor.style.filter = 'blur(2px)';
            }
        });
    }

    createInitialStructure() {
        const root = document.getElementById('root');
        root.innerHTML = `
            <div class="container">
                <header class="header">
                    <h1>Crypto Tracker Pro</h1>
                    <div class="search-container">
                        <i class="fas fa-search"></i>
                        <input type="text" id="searchInput" placeholder="Search cryptocurrencies...">
                    </div>
                </header>
                <div class="dashboard">
                    <aside class="sidebar">
                        <div class="watchlist-section">
                            <div class="watchlist-header">
                                <h2><i class="fas fa-star"></i> Watchlist</h2>
                                <button class="add-to-watchlist" id="openWatchlistModal">
                                    <i class="fas fa-plus"></i> Add Coin
                                </button>
                            </div>
                            <div class="watchlist-coins" id="watchlistCoins"></div>
                        </div>
                        <div class="movers-section">
                            <h2><i class="fas fa-arrow-trend-up"></i> Top Gainers</h2>
                            <div id="topGainers"></div>
                        </div>
                        <div class="movers-section">
                            <h2><i class="fas fa-arrow-trend-down"></i> Top Losers</h2>
                            <div id="topLosers"></div>
                        </div>
                    </aside>
                    <main class="main-content">
                        <table class="crypto-table">
                            <thead>
                                <tr>
                                    <th>Asset</th>
                                    <th>Price</th>
                                    <th>24h Change</th>
                                    <th>Market Cap</th>
                                    <th>Volume (24h)</th>
                                </tr>
                            </thead>
                            <tbody id="cryptoTableBody"></tbody>
                        </table>
                    </main>
                </div>
                <div id="historicalPopup" class="historical-popup" style="display: none;">
                    <h3>7-Day Price History</h3>
                    <div class="chart-container">
                        <canvas id="historicalChart"></canvas>
                    </div>
                </div>
                <div id="popupOverlay" class="popup-overlay" style="display: none;"></div>
            </div>
        `;
    }

    setupEventListeners() {
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filterCryptoList(e.target.value);
        });

        document.getElementById('popupOverlay').addEventListener('click', () => {
            this.hideHistoricalData();
        });

        document.getElementById('openWatchlistModal').addEventListener('click', () => {
            this.showWatchlistModal();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideHistoricalData();
            }
        });
    }

    startAutoRefresh() {
        setInterval(() => {
            this.loadCryptoData();
        }, 60000); // Refresh every minute
    }

    async loadCryptoData() {
        try {
            const response = await fetch(
                `${this.baseUrl}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&sparkline=true&price_change_percentage=24h,7d`
            );
            if (!response.ok) throw new Error('Network response was not ok');
            
            this.cryptoData = await response.json();
            this.renderCryptoList();
            this.updateTopMovers();
            this.renderWatchlist();
        } catch (error) {
            console.error('Error loading crypto data:', error);
            this.showError('Failed to load cryptocurrency data. Please try again later.');
        }
    }

    async loadHistoricalData(coinId) {
        try {
            const response = await fetch(
                `${this.baseUrl}/coins/${coinId}/market_chart?vs_currency=usd&days=7&interval=daily`
            );
            if (!response.ok) throw new Error('Network response was not ok');
            
            const data = await response.json();
            return data.prices;
        } catch (error) {
            console.error('Error loading historical data:', error);
            this.showError('Failed to load historical data');
            return null;
        }
    }

    showWatchlistModal() {
        const modal = document.createElement('div');
        modal.className = 'historical-popup';
        modal.innerHTML = `
            <h3>Add to Watchlist</h3>
            <div style="max-height: 400px; overflow-y: auto;">
                ${this.cryptoData.map(coin => `
                    <div class="watchlist-coin" data-id="${coin.id}">
                        <div class="coin-info">
                            <img src="${coin.image}" alt="${coin.name}">
                            <div class="coin-details">
                                <div class="coin-name">${coin.name}</div>
                                <div class="coin-symbol">${coin.symbol.toUpperCase()}</div>
                            </div>
                        </div>
                        <button class="add-to-watchlist" onclick="cryptoTracker.addToWatchlist('${coin.id}')">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
        `;

        const overlay = document.createElement('div');
        overlay.className = 'popup-overlay';
        overlay.addEventListener('click', () => {
            modal.remove();
            overlay.remove();
        });

        document.body.appendChild(overlay);
        document.body.appendChild(modal);
    }

    async showHistoricalData(coin) {
        const popup = document.getElementById('historicalPopup');
        const overlay = document.getElementById('popupOverlay');
        
        popup.querySelector('h3').textContent = `${coin.name} - 7-Day Price History`;
        
        const historicalData = await this.loadHistoricalData(coin.id);
        if (historicalData) {
            this.updateHistoricalChart(historicalData);
            popup.style.display = 'block';
            overlay.style.display = 'block';
        }
    }

    hideHistoricalData() {
        const popup = document.getElementById('historicalPopup');
        const overlay = document.getElementById('popupOverlay');
        popup.style.display = 'none';
        overlay.style.display = 'none';
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }

    addToWatchlist(coinId) {
        if (!this.watchlist.includes(coinId)) {
            this.watchlist.push(coinId);
            localStorage.setItem('watchlist', JSON.stringify(this.watchlist));
            this.renderWatchlist();
            const modal = document.querySelector('.historical-popup');
            const overlay = document.querySelector('.popup-overlay');
            if (modal && overlay) {
                modal.remove();
                overlay.remove();
            }
        }
    }

    removeFromWatchlist(coinId) {
        this.watchlist = this.watchlist.filter(id => id !== coinId);
        localStorage.setItem('watchlist', JSON.stringify(this.watchlist));
        this.renderWatchlist();
    }

    renderWatchlist() {
        const container = document.getElementById('watchlistCoins');
        const watchlistCoins = this.cryptoData.filter(coin => this.watchlist.includes(coin.id));
        
        container.innerHTML = watchlistCoins.map(coin => {
            const priceChange = coin.price_change_percentage_24h;
            const changeClass = priceChange >= 0 ? 'price-up' : 'price-down';
            
            return `
                <div class="watchlist-coin">
                    <div class="coin-info">
                        <img src="${coin.image}" alt="${coin.name}">
                        <div class="coin-details">
                            <div class="coin-name">${coin.symbol.toUpperCase()}</div>
                            <div class="coin-price">$${this.formatNumber(coin.current_price)}</div>
                        </div>
                    </div>
                    <div class="coin-stats">
                        <span class="${changeClass}">${priceChange?.toFixed(2)}%</span>
                        <button class="remove-from-watchlist" onclick="cryptoTracker.removeFromWatchlist('${coin.id}')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateHistoricalChart(priceData) {
        if (this.chart) {
            this.chart.destroy();
        }

        const ctx = document.getElementById('historicalChart').getContext('2d');
        const labels = priceData.map(item => {
            const date = new Date(item[0]);
            return date.toLocaleDateString(undefined, { 
                month: 'short', 
                day: 'numeric',
                hour: 'numeric'
            });
        });

        const prices = priceData.map(item => item[1]);

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Price (USD)',
                    data: prices,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `$${context.parsed.y.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxTicksLimit: 8,
                            color: '#94a3b8'
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(148, 163, 184, 0.1)'
                        },
                        ticks: {
                            color: '#94a3b8',
                            callback: function(value) {
                                return `$${value.toFixed(2)}`;
                            }
                        }
                    }
                }
            }
        });
    }

    updateTopMovers() {
        const sorted = [...this.cryptoData].sort((a, b) => 
            b.price_change_percentage_24h - a.price_change_percentage_24h
        );

        const gainers = sorted.slice(0, 5);
        const losers = sorted.slice(-5).reverse();

        this.renderMovers('topGainers', gainers, true);
        this.renderMovers('topLosers', losers, false);
    }

    renderMovers(elementId, data, isGainer) {
        const container = document.getElementById(elementId);
        container.innerHTML = data.map(coin => `
            <div class="mover-item">
                <div class="coin-info">
                    <img src="${coin.image}" alt="${coin.name}" style="width: 20px; height: 20px;">
                    <span>${coin.symbol.toUpperCase()}</span>
                </div>
                <span class="${isGainer ? 'price-up' : 'price-down'}">
                    ${isGainer ? '+' : ''}${coin.price_change_percentage_24h?.toFixed(2)}%
                </span>
            </div>
        `).join('');
    }

    renderCryptoList() {
        const tableBody = document.getElementById('cryptoTableBody');
        tableBody.innerHTML = '';

        this.cryptoData.forEach(crypto => {
            const row = document.createElement('tr');
            row.className = 'crypto-row';
            
            const priceChange = crypto.price_change_percentage_24h;
            const changeClass = priceChange >= 0 ? 'price-up' : 'price-down';

            row.innerHTML = `
                <td>
                    <div class="coin-info">
                        <img src="${crypto.image}" alt="${crypto.name}">
                        <div>
                            <div class="coin-name">${crypto.name}</div>
                            <div class="coin-symbol">${crypto.symbol.toUpperCase()}</div>
                        </div>
                    </div>
                </td>
                <td>$${this.formatNumber(crypto.current_price)}</td>
                <td class="${changeClass}">${priceChange?.toFixed(2)}%</td>
                <td>$${this.formatMarketCap(crypto.market_cap)}</td>
                <td>$${this.formatVolume(crypto.total_volume)}</td>
            `;

            row.addEventListener('click', () => this.showHistoricalData(crypto));

            tableBody.appendChild(row);
        });
    }
    filterCryptoList(searchTerm) {
        const filteredData = this.cryptoData.filter(crypto =>
            crypto.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            crypto.symbol.toLowerCase().includes(searchTerm.toLowerCase())
        );
        this.renderFilteredList(filteredData);
    }

    renderFilteredList(filteredData) {
        const tableBody = document.getElementById('cryptoTableBody');
        tableBody.innerHTML = '';
        
        if (filteredData.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td colspan="5" style="text-align: center; padding: 2rem;">
                    No cryptocurrencies found matching your search.
                </td>
            `;
            tableBody.appendChild(row);
            return;
        }

        filteredData.forEach(crypto => {
            const row = document.createElement('tr');
            row.className = 'crypto-row';
            
            const priceChange = crypto.price_change_percentage_24h;
            const changeClass = priceChange >= 0 ? 'price-up' : 'price-down';

            row.innerHTML = `
                <td>
                    <div class="coin-info">
                        <img src="${crypto.image}" alt="${crypto.name}">
                        <div>
                            <div class="coin-name">${crypto.name}</div>
                            <div class="coin-symbol">${crypto.symbol.toUpperCase()}</div>
                        </div>
                    </div>
                </td>
                <td>$${this.formatNumber(crypto.current_price)}</td>
                <td class="${changeClass}">${priceChange?.toFixed(2)}%</td>
                <td>$${this.formatMarketCap(crypto.market_cap)}</td>
                <td>$${this.formatVolume(crypto.total_volume)}</td>
            `;

            row.addEventListener('mouseenter', () => this.showHistoricalData(crypto));
            row.addEventListener('mouseleave', () => this.hideHistoricalData());

            tableBody.appendChild(row);
        });
    }

    formatNumber(number) {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 6
        }).format(number);
    }

    formatMarketCap(marketCap) {
        if (marketCap >= 1e12) return (marketCap / 1e12).toFixed(2) + 'T';
        if (marketCap >= 1e9) return (marketCap / 1e9).toFixed(2) + 'B';
        if (marketCap >= 1e6) return (marketCap / 1e6).toFixed(2) + 'M';
        return marketCap.toLocaleString();
    }

    formatVolume(volume) {
        if (volume >= 1e9) return (volume / 1e9).toFixed(2) + 'B';
        if (volume >= 1e6) return (volume / 1e6).toFixed(2) + 'M';
        if (volume >= 1e3) return (volume / 1e3).toFixed(2) + 'K';
        return volume.toLocaleString();
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: var(--danger-color);
            color: white;
            padding: 1rem;
            border-radius: 8px;
            box-shadow: var(--shadow-md);
            z-index: 1000;
        `;
        document.body.appendChild(errorDiv);
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
}

// Initialize the tracker when the page loads
let cryptoTracker;
document.addEventListener('DOMContentLoaded', () => {
    cryptoTracker = new CryptoTracker();
});