// Sample data for watchlist items
const watchlistData = [
    {
        title: 'Stranger Things',
        description: 'When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl.',
        image: 'https://via.placeholder.com/300x450'
    },
    {
        title: 'Black Mirror',
        description: 'An anthology series exploring a twisted, high-tech world where humanity\'s greatest innovations and darkest instincts collide.',
        image: 'https://via.placeholder.com/300x450'
    },
    {
        title: 'The Witcher',
        description: 'Geralt of Rivia, a mutated monster-hunter for hire, journeys toward his destiny in a turbulent world where people often prove more wicked than beasts.',
        image: 'https://via.placeholder.com/300x450'
    },
    {
        title: 'Money Heist',
        description: 'An unusual group of robbers attempts to carry out the most perfect robbery in Spanish history - stealing 2.4 billion euros from the Royal Mint of Spain.',
        image: 'https://via.placeholder.com/300x450'
    },
    {
        title: 'Narcos',
        description: 'A gritty chronicle of the war against Colombia\'s infamously violent and powerful drug cartels.',
        image: 'https://via.placeholder.com/300x450'
    },
    {
        title: 'Squid Game',
        description: 'Hundreds of cash-strapped players accept a strange invitation to compete in children\'s games. Inside, a tempting prize awaits -- with deadly high stakes.',
        image: 'https://via.placeholder.com/300x450'
    },
    {
        title: 'Peaky Blinders',
        description: 'A gangster family epic set in 1919 Birmingham, England and centered on a gang who sew razor blades in the peaks of their caps, and their fierce boss Tommy Shelby.',
        image: 'https://via.placeholder.com/300x450'
    },
    {
        title: 'Dark',
        description: 'A family saga with a supernatural twist, set in a German town, where the disappearance of two young children exposes the double lives and fractured relationships among four families.',
        image: 'https://via.placeholder.com/300x450'
    }
];

const watchlistGrid = document.querySelector('.watchlist-grid');

// Function to create a watchlist item element
function createWatchlistItem(item) {
    const watchlistItem = document.createElement('div');
    watchlistItem.classList.add('watchlist-item');

    const itemImage = document.createElement('img');
    itemImage.src = item.image;
    itemImage.alt = item.title;
    watchlistItem.appendChild(itemImage);

    const overlay = document.createElement('div');
    overlay.classList.add('overlay');

    const title = document.createElement('h3');
    title.textContent = item.title;
    overlay.appendChild(title);

    const description = document.createElement('p');
    description.textContent = item.description;
    overlay.appendChild(description);

    const watchButton = document.createElement('a');
    watchButton.classList.add('btn');
    watchButton.textContent = 'Watch Now';
    watchButton.href = '#';
    overlay.appendChild(watchButton);

    watchlistItem.appendChild(overlay);

    return watchlistItem;
}

// Add watchlist items to the grid
watchlistData.forEach(item => {
    const watchlistItem = createWatchlistItem(item);
    watchlistGrid.appendChild(watchlistItem);
});
