const params = new URLSearchParams(window.location.search);
const type = params.get('type') === 'tv' ? 'tv' : 'movie';
const id = params.get('id');

const playButton = document.getElementById('playButton');

let selectedSeason = 0;
let seasonRequest = 0;

if (!id) {
    window.location.replace('index.html');
}

initLayout(type);

function addMeta(value) {
    if (!value) return;
    const item = document.createElement('span');
    item.textContent = value;
    document.getElementById('movieMeta').append(item);
}

function addCredit(label, value) {
    if (!value) return;
    const credit = document.createElement('p');
    const name = document.createElement('span');
    name.textContent = `${label}: `;
    credit.append(name, value);
    document.getElementById('movieCredits').append(credit);
}

function formatRuntime(minutes) {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

function initPlayButton(item) {
    playButton.href = type === 'tv' ? watchUrl(item, selectedSeason, 1) : watchUrl(item);
    playButton.innerHTML = `<i class="fas fa-play"></i> ${type === 'tv' ? `Play S${selectedSeason} E1` : 'Play'}`;
    playButton.hidden = false;
}

function initTrailer(item, videos) {
    const hasTrailer = videos.some(video => video.site === 'YouTube' && ['Trailer', 'Teaser'].includes(video.type));
    if (!hasTrailer) return;

    const button = document.getElementById('trailerButton');
    button.href = `${watchUrl(item)}&trailer=1`;
    button.hidden = false;
}

function createEpisode(item, episode) {
    const row = document.createElement('a');
    row.classList.add('episode');
    row.href = watchUrl(item, selectedSeason, episode.episode_number);

    const still = document.createElement('img');
    if (episode.still_path) still.src = `${TMDB_IMAGES}/w300${episode.still_path}`;
    still.alt = '';
    still.loading = 'lazy';

    const name = document.createElement('strong');
    name.textContent = `${episode.episode_number}. ${episode.name}`;

    const runtime = document.createElement('small');
    runtime.textContent = formatRuntime(episode.runtime);

    const overview = document.createElement('span');
    overview.textContent = episode.overview;

    const text = document.createElement('div');
    text.append(name, runtime, overview);

    row.append(still, text);
    return row;
}

function loadSeason(item, season) {
    const request = ++seasonRequest;
    const list = document.getElementById('episodeList');

    tmdb(`tv/${id}/season/${season}?language=en-US`)
        .then(response => {
            if (request !== seasonRequest) return;
            list.replaceChildren(...response.episodes.map(episode => createEpisode(item, episode)));
        })
        .catch(err => {
            console.error(err);
            list.textContent = "Couldn't load these episodes.";
        });
}

function initSeasons(item) {
    const seasons = item.seasons.filter(season => season.season_number > 0 && season.episode_count > 0);
    if (seasons.length === 0) return;

    selectedSeason = seasons[0].season_number;

    const select = document.getElementById('seasonSelect');
    select.append(...seasons.map(season => new Option(`Season ${season.season_number}`, season.season_number)));
    select.addEventListener('change', () => {
        selectedSeason = Number(select.value);
        initPlayButton(item);
        loadSeason(item, selectedSeason);
    });

    document.getElementById('episodes').hidden = false;
    loadSeason(item, selectedSeason);
    initPlayButton(item);
}

function showCast(cast) {
    const people = cast.slice(0, 15);
    if (people.length === 0) return;

    const row = createRow('Cast');
    document.getElementById('titleRows').prepend(row);
    fillRow(row, people.map(person => createPersonCard(person, person.character)));
}

function showRecommendations(items) {
    const similar = items.filter(hasArtwork);
    if (similar.length === 0) return;

    const row = createRow('More Like This');
    document.getElementById('titleRows').append(row);
    fillRow(row, similar.map(createCard));
}

function showDetails(item) {
    const artwork = item.backdrop_path || item.poster_path;
    const typedItem = { ...item, media_type: type };
    const director = item.credits.crew.find(person => person.job === 'Director');
    const creators = (item.created_by || []).map(person => person.name).join(', ');
    const seasonCount = item.number_of_seasons === 1 ? '1 Season' : `${item.number_of_seasons} Seasons`;

    document.title = `${itemTitle(item)} - CFlix`;
    document.getElementById('movieTitle').textContent = itemTitle(item);
    document.getElementById('moviePlot').textContent = item.overview;
    if (artwork) {
        document.getElementById('detail').style.backgroundImage = `url(${TMDB_IMAGES}/w1280${artwork})`;
    }

    addMeta(itemYear(item));
    addMeta(type === 'tv' ? seasonCount : formatRuntime(item.runtime));
    addMeta(item.genres.map(genre => genre.name).join(', '));
    if (item.vote_count > 0) addMeta(`${item.vote_average.toFixed(1)} / 10`);

    addCredit('Starring', item.credits.cast.slice(0, 3).map(person => person.name).join(', '));
    addCredit(type === 'tv' ? 'Created by' : 'Director', type === 'tv' ? creators : director && director.name);
    addCredit('Language', item.spoken_languages.map(language => language.english_name).join(', '));

    initListButton(document.getElementById('listButton'), typedItem);
    initTrailer(typedItem, item.videos.results);

    if (type === 'tv') {
        initSeasons(typedItem);
    } else {
        initPlayButton(typedItem);
    }

    showCast(item.credits.cast);
    showRecommendations(item.recommendations.results);
}

tmdb(`${type}/${encodeURIComponent(id)}?append_to_response=credits,videos,recommendations&language=en-US`)
    .then(showDetails)
    .catch(err => {
        console.error(err);
        document.getElementById('movieTitle').textContent = 'Title not found';
        document.getElementById('moviePlot').textContent = "We couldn't find the details for this title.";
    });
