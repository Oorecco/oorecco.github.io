const TARGET_FPS = 60

self.onmessage = function(event) {
    if (event.data === 'START_TICK') {
        this.setInterval(() => {
            self.postMessage('TICK');
        }, 60 / 1000);
    }
}