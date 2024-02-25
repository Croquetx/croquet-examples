/* eslint-disable nonblock-statement-body-position */
/* global Croquet AgoraRTC */

AgoraRTC.Logger.setLogLevel(AgoraRTC.Logger.INFO);
AgoraRTC.Logger.enableLogUpload();

let isBackdrop = null;

class StreamMixerInput {
    // created for each local video source.  makes a
    // dedicated video element, and provides a draw()
    // method for drawing to the main canvas when
    // this source is online.
    constructor(stream, streamMixer) {
        this.stream = stream;
        this.streamMixer = streamMixer;

        if (stream.getVideoTracks().length) {
            this.alpha = 0;

            this.video = document.createElement('video');

            this.video.playsInline = true;
            this.video.muted = true;
            this.video.autoplay = true;

            this.video.onloadedmetadata = this.onloadedmetadata.bind(this);
            this.video.onplay = this.updateVideoSize.bind(this);
            this.video.onresize = this.onresize.bind(this);

            this.video.srcObject = stream;

            // this.video.play(); // no - let the streamMixer do it
            // document.addEventListener('click', () => this.video.play(), {once: true});

            window.setTimeout(this.updateVideoSize.bind(this, true), 1000);
        }
    }

    get width() { return this.video ? this.stream.getVideoTracks()[0].getSettings().width : undefined;}
    get height() { return this.video ? this.stream.getVideoTracks()[0].getSettings().height : undefined;}
    get aspectRatio() { return this.video ? this.width/this.height : undefined;}

    onloadedmetadata() {
        this.video.loadedmetadata = true;
        this.updateVideoSize(true);
    }
    onresize() {
        this.updateVideoSize();
    }

    updateVideoSize(updateStreamMixer = false) {
        this.video.width = this.width;
        this.video.height = this.height;

        if (updateStreamMixer || this.alpha === 1) {
            this.streamMixer.aspectRatio = this.aspectRatio;
        }
    }

    draw(canvas) {
        if (this.video && this.alpha > 0) {
            const context = canvas.getContext('2d');
            context.save();

            context.globalAlpha = this.alpha;
            context.drawImage(this.video, 0, 0, this.width, this.height, 0, 0, canvas.width, canvas.height);

            context.restore();
        }
    }

    remove() {
        if (this.video) {
            this.video.pause();
            this.video.srcObject = null;
        }
    }
}

class StreamMixer {
    // for selecting - and, if necessary, blending - the
    // video for our local stream.
    constructor(streamManager) {
        this.streamManager = streamManager;
        this.inputs = [];
        this.canvases = [];

        this.canvas = document.createElement('canvas');
        this.canvas.classList.add('peerVideo');
        this.canvas.width = 640;
        this.canvas.height = 480;
        this.canvasContext = this.canvas.getContext('2d');

        this.frameRate = 12;
        if (isBackdrop) {
            this.frameRate = 30;
        }
        this.canvasStream = this.canvas.captureStream(this.frameRate);
    }

    get filter() { return this.canvasContext.filter; }
    set filter(filter) { this.canvasContext.filter = filter; }

    get videoInputs() {return this.inputs.filter(input => input.video);}
    // get audioInputs() {return this.inputs.filter(input => input.audio);}

    getInputByStream(stream) {return this.inputs.find(input => input.stream === stream);}
    addStream(stream) {
        let input = this.getInputByStream(stream);
        if (!input) {
            input = new StreamMixerInput(stream, this);
            this.inputs.push(input);
            if (input.video) {
                input.video.play().catch(err => {
                    console.error(`video.play() failed`, err);
                    this.streamManager.chatManager.playBlocked(() => input.video.play());
                        });
            }
        }
        return input;
    }
    removeStream(stream) {
        const input = this.getInputByStream(stream);
        if (input) {
            input.remove();
            this.inputs.splice(this.inputs.indexOf(input), 1);
            return true;
        }
        return false;
    }

    get isDrawing() {return !!this.drawIntervalId;}
    startDrawing() {
        if (this.isDrawing) {
            this.stopDrawing(false);
        }

        this.drawIntervalId = window.setInterval(this.draw.bind(this), 1000/this.frameRate);
    }
    draw() {
        this.updateSize();

        const compositingCanvas = this.canvas;
        /* eslint-disable-next-line no-self-assign */
        compositingCanvas.width = compositingCanvas.width; // clear

        // draw all the video inputs onto the working canvas
        this.videoInputs.forEach(videoInput => videoInput.draw(compositingCanvas));

        // add the waveform
        this.streamManager.drawWaveform(compositingCanvas);

        // copy the working canvas image to each output canvas
        this.canvases.forEach(canvas => {
            /* eslint-disable-next-line no-self-assign */
            canvas.width = canvas.width; // clear

            const context = canvas.getContext('2d');
            context.drawImage(compositingCanvas, 0, 0);
        });
    }
    stopDrawing(clearCanvas = true) {
        if (this.isDrawing) {
            window.clearInterval(this.drawIntervalId);
            delete this.drawIntervalId;

            if (clearCanvas) {
                const compositingCanvas = this.canvas;
                /* eslint-disable-next-line no-self-assign */
                compositingCanvas.width = compositingCanvas.width; // clear

                this.canvases.forEach(canvas => {
                    /* eslint-disable-next-line no-self-assign */
                    canvas.width = canvas.width; // clear
                });
            }
        }
    }

    addOutputCanvas(canvas) {
        if (!this.canvases.includes(canvas)) {
            canvas.width = this.width;
            canvas.height = this.height;
            this.canvases.push(canvas);
        }
    }
    removeOutputCanvas(canvas) {
        if (this.canvases.includes(canvas))
            this.canvases.splice(this.canvases.indexOf(canvas), 1);
    }

    get width() {return this.canvas.width;}
    set width(width) {
        if (this.width === width || width === 0) return;

        this._width = width;
        this._height = width/this.aspectRatio;

        this._updateSize = true;
    }

    get height() {return this.canvas.height;}
    set height(height) {
        if (this.height === height || height === 0) return;

        this._height = height;
        this._width = height*this.aspectRatio;

        this._updateSize = true;
    }

    get aspectRatio() {return this.width/this.height;}
    set aspectRatio(aspectRatio) {
        if (this.aspectRatio === aspectRatio || aspectRatio === 0) return;

        if (aspectRatio > 1) {
            this._width = this.length;
            this._height = this._width/aspectRatio;
        }
        else {
            this._height = this.length;
            this._width = this._height*aspectRatio;
        }

        this._updateSize = true;
    }

    get length() {return Math.max(100, Math.max(this.width, this.height));}
    set length(length) {
        if (this.length === length || length === 0) return;

        if (this.aspectRatio > 1) {
            this._width = length;
            this._height = this._width/this.aspectRatio;
        }
        else {
            this._height = length;
            this._width = this._height*this.aspectRatio;
        }

        this._updateSize = true;
    }

    updateSize() {
        // @@ put back the isNaNs.  sort it out later.
        if (this._updateSize) {
            if (!isNaN(this._width)) {
                this.canvas.width = this._width;
                delete this._width;
            }

            if (!isNaN(this._height)) {
                this.canvas.height = this._height;
                delete this._height;
            }

            this.canvases.forEach(canvas => {
                canvas.width = this.width;
                canvas.height = this.height;
            });

            this._updateSize = false;

            this.canvas.dispatchEvent(new Event('resize'));
            this.canvases.forEach(canvas => canvas.dispatchEvent(new Event('resize')));
        }
    }

    setFrameRate(frameRate) {
        // we could check against the settings currently found in
        // the stream, rather than the constraint we requested.
        // but if that constraint has resulted in a different setting,
        // there might not be any point in trying to request the
        // same constraint again.
        if (this.frameRate === frameRate) return;

        this.frameRate = frameRate;
        this.canvasStream.getVideoTracks()[0].applyConstraints({frameRate});

        if (this.isDrawing)
            this.startDrawing();
    }

    _fade(stream, fadeIn = true, period = 500) {
        const currentAspectRatio = this.aspectRatio;

        return new Promise((resolve, _reject) => {
            const videoInput = this.getInputByStream(stream);
            if (videoInput && !videoInput._fade) {
                videoInput._fade = true;

                const newAspectRatio = videoInput.aspectRatio;

                const now = Date.now();
                const intervalId = setInterval(() => {
                    let interpolation = (Date.now() - now)/period;
                    interpolation = Math.min(interpolation, 1);

                    if (fadeIn && !isNaN(newAspectRatio) && !isNaN(currentAspectRatio)) {
                        const aspectRatio = (newAspectRatio * interpolation) + (currentAspectRatio * (1-interpolation));
                        this.aspectRatio = aspectRatio;
                    }

                    if (interpolation < 1) {
                        videoInput.alpha = fadeIn?
                            interpolation :
                            1-interpolation;
                    }
                    else {
                        videoInput.alpha = fadeIn? 1:0;
                        delete videoInput._fade;
                        clearInterval(intervalId);
                        resolve(stream);
                    }
                }, 1000/this.frameRate);
            }
            else
                resolve(stream);
        });
    }
    fadeIn(stream, period) {
        return this._fade(stream, true, period);
    }
    fadeOut(stream, period) {
        return this._fade(stream, false, period);
    }

    close() {
        this.stopDrawing();
        this.inputs.forEach(input => input.remove());
        this.canvasStream.getVideoTracks()[0].stop();
        this.canvases.length = 0;
    }

}

class AgoraPeerManager {
    constructor(chatManager) {
        this.chatManager = chatManager;
        this.viewId = this.chatManager.viewId;

        // @@@@ temporary hack
        this.elements = this.chatManager.elements;

        this.peerDict = {}; // streams and flags by viewId (including local)
        this.ensurePeerState(this.viewId); // get it over with :)
        this.isAwaitingPublishChange = false;
        this.connectionState = 'DISCONNECTED';

        // AGORA.IO CLIENT
        // this.appID = '150d223019864b108fc38c6f37612e79';
        this.appID = 'a4df6cd2da8445c393b56527eacf529a';

        // (sdk docs): In communication mode (mode set as rtc) ... all users [have role set to] host by default,
        // and setClientRole has no effect.
        this.client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

        // insert our own try/catch into the handlers, because otherwise
        // Agora will silently swallow any error
        const addHandler = (eventName, handlerName) => {
            this.client.on(eventName, data => {
                try {
                    this[handlerName](data);
                } catch (e) { console.error(e); }
                });
            };

        // CONNECTING, CONNECTED, DISCONNECTING, DISCONNECTED
        addHandler('connection-state-change', 'onConnectionStateChange');

        addHandler('client-role-changed', 'onClientRoleChanged');

        addHandler('peer-leave', 'onRemotePeerLeave'); // sent to remote clients when a client leaves the room

        // once a client is connected to channel, it can publish its stream to make it
        // available to other clients.  it can later unpublish.
        addHandler('stream-published', 'onLocalStreamPublished'); // sent to local client when stream is successfully published
        addHandler('stream-unpublished', 'onLocalStreamUnpublished'); // sent to local client

        addHandler('stream-added', 'onRemoteStreamAdded'); // sent to remote clients when stream is published (or with streams that had already been published when a new client joins)
        addHandler('stream-subscribed', 'onLocalSubscribeSuccess'); // sent to local client when subscription succeeds
        addHandler('stream-removed', 'onRemoteStreamRemoved'); // sent to remote clients when stream disappears - for example, is unpublished

        addHandler('stream-updated', 'onStreamUpdated');
        addHandler('stream-fallback', 'onStreamFallback');

        addHandler('mute-audio', 'onRemoteMuteAudio'); // sent to remote clients when audio is muted
        addHandler('unmute-audio', 'onRemoteUnmuteAudio'); // sent to remote clients when audio is unmuted

        addHandler('mute-video', 'onRemoteMuteVideo'); // sent to remote clients when video is muted
        addHandler('unmute-video', 'onRemoteUnmuteVideo'); // sent to remote clients when video is unmuted

        addHandler('network-quality', 'onNetworkQuality');
        addHandler('exception', 'onException');
    }

    peerState(viewId) { return this.peerDict[viewId]; }
    ensurePeerState(viewId) {
        let state = this.peerDict[viewId];
        if (!state) {
            // console.warn(`ensurePeerState ${viewId}`);
            // starting with muting set to true
            state = this.peerDict[viewId] = {
                published: false,
                agoraVideoMuted: true,
                agoraAudioMuted: true,
                lastAnnounce: Date.now()
                };
        }
        return state;
    }
    get localPeerState() { return this.peerState(this.viewId); }
    isKnownPeer(viewId) {
        const state = this.peerState(viewId);
        return !!(state && !state.left);
    }
    removePeerState(viewId) {
        delete this.peerDict[viewId];
    }
    setPeerLastAnnounce(viewId) {
        const state = this.ensurePeerState(viewId);
        state.lastAnnounce = Date.now();
    }
    getPeerIds() { return Object.keys(this.peerDict); }

    getPeerStream(viewId) {
        const state = this.peerState(viewId);
        return state && state.stream;
    }
    setPeerStream(viewId, stream) {
        const state = this.ensurePeerState(viewId);
        state.stream = stream;
    }

    initializeClient(streamSpec, videoTrack) {
        const onStreamInit = stream => {
            // jan 2021: stream can now be null
            if (stream) {
                if (streamSpec.video) {
                    stream.replaceTrack(videoTrack,
                        () => console.log(`setup of local video track succeeded`),
                        err => console.warn(`setup of local video track failed: ${err}`)
                        );
                }
                this.registerPeerStream(stream); // adds q_audioTrack and q_videoTrack methods
            }
            this.chatManager.chatStreamInitialized(stream);
            };

        const onClientInit = () => {
            const streamNeeded = streamSpec.audio || streamSpec.video;
            const stream = this.localStream = streamNeeded ? AgoraRTC.createStream(streamSpec) : null;
            if (stream) {
                stream.init(() => onStreamInit(stream), error => {
                    console.error("error from createStream", error);
                    throw error;
                    });
            } else onStreamInit(null);
            };

        this.client.init(this.appID, onClientInit, error => {
            console.error("error from client.init", error);
            throw error;
            });
    }

    registerPeerStream(stream) {
        const streamViewId = stream.getId();
        const knownStream = this.getPeerStream(streamViewId);
        if (knownStream && knownStream !== stream) {
            // got new stream from same peer.
            // tell chatManager to remove old one.
            this.chatManager.removePeerContainerStream(knownStream);
        }
        // add accessors just (to be going on with) to suppress
        // all the logging
        stream.q_audioTrack = function() { return this.stream && this.stream.getAudioTracks()[0]; };
        stream.q_audioEnabled = function() { return this.q_audioTrack() ? this.q_audioTrack().enabled : false; };
        stream.q_videoTrack = function() { return this.stream && this.stream.getVideoTracks()[0]; };
        stream.q_videoEnabled = function () { return this.q_videoTrack() ? this.q_videoTrack().enabled : false; };
        this.setPeerStream(streamViewId, stream);
    }
    unregisterPeerStream(stream) {
        const streamViewId = stream.getId();
        const state = this.peerDict[streamViewId];
        if (state) {
            delete state.stream;
            state.published = false;
        }
    }

    // LOCAL CHAT CONNECTION
    connect() {
        // invoked on clicking Join button when DISCONNECTED, or onPeerJoin for a remote
        // peer when this is DISCONNECTED, or on trigger by a setInterval after this
        // client has left the video chat on finding that it was the only remaining
        // croquet client.
        if (this.connectionState === 'DISCONNECTED' && this.chatManager.numberOfPeers > 1) {
            // NB: the null first arg is in place of a token, which Agora
            // supports for apps that need authentication of individual
            // clients.  i.e., we're using the "low security" approach.
            // https://docs.agora.io/en/Interactive%20Broadcast/API%20Reference/web/interfaces/agorartc.client.html#join
            // the channel-name arg can be up to 64 bytes.  most
            // punctuation is ok, but apparently not "/" or "\".
            this.client.join(null, sessionConfiguration.channelName, this.viewId,
                _viewId => {},
                err => console.error(err)
                );
        }
    }
    disconnect() {
        // invoked from shutDown, or chatManager.removePeer
        // if total number of peers has dropped to 1.
        if (this.connectionState === 'CONNECTED' || this.connectionState === "CONNECTING") {
            this.client.leave(() => console.log("left chat"), err => console.log(`Error on leaving chat: ${err}`));
        }
    }
    ensureConnected() {
        if (this.connectionState !== 'CONNECTED' && this.connectionState !== 'CONNECTING') {
            this.connect();
        }
    }
    ensureDisconnected() {
        if (this.connectionState !== 'DISCONNECTED' && this.connectionState !== 'DISCONNECTING') {
            this.disconnect();
        }
    }

    onConnectionStateChange(event) {
        this.connectionState = event.curState;
        let localState;
        switch (this.connectionState) {
            case 'DISCONNECTED':
                this.elements.ui.classList.remove('connected');
                this._stopVideoSessionTimestamp = Date.now();
                this.stopCheckingStreamPublishState();
                // if this is a shutdown, local state will have been cleared
                localState = this.localPeerState;
                if (localState) {
                    localState.published = false;
                    localState.left = true;
                }
                this.isAwaitingPublishChange = false;
                this.chatManager.onChatDisconnected();
                break;
            case 'CONNECTING':
                // after join() is called, or during Agora's automatic reconnect
                // attempt when connection is temporarily lost
                break;
            case 'CONNECTED':
                this.elements.ui.classList.add('connected');
                delete this._stopVideoSessionTimestamp;
                this._startVideoSessionTimestamp = Date.now();
                this.startCheckingStreamPublishState();
                // this.tmpStartPollingStreamState(); // high-frequency state checking
                this.chatManager.onChatConnected();
                break;
            default:
                break;
        }
    }

    tmpStartPollingStreamState() {
        this._tmpPollStreamStateIntervalId = window.setInterval(this.tmpPollStreamStates.bind(this), 25);
    }

