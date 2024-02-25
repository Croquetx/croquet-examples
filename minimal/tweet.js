// used as "q.js" from "tweet.html"
// run ./build-tweet.sh to build "q.js" from this file

import * as Croquet from "@croquet/croquet";
import { AutoObservableModel, Observing } from  "@croquet/observable";

const OModel = AutoObservableModel;
const OView = Observing(Croquet.View);

// shorter names for tweet-sized version

Croquet.Model.prototype.every = function(every, ...args) { return this.future({every}, ...args); };
Croquet.Model.prototype.emit = function(...args) { this.publish("", ...args); };
Croquet.Model.prototype.on = function(...args) { this.subscribe("", ...args); };
Croquet.Model.prototype.onChanged = function(...args) { this.subscribeToPropertyChange(...args); };
Croquet.View.prototype.emit = function(...args) { this.publish("", ...args); };
Croquet.View.prototype.on = function(...args) { this.subscribe("", ...args); };
Croquet.View.prototype.onChanged = function(...args) { this.subscribeToPropertyChange(...args); };

window.Q = {
    ...Croquet,
    OModel,
    OView,
    start: (name, M, V, ...args) => {
        M.register("M");
        if (!V) V = OView;
        return Croquet.Session.join(name, M, V, ...args);
    }
};
