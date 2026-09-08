// CONSTANTS
const VERSION = "v0.01";
const AUTOSAVE_TIME = (30 * 1000);
const MINERS_COUNT = 5;

let saveDebounce = false;

// ELEMENTS
const rock_count = document.getElementById("rock-counter")
const bulk_count = document.getElementById("bulk-counter");

// OTHER THINGS
const heartbeatWorker = new Worker('js/worker.js');

const Game = {
    currencies: {
        dust: 0,
        rock: 0
    },

    miners: {
        "miner1": {baseCost: 10, level: 1, rpsadd: 0.12, sps: 1, spsadd: 0.1},
        "miner2": {baseCost: 150, level: 0, rpsadd: 0.35, sps: 0.5, spsadd: 0.08},
        "miner3": {baseCost: 5000, level: 0, rpsadd: 1, sps: 0.25, spsadd: 0.06},
        "miner4": {baseCost: 20000, level: 0, rpsadd: 3.2, sps: 0.1, spsadd: 0.04},
        "miner5": {baseCost: 100000, level: 0, rpsadd: 20, sps: 0.05, spsadd: 0.02}
    },

    cachedMiner: {
        "miner1": {baseCost: 10, level: 1, rpsadd: 0.12, sps: 1, spsadd: 0.1},
        "miner2": {baseCost: 150, level: 0, rpsadd: 0.35, sps: 0.5, spsadd: 0.08},
        "miner3": {baseCost: 5000, level: 0, rpsadd: 1, sps: 0.25, spsadd: 0.06},
        "miner4": {baseCost: 20000, level: 0, rpsadd: 3.2, sps: 0.1, spsadd: 0.04},
        "miner5": {baseCost: 100000, level: 0, rpsadd: 20, sps: 0.05, spsadd: 0.02}
    },

    stats: {
        timePlayed: 0,
        gameSpeed: 1,
        rps: 1
    },

    achievements: {
        "test1": { unlocked: false},
        "test2": { unlocked: false},
        "test3": { unlocked: false},
        "test4": { unlocked: false},
        "test5": { unlocked: false}
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
        },
        {
            id: "test4",
            name: "test 4",
            desc: "Get 999,999,999 rocks",
            auto: true,
            metricPath: ["currencies", "rock"],
            targetValue: 999999999
        },
        {
            id: "test5",
            name: "literally p2w",
            desc: "Get 123,456 dust",
            auto: true,
            metricPath: ["currencies", "dust"],
            targetValue: 123456
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
        miner5: 0,
        autoSave: 0
    },

    bulkCount: 1,

    lastTick: performance.now(),

    init() {
        console.log(this.cachedMiner);
        this.initData();
        heartbeatWorker.postMessage('START_TICK');
        requestAnimationFrame(this.renderUI.bind(this));
    },

    initData() {
        let data = localStorage.getItem("gameState")

        if (!data) {
            const defaultSave = VERSION + "," + getTime() + ";" + "0,0|0,1,1|1,0,0,0,0|00000";
            localStorage.setItem("gameState", defaultSave);
            console.log("created new storage data!");
        } else {
            console.log(`data: ${data}`);
            const segments = data.split("");
            let newData = [""];
            
            let step = 0;
            for (let i = 0; i < segments.length; i++) {
                let whatever = segments[i].indexOf(";");
                if (whatever != -1) {
                    newData[step] += segments[i].slice(0, whatever);
                    step += 1;
                    if (newData[step] === undefined) {
                        newData[step] = "";
                    }
                    newData[step] += segments[i].slice(whatever + 1);
                } else {
                    newData[step] += segments[i]
                }
            }

            const metaData = newData[0].split(",")

            const shouldUpgrade = metaData[0] != VERSION;

            if (shouldUpgrade) {
                Game.save();
                Game.initData();
                return;
            }
            const coreGameStats = newData[1].split("|");

            const currencies = coreGameStats[0].split(",");
            const stats = coreGameStats[1].split(",");
            const miners = coreGameStats[2].split(",");
            console.log(coreGameStats);
            const achievements = coreGameStats[3].split("");

            this.currencies.rock = Number.parseInt(currencies[1], 10) || 0;
            this.currencies.dust = Number.parseInt(currencies[0], 10) || 0;

            const statsDataList = Object.keys(this.stats || {});

            for (let i = 0; i < stats.length; i++) {
                this.stats[statsDataList[i]] = Number.parseInt(stats[i], 10) || 0;
            }

            for (let i = 1; i < MINERS_COUNT + 1; i++) {
                const miner = this.miners[`miner${i}`];
                miner.level = Number.parseInt(miners[i - 1], 10) || 0;
                if (miner.sps < miner.spsadd * miner.level) {
                    miner.sps = miner.level * miner.spsadd
                };
            }

            for (let i = 0; i < this.achievementsRegistry.length; i++) {
                this.achievements[`test${i + 1}`].unlocked = achievements[i] === "1" ? true : false;
            }

            const dt = getTime() - Number.parseInt(metaData[1], 10) || 0;
        }
    },

    loop(timeStamp) {
        let deltaTime = timeStamp - this.lastTick;
        this.lastTick = timeStamp;

        if (deltaTime >= 1000) {
            deltaTime = 1000;
        }

        const dtCalculated = deltaTime * this.stats.gameSpeed;

        for (const timeAccumulator in this.timeAccumulators) {
            if (!Object.hasOwn(this.timeAccumulators, timeAccumulator)) continue;
            let timeAcc = this.timeAccumulators[timeAccumulator];

            if (timeAccumulator.startsWith("miner")) {
                const miner = this.miners[timeAccumulator];
                if (!miner || miner.level < 1) { continue; }
                this.timeAccumulators[timeAccumulator] += dtCalculated * miner.sps;
                continue;
            }

            if (timeAccumulator === "autoSave") {
                this.timeAccumulators[timeAccumulator] += deltaTime;
            } else {
                this.timeAccumulators[timeAccumulator] += dtCalculated;
            }
        }
        this.updateGameLogic();
    },

    changeBulk() {
        switch (this.bulkCount) {
            case 1:
                this.bulkCount = 5;
                break;
            case 5:
                this.bulkCount = 10;
                break;
            case 10:
                this.bulkCount = 25;
                break;
            case 25:
                this.bulkCount = 50;
                break;
            case 50:
                this.bulkCount = 100;
                break;
            case 100:
                this.bulkCount = Infinity;
                break;
            case Infinity:
                this.bulkCount = 1;
                break;
        }
    },

    upgradeMiner(id, count) {
        const miner = this.miners[id];
        if (!miner) return;
        let tempLevel = miner.level;
        let cost = 0;
        let tempCost = 0;
        let addLevel = 0;

        for (let i = 0; i < count; i++) {
            tempCost = miner.baseCost * (tempLevel === 0 ? 1 : tempLevel ** 1.1);
            if (this.currencies.rock <= cost + tempCost) { break; }
            cost += tempCost;
            tempLevel++;
            addLevel++;
        }

        if (this.currencies.rock >= cost) {
            this.addMetric(["miners", id, "level"], addLevel);
            this.addMetric(["miners", id, "sps"], miner.spsadd * addLevel);
            this.addMetric(["currencies", "rock"], -cost);
            this.addMetric(["stats", "rps"], miner.rpsadd * addLevel);
        }
    },

    buyAllMiners() {
        for (let i = 0; i < MINERS_COUNT + 1; i++) {
            this.upgradeMiner(`miner${i}`, this.bulkCount);
        }
    },

    resetSave() {
        localStorage.clear();
        this.initData();
        this.initData();
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
        let data = localStorage.getItem("gameState")

        if (!data) {
            const defaultSave = VERSION + "," + getTime() + ";" + "0,0|0,1,1|1,0,0,0,0|00000";
            localStorage.setItem("gameState", defaultSave);
            console.log("created new storage data!");
        } else {
            console.log("saving...");
            let saveData = VERSION + "," + getTime() + ";";

            const currenciesDataList = Object.values(this.currencies || {});
            const statsDataList = Object.values(this.stats || {});
            const minerDataList = Object.values(this.miners || {});
            const achievementDataList = Object.values(this.achievements || {}); 
            
            for (let i = 0; i < currenciesDataList.length; i++) {
                saveData += currenciesDataList[i].toFixed(0);
                saveData += i != currenciesDataList.length - 1 ? "," : "|";
            }

            for (let i = 0; i < statsDataList.length; i++) {
                saveData += statsDataList[i].toString(10);
                saveData += i != statsDataList.length - 1 ? "," : "|";
            }

            for (let i = 0; i < minerDataList.length; i++) {
                saveData += minerDataList[i]?.level.toString(10);
                saveData += i != minerDataList.length - 1 ? "," : "|";
            }

            for (let i = 0; i < achievementDataList.length; i++) {
                saveData += achievementDataList[i]?.unlocked === true ? 1 : 0;
                // saveData += i != this.achievementsRegistry.length - 1 ? "" : "" 
            }

            localStorage.setItem("gameState", saveData);
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

                    this.addMetric(["currencies", "rock"], 1 * this.stats.rps);

                    this.timeAccumulators[timeAccumulator] = 0;
                    continue;
            }

            switch (timeAccumulator) {
                case "timePlayed":
                    this.addMetric(["stats", "timePlayed"], 1);
                    break;
                case "autoSave":
                    if (timeAcc < AUTOSAVE_TIME) continue;
                    this.save();
                    break;
            }

            this.timeAccumulators[timeAccumulator] = 0;
        }
    },

    renderUI() {
        for (let i = 0; i < MINERS_COUNT; i++) {
            const miner = this.miners[`miner${i + 1}`];
            const btn = document.getElementById(`miner${i + 1}` + "-upgrade");
            if (btn) {
                const nextCost = Math.floor(miner.baseCost * (miner.level === 0 ? 1 : miner.level ** 1.1));
                btn.innerHTML = `${slopify(nextCost)} [${miner.level}, ${miner.sps.toFixed(2)} sps]`;
            }
        }
        
        rock_count.innerHTML = slopify(Math.floor(this.currencies.rock));
        bulk_count.innerHTML = this.bulkCount === Infinity ? "Max" : this.bulkCount;

        requestAnimationFrame(this.renderUI.bind(this));
    }
};

