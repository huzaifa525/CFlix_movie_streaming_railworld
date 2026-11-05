const SINCE_RECENT = isoDate(120);
const SINCE_LAST_YEAR = isoDate(365);
const TODAY = isoDate();
const DISCOVER = 'include_adult=false&language=en-US&sort_by=popularity.desc';
const NEW_MOVIES = `${DISCOVER}&with_release_type=2%7C3%7C4&primary_release_date.lte=${TODAY}`;
const NEW_SERIES = `${DISCOVER}&first_air_date.lte=${TODAY}`;

function moodRow(id) {
    const mood = MOODS.find(entry => entry.id === id);
    return {
        heading: mood.label,
        href: `./browse.html?type=movie&mood=${id}`,
        path: `discover/movie?${DISCOVER}&with_original_language=hi&vote_count.gte=5&with_genres=${encodeURIComponent(mood.movie)}`
    };
}

const HOME_ROWS = [
    {
        heading: 'New Arrivals in Hindi',
        href: './browse.html?type=movie&sort=new',
        path: `discover/movie?${NEW_MOVIES}&with_original_language=hi&primary_release_date.gte=${SINCE_LAST_YEAR}`
    },
    {
        heading: 'New Hindi Series',
        href: './browse.html?type=tv&sort=new',
        path: `discover/tv?${NEW_SERIES}&with_original_language=hi&first_air_date.gte=${SINCE_LAST_YEAR}`
    },
    'trending',
    moodRow('feel-good'),
    moodRow('edge'),
    moodRow('mind-bending'),
    {
        heading: 'New Releases',
        href: './browse.html?type=movie&lang=all&sort=new',
        path: `discover/movie?${NEW_MOVIES}&primary_release_date.gte=${SINCE_RECENT}`
    },
    {
        heading: 'New Series',
        href: './browse.html?type=tv&lang=all&sort=new',
        path: `discover/tv?${NEW_SERIES}&first_air_date.gte=${SINCE_RECENT}`
    }
];

let trendingRequest = 0;
let trendingItems = [];
let slides = [];
let slideIndex = 0;
let slideTimer;
let slideRequest = 0;
const SLIDE_SECONDS = 12;
const showBannerTrailers = window.matchMedia('(hover: hover) and (min-width: 1000px) and (prefers-reduced-motion: no-preference)').matches;
const autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function playIntro() {
    try {
        if (sessionStorage.getItem('introPlayed')) return;
        sessionStorage.setItem('introPlayed', 'true');
    } catch (err) {
        return;
    }

    const intro = document.createElement('div');
    intro.classList.add('intro');
    intro.innerHTML = '<span class="logo">CFLIX</span>';
    intro.addEventListener('animationend', event => {
        if (event.target === intro) intro.remove();
    });
    document.body.append(intro);
}

function createRankedCard(item, index) {
    const card = document.createElement('a');
    card.classList.add('ranked');
    card.href = titleUrl(item);
    card.setAttribute('aria-label', `${index + 1}. ${itemTitle(item)}`);

    const rank = document.createElement('span');
    rank.classList.add('ranked__number');
    rank.textContent = index + 1;

    const poster = document.createElement('img');
    poster.src = `${TMDB_IMAGES}/w342${item.poster_path}`;
    poster.alt = '';
    poster.loading = 'lazy';

    card.append(rank, poster);
    cardItems.set(card, item);
    return card;
}

function scheduleSlide() {
    clearTimeout(slideTimer);
    if (autoRotate && slides.length > 1) {
        slideTimer = setTimeout(() => showSlide((slideIndex + 1) % slides.length), SLIDE_SECONDS * 1000);
    }
}

function showSlide(index) {
    const request = ++slideRequest;
    const layers = document.querySelectorAll('.banner__slide');
    const dots = document.querySelectorAll('.banner__dots button');
    const item = slides[index];

    slideIndex = index;
    layers.forEach((layer, i) => {
        layer.classList.toggle('banner__slide--active', i === index);
        if (i !== index) layer.replaceChildren();
    });
    dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === index)));

    document.getElementById('bannerTitle').textContent = itemTitle(item);
    document.getElementById('bannerDetails').textContent = [itemYear(item), mediaType(item) === 'tv' ? 'Series' : 'Movie', 'Hindi'].filter(Boolean).join(' · ');
    document.getElementById('bannerDescription').textContent = item.overview;
    document.getElementById('bannerPlay').href = titleUrl(item);
    renderListButton(document.getElementById('bannerList'), item);
    scheduleSlide();

    if (!showBannerTrailers) return;
    fetchTrailerKey(item)
        .then(key => {
            if (key && request === slideRequest && !document.hidden) layers[index].append(createTrailerFrame(key));
        })
        .catch(err => console.error(err));
}

