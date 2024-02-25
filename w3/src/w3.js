import { QEngineStart, QInputStart, Session, App } from "@croquet/q";
import { ModelRoot } from "./ModelRoot";
import { ViewRoot } from "./ViewRoot";


async function go() {


    // -- Start the game engine --

    QEngineStart();

    // -- Bootstrap the model and the view --

    App.messages = true;
    App.makeWidgetDock();

    await Session.join(`w3-${App.autoSession()}`, ModelRoot, ViewRoot, { tps: "10x6" });

    // -- Seize control of the input handlers --

    QInputStart();
}

go();
