function loadFile(filePath, elementId) {
    fetch(filePath)
        .then(response => response.text())
        .then(data => {
            document.getElementById(elementId).innerHTML = data;
        })
        .catch(error => console.error(error));
}

window.onload = function() {
    loadFile("partials/header.html", "header");
    loadFile("partials/footer.html", "footer");
};
