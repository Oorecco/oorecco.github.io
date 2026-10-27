/// <reference path="../../../utils/js/break_infinity.d.ts" />

// CONSTANTS
const VERSION = "v0.01";
const CLIENT_ID = '801470033464-c9fq6032rsa3qe2apa799ioebml39i9d.apps.googleusercontent.com';
const REDIRECT_URI = window.location.origin + "/auth/callback/index.html";

const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
const SAVE_FILE_NAME = 'rock_incremental_save.txt';
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

const COOKIE_PATH = window.location.pathname.replace(/[^/]*$/, '');

const realTimers = [];
let saveDebounce = false;
let isLoaded = false;
let secureTimeOrigin = null;
let inputLock = true;

// ELEMENTS
const rock_count = document.getElementById("rock-counter")
const bulk_count = document.getElementById("bulk-counter");
const loading_screen = document.getElementById("loading-screen");
const loading_text = document.getElementById("loading-text");
const loading_save = document.getElementById("loading-save");
const versionText = document.getElementById("version");
const statusText = document.getElementById("status-text");
const loginStatusText = document.getElementById("login-status");
const musicToggleText = document.getElementById("music-toggle")
const autoSaveIntrvlText = document.getElementById("autosave-interval-label");

// OTHER THINGS
const heartbeatWorker = new Worker('js/worker.js');
const bgMusic = new Audio('../../assets/rockincremental/bgMusic.mp3');

const Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const randomSleep = (min, max) => {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
};

bgMusic.volume = 0.8;
bgMusic.preload = 'auto';
bgMusic.loop = true;