function initBanner(items) {
    slides = items;
    const banner = document.getElementById('banner');

    document.getElementById('bannerSlides').replaceChildren(...slides.map(item => {
        const layer = document.createElement('div');
        layer.classList.add('banner__slide');
        layer.style.backgroundImage = `url(${TMDB_IMAGES}/w1280${item.backdrop_path})`;
        return layer;
    }));

    document.getElementById('bannerDots').replaceChildren(...slides.map((item, index) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.setAttribute('aria-label', `Show ${itemTitle(item)}`);
        dot.addEventListener('click', () => showSlide(index));
        return dot;
    }));

    const list = document.getElementById('bannerList');
    list.hidden = false;
    list.addEventListener('click', () => {
        toggleList(slides[slideIndex]);
        renderListButton(list, slides[slideIndex]);
    });

    const surprise = document.getElementById('surpriseButton');
    surprise.hidden = false;
    surprise.addEventListener('click', () => {
        const pool = trendingItems.length > 0 ? trendingItems : slides;
        window.location.href = titleUrl(pool[Math.floor(Math.random() * pool.length)]);
    });

    document.getElementById('bannerPlay').hidden = false;
    banner.addEventListener('focusin', () => clearTimeout(slideTimer));
    banner.addEventListener('focusout', scheduleSlide);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) clearTimeout(slideTimer);
        else scheduleSlide();
    });

    showSlide(0);
}

function loadBanner() {
    const recent = isoDate(365);
    const movies = tmdb(`discover/movie?${DISCOVER}&with_original_language=hi&with_release_type=2%7C3%7C4&primary_release_date.gte=${recent}&primary_release_date.lte=${TODAY}`);
    const series = tmdb(`discover/tv?${DISCOVER}&with_original_language=hi&first_air_date.gte=${recent}&first_air_date.lte=${TODAY}`);

    Promise.all([movies, series])
        .then(([movieResults, seriesResults]) => {
            const usable = item => item.backdrop_path && item.overview;
            initBanner([
                ...movieResults.results.filter(usable).slice(0, 3),
                ...seriesResults.results.filter(usable).slice(0, 2)
            ]);
        })
        .catch(err => console.error(err));
}

// TMDB rescores trending often and offers only these windows, with no filters
function loadTrending(row, timeWindow) {
    const period = ++trendingRequest;

    return tmdb(`trending/all/${timeWindow}?language=en-US`)
        .then(response => {
            if (period !== trendingRequest) return;
            trendingItems = response.results.filter(item => item.media_type !== 'person' && item.poster_path);
            fillRow(row, trendingItems.slice(0, 10).map(createRankedCard));
            row.querySelector('.row__items').scrollLeft = 0;
        })
        .catch(err => {
            console.error(err);
            row.hidden = true;
        });
}

function createTrendingRow() {
    const row = createRow('Trending Now');
    const toggle = document.createElement('div');
    toggle.classList.add('toggle');
    toggle.setAttribute('role', 'group');
    toggle.setAttribute('aria-label', 'Trending period');

    [['day', 'Today'], ['week', 'This Week']].forEach(([timeWindow, label]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.setAttribute('aria-pressed', String(timeWindow === 'week'));
        button.addEventListener('click', () => {
            toggle.querySelectorAll('button').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
            loadTrending(row, timeWindow);
        });
        toggle.append(button);
    });

    row.querySelector('.row__heading').append(toggle);
    return row;
}

function createChipRow(heading, links) {
    const row = createRow(heading);

    fillRow(row, links.map(({ label, href }) => {
        const link = document.createElement('a');
        link.classList.add('chip');
        link.href = href;
        link.textContent = label;
        return link;
    }));

    return row;
}

function addStoredRow(rows, heading, key, href) {
    const items = readStore(key);
    if (items.length === 0) return;

    const row = createRow(heading, href);
    rows.append(row);
    fillRow(row, items.map(createCard));
}

function addRemoteRow(rows, config) {
    const row = createRow(config.heading, config.href);
    rows.append(row);

    tmdb(config.path)
        .then(response => fillRow(row, response.results.filter(hasArtwork).map(createCard)))
        .catch(err => {
            console.error(err);
            row.hidden = true;
        });
}

playIntro();
initLayout('home');

const rows = document.getElementById('rows');
const trendingRow = createTrendingRow();

addStoredRow(rows, 'Continue Watching', 'cflixContinue');
rows.append(createChipRow('Browse by Mood', MOODS.map(mood => ({
    label: mood.label,
    href: `./browse.html?type=movie&mood=${mood.id}`
}))));

HOME_ROWS.forEach(config => {
    if (config === 'trending') {
        rows.append(trendingRow);
    } else {
        addRemoteRow(rows, config);
    }
});

addStoredRow(rows, 'My List', 'cflixList', './browse.html?view=list');

loadBanner();
loadTrending(trendingRow, 'week');

tmdb('genre/movie/list?language=en-US')
    .then(response => rows.append(createChipRow('Browse by Genre', response.genres.map(genre => ({
        label: genre.name,
        href: `./browse.html?type=movie&genre=${genre.id}`
    })))))
    .catch(err => console.error(err));
