/* globals Croquet */

class SignerModel {
    init() {
        if (!this.querySelector("#player")) {
            let commit = window._production ? window._production + "/" : "/";
            this.domId = "holder";
            this.classList.add("holder");
            let overlay = this.createElement("div");
            overlay.domId = "mm-overlay";

            let player = this.createElement("div");
            player.domId = "player";

            let playerImage = this.createElement("img");
            playerImage._set("src", `./${commit}assets/juzang.png`);
            playerImage.domId = "player-image";

            let gradation = this.createElement("div");
            gradation.domId = "gradation";

            let mask = this.createElement("div");
            mask.domId = "mask";

            let logo1 = this.createElement("img");
            logo1.domId = "team-logo1";
            logo1._set("src", `./${commit}assets/ucla.png`);

            let finalFour = this.createElement("img");
            finalFour.domId = "final-four";
            finalFour._set("src", `./${commit}assets/final-four.png`);

            let matchUp = this.createElement("div");
            matchUp.domId = "match-up";
            matchUp.innerHTML = "UCLA v GONZAGA";

            let venue = this.createElement("div");
            venue.domId = "venue";
            venue.innerHTML = "APRIL 4 - CAESARS SUPERDOME, NEW ORLEANS";

            let playerName = this.createElement("div");
            playerName.domId = "player-name";
            playerName.innerHTML = `<span class="first-name">JOHNNY</span><span class="last-name">JUZANG<span>`;

            let ploma = this.createElement("div");
            ploma.domId = "ploma";

            ploma.setCode("ploma.PlomaModel");
            ploma.setViewCode("ploma.PlomaView");

            let serialNumber = this.createElement("div");
            serialNumber.domId = "serial-number";

            let other = this.createElement("div");
            other.innerHTML = `<img id="other-cards" src="./${commit}assets/other-cards.png"/>`;
            other.classList.add("other");

            let footer = this.createElement("div");
            footer.domId = "footer";
            footer.innerHTML = `<img id="powerdby" src="./${commit}assets/poweredby.png"/>`;

            let confetti = this.createElement("img");
            confetti.domId = "confetti";
            confetti._set("src", `./${commit}assets/confetti.png`);

            this.appendChild(overlay);
            this.appendChild(player);

            player.appendChild(playerImage);
            player.appendChild(gradation);
            player.appendChild(mask);
            player.appendChild(logo1);
            player.appendChild(finalFour);
            player.appendChild(matchUp);
            player.appendChild(venue);
            player.appendChild(playerName);
            player.appendChild(ploma);
            this.appendChild(serialNumber);
            this.appendChild(other);
            this.appendChild(footer);
            this.appendChild(confetti);
        }
    }
}

class PlomaModel {
    init() {
        if (!this.querySelector("#canvas")) {
            let canvas = this.createElement("canvas");
            canvas.domId = "canvas";
            canvas.classList.add("no-select");

            canvas.setCode("ploma.PlomaCanvasModel");
            canvas.setViewCode("ploma.PlomaCanvasView");
            this.appendChild(canvas);

            let picker = this.createElement();
            picker.domId = "colorPicker";
            picker.classList.add("colorPicker");
            picker.setCode("ploma.ColorPickerModel");
            picker.setViewCode("ploma.ColorPickerView");
            this.appendChild(picker);

            picker.call("ColorPickerModel", "setDrawerId", canvas.id);

            /*
            let logger = this.createElement();
            logger.domId = "logger";
            logger.classList.add("logger");
            this.appendChild(logger);
            */
        }

        if (!this._get("views")) {
            this._set("views", []);
        }

        this.subscribe(this.sessionId, "resetUsers", "resetUsers");
        this.subscribe(this.sessionId, "doneDrawing", "doneDrawing");
        this.subscribe(this.sessionId, "view-join", "viewJoin");
        this.subscribe(this.sessionId, "view-exit", "viewExit");
        console.log("PlomaModel.init");
    }

    doneDrawing() {
        this.publish(this.sessionId, "showClaim");
    }

    viewJoin(viewId) {
        let views = this._get("views");
        let ind = views.indexOf(viewId);
        if (ind < 0) {
            views.push(viewId);
        }
    }