    tmpPollStreamStates() {
        // look for changes in stream state.
        for (const [viewId, state] of Object.entries(this.peerDict)) {
            const { stream, agoraAudioMuted, agoraVideoMuted } = state;
            if (stream) {
                const audioTrack = stream.q_audioTrack();
                const videoTrack = stream.q_videoTrack();
                if (!audioTrack || !videoTrack) continue;
                const summary = {
                    agoraAudioMuted,
                    userMuteAudio: stream.userMuteAudio,
                    audioEnabled: audioTrack.enabled,
                    audioMuted: audioTrack.muted,
                    audioReady: audioTrack.readyState,
                    agoraVideoMuted,
                    userMuteVideo: stream.userMuteVideo,
                    videoEnabled: videoTrack.enabled,
                    videoMuted: videoTrack.muted,
                    videoReady: videoTrack.readyState
                    };
                const prev = stream.tmpState || {};
                const diffs = [];
                ['agoraAudioMuted', 'userMuteAudio', 'audioEnabled', 'audioMuted', 'audioReady', 'agoraVideoMuted', 'userMuteVideo', 'videoEnabled', 'videoMuted', 'videoReady'].forEach(prop => {
                    if (summary[prop] !== prev[prop]) {
                        diffs.push(`${prop}: ${prev[prop]===undefined ? "" : prev[prop] + " => "}${summary[prop]}`);
                    }
                });
                if (diffs.length) console.warn(`${viewId}  ${diffs.join(", ")}`);
                stream.tmpState = summary;
            }
        }
    }

    startCheckingStreamPublishState() {
        this.stopCheckingStreamPublishState();
        this._checkStreamPublishStateIntervalId = window.setInterval(this.checkStreamPublishState.bind(this), 1000);
    }
    stopCheckingStreamPublishState() {
        if (this._checkStreamPublishStateIntervalId) {
            window.clearInterval(this._checkStreamPublishStateIntervalId);
            delete this._checkStreamPublishStateIntervalId;
        }
    }

    hasContentToPublish() { return !this.localPeerState.agoraAudioMuted || !this.localPeerState.agoraVideoMuted; }
    checkStreamPublishState() {
        this.checkForInactivePeers();
        // don't need to pub/unpub if we're not in the chat
        if (this.connectionState !== 'CONNECTED') return;

        // wait for confirmation if we've changed publish state.
        if (this.isAwaitingPublishChange) return;

        if (this.hasContentToPublish()) this.ensureStreamPublished();
        else if (this.localPeerState.published) this.unpublishStream();
    }
    ensureStreamPublished() {
        if (this.connectionState !== 'CONNECTED') return;

        const nowPublished = this.localPeerState.published;
        if (!nowPublished) {
            console.log(`publish local stream`);
            this.isAwaitingPublishChange = true;
            this.client.publish(this.localStream, err => {
                console.error(err);
                this.isAwaitingPublishChange = false;
                });
        }
    }

    checkForInactivePeers() {
        this.getPeerIds().forEach(viewId => {
            // this is only to catch a peer that is not playing by
            // the normal rules (typically, a remnant caused by a
            // peer reloading with a different view id).  any peer
            // already recorded as having left, or that is currently
            // published, is not under suspicion.
            if (viewId === this.viewId) return;

            const state = this.peerDict[viewId];
            if (state.left || state.published) return;

            const seconds = Math.floor((Date.now() - state.lastAnnounce) / 1000);
            if (seconds >= 35) {
                console.warn(`${viewId} not heard from in ${seconds}s; assuming it has left chat`);
                state.left = true;
                // make the rest asynchronous
                Promise.resolve().then(() => {
                    if (state.stream) {
                        this.chatManager.offPeerStream(state.stream);
                        delete state.stream;
                    }
                    this.chatManager.provisionallyRemovePeer(viewId);
                    });
            }
        });
    }

    unpublishStream() {
        this.isAwaitingPublishChange = true;
        this.client.unpublish(this.localStream, err => {
            console.error(err);
            this.isAwaitingPublishChange = false;
            });
    }
    onLocalStreamPublished({ stream }) {
        // sent to local client when stream is published
        this.elements.ui.classList.add('published-stream');

const audioEnabled = stream.q_audioEnabled();
const videoEnabled = stream.q_videoEnabled();
console.log(`published stream ${stream.getId()} with audioEnabled=${audioEnabled}, videoEnabled=${videoEnabled}`);
        this.localPeerState.published = true;
        this.isAwaitingPublishChange = false;
    }
    onLocalStreamUnpublished(_event) {
        // sent to local client when stream is unpublished
        this.elements.ui.classList.remove('published-stream');

console.log("onLocalStreamUnpublished", _event);
        this.localPeerState.published = false;
        this.isAwaitingPublishChange = false;
        this.chatManager.chatStreamUnpublished();
    }

    onLocalSubscribeSuccess({ stream }) {
        // sent to local client when subscription to a remote
        // peer's stream is successfully set up
        const viewId = stream.getId();
        this.registerPeerStream(stream);
        const state = this.ensurePeerState(viewId);

        // anecdotally - at least, at the first moment of subscription:
        // if only audio is being sent, audio is enabled and video disabled.
        // if only video is being sent, both audio and video are enabled.

        // ...but this (at least the latter) could be down to Agora's
        // defaulting to "both enabled" unless told otherwise.

        // from https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack
        // enabled: A Boolean whose value is true if the track is enabled, that is allowed to render the media source stream; or false if it is disabled, that is not rendering the media source stream but silence and blackness. If the track has been disconnected, this value can be changed but has no more effect.
        // muted: Returns a Boolean value indicating whether the track is unable to provide media data due to a technical issue.
        // readyState: Returns an enumerated value giving the status of the track. This will be one of the following values:
        // "live" which indicates that an input is connected and does its best-effort in providing real-time data.  In that case, the output of data can be switched on or off using the enabled attribute.
        // "ended" which indicates that the input is not giving any more data and will never provide new data.

        // our recorded peer state reflects mute/unmute events that
        // have arrived.  in the case of a newly joining remote
        // peer, they can arrive before the peer's stream was published.
        // in the case of a peer that was already up and running when
        // the local peer joined, those events tend to arrive *after*
        // the publish.  given Agora's assumption that both video
        // and audio are enabled unless you hear otherwise, on initial
        // publish one would expect only to receive zero or one "mute"
        // events... but in fact "unmute" events are also seen.

        // for video only (it seems), both local and remote peer switching
        // between muted and unmuted is reflected in the "muted"
        // property, but only after a considerable delay (possibly
        // several seconds).

        const audioEnabled = stream.q_audioEnabled();
        const videoEnabled = stream.q_videoEnabled();
        console.log(`subscribed to ${stream.getId()} with audioEnabled=${audioEnabled}, videoEnabled=${videoEnabled}`);

        // if we haven't previously received an explicit audio mute
        // event, and audio appears to be enabled at this point,
        // tell the chatManager to act as if an unmute has now been
        // received.  ditto for video.
        // on the other hand, if video is *not* enabled on the stream,
        // we assume that it isn't going to be.  act as if a video
        // mute has been received.
        if (!state.agoraAudioMuted && audioEnabled) this.handleRemoteUnmuteAudio(viewId);
        if (!state.agoraVideoMuted) {
            if (videoEnabled) this.handleRemoteUnmuteVideo(viewId);
            else this.onRemoteMuteVideo({ uid: viewId }); // @@ minor hack
        }
        this.chatManager.onPeerStream(stream);
    }

    ensureAudioMuteState(stream, bool) {
        if (!stream.q_audioTrack()) return false;

        const wasMuted = stream.userMuteAudio;
        const wasEnabled = stream.q_audioEnabled();

        let success = true;
        if (wasMuted !== bool) {
            success = bool ? stream.muteAudio() : stream.unmuteAudio();
            // failure due to track not being enabled isn't worth reporting
            if (!success && wasEnabled)
                console.warn(`failed to ${bool ? "mute" : "unmute"} audio on ${stream.getId()}`);
        }

        if (success && stream === this.localStream) {
            this.localPeerState.agoraAudioMuted = bool;
            this.checkStreamPublishState();
        }

        return success;
    }
    ensureVideoMuteState(stream, bool) {
        if (!stream.q_videoTrack()) return false;

        // used on local stream to mute/unmute our video in the
        // call.
        // used on remote streams to switch the video track
        // between enabled (playing) and disabled.  if the track
        // is muted, enabling will fail - but the user's unmute
        // request will still be registered, and respected if the
        // track becomes unmuted.
        const wasMuted = stream.userMuteVideo;
        const wasEnabled = stream.q_videoEnabled();

        let success = true;
        if (wasMuted !== bool) {
            success = bool ? stream.muteVideo() : stream.unmuteVideo();
            if (!success && wasEnabled)
                console.warn(`failed to ${bool ? "mute" : "unmute"} video on ${stream.getId()}`);
        }

        if (success && stream === this.localStream) {
            this.localPeerState.agoraVideoMuted = bool;
            this.checkStreamPublishState();
        }

        return success;
    }

    onClientRoleChanged(event) {
        console.log("onClientRoleChanged", event);
    }

    // REMOTE PEER STATE
    onRemotePeerLeave(event) {
        // sent to remote peers when a peer leaves the room,
        // or its role changes from "host" to "audience".
        // in the latter case, the peer is still there; we
        // shouldn't remove its record.

        console.log("onRemotePeerLeave", event);
        const viewId = event.uid;
        const reason = event.reason; // "Quit", "ServerTimeOut", "BecomeAudience"

        const state = this.peerState(viewId);
        if (!state) {
            console.warn(`leaving ${viewId} record not found`);
            return;
        }

        const { stream, published, agoraAudioMuted, agoraVideoMuted } = state;

        // it's ok for there to be no stream - for a start,
        // the peer might never have published.
        if (stream) {
            this.chatManager.offPeerStream(stream);
            delete state.stream;
        }

        if (reason !== "BecomeAudience") {
            // no expectation that this peer will return
            // - but chatManager won't throw it out unless/until
            // the peer disappears from the Croquet session too.
            this.chatManager.provisionallyRemovePeer(viewId);
            state.left = true;
            return;
        }

        // peer is still there.  make sure our recorded state
        // is compatible with the audience role.
        if (published) {
            console.warn(`leaving ${viewId} was recorded as published`);
            state.published = false;
        }

        if (!agoraAudioMuted || !agoraVideoMuted) {
            console.warn(`leaving ${viewId} had agoraAudioMuted=${agoraAudioMuted}, agoraVideoMuted=${agoraVideoMuted}`);
            state.agoraAudioMuted = state.agoraVideoMuted = true;
        }
    }

    onRemoteStreamAdded({ stream }) {
        // sent to remote client when stream is available for subscription.
        // by default, both audio and video are assumed to be unmuted.
        // if either is actually muted at the source, an additional
        // mute-audio/mute-video event will be issued by Agora.
        // @@ in the case of joining a chat with already-published
        // peers, those mutes might arrive a second or two after
        // the stream; we should probably find a way to avoid the
        // jarring flash of unmuted (colour) video.

        // the audio and video tracks can't be accessed until
        // we have successfully subscribed to the stream.
        const viewId = stream.getId();
        const state = this.ensurePeerState(viewId);
        // start by assuming that both audio and video are available.
        // adjust later if necessary.
        state.agoraAudioMuted = state.agoraVideoMuted = false;
        state.published = true;
        delete state.left; // in case the peer went and came back

        this.client.subscribe(stream, err => console.error(err));
    }
    onRemoteStreamRemoved({ stream }) {
        // sent to remote client when stream is unpublished
        // (which does not imply that the client has left the room)

        // only difference from onRemotePeerLeave is that
        // we don't remove the client from the peer list.
        this.chatManager.offPeerStream(stream);
        this.unregisterPeerStream(stream); // includes setting published to false
    }

    onStreamUpdated({ stream }) {
        // in theory this is triggered by addTrack or
        // removeTrack.  we don't invoke either, but we
        // do mute/unmute audio and video, which might also
        // trigger??
        // NB: stream won't necessarily have been registered, getting
        // its q_audioTrack and q_videoTrack methods.
        console.log(`onStreamUpdated for ${stream.getId()}`);
    }

    onStreamFallback(_event) { console.warn("UNEXPECTED stream-fallback"); }

    onRemoteMuteAudio(event) {
        // a remote client's audio has been muted.
        // for this and all other mute/unmute events, we
        // haven't necessarily seen the stream for that
        // client yet, let alone subscribed to it.
        const viewId = event.uid;
// console.log(`onRemoteMuteAudio ${viewId}`);
        this.ensurePeerState(viewId).agoraAudioMuted = true;
        this.chatManager.onPeerMuteAudio(viewId);
    }
    onRemoteUnmuteAudio(event) {
        // a remote client's audio has been unmuted.
        const viewId = event.uid;
        this.ensurePeerState(viewId).agoraAudioMuted = false;
        this.handleRemoteUnmuteAudio(viewId);
    }
    handleRemoteUnmuteAudio(viewId) {
// console.log(`handleRemoteUnmuteAudio ${viewId}`);
        this.chatManager.onPeerUnmuteAudio(viewId);
    }

    onRemoteMuteVideo(event) {
        // a remote client's video has been muted.
        const viewId = event.uid;
// console.log(`onRemoteMuteVideo ${viewId}`);
        this.ensurePeerState(viewId).agoraVideoMuted = true;
        this.chatManager.onPeerMuteVideo(viewId);
    }
    onRemoteUnmuteVideo(event) {
        // a remote client's video has been unmuted.
        const viewId = event.uid;
        this.ensurePeerState(viewId).agoraVideoMuted = false;
        this.handleRemoteUnmuteVideo(viewId);
    }
    handleRemoteUnmuteVideo(viewId) {
// console.log(`handleRemoteUnmuteVideo ${viewId}`);
        this.chatManager.onPeerUnmuteVideo(viewId);
    }

    onNetworkQuality(_event) {
        // @@ allegedly an experimental feature.  _event has properties
        //  downlinkNetworkQuality, uplinkNetworkQuality
    }
    onException(event) {
        // @@ allegedly only supported for Chrome
        console.log(`Agora exception ${event.code} (${event.msg}) for ${event.uid}`);
    }

    shutDown() {
        this.stopCheckingStreamPublishState();

        Object.keys(this.peerDict).forEach(viewId => {
            const { stream } = this.peerDict[viewId];
            if (stream) {
                // chatManager takes care of removing the audio and video elements
                this.chatManager.offPeerStream(stream, true); // shutdown = true
                // now that the players are gone, we can safely stop the stream
                if (viewId !== this.viewId) stream.stop();
            }
            this.removePeerState(viewId);
        });

        this.disconnect();
    }
}

class LocalStreamManager {
    constructor(chatManager) {
        this.chatManager = chatManager;

        // @@ something of a hack
        this.elements = chatManager.elements;
        this.audioContext = chatManager.audioContext;

        this.audioAvailable = chatManager.localAudioAvailable;
        this.videoAvailable = chatManager.localVideoAvailable;
        this.localInputStreams = {}; // selected audio, selected video

        if (this.audioAvailable) {
            // create a gain node that is always
            // connected to an analyser to measure level (even if the
            // stream to the call is muted), and to testAudioNode for
            // listening to one's own mic.
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = 1;

            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 4096; // approx 85ms at 48k
            this.byteTimeDomainData = new Uint8Array(this.analyser.fftSize);
            this.gainNode.connect(this.analyser);

            this.testAudioNode = this.audioContext.createMediaStreamDestination();
            this.elements.localAudio.srcObject = this.testAudioNode.stream;
            this.gainNode.connect(this.testAudioNode);
            this.elements.localAudio.muted = true;

            // the audio-level test also watches for changes in document
            // visibility (to kick the local-feedback network back into
            // action after the doc is made visible again)
            this.docVisibility = document.visibilityState;
            this.startTestingAudioLevel();

            // WAVEFORM
            // currently set to take 20 samples to display 0.5s,
            // requiring a sample every 25ms.
            const config = this.waveformConfiguration = {
                period: 0.5,
                sampleCount: 20,
                waveform: [],
            };
            config.sampleInterval = 1000 * config.period / config.sampleCount;
        }

        // STREAM MIXER
        this.streamMixer = new StreamMixer(this);
    }

    // PEER INPUT STREAMS
    chatVideoSource() { return this.streamMixer.canvasStream.getVideoTracks()[0]; }

    async chatStreamInitialized(chatStream) {
        // jan 2021: chatStream can now be null

        // arrival here means that the Agora stream has successfully
        // started with either audio or video (or both) enabled,
        // implying that getUserMedia has been run and the user has
        // granted the required permissions.
        if (this.videoAvailable) await this.updateVideoInputs();
        if (this.audioAvailable) await this.updateAudioInputs();

        this.chatStream = chatStream;

        if (this.videoAvailable) {
            this.chatVideoTrack = chatStream.q_videoTrack(); // this never changes
            // await this.setVideoInput(); jan 2021: no need to do this here; if video is enabled at init, chatManager.chatStreamInitialized will invoke unmuteChatVideo which will set the video
        }

        if (this.audioAvailable) {
            await this.setAudioInput(); // includes setting chatAudioTrack

            // on Safari (at least), the audioContext doesn't start
            // in 'running' state.  it seems we can start it here, now
            // we have the user permissions.
            // when audio is not available, we still need an audioContext
            // for measuring other peers' streams.  this check is carried
            // out in chatManager.frobPlayHooks.
            const audioContext = this.audioContext;
            if (audioContext.state !== 'running' && audioContext.state !== 'closed')
                audioContext.resume();

            this.startWaveform();
        }
    }

    stopStream(stream) {
        if (!stream) return;
        stream.getTracks().forEach(track => track.stop());
    }

