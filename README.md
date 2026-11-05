# CFlix - A Movie Streaming Website

## Project Overview

### Team Leader
- **Huzefa Nalkheda wala**

### Team Members
- **Daksh Thakur**
- 
## Project Description

Welcome to CFlix, a dynamic movie streaming website. CFlix is a frontend platform built using HTML, CSS, and JavaScript, aiming to provide users with an immersive movie-watching experience reminiscent of popular streaming services. Our team's focus was to create an intuitive interface with seamless navigation, ensuring users can easily discover and enjoy their favorite movies.

## Features

- **Extensive Movie Library:** Access a vast collection of movies spanning various genres.
- **Trending Carousel:** The home page shows this week's top 10 movies from TMDB.
- **Efficient Search:** Implement a robust search feature to quickly find desired titles.
- **Preview Trailers:** Allow users to watch trailers and previews directly on the platform.
- **Responsive Design:** Ensure optimal viewing experience across all devices.

## TMDB and OMDB APIs

CFlix utilizes TMDB (The Movie Database) and OMDB (Open Movie Database) APIs to dynamically fetch movie details and enrich the user experience. TMDB provides comprehensive movie information such as titles, genres, ratings, and more, while OMDB supplements this with additional metadata and details about individual movies.

### How to Use TMDB and OMDB APIs

1. **Obtain API Keys:** Register for API keys from TMDB `(https://www.themoviedb.org/documentation/api)` and OMDB `(http://www.omdbapi.com/apikey.aspx)` websites.
2. **Integrate API Keys:** Replace the API keys in `src/js/common.js` (TMDB) and `src/js/movie.js` (OMDB) with your own keys.
3. **Fetch Movie Data:** CFlix dynamically fetches movie details from TMDB and OMDB APIs using AJAX requests. For instance, when a user explores the movie library, the JavaScript code sends requests to TMDB to fetch trending movies, displaying them on the interface. Similarly, when users search for specific movies, the search query is sent to TMDB, and the OMDB API supplies the details shown on the movie page.

## Installation

To run CFlix locally, follow these steps:

1. Clone this repository and open the project directory.
2. Start a static server: `python3 -m http.server 8000`
3. Open `http://localhost:8000` in your preferred web browser.
