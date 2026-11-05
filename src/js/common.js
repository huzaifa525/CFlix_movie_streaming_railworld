const TMDB_OPTIONS = {
    method: 'GET',
    headers: {
        accept: 'application/json',
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI1YTEwZGZlNDFiYWZiNWNhNTYwYThkMDExMzRiY2Q1YSIsInN1YiI6IjY1ODFhYTg5MjI2YzU2MDgxOTllZjNiMiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.OauOdAuGYhz1Hq2yAzex1yI1qsNErO_yyM6AEavU_Xo'
    }
};
const TMDB_IMAGES = 'https://image.tmdb.org/t/p';

function tmdb(path) {
    return fetch(`https://api.themoviedb.org/3/${path}`, TMDB_OPTIONS).then(response => {
        if (!response.ok) throw new Error(`TMDB request failed: ${response.status}`);
        return response.json();
    });
}

function movieUrl(title) {
    // OMDb lists this film under a different spelling than TMDB
    const omdbTitle = title === 'Jigarthanda DoubleX' ? 'Jigarthanda Double X' : title;
    return `movie.html?title=${encodeURIComponent(omdbTitle)}`;
}

function createCard(movie) {
    const card = document.createElement('a');
    card.classList.add('card');
    card.href = movieUrl(movie.title);

    const image = document.createElement('img');
    image.src = `${TMDB_IMAGES}/w500${movie.backdrop_path || movie.poster_path}`;
    image.alt = '';
    image.loading = 'lazy';

    const title = document.createElement('span');
    title.classList.add('card__title');
    title.textContent = movie.title;

    card.append(image, title);
    return card;
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

function initNav() {
    const nav = document.getElementById('nav');
    const onScroll = () => nav.classList.toggle('nav--solid', window.scrollY >= 1);
    window.addEventListener('scroll', onScroll);
    onScroll();
}

function initSearch() {
    const form = document.getElementById('searchForm');
    const input = document.getElementById('searchInput');
    const results = document.getElementById('searchResults');
    const message = results.querySelector('.row__message');

    const showResults = movies => {
        const found = movies.filter(movie => movie.poster_path || movie.backdrop_path);
        message.hidden = found.length > 0;
        fillRow(results, found.map(createCard));
        results.hidden = false;
        results.updateArrows();
        results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    form.addEventListener('submit', event => {
        event.preventDefault();
        const query = input.value.trim();

        if (query.length === 0) {
            results.hidden = true;
            return;
        }

        tmdb(`search/movie?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`)
            .then(data => showResults(data.results))
            .catch(err => console.error(err));
    });
}
