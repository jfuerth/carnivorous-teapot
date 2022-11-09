'use strict';

/*
BSD 2-Clause License

Copyright (c) 2022, Jonathan Fuerth
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

/* Size of the playfield in logical pixels. Sprites exist in this space. */
const PLAYFIELD_WIDTH = 500;
const PLAYFIELD_HEIGHT = 500;
const ROAD_LINE_YS = [
    (PLAYFIELD_HEIGHT / 4) * 1,
    (PLAYFIELD_HEIGHT / 4) * 2,
    (PLAYFIELD_HEIGHT / 4) * 3,
]
const HISCORE_STORAGE_KEY = "hiScore_2"

class Sprite {
    /**
     * A positionable, animated image.
     * 
     * @param {*} name The name of this sprite (for debugging)
     * @param {*} imgsrc The location to load the image from. Image should be a column of frames (1xN).
     * @param {*} frameheight The pixel height of 1 frame in the source image. All frames have the same height and the same width (the source image width).
     * @param {*} animations Animation specs referring to frames:
     * ```
     * {
     *   walking: [[1, 5], [2, 5]]  // entry is [frame_num, time_in_frames]
     *   idle: [[0, 50]]
     * }
     * ```
     */
    constructor(name, imgsrc, frameheight, animations) {
        this.name = name;
        this.image = new Image();
        this.image.src = imgsrc;
        this.frameheight = frameheight;
        this.animations = animations;
        this.x = 0;
        this.y = 0;

        // inits this.animation, this.animFrame, this.animFrameStep
        this.setAnimation(Object.keys(animations)[0]);

        // we become ready when the spritesheet has been processed into this.frames
        this.ready = false;

        // cutting from spritesheet https://developer.mozilla.org/en-US/docs/Web/API/createImageBitmap
        let thissprite = this;
        this.image.onload = () => {
            let frame_promises = [];
            for (var y = 0; y < thissprite.image.height; y+= frameheight) {
                frame_promises.push(createImageBitmap(
                    thissprite.image,
                    0, y,
                    thissprite.image.width, frameheight))
            }

            Promise.all(frame_promises).then((frames) => {
                //console.log("Saving sprites as frames");
                thissprite.frames = frames;
                thissprite.ready = true;
            });

            // init hitbox unless it was already set before image loaded
            if (!thissprite.hitbox) {
                thissprite.hitbox = {
                     x: 0,
                     y: 0,
                     w: thissprite.image.width,
                     h: frameheight
                };
            }
        }
    }

    setAnimation(name) {
        this.animation = this.animations[name];
        //console.log("Set animation to", name, ":", this.animation);
        this.animFrame = 0;
        this.animFrameStep = 0;
    }

    nextFrame() {
        if (!this.ready) {
            return null;
        }
        let current = this.animation[this.animFrame];
        if (this.animFrameStep >= current[1]) {
            this.animFrameStep = 0;
            this.animFrame++;
            if (this.animFrame >= this.animation.length) {
                this.animFrame = 0;
            }
        }
        let result = this.frames[this.animation[this.animFrame][0]]
        this.animFrameStep++;
        return result;
    }

    move() {
        // no-op. should be implemented by subclass.
    }

    interact(other) {
        // no-op. should be implemented by subclass.
    }

    /**
     * Disconnects and nulls out this.sound if there is one.
     */
    silence() {
        if (this.sound) {
            this.sound.disconnect();
            this.sound = null;
        }
    }

    finished() {
        return !this.isOnScreen();
    }

    isOnScreen() {
        if (this.x > PLAYFIELD_WIDTH || this.x < -this.image.width) {
            return false;
        }
        if (this.y > PLAYFIELD_HEIGHT || this.y < -this.frameheight) {
            return false;
        }
        return true;
    }

    ensureFullyOnScreen() {
        if (!this.ready) {
            return;
        }
        if (this.x < 0) {
            this.x = 0;
        }
        if (this.x > PLAYFIELD_WIDTH - this.image.width) {
            this.x = PLAYFIELD_WIDTH - this.image.width;
        }
        if (this.y < 0) {
            this.y = 0;
        }
        if (this.y > PLAYFIELD_HEIGHT - this.frameheight) {
            this.y = PLAYFIELD_HEIGHT - this.frameheight;
        }
    }

