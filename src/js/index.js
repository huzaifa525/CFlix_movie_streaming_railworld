function playIntro() {
    if (sessionStorage.getItem('introPlayed')) return;
    sessionStorage.setItem('introPlayed', 'true');

    const intro = document.createElement('div');
    intro.classList.add('intro');
    intro.innerHTML = '<span class="logo">CFLIX</span>';
    intro.addEventListener('animationend', event => {
        if (event.target === intro) intro.remove();
    });
    document.body.append(intro);
}

function createRankedCard(movie, index) {
    const card = document.createElement('a');
    card.classList.add('ranked');
    card.href = movieUrl(movie.title);
    card.setAttribute('aria-label', `${index + 1}. ${movie.title}`);

    const rank = document.createElement('span');
    rank.classList.add('ranked__number');
    rank.textContent = index + 1;

    const poster = document.createElement('img');
    poster.src = `${TMDB_IMAGES}/w342${movie.poster_path}`;
    poster.alt = '';
    poster.loading = 'lazy';

    card.append(rank, poster);
    return card;
}

function showBanner(movie) {
    document.getElementById('banner').style.backgroundImage = `url(${TMDB_IMAGES}/original${movie.backdrop_path})`;
    document.getElementById('bannerTitle').textContent = movie.title;
    document.getElementById('bannerDescription').textContent = movie.overview;

    const play = document.getElementById('bannerPlay');
    play.href = movieUrl(movie.title);
    play.hidden = false;
}

playIntro();
initNav();
initSearch();

tmdb('trending/movie/week?language=en-US')
    .then(response => {
        const movies = response.results.filter(movie => movie.poster_path);
        fillRow(document.getElementById('trending'), movies.slice(0, 10).map(createRankedCard));
    })
    .catch(err => {
        console.error(err);
        document.getElementById('trending').hidden = true;
    });

document.querySelectorAll('[data-list]').forEach((row, index) => {
    tmdb(`list/${row.dataset.list}?language=en-US&page=1`)
        .then(response => {
            const movies = response.items.filter(movie => movie.poster_path || movie.backdrop_path);
            fillRow(row, movies.map(createCard));

            if (index === 0) {
                showBanner(movies.find(movie => movie.backdrop_path));
            }
        })
        .catch(err => console.error(err));
});
