const SERVERS = [
    {
        name: 'Vsrc',
        movie: id => `https://vidsrc.buzz/embed/movie/${id}`,
        tv: (id, season, episode) => `https://vidsrc.buzz/embed/tv/${id}/${season}/${episode}`
    },
    {
        name: 'Videm',
        movie: id => `https://videm.buzz/embed/movie/${id}`,
        tv: (id, season, episode) => `https://videm.buzz/embed/tv/${id}/${season}/${episode}`
    },
    {
        name: 'Vcr',
        movie: id => `https://streamsrcs.2embed.cc/vcr?tmdb=${id}`,
        tv: (id, season, episode) => `https://streamsrcs.2embed.cc/vcr-tv?tmdb=${id}&s=${season}&e=${episode}`
    },
    {
        // Last on purpose: it adds its own server menu and ad link inside the video
        name: '2embed',
        needsImdb: true,
        movie: (id, imdbID) => `https://www.2embed.cc/embed/${imdbID}`,
        tv: (id, season, episode, imdbID) => `https://www.2embed.cc/embedtv/${imdbID}&s=${season}&e=${episode}`
    }
];

const params = new URLSearchParams(window.location.search);
const type = params.get('type') === 'tv' ? 'tv' : 'movie';
const id = params.get('id');
const showTrailer = params.get('trailer') === '1';

const frame = document.getElementById('watchFrame');
const subtitle = document.getElementById('watchSubtitle');
const seasonSelect = document.getElementById('seasonSelect');
const layout = document.getElementById('watchLayout');
const loading = document.getElementById('watchLoading');
const theaterButton = document.getElementById('theaterButton');

let item;
let imdbID;
let seasons = [];
let currentSeason = Number(params.get('season')) || 0;
let currentEpisode = Number(params.get('episode')) || 1;
let serverIndex = readStore('cflixServer')[0] || 0;
let seasonRequest = 0;

if (!SERVERS[serverIndex]) {
    serverIndex = 0;
}

if (!id) {
    window.location.replace('index.html');
}

initLayout(type);

function serverUrl() {
    const server = SERVERS[serverIndex];
    return type === 'tv' ? server.tv(id, currentSeason, currentEpisode, imdbID) : server.movie(id, imdbID);
}

function isAvailable(server) {
    return !server.needsImdb || Boolean(imdbID);
}

function loadFrame(url, label) {
    document.getElementById('watchLoadingText').textContent = `Loading ${label}...`;
    loading.hidden = false;
    frame.src = url;
}

function playCurrent() {
    loadFrame(serverUrl(), SERVERS[serverIndex].name);
    addToContinueWatching(item, type === 'tv' ? currentSeason : undefined, type === 'tv' ? currentEpisode : undefined);

    if (type === 'tv') {
        subtitle.textContent = `Season ${currentSeason}, Episode ${currentEpisode}`;
        history.replaceState(null, '', watchUrl(item, currentSeason, currentEpisode));
        updateSteps();
        markCurrentEpisode();
    }
}

function renderServers() {
    const list = document.getElementById('serverList');

    if (!isAvailable(SERVERS[serverIndex])) serverIndex = 0;

    list.replaceChildren(...SERVERS.flatMap((server, index) => {
        if (!isAvailable(server)) return [];

        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = server.name;
        button.setAttribute('aria-pressed', String(index === serverIndex));
        button.addEventListener('click', () => {
            serverIndex = index;
            writeStore('cflixServer', [index]);
            renderServers();
            playCurrent();
        });
        return [button];
    }));

    document.getElementById('watchServers').hidden = false;
}

function seasonInfo(number) {
    return seasons.find(season => season.season_number === number);
}

function adjacentEpisode(step) {
    const position = seasons.indexOf(seasonInfo(currentSeason));
    const target = currentEpisode + step;

    if (target >= 1 && target <= seasons[position].episode_count) {
        return [currentSeason, target];
    }

    const neighbour = seasons[position + step];
    if (!neighbour) return null;
    return [neighbour.season_number, step > 0 ? 1 : neighbour.episode_count];
}

function updateSteps() {
    ['previousEpisode', 'nextEpisode'].forEach((button, index) => {
        const control = document.getElementById(button);
        control.hidden = false;
        control.disabled = !adjacentEpisode(index === 0 ? -1 : 1);
    });
}

