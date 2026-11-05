const input = document.getElementById('searchInput');
const clearButton = document.getElementById('searchClear');
const tabs = document.getElementById('searchTabs');
const status = document.getElementById('searchStatus');
const grid = document.getElementById('searchGrid');
const idle = document.getElementById('searchIdle');
const recentSection = document.getElementById('recentSearches');
const recentList = document.getElementById('recentList');
const trendingGrid = document.getElementById('trendingGrid');
const personResult = document.getElementById('searchPerson');

let debounce;
let controller;
let results = [];
let filter = 'all';
let topPerson = null;

function saveRecent(query) {
    const others = readStore('cflixRecent').filter(saved => saved.toLowerCase() !== query.toLowerCase());
    writeStore('cflixRecent', [query, ...others].slice(0, 6));
}

function renderRecent() {
    const recent = readStore('cflixRecent');
    recentSection.hidden = recent.length === 0;

    recentList.replaceChildren(...recent.map(query => {
        const chip = document.createElement('button');
        chip.classList.add('chip');
        chip.type = 'button';
        chip.textContent = query;
        chip.addEventListener('click', () => {
            input.value = query;
            runSearch(query);
        });
        return chip;
    }));
}

function matchScore(item, query) {
    const title = itemTitle(item).toLowerCase();
    if (title === query) return 3;
    if (title.startsWith(query)) return 2;
    return title.includes(query) ? 1 : 0;
}

function isHindi(item) {
    return item.original_language === 'hi' ? 1 : 0;
}

function collectResults(responses, credits) {
    const seen = new Set();

    return credits
        .concat(responses.flatMap(response => response.results))
        .flatMap(item => item.media_type === 'person' ? item.known_for || [] : [item])
        .filter(item => (item.media_type === 'movie' || item.media_type === 'tv') && hasArtwork(item))
        .filter(item => {
            const key = `${item.media_type}-${item.id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

// When the best match is a person, show their work, not just TMDB's three highlights
function fetchCredits(responses, signal) {
    const top = responses[0].results[0];
    topPerson = top && top.media_type === 'person' ? top : null;
    if (!topPerson) return Promise.resolve([]);

    return tmdb(`person/${top.id}/combined_credits?language=en-US`, signal)
        .then(response => response.cast
            .filter(credit => !credit.genre_ids.some(genre => GUEST_APPEARANCE_GENRES.includes(genre)))
            .sort((a, b) => b.popularity - a.popularity)
            .slice(0, 40));
}

function fetchResults(query, signal) {
    const encoded = encodeURIComponent(query);
    const page = number => tmdb(`search/multi?query=${encoded}&include_adult=false&language=en-US&page=${number}`, signal);

    return Promise.all([page(1), page(2)]).then(responses =>
        fetchCredits(responses, signal).then(credits => {
            const lowered = query.toLowerCase();
            const items = collectResults(responses, credits);
            if (credits.length > 0) return items;

            return items
                .map((item, index) => ({ item, index, score: matchScore(item, lowered) }))
                .sort((a, b) => b.score - a.score || isHindi(b.item) - isHindi(a.item) || a.index - b.index)
                .map(entry => entry.item);
        }));
}

// "Leo 2023" means Leo released in 2023. Titles that end in a year, like
// "Blade Runner 2049", match nothing that way and fall back to the full text.
function searchTitles(query, signal) {
    const match = query.match(/^(.+?)\s+((?:19|20)\d{2})$/);
    if (!match) return fetchResults(query, signal);

    return fetchResults(match[1], signal).then(items => {
        const inYear = items.filter(item => itemYear(item) === match[2]);
        return inYear.length > 0 ? inYear : fetchResults(query, signal);
    });
}

function renderResults(query) {
    const visible = results.filter(item => filter === 'all' || item.media_type === filter);
    const counts = {
        all: results.length,
        movie: results.filter(item => item.media_type === 'movie').length,
        tv: results.filter(item => item.media_type === 'tv').length
    };

    tabs.hidden = results.length === 0;
    tabs.querySelectorAll('[data-filter]').forEach(tab => {
        tab.setAttribute('aria-pressed', String(tab.dataset.filter === filter));
        tab.querySelector('span').textContent = counts[tab.dataset.filter];
    });

    personResult.replaceChildren(...(topPerson ? [createPersonCard(topPerson, topPerson.known_for_department || 'Actor')] : []));
    grid.replaceChildren(...visible.map(createPosterCard));
    status.textContent = results.length === 0 ? `No matches for "${query}". Check the spelling or try another title.` : '';
    idle.hidden = results.length > 0;
}

function setIdle() {
    if (controller) controller.abort();
    results = [];
    topPerson = null;
    tabs.hidden = true;
    status.textContent = '';
    personResult.replaceChildren();
    grid.replaceChildren();
    idle.hidden = false;
    clearButton.hidden = true;
    history.replaceState(null, '', 'search.html');
    document.title = 'Search - CFlix';
    renderRecent();
}

function runSearch(value) {
    clearTimeout(debounce);
    const query = value.trim();

    if (query.length < 2) {
        setIdle();
        clearButton.hidden = value.length === 0;
        return;
    }

    if (controller) controller.abort();
    controller = new AbortController();
    const signal = controller.signal;

    clearButton.hidden = false;
    history.replaceState(null, '', `?q=${encodeURIComponent(query)}`);
    document.title = `${query} - CFlix`;

    searchTitles(query, signal)
        .then(items => {
            results = items;
            filter = 'all';
            renderResults(query);
        })
        .catch(err => {
            if (err.name === 'AbortError') return;
            console.error(err);
            results = [];
            grid.replaceChildren();
            tabs.hidden = true;
            status.textContent = 'Search is unavailable right now.';
        });
}

initLayout('search');

input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => runSearch(input.value), 300);
});

document.getElementById('searchForm').addEventListener('submit', event => {
    event.preventDefault();
    const query = input.value.trim();
    runSearch(input.value);
    if (query.length >= 2) saveRecent(query);
    input.blur();
});

// Opening a result counts as a finished search, even without pressing Enter
grid.addEventListener('click', event => {
    if (event.target.closest('a')) saveRecent(input.value.trim());
});

clearButton.addEventListener('click', () => {
    input.value = '';
    setIdle();
    input.focus();
});

tabs.querySelectorAll('[data-filter]').forEach(tab => {
    tab.addEventListener('click', () => {
        filter = tab.dataset.filter;
        renderResults(input.value.trim());
    });
});

tmdb('trending/all/day?language=en-US')
    .then(response => {
        const items = response.results.filter(item => item.media_type !== 'person' && hasArtwork(item));
        trendingGrid.replaceChildren(...items.slice(0, 12).map(createPosterCard));
    })
    .catch(err => console.error(err));

const initialQuery = new URLSearchParams(window.location.search).get('q');
renderRecent();

if (initialQuery) {
    input.value = initialQuery;
    runSearch(initialQuery);
}