    stopAudioStream() {
        if (this.localInputStreams.audio) {
            this.stopStream(this.localInputStreams.audio);
            delete this.localInputStreams.audio;
        }

        if (this.localInputStreams.mediaStreamSource) {
            this.localInputStreams.mediaStreamSource.disconnect();
            delete this.localInputStreams.mediaStreamSource;
        }
    }

    stopVideoStream() {
        if (this.localInputStreams.video) {
            this.stopStream(this.localInputStreams.video);
            delete this.localInputStreams.video;
        }
    }

    onDeviceChange() {
        // a device has come or gone.  update the selectors.
        // ...unless we're still in the process of initialising
        // the Agora stream, which updates the inputs along
        // the way.
        if (!this.chatStream) return;

        if (this.videoAvailable) this.updateVideoInputs();
        if (this.audioAvailable) this.updateAudioInputs();
    }


    // VIDEO

    updateVideoInputs() {
        // refresh the video-selection list with all available built-in devices
        if (this._updateVideoInputsPromise) return this._updateVideoInputsPromise;

        const previousSelection = this.elements.videoInputs.selectedOptions[0];
        const previousLabel = (previousSelection && previousSelection.label)
            || (this.localInputStreams.video && this.localInputStreams.video._label)
            || sessionConfiguration.cameraDeviceLabel;
        let lookingForPrevious = !!previousLabel;
        let firstOption;

        const videoInputs = this.elements.videoInputs;
        videoInputs.innerHTML = '';
        const videoPlaceholderOption = document.createElement('optgroup');
        videoPlaceholderOption.disabled = true;
        videoPlaceholderOption.selected = false;
        videoPlaceholderOption.label = "Select Camera";
        videoInputs.appendChild(videoPlaceholderOption);

        const promise = this._updateVideoInputsPromise = new Promise(resolve => {
            AgoraRTC.getDevices(devices => {
                devices.filter(device => device.kind === 'videoinput').forEach(device => {
                    const { deviceId, label } = device;

                    // re-apply any earlier selection
                    const selected = lookingForPrevious && previousLabel === label;
                    if (selected) lookingForPrevious = false;

                    // (text, value, defaultSelected, selected)
                    const option = new Option(label, deviceId, selected, selected);
                    if (!firstOption) firstOption = option;

                    videoInputs.appendChild(option);
                });

                // if previous selection has gone, select the first entry
                if (lookingForPrevious && firstOption) {
                    console.warn(`previous device "${previousLabel}" is gone; switching to "${firstOption.label}"`);
                    videoInputs.value = firstOption.value;
                    if (this.chatStream) this.setVideoInput();
                }

                delete this._updateVideoInputsPromise;
                resolve();
                });
            }).catch(err => console.error("error in updateVideoInputs", err));

        return promise;
    }
    setVideoInput() {
        if (this._setVideoInputPromise)
            return this._setVideoInputPromise;

        const videoInputs = this.elements.videoInputs;
        const option = videoInputs.selectedOptions[0];
        const selectedId = option ? option.value : 'default';
        const selectedLabel = option ? option.label : '';

        const videoStream = this.localInputStreams.video;
        if (videoStream && videoStream._label === selectedLabel && videoStream.active) {
            console.log("video stream already matches selection");
            return Promise.resolve();
        }

        let currentStream = this.localInputStreams.video;
        if (currentStream && this.isMobile()) {
            // @@ what's special about mobile?
            this.stopStream(currentStream);
            this.streamMixer.removeStream(currentStream);
            delete this.localInputStreams.video;
            currentStream = null; // already dealt with
        }

        const promise = this._setVideoInputPromise = navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: selectedId,
                    frameRate: isBackdrop ? 30 : 12,
                    aspectRatio: 1.333,
                    width: 240,
                    height: 240 / 1.333,
                    resizeMode: "crop-and-scale",
                }
            }).then(stream => {
                this.localInputStreams.video = stream;

                const videoTrack = stream.getVideoTracks()[0];
                stream._label = videoTrack.label;
                videoTrack.onmute = () => {
                    console.log('video track muted itself');
                };
                videoTrack.onunmute = () => {
                    console.log('video track unmuted itself');
                };

                // if the system came back with a track that corresponds
                // to a different entry in the list, select that entry.
                const newOption = Array.from(videoInputs.options).find(opt => videoTrack.label === opt.label);
                if (newOption && newOption.value !== selectedId) {
                    console.warn(`system chose alternate option: "${newOption.label}" cf. requested "${selectedLabel}"`);
                    videoInputs.value = newOption.value;
                }

                // @@@ tighten this up.
                // Pixel has cameras with labels that (in English
                // locale, at least) include "facing front" or
                // "facing back".  but seems like a YMMV.
                // in principle, looks like we should be using facingMode
                // https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackSettings/facingMode
                this.isCameraFacingUser = !videoTrack.label.toLowerCase().includes('back');
                if (this.isCameraFacingUser)
                    this.elements.localVideoCanvas.dataset.isCameraFacingUser = this.isCameraFacingUser;
                else
                    delete this.elements.localVideoCanvas.dataset.isCameraFacingUser;

                const videoInput = this.streamMixer.addStream(stream);
                videoInput.video.addEventListener('loadedmetadata', _event => {
                    this.streamMixer.fadeIn(stream);

                    if (currentStream) {
                        this.streamMixer.fadeOut(currentStream)
                        .then(() => {
                            this.streamMixer.removeStream(currentStream);
                            this.stopStream(currentStream);
                        });
                    }

                    }, { once: true });

                if (videoInput.video.loadedmetadata) videoInput.video.dispatchEvent(new Event('loadedmetadata'));

                this.elements.toggleVideo.classList.remove('error');
            }).catch(err => {
                console.log("error in setVideoInput", err);
                this.elements.toggleVideo.classList.add('error');
                // throw err;
            }).finally(() => {
                delete this._setVideoInputPromise;
            });

        return promise;
    }


    // AUDIO
    updateAudioInputs() {
        // refresh the audio-selection list with all available built-in devices
        if (this._updateAudioInputsPromise) return this._updateAudioInputsPromise;

        const previousSelection = this.elements.audioInputs.selectedOptions[0];
        const previousLabel = (previousSelection && previousSelection.label)
            || (this.chatAudioTrack && this.chatAudioTrack.label)
            || sessionConfiguration.micDeviceLabel;
        let lookingForPrevious = !!previousLabel;
        let firstOption;

        const audioInputs = this.elements.audioInputs;
        audioInputs.innerHTML = '';
        const audioPlaceholderOption = document.createElement('optgroup');
        audioPlaceholderOption.disabled = true;
        audioPlaceholderOption.selected = false;
        audioPlaceholderOption.label = "Select Microphone";
        audioInputs.appendChild(audioPlaceholderOption);

        const promise = this._updateAudioInputsPromise = new Promise(resolve => {

            AgoraRTC.getDevices(devices => {
                devices.filter(device => device.kind === 'audioinput').forEach(device => {
                    const { deviceId, label } = device;

                    if (deviceId === 'default' || deviceId === 'communications') {
                        // console.log(`rejecting "default" device (${label})`);
                        return;
                    }

                    // re-apply any earlier selection
                    const selected = lookingForPrevious && previousLabel === label;
                    if (selected) lookingForPrevious = false;

                    // (text, value, defaultSelected, selected)
                    const option = new Option(label, deviceId, selected, selected);
                    if (!firstOption) firstOption = option;
                    audioInputs.appendChild(option);
                });

                // if previous selection has gone, select the first entry
                // and (if the chat stream is already running) force a
                // change to that device.
                if (lookingForPrevious && firstOption) {
                    console.warn(`previous device "${previousLabel}" is gone; switching to "${firstOption.label}"`);
                    audioInputs.value = firstOption.value;
                    if (this.chatStream) this.setAudioInput();
                }

                resolve();
                });
        }).then(() => delete this._updateAudioInputsPromise);

        return promise;
    }

    setAudioInput(force) {
        if (this._setAudioInputPromise)
            return this._setAudioInputPromise;

        const audioInputs = this.elements.audioInputs;
        const option = audioInputs.selectedOptions[0];
        if (!option) {
            console.warn("no audio selections available");
            return Promise.resolve();
        }

        const selectedId = option.value;
        const selectedLabel = option.label;

        const currentAudioTrack = this.chatAudioTrack;
        if (!force && currentAudioTrack && currentAudioTrack.label === selectedLabel && currentAudioTrack.readyState === 'live') {
            console.log("audio stream already matches selection");
            return Promise.resolve();
        }

        // how audio input works:

        // from the stream for the selected audio-input device
        // we extract the audioTrack and pass it to Agora using
        // stream.replaceTrack().  this is stored as chatAudioTrack.
        // from a clone of the stream we make a mediaStreamSource
        // (stored as this.localInputStreams.mediaStreamSource),
        // which is connected to the gainNode that was set up on
        // initialisation.  the gainNode is connected to a
        // mediaStreamDestination node for local feedback testing
        // (this.testAudioNode), and to an analyser for measuring
        // local audio level.

        // switching input device therefore involves
        //   - requesting a stream from the specified device
        //   - passing the audio track to Agora
        //   - stopping the stream (if any) supplying local feedback
        //   - making a mediaStreamSource from a clone of the new stream
        //   - connecting the mediaStreamSource to the long-lived gainNode

        // jan 2021: avoid re-running getUserMedia on iPad, because there
        // is only ever one audio input device, and a repeated getUserMedia
        // causes the device to be somehow silenced (though not obviously
        // muted, disabled, or ended).

        // https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
        let startPromise;
        const isIPad = navigator.userAgent.match(/\biPad\b/);
        const okToReplace = !isIPad;
        if (!okToReplace) {
            console.log(`not invoking getUserMedia`);
            startPromise = Promise.resolve(this.chatStream.stream);
        } else {
            console.log(`getUserMedia with device ID "${selectedId}"`);
            startPromise = navigator.mediaDevices.getUserMedia({ audio: { deviceId: selectedId } });
        }
        const promise = this._setAudioInputPromise = startPromise
            .then(stream => {
                const chatAudioTrack = stream.getAudioTracks()[0];
                if (!force && chatAudioTrack === this.chatAudioTrack) {
                    console.warn(`same audio track found; no replacement needed`);
                    return;
                }

                // clone the stream (and its tracks) before its
                // audio track is used for the outgoing Agora stream.
                const audioStreamClone = stream.clone();

                const onReplaceSuccess = () => {
                    if (okToReplace) console.log(`audio successfully replaced with ${chatAudioTrack.label}`);
                    this.chatAudioTrack = chatAudioTrack;
                    chatAudioTrack.onmute = () => {
                        console.log('audio track muted itself');
                        };
                    chatAudioTrack.onunmute = () => {
                        console.log('audio track unmuted itself');
                        };
                    chatAudioTrack.onended = _event => {
                        // if the track unexpectedly ends, it probably means
                        // that something in the host's audio settings has
                        // been changed or replaced.  force a refresh of
                        // the audio input.
                        console.warn("audio track ended");
                        this.setAudioInput(true); // force re-init
                        };

                    // replace the cloned stream that feeds the
                    // level meter and the feedback test
                    this.stopAudioStream(); // also disconnects mediaStreamSource, if any
                    this.localInputStreams.audio = audioStreamClone;
                    const mediaStreamSource = this.audioContext.createMediaStreamSource(audioStreamClone);
                    mediaStreamSource.connect(this.gainNode);
                    this.localInputStreams.mediaStreamSource = mediaStreamSource;
                    audioStreamClone.getAudioTracks()[0].onended = () => console.log(`local subsidiary audio track ended unexpectedly`);

                    this.elements.toggleAudio.classList.remove('error');
                    };

                const onReplaceFailure = err => {
                    audioStreamClone.stop();
                    throw Error(err);
                    };

                if (okToReplace) this.chatStream.replaceTrack(chatAudioTrack, onReplaceSuccess, onReplaceFailure);
                else onReplaceSuccess();
            }).catch(err => {
                console.warn(`replace audio failed for id ${selectedId}: ${err}`);
                this.elements.toggleAudio.classList.add('error');
            }).finally(() => {
                delete this._setAudioInputPromise;
            });

        return promise;
    }


    // WAVEFORM OVERLAID ON OUTGOING VIDEO
    isWaveformNeeded() {
        return this.chatAudioTrack && this.chatAudioTrack.enabled && this.chatVideoTrack && this.chatVideoTrack.enabled;
    }
    startWaveform() {
        this.stopWaveform();
        const config = this.waveformConfiguration;
        config.intervalId = window.setInterval(this.updateWaveform.bind(this), config.sampleInterval);
    }
    updateWaveform() {
        if (!this.isWaveformNeeded()) return;

        const config = this.waveformConfiguration;
        const audioLevel = this.chatStream.getAudioLevel(config.sampleInterval / 2); // grab existing measurement if recent enough
        config.waveform.push(audioLevel);
        if (config.waveform.length > config.sampleCount)
            config.waveform.shift();
    }
    stopWaveform() {
        const config = this.waveformConfiguration;
        if (config.intervalId) {
            config.waveform.fill(0);
            window.clearInterval(config.intervalId);
            delete config.intervalId;
        }
    }
    drawWaveform(canvas) {
        if (!this.isWaveformNeeded()) return;

        const config = this.waveformConfiguration;
        const waveform = config.waveform;

        const context = canvas.getContext('2d');
        context.save();

        context.fillStyle = sessionConfiguration.viewColor;

        const canvWidth = canvas.width;
        const canvHeight = canvas.height;

        const targetCenterX = canvWidth * 0.75;
        const targetCenterY = canvHeight * (1 - 0.2);
        const targetWidth = canvWidth / 3;
        const targetHeight = canvHeight * 0.15;

        let sampleWidth = targetWidth / waveform.length / 2;

        waveform.forEach((sample, sampleIndex) => {
            if (sample < 0.02) return; // don't plot negligible values

            const interpolation = (sampleIndex + 1) / waveform.length;

            const sampleHeight = sample * targetHeight * interpolation;
            const sampleX =  targetWidth * (1 - interpolation) / 2;
            const sampleY = sampleHeight / 2;

            context.globalAlpha = interpolation;

            if (interpolation === 1) {
                context.fillRect(targetCenterX - sampleWidth, targetCenterY - sampleY, sampleWidth * 2, sampleHeight);
            } else {
                context.fillRect(targetCenterX - sampleX, targetCenterY - sampleY, sampleWidth, sampleHeight);
                context.fillRect(targetCenterX + sampleX, targetCenterY - sampleY, sampleWidth, sampleHeight);
            }
        });
        context.restore();
    }

    startTestingAudioLevel() {
        this._testAudioInterval = 100;
        this._testAudioLevelIntervalId = window.setInterval(this.testAudioLevel.bind(this), this._testAudioInterval);
    }
    testAudioLevel() {
        // if the document has been hidden then made visible again,
        // force a renewal of the audio input stream (which Safari,
        // at least, will have interrupted on hide and doesn't
        // restore on unhide)
        const vis = document.visibilityState;
        if (vis !== this.docVisibility) {
            console.log(`document.visibilityState: ${vis}`);
            this.docVisibility = vis;
            if (vis === 'visible' && this.chatStream) {
                this.setAudioInput(true); // true => force
                return; // that's enough for this loop
            }
        }

        const audioLevel = this.getLocalAudioLevel();
        const now = Date.now();
        if (audioLevel > 0) {
            this.lastNonZeroAudio = now;
        } else if (this.lastNonZeroAudio && now - this.lastNonZeroAudio > 2000) {
            console.warn("audio signal has unexpectedly dropped to zero; track should reset itself in a few seconds");
            delete this.lastNonZeroAudio;
            return;
        }

        // no need to display audio level if the meter isn't on view.
        if (this.elements.ui.classList.contains('hide-settings') || !this.localInputStreams.audio) return;

        if (this._maxAudioLevelLongTerm === undefined || audioLevel > this._maxAudioLevelLongTerm) {
            this._maxAudioLevelLongTerm = audioLevel;
            window.clearTimeout(this._maxAudioLevelLongTermTimeoutId);
            this._maxAudioLevelLongTermTimeoutId = window.setTimeout(() => {
                delete this._maxAudioLevelLongTerm;
                delete this._maxAudioLevelLongTermTimeoutId;

                this.elements.loudnessMax.style.bottom = '';
                this.elements.loudnessMax.style.left = '';
                }, 1500);

            const { flexDirection } = getComputedStyle(this.elements.loudnessBar);
            if (flexDirection.includes('row')) {
                this.elements.loudnessMax.style.left = `${94 * audioLevel}%`;
                this.elements.loudnessMax.style.bottom = '-3px';
            } else {
                this.elements.loudnessMax.style.left = '-1px';
                this.elements.loudnessMax.style.bottom = `${94 * audioLevel}%`;
            }
        }

        if (this._maxAudioLevelShortTerm === undefined || audioLevel > this._maxAudioLevelShortTerm) {
            this._maxAudioLevelShortTerm = audioLevel;
            window.clearTimeout(this._maxAudioLevelShortTermTimeoutId);
            this._maxAudioLevelShortTermTimeoutId = window.setTimeout(() => {
                delete this._maxAudioLevelShortTerm;
                delete this._maxAudioLevelShortTermTimeoutId;

                this.elements.loudnessValue.style.flex = 0;
                this.elements.loudnessValue.style.backgroundColor = 'green';
            }, 100);

            this.elements.loudnessValue.style.flex = audioLevel;

            const color = `hsl(${120 * (1 - (audioLevel ** 2))}, 100%, 50%)`;

            this.elements.loudnessValue.style.backgroundColor = color;
        }
    }
    stopTestingAudioLevel() {
        if (this._testAudioLevelIntervalId) {
            window.clearInterval(this._testAudioLevelIntervalId);
            delete this._testAudioLevelIntervalId;
        }
    }
    getLocalAudioLevel() {
        const data = this.byteTimeDomainData;
        this.analyser.getByteTimeDomainData(data);
        // for efficiency, don't examine every sampled value.
        // examining one in 19 implies an inter-measurement
        // interval of 1000/(48000/19), approx 0.4ms.
        const numSamples = this.analyser.fftSize;
        let value, max = 0;
        for (let i = 0; i < numSamples; i += 19) {
            value = data[i];
            value = Math.abs(value - 128);
            max = Math.max(max, value);
        }
        max /= 128;
        return max;
    }

    isMobile() { return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent); }

    get canCaptureAudioStream() { return HTMLAudioElement.prototype.captureStream; }

    // Local Video Settings
    get frameRate() { return this.streamMixer.frameRate; }
    set frameRate(frameRate) {
        this.streamMixer.setFrameRate(frameRate);
    }

    get width() { return this.streamMixer.width; }
    set width(width) { this.streamMixer.width = width; }

    get height() { return this.streamMixer.height; }
    set height(height) { this.streamMixer.height = height; }

    get compositingCanvas() { return this.streamMixer.canvas; }
    addOutputCanvas(canvas) { this.streamMixer.addOutputCanvas(canvas); }
    removeOutputCanvas(canvas) { this.streamMixer.removeOutputCanvas(canvas); }

    // VIDEO STREAM EVENTS
    onStreamAccessAllowed(_event, _stream) { }
    onStreamAccessDenied(_event, _stream) { }

    onStreamStopScreenSharing(_event, _stream) { }

    onStreamVideoTrackEnded(_event, _stream) { }
    onStreamAudioTrackEnded(_event, _stream) { }

    onStreamPlayerStatusChange(_event, _stream) { }

    shutDown() {
        // sent on voluntary session leave
        if (this.audioAvailable) {
            this.stopWaveform();
            this.stopTestingAudioLevel();
        }
        this.audioContext.close(); // even though now held by ChatManager
        this.streamMixer.close();
    }
}

