function handleclick() {
    const c_text = document.getElementById("c-text");
    const a = Number.parseFloat(document.getElementById("a-holder").value), b = Number.parseFloat(document.getElementById("b-holder").value);
    if (a === NaN || b === NaN) { alert("Input must be a number!"); return; }

    let res = Math.hypot(a, b);
    if (res === NaN) { alert("Input must be a number!"); return; }
    c_text.innerHTML = `c = ${res}`;
}

function anotherClick() {
    const f_text = document.getElementById("f-text");
    const G_CONST = 6.674e-11;

    const m1 = Number.parseFloat(document.getElementById("m1-holder").value), m2 = Number.parseFloat(document.getElementById("m2-holder").value), r = Number.parseInt(document.getElementById("r-holder").value);
    if (m1 === NaN || m2 === NaN || r === NaN) { alert("Input must be a number!"); return; }

    let res = G_CONST * ((m1 * m2) / (r ** 2));
    if (res === NaN) { alert("Input must be a number!"); return; }
    f_text.innerHTML = `F = ${res}`; 
}

function againClick() {
    const pi_text = document.getElementById("pi-text");
    
}