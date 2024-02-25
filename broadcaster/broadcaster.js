/* globals AgoraRTC Croquet Swal */

class BroadcasterModel {
    init() {
        if (!this._get("viewIds")) {
            this._set("viewIds", []);
            this._set("cameraViewIds", []);
            this._set("agoraIds", new Map());
            this._set("opacity", "0.1");

            const names = [
                "videos", "screen", "opaqueMask", "control",
                "cameraInputHolder", "cameraLeft", "cameraLabel", "cameraRight",
                "micInputHolder", "micLeft", "micLabel", "micRight",
                "opacityHolder", "playButton"
            ];

            const elements = {};
            names.forEach(n => {
                const elem = this.createElement();
                elem.domId = n;
                elements[n] = elem;
            });

            this.appendChild(elements.videos);
            this.appendChild(elements.opaqueMask);
            this.appendChild(elements.control);

            elements.videos.appendChild(elements.screen);

            elements.control.appendChild(elements.cameraInputHolder);
            elements.control.appendChild(elements.micInputHolder);
            elements.control.appendChild(elements.opacityHolder);
            elements.control.appendChild(elements.playButton);

            elements.cameraInputHolder.appendChild(elements.cameraLeft);
            elements.cameraInputHolder.appendChild(elements.cameraLabel);
            elements.cameraInputHolder.appendChild(elements.cameraRight);

            elements.micInputHolder.appendChild(elements.micLeft);
            elements.micInputHolder.appendChild(elements.micLabel);
            elements.micInputHolder.appendChild(elements.micRight);

            elements.cameraInputHolder.classList.add("holder");
            elements.micInputHolder.classList.add("holder");

            elements.cameraLeft.classList.add("button");
            elements.cameraRight.classList.add("button");
            elements.micLeft.classList.add("button");
            elements.micRight.classList.add("button");

            elements.playButton.classList.add("button");

            const leftButton = `
<svg width="21" height="21" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" version="1.1" preserveAspectRatio="xMinYMin">
  <use xlink:href="#img-angle-left-sm"></use>
</svg>`;

            elements.cameraLeft.innerHTML = leftButton;
            elements.micLeft.innerHTML = leftButton;

            const rightButton = `
<svg width="21" height="21" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" version="1.1">
  <use xlink:href="#img-angle-right-sm"></use>
</svg>`;

            elements.cameraRight.innerHTML = rightButton;
            elements.micRight.innerHTML = rightButton;

            elements.opacityHolder.innerHTML = `
<div>Transparency:</div>
<input id="opacityInput" type="range" min="0" value="0.1" max="1" step="0.1">
`;

            const playButton = `
<svg width="16" height="16" viewBox="0 0 41 46" xmlns="http://www.w3.org/2000/svg" version="1.1" preserveAspectRatio="xMinYMin">
  <use xlink:href="#img-play-pause"></use>
</svg>`;
            elements.playButton.innerHTML = playButton;
        }

        this.subscribe(this.sessionId, 'view-join', "onViewJoin");
        this.subscribe(this.sessionId, 'view-exit', "onViewExit");

        this.subscribe(this.id, 'agoraJoined', "agoraJoined");

        this.subscribe(this.id, 'startCamera', "startCamera");
        this.subscribe(this.id, 'stopCamera', "stopCamera");

        this.subscribe(this.id, "opacity", "setOpacity");
    }

    onViewJoin(viewId) {
        const viewIds = this._get("viewIds");
        if (viewIds.indexOf(viewId) < 0) {
            viewIds.push(viewId);
            this.publish(this.id, 'view-joined', viewId);
        }
    }

    onViewExit(viewId) {
        const viewIds = this._get("viewIds");
        const ind = viewIds.indexOf(viewId);
        if (ind >= 0) {
            viewIds.splice(ind, 1);
            this.publish(this.id, 'view-exited', viewId);
            this.stopCamera(viewId);
        }

        this._get("agoraIds").delete(viewId);
    }