class ChatManager {
    constructor(viewId) {
        this.viewId = viewId;
        this.isCroquetOffline = false;
        this.deferredCroquetEvents = [];
        this.peerChecks = {};
        this.croquetPeerState = {}; // state from Croquet
        this.subscribedPeerStreams = [];
        this.solo = false;
        this.activePeer = null;
        this.playHooks = []; // list of functions for starting stalled media streams on user click

        // ELEMENTS
        this.elements = {
            ui: document.getElementById('ui'),

            toggleAudio: document.getElementById('toggleAudio'),
            toggleVideo: document.getElementById('toggleVideo'),

            localAudio: document.querySelector(`#local > audio`),

            toggleSolo: document.getElementById('toggleSolo'),
            toggleMicrophoneTest: document.getElementById('toggleMicrophoneTest'),

            videoInputs: document.getElementById('videoInputs'),
            audioInputs: document.getElementById('audioInputs'),

            loudness: document.querySelector('#loudness'),
            loudnessBar: document.querySelector('#loudness .bar'),
            loudnessMax: document.querySelector('#loudness .max'),
            loudnessValue: document.querySelector('#loudness .value'),

            activePeer: document.getElementById('activePeer'),
            activePeerVideo: document.querySelector('#activePeer video.video'),
            // activePeerMutePeer: document.querySelector('#activePeer .mutePeer'),
            localVideoCanvas: document.querySelector('#localVideoCanvas'),

            peersRaisingHands: document.querySelector('#peersRaisingHands'),
            peerRaisingHandTemplate: document.querySelector('#peerRaisingHandTemplate'),

            peers: document.getElementById('peers'),
            peerTemplate: document.getElementById('peerTemplate'),

            toggleHand: document.getElementById('toggleHand'),
        };

        // EVENTLISTENERS
        this.addEventListener(document, 'wheel', this.onWheel, {passive: false});
        this.addEventListener(document, 'mousedown', this.onMouseDown);
        this.addEventListener(document, 'mousemove', this.onMouseMove);
        this.addEventListener(document, 'mouseup', this.onMouseUp);

        // PROFILE BUTTONS
        this.addEventListener(this.elements.toggleAudio, 'click', this.onToggleAudioClick);
        this.addEventListener(this.elements.toggleVideo, 'click', this.onToggleVideoClick);
        // this.addEventListener(this.elements.toggleAudio, 'mouseover', this.showAudioTooltip);
        // this.addEventListener(this.elements.toggleVideo, 'mouseover', this.showVideoTooltip);

        // SETTINGS CONTROLS
        this.addEventListener(this.elements.toggleSolo, 'click', this.onToggleSoloClick);

        // this.addEventListener(this.elements.activePeer, 'click', this.onActivePeerClick);

        this.addEventListener(this.elements.toggleMicrophoneTest, 'click', this.onToggleMicrophoneTestClick);

        // MEDIA INPUT SELECTION
        this.addEventListener(navigator.mediaDevices, 'devicechange', this.ondevicechange);

        this.addEventListener(this.elements.videoInputs, 'input', this.onVideoInput);
        this.addEventListener(this.elements.audioInputs, 'input', this.onAudioInput);

        // ACTIVE PEER
        this.addEventListener(this.elements.activePeerVideo, 'play', this.updateActivePeerContainerStyle); // once the stream is playing, figure out its size
        this.addEventListener(this.elements.activePeerVideo, 'resize', this.updateActivePeerContainerStyle); // watch for changes in size, e.g. on auto-rotate of a mobile device
        // this.addEventListener(this.elements.activePeerMutePeer, 'click', () => this.mutePeer(this.getDisplayedActivePeer()));
        this.addEventListener(this.elements.activePeer, 'click', this.onPeerContainerClick);

        // RAISE HAND
        this.addEventListener(this.elements.toggleHand, 'click', this.onToggleHandClick);

        // RESIZE OBSERVER
        if (window.ResizeObserver) {
            this.resizeObserverConfiguration = {delay: 100, timestamp: Date.now()};
            this.resizeObserver = new ResizeObserver(this.resizeObserverCallback.bind(this));
            this.resizeObserver.observe(this.elements.activePeer);
            this.resizeObserver.observe(this.elements.peers);
        }
        else {
            console.warn("no ResizeObserver; reverting to listener");
            this.resizeConfiguration = {delay: 100, timestamp: Date.now(), timeoutId: undefined};
            this.addEventListener(window, 'resize', this.onResize);
        }

        // if running on a device that can change orientation, hook
        // into that.
        this.addEventListener(window, 'orientationchange', this.onOrientationChange);

        this.localAudioAvailable = sessionConfiguration.mic !== 'unavailable';
        if (!this.localAudioAvailable)
            this.elements.toggleAudio.classList.add('error');

        this.localVideoAvailable = sessionConfiguration.video !== 'unavailable';
        if (!this.localVideoAvailable)
            this.elements.toggleVideo.classList.add('error');

        this.audioContext = new (window.AudioContext || window.webkitAudioContext)(); // default sample rate of 48000

        this.localStreamManager = new LocalStreamManager(this);

        // NB: asking for the stream to have video and audio will
        // cause Safari (at least) to ask the user for permission
        // to access mic and camera - which a user who on the
        // landing page asked for both of them to be off will
        // presumably find surprising.
        // but it's easier to get it over with, in case the user
        // wants to send media later.
        this.chatPeerManager = new AgoraPeerManager(this);
        this.chatPeerManager.initializeClient({
            streamID: this.viewId,
            audio: this.localAudioAvailable,
            video: this.localVideoAvailable,
            }, this.localVideoAvailable && this.localStreamManager.chatVideoSource());

        this.elements.ui.classList.remove('published-stream');

        // every click anywhere in the app is used to attempt to
        // release any blocks that have been registered by calls to
        // playBlocked()
        this.addEventListener(document, 'click', this.frobPlayHooks);
    }

    setQChatView(viewOrNull) {
        this.qChatView = viewOrNull;
        const isOffline = this.isCroquetOffline = !viewOrNull;
        if (isOffline) {
            this.elements.ui.classList.add('croquet-offline');
        } else {
            this.elements.ui.classList.remove('croquet-offline');

            // if there is already a record for the local view, this
            // must be a reconnection
            if (this.isLocalPeerKnown) {
                console.log("local view already registered in chat manager");
                this.publishToSession('peer-stream-subscriptions', { viewId: this.viewId, subscribed: this.subscribedPeerStreams });

                // send any events that have been held back
                if (this.deferredCroquetEvents.length) {
                    this.deferredCroquetEvents.forEach(([event, data]) => {
                        this.publishToSession(event, data);
                    });
                    this.deferredCroquetEvents.length = 0;
                }
            }
        }
    }

    publishToSession(event, data) {
        if (this.isCroquetOffline) {
            this.deferredCroquetEvents.push([event, data]);
            return;
        }

        this.qChatView.publish(this.qChatView.sessionId, event, data);
    }

    setPeerStateFromModel(viewId, peerSnap) {
        // sent from setKnownPeers (when joining or rejoining a session)
        // and directly from onPeerDetails when a single new peer arrives.
        // it's the opportunity to record - or to update - all details that
        // the model currently has, including those that henceforth we'll
        // be hearing about through published events.

        // because we need to refer to peer details frequently - for example,
        // when the active peer changes - and because we want to be largely
        // independent from the Croquet model, ChatManager maintains a
        // copy of most state.  this includes the defining properties for
        // each peer:
        //   peerIndex, nickname, initials, viewColor, agent (user-agent string)
        // and also the ephemeral properties:
        //   raisingHand, subscribed, offline (although: raisingHand & offline are absent if false, and for remote views (only) we store just whether the remote is subscribed to this view)

        // note that the model ensures that the supplied state is a deep clone
        // of the model's record, so we can store and update it at will.
        // also that there is an array value for subscribed, even if not
        // yet in the model.
        console.log(`setPeerStateFromModel ${viewId}`, {...peerSnap});
        const { subscribed, ...peerState } = peerSnap;
        if (viewId !== this.viewId)
            peerState.subscribedToHere = subscribed.includes(this.viewId);

        const wasKnown = this.isPeerKnown(viewId);
        this.croquetPeerState[viewId] = peerState; // implicitly removes .offline, if there
        if (!wasKnown) {
            this.addPeer(viewId, peerState); // adds and styles peer container, sends onPeerHand, can trigger connection to chat
        } else {
            this.updatePeerDefiningProperties(viewId);
            this.onPeerHand({ viewId, raisingHand: peerState.raisingHand }); // includes updatePeerEphemeralProperties
        }

        if (viewId === this.viewId) {
            const uiClasses = this.elements.ui.classList;
            if (peerState.raisingHand) uiClasses.add('raisingHand');
            else uiClasses.remove('raisingHand');

            const localMuteImage = document.querySelector('#localMuteImage');
            localMuteImage.style.backgroundColor = peerState.viewColor;
        }
    }

    async chatStreamInitialized(stream) {
        // jan 2021: stream can now be null
console.warn(`chatStreamInitialized: we're ${this.viewId}; mic=${sessionConfiguration.mic} video=${sessionConfiguration.video}`);
        this.localChatStream = stream;

        await this.localStreamManager.chatStreamInitialized(stream);

        if (stream) {
            this.onPeerStream(stream);

            if (this.localAudioAvailable) {
                if ((sessionConfiguration.micSettingInChat || sessionConfiguration.mic) === 'on')
                    this.unmuteChatAudio();
                else {
                    this.muteChatAudio();
                }
            } else this.chatAudioMuted = "unavailable";

            if (this.localVideoAvailable) {
                if ((sessionConfiguration.videoSettingInChat || sessionConfiguration.video) === 'on')
                    this.unmuteChatVideo();
                else
                    this.muteChatVideo(true); // stop stream (so the camera light goes off)
            } else this.chatVideoMuted = "unavailable";
        }

        this.startRenderingPeerBorders();
    }

    onChatConnected() {
        // when this peer successfully joins the Agora chat.
        // allow a few seconds for things to settle.
        setTimeout(() => {
            this.startPollingForActivePeer();
            this.startAnnouncingStreamState();
            }, 4000);
    }

    onChatDisconnected() {
        // when this peer leaves the Agora chat
        this.stopPollingForActivePeer();
        this.stopAnnouncingStreamState();
    }

    chatStreamUnpublished() {
        // our own stream has been unpublished.
        // nothing to do.
    }

    getDisplayedActivePeer() { return this.elements.activePeer.dataset.viewId || null; }
    doWithRelevantContainers(viewId, fn) {
        if (this.isDisplayedActivePeer(viewId)) fn(this.elements.activePeer);

        const peerContainer = this.getPeerContainer(viewId);
        if (peerContainer) fn(peerContainer);
    }
    isDisplayedActivePeer(viewId) { return viewId === this.getDisplayedActivePeer(); }

    onOrientationChange() {
        setTimeout(() => this.doWithRelevantContainers(this.viewId, container => this.updatePeerContainerStyle(container)), 500);
    }

    onPeerStream(stream) {
        // sent from onStreamInit while setting up own stream,
        // and from onLocalSubscribeSuccess when the client
        // subscribes to an incoming stream.
        const viewId = stream.getId();

        // if it's a remote peer, make a record of our being
        // subscribed, and announce that (if we're not offline).
        if (viewId !== this.viewId) {
            const localSubscribed = this.subscribedPeerStreams;
            if (!localSubscribed.includes(viewId)) {
                localSubscribed.push(viewId);

                if (!this.isCroquetOffline) {
                    this.publishToSession('peer-stream-subscriptions', {
                        viewId: this.viewId,
                        subscribed: localSubscribed
                        });
                }
            }
        }

        // create a helper for measuring the audio level on
        // the stream.
        // on the local stream this is used to generate the waveform
        // that's superimposed on the outgoing video.
        // for remote peers it is used when the peer is unmuted
        // but hidden, to generate the flashing peer border.
        stream._croquetAudioHelper = {
            audioContext: this.audioContext,
            destroy() {
                if (this._destroy) return;

                if (this.mediaStreamSource)
                    this.mediaStreamSource.disconnect();

                if (this.analyser)
                    this.analyser.disconnect();

                this._destroy = true;
            },
            getMediaStreamSource() {
                // invoked on every call to stream.getAudioLevel.
                // make sure there is a mediaStreamSource (once
                // the stream has an audio track).
                if (this._destroy) return undefined;

                const audioContext = this.audioContext;

                // if the mSS exists but its audio track has disappeared
                // or has ended, remove it.  a new mSS will be created
                // if a new audio track turns up.
                let mss = this.mediaStreamSource;
                const mssAudio = mss && mss.mediaStream.getAudioTracks()[0];
                if (mss && (!mssAudio || mssAudio.readyState === 'ended')) {
                    mss.disconnect();
                    delete this.mediaStreamSource;
                    mss = null; // drop through
                }

                if (!mss && stream.q_audioTrack() && stream.q_audioTrack().readyState === 'live') {
                    if (!this.analyser) {
                        this.analyser = audioContext.createAnalyser();
                        this.analyser.fftSize = 4096; // approx 85ms at 48k
                        this.byteTimeDomainData = new Uint8Array(this.analyser.fftSize);
                    }
                    this.mediaStreamSource = audioContext.createMediaStreamSource(stream.stream);
                    this.mediaStreamSource.connect(this.analyser);
                }

                return this.mediaStreamSource;
            },
            getAudioLevel(maxAge) {
                // maxAge is an optional argument, to accept
                // a previously measured level if it was taken
                // no more than maxAge ms ago.
                if (maxAge && this.lastLevelTime && Date.now() - this.lastLevelTime <= maxAge) return this.lastLevel;

                let level = 0;
                if (this.getMediaStreamSource()) {
                    const data = this.byteTimeDomainData;
                    this.analyser.getByteTimeDomainData(data);
                    // for efficiency, don't examine every sampled value.
                    // examining one in 19 implies an inter-measurement
                    // interval of 1000/(48000/19), approx 0.4ms.
                    const numSamples = this.analyser.fftSize;
                    let value, max = 0;
                    for (let i = 0; i < numSamples; i += 19) {
                        value = data[i];
                        value = Math.abs(value - 128);
                        max = Math.max(max, value);
                    }
                    max /= 128;
                    level = max;
                }
                this.lastLevel = level;
                this.lastLevelTime = Date.now();
                return level;
            }
        };

        stream.getAudioLevel = function(maxAge) {
            return this._croquetAudioHelper.getAudioLevel(maxAge);
            };
        stream.getAudioLevel();

        // if view is in solo mode and this peer isn't on
        // display, tell the video not to play
        if (this.solo && viewId !== this.viewId && !this.isDisplayedActivePeer(viewId))
            this.ensureVideoMuteState(stream, true);

        this.attachPeerStream(stream);
    }

    offPeerStream(stream, shutdown=false) {
        // a stream has gone away.
        // sent from onRemotePeerLeave, onRemoteStreamRemoved, chatPeerManager.shutDown

        // how we handle this depends on whether the associated
        // client is still in the croquet session.
        // if the croquet client is known, but already flagged
        // as "offline", we go ahead and remove the peer.
        // if known and not offline, we just remove the stream
        // in the hope that a new one might come back.
        // if completely unknown, there's nothing to do but
        // clean up the stream itself.
        const viewId = stream.getId();
        if (stream._croquetDestroyed) {
            console.log(`already removed stream for ${viewId}`);
            return;
        }

        stream._croquetDestroyed = true;
        if (stream._croquetAudioHelper)
            stream._croquetAudioHelper.destroy();

        // remove the elements that were handling audio and video
        // for the stream
        this.removePeerContainerStream(stream);

        if (shutdown) return; // nothing more to do

        console.log(`offPeerStream for ${viewId}`);

        // if it's a remote peer, make a note of our being
        // unsubscribed, and publish (if we're not offline).
        if (viewId !== this.viewId) {
            const localSubscribed = this.subscribedPeerStreams;
            if (localSubscribed.includes(viewId)) {
                localSubscribed.splice(localSubscribed.indexOf(viewId), 1);

                if (!this.isCroquetOffline) {
                    this.publishToSession('peer-stream-subscriptions', {
                        viewId: this.viewId,
                        subscribed: localSubscribed
                        });
                }
            }
        }
    }

