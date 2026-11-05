const TMDB_OPTIONS = {
    method: 'GET',
    headers: {
        accept: 'application/json',
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI1YTEwZGZlNDFiYWZiNWNhNTYwYThkMDExMzRiY2Q1YSIsInN1YiI6IjY1ODFhYTg5MjI2YzU2MDgxOTllZjNiMiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.OauOdAuGYhz1Hq2yAzex1yI1qsNErO_yyM6AEavU_Xo'
    }
};
const TMDB_IMAGES = 'https://image.tmdb.org/t/p';

const LANGUAGES = [
    ['hi', 'Hindi'],
    ['en', 'English'],
    ['ko', 'Korean'],
    ['ja', 'Japanese'],
    ['es', 'Spanish']
];

// TMDB genre IDs, joined with | so a title only needs to match one of them.
// Movies and series have separate genre lists.
const MOODS = [
    { id: 'feel-good', label: 'Feel-Good', movie: '35|10751|10749', tv: '35|10751' },
    { id: 'edge', label: 'Edge of Your Seat', movie: '53|80', tv: '80|9648' },
    { id: 'mind-bending', label: 'Mind-Bending', movie: '878|9648|14', tv: '10765|9648' },
    { id: 'heartfelt', label: 'Heartfelt', movie: '18|10749', tv: '18' },
    { id: 'adrenaline', label: 'Adrenaline Rush', movie: '28|12', tv: '10759' },
    { id: 'late-night', label: 'Late-Night Chills', movie: '27', tv: '9648' }
];

// TMDB's News, Reality and Talk genres, where actors appear as guests
const GUEST_APPEARANCE_GENRES = [10763, 10764, 10767];

const cardItems = new WeakMap();
const trailerKeys = new Map();

function tmdb(path, signal) {
    return fetch(`https://api.themoviedb.org/3/${path}`, { ...TMDB_OPTIONS, signal }).then(response => {
        if (!response.ok) throw new Error(`TMDB request failed: ${response.status}`);
        return response.json();
    });
}

function isoDate(daysAgo = 0) {
    return new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
}

function mediaType(item) {
    return item.media_type || ('title' in item ? 'movie' : 'tv');
}

function itemTitle(item) {
    return item.title || item.name;
}

function itemYear(item) {
    return (item.release_date || item.first_air_date || '').slice(0, 4);
}

function hasArtwork(item) {
    return Boolean(item.poster_path || item.backdrop_path);
}

function watchUrl(item, season, episode) {
    const url = `watch.html?type=${mediaType(item)}&id=${item.id}`;
    return season ? `${url}&season=${season}&episode=${episode}` : url;
}

function titleUrl(item) {
    if (item.resume) return watchUrl(item, item.season, item.episode);
    return `title.html?type=${mediaType(item)}&id=${item.id}`;
}

// Browser storage can be blocked, so every read and write has to survive that
function readStore(key) {
    try {
        return JSON.parse(localStorage.getItem(key)) || [];
    } catch (err) {
        return [];
    }
}

function writeStore(key, items) {
    try {
        localStorage.setItem(key, JSON.stringify(items));
    } catch (err) {
        console.error(err);
    }
}

function storedItem(item) {
    return {
        id: item.id,
        media_type: mediaType(item),
        title: itemTitle(item),
        poster_path: item.poster_path,
        backdrop_path: item.backdrop_path,
        release_date: item.release_date || item.first_air_date
    };
}

function sameItem(a, b) {
    return a.id === b.id && mediaType(a) === mediaType(b);
}

function isInList(item) {
    return readStore('cflixList').some(saved => sameItem(saved, item));
}

function toggleList(item) {
    const list = readStore('cflixList');
    const remaining = list.filter(saved => !sameItem(saved, item));
    writeStore('cflixList', remaining.length === list.length ? [storedItem(item), ...list] : remaining);
}

function addToContinueWatching(item, season, episode) {
    const others = readStore('cflixContinue').filter(saved => !sameItem(saved, item));
    writeStore('cflixContinue', [{ ...storedItem(item), resume: true, season, episode }, ...others].slice(0, 20));
}

function renderListButton(button, item) {
    const saved = isInList(item);
    button.innerHTML = `<i class="fas fa-${saved ? 'check' : 'plus'}"></i> My List`;
    button.setAttribute('aria-pressed', String(saved));
}

function initListButton(button, item) {
    button.hidden = false;
    button.addEventListener('click', () => {
        toggleList(item);
        renderListButton(button, item);
    });
    renderListButton(button, item);
}