    intersects(other) {
        if (!this.hitbox || !other.hitbox) return;
        let rect1 = {
            x: this.x + this.hitbox.x,
            y: this.y + this.hitbox.y,
            w: this.hitbox.w,
            h: this.hitbox.h,
        }
        let rect2 = {
            x: other.x + other.hitbox.x,
            y: other.y + other.hitbox.y,
            w: other.hitbox.w,
            h: other.hitbox.h,
        }
        return rect1.x < rect2.x + rect2.w &&
        rect1.x + rect1.w > rect2.x &&
        rect1.y < rect2.y + rect2.h &&
        rect1.h + rect1.y > rect2.y
    }
}

class TitleScreen extends Sprite {
    constructor() {
        super("TitleScreen", "TitleScreen.png", 320, {
            idle: [[0,500]],
        })
        this.x = PLAYFIELD_WIDTH / 2 - 380 / 2;
        this.y = PLAYFIELD_HEIGHT / 2 - this.frameheight / 2;
    }
}

class ClickToStart extends Sprite {
    constructor() {
        super("ClickToStart", "ClickToStart.png", 16, {
            idle: [
                [3,4],[4,4],[3,4],[4,4],
                [0,6],[1,6],[2,6],
                [3,4],[4,4],[3,4],[4,4],],
        })
        this.x = PLAYFIELD_WIDTH / 2 - 256 / 2;
        this.y = PLAYFIELD_HEIGHT / 2 - this.frameheight / 2;
    }
}

class Credits extends Sprite {
    constructor() {
        super("Credits", "Credits.png", 16, {
            credits: [[0,20],[1,20],[2,20],[3,20],[4,20],],
        })
        this.x = PLAYFIELD_WIDTH / 2 - 400 / 2;
        this.y = PLAYFIELD_HEIGHT / 2 + 380/2; // below title
    }
}

class GameOverMessage extends Sprite {
    constructor() {
        super("GameOver", "GameOver.png", 48, {
            idle: [[0,500]],
        })
        this.x = PLAYFIELD_WIDTH / 2 - 304 / 2;
        this.y = PLAYFIELD_HEIGHT / 2 - this.frameheight / 2;
        this.sound = playSample("teapotdeath");
    }
}

class NewHiScore extends Sprite {
    constructor() {
        super("NewHiScore", "NewHiScore.png", 16, {
            flashing: [[0,5],[1,5]],
        })
        this.x = PLAYFIELD_WIDTH / 2 - 240 / 2;
        this.y = PLAYFIELD_HEIGHT / 2 - this.frameheight / 2 + 60;
    }
}

class Player extends Sprite {
    constructor() {
        super("Player", "Teapot.png", 32, {
            idle: [[0,50]],
            walking: [[1,5], [2,5]],
            dead: [[3, 500]],
            wielding: [[4,5],[5,5],[6,5],[7,5]]
        });
        this.setAnimation("wielding");
        this.x = PLAYFIELD_WIDTH / 4;
        this.y = PLAYFIELD_HEIGHT / 2;
        this.speed = 2.5;
        this.hitbox = {
            x: 6,
            y: 4,
            w: 22,
            h: 21,
        }
    }

    move() {
        if (gamestate.inputs.left) {
            this.x -= this.speed;
        }
        if (gamestate.inputs.right) {
            this.x += this.speed;
        }
        if (gamestate.inputs.up) {
            this.y -= this.speed;
        }
        if (gamestate.inputs.down) {
            this.y += this.speed;
        }
        if (gamestate.inputs.fire) {
            if (gamestate.knifeThrowCooldown === 0) {
                gamestate.knifeThrowCooldown = KNIFE_COOLDOWN_FRAMES;
                if (this.spendKnife(true)) {
                    let knife = new Knife(Knife.STATE_THROWN);
                    gamestate.sprites.push(knife);
                    knife.x = this.x + this.hitbox.w;
                    knife.y = this.y;
                }
            }
        }
        this.ensureFullyOnScreen();
    }