    onPeerHand({ viewId, raisingHand }) {
        if (!this.isPeerKnown(viewId)) return; // can happen if peer leaves before fully joining

        const peerState = this.croquetPeerState[viewId];
        if (raisingHand) {
            peerState.raisingHand = true;

            const { initials, viewColor } = peerState;
            const handContainer = this.elements.peerRaisingHandTemplate.content.cloneNode(true).querySelector('.peerRaisingHand');
            handContainer.dataset.viewId = viewId;
            handContainer.innerText = initials;
            handContainer.style.color = viewColor;
            this.elements.peersRaisingHands.appendChild(handContainer);

            this.elements.peersRaisingHands.classList.add('someHands');
        } else {
            delete peerState.raisingHand;

            document.querySelectorAll(`#peersRaisingHands .peerRaisingHand[data-view-id="${viewId}"]`).forEach(handContainer => handContainer.remove());

            if (this.filteredPeerIds(peer => peer.raisingHand).length === 0)
                this.elements.peersRaisingHands.classList.remove('someHands');
        }

        this.updatePeerEphemeralProperties(viewId);
    }

    playBlocked(unblocker, showWarning = true) {
        // when play() fails on a media element, add a warning that
        // the user needs to click to get things moving
        if (showWarning) this.elements.ui.classList.add('play-blocked');
        this.playHooks.push(unblocker);
    }
    frobPlayHooks() {
        // on Safari (at least), the audioContext doesn't start
        // in 'running' state.
        const audioContext = this.audioContext;
        if (audioContext.state !== 'running' && audioContext.state !== 'closed') {
            console.log("attempting to resume audioContext");
            audioContext.resume();
        }

        // only proceed if there are added hooks
        if (!this.playHooks.length) return;

        this.elements.ui.classList.remove('play-blocked'); // assume everything's going to be cleared.  hooks that fail will be added to the list again.

        const hooksClone = this.playHooks.slice();
        this.playHooks.length = 0;
        hooksClone.forEach(fn => {
            fn()
            .then(() => console.log(`play hook cleared`))
            .catch(err => {
                console.error(`play failed again`, err);
                this.playHooks.push(fn);
                this.elements.ui.classList.add('play-blocked');
                });
        });
    }

    onToggleHandClick(_event) {
        if (!this.isLocalPeerKnown) return;

        const uiClasses = this.elements.ui.classList;
        const raisingHand = !uiClasses.contains('raisingHand');
        if (raisingHand) uiClasses.add('raisingHand');
        else uiClasses.remove('raisingHand');

        this.publishToSession('peer-hand', { viewId: this.viewId, raisingHand });
    }

    onPeerContainerClick(event) {
        const viewId = event.currentTarget.dataset.viewId;
        const peerState = viewId && this.peerCombinedState(viewId);
        if (peerState) {
            const { nickname, agent } = peerState;
            console.log(`${nickname} is on ${agent}`);
        }
    }

    onActivePeerClick(_event) { }

    // PEERS
    onPeerIntendedState(data) {
        const { viewId } = data;
        if (viewId === this.viewId) return;

        this.chatPeerManager.setPeerLastAnnounce(viewId); // to keep the peer alive in checkForInactivePeers

        // if an Agora change has been received within the last
        // 500ms, ignore this event (since it might be based on
        // pre-change state).
        let peerCheck = this.peerChecks[viewId];
        if (peerCheck && peerCheck.ignoreUntil && peerCheck.ignoreUntil > Date.now()) return;

        if (!peerCheck) peerCheck = this.peerChecks[viewId] = {};
        else if (peerCheck.deferred) window.clearTimeout(peerCheck.deferred);

        // similarly, delay acting on the event for 500ms, in case
        // the corresponding Agora change is about to arrive
        peerCheck.deferred = window.setTimeout(() => this._checkPeerIntendedState(data), 500);
    }
    postponePeerCheck(viewId) {
        // when an Agora change arrives, ignore any Croquet event
        // from the last 500ms (which will have been set up as
        // deferred) and in the next 500ms.
        let peerCheck = this.peerChecks[viewId];
        if (!peerCheck) peerCheck = this.peerChecks[viewId] = {};

        if (peerCheck.deferred) {
            window.clearTimeout(peerCheck.deferred);
            delete peerCheck.deferred;
        }
        peerCheck.ignoreUntil = Date.now() + 500;
    }
    _checkPeerIntendedState({ viewId, audioMuted, videoMuted }) {
        delete this.peerChecks[viewId];

        if (!this.isPeerKnown(viewId) || !this.getPeerStream(viewId)) return;

        const peerState = this.peerCombinedState(viewId);
        if (audioMuted !== undefined) {
            const muted = !!audioMuted; // "unavailable" => true
            if (peerState.agoraAudioMuted !== muted) {
                console.warn(`${viewId} bringing audio into line with reported mute=${audioMuted}`);
                const dummyEvent = { uid: viewId };
                if (muted)
                    this.chatPeerManager.onRemoteMuteAudio(dummyEvent);
                else
                    this.chatPeerManager.onRemoteUnmuteAudio(dummyEvent);
            }
        }

        if (videoMuted !== undefined) {
            const muted = !!videoMuted;
            if (peerState.agoraVideoMuted !== muted) {
                console.warn(`${viewId} bringing video into line with reported mute=${videoMuted}`);
                const dummyEvent = { uid: viewId };
                if (muted)
                    this.chatPeerManager.onRemoteMuteVideo(dummyEvent);
                else
                    this.chatPeerManager.onRemoteUnmuteVideo(dummyEvent);
            }
        }
    }

    onPeerExit(viewId) {
        // view-side handling of croquet view-exit (which
        // should only be received for a remote view).
        // if the peer is still known to Agora, don't remove
        // its record but mark it as offline.  if the Agora
        // stream also disappears, that will then cause removal.
        if (viewId === this.viewId) throw Error("view-exit received for local view");

        if (this.isKnownChatPeer(viewId)) {
            console.warn(`peer exit: ${viewId} marked as offline`);
            const state = this.croquetPeerState[viewId];
            if (state) {
                state.offline = true;
                this.updatePeerEphemeralProperties(viewId);
            }
        } else {
            console.log(`peer exit: ${viewId} removed`);
            this.removePeer(viewId);
        }
    }

    addPeer(viewId, state) {
        // console.log(`addPeer ${viewId}`, state);
        this.appendPeerContainer(viewId);
        this.onPeerHand({ viewId, raisingHand: state.raisingHand });

        const numPeers = this.numberOfPeers;
        if (numPeers >= 2) {
            this.elements.ui.classList.remove('alone');
            this.chatPeerManager.ensureConnected();
        }

        if (numPeers < 3)
            this.setDefaultActivePeer();
    }

    provisionallyRemovePeer(viewId) {
        if (this.isPeerKnown(viewId)) {
            const state = this.peerCombinedState(viewId);
            if (state.offline) this.removePeer(viewId);
        }
    }

    removePeer(viewId) {
        // sent from provisionallyRemovePeer if the peer had
        // already disappeared from the croquet session, and
        // (complementarily) from onPeerExit if the Agora
        // manager believes the peer has left the chat.
        // remove the peer's croquetPeerState and its container,
        // and set a default active peer if needed.
        this.onPeerHand({ viewId, raisingHand: false });
        // delete the peer record before removing its container,
        // so the right number of peers are found for setting the
        // peers-region style.
        delete this.croquetPeerState[viewId];
        this.removePeerContainer(viewId);
        this.chatPeerManager.removePeerState(viewId);

        // if local peer is connected, but the number of peers has now been reduced to 1
        // (i.e., we're now alone), leave the video chat.  if other peers
        // turn up in due course, we'll connect again.
        const numPeers = this.numberOfPeers;
        if (numPeers === 1) {
            this.elements.ui.classList.add('alone');
            this.elements.ui.classList.remove('play-blocked');
            this.chatPeerManager.ensureDisconnected();
        }

        // if the removal of this peer takes the number of known peers
        // to 2, petition the model to set 'solo' mode.
        // ...and also if this is the last peer in the session, so that
        // when peers rejoin, the session is guaranteed to be in the
        // "normal" state of starting in solo mode.
        // ...except that if the last two peers leave at the same time,
        // and immediately after the third, their set-solo messages will
        // never be sent.  we now detect and fix that state in the model's
        // onChatPeerDetails, for the first peer to restart the session.
        if (numPeers < 3) {
            this.publishToSession('set-solo', true);
            this.setDefaultActivePeer();
        } else if (this.isDisplayedActivePeer(viewId)) {
            // it's the peer that was active that has gone away,
            // so put in a request to reset activePeer.
            // because this might be in a race with a
            // 'set-active-peer' nominating someone else,
            // use the explicit event 'remove-active-peer' with
            // the viewId as the argument.  the model will only
            // act if that viewId is still the active one.
            this.publishToSession('remove-active-peer', viewId);

        }

    }

    setDefaultActivePeer() {
        // sent when peers < 3 from addPeer, removePeer,
        // setKnownPeers
        const numPeers = this.numberOfPeers;
        if (numPeers === 1) this.setActivePeer(null);
        else if (numPeers === 2) {
            const peerStreamIds = this.knownPeerIds();
            const otherPeerViewId = peerStreamIds.find(viewId => viewId !== this.viewId);
            this.setActivePeer(otherPeerViewId);
        }
    }

    setKnownPeers(peerSnapDict) {
        // remove all raising-hand annotations (they'll be rebuilt from
        // the individual peers)
        const handsElement = this.elements.peersRaisingHands;
        handsElement.querySelectorAll('.peerRaisingHand').forEach(handContainer => handContainer.remove());
        handsElement.classList.remove('someHands');

        const peerIds = Object.keys(peerSnapDict);
        peerIds.forEach(vId => this.setPeerStateFromModel(vId, peerSnapDict[vId]));

        // remove peers that are no longer listed.
        // doing this *after* adding any previously unknown peers
        // from peerSnaps reduces the risk of triggering a spurious
        // drop into 'solo' mode.
        this.knownPeerIds().forEach(viewId => {
            if (!peerIds.includes(viewId)) this.removePeer(viewId);
        });

        if (this.numberOfPeers === 1) {
            this.elements.ui.classList.add('alone');
            this.elements.ui.classList.remove('play-blocked');
        }
        if (this.numberOfPeers < 3) this.setDefaultActivePeer();
    }

    knownPeerIds() {
        return Object.keys(this.croquetPeerState);
    }

    filteredPeerIds(fn) {
        const ids = [];
        this.knownPeerIds().forEach(viewId => {
            if (fn(this.peerCombinedState(viewId))) ids.push(viewId);
        });
        return ids;
    }

    get numberOfPeers() { return this.knownPeerIds().length; }
    isPeerKnown(viewId) { return !!this.croquetPeerState[viewId]; }
    peerCombinedState(viewId) { return { ...this.croquetPeerState[viewId], ...this.chatPeerManager.ensurePeerState(viewId) }; }
    get isLocalPeerKnown() { return this.isPeerKnown(this.viewId); }

    // RESIZE OBSERVER
    resizeObserverCallback(entries) {
        const now = Date.now();
        entries.forEach(entry => {
            const timestamp = entry.target.dataset.resizeObserverTimestamp || 0;
            const timeSinceLastInvocation = now - timestamp;

            if (entry.target.dataset.resizeObserverTimeoutId) {
                window.clearTimeout(entry.target.dataset.resizeObserverTimeoutId);
                delete entry.target.dataset.resizeObserverTimeoutId;
            }

            const delay = this.resizeObserverConfiguration.delay;
            if (timeSinceLastInvocation >= delay) {
                this._resizeObserverCallback(entry);
                entry.target.dataset.resizeObserverTimestamp = now;
            } else {
                const remainingDelay = delay - timeSinceLastInvocation;
                entry.target.dataset.resizeObserverTimeoutId = window.setTimeout(this.resizeObserverCallback.bind(this, [entry]), remainingDelay);
            }
        });
    }
    _resizeObserverCallback(entry) {
        switch (entry.target) {
            case this.elements.activePeer:
                this.updateActivePeerContainerStyle();
                break;
            case this.elements.peers:
                this.updatePeersContainerStyle();
                break;
            default:
                if (entry.target.classList.contains('peer')) {
                    this.updatePeerContainerStyle(entry.target);
                }
                break;
        }
    }

    onResize(_event) {
        // only called if browser provides no ResizeObserver
        const now = Date.now();
        const timeSinceLastInvocation = now - this.resizeConfiguration.timestamp;

        if (this.resizeConfiguration.timeoutId) {
            window.clearTimeout(this.resizeConfiguration.timeoutId);
            delete this.resizeConfiguration.timeoutId;
        }

        if (timeSinceLastInvocation >= this.resizeConfiguration.delay) {
            this._onResize();
            this.resizeConfiguration.timestamp = now;
        }
        else {
            const delay = this.resizeConfiguration.delay - timeSinceLastInvocation;
            this.resizeConfiguration.timeoutId = window.setTimeout(this.onResize.bind(this), delay);
        }
    }
    _onResize() {
        // @@ used to call updateActivePeerContainerStyle first,
        // but that seems backwards
        this.updatePeersContainerStyle();
        this.updateActivePeerContainerStyle();

        this.elements.peers.querySelectorAll('.peer').forEach(peerContainer => this.updatePeerContainerStyle(peerContainer));
    }


    // EVENTLISTENERS
    onWheel(event) { event.preventDefault(); }

    // @@ we could remove these intermediate methods
    onToggleAudioClick() { this.toggleAudio(); }
    onToggleVideoClick() { this.toggleVideo(); }
    onToggleSoloClick() { this.toggleSolo(); }
    onToggleMicrophoneTestClick(event) {
        if (event.shiftKey) {
            console.log("gathering logs from all peers...");
            this.publishToSession('gather-logs', { initiator: this.viewId, reason: 'debug' });
            return;
        }

        // don't allow mic testing if local audio is not available,
        // or if local stream hasn't been set up yet.
        if (!this.localAudioAvailable || !this.localChatStream) return;

        if (this.elements.ui.classList.contains('testing-microphone'))
            this.stopTestingMicrophone();
        else
            this.testMicrophone();
    }

    ondevicechange() {
        this.localStreamManager.onDeviceChange();
    }
    // new user selection
    onAudioInput() { if (this.localAudioAvailable) this.localStreamManager.setAudioInput(); }
    onVideoInput() { if (this.localVideoAvailable) this.localStreamManager.setVideoInput(); }

    // AUDIO, VIDEO
    toggleAudio() {
        if (!this.localChatStream || !this.isLocalPeerKnown || !this.localAudioAvailable) return;

        if (this.chatAudioMuted) {
            sessionConfiguration.micSettingInChat = 'on';
            this.unmuteChatAudio();
        } else {
            sessionConfiguration.micSettingInChat = 'off';
            this.muteChatAudio(); // keep the stream running (but empty)
        }
    }

    /*
   showAudioTooltip(){
        if (this.chatAudioMuted) {
            document.getElementById('toggleAudio').setAttribute('title', 'Unmute Mic');
        } else {
            document.getElementById('toggleAudio').setAttribute('title', 'Mute Mic');
        }
    }
    */

    muteChatAudio(stopStream) {
        this.chatAudioMuted = true;

        if (this.ensureAudioMuteState(this.localChatStream, true)) {
            console.log(`local audio muted; ${stopStream ? "also" : "not"} stopping stream`);

            this.onPeerMuteAudio(this.viewId);
            this.localStreamManager.streamMixer.canvasContext.filter = `grayscale(100%)`;
            this.elements.ui.classList.add('mute-audio');

            if (stopStream) this.localStreamManager.stopAudioStream();
        } else console.error("failed to mute local audio");
    }

    unmuteChatAudio() {
        this.chatAudioMuted = false;

        this.stopTestingMicrophone();

        if (this.ensureAudioMuteState(this.localChatStream, false)) {
            console.log("local audio unmuted");
            this.onPeerUnmuteAudio(this.viewId);
            this.localStreamManager.streamMixer.canvasContext.filter = `none`;
            this.elements.ui.classList.remove('mute-audio');
        } else console.error("failed to unmute local audio");
    }

    toggleVideo() {
        if (!this.localChatStream || !this.isLocalPeerKnown || !this.localVideoAvailable) return;
        if (this.chatVideoMuted) {
            sessionConfiguration.videoSettingInChat = 'on';
            this.unmuteChatVideo();
        } else {
            sessionConfiguration.videoSettingInChat = 'off';
            this.muteChatVideo(true); // also stop the stream
        }
    }

    /*
    showVideoTooltip(){
        if (this.chatVideoMuted) {
            document.getElementById('toggleVideo').setAttribute('title', 'Show Camera');
        } else {
            document.getElementById('toggleVideo').setAttribute('title', 'Hide Camera');
        }
    }
    */

    muteChatVideo(stopStream) {
        this.chatVideoMuted = true;

        if (this.ensureVideoMuteState(this.localChatStream, true)) {
            console.log(`local video muted; ${stopStream ? "also" : "not"} stopping stream`);

            this.onPeerMuteVideo(this.viewId);
            this.localStreamManager.streamMixer.stopDrawing(true); // true => clear
            this.elements.ui.classList.add('mute-video');

            if (stopStream) this.localStreamManager.stopVideoStream();
        } else console.error("failed to mute local video");
    }