    viewExit(viewId) {
        let views = this._get("views");
        let ind = views.indexOf(viewId);
        if (ind >= 0) {
            views.splice(ind, 1);
        }
    }

    resetUsers() {
        this._set("views", []);
    }
}

class PlomaView {
    init() {
        window.drawer = false;
        this.postview = !!window._postview;
        if (!this.postview) {
            let qr = document.body.querySelector(".qr");
            if (!qr) {
                qr = Croquet.App.makeQRCanvas();
                qr.classList.add("qr");
                document.body.appendChild(qr);
            }
        }

        let canvas = this.querySelector("#canvas");
        if (this.postview) {
            canvas.dom.classList.add("postview");
        }

        let claim = document.querySelector("#claimButton");
        if (!claim) {
            claim = document.createElement("div");
            claim.classList.add("claimButton");
            claim.id = "claimButton";
            claim.innerHTML = "CLAIM";
            let player = document.querySelector("#player");
            player.appendChild(claim);
            claim.addEventListener("click", () => this.claim());
        }

        let cheat = document.querySelector("#cheatButton");
        if (!cheat) {
            cheat = document.createElement("div");
            cheat.classList.add("cheatButton");
            cheat.id = "cheatButton";
            document.body.appendChild(cheat);
            cheat.addEventListener("click", () => this.cheat());
        }

        let done = document.querySelector("#doneButton");
        if (!done) {
            done = document.createElement("div");
            done.classList.add("done");
            done.id = "doneButton";
            document.body.appendChild(done);
            done.addEventListener("click", () => this.done());
        }

        this.subscribe(this.sessionId, "showClaim", "showClaim");

        window.topView.requestInitialization(this, "PlomaView", "maybeReset");
        console.log("PlomaView.init");
    }

    maybeReset() {
        let search = new URL(window.location).searchParams;
        if (search.get("s")) {
            this.publish(this.sessionId, "resetPloma");
            this.publish(this.sessionId, "resetUsers");
        }
    }

    undo() {
        let canvas = this.querySelector("#canvas");
        this.publish(canvas.model.id, "undo", this.viewId);
    }

    claim() {
        window.drawer = false;
        let player = document.querySelector("#player");
        let elem = document.querySelector(".holder");
        let holderStyle = window.getComputedStyle(elem);
        let playerStyle = window.getComputedStyle(elem);

        let width = parseFloat(playerStyle.width);
        let height = parseFloat(playerStyle.height);

        let innerWidth = parseFloat(holderStyle.width);
        let innerHeight = parseFloat(holderStyle.height);
        let scale = Math.min(innerWidth / width, innerHeight / height);

        scale *= 0.6;

        let mw = (innerWidth - width * scale) / 2;
        let mh = (innerHeight - height * scale) / 2;

        let transform = `translate(${mw}px, ${mh}px) scale(${scale})`;
        player.style.setProperty("transform", transform);
        player.style.setProperty("transform-origin", "0 0");

        let other = document.querySelector(".other");
        other.style.setProperty("display", "inherit");

        let claim = document.querySelector("#claimButton");
        claim.style.display = "none";

        let overlay = document.querySelector("#mm-overlay");
        overlay.style.display = "inherit";

        let footer = document.querySelector("#footer");
        footer.style.display = "flex";

        let serialNumber = document.querySelector("#serial-number");
        serialNumber.classList.add("visible");

        let number = this.model._get("views").indexOf(this.viewId) + 1;
        let str = number.toString().padStart(3, "0");
        serialNumber.textContent = `Serial Number #${str}`;

        let confetti = document.querySelector("#confetti");
        confetti.style.transition = "top 2s, opacity 2s";
        confetti.style.display = "inherit";

        confetti.style.opacity = "0.5";

        setTimeout(() => {
            confetti.style.top = `${window.innerHeight}px`;
        }, 100);

        this.animate(player, mw, mh, scale);

    }

    cheat() {
        let done = document.querySelector("#doneButton");
        done.style.setProperty("display", "inherit");
        done.style.setProperty("background-color", "#800101");
        document.body.style.setProperty("background-size", "cover");
        document.body.style.setProperty("background-color", "#065b9c");
        this.publish(this.sessionId, "resetPloma");
        window.drawer = true;
    }