    interact(other) {
        switch (other.name) {
            case "Broccoli":
            case "Onion":
                if (this.intersects(other)) {
                    this.die();
                }
                break;
            case "Lamb":
                if (this.intersects(other)) {
                    if (other.dead) break;
                    if (!this.spendKnife(false)) break;

                    other.die();
                    gamestate.score += 1000;
                    // TODO floating number
                }
                break;
            case "Knife":
                if (this.intersects(other)) {
                    if (other.state === Knife.STATE_GROUNDED) {
                        gamestate.knives++;
                        if (gamestate.knives === 1) {
                            this.setAnimation("wielding");
                        }
                        gamestate.score += 100;
                        other.x = -100; // will remove on next frame
                        playSample("schwing");
                        // TODO floating number
                    } else {
                        this.die();
                    }
                }
                break;
        }
    }

    /**
     * Attempts to spend a knife from inventory.
     * @returns true if a knife was spent
     */
    spendKnife(soundOnFail) {
        if (gamestate.knives === 0) {
            if (soundOnFail) {
                this.sound = playSample("outtaknives");
            }
            return false;
        }
        gamestate.knives--;
        if (gamestate.knives === 0) {
            this.setAnimation("walking");
        }
        return true;
    }

    die() {
        this.setAnimation("dead");
        setGamePhase(PHASE_GAME_OVER);
    }
}

class Lamb extends Sprite {
    constructor() {
        super("Lamb", "Lamb.png", 32, {
            idle: [[0,50]],
            running: [[1,5], [2,5], [3,5]],
            dead: [[4,500]]
        });
        this.setAnimation("running");
        this.x = PLAYFIELD_WIDTH;
        this.y = Math.random() * (PLAYFIELD_HEIGHT - this.frameheight);
        this.dead = false;
    }

    move() {
        if (this.dead) {
            this.x -= gamestate.roadSpeed;
        } else {
            this.x -= gamestate.lambSpeed;
        }
    }

    die() {
        this.setAnimation("dead");
        this.dead = true;
        this.sound = playSample("lambkill");
    }
}

class Broccoli extends Sprite {
    constructor() {
        super("Broccoli", "Broccoli.png", 32, {
            idle: [[0,50]]
        });
        this.x = PLAYFIELD_WIDTH;
        this.y = Math.random() * (PLAYFIELD_HEIGHT - this.frameheight);
        this.hitbox = {
            x: 10,
            y: 6,
            w: 12,
            h: 16,
        }
    }

    move() {
        this.x -= gamestate.roadSpeed;
    }
}

class Onion extends Sprite {
    constructor() {
        super("Onion", "Onion.png", 32, {
            rolling: [[0,5],[1,5],[2,5],[3,5],]
        });
        this.x = gamestate.player.x;
        if (gamestate.player.y < PLAYFIELD_HEIGHT / 2) {
            this.y = PLAYFIELD_HEIGHT;
            this.speed = -gamestate.onionSpeed;
        } else {
            this.y = -(this.frameheight - 1);
            this.speed = gamestate.onionSpeed;
        }
        this.hitbox = {
            x: 6,
            y: 6,
            w: 20,
            h: 21,
        }
    }

    move() {
        this.y += this.speed;
    }
}

class Knife extends Sprite {
    static STATE_GROUNDED = "STATE_GROUNDED";
    static STATE_THROWN = "STATE_THROWN";

    constructor(initialState) {
        super("Knife", "Knife.png", 32, {
            grounded: [[0,50]],
            thrown: [[0,2], [1,2], [2,2], [3,2]]
        });
        this.x = PLAYFIELD_WIDTH;
        this.y = Math.random() * PLAYFIELD_HEIGHT - this.frameheight;
        this.hitbox = {
            x: 6,
            y: 5,
            w: 9,
            h: 9,
        }
        this.setState(initialState);
        this.velocity = [6, 0];
    }