    agoraJoined(data) {
        const {uid, viewId} = data;
        this._get("agoraIds").set(viewId, uid);
    }

    agoraExit(_data) {
    }

    startCamera(viewId) {
        const cameraViewIds = this._get("cameraViewIds");
        const ind = cameraViewIds.indexOf(viewId);
        if (ind < 0) {
            cameraViewIds.push(viewId);
            this.publish(this.id, 'cameraStarted', viewId);
        }
    }

    stopCamera(viewId) {
        const cameraViewIds = this._get("cameraViewIds");
        const ind = cameraViewIds.indexOf(viewId);
        if (ind >= 0) {
            cameraViewIds.splice(ind, 1);
            this.publish(this.id, 'cameraStopped', viewId);
        }
    }

    setOpacity(data) {
        this._set("opacity", data);
        this.publish(this.id, "opacityChanged");
    }
}

class BroadcasterView {
    init() {
        this.elements = {};

        [
            "screen", "opaqueMask", "control", "cameraLeft", "cameraLabel", "cameraRight",
            "micLeft", "micLabel", "micRight", "opacityInput",
            "videos", "document", "playButton"
        ].forEach(name => {
            this.elements[name] = document.getElementById(name);
        });

        this.addEventListener(document, 'wheel', evt => evt.preventDefault(), {passive: false});
        this.addEventListener(this.elements.screen, 'click', this.startCamera.bind(this));
        this.addEventListener(this.elements.playButton, 'click', this.startCamera.bind(this));

        this.addEventListener(this.elements.cameraLeft, 'click', () => this.changeCamera(-1));
        this.addEventListener(this.elements.cameraRight, 'click', () => this.changeCamera(1));

        this.addEventListener(this.elements.micLeft, 'click', () => this.changeMic(-1));
        this.addEventListener(this.elements.micRight, 'click', () => this.changeMic(1));

        this.addEventListener(this.elements.opacityInput, 'input', this.opacityInput.bind(this));

        this.addEventListener(this.elements.control, 'pointerenter', this.showControl.bind(this));
        this.addEventListener(this.elements.control, 'pointerleave', this.hideControl.bind(this));

        // CLIENT
        // this.appID = '150d223019864b108fc38c6f37612e79';
        this.appID = '5589bee4bbc7475e87cd24b2c8c9e8f5';
        this.client = AgoraRTC.createClient({mode: 'rtc', codec: 'vp8'});

        // SUBSCRIBE
        this.subscribe(this.model.id, 'view-joined', "onViewJoined");
        this.subscribe(this.model.id, 'view-exited', "onViewExited");

        this.subscribe(this.model.id, 'cameraStarted', "cameraStarted");
        this.subscribe(this.model.id, 'cameraStopped', "cameraStopped");
        this.subscribe(this.model.id, 'opacityChanged', "opacityChanged");

        this.getCameras();
        this.getMics();

        Croquet.App.autoSession("q").then(channelName => {
            this.client.join(this.appID, channelName, null).then(uid => {
                this.uid = uid;
                this.publish(this.model.id, "agoraJoined", {uid, viewId: this.viewId});
                this.client.on('user-published', this.onUserPublished.bind(this));
                this.client.on('user-unpublished', this.onUserUnpublished.bind(this));

                this.refreshUIState();
                // startCamera();
            });
        });
    }

    // EVENT LISTENERS
    addEventListener(element, type, _eventListener, options) {
        this.eventListeners = this.eventListeners || [];

        const eventListener = _eventListener.bind(this);
        element.addEventListener(type, eventListener, options);
        this.eventListeners.push({element, type, eventListener, _eventListener});
    }

    removeEventListener(element, type, eventListener) {
        const record = this.eventListeners.find(rec => rec.element === element && rec.type === type && rec._eventListener === eventListener);
        if (record) element.removeEventListener(type, record.eventListener);
    }

    removeEventListeners() {
        this.eventListeners.forEach(({element, type, eventListener}) => {
            element.removeEventListener(type, eventListener);
        });
    }