    done() {
        window.drawer = false;
        this.publish(this.sessionId, "doneDrawing");
    }

    showClaim() {
        if (this.claimed) {return;}
        let claim = document.querySelector("#claimButton");
        claim.classList.add("visible");
        claim.style.setProperty("display", "flex");

        let done = document.querySelector("#doneButton");
        done.style.setProperty("display", "none");
    }

    animate(player, mw, mh, scale) {
        this.claimed = true;
        player.style.setProperty("transition", "transform 1s");

        mh = 50;
        let transform = `translate(${mw}px, ${mh}px) scale(${scale})`;

        player.style.setProperty("transform", transform);
        player.classList.add('player-card');
    }
}

class PlomaCanvasModel {
    init() {
        this.subscribe(this.id, "undo", "undo");
        this.subscribe(this.id, "redo", "redo");

        this.subscribe(this.id, "pointerDown", "pointerDown");
        this.subscribe(this.id, "pointerMove", "pointerMove");
        this.subscribe(this.id, "pointerUp", "pointerUp");
        this.subscribe(this.id, "resizeWindow", "resizeWindow");

        this.subscribe(this.sessionId, "resetPloma", "resetData");

        let PlomaDataClass = this.getLibrary("ploma.PlomaDataModel");

        if (!this._get("data")) {
            let dataModel = PlomaDataClass.create();
            dataModel.setExtent(800, 800);
            this._set("data", dataModel);
        }

        this._set("lastPersistTime", this.now());
        console.log("PlomaCanvasModel.init");
    }

    resetData() {
        this._get("data").data.reset();
        this.publish(this.id, "drawAll");
    }

    getData() {
        return this._get("data").data;
    }

    pointerDown(message) {
        let data = this.getData();
        data.beginStroke(message);
        this.publish(this.id, "beginStroke", message);
    }

    pointerMove(message) {
        let data = this.getData();
        data.extendStroke(message);
        this.publish(this.id, "extendStroke", message);
    }

    pointerUp(message) {
        let data = this.getData();
        data.endStroke(message);
        this.publish(this.id, "endStroke", message);
        this.persistRequest();
    }

    undo(viewId) {
        let strokeLists = this.getData().strokeLists;
        let strokes = strokeLists.get(viewId);

        let findLast = () => {
            if (!strokes) {return -1;}
            for (let i = strokes.length - 1; i >= 0; i--) {
                if (strokes[i].done) {return i;}
            }
            return -1;
        };

        let index = findLast();
        if (index >= 0) {
            strokes[index].done = false;
            this.publish(this.id, "drawAll");
        }
    }

    redo(viewId) {
        let strokeLists = this.getData().strokeLists;
        let strokes = strokeLists.get(viewId);

        let find = () => {
            if (!strokes) {return -1;}
            if (strokes.length === 0) {return -1;}
            if (strokes.length === 1) {return strokes[0].done ? -1 : 0;}
            for (let i = strokes.length - 1; i >= 1; i--) {
                if (strokes[i].done) {return -1;}
                if (!strokes[i].done && strokes[i - 1].done) {return i;}
            }
            return 0;
        };

        let index = find();
        if (index >= 0) {
            strokes[index].done = true;
            this.publish(this.id, "drawAll");
        }
    }

    loadPersistentData(data) {
        let top = this.wellKnownModel("modelRoot");
        if (data.version === "1") {
            data = top.parse(data.data);
            this._get("data").setData({
                width: data.width, height: data.height,
                global: data.global,
                totalStrokes: data.global.length});
        } else if (data.version === "2") {
            data = top.parse(data.data);
            this._get("data").setData(data);
        }
    }

    persistRequest() {
        const now = this.now();
        if (now - this._get("lastPersistTime") < 30000) {/* console.log("skip"); */ return;}
        /* console.log("write", now); */
        this._set("lastPersistTime", now);
        this.savePersistentData();
    }

    savePersistentData() {
        let top = this.wellKnownModel("modelRoot");
        let func = () => {
            let {global, strokeLists, totalStrokes, width, height} = this.getData();
            return {
                version: "2",
                data: top.stringify({
                    global, strokeLists, totalStrokes, width, height
                })
            };
        };
        top.persistSession(func);
    }

