const profileContainer = document.querySelector('.profile-container');
const addProfileIcon = document.querySelector('.add-profile-icon');

// Sample data for profiles
const profiles = [
    {
        name: 'Children',
        image: "https://avatars.mds.yandex.net/i?id=f011db5136b50e4c2693404c72d6217deb8f58bc-9070589-images-thumbs&ref=rim& n=33&w=275&h=275"
    },
    {
        name: 'Saurabh singh',
        image: 'https://m.gjcdn.net/user-avatar/200/7501401-35wvxsti-v4.jpg'
    },
    {
        name: 'Anushka',
        image: 'https://getdrawings.com/free-icon/text-message-icons-for-android-69.png'
    },
];

// Function to create a profile card
function createProfileCard(profile) {
    const card = document.createElement('div');
    card.classList.add('profile-card');

    if (profile.image) {
        const img = document.createElement('img');
        img.src = profile.image;
        card.appendChild(img);
    }

    const name = document.createElement('span');
    name.textContent = profile.name;
    card.appendChild(name);

    const editIcon = document.createElement('i');
    editIcon.classList.add('fas', 'fa-pen', 'edit-icon');
    card.appendChild(editIcon);

    return card;
}

// Render profiles on page load
profiles.forEach(profile => {
    const card = createProfileCard(profile);
    profileContainer.appendChild(card);
});

// Add event listener for "Add Profile" icon
addProfileIcon.addEventListener('click', () => {
    const newProfile = { name: 'New Profile', image: null };
    const card = createProfileCard(newProfile);
    profileContainer.appendChild(card);
});
