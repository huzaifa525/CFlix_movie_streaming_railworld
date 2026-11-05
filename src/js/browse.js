const params = new URLSearchParams(window.location.search);
const LAST_PAGE = 500;

const state = {
    view: params.get('view') || '',
    type: params.get('type') === 'tv' ? 'tv' : 'movie',
    genre: params.get('genre') || '',
    lang: params.get('lang') || 'hi',
    mood: params.get('mood') || '',
    sort: params.get('sort') || 'popular'
};

const grid = document.getElementById('browseGrid');
const status = document.getElementById('browseStatus');
const heading = document.getElementById('browseTitle');
const chips = document.getElementById('genreChips');
const moodChips = document.getElementById('moodChips');
const languageFilter = document.getElementById('languageFilter');
const sortFilter = document.getElementById('sortFilter');

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
    const text = [language && language[1], mood ? mood.label : genre && genre.name, state.type === 'tv' ? 'Series' : 'Movies'];

    heading.textContent = text.filter(Boolean).join(' ');
    document.title = `${heading.textContent} - CFlix`;
}

function syncUrl() {
    const query = new URLSearchParams({ type: state.type });
    if (state.genre) query.set('genre', state.genre);
    if (state.mood) query.set('mood', state.mood);
    if (state.lang !== 'hi') query.set('lang', state.lang);
    if (state.sort !== 'popular') query.set('sort', state.sort);
    history.replaceState(null, '', `?${query}`);
}

function discoverPath(nextPage) {
    const dateField = state.type === 'tv' ? 'first_air_date' : 'primary_release_date';
    const query = new URLSearchParams({
        include_adult: 'false',
        language: 'en-US',
        page: nextPage,
        sort_by: { popular: 'popularity.desc', new: `${dateField}.desc`, top: 'vote_average.desc' }[state.sort],
        [`${dateField}.lte`]: isoDate()
    });

    const mood = MOODS.find(entry => entry.id === state.mood);
    if (state.genre || mood) query.set('with_genres', state.genre || mood[state.type]);
    if (state.lang !== 'all') query.set('with_original_language', state.lang);
    if (state.sort === 'top') query.set('vote_count.gte', state.lang === 'all' ? '300' : '50');
    if (state.sort === 'new' && state.type === 'movie') query.set('with_release_type', '2|3|4');

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
    shown = new Set();
    page = 0;
    totalPages = 1;
    loading = false;

    updateHeading();
    syncUrl();
    setActiveNav(activeNav());
    loadNextPage();
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
    languageFilter.value = state.lang;
    sortFilter.value = state.sort;

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
            chips.replaceChildren();
            loadGenres();
            resetResults();
        });
    });

    updateTabs();
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
