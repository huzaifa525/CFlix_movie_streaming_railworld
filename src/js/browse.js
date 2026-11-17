const params = new URLSearchParams(window.location.search);
const LAST_PAGE = 500;
const THIS_YEAR = new Date().getFullYear();

// TMDB provider IDs for the main services in India
const PROVIDERS = [
    ['8', 'Netflix'],
    ['119', 'Prime Video'],
    ['2336', 'JioHotstar'],
    ['232', 'Zee5'],
    ['237', 'Sony Liv'],
    ['350', 'Apple TV'],
    ['11', 'MUBI'],
    ['283', 'Crunchyroll']
];

const YEARS = [
    ...[0, 1, 2].map(offset => {
        const year = String(THIS_YEAR - offset);
        return [year, year, `${year}-01-01`, `${year}-12-31`];
    }),
    ['2020s', '2020s', '2020-01-01', '2029-12-31'],
    ['2010s', '2010s', '2010-01-01', '2019-12-31'],
    ['2000s', '2000s', '2000-01-01', '2009-12-31'],
    ['1990s', '1990s', '1990-01-01', '1999-12-31'],
    ['older', 'Before 1990', '1900-01-01', '1989-12-31']
];

const RUNTIMES = {
    short: [null, 89],
    medium: [90, 150],
    long: [151, null]
};

// Filters reset by Clear filters, with the select that controls each one
const EXTRA_FILTERS = ['year', 'rating', 'runtime', 'status', 'provider'];

const state = {
    view: params.get('view') || '',
    type: params.get('type') === 'tv' ? 'tv' : 'movie',
    genre: params.get('genre') || '',
    lang: params.get('lang') || 'hi',
    mood: params.get('mood') || '',
    sort: params.get('sort') || 'popular',
    year: params.get('year') || '',
    rating: params.get('rating') || '',
    runtime: params.get('runtime') || '',
    status: params.get('status') || '',
    provider: params.get('provider') || ''
};

const grid = document.getElementById('browseGrid');
const status = document.getElementById('browseStatus');
const heading = document.getElementById('browseTitle');
const chips = document.getElementById('genreChips');
const moodChips = document.getElementById('moodChips');
const languageFilter = document.getElementById('languageFilter');
const sortFilter = document.getElementById('sortFilter');
const countText = document.getElementById('browseCount');
const clearButton = document.getElementById('clearFilters');

let genres = [];
let page = 0;
let totalPages = 1;
let loading = false;
let shown = new Set();
let controller;

const pageEnd = document.getElementById('loadMore');
const pageEndObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) loadNextPage();
}, { rootMargin: '600px' });

function activeNav() {
    if (state.view === 'list') return 'list';
    return state.type;
}

function updateHeading() {
    const language = LANGUAGES.find(([code]) => code === state.lang);
    const genre = genres.find(item => String(item.id) === state.genre);
    const mood = MOODS.find(entry => entry.id === state.mood);
    const provider = PROVIDERS.find(([value]) => value === state.provider);
    const text = [language && language[1], mood ? mood.label : genre && genre.name, state.type === 'tv' ? 'Series' : 'Movies'];

    heading.textContent = text.filter(Boolean).join(' ') + (provider ? ` on ${provider[1]}` : '');
    document.title = `${heading.textContent} - CFlix`;
}

function syncUrl() {
    const query = new URLSearchParams({ type: state.type });
    if (state.genre) query.set('genre', state.genre);
    if (state.mood) query.set('mood', state.mood);
    if (state.lang !== 'hi') query.set('lang', state.lang);
    if (state.sort !== 'popular') query.set('sort', state.sort);
    EXTRA_FILTERS.forEach(key => {
        if (state[key]) query.set(key, state[key]);
    });
    history.replaceState(null, '', `?${query}`);
}