    getReadableLabel(label) {
        if (!label) {return label;}
        const ind = label.indexOf("(");
        if (ind > 0) {
            return label.slice(0, ind);
        }
        return label;
    }

    opacityInput(evt) {
        this.publish(this.model.id, "opacity", evt.target.value);
    }

    opacityChanged() {
        const opacity = this.model._get("opacity");
        if (this.elements.opacityInput.value !== opacity) {
            this.elements.opacityInput.value = opacity;
        }
        const color = `rgba(255, 255, 255, ${opacity})`;
        this.elements.opaqueMask.style.backgroundColor = color;
    }

    showControl() {
        this.elements.control.style.removeProperty("opacity");
    }

    hideControl() {
        this.elements.control.style.setProperty("opacity", "0.05");
    }

    setCurrentCamera(obj) {
        this.currentCamera = obj;
        if (obj) {
            this.elements.cameraLabel.textContent = this.getReadableLabel(obj.label);
        }
    }

    getCameras() {
        AgoraRTC.getCameras().then(list => {
            this.cameraList = list;
            if (list.length > 0) {
                this.setCurrentCamera(list[0]);
            }
        });
    }

    changeCamera(offset) {
        if (!offset) {offset = 1;}
        if (!this.currentCamera || !this.cameraList) {return;}
        let current = this.cameraList.findIndex(l => l.deviceId === this.currentCamera.deviceId);
        current += offset;
        current %= this.cameraList.length;

        this.setCurrentCamera(this.cameraList[current]);
        const newId = this.currentCamera.deviceId;

        if (this.videoTrack) {
            this.videoTrack.setDevice(newId);
        }
    }

    setCurrentMic(obj) {
        this.currentMic = obj;
        if (obj) {
            this.elements.micLabel.textContent = this.getReadableLabel(obj.label);
        }
    }

    getMics() {
        AgoraRTC.getMicrophones().then(list => {
            this.micList = list;
            if (list.length > 0) {
                this.setCurrentMic(list[0]);
            }
        });
    }

    changeMic(offset) {
        if (!offset) {offset = 1;}
        if (!this.currentMic || !this.micList) {return;}
        let current = this.micList.findIndex(l => l.deviceId === this.currentMic.deviceId);
        current += offset;
        current %= this.micList.length;

        this.setCurrentMic(this.micList[current]);
        const newId = this.currentMic.deviceId;

        if (this.audioTrack) {
            this.audioTrack.setDevice(newId);
        }
    }

    startCamera() {
        if (!this.uid) {return;}
        if (this.videoTrack && this.audioTrack) {return;}
        this.publish(this.model.id, 'startCamera', this.viewId);

        const vPromise = AgoraRTC.createCameraVideoTrack({
            optimizationMode: "detail",
            encoderConfig: {frameRate: 30, height: 540, width: 960},
            cameraId: this.currentCamera ? this.currentCamera.deviceId : undefined
        });

        const aPromise = AgoraRTC.createMicrophoneAudioTrack({
            AEC: true,
            AGC: true,
            ANS: true
        });

        Promise.all([vPromise, aPromise]).then(tracks => {
            let v, a;
            if (tracks.constructor === Array) {
                v = tracks[0];
                a = tracks[1];
            } else {
                v = tracks;
            }
            const publish = [];
            this.videoTrack = v;
            this.videoEnabled = !!v;
            if (v) {
                publish.push(v);
            }

            this.audioTrack = a;
            this.audioEnabled = !!a;
            if (a) {
                this.setClass(this.elements.screen, true, "hasAudio");
                publish.push(a);
            }
            return this.client.publish(publish);
        }).then(() => {
            this.playVideoTrack(this.videoTrack);
        }).catch(_err => {
            Swal.fire(`Unable to start video and/or audio. Make sure you've allowed this page to use media devices.`);
            this.closeTracks();
            this.refreshUIState();
        });
    }

