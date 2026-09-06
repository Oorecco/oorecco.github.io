// CONSTANTS
const VERSION = "v0.01";
const MINERS_COUNT = 5;

// ELEMENTS
const rock_count = document.getElementById("rock-counter")

// OTHER THINGS
const heartbeatWorker = new Worker('js/worker.js');

const Game = {
    currencies: {
        dust: 0,
        rock: 0
    },

    miners: {
        "miner1": {baseCost: 5, level: 1, rpsadd: 0.15, sps: 1},
        "miner2": {baseCost: 50, level: 0, rpsadd: 0.3, sps: 0.5},
        "miner3": {baseCost: 500, level: 0, rpsadd: 0.9, sps: 0.3},
        "miner4": {baseCost: 5000, level: 0, rpsadd: 3, sps: 0.2},
        "miner5": {baseCost: 50000, level: 0, rpsadd: 15, sps: 0.1}
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

    // UNUSED
    // tickRates: {
    //
    // },

    timeAccumulators: {
        timePlayed: 0,
        miner1: 1000,
        miner2: 0,
        miner3: 0,
        miner4: 0,
        miner5: 0
    },

    lastTick: performance.now(),

    init() {
        this.initData();
        this.cachedBars = document.querySelectorAll('.progress-fill');
        heartbeatWorker.postMessage('START_TICK');
        requestAnimationFrame(this.renderUI.bind(this));
    },

    initData() {
        let time = Math.floor(new Date().getTime() / 1000);
        const defaultSave = VERSION + "," + time + ";" + "0,0|1,0,0,0|00000";
        console.log(defaultSave);
        let data = localStorage.getItem("gameState")
        if (!data) {
            console.warn("not have data");
        }
    },

    loop(timeStamp) {
        let deltaTime = timeStamp - this.lastTick;
        this.lastTick = timeStamp;

        if (deltaTime >= 1000) {
            deltaTime = 1000;
        }

        const dtCalculated = deltaTime * this.stats.gameSpeed;

        Object.keys(this.timeAccumulators).forEach(timeAccumulator => {
            if (timeAccumulator.startsWith("miner")) {
                const miner = this.miners[timeAccumulator];
                if (miner.level < 1) { return; }
                this.timeAccumulators[timeAccumulator] += dtCalculated * miner.sps;
                return;
            }

            this.timeAccumulators[timeAccumulator] += dtCalculated;
        })
        this.updateGameLogic();
    },

    upgradeMiner(id) {
        const miner = this.miners[id];
        if (!miner) return;

        const cost = miner.baseCost * (miner.level === 0 ? 1 : miner.level);
        if (this.currencies.rock >= cost) {
            this.addMetric(["miners", id, "level"], 1);
            this.addMetric(["miners", id, "sps"], 0.1);
            const btn = document.getElementById(id + "-upgrade");
            if (btn) {
                btn.innerHTML = `${miner.baseCost * (miner.level === 0 ? 1 : miner.level)} [${miner.level}, ${miner.sps.toFixed(1)} sps]`;
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
        for (const timeAccumulator in this.timeAccumulators) {
            if (!Object.hasOwn(this.timeAccumulators, timeAccumulator)) continue;
            let timeAcc = this.timeAccumulators[timeAccumulator];
            if (timeAcc < 1000) continue;

            if (timeAccumulator.startsWith("miner")) {
                const miner = this.miners[timeAccumulator]
                if (!miner || miner.level < 1) return; 

                    console.log("addd?");
                    this.addMetric(["currencies", "rock"], 1 * this.stats.rps);

                    this.timeAccumulators[timeAccumulator] = 0;
                    continue;
            }

            switch (timeAccumulator) {
                case "timePlayed":
                    this.addMetric(["stats", "timePlayed"], 1);
                    break;
            }

            this.timeAccumulators[timeAccumulator] = 0;
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