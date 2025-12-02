var jumpscare = document.getElementById("rillbig");
var button = document.getElementById("mainone");

jumpscare.hidden = true;

button.addEventListener("click", function() {
    console.log("hello world");
    document.getElementById("thing").play();
    jumpscare.hidden = false;
    button.hidden = true;

    setTimeout(() => {
        button.hidden = false;
        jumpscare.hidden = true;
    }, 5000)
});