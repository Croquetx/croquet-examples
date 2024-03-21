// Stress test for Croquet
//
// Croquet Corporation, 2024
//
// This application is a stress test for Croquet. It generates a large number of user events
// and measures the total number of events per second that the system can handle. Use the 
// +/- or up and down arrow keys to increase or decrease the number of events from all users.
// This application is best used with the many.html launcher app.
//
// python3 -m http.server 8000
// http://localhost:8000/many.html?https://croquet.io/stress?q=many
// limit to 10 simultaneous sessions
// http://localhost:8000/many.html?https://croquet.io/stress?q=many#10
// http://localhost:8000/many.html?./stress/stress.html?q=many#20
// silence eslint – we've loaded Croquet as script in the HTML
/* global Croquet */

//------------------------------------------------------------------------------------------
// Define our model. MyModel has a tick method that executes once per second. It sends the current
// eventCounter since the last tick to the view and then resets the eventCounter.
//------------------------------------------------------------------------------------------

class MyModel extends Croquet.Model {

    init() { // Note that models are initialized with "init" instead of "constructor"!
        this.eventsPerSecond = 1; // there is always at least 1 event per second
        this.eventCounter = 0; // how many events occurred in the last second
        this.displayEvent = true;
        this.subscribe("eventCount", "addEvent", this.addEvent);
        this.subscribe("eventCount", "removeEvent", this.removeEvent);
        this.subscribe("eventCount", "reset", this.resetCounter);
        this.subscribe("eventCount", "event", this.handleEvent);
        this.subscribe("eventCount", "toggleDisplay", this.toggleDisplay);
        this.future(1000).tick();
    }

    resetCounter() {
        this.eventsPerSecond = 1;
        this.publish("eventCount", "change", this.eventsPerSecond);
    }

    addEvent() {
        if(this.eventsPerSecond<1000){ // never go above 1000 events per second 
            this.eventsPerSecond++;
            this.publish("eventCount","change",this.eventsPerSecond);
        }
    }

    removeEvent() {
        if(this.eventsPerSecond>1){ // never go below 1 event per second
            this.eventsPerSecond--;
            this.publish("eventCount","change",this.eventsPerSecond);
        }
    }

    toggleDisplay(){
        this.displayEvent = !this.displayEvent;
        this.publish("eventCount","changeDisplay",this.displayEvent);
    }

    handleEvent() {
        this.eventCounter++;
    }

    // this is called once per second
    tick() {
        // console.log("this.eventCounter: " + this.eventCounter);
        this.publish("eventCount", "update", this.eventCounter);
        this.eventCounter = 0;
        this.future(1000).tick();
    }
}

// Register our model class with the serializer
MyModel.register("MyModel");

//------------------------------------------------------------------------------------------
// Define our view. MyView auto-generates events based upon number of users and total session
// events per second. It updates once per second to display the number average number of events
// received for the last 5 seconds.
// 
//------------------------------------------------------------------------------------------

class MyView extends Croquet.View {

    constructor(model) { // The view gets a reference to the model when the session starts.
        super(model);
        this.element = document.body;
        // console.log(this.element);
        // we use a running average to smooth out the displayed event rate
        this.averageArray = [0,];
        this.index = 0;
        this.eventCounter = model.eventCounter;
        this.displayEvent = model.displayEvent;
        this.lastBandwidth = 0;

        this.eventsPerSecond = model.eventsPerSecond;
        this.averageEvents = 5;
        this.handleUpdate(this.eventCounter); // Get the current count on start up.
        this.lastTime = Date.now();
        this.nextEventTime = 1000;
        this.subscribe("eventCount", "change", data => this.handleChange(data));
        this.subscribe("eventCount", "update", data => this.handleUpdate(data));   
        this.subscribe("eventCount", "changeDisplay", data => this.changeDisplay(data));
        this.tickCount = 1
        this.future(1000).tick(this.tickCount); // start the event generation loop

        document.onkeydown = (e) => {
            if(e.repeat) return;
            switch(e.key){
                case "+": case "=":
                case "ArrowUp":
                    //console.log("increase events");
                    this.publish("eventCount","addEvent");
                    break;
                case "-": case "_":
                case "ArrowDown":
                    //console.log("decrease events");
                    this.publish("eventCount","removeEvent");
                    break;
                case " ":
                    console.log("reset events");
                    this.publish("eventCount","reset");
                    break;
                case "e": case "E":
                    this.publish("eventCount", "toggleDisplay");
                    break;

            }
        }
    }

    // this is called based on the global event rate and number of users
    tick(thisTick){
        if(this.tickCount !== thisTick) return; // we added more users and a different tick is running.
        let users = this.realm.vm.controller.users;
        let nextTime = Date.now();
        let delta = this.nextEventTime-(nextTime-this.lastTime);
        this.lastTime = nextTime;
       //console.log("delta: " +(this.nextEventTime-delta));
        this.nextEventTime = Math.floor(delta+0.5+2*Math.random()*users*1000/this.eventsPerSecond);
        this.publish("eventCount", "event");
        if(this.displayEvent){
            this.element.style.background = "#dfd";
            this.future(100).clearBackground();
        }
        this.future(this.nextEventTime).tick(thisTick);
    }

    clearBackground(){
        this.element.style.background = "#ddd";
    }

    // this is called whenever the session eventsPerSecond changes
    handleChange(data) {
        this.eventsPerSecond = data;
        console.log("events per second: " + this.eventsPerSecond);
        this.tickCount++;
        let users = this.realm.vm.controller.users;
        this.future(Math.floor(0.5+2*Math.random()*users*1000/this.eventsPerSecond)).tick(this.tickCount);
    }

    // this subscription is called once per second from the model
    handleUpdate(data) {
   //     console.log(this.lastBandwidth,CROQUETSTATS.networkTraffic.reflector_in);
        this.averageArray[this.index]=data;
        this.index = (this.index+1)%this.averageEvents;
        //average of the averageArray
        let sum = 0;
        for(let i=0;i<this.averageArray.length;i++){
            sum+=this.averageArray[i];
        }
        let average = Math.floor(0.5+sum/this.averageArray.length);
        let bandwidth = CROQUETSTATS.networkTraffic.reflector_in;
        document.getElementById("counter").innerHTML = 'E: '+average+'/'+this.eventsPerSecond;
        document.getElementById("latency").innerHTML = 'L: '+ this.session.latency;
        let bwk = Math.floor((bandwidth-this.lastBandwidth)/1024);
        document.getElementById("bandwidth").innerHTML = 'B: '+ bwk +'K';
        this.lastBandwidth = bandwidth;        
       // this.session.latency
    }

    changeDisplay(data){
        this.displayEvent = data;
    }

    showStatus(backlog, starvation, min, max) {
        const color = backlog > starvation ? '255,0,0' : '255,255,255';
        const value = Math.max(backlog, starvation) - min;
        const size = Math.min(value, max) * 100 / max;
        const alpha = size / 100;
        this.element.style.boxShadow = alpha < 0.2 ? "" : `inset 0 0 ${size}px rgba(${color},${alpha})`;
    }
}

//------------------------------------------------------------------------------------------
// Join the Teatime session and spawn our model and view. This is defined in gomany.js.
//------------------------------------------------------------------------------------------
go({
    apiKey: "1_i65fcn11n7lhrb5n890hs3dhj11hfzfej57pvlrx",
    appId: "io.croquet.hello",
    name: Croquet.App.autoSession(),
    password: "none", //Croquet.App.autoPassword(),
    model: MyModel,
    view: MyView,
});