    unmuteChatVideo() {
        this.chatVideoMuted = false;

        // for video (unlike audio) the input-setup step is needed,
        // because when the user toggles video off we also stop the
        // stream.
        this.localStreamManager.setVideoInput().then(() => {
            if (!this.chatVideoMuted) { // still what the user wants
                if (this.ensureVideoMuteState(this.localChatStream, false)) {
                    console.log("local video unmuted");
                    this.onPeerUnmuteVideo(this.viewId);
                    this.localStreamManager.streamMixer.startDrawing();
                    this.elements.ui.classList.remove('mute-video');
                } else console.error("failed to unmute local video");
            }
        }).catch(error => {
            console.error(error);
        });
    }

    startAnnouncingStreamState() {
        this._announceStreamStateIntervalId = window.setInterval(this.announceStreamState.bind(this), 3000);
    }
    stopAnnouncingStreamState() {
        if (this._announceStreamStateIntervalId) {
            window.clearInterval(this._announceStreamStateIntervalId);
            delete this._announceStreamStateIntervalId;
        }
    }
    announceStreamState() {
        // currently set to announce every 3s.
        // if not published, announce after at least 14s have passed
        // (i.e., typically after 15s).  a peer that doesn't hear
        // from us in 35s can assume that we've left the Agora
        // chat.  one case in which this is needed is for a peer that,
        // on rejoining, doesn't get any signal from Agora to say
        // that *its own* previous viewId is no longer in the chat.

        // don't try to announce if the Croquet session is offline.
        if (this.isCroquetOffline) return;

        const peerState = this.chatPeerManager.localPeerState;
        if (!peerState.published && peerState.lastAnnounce && Date.now() - peerState.lastAnnounce < 14000) return;

        this.chatPeerManager.setPeerLastAnnounce(this.viewId);
        this.publishToSession('peer-intended-state', { viewId: this.viewId, audioMuted: this.chatAudioMuted, videoMuted: this.chatVideoMuted });
    }

    // UI
    onMouseDown(_event) {
        if (this.elements.ui.classList.contains('solo')) return;

        // const {flexDirection} = getComputedStyle(this.elements.ui);
        if (this.elements.ui.classList.contains('resize'))
            this.elements.ui.classList.add('resizing');
        else
            this.elements.ui.classList.remove('resizing');
    }
    onMouseMove(event) {
        if (this.elements.ui.classList.contains('solo')) return;

        const {flexDirection} = getComputedStyle(this.elements.ui);

        if (flexDirection.includes('row')) {
            if (Math.abs(event.clientX - this.elements.peers.offsetWidth) < 15)
                this.elements.ui.classList.add('resize');
            else
                this.elements.ui.classList.remove('resize');
        }
        else if (Math.abs(event.clientY - this.elements.peers.offsetTop) < 15)
            this.elements.ui.classList.add('resize');
        else
            this.elements.ui.classList.remove('resize');

        if (this.elements.ui.classList.contains('resizing')) {
            if (flexDirection.includes('row')) {
                // const width = this.elements.peers.clientWidth + event.movementX;
                this.elements.peers.style.flexBasis = `${100*event.clientX/this.elements.ui.clientWidth}%`;
            }
            else {
                // const height = this.elements.peers.clientHeight - event.movementY;
                this.elements.peers.style.flexBasis = `${100*(this.elements.ui.clientHeight-event.clientY)/this.elements.ui.clientHeight}%`;
            }
        }
    }
    onMouseUp(_event) {this.elements.ui.classList.remove('resizing');}


    // SOLO
    toggleSolo() {
        this.publishToSession('set-solo', !this.solo);
    }

    onUpdateSolo(solo) {
        // handler for update-solo from model.  also invoked
        // directly when the chatManager is created or is
        // re-initialised from model state.
        if (this.solo === solo) return;

        this.solo = solo;

        let title = solo ? "Show Audience" : "Hide Audience";
        if (solo) {
            // solo mode.  local peer's video is always fed to
            // localVideoCanvas.
            // if local peer is not the active peer, that canvas
            // is shown as an inset.
            this.localStreamManager.addOutputCanvas(this.elements.localVideoCanvas);
            this.elements.ui.classList.add('solo');

            // given the current setting for active peer,
            // disable all videos that won't be on display.
            const activePeerId = this.getDisplayedActivePeer();
            this.knownPeerIds().forEach(viewId => {
                if (viewId !== this.viewId && viewId !== activePeerId) {
                    const stream = this.getPeerStream(viewId);
                    if (stream)
                        this.ensureVideoMuteState(stream, true);
                }
            });
            this.updateHiddenAudience();
        }
        else {
            // not solo mode.  if local peer is not the active peer,
            // disconnect its video from localVideoCanvas.
            if (!this.isDisplayedActivePeer(this.viewId))
                this.localStreamManager.removeOutputCanvas(this.elements.localVideoCanvas);
            this.elements.ui.classList.remove('solo');
            this.knownPeerIds().forEach(viewId => {
                if (viewId !== this.viewId) {
                    const stream = this.getPeerStream(viewId);
                    if (stream)
                        this.ensureVideoMuteState(stream, false);
                }
            });
            // force a recalculation of peers' size, because if the tab is
            // inactive there won't be a resize driven by the .solo setting
            this.updatePeersContainerStyle(); // includes updateHiddenAudience
        }
        this.elements.toggleSolo.setAttribute("title", title);
    }

    // TEST MICROPHONE
    testMicrophone() {
        if (this.elements.localAudio.paused)
            this.elements.localAudio.play();

        if (!this.chatAudioMuted) this.muteChatAudio();

        this.elements.localAudio.muted = false; // make it audible
        this.elements.ui.classList.add('testing-microphone');
    }
    stopTestingMicrophone() {
        this.elements.localAudio.muted = true; // silence, but don't remove
        this.elements.ui.classList.remove('testing-microphone');
    }


    // PEERS DISPLAY
    appendPeerContainer(viewId) {
// console.log(`appendPeerContainer for ${viewId}`);
        const peer = this.peerCombinedState(viewId);
        const peerContainer = this.elements.peerTemplate.content.cloneNode(true).querySelector('.peer');

        /*
        this.addEventListener(peerContainer.querySelector('.mutePeer'), 'click', _event => {
            this.mutePeer(viewId);
        });
        */
        this.addEventListener(peerContainer, 'click', this.onPeerContainerClick);

        if (this.resizeObserver)
            this.resizeObserver.observe(peerContainer);

        if (this.viewId === viewId)
            peerContainer.classList.add('self');

        peerContainer.dataset.viewId = viewId;
        peerContainer.id = `peer-${viewId}`;
        this.updatePeerDefiningStyle(peerContainer, peer);
        this.updatePeerEphemeralStyle(peerContainer, peer);

        this.elements.peers.appendChild(peerContainer);

        // if the Agora stream has already arrived, attach it
        const stream = this.getPeerStream(viewId);
        if (stream) this.attachPeerStream(stream);

        this.updatePeersContainerStyle();
        this.updatePeerContainerStyle(peerContainer);
    }
    getPeerContainer(viewId) {return this.elements.peers.querySelector(`.peer[data-view-id="${viewId}"]`);}
    removePeerContainer(viewId, shutdown=false) {
// console.log(`removePeerContainer for ${viewId}`);
        const peerContainer = this.getPeerContainer(viewId);
        if (peerContainer) {
            peerContainer.remove();
            if (this.resizeObserver)
                this.resizeObserver.unobserve(peerContainer);

            if (!shutdown) this.updatePeersContainerStyle();
        }
    }

    attachPeerStream(stream) {
        // @@ is this going to work whatever state the tab is in? (hidden, tabbed away etc)
        const viewId = stream.getId();
        const peerContainer = this.getPeerContainer(viewId);
        if (peerContainer) {
            peerContainer.stream = stream;
            if (this.viewId === viewId) {
                const compositingCanvas = this.localStreamManager.compositingCanvas;
                peerContainer.appendChild(compositingCanvas);
            } else {
                // Agora will put a div#player_<id> into the specified
                // element.
                stream.play(peerContainer.id, { fit: 'contain' }, error => {
                    const audio = peerContainer.querySelector('audio');
                    const video = peerContainer.querySelector('video');
                    // add handler for resize of the video - for example, when auto-rotating on a mobile device
                    if (video)
                        video.addEventListener('resize', () => this.updatePeerContainerStyle(peerContainer));

                    console.log(`status from stream.play() for ${viewId}:`, error);

                    // if playback succeeds, error is null
                    if (error) {
                        // https://docs.agora.io/en/Video/API%20Reference/web/interfaces/agorartc.streamplayerror.html
                        // status can be 'aborted' or 'paused'.
                        // 'aborted' supposedly means that the video and audio
                        // elements won't have been added (and that seems to
                        // be the case).
                        // otherwise, the error is something that
                        // has caused the elements to pause:
                        //   'stalled', 'pause', 'suspend', 'canplay', 'error'
                        if (error.status !== 'aborted') {
                            const statusStrings = [];
                            if (error.audio.isErrorState) {
                                statusStrings.push(`audio status=${error.audio.status}`);
                                if (audio) this.playBlocked(() => {
                                    audio.muted = false;
                                    // stream.getAudioLevel();
                                    return audio.play();
                                    });
                            }

                            if (error.video.isErrorState) {
                                statusStrings.push(`video status=${error.video.status}`);
                                if (video) this.playBlocked(() => video.play().then(() => this.updatePeerContainerStyle(peerContainer)));
                            }

                            const statusString = statusStrings.length ? statusStrings.join("; ") : `reason=${error.reason}`;
                            console.error(`stream play for ${viewId} temporarily failed: ${statusString}`);
                        } else {
                            console.warn(`stream play for ${viewId} aborted, reason: ${error.reason}`);
                        }
                    } else {
                        // everything's ready to rock
                        this.updatePeerContainerStyle(peerContainer);
                    }
                });
                if (this.isDisplayedActivePeer(viewId)) {
                    this.elements.activePeerVideo.srcObject = stream.stream;
                }
            }

            this.updatePeerEphemeralProperties(viewId); // in theory, might affect both peerContainer and activePeer
            this.updatePeerContainerStyle(peerContainer);
        }
    }
    removePeerContainerStream(stream) {
        // dispose of the DOM elements that were playing this stream,
        // but not the peer container they were in.  that will be
        // removed if and when the croquet client also disappears.
        const viewId = stream.getId();
        const peerContainer = this.getPeerContainer(viewId);
        if (peerContainer) {
            delete peerContainer.stream;
            // div#player_<viewId> is the structure added by
            // Agora, with video and audio child elements.
            const player = peerContainer.querySelector('[id*="player"]');
            if (player)
                player.remove();
        }
    }

    updatePeersContainerStyle() {
        // reformat to take account of addition or removal
        // of a peer container
        this.updateHiddenAudience();
        if (this.elements.ui.classList.contains('solo')) return;

        const peersElement = this.elements.peers;
        const {clientWidth, clientHeight} = peersElement;
        const aspectRatio = clientWidth/clientHeight;

        // const peerIds = this.knownPeerIds();
        // const peerContainers = peerIds.map(viewId => this.getPeerContainer(viewId));
        const numberOfPeers = this.numberOfPeers;

        let rows = 1;
        let columns = 1;

        while (numberOfPeers > rows*columns) {
            const aspectRatios = {
                row : Math.abs(aspectRatio - columns/(rows+1)),
                column : Math.abs(aspectRatio - (columns+1)/rows),
            };

            if (aspectRatios.row / aspectRatios.column < 1.33)
                rows++;
            else
                columns++;
        }

        // extremely wide or tall peer regions can lead to over-hasty
        // additions of columns bzw. rows.  see if one or the other can
        // be decreased without losing room for everyone.
        if (numberOfPeers) {
            if ((rows - 1) * columns >= numberOfPeers) rows--;
            else if ((columns - 1) * rows >= numberOfPeers) columns--;
        }

        const gridTemplateColumns = `repeat(${columns}, ${100/columns}%)`;
        const gridTemplateRows = `repeat(${rows}, ${100/rows}%)`;

        peersElement.style.gridTemplateRows = gridTemplateRows;
        peersElement.style.gridTemplateColumns = gridTemplateColumns;

        if (!window.ResizeObserver) {
            peersElement.querySelectorAll('.peer').forEach(peerContainer => this.updatePeerContainerStyle(peerContainer));
        }
    }
    updatePeerDefiningProperties(viewId) {
        const peerState = this.peerCombinedState(viewId);
        if (this.isDisplayedActivePeer(viewId))
            this.updatePeerDefiningStyle(this.elements.activePeer, peerState);

        const peerContainer = this.getPeerContainer(viewId);
        if (peerContainer) {
            this.updatePeerDefiningStyle(peerContainer, peerState);
        }
    }
    updatePeerDefiningStyle(element, peerState) {
        // set up either a peer container or the active-peer
        // element with the attributes needed to present the
        // supplied peer details.
        const { peerIndex, nickname, viewColor } = peerState;
        let abbreviated = nickname;
        if (nickname) {
            const pieces = nickname.split(" ").filter(p => p.length > 0);
            if (pieces.length > 1) {
                const lastInitial = pieces[pieces.length - 1][0].toUpperCase();
                abbreviated = `${pieces[0]} ${lastInitial}`;
            }
        }

        element.querySelector('.nickname').innerText = nickname;
        element.querySelector('.abbreviated').innerText = abbreviated;

        // set the background and the text colour to the user's
        // viewColor.  the CSS will selectively override these
        // depending on the mute-video state.
        const peerInfo = element.querySelector('.peerInfo');
        peerInfo.style.backgroundColor = viewColor;
        peerInfo.style.color = viewColor;
        const muteImage = element.querySelector('.muteImage');
        muteImage.style.backgroundColor = viewColor;

        if (element !== this.elements.activePeer)
            element.style.order = peerIndex;
    }
    updatePeerEphemeralProperties(viewId) {
        const peerState = this.peerCombinedState(viewId);
        if (this.isDisplayedActivePeer(viewId))
            this.updatePeerEphemeralStyle(this.elements.activePeer, peerState);

        const peerContainer = this.getPeerContainer(viewId);
        if (peerContainer) {
            this.updatePeerEphemeralStyle(peerContainer, peerState);
        }
    }
    updatePeerEphemeralStyle(element, peerState) {
        // set up either a peer container or the active-peer
        // element with the attributes needed to present the
        // supplied peer details.
        [
            ['agoraVideoMuted', 'mute-video'],
            ['agoraAudioMuted', 'mute-audio'],
            ['published', 'published-stream'],
            ['raisingHand', 'raisingHand'],
            ['subscribedToHere', 'received-stream'],
            ['offline', 'offline']
        ].forEach(([property, attribute]) => {
            if (peerState[property])
                element.classList.add(attribute);
            else
                element.classList.remove(attribute);
        });
    }
    updatePeerContainerStyle(peerContainer) {
        // adjust the peer container to account for the aspect
        // ratios of the container and of the video.

        // called from appendPeerContainer, attachPeerStream,
        // updateActivePeerContainerStyle, _resizeObserverCallback,
        // onPeerMuteVideo, onPeerUnmuteVideo,
        // and from updatePeersContainerStyle and onResize iff no
        // ResizeObserver present.

        // we rely on various tricks to coerce css into sizing and
        // placing the peerInfo element (rather than use JavaScript,
        // which inevitably leads to jumpiness).

        // we use the automatic resizing of a canvas
        // element styled with height=100% to determine the
        // estimated video width.
        // https://stackoverflow.com/questions/6148012/setting-element-width-based-on-height-via-css

        // when the peer container is tall, we used to use the
        // padding-bottom trick to set the peerInfoSizer element
        // height to that appropriate for the video aspect ratio.
        // https://stackoverflow.com/questions/1495407/maintain-the-aspect-ratio-of-a-div-with-css
        // ...but that didn't work on Safari or Firefox,
        // so now we try to do everything with canvas resizing.

        const viewId = peerContainer.dataset.viewId;
        const aspectRatio = ((viewId && !this.peerCombinedState(viewId).agoraVideoMuted) ? this.updatePeerContainerVideo(peerContainer) : null) || 1.333; // if video isn't ready, assume the most common aspect ratio
        const { clientWidth, clientHeight } = peerContainer;
        const peerInfo = peerContainer.querySelector('.peerInfo');
        peerInfo.style.fontSize = `${Math.round(Math.max(11, Math.min(18, clientWidth / 20)))}px`;

        if (clientWidth / clientHeight >= aspectRatio)
            peerContainer.classList.add('wide');
        else
            peerContainer.classList.remove('wide');

        const templateCanvas = peerContainer.querySelector('.templateCanvas');
        // keep height at 100.  set width based on aspect ratio.
        templateCanvas.width = Math.round(aspectRatio * 100);
    }
    updatePeerContainerVideo(peerContainer) {
        // returns the video's aspect ratio, if available.

        // if this container is showing self, there is no relevant
        // video element.  ask the streamMixer for the current
        // aspect ratio (which could still be undefined).
        if (peerContainer.classList.contains('self'))
            return this.localStreamManager.streamMixer.aspectRatio;

        const video = peerContainer.querySelector('video');
        const videoTrack = video && video.srcObject && video.srcObject.getVideoTracks()[0];
        if (videoTrack) {
            const { width, height } = videoTrack.getSettings();
            // width and height can be undefined
            if (width && height) {
                video.width = width;
                video.height = height;
                return width / height;
            }
        }
        return null;
    }

    onPeerMuteAudio(viewId) {
        this.postponePeerCheck(viewId);
        if (!this.isPeerKnown(viewId)) return;
console.log(`onPeerMuteAudio ${viewId}`);
        this.updatePeerEphemeralProperties(viewId);
    }
    onPeerUnmuteAudio(viewId) {
        this.postponePeerCheck(viewId);
        if (!this.isPeerKnown(viewId)) return;
console.log(`onPeerUnmuteAudio ${viewId}`);
        this.updatePeerEphemeralProperties(viewId);
    }

