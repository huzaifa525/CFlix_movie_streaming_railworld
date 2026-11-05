const id = new URLSearchParams(window.location.search).get('id');
const tabs = document.getElementById('personTabs');
const grid = document.getElementById('personGrid');

let credits = [];

if (!id) {
    window.location.replace('index.html');
}

initLayout('');

function renderCredits(filter) {
    const counts = {
        all: credits.length,
        movie: credits.filter(credit => credit.media_type === 'movie').length,
        tv: credits.filter(credit => credit.media_type === 'tv').length
    };

    tabs.querySelectorAll('[data-filter]').forEach(tab => {
        tab.setAttribute('aria-pressed', String(tab.dataset.filter === filter));
        tab.querySelector('span').textContent = counts[tab.dataset.filter];
    });

    grid.replaceChildren(...credits
        .filter(credit => filter === 'all' || credit.media_type === filter)
        .map(createPosterCard));
}

function collectCredits(cast) {
    const seen = new Set();

    return cast
        .filter(credit => hasArtwork(credit) && !credit.genre_ids.some(genre => GUEST_APPEARANCE_GENRES.includes(genre)))
        .sort((a, b) => b.popularity - a.popularity)
        .filter(credit => {
            const key = `${credit.media_type}-${credit.id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

function formatDate(value) {
    if (!value) return '';
    return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function showPerson(person) {
    document.title = `${person.name} - CFlix`;
    document.getElementById('personName').textContent = person.name;
    document.getElementById('personDetails').textContent = [person.known_for_department, formatDate(person.birthday), person.place_of_birth]
        .filter(Boolean)
        .join(' · ');

    const photo = document.getElementById('personPhoto');
    if (person.profile_path) {
        const image = document.createElement('img');
        image.src = `${TMDB_IMAGES}/w342${person.profile_path}`;
        image.alt = person.name;
        photo.append(image);
    }

    const bio = document.getElementById('personBio');
    const more = document.getElementById('personMore');
    bio.textContent = person.biography;
    more.hidden = person.biography.length < 320;
    more.addEventListener('click', () => {
        const expanded = bio.classList.toggle('person__bio--open');
        more.textContent = expanded ? 'Show less' : 'Read more';
    });

    credits = collectCredits(person.combined_credits.cast);
    if (credits.length === 0) {
        document.getElementById('personStatus').textContent = 'No titles found for this person.';
        return;
    }

    tabs.hidden = false;
    tabs.querySelectorAll('[data-filter]').forEach(tab => {
        tab.addEventListener('click', () => renderCredits(tab.dataset.filter));
    });
    renderCredits('all');
}

tmdb(`person/${encodeURIComponent(id)}?append_to_response=combined_credits&language=en-US`)
    .then(showPerson)
    .catch(err => {
        console.error(err);
        document.getElementById('personName').textContent = 'Person not found';
    });