    resizeWindow(data) {
        let plomaData = this._get("data");
        plomaData.setExtent(data.width, data.height);
        this.publish(this.id, "reset");
    }
}

class PlomaCanvasView {
    init() {
        // let ua = window.navigator.userAgent;
        // let probablySafari = ua.indexOf("Safari") >= 0 && ua.indexOf("Chrome") === -1;

        this.addEventListener("pointerdown", "pointerDown");
        this.addEventListener("pointermove", "pointerMove");
        this.addEventListener("pointerup", "pointerUp");

        this.dom.addEventListener("touchstart", (evt) => this.absorb(evt));
        this.dom.addEventListener("touchmove", (evt) => this.absorb(evt));
        this.dom.addEventListener("touchend", (evt) => this.absorb(evt));

        document.body.addEventListener("wheel", (evt) => this.absorb(evt), {passive: false});

        this.subscribe(this.model.id, "beginStroke", "beginStroke");
        this.subscribe(this.model.id, "extendStroke", "extendStroke");
        this.subscribe(this.model.id, "endStroke", "endStroke");
        this.subscribe(this.model.id, "drawAll", "drawAll");
        this.subscribe(this.model.id, "reset", "setup");

        this.subscribe(this.model.id, "colorSelected", "colorSelected");
        this.subscribe(this.model.id, "nibSelected", "nibSelected");

        this.zoom = 1;
        this.postview = !!window._postview;

        let w = this.w = this.getData().width;
        let h = this.h = this.getData().height;

        this.ploma = new (this.model.getLibrary("ploma.Ploma"))(this.postview, w, h);

        this.setup(true);

        this.setWindowResize();
        window.onresize();

        // setTimeout(() => this.test(), 2);

        console.log("PlomaCanvasView.init");
    }

    getData() {
        return this.model.call("PlomaCanvasModel", "getData");
    }

    setWindowResize() {
        window.onresize = () => {
            if (!this.postview) {
                let width = this.getData().width;
                let height = this.getData().height;
                this.resizeImage(width, height);
                return;
            }
            this.resizeWindow();
        };
    }

    setup(initialize) {
        // debugger;
        let w = this.getData().width;
        let h = this.h = this.getData().height;
        console.log("setup", w, h);

        if (!initialize && w === this.w && h === this.h) {return;}
        this.w = w;
        this.h = h;
        this.canvas = this.dom;
        this.canvas.setAttribute("width", w);
        this.canvas.setAttribute("height", h);

        this.ctx = this.canvas.getContext("2d");

        this.drawAll();
    }

    clearCanvas() {
        let w = this.w;
        let h = this.h;
        this.ctx.clearRect(0, 0, w, h);
        this.ctx.fillStyle = this.ploma.paperColor;
        this.ctx.globalAlpha = 1;
        this.ctx.fillRect(0, 0, this.w, this.h);
        this.imageData = this.ctx.getImageData(0, 0, w, h);
        this.imageDataData = this.imageData.data;
        this.s = new Map();
        this.isDrawing = false;

        this.ploma.setupCanvas(w, h);
    }

    drawAll() {
        this.clearCanvas();
        let global = this.getData().global;
        global.forEach(stroke => {
            let points = stroke.points;
            let viewId = stroke.viewId;
            let state = this.ensureUser(viewId);
            let m;
            if (stroke.done === false) {return;}

            this.ploma.useStateDuring(this.imageDataData, state, () => {
                if (points.length > 2) {
                    let {x, y, p} = points[0];
                    state.color = stroke.color;
                    state.nib = stroke.nib;
                    this.ploma.beginStroke({x, y, p, viewId});
                    for (let i = 1; i < points.length - 1; i++) {
                        m = points[i];
                        this.ploma.extendStroke({x: m.x, y: m.y, p: m.p, viewId});
                    }

                    m = points[points.length - 1];
                    this.ploma.endStroke({x: m.x, y: m.y, p: m.p, viewId});
                }
            });
        });

        this.ctx.putImageData(this.imageData, 0, 0, 0, 0, this.w, this.h);
    }

