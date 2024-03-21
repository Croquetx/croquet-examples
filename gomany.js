//tell many.html how many sessions have loaded
//
//window.top.postMessage({connected: +1}, "*");
//window.top.postMessage({connected: -1}, "*");

const RECONNECT = +new URL(window.location).searchParams.get("reconnect");

// we may be running in an iFrame
function inIframe () {
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
}

async function go(mySession) {
    Croquet.App.messages = true;
    Croquet.App.makeWidgetDock();

    const SessionButton = document.getElementById("SessionButton");

    let session = null;
    let users = 0;

    joinSession(mySession);

    async function joinSession(mySession) {
        SessionButton.innerText = "Joining";
        SessionButton.onclick = null;
//        console.log(mySession);
        session = await Croquet.Session.join(mySession);
        if(inIframe()) window.requestAnimationFrame(frame);
        SessionButton.innerText = "Leave";
        SessionButton.onclick = leaveSession;
        if (RECONNECT > 0) setTimeout(() => SessionButton.innerText === "Leave" && leaveSession(), RECONNECT);
    }

    async function leaveSession() {
        SessionButton.innerText = "Leaving";
        SessionButton.onclick = null;
        await session.leave();
        session = null;
        SessionButton.innerText = "Join";
        SessionButton.onclick = joinSession;
        if (RECONNECT > 0) setTimeout(() => SessionButton.innerText === "Join" && joinSession(), RECONNECT);
    }

    function frame(timestamp) {
        if (!session) return;

        session.step(timestamp);

        if (session.view) {
            const controller = session.view.realm.vm.controller;

            if(session.view.showStatus)
                session.view.showStatus(controller.backlog, controller.starvation, 100, 3000);

            if (users !== controller.users) {
                users = controller.users;
                window.top.postMessage({ users }, "*");
            }
        }

        window.requestAnimationFrame(frame);
    }
}


