/// <reference path="../../../utils/js/break_infinity.d.ts" />

const sawitButton = document.getElementById("main-sawit");
const sawitCounter = document.getElementById("sawit-counter");

const sawitAudio = new Audio("../../assets/sawitron/sawit-click.mp3");
sawitAudio.preload = "auto";

const Game = {
    player: {
        currencies: {
            sawit: new Decimal(0)
        }
    },

    doClick() {
        if (sawitAudio.played) { sawitAudio.pause(); sawitAudio.currentTime = 0; }
        this.player.currencies.sawit = this.player.currencies.sawit.add(1);
        sawitAudio.play();
        sawitCounter.innerHTML = `${this.player.currencies.sawit.toString()}`;
    }
};

sawitButton.addEventListener('click', function(event) {
    Game.doClick();
});