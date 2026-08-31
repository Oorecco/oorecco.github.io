// CONSTANTS
const VERSION = "v0.01";
const MINERS_COUNT = 2;

// ELEMENTS
const rock_count = document.getElementById("rock-counter")

// OTHER THINGS
const heartbeatWorker = new Worker('js/worker.js');

const Game = {
    currencies: {
        rock: 0
    },

    miners: {
        "miner1": {baseCost: 5, level: 1, rpsadd: 1},
        "miner2": {baseCost: 50, level: 0, rpsadd: 3}
    },

    stats: {
        timePlayed: 0,
        gameSpeed: 1,
        rps: 1
    },

    achievements: {
        "test1": { unlocked: false},
        "test2": { unlocked: false},
        "test3": { unlocked: false}
    },

    achievementsRegistry: [
        {
            id: "test1",
            name: "Test 1",
            desc: "literally just a test",
            auto: true,
            metricPath: ["currencies", "rock"],
            targetValue: 10
        },
        {
            id: "test2",
            name: "Test 2",
            desc: "test 2 ig",
            auto: true,
            customCheck: function() {
                const date = new Date();
                let Hours = date.getHours();
                console.log(Hours >= 20 && Hours <= 23);
                return Hours >= 20 && Hours <= 23;
            }
        },
        {
            id: "test3",
            name: "test 3",
            desc: "Get 50 miner1.",
            auto: true,
            metricPath: ["miners", "miner1", "level"],
            targetValue: 50
        }
    ],

    tickRates: {
        rock: 1000
    },

    timeAccumulators: {
        rock: 0
    },

    lastTick: performance.now(),

    init() {
        heartbeatWorker.postMessage('START_TICK');
        requestAnimationFrame(this.renderUI.bind(this));
    },

    loop(timeStamp) {
        let deltaTime = timeStamp - this.lastTick;
        this.lastTick = timeStamp;

        if (deltaTime >= 1000) {
            deltaTime = 1000;
        }

        console.log(deltaTime);

        const dtCalculated = deltaTime * this.stats.gameSpeed;

        this.timeAccumulators.rock += dtCalculated;
        this.updateGameLogic();
    },

    upgradeMiner(id) {
        const miner = this.miners[id];
        if (!miner) return;

        const cost = miner.baseCost * (miner.level === 0 ? 1 : miner.level);
        if (this.currencies.rock >= cost) {
            this.addMetric(["miners", id, "level"], 1);
            const btn = document.getElementById(id + "-upgrade");
            if (btn) {
                btn.innerHTML = `${miner.baseCost * (miner.level === 0 ? 1 : miner.level)} [${miner.level}]`;
            }
            this.addMetric(["currencies", "rock"], -cost);
            this.addMetric(["stats", "rps"], miner.rpsadd);
        }
    },

    buyAllMiners() {
        for (let i = 0; i < MINERS_COUNT + 1; i++) {
            this.upgradeMiner(`miner${i}`);
        }
    },

    addMetric(arrayPath, amount) {
        let current = this;

        for (let i = 0; i < arrayPath.length - 1; i++) {
            current = current[arrayPath[i]];
        }

        const finalProperty = arrayPath[arrayPath.length - 1];
        current[finalProperty] += amount;

        this.scanAutomatedAchievements();
    },

    scanAutomatedAchievements() {
        this.achievementsRegistry.forEach(ach => {
            if (!ach.auto || this.achievements[ach.id].unlocked) return;

            let passStandardCheck = false;
            let passCustomCheck = true;
            
            if (ach.metricPath && ach.targetValue !== undefined) {
                let currentValue = this;
                for (const property of ach.metricPath) {
                    currentValue = currentValue[property];
                }

                if (currentValue >= ach.targetValue) {
                    passStandardCheck = true;
                }
            } else {
                passStandardCheck = true;  
            }

            if (typeof ach.customCheck === "function") {
                passCustomCheck = ach.customCheck();
            }

            if (passStandardCheck && passCustomCheck) {
                this.unlockAchievement(ach.id);
            }
        })
    },

    save() {
        if (!localStorage.getItem("gameState")) {
            const defaultSave = VERSION + "," + "";
            localStorage.setItem("gameState", defaultSave);
        }
    },

    unlockAchievement(id) {
        const ach = this.achievements[id];
        if (ach.unlocked) return;

        ach.unlocked = true;
        const data = this.achievementsRegistry.find(achData => achData.id === id);
        console.log(`[ACHIEVEMENT]: Unlocked achievement ${data.name} [${data.desc}]`);
    },

    updateGameLogic() {
        while (this.timeAccumulators.rock >= this.tickRates.rock) {
            this.addMetric(["currencies", "rock"], this.stats.rps);
            this.timeAccumulators.rock -= this.tickRates.rock;
        }
    },

    renderUI() {
        rock_count.innerHTML = Math.floor(this.currencies.rock);

        requestAnimationFrame(this.renderUI.bind(this));
    }
};

heartbeatWorker.onmessage = function(event) {
    if (event.data === 'TICK') {
        Game.loop(performance.now());
    }
}

document.addEventListener("DOMContentLoaded", () => {
    Game.init();
})

window.addEventListener("keydown", function(event) {
    if (event.key.toLowerCase() === "b") {
        Game.buyAllMiners();
    }
})
document.addEventListener("contextmenu", function(event) {
    event.preventDefault();
})