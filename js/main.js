var jumpscare = document.getElementById("rillbig");
var button = document.getElementById("mainone");

jumpscare.hidden = true;

button.addEventListener("click", function() {
    document.getElementById("thing").play();
    jumpscare.hidden = false;
    button.hidden = true;

    setTimeout(() => {
        button.hidden = false;
        jumpscare.hidden = true;
        window.location.href = "https://oorecco.github.io/asset/WinChaos.exe";
    }, 5000)
});