    setState(newState) {
        switch (newState) {
            case Knife.STATE_GROUNDED:
                this.setAnimation("grounded");
                this.silence();
                break;
            case Knife.STATE_THROWN:
                this.setAnimation("thrown");
                this.silence();
                this.sound = playSample("throw");
                break;
        }
        this.state = newState;
    }

    move() {
        switch (this.state) {
            case Knife.STATE_GROUNDED:
                this.x -= gamestate.roadSpeed;
                break;
            case Knife.STATE_THROWN:
                this.x += this.velocity[0];
                this.y += this.velocity[1];
                break;
        }
    }

    interact(other) {
        if (this.state !== Knife.STATE_THROWN) {
            return;
        }
        switch (other.name) {
            case "Broccoli":
            case "Onion":
                if (this.intersects(other)) {
                    this.setState(Knife.STATE_GROUNDED);
                }
                break;
            case "Lamb":
                if (this.intersects(other)) {
                    if (other.dead) break;
                    other.die(); // TODO: score in lamb.die()?
                    gamestate.score += 1000;
                    // TODO floating number
                    this.velocity[0] *= -1;
                    this.velocity[1] = Math.random() * 4 - 2
                    break;
                }
        }
    }

    finished() {
        let f = super.finished();
        if (f) {
            this.silence();
        }
        return f;
    }
}

class RoadLine extends Sprite {
    constructor(y) {
        super("Road Line", "RoadLine.png", 8, {
            idle: [[0,500]]
        });
        this.x = PLAYFIELD_WIDTH;
        this.y = y;
    }

    move() {
        this.x -= gamestate.roadSpeed;
    }
}

class Sidewalk extends Sprite {
    constructor(y) {
        super("Sidewalk", "Sidewalk.png", 32, {
            idle: [[0,500]]
        });
        this.x = PLAYFIELD_WIDTH;
        this.y = 0;
    }

    move() {
        this.x -= gamestate.roadSpeed;
    }
}


/*******************
 * Sound/Audio
 ******************/

// Files listed here are imbued with buffers (async) when the game first starts
let sounds = {
    schwing: {
        file: "Schwing.mp3"
    },
    throw: {
        file: "KnifeThrow.mp3",
        loop: true,
    },
    outtaknives: {
        file: "Ennh.mp3"
    },
    onionthrow: {
        file: "Bew.mp3"
    },
    lambkill: {
        file: "BaaaWach.mp3"
    },
    teapotdeath: {
        file: "TeapotDeath.mp3"
    },
    runningmusic: {
        file: "CarnivorousTeapotTheme.mp3",
        loop: true,
    },
    attractmusic: {
        file: "StartScreen.mp3",
        loop: true,
    },
    gameovermusic: {
        file: "GameOver.mp3",
        loop: true,
    },
}

const audioCtx = new AudioContext();

async function getFile(audioContext, filepath) {
    const response = await fetch(filepath);
    const arrayBuffer = await response.arrayBuffer();
    /** @type {AudioBuffer} */
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return audioBuffer;
}

async function setupSample(soundTableEntry) {
    const filePath = soundTableEntry.file;
    const buffer = await getFile(audioCtx, filePath);
    soundTableEntry.buffer = buffer;
}

async function setupSamples() {
    for (var name of Object.keys(sounds)) {
        await setupSample(sounds[name]);
    }
}

function playSample(name) {
    if (!sounds[name]) {
        console.log("Sound not defined:", name);
        return;
    }
    let audioBuffer = sounds[name].buffer;
    if (!audioBuffer) {
        console.log("Sound not loaded:", name);
    }
    const sampleSource = new AudioBufferSourceNode(audioCtx, {
      buffer: audioBuffer,
      playbackRate: 1,
      loop: !!sounds[name].loop,
    });
    sampleSource.connect(audioCtx.destination);
    sampleSource.start(audioCtx.currentTime);
    return sampleSource;
}

/** Use setMusic() to  change this.
 * @type {AudioBufferSourceNode}
 */
let currentBgMusic = null;
function setMusic(name) {
    if (currentBgMusic) {
        currentBgMusic.disconnect();
    }
    if (name == null) {
        currentBgMusic = null;
    } else {
        currentBgMusic = playSample(name);
    }
}