    onPeerMuteVideo(viewId) {
        this.postponePeerCheck(viewId);
        if (!this.isPeerKnown(viewId)) return;
console.log(`onPeerMuteVideo ${viewId}`);
        this.updatePeerEphemeralProperties(viewId);
        const peerContainer = this.getPeerContainer(viewId);
        if (peerContainer) this.updatePeerContainerStyle(peerContainer);
    }
    onPeerUnmuteVideo(viewId) {
        this.postponePeerCheck(viewId);
        if (!this.isPeerKnown(viewId)) return;
console.log(`onPeerUnmuteVideo ${viewId}`);
        this.updatePeerEphemeralProperties(viewId);

        // if this peer's stream has already been received,
        // pipe it to the active-peer view if necessary.
        // if the stream isn't known yet, attachPeerStream
        // will do the job when the stream arrives.
        if (viewId !== this.viewId) {
            const stream = this.getPeerStream(viewId);
            if (stream) {
                if (this.isDisplayedActivePeer(viewId))
                    this.elements.activePeerVideo.srcObject = stream.stream;
            } else console.warn(`peer stream for ${viewId} not available yet`);
        }

        const peerContainer = this.getPeerContainer(viewId);
        if (peerContainer) this.updatePeerContainerStyle(peerContainer);
    }

    mutePeer(viewId) {
        if (true) return; // @@ disabled, for now

        if (viewId) this.publishToSession('mute-peer-audio', viewId);
    }

    startRenderingPeerBorders() {
        this.stopRenderingPeerBorders();
        // peer borders currently rendered every 80ms.
        // when our stream analysers have buffers of 4096 samples,
        // they hold around 85ms at 48000 samples/sec.
        this._renderPeerBordersInterval = 80;
        this._renderPeerBordersIntervalId = window.setInterval(this.renderPeerBorders.bind(this), this._renderPeerBordersInterval);
    }
    renderPeerBorders() {
        const thisPeerId = this.viewId;
        const activePeerId = this.getDisplayedActivePeer();
        const thisIsActive = thisPeerId === activePeerId;
        let peerIds = [];
        if (this.solo) {
            const addIfRelevant = peerId => {
                if (!this.isPeerKnown(peerId)) return;

                const peer = this.peerCombinedState(peerId);
                if (peer.published && peer.agoraVideoMuted && !peer.agoraAudioMuted)
                    peerIds.push(peerId);
                };
            if (activePeerId) addIfRelevant(activePeerId);
            if (!thisIsActive) addIfRelevant(thisPeerId);
        } else {
            peerIds = this.filteredPeerIds(peer => peer.published && peer.agoraVideoMuted && !peer.agoraAudioMuted);
        }

        if (peerIds.length) {
            const MAX_PORTION = 0.2;
            const addShadow = (element, level, color) => {
                const minLength = Math.min(element.clientWidth, element.clientHeight);
                element.style.boxShadow = `inset 0px 0px ${level * minLength * MAX_PORTION}px ${level * minLength * MAX_PORTION}px ${color}`;
                };

            this.elements.ui.classList.add('renderingPeerBorders');

            peerIds.forEach(viewId => {
                const stream = this.getPeerStream(viewId);
                if (stream) {
                    const audioLevel = stream.getAudioLevel(this._renderPeerBordersInterval / 2); // grab existing value if recent enough
                    const viewColor = this.peerCombinedState(viewId).viewColor;

                    // if it's the active peer, mark the activePeer element
                    if (viewId === activePeerId)
                        addShadow(this.elements.activePeer.querySelector('.peerInfoSizer'), audioLevel, viewColor);

                    if (!this.solo) {
                        // if a peerContainer is visible, mark that
                        const peerContainer = this.getPeerContainer(viewId);
                        if (peerContainer)
                            addShadow(peerContainer.querySelector('.peerInfoSizer'), audioLevel, viewColor);
                    } else if (viewId === thisPeerId && !thisIsActive) {
                        // in solo with this peer as an inset, mark that -
                        // but boost the apparent level since the canvas
                        // is so small.
                        addShadow(this.elements.localVideoCanvas, Math.min(1, audioLevel*3), viewColor);
                    }
                }
            });
        } else {
            this.elements.ui.classList.remove('renderingPeerBorders');
        }
    }
    stopRenderingPeerBorders() {
        if (this._renderPeerBordersIntervalId) {
            this.elements.ui.classList.remove('renderingPeerBorders');
            window.clearInterval(this._renderPeerBordersIntervalId);
            delete this._renderPeerBordersIntervalId;
        }
    }

    onPeerStreamPublished(viewId) {
        // remote peer has published its stream
        const peerContainer = this.getPeerContainer(viewId);
        if (peerContainer)
            peerContainer.classList.add('published-stream');
    }

    // onPeerStreamUnpublished(viewId) { }

    onPeerStreamSubscriptions({viewId, subscribed}) {
        if (viewId === this.viewId) return;

        // a remote peer is reporting the streams that it is
        // currently subscribed to.  take a note of whether
        // this view is among those listed.
        const peerState = this.croquetPeerState[viewId];
        if (peerState) {
            const wasSubscribed = peerState.subscribedToHere;
            const isSubscribed = subscribed.includes(this.viewId);
            if (wasSubscribed !== isSubscribed) {
// console.log(`${viewId} is ${isSubscribed ? "" : "not "}subscribed to here`);
                peerState.subscribedToHere = isSubscribed;
                this.updatePeerEphemeralProperties(viewId);
            }
        }
    }


    // ACTIVE PEER
    startPollingForActivePeer() {
        this._pollForActivePeerIntervalId = window.setInterval(this.pollForActivePeer.bind(this), 200);
    }
    pollForActivePeer() {
        const localPeer = this.peerCombinedState(this.viewId);

        // nothing to do if
        //   this peer is offline, or
        //   there are fewer than 3 clients in the session, or
        //   this peer is not published, or
        //   recently requested to be the active peer, or
        //   is currently the displayed active peer
        if (this.isCroquetOffline || this.numberOfPeers < 3 || !localPeer.published || (this._lastRequestToBeActivePeer && Date.now() - this._lastRequestToBeActivePeer < 1500) || this.isDisplayedActivePeer(this.viewId)) return;

        let request = false;

        // if this is the only published peer, request.
        // note that if a newly published peer requests to be
        // active (e.g., being the only unmuted one), Croquet's
        // update-active-peer event is likely to arrive before
        // Agora's stream-added.  so we count the current
        // active peer as being published, even if its state
        // hasn't been updated yet.
        if (this.filteredPeerIds(peer => peer.published).length === 1 && !this.getDisplayedActivePeer())
            request = "only peer published"; // (we've already confirmed localPeer.published)

        // otherwise, bail out if muted
        else if (localPeer.agoraAudioMuted) return;

        // not muted - so if this is the only unmuted peer, request
        else if (this.filteredPeerIds(peer => !peer.agoraAudioMuted).length === 1)
            request = "only peer unmuted";

        // or iff level is high enough
        else {
            const audioLevel = this.localChatStream.getAudioLevel();
            if (audioLevel > 0.3) request = `audio level=${audioLevel}`;
        }

        if (request) {
            console.log(`requesting to be active: ${request}`);
            this.requestToBeActivePeer();
        }
    }
    requestToBeActivePeer() {
        this._lastRequestToBeActivePeer = Date.now();
        this.publishToSession('set-active-peer', this.viewId);
    }
    stopPollingForActivePeer() {
        if (this._pollForActivePeerIntervalId) {
            window.clearInterval(this._pollForActivePeerIntervalId);
            delete this._pollForActivePeerIntervalId;
        }
    }

    onUpdateActivePeer(activePeerId) {
        // an active-peer request will only be sent if there are
        // 3 or more peers in the session.  if the number of peers
        // happens to have dropped below 3 by the time the message
        // arrives, we must ignore it.  the active peer will have
        // been set by setDefaultActivePeer.
        if (this.numberOfPeers >= 3) this.setActivePeer(activePeerId);
    }

    setActivePeer(activePeerId) {
        // called from setDefaultActivePeer (when < 3 peers);
        // from removePeer when the removed peer was the active;
        // from the QChatView on setup (when >= 3 peers);
        // and in response to 'update-active-peer' from the model,
        // again if >= 3 peers.
        // activePeerId can be null.
        if (activePeerId && !this.isPeerKnown(activePeerId)) {
            console.error(`setActivePeer for unknown ${activePeerId}`);
            return;
        }

        if (activePeerId === this.getDisplayedActivePeer()) return; // a duplicate request

        this.elements.activePeer.querySelector('.peerInfoSizer').style.boxShadow = '';

        const peerDescription = activePeerId ? ` (${activePeerId === this.viewId ? "me" : "not me"})` : "";
console.log(`active peer=${activePeerId}${peerDescription} numPeers=${this.numberOfPeers}`);

        if (activePeerId) {
            this.elements.activePeer.dataset.viewId = activePeerId;

            const peerState = this.peerCombinedState(activePeerId);
            this.updatePeerDefiningStyle(this.elements.activePeer, peerState);
            this.updatePeerEphemeralStyle(this.elements.activePeer, peerState);

            const stream = this.getPeerStream(activePeerId); // if it's there
            let outgoingVideoWidth = 480, outgoingFrameRate = 12; // unless told otherwise

            if (isBackdrop) {
                outgoingFrameRate = 30;
                outgoingVideoWidth = 1280;
            }

            if (activePeerId === this.viewId) {
                this.elements.activePeer.classList.add('self');
                this.elements.activePeerVideo.srcObject = null;

                // in solo mode, the local peer always feeds
                // localVideoCanvas.

                // in solo mode with 2 or fewer peers, the local peer
                // is never selected as active (i.e., we don't get here).

                // in solo mode with > 2 peers, localVideoCanvas appears
                // full size when local peer is active, otherwise
                // as an inset.

                // in non-solo mode, localVideoCanvas never appears as an
                // inset, and the local peer feeds it only when it is the
                // active peer.
                if (!this.solo) {
                    this.localStreamManager.addOutputCanvas(this.elements.localVideoCanvas);
                }
            } else {
                this.elements.activePeer.classList.remove('self');

                if (stream) {
                    this.elements.activePeerVideo.srcObject = stream.stream;
                    this.ensureVideoMuteState(stream, false);
                } else {
                    // the incoming peer's stream apparently isn't available - so
                    // at least make sure we're not still showing the previous peer.
                    this.elements.activePeerVideo.srcObject = null;
                }

                if (!this.solo) {
                    // stop local video being shown
                    this.localStreamManager.removeOutputCanvas(this.elements.localVideoCanvas);
                }

                if (this.numberOfPeers > 2) {
                    outgoingVideoWidth = 240;
                    outgoingFrameRate = 5;
                }
            }

            this.localStreamManager.width = outgoingVideoWidth;
            this.localStreamManager.frameRate = outgoingFrameRate;

            // in "solo", make sure that any out-of-sight peers
            // (not active, not local) are hidden.
            if (this.solo) {
                this.knownPeerIds().forEach(viewId => {
                    if (viewId !== this.viewId && viewId !== activePeerId) {
                        const peerStream = this.getPeerStream(viewId);
                        if (peerStream)
                            this.ensureVideoMuteState(peerStream, true);
                    }
                });
            }
        } else {
            // there is no active peer
            this.removeActivePeerDisplay();
        }

        this.updateActivePeerContainerStyle();
        this.updateHiddenAudience();
    }

    updateHiddenAudience() {
        // called from updatePeersContainerStyle, onUpdateSolo,
        // setActivePeer.
        // in solo (hidden-audience) mode, show a count of the number
        // of peers - if any - who are currently not being seen.
        let hiddenCount = 0;
        if (this.solo && this.numberOfPeers >= 3) {
            const activePeerId = this.getDisplayedActivePeer();
            hiddenCount = this.numberOfPeers - (activePeerId === this.viewId ? 1 : 2);
        }

        const hiddenAudience = this.elements.activePeer.querySelector('#hiddenAudience');
        if (hiddenCount > 0) {
            hiddenAudience.classList.add('someHidden');
            hiddenAudience.querySelector('span').textContent = `${hiddenCount} hidden`;
        } else {
            hiddenAudience.classList.remove('someHidden');
        }
    }

    removeActivePeerDisplay() {
        const activePeerElement = this.elements.activePeer;

        ['mute-video', 'mute-audio', 'self', 'raisingHand', 'published-stream'].forEach(prop => {
            activePeerElement.classList.remove(prop);
        });

        delete activePeerElement.dataset.viewId;

        activePeerElement.querySelector('.nickname').innerText = '';
        activePeerElement.querySelector('.abbreviated').innerText = ''; // although right now activePeer doesn't use this

        const peerInfo = activePeerElement.querySelector('.peerInfo');
        delete peerInfo.style.backgroundColor;
        delete peerInfo.style.color;

        // when no-one's the active peer, there's no point in
        // anyone streaming high-resolution video.
        this.localStreamManager.width = 240;
        this.localStreamManager.frameRate = 5;
        this.elements.activePeerVideo.srcObject = null;
    }

    showWarning(msg) {
        this.elements.activePeer.querySelector('.nickname').innerText = msg;
    }
    // getPeerIds() { return this.chatPeerManager.getPeerIds(); }
    isKnownChatPeer(viewId) { return this.chatPeerManager.isKnownPeer(viewId); }
    getPeerStream(viewId) { return this.chatPeerManager.getPeerStream(viewId); }
    ensureAudioMuteState(stream, bool) { return this.chatPeerManager.ensureAudioMuteState(stream, bool); }
    ensureVideoMuteState(stream, bool) { return this.chatPeerManager.ensureVideoMuteState(stream, bool); }

    updateActivePeerContainerStyle() {
        this.updatePeerContainerStyle(this.elements.activePeer);
    }

    // EVENT LISTENERS
    addEventListener(element, type, rawListener, options) {
        this._eventListeners = this._eventListeners || [];
        const boundListener = rawListener.bind(this);
        element.addEventListener(type, boundListener, options);
        this._eventListeners.push({element, type, boundListener, rawListener});
    }
    // NOT USED
    // NB: only removes first listener found!
    removeEventListener(element, type, rawListener) {
        const index = this._eventListeners.findIndex(spec => spec.element === element && spec.type === type && spec.rawListener === rawListener);
        if (index >= 0) {
            element.removeEventListener(type, this._eventListeners[index].boundListener);
            this._eventListeners.splice(index, 1);
        }
    }
    removeEventListeners() {
        this._eventListeners.forEach(({element, type, boundListener}) => {
            element.removeEventListener(type, boundListener);
        });
        this._eventListeners = [];
    }

    shutDown() {
        // @@ there might be some better ordering for all this.
        // current order:
        //   - remove event listeners
        //   - cancel interval-driven processes
        //   - cancel any active peer
        //   - disconnect the microphone-test local audio stream
        //   - clean up ui state properties (solo, connected etc)
        //   - stop local audio and video, and delete ref to stream

        //   - chatPeerManager shutDown:
        //     * cancel interval-driven processes
        //     * for every viewId send offPeerStream to remove the DOM elements
        //     * tell Agora to disconnect

        //   - localStreamManager shutDown:
        //     * cancel interval-driven processes
        //     * close local audioContext and streamMixer

        //   - remove all peer containers, including own
        //   - remove all peer state, including own
        this.removeEventListeners();
        if (this.resizeObserver)
            this.resizeObserver.disconnect();

        this.stopPollingForActivePeer();
        this.stopRenderingPeerBorders();
        this.stopTestingMicrophone();

        this.removeActivePeerDisplay();
        this.elements.localAudio.srcObject = null;
        ['solo', 'connected', 'published-stream'].forEach(prop => {
            this.elements.ui.classList.remove(prop);
        });

        if (this.localChatStream) {
            // turns out that if you tell Agora to mute before
            // asking to leave, it doesn't send the other peers
            // an appropriate leave(reason="Quit") notification.
            // so just shut down our local streams.
            // this.muteChatVideo(true);
            // this.muteChatAudio(true);

            this.localStreamManager.stopVideoStream();
            this.localStreamManager.stopAudioStream();

            delete this.localChatStream;
        }

        this.chatPeerManager.shutDown();
        this.localStreamManager.shutDown();

        this.knownPeerIds().forEach(viewId => {
            this.removePeerContainer(viewId, true); // shutdown = true
            delete this.croquetPeerState[viewId];
        });
    }
}

let theChatManager;
class QChatView extends Croquet.View {
    constructor(model) {
        // this can either be the first view instantiation
        // for this viewId, or a reconnection after a
        // period of dormancy (typically due to a network
        // glitch).
        // in the former case, there is a chance that the
        // model has not yet processed the view-join for this
        // view.  under those circumstances, we set up a
        // suitable view-join subscription and bail out.
        super(model);
        this.model = model;

        // @@@ workaround for current Session API's inability
        // to stop a reconnection that's already in progress.
        // if the user has pressed Leave, bail out immediately.
        if (document.getElementById('ui').classList.contains('userLeft')) {
            Croquet.Session.leave(this.sessionId);
            return;
        }

        this.isWaitingForLocalDetails = true;

        if (model.hasJoinedPeer(this.viewId)) {
            // even if the model has a record for this view, it
            // will be just a stub.  we have to fill in the
            // details from here.
            console.log("local view already joined the session", model.peerSnapshotForId(this.viewId));
            this.sendPeerDetails();
        } else {
            // set up a subscription that will send the details
            // once the view turns up.
            this.subscribe(this.viewId, 'local-view-join', this.sendPeerDetails);
        }

        this.lastLogSent = 0;
        this.sendPreviousLogs();
    }

    sendPeerDetails() {
        // tell the model that this view is joining the session
        // with the specified user details
        const { viewId } = this;
        let { nickname, initials, viewColor } = sessionConfiguration;
        if (nickname === '') nickname = sessionConfiguration.nickname = viewId;
        if (initials === '') initials = sessionConfiguration.initials = viewId.slice(0, 2);
        const agent = window.navigator.userAgent;

        this.publish(this.sessionId, 'peer-details', { viewId, nickname, initials, viewColor, agent });

        this.subscribe(this.sessionId, 'on-peer-details', this.onPeerDetails);
    }