    newUserEntry() {
        return {
            rawStrokes: [],
            curRawStroke: [],
            curRawSampledStroke: [],
            filteredStrokes: [],
            curFilteredStroke: [],
            textureSampleStep: 0,
            lastControlPoint: null,
            filterWeight: 0.5,
            filterWeightInverse: 1 - 0.5,
            stepOffset: 0,
            stepInterval: 0.3,
            pointCounter: 0,
            color: {r: 255, g: 250, b: 240},
            nib: 0.2
        };
    }

    ensureUser(viewId) {
        if (!this.s.get(viewId)) {
            let data = this.newUserEntry();
            this.s.set(viewId, data);
        }
        return this.s.get(viewId);
    }

    forceMap(force) {
        function map(value, valueMin, valueMax, from, to) {
            let ratio = (value - valueMin) / (valueMax - valueMin);
            return from + ratio * (to - from);
        }

        if (force < 0.2) {
            return map(force, 0, 0.2, 0, 0.4);
        }

        return map(force, 0.2, 1.0, 0.4, 1.0);
    }

    getPressure(evt) {
        let v;
        if (evt.pressure > 0) {
            v = this.forceMap(evt.pressure);
        } else if (evt.touchType === "stylus") {
            // let force = this.forceMap(evt.force);
            v =  evt.force / Math.sin(evt.altitudeAngle);
        } else if (evt.force > 0) {
            v = evt.force;
        } else {
            v = 0.5;
        }

        /*
        let logger = window.topView.querySelector("#logger");
        if (logger) {
            logger.dom.textContent += `\n{type: ${evt.type}, touchType: ${evt.touchType}, force: ${evt.force}, pressure: ${evt.pressure}, altitudeAngle: ${evt.altitudeAngle}, mapped: ${v}}`;
        }
        */
        return v;
    }

    makeEvent(evt) {
        let realEvt;
        if (evt.type.startsWith("touch") && evt.touches) {
            realEvt = evt.touches[0];
        } else {
            realEvt = evt;
        }

        return {
            x: realEvt.offsetX,
            y: realEvt.offsetY,
            p: this.getPressure(realEvt),
            viewId: this.viewId
        };
    }

    pointerDown(evt) {
        if (!window.drawer) {return;}
        this.isDrawing = true;
        if (evt.buttons !== 1) {return;}
        evt.preventDefault();
        let state = this.ensureUser(this.viewId);
        let data = this.makeEvent(evt);
        data.color = state.color;
        data.nib = state.nib;
        this.publish(this.model.id, "pointerDown", data);
        this.ploma.useStateDuring(this.imageDataData, state, () => {
            return this.ploma.beginStroke(data);
        });
    }

    pointerMove(evt) {
        if (!this.isDrawing) {return;}
        if (evt.buttons !== 1) {return;}
        evt.preventDefault();
        let state = this.ensureUser(this.viewId);
        let data = this.makeEvent(evt);
        this.publish(this.model.id, "pointerMove", data);
        let patch = this.ploma.useStateDuring(this.imageDataData, state, () => {
            return this.ploma.extendStroke(data);
        });

        if (patch) {
            this.redrawPatch(patch, true);
        }
    }

    pointerUp(evt) {
        // this.pointerMove(evt);
        let wasDrawing = this.isDrawing;
        this.isDrawing = false;
        if (!wasDrawing) {return;}
        let state = this.ensureUser(this.viewId);
        let data = this.makeEvent(evt);
        this.publish(this.model.id, "pointerUp", data);
        let patch = this.ploma.useStateDuring(this.imageDataData, state, () => {
            return this.ploma.endStroke(data);
        });

        if (patch) {
            this.redrawPatch(patch, true);
        }
    }

    beginStroke(data) {
        let viewId = data.viewId;
        if (this.viewId === viewId) {return;}
        let state = this.ensureUser(viewId);
        state.color = data.color;
        state.nib = data.nib;
        this.ploma.useStateDuring(this.imageDataData, state, () => {
            return this.ploma.beginStroke(data);
        });
    }

    extendStroke(data) {
        let viewId = data.viewId;
        if (this.viewId === viewId) {return;}
        let state = this.ensureUser(viewId);
        let patch = this.ploma.useStateDuring(this.imageDataData, state, () => {
            return this.ploma.extendStroke(data);
        });

        if (patch) {
            this.redrawPatch(patch);
        }
    }