/********************
 * game state
 ********************/

const PHASE_ATTRACT = "PHASE_ATTRACT";
const PHASE_RUNNING = "PHASE_RUNNING";
const PHASE_GAME_OVER = "GAME_OVER"

const KNIFE_COOLDOWN_FRAMES = 20;

const INITIAL_GAMESTATE = {
    phase: PHASE_ATTRACT,
    frameDelay: 10,

    bgsprites: [],
    sprites: [],

    inputs: {
        left: false,
        right: false,
        down: false,
        up: false,
    },

    player: null, // set in setGamePhase when newPhase == RUNNING
    teabags: 3,
    knives: 3,
    score: 0,
    
    knifeThrowCooldown: KNIFE_COOLDOWN_FRAMES, // don't start at 0 because it can waste a knife on start

    lamb: null,
    lambSpeed: 1.5,

    roadSpeed: 3,

    broccoliFrequency: 40,
    nextBroccoli: 40,
    
    onionFrequency: 200,
    minOnionScore: 5000,
    nextOnion: 0,
    onionSpeed: 4,

    knifeFrequency: 400,
    nextKnife: 400,
    
    roadLineFrequency: 100,
    nextRoadLine: 0,

    sidewalkFrequency: 41,
    nextSidewalk: 0,

    gameOverMusicDelay: 50,
}
// deep copy initial state
// this won't be used for much -- setGameState reinits it on the way in to PHASE_RUNNING
let gamestate = JSON.parse(JSON.stringify(INITIAL_GAMESTATE));

let hiScore = 0;
if (window.localStorage && localStorage.getItem(HISCORE_STORAGE_KEY)) {
    hiScore = parseInt(localStorage.getItem(HISCORE_STORAGE_KEY));
}

function setGamePhase(newPhase) {
    switch (newPhase) {
        case PHASE_ATTRACT:
            silenceAllSprites();
            setMusic("attractmusic");
            gamestate.phase = newPhase;
            gamestate.sprites = [];
            gamestate.sprites.push(new TitleScreen());
            gamestate.sprites.push(new ClickToStart());
            gamestate.sprites.push(new Credits());
            gamestate.frameDelay = 100;
            break;
        case PHASE_RUNNING:
            setMusic("runningmusic");
            gamestate = JSON.parse(JSON.stringify(INITIAL_GAMESTATE));
            gamestate.phase = newPhase;
            gamestate.player = new Player();
            gamestate.sprites.push(gamestate.player);
            break;
        case PHASE_GAME_OVER:
            silenceAllSprites();
            setMusic(null); // will transition to gameover music after SFX ends
            gamestate.phase = newPhase;
            gamestate.sprites.push(new GameOverMessage());
            gamestate.frameDelay = 100;

            if (gamestate.score > hiScore) {
                hiScore = gamestate.score;
                gamestate.sprites.push(new NewHiScore());
                if (localStorage) {
                    localStorage.setItem(HISCORE_STORAGE_KEY, "" + gamestate.score);
                }
            }

            break;
    }
}

function silenceAllSprites() {
    for (var s of gamestate.sprites) {
        s.silence();
    }
    for (var s of gamestate.bgsprites) {
        s.silence();
    }
}

/**
 * One-time setup on page load.
 */
