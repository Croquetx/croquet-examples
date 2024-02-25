//import { vec2 } from "gl-matrix";
import { QModel } from "@croquet/q";
import { v2_normalize } from "@croquet/q/src/QVector";
import { Voxels } from "./Voxels";


class Behavior extends QModel {

    init(actor) {
        super.init();
        this.actor = actor;
    }

    stop() {
        this.actor.stopBehavior();
    }

}

//------------------------------------------------------------------------------------------
//-- IdleBehavior---------------------------------------------------------------------------
//------------------------------------------------------------------------------------------

export class IdleBehavior extends Behavior {
}

//------------------------------------------------------------------------------------------
//-- FallBehavior---------------------------------------------------------------------------
//------------------------------------------------------------------------------------------

export class FallBehavior extends Behavior {

    init(actor) {
        super.init(actor);
        this.velocity = 0;
    }

    tick(delta) {
        const surfaces = this.wellKnownModel("VoxelSurfaces");
        const seconds = delta / 1000;
        this.velocity += seconds * Voxels.gravity;
        this.velocity = Math.min(Voxels.terminalVelocity, this.velocity);

        const x0 = this.actor.xyz[0];
        const y0 = this.actor.xyz[1];
        let z0 = this.actor.xyz[2] + 1;

        const x1 = this.actor.fraction[0];
        const y1 = this.actor.fraction[1];
        const z1 = this.actor.fraction[2];

        let fall = z1 - this.velocity * seconds;

        do {
            z0 -= 1;
            if (z0 < 0) { // Check for falling out of the world
                console.log("Hit kill plane!");
                this.actor.kill();
                return;
            }
            const id = Voxels.packXYZ(x0,y0,z0);
            const ground = surfaces.elevation(id, x1, y1);
            if (ground > fall) { // Hit the ground.
                this.actor.xyz[2] = z0;
                this.actor.fraction[2] = 0;
                this.stop();
                return;
            }
            fall += 1;
        } while (fall < 1);

        this.actor.xyz[2] = z0;
        this.actor.fraction[2] = fall - 1;

    }
}

//------------------------------------------------------------------------------------------
//-- GotoBehavior---------------------------------------------------------------------------
//------------------------------------------------------------------------------------------

export class GotoBehavior extends Behavior {

    init({actor, path}) {
        super.init(actor);
        this.path = path;
        this.step = 0;

        // Set up pathing variables

        const hereID = path[0];
        const thereID = path[1];
        const hereXYZ = Voxels.unpackXYZ(hereID);
        const thereXYZ = Voxels.unpackXYZ(thereID);

        this.exit = this.findExit(hereXYZ, thereXYZ);
        this.forward = [this.exit[0] - this.actor.fraction[0], this.exit[1] - this.actor.fraction[1]];

        // Normalize the forward vector

        const magnitude = Math.sqrt(this.forward[0] * this.forward[0] + this.forward[1] * this.forward[1]);
        if (magnitude > 0) {
            this.forward[0] /= magnitude;
            this.forward[1] /= magnitude;
        } else {    // Starting at exit point, so any forward vector will work
            this.forward[0] = 1;
            this.forward[1] = 0;
        }

        this.actor.setFacing(this.forward);
    }

    // Given the xy addresses of the current voxel and the voxel you're coming from, returns the point in the current voxel
    // you should enter at.

    findEntrance(here, there) {
        const x0 = here[0];
        const y0 = here[1];
        const x1 = there[0];
        const y1 = there[1];
        if (x0 > x1) {
            if (y0 > y1) return [0,0];
            if (y0 < y1) return [0,1];
            return [0,0.4];
        }
        if (x0 < x1) {
            if (y0 > y1) return [1,0];
            if (y0 < y1) return [1,1];
            return [1,0.6];
        }
        if (y0 > y1) return [0.6,0];
        if (y0 < y1) return [0.4,1];
        return [0.5, 0.5];
    }

    // Given the xy addresses of the current voxel and the voxel you're headed toward, returns the point in the current voxel
    // you should move toward.

    findExit(here, there) {
        const x0 = here[0];
        const y0 = here[1];
        const x1 = there[0];
        const y1 = there[1];
        if (x0 > x1) {
            if (y0 > y1) return [0,0];
            if (y0 < y1) return [0,1];
            return [0,0.6];
        }
        if (x0 < x1) {
            if (y0 > y1) return [1,0];
            if (y0 < y1) return [1,1];
            return [1,0.4];
        }
        if (y0 > y1) return [0.4,0];
        if (y0 < y1) return [0.6,1];
        return [0.5, 0.5];
    }