function fetchTrailerKey(item) {
    const cacheKey = `${mediaType(item)}-${item.id}`;
    if (trailerKeys.has(cacheKey)) return Promise.resolve(trailerKeys.get(cacheKey));

    return tmdb(`${mediaType(item)}/${item.id}/videos?language=en-US`).then(response => {
        const youtube = response.results.filter(video => video.site === 'YouTube');
        const trailer = youtube.find(video => video.type === 'Trailer') || youtube.find(video => video.type === 'Teaser');
        const key = trailer ? trailer.key : null;
        trailerKeys.set(cacheKey, key);
        return key;
    });
}

function createTrailerFrame(key) {
    const frame = document.createElement('iframe');
    frame.src = `https://www.youtube-nocookie.com/embed/${key}?autoplay=1&mute=1&controls=0&rel=0&playsinline=1&loop=1&playlist=${key}`;
    frame.title = 'Trailer preview';
    frame.allow = 'autoplay; encrypted-media';
    frame.tabIndex = -1;
    return frame;
}

function createCard(item) {
    const card = document.createElement('a');
    card.classList.add('card');
    card.href = titleUrl(item);

    const image = document.createElement('img');
    image.src = `${TMDB_IMAGES}/w500${item.backdrop_path || item.poster_path}`;
    image.alt = '';
    image.loading = 'lazy';

    const title = document.createElement('span');
    title.classList.add('card__title');
    title.textContent = itemTitle(item);

    card.append(image, title);
    cardItems.set(card, item);
    return card;
}

function createPosterCard(item) {
    const card = document.createElement('a');
    card.classList.add('poster');
    card.href = titleUrl(item);

    const image = document.createElement('img');
    image.src = `${TMDB_IMAGES}/w342${item.poster_path || item.backdrop_path}`;
    image.alt = '';
    image.loading = 'lazy';

    const title = document.createElement('span');
    title.classList.add('poster__title');
    title.textContent = itemTitle(item);

    const details = document.createElement('span');
    details.classList.add('poster__details');
    details.textContent = [itemYear(item), mediaType(item) === 'tv' ? 'Series' : 'Movie'].filter(Boolean).join(' · ');

    card.append(image, title, details);
    cardItems.set(card, item);
    return card;
}

function createPersonCard(person, detail) {
    const card = document.createElement('a');
    card.classList.add('person-card');
    card.href = `person.html?id=${person.id}`;

    const photo = document.createElement('span');
    photo.classList.add('person-card__photo');
    if (person.profile_path) {
        const image = document.createElement('img');
        image.src = `${TMDB_IMAGES}/w185${person.profile_path}`;
        image.alt = '';
        image.loading = 'lazy';
        photo.append(image);
    } else {
        photo.innerHTML = '<i class="fas fa-user"></i>';
    }

    const name = document.createElement('strong');
    name.textContent = person.name;

    const role = document.createElement('small');
    role.textContent = detail || '';

    card.append(photo, name, role);
    return card;
}

function createRow(heading, href) {
    const row = document.createElement('section');
    row.classList.add('row');
    row.innerHTML = `
        <div class="row__heading">
            <h2 class="row__title"></h2>
        </div>
        <div class="row__viewport">
            <button class="row__arrow row__arrow--left" type="button" aria-label="Scroll left" hidden><i class="fas fa-chevron-left"></i></button>
            <div class="row__items"></div>
            <button class="row__arrow row__arrow--right" type="button" aria-label="Scroll right" hidden><i class="fas fa-chevron-right"></i></button>
        </div>`;
    row.querySelector('.row__title').textContent = heading;

    if (href) {
        const all = document.createElement('a');
        all.classList.add('row__all');
        all.href = href;
        all.textContent = 'See all';
        row.querySelector('.row__heading').append(all);
    }

    return row;
}

function initRow(row) {
    const items = row.querySelector('.row__items');
    const left = row.querySelector('.row__arrow--left');
    const right = row.querySelector('.row__arrow--right');

    const updateArrows = () => {
        left.hidden = items.scrollLeft <= 0;
        right.hidden = items.scrollLeft + items.clientWidth >= items.scrollWidth - 1;
    };

    left.addEventListener('click', () => items.scrollBy({ left: -items.clientWidth * 0.9, behavior: 'smooth' }));
    right.addEventListener('click', () => items.scrollBy({ left: items.clientWidth * 0.9, behavior: 'smooth' }));
    items.addEventListener('scroll', updateArrows);
    window.addEventListener('resize', updateArrows);
    updateArrows();

    return updateArrows;
}

function fillRow(row, elements) {
    row.querySelector('.row__items').replaceChildren(...elements);
    if (!row.updateArrows) row.updateArrows = initRow(row);
    row.updateArrows();
}

function setActiveNav(active) {
    document.querySelectorAll('[data-nav]').forEach(link => {
        link.classList.toggle('nav__link--active', link.dataset.nav === active);
    });
}