function discoverPath(nextPage) {
    const dateField = state.type === 'tv' ? 'first_air_date' : 'primary_release_date';
    const query = new URLSearchParams({
        include_adult: 'false',
        language: 'en-US',
        page: nextPage,
        sort_by: {
            popular: 'popularity.desc',
            new: `${dateField}.desc`,
            top: 'vote_average.desc',
            votes: 'vote_count.desc',
            az: state.type === 'tv' ? 'name.asc' : 'title.asc'
        }[state.sort],
        [`${dateField}.lte`]: isoDate()
    });

    const mood = MOODS.find(entry => entry.id === state.mood);
    if (state.genre || mood) query.set('with_genres', state.genre || mood[state.type]);
    if (state.lang !== 'all') query.set('with_original_language', state.lang);
    if (state.sort === 'top') query.set('vote_count.gte', state.lang === 'all' ? '300' : '50');
    if (state.sort === 'new' && state.type === 'movie') query.set('with_release_type', '2|3|4');
    if (state.sort === 'az') query.set('vote_count.gte', '20');

    const year = YEARS.find(([value]) => value === state.year);
    if (year) {
        query.set(`${dateField}.gte`, year[2]);
        query.set(`${dateField}.lte`, year[3] < isoDate() ? year[3] : isoDate());
    }

    if (state.rating) {
        query.set('vote_average.gte', state.rating);
        if (!query.has('vote_count.gte')) query.set('vote_count.gte', '20');
    }

    const runtime = RUNTIMES[state.runtime];
    if (state.type === 'movie' && runtime) {
        if (runtime[0]) query.set('with_runtime.gte', runtime[0]);
        if (runtime[1]) query.set('with_runtime.lte', runtime[1]);
    }

    if (state.type === 'tv' && state.status) query.set('with_status', state.status);

    if (state.provider) {
        query.set('with_watch_providers', state.provider);
        query.set('watch_region', 'IN');
    }

    return `discover/${state.type}?${query}`;
}

function loadNextPage() {
    if (loading || page >= Math.min(totalPages, LAST_PAGE)) return;
    loading = true;
    const signal = controller.signal;

    tmdb(discoverPath(page + 1), signal)
        .then(response => {
            page = response.page;
            totalPages = response.total_pages;
            loading = false;
            if (page === 1) {
                const total = response.total_results;
                countText.textContent = total > 0 ? `${total.toLocaleString('en-IN')} ${total === 1 ? 'title' : 'titles'}` : '';
            }

            const items = response.results.filter(item => item.poster_path && !shown.has(item.id));
            items.forEach(item => shown.add(item.id));
            grid.append(...items.map(createPosterCard));
            status.textContent = shown.size === 0 ? 'No titles match these filters.' : '';

            // Observing again rechecks, in case this page didn't fill the screen
            pageEndObserver.unobserve(pageEnd);
            pageEndObserver.observe(pageEnd);
        })
        .catch(err => {
            if (err.name === 'AbortError') return;
            console.error(err);
            loading = false;
            totalPages = 0;
            status.textContent = "Couldn't load titles right now.";
        });
}

function resetResults() {
    if (controller) controller.abort();
    controller = new AbortController();
    grid.replaceChildren();
    status.textContent = '';
    countText.textContent = '';
    shown = new Set();
    page = 0;
    totalPages = 1;
    loading = false;

    updateHeading();
    syncUrl();
    setActiveNav(activeNav());
    clearButton.hidden = !hasFilters();
    loadNextPage();
}

function hasFilters() {
    return Boolean(state.genre || state.mood || state.sort !== 'popular' || EXTRA_FILTERS.some(key => state[key]));
}

function filterSelect(key) {
    return document.getElementById(`${key}Filter`);
}

// Runtime only applies to movies and status only to series
function updateTypeFilters() {
    filterSelect('runtime').hidden = state.type !== 'movie';
    filterSelect('status').hidden = state.type !== 'tv';
    if (state.type !== 'movie') state.runtime = '';
    if (state.type !== 'tv') state.status = '';
    filterSelect('runtime').value = state.runtime;
    filterSelect('status').value = state.status;
}