    endStroke(data) {
        let viewId = data.viewId;
        if (this.viewId === viewId) {return;}
        let state = this.ensureUser(viewId);
        let patch = this.ploma.useStateDuring(this.imageDataData, state, () => {
            return this.ploma.endStroke(data);
        });

        if (patch) {
            this.redrawPatch(patch);
        }
    }

    colorSelected(hex) {
        let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        let obj = result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;

        let s = this.ensureUser(this.viewId);
        s.color = obj;
    }

    nibSelected(nib) {
        let s = this.ensureUser(this.viewId);
        s.nib = parseFloat(nib);
    }

    redrawPatch(data, force) {
        let {minx, miny, maxx, maxy, viewId} = data;

        if (this.viewId === viewId && !force) {return;}

        this.ctx.putImageData(
            this.imageData,
            0,
            0,
            minx - 5,
            miny - 5,
            (maxx - minx) + 10,
            (maxy - miny) + 10
        );
    }

    resizeImage(width, height) {
        let root = document.querySelector("#croquet-root");
        let rect = root.getBoundingClientRect();
        let scale = Math.min(rect.width / width, rect.height / height);
        scale *= this.zoom;
        let marginW = (rect.width - scale * width) / 2;
        let marginH = (rect.height - scale * height) / 2;

        this.canvas.style.removeProperty("display");
        this.canvas.style.setProperty("width", `${width}px`);
        this.canvas.style.setProperty("height", `${height}px`);
        this.canvas.style.setProperty("transform", `translate(${marginW}px, ${marginH}px) scale(${scale})`);
    }

    resizeWindow() {
        let elem = document.querySelector(".holder");
        let style = window.getComputedStyle(elem);
        let width = parseFloat(style.width);
        let height = parseFloat(style.height);
        this.publish(this.model.id, "resizeWindow", {width: width * 2, height: height * 2});

        let innerWidth = window.innerWidth;
        let innerHeight = window.innerHeight;
        let scale = Math.min(innerWidth / width, innerHeight / height);

        let mw = (innerWidth - width * scale) / 2;
        let mh = (innerHeight - height * scale) / 2;

        let transform = `translate(${mw}px, ${mh}px) scale(${scale})`;
        elem.style.setProperty("transform", transform);
        elem.style.setProperty("transform-origin", "0 0");
    }

    absorb(evt) {
        evt.preventDefault();
        evt.returnValue = false;
    }

    test() {
        this.pointerDown({type: "pointerdown", offsetX: 100, offsetY: 100, pressure: 0.5, buttons: 1});
        this.pointerMove({type: "pointermove", offsetX: 110, offsetY: 100, pressure: 0.5, buttons: 1});
        this.pointerMove({type: "pointermove", offsetX: 110, offsetY: 110, pressure: 0.5, buttons: 1});
        this.pointerUp({type: "pointerup", offsetX: 110, offsetY: 120, pressure: 0.5, buttons: 1});
    }
}

class ButtonView {
    init() {
        this.addEventListener("pointerdown", "filterOut");
        this.addEventListener("pointermove", "filterOut");
        this.addEventListener("pointerup", "filterOut");
    }

    filterOut(evt) {
        evt.preventDefault();
        evt.stopPropagation();
    }
}

function start(parent, _json, persistentData) {
    let elem = parent.createElement("div");
    elem.setCode(["ploma.SignerModel", "ploma.PlomaModel"]);
    elem.setViewCode("ploma.PlomaView");

    parent.appendChild(elem);

    if (persistentData) {
        let canvas = parent.querySelector("#canvas");
        canvas.call("PlomaCanvasModel", "loadPersistentData", persistentData);
    }
}

import {Ploma} from "./ploma.js";
import {PlomaDataModel} from "./plomaData.js";
import {ColorPickerModel, ColorPickerView} from "./colorPicker.js";

export const ploma = {
    functions: [start],
    expanders: [SignerModel, PlomaModel, PlomaView, PlomaCanvasModel, PlomaCanvasView, ButtonView, ColorPickerModel, ColorPickerView],
    classes: [Ploma, PlomaDataModel]
};