function game() {
    // fill page now and after resize
    function stretchCanvas() {
        let canvas = document.getElementById("game");
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;

        // determine scale (size of logical pixel in physical pixels)
        // let scale = Math.min(PLAYFIELD_HEIGHT / ch, PLAYFIELD_WIDTH / cw);
        let scale = Math.min(canvas.width / PLAYFIELD_WIDTH, canvas.height / PLAYFIELD_HEIGHT);

        /** @type {CanvasRenderingContext2D} */
        let ctx = canvas.getContext("2d");
        ctx.resetTransform();
        ctx.translate(
            canvas.width/2 - PLAYFIELD_WIDTH * scale / 2,
            canvas.height/2 - PLAYFIELD_HEIGHT * scale / 2);
        ctx.scale(scale, scale);

        ctx.beginPath();
        // need -1 for rounding error between centering and clipping
        ctx.rect(0, 0, PLAYFIELD_WIDTH - 1, PLAYFIELD_HEIGHT - 1);
        ctx.clip();
    }
    addEventListener("resize", stretchCanvas);
    stretchCanvas();

    // function that progresses through attract and game over phases
    // plus attempts to start sound. Safe to call on any user input, really.
    const startGameAndSound = () => {
        // check if context is in suspended state (autoplay policy)
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        if (!!gamestate) {
            if (gamestate.phase === PHASE_ATTRACT) {
                setGamePhase(PHASE_RUNNING);
            } else if (gamestate.phase === PHASE_GAME_OVER) {
                setGamePhase(PHASE_ATTRACT);
            }
        }
    }

    const KEY_SPACE = 32;
    const KEY_ENTER = 13;
    const KEY_RIGHTARROW = 39;
    const KEY_LEFTARROW = 37;
    const KEY_DOWNARROW = 40;
    const KEY_UPARROW = 38;
    const KEY_W = 87;
    const KEY_A = 65;
    const KEY_S = 83;
    const KEY_D = 68;

    // key input handling
    document.addEventListener("keydown", event => {
        const kc = event.keyCode;
        if (kc === KEY_SPACE || kc == KEY_ENTER) {
            startGameAndSound();
        }
        if (kc === KEY_RIGHTARROW || kc === KEY_D) {
            gamestate.inputs.right = true;
          } else if (kc === KEY_LEFTARROW || kc === KEY_A) {
            gamestate.inputs.left = true;
          } else if (kc === KEY_DOWNARROW || kc === KEY_S) {
            gamestate.inputs.down = true;
          } else if (kc === KEY_UPARROW || kc === KEY_W) {
            gamestate.inputs.up = true;
          } else if (kc === KEY_SPACE) {
            gamestate.inputs.fire = true;
          } else {
            console.log("key", kc);
          }
    }, false);
    document.addEventListener("keyup", event => {
        const kc = event.keyCode;
        if (kc === KEY_RIGHTARROW || kc === KEY_D) {
            gamestate.inputs.right = false;
        } else if (kc === KEY_LEFTARROW || kc === KEY_A) {
            gamestate.inputs.left = false;
        } else if (kc === KEY_DOWNARROW || kc === KEY_S) {
            gamestate.inputs.down = false;
        } else if (kc === KEY_UPARROW || kc === KEY_W) {
            gamestate.inputs.up = false;
        } else if (kc === KEY_SPACE) {
            gamestate.inputs.fire = false;
        }
    }, false);

    // attempt to get sound working on any click
    document.getElementById("game").addEventListener('click', startGameAndSound, false);

    // initialize sound (blocks game startup)
    setupSamples().then(() => {
        setGamePhase(PHASE_ATTRACT);
        gameloop();
    });
}
window.onload = game;
let ready = false;

