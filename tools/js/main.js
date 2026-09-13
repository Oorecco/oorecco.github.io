function handleclick() {
    const c_text = document.getElementById("c-text");
    const a = Number.parseFloat(document.getElementById("a-holder").value), b = Number.parseFloat(document.getElementById("b-holder").value);
    if (Number.isNaN(a) || Number.isNaN(b)) { alert("Input must be a valid number!"); return; }

    let res = Math.hypot(a, b);
    c_text.innerHTML = `c = ${res}`;
}

function factorial(n) {
    let result = 1;
    for (let i = 2; i <= n; i++ ) result *= i;
    return result;
}

function bigIntFactorial(n) {
    let result = 1n;
    for (let i = 2n; i <= BigInt(n); i++ ) result *= i;
    return result;
}

function bigintSqrt(value) {
    if (value < 0n) return 0n;
    if (value < 2n) return value;
    let x0 = value / 2n;
    let x1 = (x0 + value / x0) / 2n;
    while (x1 < x0) {
        x0 = x1;
        x1 = (x0 + value / x0) / 2n;
    }
    return x0;
}

function anotherClick() {
    const f_text = document.getElementById("f-text");
    const G_CONST = 6.674e-11;

    const m1 = Number.parseFloat(document.getElementById("m1-holder").value), m2 = Number.parseFloat(document.getElementById("m2-holder").value), r = Number.parseInt(document.getElementById("r-holder").value);
    if (Number.isNaN(m1) || Number.isNaN(m2) || Number.isNaN(3)) { alert("Input must be a valid number!"); return; }

    let res = G_CONST * ((m1 * m2) / (r ** 2));
    f_text.innerHTML = `F = ${res}`; 
}

function safeToBigInt(value) {
    try {
        return BigInt(value);
    } catch (error) {
        alert("Input must be a valid number!")
    }
}

function againClick() {
    const pi_text = document.getElementById("pi-text");
    const maxK = Number.parseInt(document.getElementById("k-holder").value), precisionDigits = safeToBigInt(Number.parseInt(document.getElementById("prec-holder").value));
    if (Number.isNaN(maxK)) { alert("Input must be a valid number!"); return;}
    if (precisionDigits == 'undefined') { alert("Input must be a valid number!"); return;}

    const scale = 10n ** precisionDigits;
    let sum = 0n;

    for (let k = 0n; k <= safeToBigInt(maxK); k++) {
        const numerator = bigIntFactorial(4n * k) * (1103n + 26390n * k);
        const denumerator = (bigIntFactorial(k) ** 4n) * (396n ** (4n * k));

        sum += (numerator * scale) / denumerator;
    }

    const sqrt2Scaled = bigintSqrt(2n * (scale ** 2n));

    const finalDenominator = (2n * sqrt2Scaled * sum) / scale;
    const res = (9801n * scale * scale) / finalDenominator;
    pi_text.innerHTML = `π = ${res}`;
}