function goToEpisode(season, episode) {
    const changedSeason = season !== currentSeason;
    currentSeason = season;
    currentEpisode = episode;
    playCurrent();

    if (changedSeason) {
        seasonSelect.value = season;
        loadSeason(season);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function markCurrentEpisode() {
    document.querySelectorAll('#episodeList .episode').forEach(row => {
        const current = Number(row.dataset.episode) === currentEpisode;
        row.classList.toggle('episode--current', current);
        if (current) {
            row.setAttribute('aria-current', 'true');
        } else {
            row.removeAttribute('aria-current');
        }
    });
}

function createEpisodeRow(season, episode) {
    const row = document.createElement('button');
    row.classList.add('episode');
    row.type = 'button';
    row.dataset.episode = episode.episode_number;
    row.addEventListener('click', () => goToEpisode(season, episode.episode_number));

    const still = document.createElement('img');
    if (episode.still_path) still.src = `${TMDB_IMAGES}/w300${episode.still_path}`;
    still.alt = '';
    still.loading = 'lazy';

    const name = document.createElement('strong');
    name.textContent = `${episode.episode_number}. ${episode.name}`;

    const overview = document.createElement('span');
    overview.textContent = episode.overview;

    const text = document.createElement('div');
    text.append(name, overview);

    row.append(still, text);
    return row;
}

function loadSeason(season) {
    const request = ++seasonRequest;
    const list = document.getElementById('episodeList');

    tmdb(`tv/${id}/season/${season}?language=en-US`)
        .then(response => {
            if (request !== seasonRequest) return;
            list.replaceChildren(...response.episodes.map(episode => createEpisodeRow(season, episode)));
            markCurrentEpisode();
        })
        .catch(err => {
            console.error(err);
            list.textContent = "Couldn't load these episodes.";
        });
}

function initSeries() {
    seasons = item.seasons.filter(season => season.season_number > 0 && season.episode_count > 0);

    if (seasons.length === 0) {
        subtitle.textContent = 'No episodes are available yet.';
        return false;
    }

    const season = seasonInfo(currentSeason);
    if (!season || currentEpisode > season.episode_count) {
        currentSeason = seasons[0].season_number;
        currentEpisode = 1;
    }

    seasonSelect.append(...seasons.map(entry => new Option(`Season ${entry.season_number}`, entry.season_number)));
    seasonSelect.value = currentSeason;
    seasonSelect.addEventListener('change', () => goToEpisode(Number(seasonSelect.value), 1));

    document.getElementById('previousEpisode').addEventListener('click', () => goToEpisode(...adjacentEpisode(-1)));
    document.getElementById('nextEpisode').addEventListener('click', () => goToEpisode(...adjacentEpisode(1)));

    document.getElementById('episodes').hidden = false;
    showSide();
    loadSeason(currentSeason);
    return true;
}

function playTrailer(videos) {
    const youtube = videos.filter(video => video.site === 'YouTube');
    const trailer = youtube.find(video => video.type === 'Trailer') || youtube.find(video => video.type === 'Teaser');

    subtitle.textContent = 'Trailer';
    if (trailer) {
        loadFrame(`https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1`, 'trailer');
    } else {
        subtitle.textContent = "This title doesn't have a trailer.";
    }
}

function setTheater(enabled) {
    layout.classList.toggle('watch__layout--theater', enabled);
    theaterButton.setAttribute('aria-pressed', String(enabled));
    theaterButton.innerHTML = `<i class="fas fa-${enabled ? 'compress' : 'expand'}"></i> ${enabled ? 'Default View' : 'Theater'}`;
    writeStore('cflixTheater', [enabled]);
}

function showSide() {
    document.getElementById('watchSide').hidden = false;
    layout.classList.add('watch__layout--side');
    theaterButton.hidden = false;
    theaterButton.addEventListener('click', () => setTheater(!layout.classList.contains('watch__layout--theater')));
    setTheater(readStore('cflixTheater')[0] === true);
}

function createRecommendation(recommendation) {
    const row = document.createElement('a');
    row.classList.add('episode');
    row.href = titleUrl(recommendation);

    const image = document.createElement('img');
    image.src = `${TMDB_IMAGES}/w300${recommendation.backdrop_path || recommendation.poster_path}`;
    image.alt = '';
    image.loading = 'lazy';

    const name = document.createElement('strong');
    name.textContent = itemTitle(recommendation);

    const details = document.createElement('small');
    details.textContent = itemYear(recommendation);

    const overview = document.createElement('span');
    overview.textContent = recommendation.overview;

    const text = document.createElement('div');
    text.append(name, details, overview);

    row.append(image, text);
    return row;
}

function initRecommendations(recommendations) {
    const items = recommendations.filter(hasArtwork).slice(0, 12);
    if (items.length === 0) return;

    document.getElementById('moreLikeThisList').replaceChildren(...items.map(createRecommendation));
    document.getElementById('moreLikeThis').hidden = false;
    showSide();
}

function showDetails(details) {
    item = { ...details, media_type: type };
    imdbID = type === 'tv' ? details.external_ids.imdb_id : details.imdb_id;

    document.title = `${itemTitle(item)} - CFlix`;
    document.getElementById('watchTitle').textContent = itemTitle(item);
    document.getElementById('watchBack').href = titleUrl(item);
    subtitle.textContent = itemYear(item);

    if (showTrailer) {
        playTrailer(item.videos.results);
        return;
    }

    if (type === 'tv' && !initSeries()) return;
    if (type === 'movie') initRecommendations(item.recommendations.results);

    renderServers();
    playCurrent();
}

frame.addEventListener('load', () => {
    loading.hidden = true;
});

tmdb(`${type}/${encodeURIComponent(id)}?append_to_response=videos,external_ids,recommendations&language=en-US`)
    .then(showDetails)
    .catch(err => {
        console.error(err);
        document.getElementById('watchTitle').textContent = 'Title not found';
        subtitle.textContent = "We couldn't find this title.";
    });