function gameloop() {
    if (!ready) {
        ready = true;
        for (var s of gamestate.sprites) {
            ready &= s.ready;
        }
        if (!ready) {
            // still loading. try again later.
            setTimeout(gameloop, 100);
            return;
        }
    }

    if (gamestate.phase === PHASE_ATTRACT) {
        // start key/click is in input handler from one-time init function

    } else if (gamestate.phase === PHASE_GAME_OVER) {
        if (gamestate.gameOverMusicDelay-- === 0) {
            setMusic("gameovermusic");
        }

    } else if (gamestate.phase === PHASE_RUNNING) {
        // new lamb?
        if (gamestate.lamb == null || gamestate.lamb.finished()) {
            gamestate.lamb = new Lamb();
            gamestate.sprites.push(gamestate.lamb);
        }

        // new broccoli?
        if (gamestate.nextBroccoli-- == 0) {
            gamestate.nextBroccoli = gamestate.broccoliFrequency;
            gamestate.sprites.push(new Broccoli());
        }

        // new road lines?
        if (gamestate.nextRoadLine-- == 0) {
            gamestate.nextRoadLine = gamestate.roadLineFrequency;
            ROAD_LINE_YS.forEach(y => gamestate.bgsprites.push(new RoadLine(y)));
        }

        // new sidewalk?
        if (gamestate.nextSidewalk-- == 0) {
            gamestate.nextSidewalk = gamestate.sidewalkFrequency;
            gamestate.bgsprites.push(new Sidewalk());
        }

        // new onions?
        if (gamestate.score > gamestate.minOnionScore &&
                gamestate.nextOnion-- == 0) {
            gamestate.sprites.push(new Onion());
            gamestate.nextOnion = gamestate.onionFrequency;
            playSample("onionthrow");
        }

        // new knife?
        if (gamestate.nextKnife-- == 0) {
            gamestate.nextKnife = gamestate.knifeFrequency;
            gamestate.sprites.push(new Knife(Knife.STATE_GROUNDED));
        }

        gamestate.knifeThrowCooldown =
            Math.max(gamestate.knifeThrowCooldown - 1, 0);

        move(gamestate.bgsprites);
        move(gamestate.sprites);

        interact(gamestate.sprites);
    }

    // update scoreboard
    let ctx = prepareRender();
    render(ctx, gamestate.bgsprites);
    render(ctx, gamestate.sprites);
    renderStatusBar(ctx, gamestate);
    
    setTimeout(gameloop, gamestate.frameDelay);
}

function move(sprites) {
    // iterate backwards so we can remove sprites that are done
    for (var i = sprites.length - 1; i >= 0; i--) {
        let s = sprites[i];
        s.move();
        if (s.finished()) {
            //console.log("Sprite at", i, " (", s.name, ") is finished");
            sprites.splice(i, 1);
        }
    }
}

function interact(sprites) {
    // iterate backwards so we can remove sprites that are done
    for (var i = sprites.length - 1; i >= 0; i--) {
        let s1 = sprites[i];
        for (var s2 of sprites) {
            s1.interact(s2);
        }
        if (s1.finished()) {
            //console.log("Sprite at", i, " (", s1.name, ") is finished");
            sprites.splice(i, 1);
        }
    }
}

/** @type {CanvasRenderingContext2D} */
function prepareRender() {
    /** @type {HTMLCanvasElement} */
    let c = document.getElementById("game");

    /** @type {CanvasRenderingContext2D} */
    let ctx = c.getContext("2d");

    ctx.clearRect(0, 0, PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT);

    // sort sprites by y coordinate so the perspective looks right
    gamestate.sprites.sort((a, b) => a.y - b.y);

    return ctx;    
}

function render(
    /** @type {CanvasRenderingContext2D} */ ctx,
    /** @type {Sprite[]} */ sprites) {
    for (var s of sprites) {
        let image = s.nextFrame();
        if (image == null) continue;
        //console.log("rendering", s.name, "at", s.x, ",", s.y);
        ctx.drawImage(image, s.x, s.y);
    }
}

// status bar "fonts"
const numberSprite = new Sprite("ScoreDigits", "YellowScoreDigits.png", 16, { dummy: [[0, 1]]})
const knifeSprite = new Sprite("Knife", "Knife.png", 32, { dummy: [[0, 1]]})

function renderStatusBar(
    /** @type {CanvasRenderingContext2D} */ ctx,
    gamestate) {

    let y = 8;
    if (numberSprite.ready) {
        let score = "" + gamestate.score;
        if (gamestate.phase === PHASE_ATTRACT) {
            score = ":; " + hiScore; // ":;" maps to "HI" in our sprite
        }
        let x = PLAYFIELD_WIDTH - (numberSprite.image.width * (1 + score.length))
        for (var i = 0; i < score.length; i++) {
            let digit = score.charCodeAt(i) - 48; // 48 is ascii '0'
            let image = numberSprite.frames[digit];
            if (image) {
                ctx.drawImage(image, x, y);
            }
            x += numberSprite.image.width;
        }
    }

    if (knifeSprite.ready) {
        let x = 16;
        let image = knifeSprite.frames[0];
        for (var i = 0; i < gamestate.knives; i++) {
            ctx.drawImage(image, x, y);
            x += 16;
        }
    }
}