    tick(delta) {

        let hereID = this.path[this.step];
        let hereXYZ = Voxels.unpackXYZ(hereID);

        if (this.actor.xyz[0] !== hereXYZ[0] || this.actor.xyz[1] !== hereXYZ[1] || this.actor.xyz[2] !== hereXYZ[2]) { // Off the path
            console.log("Off the path!");
            this.actor.stopBehavior();
            return;
        }

        const roadMultiplier = 2;
        const seconds = delta / 1000;
        const slopeMultiplier = this.findSlopeMultiplier();
        let travel = this.actor.walkSpeed * seconds * slopeMultiplier;
        if (this.actor.onRoad) travel *= roadMultiplier;

        let xTravel = this.forward[0] * travel;
        let yTravel = this.forward[1] * travel;

        let xRemaining = this.exit[0] - this.actor.fraction[0];
        let yRemaining = this.exit[1] - this.actor.fraction[1];

        while (Math.abs(xTravel) > Math.abs(xRemaining) || Math.abs(yTravel) > Math.abs(yRemaining)) { // Hop to the next voxel

            //Make sure the path still exits
            const paths = this.wellKnownModel("Paths");
            if (!paths.hasExit(hereID, this.path[this.step+1])) { // Route no longer exists
                console.log("Broken path!");
                this.actor.stopBehavior();
                return;
            }

            this.actor.onRoad = paths.hasRoad(hereID, this.path[this.step+1]);

            // Calculate the leftover travel
            travel -= Math.sqrt(xRemaining * xRemaining + yRemaining * yRemaining);

            // Advance along the path
            this.step++;

            const previousXYZ = hereXYZ;
            hereID = this.path[this.step];
            hereXYZ = Voxels.unpackXYZ(hereID);

            // Find the entrance point
            const entrance = this.findEntrance(hereXYZ, previousXYZ);

            // Move to next voxel
            this.actor.xyz = hereXYZ;
            this.actor.fraction = entrance;

            if (this.step === this.path.length-1) { // We've arrived!
                this.actor.stopBehavior();
                return;
            }

            // Find the new exit
            const thereID = this.path[this.step+1];
            const thereXYZ = Voxels.unpackXYZ(thereID);
            this.exit = this.findExit(hereXYZ, thereXYZ);

            // Point ourselves toward the new exit
            xRemaining = this.exit[0] - this.actor.fraction[0];
            yRemaining = this.exit[1] - this.actor.fraction[1];

            this.forward = v2_normalize([xRemaining, yRemaining]);
            //vec2.normalize(this.forward, this.forward);

            this.actor.setFacing(this.forward);

            xTravel = this.forward[0] * travel;
            yTravel = this.forward[1] * travel;
        }

        this.actor.fraction[0] = Math.min(1, Math.max(0, this.actor.fraction[0] + xTravel));
        this.actor.fraction[1] = Math.min(1, Math.max(0, this.actor.fraction[1] + yTravel));
        this.actor.fraction[2] = 0;

    }

    // Returns the amount to slow down horizontal movement because the pawn is traveling up or down a slope.
    //
    // This is not because of effort, but to compensate for extra distance travelled.
    //
    // Slope is the ratio of rise to run in the direction of travel in voxel coordinates.
    // Going up a ramp --> slope = 1
    // Going down a ramp --> slope = -1
    // Crossing level terrin --> slope = 0
    //
    // Max slope = square root of 2 (1.414...). This is when you're going up or down a double ramp.

    findSlopeMultiplier() {
        const slopeFactor = 0.15; // This factor takes into account the xy vs. z size of the voxels.
        const surfaceManager = this.wellKnownModel("VoxelSurfaces");
        const id = Voxels.packXYZ(...this.actor.xyz);
        const forwardX = this.forward[0];
        const forwardY = this.forward[1];
        const slopeXY = surfaceManager.slope(id, this.actor.fraction[0], this.actor.fraction[1]);
        const slope = forwardX * slopeXY[0] + forwardY * slopeXY[1];
        return 1 - (Math.abs(slope) * slopeFactor);
    }
}

//------------------------------------------------------------------------------------------
//-- WanderBehavior-------------------------------------------------------------------------
//------------------------------------------------------------------------------------------

export class WanderBehavior extends Behavior {

    tick() {
        // console.log("Picking new destination...");
        const surfaces = this.wellKnownModel("VoxelSurfaces");
        const paths = this.wellKnownModel("Paths");

        const startID = Voxels.packXYZ(...this.actor.xyz);
        const destinationID = surfaces.getRandomTraversable();
        const path = paths.findPath(startID, destinationID);
        if (path.length > 1) {
            this.actor.startBehavior(GotoBehavior.create({actor: this.actor, path}));
        }
    }

}

//------------------------------------------------------------------------------------------
//-- TeleportBehavior-----------------------------------------------------------------------
//------------------------------------------------------------------------------------------

// export class TeleportBehavior extends Behavior {

//     constructor(actor, destination) {
//         super(actor);
//         this.destination = destination;
//         this.timer = 3;
//         this.countdown = 3;
//         const xyz = Voxels.unpackXYZ(this.destination);
//         console.log("Teleport destination:" + xyz);
//     }

//     tick(delta) {
//         this.timer -= delta / 1000;
//         if (this.timer < 0) {
//             const xyz = Voxels.unpackXYZ(this.destination);
//             const x = xyz[0] + 0.5;
//             const y = xyz[1] + 0.5;
//             const z = xyz[2] + 0.75;
//             this.actor.setPosition(x,y,z);
//             this.actor.stopBehavior();
//         } else if (this.timer < this.countdown) {
//             console.log(this.countdown--);
//         }
//     }

// }