    onPeerDetails(viewId) {
        // on view initialisation (perhaps re-joining a
        // running chat), wait for the peer details for
        // the local view before going any further.
        const isLocalDetails = viewId === this.viewId;
        if (this.isWaitingForLocalDetails) {
            if (!isLocalDetails) return; // we'll catch up on this event using model data, once the local details are found

            this.isWaitingForLocalDetails = false;
            this.setUpSubscriptions();

            // if the chat manager has not yet been set up,
            // do so now.
            if (!theChatManager)
                theChatManager = new ChatManager(this.viewId);

            // if this is a reconnection, the chat manager will
            // send view-to-model messages to ensure the model
            // is up to date with what changed for the local
            // view during the time out.
            theChatManager.setQChatView(this);

            // whether the manager existed before or not,
            // feed it the details of all peers that have
            // supplied them.  if the manager was already
            // running, it will use all peer data to make
            // any necessary updates to its records (and
            // to the UI).
            const knownPeerDict = {};
            this.model.identifiedPeers().forEach(vId => knownPeerDict[vId] = this.model.peerSnapshotForId(vId));
            theChatManager.setKnownPeers(knownPeerDict);
            theChatManager.onUpdateSolo(this.model.solo);

            // if fewer than 3, the chatManager will already have
            // run setDefaultActivePeer
            if (Object.keys(knownPeerDict).length >= 3)
                theChatManager.setActivePeer(this.model.activePeer);
        } else {
            // these must be the details for a remote peer.
            if (isLocalDetails) {
                console.warn("local details received twice", this.model.peerSnapshotForId(viewId));
                throw Error("local details received twice");
            }

            // console.warn(`onPeerDetails for ${viewId}`);
            const peerSnap = this.model.peerSnapshotForId(viewId);
            theChatManager.setPeerStateFromModel(viewId, peerSnap);

            // if the arrival of the peer takes the total of known
            // peers to 3, the views all petition the model to
            // release 'solo' state.  it doesn't matter that multiple
            // views will send the same event.
            // we handle that here, rather than in ChatManager.addPeer,
            // because here we know that we're dealing with the
            // arrival of a single newcomer (rather than syncing with
            // an established group of many peers, possibly with a
            // user-chosen 'solo' setting).
            if (theChatManager.numberOfPeers === 3)
                this.publish(this.sessionId, 'set-solo', false);
        }
    }

    setUpSubscriptions() {
        this.subscribe(this.sessionId, 'on-peer-intended-state', this.onPeerIntendedState);

        this.subscribe(this.sessionId, 'on-peer-exit', this.onPeerExit);

        this.subscribe(this.sessionId, 'update-active-peer', this.onUpdateActivePeer);
        this.subscribe(this.sessionId, 'update-solo', this.onUpdateSolo);

        // subscription notifications from remote peers are used to
        // update the hourglass indicators
        this.subscribe(this.sessionId, 'on-peer-stream-subscriptions', this.onPeerStreamSubscriptions);

        this.subscribe(this.sessionId, 'on-peer-hand', this.onPeerHand);

        this.subscribe(this.sessionId, 'on-gather-logs', this.onGatherLogs);
        this.subscribe(this.sessionId, 'on-peer-log', this.onPeerLog);
    }

    onPeerIntendedState(data) { theChatManager.onPeerIntendedState(data); }
    onPeerExit(data) { theChatManager.onPeerExit(data); }
    onUpdateActivePeer(data) { theChatManager.onUpdateActivePeer(data); }
    onUpdateSolo(data) { theChatManager.onUpdateSolo(data); }
    onPeerStreamSubscriptions(data) { theChatManager.onPeerStreamSubscriptions(data); }
    onPeerHand(data) { theChatManager.onPeerHand(data); }

    onGatherLogs({ reason, initiator }) {
        if (initiator === this.viewId) return;

        this.sendLog(reason, initiator);
    }

    async sendLog(reason, initiator=this.viewId, viewId=this.viewId, text=logText, timestamp = Date.now()) {
        if (!text) return;

        // rate-limit log uploads to 1 per minute
        if (reason !== 'prev' && timestamp - this.lastLogSent < 60000) return;

        this.lastLogSent = timestamp;

        const encoder = new TextEncoder();
        const buf = encoder.encode(text).buffer;
        const handle = await Croquet.Data.store(this.sessionId, buf);
        this.publish(this.sessionId, 'peer-log', { timestamp, initiator, reason, viewId, handle });
    }

    sendPreviousLogs() {
        // send previous log now after reload
        for (const previous of previousLogs) {
            if (previous.persistentId === this.session.persistentId) {
                this.sendLog('prev', this.viewId, previous.viewId, previous.log, previous.timestamp);
                try { delete localStorage[previous.key]; }
                catch (_) { /* ignore */}
            }
        }
        // send (presumably successful) log after 3 min, plus get everyone else's for context
        const getAllLogs = () => {
            if (!this.id) return; // view has been detached

            this.sendLog('auto');
            this.publish(this.sessionId, 'gather-logs', { initiator: this.viewId, reason: 'auto' });
            };
        setTimeout(getAllLogs, 3 * 60 * 1000);
    }

    async onPeerLog({ initiator, reason, viewId, handle }) {
        // the log has already been stored in the model.  here we
        // just decide whether to also throw it into our console.
        // the only logs written to the console are those sent
        // for the 'debug' reason, with this view as the initiator.
        if (initiator !== this.viewId || reason !== 'debug') return;

        const buf = await Croquet.Data.fetch(this.sessionId, handle);
        const peerLog = new TextDecoder().decode(buf);
        console.__log(`log from ${viewId}:\n${peerLog}`);
    }

    detach() {
        super.detach();

        if (theChatManager) theChatManager.setQChatView(null);
    }
}

const {searchParams} = new URL(window.location);
isBackdrop = searchParams.get('backdrop') !== null;
const sessionConfiguration = {
    channelName: searchParams.get('channelName') || searchParams.get('c') || ' ',
    nickname: searchParams.get('nickname') || searchParams.get('n') || '',
    initials: searchParams.get('initials') || searchParams.get('i') || '',
    viewColor: searchParams.get('viewColor') || searchParams.get('userColor') || searchParams.get('h') || `hsl(${Math.floor(Math.random()*255)}, 40%, 40%)`,
    mic: searchParams.get('mic') || searchParams.get('m') || (isBackdrop ? 'on' : 'off'),
    video: searchParams.get('video') || searchParams.get('v') || (isBackdrop ? 'on' : 'off'),
};

const cover = document.getElementById('cover');
const ui = document.getElementById('ui');

let sessionId;
let persistentId;
let viewId;
let joinSent = false;
function joinSession() {
    cover.classList.add('hidden');
    ui.classList.remove('hidden');
    ui.classList.remove('userLeft');
    document.getElementById('toggleConnection').setAttribute("title", "Leave Call");
    joinSent = true; // never reset - but for now only checked in the page's root-level code, in case of a race with some other join path
    Croquet.App.root = false;
    const joinArgs = {
        appId: 'io.croquet.qChat',
        apiKey: "1_mzkqelcumtx3urhisusgclgbu87jepft0bw00i6m",
        name: sessionConfiguration.channelName,
        password: 'dummy-pass',
        model: window.QChatModel,
        view: QChatView,
        autoSleep: false,
        tps: 4,
        viewIdDebugSuffix: sessionConfiguration.initials,
        rejoinLimit: 1000 // maximum duration of a socket glitch before we bail out
        // debug: ["messages"] // ["session"]
        };
// if (/toxiproxy/.exec(window.location.href)) {
//     joinArgs.reflector = "ws://localhost:9099";
//     console.warn("toxiproxy");
// } else {
//     joinArgs.reflector = "wss://e3768fe7e92c.ngrok.io/";
// }
    Croquet.Session.join(joinArgs)
        .then(_session => {
            sessionId = _session.id;
            persistentId = _session.persistentId;
            viewId = _session.view.viewId;
            });
}

// JOIN/LEAVE BUTTON
function toggleConnection() {
    // the join/leave button.
    // @@@ if the croquet session happens to have gone away - due to a
    // network glitch, rather than a user request - when the button is
    // pressed, we can't currently stop the session from automatically
    // reconnecting.  for now, QChatView constructor checks 'userLeft'
    // and bails out if it's set.
    // needs a bit of a change in teatime.
    if (!ui.classList.contains('userLeft')) {
        ui.classList.add('userLeft');
        ui.classList.add('solo');
        document.getElementById('toggleSolo').setAttribute("title", "");
        ui.classList.remove('alone');
        ui.classList.remove('play-blocked');
        if (theChatManager) {
            theChatManager.setQChatView(null);
            theChatManager.shutDown();
            theChatManager = null;
        }
        if (sessionId) Croquet.Session.leave(sessionId);
        document.getElementById('toggleConnection').setAttribute("title", "Join Call");
        sessionId = null;
    } else {
        joinSession();
    }
}

/*
function showCallTooltip() {
    if (!ui.classList.contains('userLeft')) {
        document.getElementById('toggleConnection').setAttribute('title', 'Leave Call');
    } else {
        document.getElementById('toggleConnection').setAttribute('title', 'Join Call');
    }
}
*/

document.getElementById('toggleConnection').addEventListener('click', toggleConnection);
// document.getElementById('toggleConnection').addEventListener('mouseover', showCallTooltip);


function toggleSettings() {
    if (ui.classList.contains('hide-settings')) {
        ui.classList.remove('hide-settings');
    }
    else {
        ui.classList.add('hide-settings');
    }
}

/*
function showSettingsTooltip() {
    if (ui.classList.contains('hide-settings')) {
        document.getElementById('toggleSettings').setAttribute('title', 'Show Settings');
    }
    else {
        document.getElementById('toggleSettings').setAttribute('title', 'Hide Settings');
    }
}
*/

document.getElementById('toggleSettings').addEventListener('click', toggleSettings);
// document.getElementById('toggleSettings').addEventListener('mouseover', showSettingsTooltip);

const isSpectator = searchParams.has('spectator');
if (isSpectator) {
    sessionConfiguration.mic = 'off';
    sessionConfiguration.video = 'off';
    ui.classList.add('spectator');
}

if (window.parent === window) {
    // standalone
    joinSession();
}
else {
    // embedded
    const clickEnableTimeoutId = window.setTimeout(() => {
        cover.classList.remove('hidden');
        cover.addEventListener('click', _event => joinSession(), { once: true });
        }, 500);

    const receiver = {
        init() {
            Croquet.Messenger.setReceiver(this);

            Croquet.Messenger.on("sessionInfo", "onSessionInfo");
            Croquet.Messenger.on("userInfo", "onUserInfo");
            Croquet.Messenger.on("videoChatInitialState", "onVideoChatInitialState");

            this.requestInfo();
        },

        onSessionInfo({sessionHandle, ephemeralSessionHandle}) {
            // sessionConfiguration.sessionHandle = sessionHandle;
            // sessionConfiguration.sessionName = sessionName;

            // feb 2021: channelName is used both for the Croquet session
            // name and for the Agora channel.  it used to be based on
            // the persistentId of the Greenlight session, but to avoid
            // the confusion caused by being in the same chat session even
            // if Greenlight has been updated, we now use the ephemeral
            // (session-specific) handle.  for now the persistent handle
            // is still included, as a prefix, to help track the migration
            // of GL versions in the reflector and Agora logs.
            sessionConfiguration.channelName = sessionHandle.slice(0, 8) + ":" + ephemeralSessionHandle.slice(0, 8);

            this.receivedSessionInfo = true;
            this.checkIfReadyToJoinSession();
        },
        receivedSessionInfo: false,

        onUserInfo({nickname, initials, userColor, viewId: userViewId}) {
            if (nickname)
                sessionConfiguration.nickname = nickname;

            if (initials) {
                if (/[^_a-z0-9]/i.test(initials)) {
                    initials = userViewId.slice(-2);
                }
                sessionConfiguration.initials = initials;
            }

            if (userColor) {
                sessionConfiguration.userColor = userColor;
                sessionConfiguration.viewColor = userColor;
            }

            this.receivedUserInfo = true;
            this.checkIfReadyToJoinSession();
        },
        receivedUserInfo: false,

        onVideoChatInitialState({mic, video, fromLandingPage, cameraDeviceId, cameraDeviceLabel, cameraDeviceIndex, micDeviceId, micDeviceIndex, micDeviceLabel}) {
            console.log("initial state from page:", {mic, video, micDeviceLabel, cameraDeviceLabel});
            if (mic && !isBackdrop)
                sessionConfiguration.mic = mic;

            if (video && !isBackdrop)
                sessionConfiguration.video = video;

            sessionConfiguration.fromLandingPage = fromLandingPage;

            if (cameraDeviceId)
                sessionConfiguration.cameraDeviceId = cameraDeviceId;

            // if (cameraDeviceIndex >= 0)
            //     sessionConfiguration.cameraDeviceIndex = cameraDeviceIndex;

            if (cameraDeviceLabel)
                sessionConfiguration.cameraDeviceLabel = cameraDeviceLabel;

            if (micDeviceId)
                sessionConfiguration.micDeviceId = micDeviceId;

            // if (micDeviceIndex >= 0)
            //     sessionConfiguration.micDeviceIndex = micDeviceIndex;

            if (micDeviceLabel)
                sessionConfiguration.micDeviceLabel = micDeviceLabel;

            this.receivedVideoChatInitialState = true;
            this.checkIfReadyToJoinSession();
        },
        receivedVideoChatInitialState: false,

        get receivedAllData() {return this.receivedSessionInfo && this.receivedUserInfo && this.receivedVideoChatInitialState;},
        checkIfReadyToJoinSession() {
            // only proceed to join if Q has supplied all necessary info, including
            // confirmation that Q was started via the landing page
            if (this.receivedAllData && !joinSent && sessionConfiguration.fromLandingPage) {
                window.clearTimeout(clickEnableTimeoutId);
                joinSession();
            }
        },

        requestInfo() {
            this.requestSessionInfo();
            this.requestUserInfo();
            this.requestVideoChatInitialState();
        },
        requestSessionInfo() {Croquet.Messenger.send("sessionInfoRequest");},
        requestUserInfo() {Croquet.Messenger.send("userInfoRequest");},
        requestVideoChatInitialState() {Croquet.Messenger.send("videoChatInitialStateRequest");},
    };
    receiver.init();
}

const logTypes = [ "log", "warn", "error" ];
const prefixes = { log: "", warn: "[w] ", error: "[e] " };
const SystemDate = window.Date;
let logText = "";
function logger(type, msg) {
    // avoid patched Date even if logging from Model code
    const date = new SystemDate();
    // jan 2021: Safari doesn't yet support fractionSecondDigits
    let time = date.toLocaleTimeString('en-US', { hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit"}) + "." + ("000" + date.getMilliseconds()).slice(-3) + " ";
    if (msg.startsWith(time.slice(0, 8))) time = "";
    const prefix = prefixes[type];
    logText += `${time}${prefix}${msg}\n`;
}
function installLogger() {
    const cons = window.console;
    const depthOneString = value => {
        // single-level stringification of the value's properties.
        // if it's not a plain object, look at a single level of
        // prototype properties.
        if (value.constructor.name !== "Object") {
            value = Object.fromEntries(Object.entries(Object.getOwnPropertyDescriptors(Object.getPrototypeOf(value))).map(([k, _desc]) => [k, value[k]]).filter(([_k, v]) => typeof v !== "function"));
        }

        return JSON.stringify(Object.fromEntries(Object.entries(value).map(([k, v]) => ([k, String(v)]))));
        };
    logTypes.forEach(type => {
        const nativeFn = cons[`__${type}`] = cons[type];
        cons[type] = (...stuff) => {
            nativeFn(...stuff);
            const argStrings = [];
            stuff.forEach(arg => {
                let argString = "";
                try {
                    // special handling for error objects, since stringify
                    // doesn't do anything helpful.
                    if (arg instanceof Error) argString = arg.stack || arg.message;
                    else if (typeof arg === "object" && arg !== null) {
                        if (arg.constructor.name !== "Object") argString = depthOneString(arg);
                        else {
                            // stringify won't work if object happens to include
                            // circular refs.
                            try { argString = JSON.stringify(arg); }
                            catch (e) { argString = depthOneString(arg); }
                        }
                    } else argString = String(arg);
                    if (argString.length > 500) argString = argString.slice(0, 500) + `...[truncated from ${argString.length} chars]`;
                } catch (e) { argString = `[error in logging: ${e}]`; }
                argStrings.push(argString);
            });
            const msg = argStrings.join(" ");
            logger(type, msg);
            };
    });
}
installLogger();

const previousLogs = [];
function getPreviousLogs() {
    const oldkey = "io.croquet.qChat/log";
    const ourkey = window.location.pathname + "|log";
    try {
        const now = Date.now();
        for (const [key, value] of Object.entries(localStorage)) {
            if (key.startsWith(oldkey)) delete localStorage[key]; // delete old logs
            if (!key.startsWith(ourkey)) continue;
            let [, date] = key.split('|');
            if (now - date > 60 * 60 * 1000) delete localStorage[key]; // delete outdated logs
            else previousLogs.push({...JSON.parse(value), key});
        }
    } catch (_error) { /* ignore */ }
    // store log when user reloads
    window.addEventListener('beforeunload', e => {
        delete e['returnValue']; // let browser unload happen
        try {
            if (!persistentId) return;
            localStorage[`${ourkey}|${Date.now()}`] = JSON.stringify({
                timestamp: Date.now(),
                viewId,
                persistentId,
                log: `Prev: ${sessionId.slice(0, 4)}...\n` + logText.slice(-100000)
            });
        }
        catch (_error) { /* ignore */ }
    });
}
getPreviousLogs();
