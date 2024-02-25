import { QInputBinding } from "@croquet/q";

export function CreateInputBindings() {
    new JumpBinding();
    new XDeltaBinding();
    new YDeltaBinding();
    new ZDeltaBinding();
    new EditActionBinding();

    new LayerUpBinding();
    new LayerDownBinding();
    new PawnCamBinding();

    new TouchDragBinding();
    new MouseDragBinding();
}

class TouchDragBinding extends QInputBinding {
    constructor() {
        super();
        this.event = "touchDrag";
        this.bindImmediate('touchDrag', 1);
    }
}

class MouseDragBinding extends QInputBinding {
    constructor() {
        super();
        this.event = "mouseDrag";
        this.bindSustained('mouse2', 1);
    }
}

class XDeltaBinding extends QInputBinding {
    constructor() {
        super();
        this.event = "xDelta";
        this.bindImmediate('mouseX', 10, 'mouse2');
    }
}

class YDeltaBinding extends QInputBinding {
    constructor() {
        super();
        this.event = "yDelta";
        this.bindImmediate('mouseY', 10, 'mouse2');
    }
}

class ZDeltaBinding extends QInputBinding {
    constructor() {
        super();
        this.event = "zDelta";
        this.bindImmediate('mouseWheel', 1);
    }
}

class EditActionBinding extends QInputBinding {
    constructor() {
        super();
        this.event = "editAction";
        this.bindImmediate('mouse0', 1);
    }
}

class LayerUpBinding extends QInputBinding {
    constructor() {
        super();
        this.event = "layerUp";
        this.bindImmediate('+', 1);
        this.bindImmediate('=', 1);
    }
}

class LayerDownBinding extends QInputBinding {
    constructor() {
        super();
        this.event = "layerDown";
        this.bindImmediate('-', 1);
        this.bindImmediate('_', 1);
    }
}

class PawnCamBinding extends QInputBinding {
    constructor() {
        super();
        this.event = "togglePawnCam";
        this.bindImmediate('0', 1);
    }
}

class JumpBinding extends QInputBinding {
    constructor() {
        super();
        this.event = "jump";
        this.bindImmediate(' ', 1);
    }
}
