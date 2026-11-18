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
- **Movies and Series:** Browse by mood, genre, language, year, rating, length, series status and streaming service in India, sorted by popularity, date, rating, votes or title.
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

## Mac App

The `mac` folder builds CFlix as a native Mac app that works without the website. It runs the site inside the app, stops ad redirects from taking over the window, and blocks ads and trackers with EasyList and EasyPrivacy, which the build downloads fresh each time (turn this off under View → Block Ads if a server stops playing). Extra rules go in `mac/blocklists/custom.txt`. The servers refuse to play when pop-ups are blocked, so their pop-ups open as separate windows you can close with ⌘W.

1. Install Apple's command line tools if needed: `xcode-select --install`
2. Build the app: `./mac/build.sh`
3. Open `mac/build/CFlix.app`, or send `mac/build/CFlix.dmg` to others

The app isn't signed with an Apple Developer ID, so on another Mac it has to be opened the first time by right-clicking it and choosing **Open**.
