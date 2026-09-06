function click() {
    const c_text = document.getElementById("c-text");
    const a = Number.parseInt(document.getElementById("a-holder").value), b = Number.parseInt(document.getElementById("b-holder").value);
    if (a === NaN || b === NaN) { alert("Input must be number!"); return; }
    let res = Math.sqrt((a ** 2) + (b ** 2));
    console.log(res);
    c_text.innerHTML = `c = ${res}`;
}

document.getElementById("execBtn").addEventListener("onclick", () => {
    click();
})