function getTime() {
    try {
        const response = fetch('https://aisenseapi.com/services/v1/datetime');

        const serverData = response.json();

        const unixSeconds = Math.floor(new Date(serverData.datetime).getTime() / 1000);
        return unixSeconds;
    }
    catch (error) {
        console.warn("error while getting reliable time!")
        return Math.floor(new Date().getTime() / 1000);
    }
}

function slopify(num) {
    if (num < 1000) return num.toString();
    const suffixes = ["", "K", "M", "B", "T", "Qd", "Qn", "Sx"];
    const tier = Math.floor(Math.log10(num) / 3);

    const i = Math.min(tier, suffixes.length - 1);

    const scale = Math.pow(10, i * 3);
    const formatted = num / scale;

    return formatted.toFixed(2).replace("/\.0$/", "") + suffixes[i];
}

heartbeatWorker.onmessage = function(event) {
    if (event.data === 'TICK') {
        Game.loop(event.timeStamp);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    Game.init();
});

const Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

window.addEventListener("keydown", function(event) {
    if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() == 's')) {
        if (saveDebounce) return;
        saveDebounce = true;

        event.preventDefault();
        Game.save();

        Sleep(1000);
        
        saveDebounce = false;
    }
    if (event.key.toLowerCase() === "b") {
        Game.buyAllMiners();
    }
});

document.addEventListener("contextmenu", function(event) {
    event.preventDefault();
});

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
        Game.save() // just incase.
    }
});