    stopCamera(viewId) {
        if (viewId === this.viewId) {
            this.closeTracks();
        }
    }

    onViewJoined() {
        this.refreshUIState();
    }

    onViewExited() {
        this.refreshUIState();
    }

    cameraStarted() {
        this.refreshUIState();
    }

    cameraStopped() {
        this.refreshUIState();
    }

    setClass(elem, flag, cls) {
        if (flag) {
            elem.classList.add(cls);
        } else {
            elem.classList.remove(cls);
        }
    }

    refreshUIState() {
        const viewIds = this.model._get("viewIds");
        const videos = this.elements.videos;

        videos.setAttribute("count", `${viewIds.length}`);
    }

    async onUserPublished(user, mediaType) {
        console.log("user published", user);
        await this.client.subscribe(user, mediaType);

        if (mediaType === "video") {
            this.playVideoTrack(user.videoTrack, user.uid);
        }

        if (mediaType === "audio") {
            this.playAudioTrack(user.audioTrack);
        }
    }

    onUserUnpublished() {
        // may be called twice for video and audio;
        this.elements.screen.innerHTML = "";
    }

    viewIdFromAgoraId(id) {
        const agoraIds = this.model._get("agoraIds");

        for (const [viewId, uid] of agoraIds) {
            if (uid === id) {return viewId;}
        }
        return null;
    }

    playVideoTrack(track, id) {
        let elem;
        if (this.videoTrack === track) {
            elem = this.elements.screen;
            elem.innerHTML = '';
            track.play(elem, {fit: 'contain', mirror: true});
        } else {
            const viewId = this.viewIdFromAgoraId(id);
            const viewIds = this.model._get("viewIds").slice();
            const myInd = viewIds.indexOf(this.viewId);
            if (myInd >= 0) {
                // should be always true
                viewIds.splice(myInd, 1);
            }

            const index = viewIds.indexOf(viewId) + 1;
            const video = document.createElement("div");
            const videos = this.elements.videos;
            video.id = `video-${id}`;
            video.classList.add(`remote-video-${index}`);
            videos.appendChild(video);
            track.play(video.id, {fit: 'contain'});
            elem = video;
        }

        setTimeout(() => {
            const p = elem.querySelector("div");
            if (p) p.style.backgroundColor = "transparent";
        }, 1000);
    }

    playAudioTrack(track) {
        track.play();
    }

    // CLIENT
    get isClientConnected() {
        return this.client.connectionState === 'CONNECTED';
    }

    // TOGGLE
    toggleVideo() {
        if (!this.videoTrack) {return;}
        this.setVideoState(!this.videoEnabled);
    }

    setVideoState(flag) {
        this.videoTrack.setEnabled(flag);
        this.videoEnabled = flag;
        this.setClass(this.elements.screen, !flag, "mute-video");
    }

    toggleAudio() {
        if (!this.audioTrack) {return;}
        this.setAudioState(!this.audioEnabled);
    }

    setAudioState(flag) {
        this.audioTrack.setEnabled(flag);
        this.audioEnabled = flag;
        this.setClass(this.elements.screen, !flag, "mute-audio");
    }

    closeTracks() {
        if (this.videoTrack || this.audioTrack) {
            const unpublish = [];
            if (this.videoTrack) {
                this.videoTrack.stop();
                this.videoTrack.close();
                unpublish.push(this.videoTrack);
            }
            if (this.audioTrack) {
                this.audioTrack.stop();
                this.audioTrack.close();
                unpublish.push(this.audioTrack);
            }
            this.client.unpublish(unpublish);
        }
    }

    detach() {
        super.detach();
        this.removeEventListeners();
        this.closeTracks();
        this.client.leave();
    }
}

function start(parent, _json, _persist) {
    parent.domId = "all";
    parent.setCode("broadcaster.BroadcasterModel");
    parent.setViewCode("broadcaster.BroadcasterView");
}

export const broadcaster = {
    expanders: [BroadcasterModel, BroadcasterView],
    functions: [start],
};
