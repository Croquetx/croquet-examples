import { QModel, QNamedModel, v3_add, v3_floor, v3_sub } from "@croquet/q";
//import { v3_add, v3_floor, v3_sub } from "@croquet/q/src/QVector";
import { Voxels } from "./Voxels";
import { IdleBehavior, FallBehavior, WanderBehavior } from "./Behavior";


export class ActorBoss2 extends QNamedModel {

    init() {
        super.init("ActorBoss2");
        this.voxels = new Set();
    }
}


const tickDelta = 15;

export class ActorBoss extends QNamedModel {

    init() {
        super.init("ActorBoss");
        this.actors = new Set();
        this.subscribe("player", "spawnActor", data => this.handleActorSpawn(data));
        this.subscribe("voxels", "new", () => this.deleteAll());
    }

    handleActorSpawn(data) {
        const position = data;
        this.spawnActor(position);
    }

    spawnActor(position) {
        if (this.actors.size > 499) {
            const list = Array.from(this.actors);
            list[0].kill();
        }
        const actor = Actor.create();
        actor.setPosition(...position);
        this.actors.add(actor);
        console.log("Actors: " + this.actors.size);
    }

    deleteActor(actor) {
        this.actors.delete(actor);
    }

    deleteAll() {
        const doomed = new Set(this.actors);
        doomed.forEach(actor => actor.kill());
    }

}

export class Actor extends QModel {

    init() {
        super.init();
        this.destroyed = false;
        this.xyz = [0,0,0];              // voxel address
        this.fraction = [0,0,0];         // Fractional voxel coordinates
        this.facing = 0;                 // Clockwise rotation around z axis. 0 = north.
        this.walkSpeed = 0.75;              // voxels / second
        this.onRoad = false;
        this.color = this.random();
        this.behaviors = [IdleBehavior.create(this)];
        this.startBehavior(WanderBehavior.create(this));
        this.future(tickDelta).tick();
        this.publish("actor", "create", this);
    }

    kill() {
        this.publish("actor", "kill", this);
        while ( this.behaviors.length > 0) {
            const behavior = this.behaviors.pop();
            behavior.destroy();
        }
        const actorBoss = this.wellKnownModel("ActorBoss");
        actorBoss.deleteActor(this);
        this.destroyed = true;
        this.destroy();
    }

    tick() {
        if (this.destroyed) return;

        const voxels = this.wellKnownModel("Voxels");
        const surfaces = this.wellKnownModel("VoxelSurfaces");

        if (Voxels.isSolid(voxels.get(...this.xyz))) { // Buried alive!
            console.log("Buried alive!");
            this.kill();
            return;
        }

        const behavior = this.behaviors[this.behaviors.length-1];
        if (behavior.tick) behavior.tick(tickDelta);

        //Test for falling and elevation changes
        if (!(behavior instanceof FallBehavior)) {
            const id = Voxels.packXYZ(...this.xyz);
            const elevation = surfaces.elevation(id, ...this.fraction);
            if (this.fraction[2] > elevation) {
                console.log("Falling!");
                this.startBehavior(FallBehavior.create(this));
            } else {
                this.fraction[2] = elevation;
            }
        }

        if (!this.destroyed) this.future(tickDelta).tick();
    }

    startBehavior(behavior) {
        this.behaviors.push(behavior);
    }

    stopBehavior() {
        if (this.behaviors.length < 2) return;  // You can never stop the base idle.
        const old = this.behaviors.pop();
        old.destroy();
    }

    getPosition() {
        return v3_add(this.xyz, this.fraction);
    }

    getFacing() {
        return this.facing;
    }

    setPosition(x,y,z) {
        const a = [x,y,z];
        this.xyz = v3_floor(a);
        this.fraction = v3_sub(a, this.xyz);
    }

    setFacing(forward) {
        const x = forward[0];
        const y = forward[1];
        const acos = Math.acos(y);
        if (x > 0) {
            this.facing = -acos;
        } else {
            this.facing = acos;
        }
    }
}
