    // Search box functionality
    const searchBox = document.querySelector('.search-box input');
    const searchButton = document.querySelector('.search-box button');

    searchButton.addEventListener('click', () => {
      const searchQuery = searchBox.value.trim();
      if (searchQuery !== '') {
        // Perform search logic here
        console.log(`Searching for: ${searchQuery}`);
      }
    });

    // User profile dropdown
    const userProfile = document.querySelector('.user-profile');
    const dropdownMenu = document.createElement('div');
    dropdownMenu.classList.add('dropdown-menu');

    const profileLink = document.createElement('a');
    profileLink.href = '#';
    profileLink.textContent = 'Profile';

    const logoutLink = document.createElement('a');
    logoutLink.href = '#';
    logoutLink.textContent = 'Logout';

    dropdownMenu.appendChild(profileLink);
    dropdownMenu.appendChild(logoutLink);

    userProfile.addEventListener('click', () => {
      dropdownMenu.classList.toggle('show');
    });

    document.addEventListener('click', (event) => {
      if (!event.target.closest('.user-profile')) {
        dropdownMenu.classList.remove('show');
      }
    });

    // Animate footer links on hover
    const footerLinks = document.querySelectorAll('.footer-section a');

    footerLinks.forEach((link) => {
      link.addEventListener('mouseenter', () => {
        link.classList.add('animate__animated', 'animate__pulse');
      });

      link.addEventListener('animationend', () => {
        link.classList.remove('animate__animated', 'animate__pulse');
      });
    });