const Game = {
    accessToken: null,
    player: {
        name: "default",

        currencies: {
            dust: new Decimal(0),
            rock: new Decimal(0)
        },
        miners: {
            "miner1": {cost: new Decimal(100), level: new Decimal(1), sps: 1},
            "miner2": {cost: new Decimal(5000), level: new Decimal(0), sps: 1},
            "miner3": {cost: new Decimal(300000), level: new Decimal(0), sps: 1},
            "miner4": {cost: new Decimal(10000000), level: new Decimal(0), sps: 1},
            "miner5": {cost: new Decimal(1000000000), level: new Decimal(0), sps: 1}
        },

        achievements: [],
        stats: {
            playTime: new Decimal(0),
            unscaledPlayTime: new Decimal(0),
            gameSpeed: new Decimal(1)
        },
        settings: {
            notation: "Normal",
            musicEnabled: true,
            autoSaveInterval: 30,
            sleepMode: false
        },
    },

    achievementsRegistry: [
        {
            id: 1,
            name: "Test 1",
            desc: "literally just a test",
            auto: true,
            metricPath: ["player", "currencies", "rock"],
            targetValue: 10,
            rewardMetricPath: ["player", "currencies", "dust"],
            rewardValue: "add 50"
        },
        {
            id: 2,
            name: "Test 2",
            desc: "test 2 ig",
            auto: true,
            customCheck: function() {
                const date = new Date();
                let Hours = date.getHours();
                return Hours >= 20 && Hours <= 23;
            },
            rewardMetricPath: ["player", "currencies", "dust"],
            rewardValue: "add 100"
        },
        {
            id: 3,
            name: "test 3",
            desc: "Get 50 miner1.",
            auto: true,
            metricPath: ["player", "miners", "miner1", "level"],
            targetValue: 50,
            rewardMetricPath: ["player", "stats", "gameSpeed"],
            rewardValue: "mult 1.5"
        },
        {
            id: 4,
            name: "test 4",
            desc: "Get 999,999,999 rocks",
            auto: true,
            metricPath: ["player", "currencies", "rock"],
            targetValue: 999999999,
            customReward: function() {
                
            }
        },
        {
            id: 5,
            name: "literally p2w",
            desc: "Get 123,456 dust",
            auto: true,
            metricPath: ["player", "currencies", "dust"],
            targetValue: 123456,
            rewardMetricPath: ["player", "currencies", "dust"],
            rewardValue: 50
        }
    ],

    timeAccumulators: {
        miner1: new Decimal(0),
        miner2: new Decimal(0),
        miner3: new Decimal(0),
        miner4: new Decimal(0),
        miner5: new Decimal(0),
    },

    bulkCount: 1,

    lastTick: performance.now(),

    loginWithGoogle() {
        const state = crypto.randomUUID();
        sessionStorage.setItem('expectedState', state);

        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            redirect_uri: REDIRECT_URI,
            response_type: 'token',
            scope: SCOPES,
            state: state,
            prompt: 'select_account'
        });

        const width = 500;
        const height = 600;

        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const authWindow = window.open('https://accounts.google.com/o/oauth2/v2/auth?' + params.toString(), 'GoogleAuthPopup', `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`)
        // window.location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();

        if (authWindow) authWindow.focus();
    },

    logoutWithGoogle() {
        if (this.accessToken) {
            fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(this.accessToken), { method: 'POST'})
            .catch(() => {});
        }

        deleteCookie('google_access_token');
        this.accessToken = null;
        loginStatusText.innerHTML = "isLogin = false;";
    },

    async driveFetch(url, options = {}) {
        if (!this.accessToken || !getCookie('google_access_token')) {
            this.logoutWithGoogle();
            throw new Error('Session expired');
        }

        const response = await fetch(url, {
            ...options,
            headers: { ...(options.headers || {}), 'Authorization': `Bearer ${this.accessToken}`}
        });

        if (response.status === 401) {
            this.logoutWithGoogle();
            throw new Error('Session expired');
        }

        return response;
    },

    async findSaveFileId() {
        const query = `name='${SAVE_FILE_NAME}'`;
        const listUrl = `${DRIVE_FILES}?spaces=appDataFolder&fields=files(id,name)&q=${encodeURIComponent(query)}`;
        const response = await this.driveFetch(listUrl);

        if (!response.ok) throw new Error(await response.text());
        const data = await response.json();

        return data.files && data.files.length > 0 ? data.files[0].id : null;
    },

    async saveToCloud(textString) {
        if (typeof textString !== 'string') {
            console.error("Save file content must be a string!");
            return;
        }
        try {
            statusText.innerHTML = "Saving to cloud..."
            statusText.hidden = false;
            const fileId = await this.findSaveFileId();

            const metaData = { name: SAVE_FILE_NAME, mimeType: 'text/plain' };
            if (!fileId) metaData.parents = ['appDataFolder'];

            const boundary = 'cloud_save_boundary_marker';
            const delimiter = `\r\n--${boundary}\r\n`;
            const closeDelimiter = `\r\n--${boundary}--`;

            const body = 
                delimiter +
                'Content-Type: text/plain; charset=UTF-8\r\n\r\n' +
                JSON.stringify(metaData) +
                delimiter +
                'Content-Type: text/plain\r\n\r\n' +
                textString +
                closeDelimiter;

            const url = fileId
                ? `${DRIVE_UPLOAD}/${fileId}?uploadType=multipart`
                : `${DRIVE_UPLOAD}?uploadType=multipart`;

            const saveResponse = await this.driveFetch(url, {
                method: fileId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': `multipart/related; boundary=${boundary}`},

                body: body
            });

            if (!saveResponse.ok) {
                const err = await saveResponse.json().catch(() => ({}));
                const reason = err.error?.errors?.[0]?.reason;
                if (reason === 'storageQuotaExceeded') throw new Error('Drive full');
                throw new Error('Upload rejected');
            }

            console.log("Successfully save to cloud!");
            statusText.innerHTML = "Successfully save to cloud!";
            await Sleep(3000);
            statusText.hidden = true;
        } catch (err) {
            if (err.message === 'Drive full') {
                console.error("Failed to save to cloud because Google Drive is full!");
                return;
            }

            console.error(err);
        }
    },

    async loadFromCloud() {
        try {
            const fileId = await this.findSaveFileId();
            if (!fileId) {
                console.warn("No past data found in the google drive.")
                return;
            }

            const fileResponse = await this.driveFetch(`${DRIVE_FILES}/${fileId}?alt=media`);
            if (!fileResponse.ok) throw new Error(await fileResponse.text());

            const data = await fileResponse.text();
            console.log(data);
            console.log("Succesfully load save file from cloud!");
        } catch (err) {
            console.error(err);
        }
    },

    parseSaveFile() {
        try {
            let time = getGameTime();
            let saveData = VERSION + "," + time + ";";

            const currenciesDataList = Object.values(this.player.currencies || []);
            const statsDataList = Object.values(this.player.stats || []);
            const minerDataList = Object.values(this.player.miners || []);
            const achievementDataList = Object.values(this.player.achievements || {}); 
            
            for (let i = 0; i < currenciesDataList.length; i++) {
                saveData += currenciesDataList[i].toExponential(3);
                saveData += i != currenciesDataList.length - 1 ? "," : "|";
            }

            for (let i = 0; i < statsDataList.length; i++) {
                if (statsDataList[i] instanceof Decimal) {
                    saveData += Decimal.floor(statsDataList[i].toExponential(3));
                } else {
                    saveData += Math.floor(statsDataList[i].toString(10));
                }

                saveData += i != statsDataList.length - 1 ? "," : "|";
            }

            for (let i = 0; i < minerDataList.length; i++) {
                saveData += minerDataList[i]?.level.toString();
                saveData += i != minerDataList.length - 1 ? "," : "|";
            }

            for (let i = 0; i < achievementDataList.length; i++) {
                saveData += achievementDataList.includes(i + 1) === true ? 1 : 0;
                // saveData += i != this.achievementsRegistry.length - 1 ? "" : "" 
            }

            return saveData;
        } catch (err) {
            console.error(err);
            return null;
        }
    },

    async init() {
        this.accessToken = getCookie('google_access_token');
        if (this.accessToken) {
            loginStatusText.innerHTML = "isLogin = true;";
        }

        versionText.innerHTML = VERSION;
        await this.syncServerWithDeviceTime(); // bottleneck, haven't implemented preload process yet.
        let timer = 0;
        let step = 0;

        while (document.readyState !== 'complete') {
            step++;

            if (timer === 20) {
                console.log("This takes a long time. Please wait, this maybe my fault on the front-end.");
            } else if (timer === 60) {
                console.log("Try reloading the page!");
            }
            
            loading_text.innerHTML += ".";
            if (step === 3) {
                step = 0;
                loading_text.innerHTML = "Loading";
            }
            await Sleep(1000);
            timer++;
        }

        loading_screen.hidden = true;
        loading_save.hidden = false;
        
        Game.initData();
        await randomSleep(1000, 2000);
        
        heartbeatWorker.postMessage('START_TICK')
        requestAnimationFrame(Game.renderUI.bind(Game));

        every('autoLocalSave', this.player.settings.autoSaveInterval, this.save);
        every('cloudSave', 600, this.saveToCloud);

        loading_save.hidden = true;
        isLoaded = true;
    },

    async syncServerWithDeviceTime() {
        try {
            const requestStart = performance.now();
            console.log("rt");
            const serverTime = await getTime() * 1000;
            console.log("sb")

            const requestEnd = performance.now();
            const latency = (requestEnd - requestStart) / 2
            const precisePerfTime = requestEnd - latency;

            Object.defineProperty(window, 'SECURE_CLOCK_ORIGIN', {
                value: serverTime - precisePerfTime,
                writable: false,
                configurable: false
            });

            secureTimeOrigin = window.SECURE_CLOCK_ORIGIN;
            console.log("Game clock succesfully sync with network!")
        } catch (error) {
            console.warn("Network sync failed. Returns to default value.");
            secureTimeOrigin = Date.now() - performance.now();
        }
    },

    initData() {
        let data = localStorage.getItem("gameState")

        if (!data) {
            const time = getGameTime();
            const defaultSave = VERSION + "," + time + "default0" + ";" + "0,0|0,1,1|1,0,0,0,0|00000";
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

            const metaData = newData[0].split(",");
            const savedVersion = metaData[0];

            if (savedVersion !== VERSION) {
                console.log(`Migrating save file from ${savedVersion} to ${VERSION}!`);
                const VERSION_TIMELINE = ["v0.1", "v0.11"];

                const migrationSteps = {
                    "v0.1": function() {
                        // [PLACEHOLDER]
                    },
                    "v0.11": function() {
                        // [PLACEHOLDER]
                    }
                };

                let safeLoopCounter = 0;

                while (savedVersion !== VERSION && safeLoopCounter < 10) {
                    if (migrationSteps[savedVersion]) {
                        migrationSteps[savedVersion]();
                    }

                    let currentIndex = VERSION_TIMELINE.indexOf(savedVersion);
                    
                    if (currentIndex != 1 && currentIndex < VERSION_TIMELINE.length - 1) {
                        savedVersion = VERSION_TIMELINE[currentIndex++];
                        console.log(`Stepping version tracker up to: ${savedVersion}`);
                    } else {
                        savedVersion = VERSION;
                        break;
                    }

                    safeLoopCounter++;
                }

                const updatedMeta = VERSION + "," + getGameTime();
                const updatedData = `${currencies.join(",")}|${stats.join(",")}|${miners.join(",")}|${achievements.join("")}`;
                localStorage.setItem("gameState", `${updatedMeta};${updatedData}`);
            }
            const coreGameStats = newData[1].split("|");

            const currencies = coreGameStats[0].split(",");
            const stats = coreGameStats[1].split(",");
            const miners = coreGameStats[2].split(",");
            const achievements = coreGameStats[3].split("");

            this.player.currencies.rock = new Decimal(currencies[1] || 0);
            this.player.currencies.dust = new Decimal(currencies[0] || 0);
            
            const statsDataList = Object.keys(this.stats || {});

            for (let i = 0; i < stats.length; i++) {
                if (this.player.stats[statsDataList[i]] instanceof Decimal) {
                    this.player.stats[statsDataList[i]] = new Decimal(stats[i]);
                }
                
            }

            for (let i = 1; i < 5 + 1; i++) {
                const miner = this.player.miners[`miner${i}`];
                miner.level = new Decimal(miners[i - 1])
                if (miner.sps * miner.level) {
                    miner.sps = miner.level.mul(1);
                };
            }

            for (let i = 0; i < this.achievementsRegistry.length; i++) {
                if (achievements[i] === 1) {
                    this.player.achievements.push(i + 1);
                }
            }

            // const dt = getTime() - Number.parseInt(metaData[1], 10) || 0;
        }
    },

    loop(timeStamp) {
        let deltaTime = timeStamp - this.lastTick;
        this.lastTick = timeStamp;

        if (deltaTime >= 1000) {
            deltaTime = 1000;
        }

        const dtCalculated = new Decimal(deltaTime).mul(this.player.stats.gameSpeed);

        for (const timeAccumulator in this.timeAccumulators) {
            if (!Object.hasOwn(this.timeAccumulators, timeAccumulator)) continue;

            if (timeAccumulator.startsWith("miner")) {
                const miner = this.player.miners[timeAccumulator];
                if (!miner || miner.level.lt(1)) { continue; }
                this.timeAccumulators[timeAccumulator] = this.timeAccumulators[timeAccumulator].add(dtCalculated.mul(miner.sps));
                continue;
            }
        }
        this.updateGameLogic();
        updateRealTimers(deltaTime);
    },

    changeBulk() {
        const tier = [1, 5, 10, 25, 100, Infinity];
        const i = tier.indexOf(this.bulkCount);
        this.bulkCount = tier[(i + 1) % tier.length];
    },

    changeSetting(name, value = 0) {
        switch (name) {
            case "music_toggle":
                if (inputLock) return;

                this.player.settings.musicEnabled = !this.player.settings.musicEnabled;
                
                if (bgMusic.paused || this.player.settings.musicEnabled) {
                    bgMusic.play();
                    musicToggleText.innerHTML = "Music: on";
                } else {
                    musicToggleText.innerHTML = "Music: off";
                    bgMusic.pause();
                }

                break;
            case "autosave_interval":
                if (value < 10 || value > 60) return;

                this.player.settings.autoSaveInterval = value;
                changeTimerInterval('autoLocalSave', value);
                break;
            case "notations":
                if (typeof(value) != 'string') return;
                console.log(value);

                switch (value) {
                    case "normal":
                        this.player.settings.notation = "Normal";
                        break;
                    case "scientific":
                        this.player.settings.notation = "Scientific";
                        break;
                    case "engineering":
                        this.player.settings.notation = "Engineering";
                        break;
                }
        }
    },

    upgradeMiner(id, count) {
        const miner = this.player.miners[id];
        if (!miner) return;
        let tempLevel = miner.level;
        let cost = new Decimal(0);
        let tempCost = new Decimal(0);
        let addLevel = new Decimal(0);

        for (let i = 0; i < count; i++) {
            tempCost = miner.cost.mul(tempLevel.eq(0) ? 1 : tempLevel.pow(1.3));

            if (this.player.currencies.rock.lte(cost.add(tempCost))) break;
            cost = cost.add(tempCost);
            tempLevel = tempLevel.add(1);
            addLevel = addLevel.add(1);
        }

        if (this.player.currencies.rock.gte(cost)) {
            this.addMetric(["player", "miners", id, "level"], addLevel);
            this.addMetric(["player", "miners", id, "sps"], 5 * addLevel);
            this.addMetric(["player", "currencies", "rock"], -cost);
        }
    },

    buyAllMiners() {
        for (let i = 0; i < 5 + 1; i++) {
            this.upgradeMiner(`miner${i}`, this.bulkCount);
        }
    },

    resetLocalSave() {
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
        if (current[finalProperty] instanceof Decimal) {
            current[finalProperty] = current[finalProperty].add(amount);
        } else {
            current[finalProperty] += amount;
        }

        this.scanAutomatedAchievements();
    },

    scanAutomatedAchievements() {
        this.achievementsRegistry.forEach(ach => {
            if (!ach.auto || this.player.achievements.includes(ach.id)) return;

            let passStandardCheck = false;
            let passCustomCheck = true;
            
            if (ach.metricPath && ach.targetValue !== undefined) {
                let currentValue = this;
                for (const property of ach.metricPath) {
                    currentValue = currentValue[property];
                }

                if (currentValue instanceof Decimal) {
                    if (currentValue.lte(ach.targetValue)) {
                        passStandardCheck = true;
                    }
                } else {
                    if (currentValue >= ach.targetValue) {
                        passStandardCheck = true;
                    }
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
        let time = getGameTime();

        if (!data) {
            const defaultSave = VERSION + "," + time + ";" + "0,0|0,1,1|1,0,0,0,0|00000";
            localStorage.setItem("gameState", defaultSave);
            console.log("created new storage data!");
        } else {
            console.log("saving...");

            const saveData = this.parseSaveFile();

            localStorage.setItem("gameState", saveData);
        }
    },

    unlockAchievement(id) {
        const ach = this.player.achievements.includes(id);
        if (ach) return;

        this.player.achievements.push(id);
        const data = this.achievementsRegistry.find(achData => achData.id === id);
        console.log(`[ACHIEVEMENT]: Unlocked achievement ${data.name} [${data.desc}]`);
    },

    updateGameLogic() {
        for (const timeAccumulator in this.timeAccumulators) {
            if (!Object.hasOwn(this.timeAccumulators, timeAccumulator)) continue;
            let timeAcc = this.timeAccumulators[timeAccumulator];
            if (timeAcc.lt(1000)) continue;

            if (timeAccumulator.startsWith("miner")) {
                const miner = this.player.miners[timeAccumulator]
                if (!miner || miner.level.lt(1) ) return; 
                    this.addMetric(["player", "currencies", "rock"], miner.sps);

                    this.timeAccumulators[timeAccumulator] = new Decimal(0);
            }
        }
    },

    renderUI() {
        for (let i = 0; i < 5; i++) {
            const miner = this.player.miners[`miner${i + 1}`];
            const btn = document.getElementById(`miner${i + 1}` + "-upgrade");
            if (btn) {
                const nextCost =  miner.cost.mul(miner.level.eq(0) ? 1 : miner.level.pow(1.1)).floor();
                btn.innerHTML = `${slopify(nextCost)} [${miner.level}, ${miner.sps.toFixed(2)} sps]`;
            }
        }
        
        rock_count.innerHTML = slopify(this.player.currencies.rock.floor());
        bulk_count.innerHTML = this.bulkCount === Infinity ? "Max" : this.bulkCount;

        requestAnimationFrame(this.renderUI.bind(this));
    }
};

async function getTime() {
    try {
        console.log("bs");
        const response = await fetch('https://aisenseapi.com/services/v1/datetime', {
            signal: AbortSignal.timeout(5000)
        });
        if (!response.ok) { throw new Error('HTTP' + response.status); }

        console.log("get");
        const serverData = await response.json();

        const unixSeconds = Math.floor(new Date(serverData.datetime).getTime() / 1000);
        console.log(unixSeconds);
        return unixSeconds;
    }
    catch (err) {
        console.warn("Time fetch failed! Using device time. (", err, ")");
        return Math.floor(new Date().getTime() / 1000);
    }
}

function changeTimerInterval(id, value) {
    for (const t of realTimers) {
        if (t.id === id) {
            t.interval = value;
            return;
        }
    }
}
function every(id, seconds, fn) {
    realTimers.push( {id: id, interval: seconds, elapsed: 0, fn});
}

function updateRealTimers(dt) {
    for (const t of realTimers) {
        t.elapsed += dt / 1000;
        if (t.elapsed >= t.interval) {
            t.elapsed -= t.interval;
            t.fn.bind(Game);
        }
    }
}
function decMod(a, b) {
    a = new Decimal(a); b = new Decimal(b);
    return a.sub(a.div(b).floor().mul(b));
}

function unlockMusic() {
    if (!isLoaded) { return; }
    
    inputLock = false;
    if (Game.player.settings.musicEnabled) bgMusic.play().catch(() => {});
    ['pointerdown', 'keydown', 'touchstart'].forEach(e => window.removeEventListener(e, unlockMusic));
}

function getGameTime() {
    if (secureTimeOrigin === null) {
        return Date.now();
    }

    return Math.floor(secureTimeOrigin / 1000 + (performance.now() / 1000));
}

function setCookie(name, value, maxAgeSeconds) {
    document.cookie = name + '=' + encodeURIComponent(value) + 
        '; Max-Age=' + Math.max(0, Math.floor(maxAgeSeconds)) +
        '; Path=' + COOKIE_PATH +
        '; SameSite=Lax' + 
        'Secure';
}

function getCookie(name) {
    const match = document.cookie.split('; ').find(c => c.startsWith(name + "="));
    return match ? decodeURIComponent(match.substring(name.length + 1)) : null;
}

function deleteCookie(name) {
    document.cookie = name + '=; Max-Age=0; Path=' + COOKIE_PATH;
}

function slopify(num) {
    const suffixes = [
    "", "K", "M", "B", "T", "Qd", "Qn", "Sx", "Sp", "Oc", "No",
    "Dc", "UDc", "DDc", "TDc", "QaDc", "QiDc", "SxDc", "SpDc", "OcDc", "NoDc",
    "Vg", "UVg", "DVg", "TVg", "QaVg", "QiVg", "SxVg", "SpVg", "OcVg", "NoVg",
    "Tg", "UTg", "DTg", "TTg", "QaTg", "QiTg", "SxTg", "SpTg", "OcTg", "NoTg",
    "Qa", "UQa", "DQa", "TQa", "QaQa", "QiQa", "SxQa", "SpQa", "OcQa", "NoQa",
    "Qi", "UQi", "DQi", "TQi", "QaQi", "QiQi", "SxQi", "SpQi", "OcQi", "NoQi",
    "Sx", "USx", "DSx", "TSx", "QaSx", "QiSx", "SxSx", "SpSx", "OcSx", "NoSx",
    "Sp", "USp", "DSp", "TSp", "QaSp", "QiSp", "SxSp", "SpSp", "OcSp", "NoSp",
    "Oc", "UOc", "DOc", "TOc", "QaOc", "QiOc", "SxOc", "SpOc", "OcOc", "NoOc",
    "No", "UNo", "DNo", "TNo", "QaNo", "QiNo", "SxNo", "SpNo", "OcNo", "NoNo",
    "Ce", "UCe"
    ];

    if (num instanceof Decimal) {
        switch (Game.player.settings.notation) {
            case "Normal": {
                if (num.lt(1000000) ) { return num.toString(); }
                if (num.gte("1.78e308")) {
                    if (num.exponent >= 1e9) {
                        return "e" + slopify(num.exponent);
                    } else if (num.exponent >= 100000) {
                        return "e"+ num.exponent.toLocaleString('en-US');
                    } else {
                        return num.toStringWithDecimalPlaces(2).replace("+", "");
                    }
                }

                const tier = new Decimal(num.log10()).div(3).floor();

                const i = Decimal.min(tier, suffixes.length - 1);

                const scale = Decimal.pow(10, i.mul(3));
                const formatted = num.div(scale);

                return formatted.toFixed(2).replace("/\.0$/", "") + suffixes[i];
            }
            case "Scientific": {
                if (num.lte(1000000)) { return num.toString(); } 
                if (num.exponent >= 1e9) {
                    const expPower = new Decimal(Math.floor(num.exponent));
                    const expScale = Decimal.pow(10, expPower);
                    const expFormatted = num.div(expScale);

                    return "e" + expFormatted.toFixed(2) + "e" + expPower.toString();
                } else if (num.exponent >= 100000) {
                    return "e"+ num.exponent.toLocaleString('en-US');
                } else {
                    return num.toStringWithDecimalPlaces(2).replace("+", "");
                }
            }
            case "Engineering": {
                if (num.lt(1000)) { return num.toString(); }
                if (num.exponent >= 1e9) {
                    const tier = new Decimal(num.log10()).div(3).floor();

                    const scale = Decimal.pow(10, tier.mul(3));
                    const formatted = num.div(scale);

                    const exponent = tier.mul(3).toString();
                    return `${formatted.toFixed(2)}e${exponent}`; 
                }
            }
        }
    }
    else {
        if (num < 1000) return num.toString();
        const tier = Math.floor(Math.log10(num) / 3);
        const i = Math.min(tier, suffixes.length - 1);

        const scale = Math.pow(10, i * 3);
        const formatted = num / scale;

        return formatted.toFixed(2).replace("/\.0$/", "") + suffixes[i];
    }
}

heartbeatWorker.onmessage = function(event) {
    if (event.data === 'TICK') {
        Game.loop(event.timeStamp);
    }
}

window.addEventListener("keydown", async function(event) {
    if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() == 's')) {
        if (saveDebounce || !isLoaded) return;
        saveDebounce = true;

        event.preventDefault();
        Game.save();

        await Sleep(1000);
        
        saveDebounce = false;
    }
    if (event.key.toLowerCase() === "b") {
        Game.buyAllMiners();
    }
});

window.addEventListener('message', function(event) {
    if (event.origin != window.location.origin || !event.data) return;

    const { type, accessToken, state, error, expires_in } = event.data;

    if (error) {
        console.error("OAuth error:", error);
        return;
    }

    if (type == 'OAUTH_SUCCESS') {
        const savedState = this.sessionStorage.getItem('expectedState');

        this.sessionStorage.removeItem('expectedState');
        if (!savedState || savedState != state) {
            console.error("OAuth state mismatch. ignoring token.");
            return;
        }

        console.log("Success! Token verified: ", accessToken)
        Game.accessToken = accessToken;

        const expiresIn = Number(expires_in || 3600);
        setCookie('google_access_token', accessToken, expiresIn - 60);
        loginStatusText.innerHTML = "isLogin = true;";
    }
})

document.addEventListener("contextmenu", function(event) {
    event.preventDefault();
});

document.addEventListener("visibilitychange", function() {
    if (!isLoaded && document.visibilityState === "hidden") {
        Game.save() // just incase.
    }
});

Game.init();
['pointerdown', 'keydown', 'touchstart'].forEach(e => window.addEventListener(e, unlockMusic, { once: true }));