function initPreviews() {
    if (!window.matchMedia('(hover: hover) and (min-width: 1000px)').matches) return;

    const preview = document.createElement('div');
    preview.classList.add('preview');
    preview.hidden = true;
    preview.innerHTML = `
        <div class="preview__media"></div>
        <div class="preview__body">
            <h3></h3>
            <p class="preview__details"></p>
            <p class="preview__overview"></p>
            <div class="preview__actions">
                <a class="button button--white"><i class="fas fa-play"></i> Play</a>
                <button class="button button--ghost" type="button"></button>
                <a class="button button--ghost preview__info" aria-label="More info"><i class="fas fa-info"></i></a>
            </div>
        </div>`;
    document.body.append(preview);

    const media = preview.querySelector('.preview__media');
    const play = preview.querySelector('.button--white');
    const list = preview.querySelector('button');
    const info = preview.querySelector('.preview__info');

    let current = null;
    let openTimer;
    let closeTimer;

    const close = () => {
        clearTimeout(openTimer);
        clearTimeout(closeTimer);
        current = null;
        preview.hidden = true;
        media.replaceChildren();
    };

    const show = card => {
        const item = cardItems.get(card);
        const rect = card.getBoundingClientRect();
        const artwork = item.backdrop_path || item.poster_path;
        const rating = item.vote_count > 0 ? `${item.vote_average.toFixed(1)} / 10` : '';

        current = card;
        const image = document.createElement('img');
        image.src = `${TMDB_IMAGES}/w500${artwork}`;
        image.alt = '';
        media.replaceChildren(image);

        preview.querySelector('h3').textContent = itemTitle(item);
        preview.querySelector('.preview__details').textContent = [itemYear(item), mediaType(item) === 'tv' ? 'Series' : 'Movie', rating].filter(Boolean).join(' · ');
        preview.querySelector('.preview__overview').textContent = item.overview || '';
        play.href = item.resume ? titleUrl(item) : watchUrl(item);
        info.href = `title.html?type=${mediaType(item)}&id=${item.id}`;
        renderListButton(list, item);

        preview.hidden = false;
        const maxLeft = window.innerWidth - preview.offsetWidth - 12;
        const maxTop = window.scrollY + window.innerHeight - preview.offsetHeight - 12;
        preview.style.left = `${Math.max(12, Math.min(rect.left + rect.width / 2 - preview.offsetWidth / 2, maxLeft))}px`;
        preview.style.top = `${Math.max(window.scrollY + 70, Math.min(rect.top + window.scrollY - 30, maxTop))}px`;

        fetchTrailerKey(item)
            .then(key => {
                if (key && current === card) media.append(createTrailerFrame(key));
            })
            .catch(err => console.error(err));
    };

    list.addEventListener('click', () => {
        const item = cardItems.get(current);
        toggleList(item);
        renderListButton(list, item);
    });

    document.addEventListener('mouseover', event => {
        if (event.target.closest('.preview')) {
            clearTimeout(closeTimer);
            return;
        }

        const card = event.target.closest('.card, .ranked, .poster');
        if (!card || !cardItems.has(card)) {
            clearTimeout(openTimer);
            clearTimeout(closeTimer);
            closeTimer = setTimeout(close, 200);
            return;
        }

        clearTimeout(closeTimer);
        if (card === current) return;
        clearTimeout(openTimer);
        openTimer = setTimeout(() => {
            close();
            show(card);
        }, 550);
    });

    window.addEventListener('scroll', close, { passive: true });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') close();
    });
}

function initLayout(active) {
    const nav = document.getElementById('nav');
    nav.innerHTML = `
        <a href="./index.html" class="logo">CFLIX</a>
        <div class="nav__links">
            <a href="./index.html" data-nav="home">Home</a>
            <a href="./browse.html?type=movie" data-nav="movie">Movies</a>
            <a href="./browse.html?type=tv" data-nav="tv">Series</a>
            <a href="./browse.html?view=list" data-nav="list">My List</a>
        </div>
        <a href="./search.html" class="nav__search" aria-label="Search"><i class="fas fa-search"></i><span>Search</span><kbd>/</kbd></a>`;
    setActiveNav(active);

    document.getElementById('footer').innerHTML = `
        <span class="logo">CFLIX</span>
        <p>Movie and series data from TMDB.</p>`;

    const onScroll = () => nav.classList.toggle('nav--solid', window.scrollY >= 1);
    window.addEventListener('scroll', onScroll);
    onScroll();
    initPreviews();

    document.addEventListener('keydown', event => {
        const typing = event.target.closest('input, select, textarea');
        if (event.key === '/' && !typing && !document.getElementById('searchInput')) {
            event.preventDefault();
            window.location.href = 'search.html';
        }
    });
}
