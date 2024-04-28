const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const searchResults = document.querySelector('.search-results');
const apiKey = 'ce34aa81';

searchBtn.addEventListener('click', searchMovies);

// Search movies when the Enter key is pressed
searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        searchMovies();
    }
});

function searchMovies() {
    const searchTerm = searchInput.value.trim();
    if (searchTerm !== '') {
        const apiUrl = `https://www.omdbapi.com/?apikey=${apiKey}&s=${encodeURIComponent(searchTerm)}`;

        fetch(apiUrl)
            .then(response => {
                if (response.ok) {
                    return response.json();
                } else {
                    throw new Error('Error fetching data from the API');
                }
            })
            .then(data => {
                if (data.Response === 'True') {
                    searchResults.innerHTML = '';
                    displayMovies(data.Search);
                    animateMovieCards();
                } else {
                    searchResults.innerHTML = `<p>No results found for "${searchTerm}"</p>`;
                }
            })
            .catch(error => {
                console.error('Error:', error);
                searchResults.innerHTML = '<p>An error occurred while fetching the data.</p>';
            });
    } else {
        searchResults.innerHTML = '<p>Please enter a search term.</p>';
    }
}

function displayMovies(movies) {
    movies.forEach(movie => {
        const apiUrl = `https://www.omdbapi.com/?apikey=${apiKey}&i=${movie.imdbID}`;

        fetch(apiUrl)
            .then(response => {
                if (response.ok) {
                    return response.json();
                } else {
                    throw new Error('Error fetching movie details from the API');
                }
            })
            .then(data => {
                const movieCard = document.createElement('div');
                movieCard.classList.add('movie-card');
                movieCard.innerHTML = `
                    <img src="${data.Poster}" alt="${data.Title}">
                    <div class="movie-info">
                        <h3>${data.Title}</h3>
                        <p>Year: ${data.Year}</p>
                        <p>Genre: ${data.Genre}</p>
                    </div>
                    <div class="movie-rating">${data.imdbRating}</div>
                `;
                searchResults.appendChild(movieCard);
            })
            .catch(error => {
                console.error('Error:', error);
            });
    });
}

function animateMovieCards() {
    const movieCards = document.querySelectorAll('.movie-card');
    const animation = anime({
        targets: movieCards,
        translateY: [-50, 0],
        opacity: [0, 1],
        delay: anime.stagger(100),
        duration: 500,
        easing: 'easeOutQuad'
    });
}