function renderMoodChips() {
    moodChips.replaceChildren(...MOODS.map(mood => {
        const chip = document.createElement('button');
        chip.classList.add('chip', 'chip--mood');
        chip.type = 'button';
        chip.textContent = mood.label;
        chip.setAttribute('aria-pressed', String(mood.id === state.mood));
        chip.addEventListener('click', () => {
            state.mood = mood.id === state.mood ? '' : mood.id;
            state.genre = '';
            renderMoodChips();
            renderChips();
            resetResults();
        });
        return chip;
    }));
}

function renderChips() {
    const options = [{ id: '', name: 'All Genres' }, ...genres];

    chips.replaceChildren(...options.map(genre => {
        const chip = document.createElement('button');
        chip.classList.add('chip');
        chip.type = 'button';
        chip.textContent = genre.name;
        chip.setAttribute('aria-pressed', String(String(genre.id) === state.genre));
        chip.addEventListener('click', () => {
            state.genre = String(genre.id);
            state.mood = '';
            renderMoodChips();
            renderChips();
            resetResults();
        });
        return chip;
    }));
}

function loadGenres() {
    return tmdb(`genre/${state.type}/list?language=en-US`)
        .then(response => {
            genres = response.genres;
            renderChips();
            updateHeading();
        })
        .catch(err => console.error(err));
}

function updateTabs() {
    document.querySelectorAll('[data-type]').forEach(tab => {
        tab.setAttribute('aria-pressed', String(tab.dataset.type === state.type));
    });
}

function initFilters() {
    languageFilter.append(...LANGUAGES.map(([code, label]) => new Option(label, code)));
    filterSelect('year').append(...YEARS.map(([value, label]) => new Option(label, value)));
    filterSelect('provider').append(...PROVIDERS.map(([value, label]) => new Option(label, value)));
    languageFilter.value = state.lang;
    sortFilter.value = state.sort;

    EXTRA_FILTERS.forEach(key => {
        const select = filterSelect(key);
        select.value = state[key];
        if (select.value !== state[key]) state[key] = '';
        select.addEventListener('change', () => {
            state[key] = select.value;
            resetResults();
        });
    });

    clearButton.addEventListener('click', () => {
        state.genre = '';
        state.mood = '';
        state.sort = 'popular';
        sortFilter.value = state.sort;
        EXTRA_FILTERS.forEach(key => {
            state[key] = '';
            filterSelect(key).value = '';
        });
        renderMoodChips();
        renderChips();
        resetResults();
    });

    languageFilter.addEventListener('change', () => {
        state.lang = languageFilter.value;
        resetResults();
    });

    sortFilter.addEventListener('change', () => {
        state.sort = sortFilter.value;
        resetResults();
    });

    document.querySelectorAll('[data-type]').forEach(tab => {
        tab.addEventListener('click', () => {
            if (tab.dataset.type === state.type) return;
            // Movie and series genre IDs differ, so the selected genre can't carry over
            state.type = tab.dataset.type;
            state.genre = '';
            genres = [];
            updateTabs();
            updateTypeFilters();
            chips.replaceChildren();
            loadGenres();
            resetResults();
        });
    });

    updateTabs();
    updateTypeFilters();
}

function showMyList() {
    const items = readStore('cflixList');

    heading.textContent = 'My List';
    document.title = 'My List - CFlix';
    document.getElementById('browseFilters').hidden = true;
    chips.hidden = true;
    moodChips.hidden = true;
    grid.append(...items.map(createPosterCard));
    status.textContent = items.length === 0 ? 'Titles you add to My List will show up here.' : '';
}

initLayout(activeNav());

if (state.view === 'list') {
    showMyList();
} else {
    initFilters();
    renderMoodChips();
    loadGenres();
    resetResults();
}
