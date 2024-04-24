// Animation effects
const errorCode = document.querySelector('.error-code');
const errorMessage = document.querySelector('.error-message');
const errorButtons = document.querySelector('.error-buttons');

const fadeInAnimation = anime({
    targets: [errorMessage, errorButtons],
    opacity: [0, 1],
    delay: anime.stagger(300),
    duration: 1000,
    easing: 'easeOutExpo',
    autoplay: false
});

const bounceInAnimation = anime({
    targets: errorCode,
    scale: [0.5, 1],
    duration: 1000,
    easing: 'easeOutElastic(1, .6)',
    autoplay: false
});

function playAnimations() {
    bounceInAnimation.restart();
    fadeInAnimation.restart();
}

window.addEventListener('load', playAnimations);
