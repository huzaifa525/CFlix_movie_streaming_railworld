const title = new URLSearchParams(window.location.search).get('title');

if (!title) {
    window.location.replace('index.html');
}

document.title = `${title} - CFlix`;
document.getElementById('movieTitle').textContent = title;
initNav();
initSearch();

function showBackdrop(url) {
    document.getElementById('detail').style.backgroundImage = `url("${url}")`;
}

function showPoster(url) {
    if (!document.getElementById('detail').style.backgroundImage) showBackdrop(url);
}

function addMeta(value) {
    if (!value || value === 'N/A') return;
    const item = document.createElement('span');
    item.textContent = value;
    document.getElementById('movieMeta').append(item);
}

function addCredit(label, value) {
    if (!value || value === 'N/A') return;
    const credit = document.createElement('p');
    const name = document.createElement('span');
    name.textContent = `${label}: `;
    credit.append(name, value);
    document.getElementById('movieCredits').append(credit);
}

function initPlayer(imdbID) {
    const player = document.getElementById('player');
    const frame = document.getElementById('playerFrame');
    const play = document.getElementById('playButton');

    play.hidden = false;
    play.addEventListener('click', () => {
        frame.src = `https://www.2embed.cc/embed/${imdbID}`;
        player.showModal();
    });

    document.getElementById('playerClose').addEventListener('click', () => player.close());
    player.addEventListener('click', event => {
        if (event.target === player) player.close();
    });
    player.addEventListener('close', () => frame.removeAttribute('src'));
}

function showNotFound() {
    document.getElementById('moviePlot').textContent = "We couldn't find the details for this title.";
}

fetch(`https://www.omdbapi.com/?apikey=2aaa3017&t=${encodeURIComponent(title)}`)
    .then(response => response.json())
    .then(data => {
        if (data.Response === 'False') {
            showNotFound();
            return;
        }

        if (data.Poster && data.Poster !== 'N/A') showPoster(data.Poster);

        [data.Year, data.Rated, data.Runtime, data.Genre].forEach(addMeta);
        document.getElementById('moviePlot').textContent = data.Plot === 'N/A' ? '' : data.Plot;
        addCredit('Starring', data.Actors);
        addCredit('Director', data.Director);
        addCredit('Language', data.Language);
        initPlayer(data.imdbID);
    })
    .catch(error => {
        console.error('Error fetching data from OMDB:', error);
        showNotFound();
    });

// TMDB has wider artwork than the OMDb poster, so it replaces it when found
tmdb(`search/movie?query=${encodeURIComponent(title)}&include_adult=false&language=en-US&page=1`)
    .then(data => {
        const match = data.results.find(movie => movie.backdrop_path);
        if (match) showBackdrop(`${TMDB_IMAGES}/original${match.backdrop_path}`);
    })
    .catch(err => console.error(err));
