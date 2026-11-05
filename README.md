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

- **Hindi First:** Hindi titles lead the home page, the rotating banner and the Movies and Series pages.
- **Home:** Hover previews with trailers, mood rows, Trending Now, and new releases and series.
- **Movies and Series:** Browse every title by mood, genre and language, sorted by popularity, date or rating.
- **Search:** Instant results for movies, series and actors. Add a year to narrow the results, such as `Leo 2023`.
- **Title Pages:** Details, trailers, cast, seasons and episodes, and recommendations.
- **Cast Pages:** Biography and every film and series for an actor.
- **Watch Page:** Plays inside the page with a server switcher and previous and next episode controls.
- **My List and Continue Watching:** Saved in the browser, with no account needed.
- **Responsive Design:** Ensure optimal viewing experience across all devices.

## TMDB API

CFlix uses the TMDB (The Movie Database) API for its catalog, trending lists, search, and movie and series details. TMDB also supplies the IMDb ID that the video player needs.

1. **Obtain an API token:** Register at `https://www.themoviedb.org/documentation/api`.
2. **Integrate the token:** Replace the token in `src/js/common.js` with your own.

## Installation

To run CFlix locally, follow these steps:

1. Clone this repository and open the project directory.
2. Start a static server: `python3 -m http.server 8000`
3. Open `http://localhost:8000` in your preferred web browser.
