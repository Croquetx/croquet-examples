import { QPriorityQueue, QNamedModel } from "@croquet/q";
import { Voxels } from "./Voxels";

const slopeEffort = 5;   // Multiplier to discourage walking up hill
const sideFlatWeight = Voxels.scaleX;
const sideSlopeWeight = Math.sqrt(Voxels.scaleX * Voxels.scaleX + Voxels.scaleZ * Voxels.scaleZ);
const cornerFlatWeight = Math.sqrt(Voxels.scaleX * Voxels.scaleX + Voxels.scaleY * Voxels.scaleY);
const cornerSlopeWeight = Math.sqrt(Voxels.scaleX * Voxels.scaleX + Voxels.scaleY * Voxels.scaleY + Voxels.scaleZ * Voxels.scaleZ);
const centerWeight = Voxels.scaleZ;
const roadMultiplier = 0.2; // Multiplier to encourage road use.

export class Paths extends QNamedModel {

    static types() {
        return {
            "W3:Waypoint": Waypoint
        };
    }

    init() {
        super.init("Paths");
        this.waypoints = new Map();

        this.subscribe("surfaces", "new", () => this.handleSurfaceNew());
        this.subscribe("surfaces", "update", data => this.handleSurfaceUpdate(data));

        this.subscribe("player", "buildRoad", data => this.handleBuildRoad(data));
        this.subscribe("player", "demolish", data => this.handleDemolish(data));
    }

    handleSurfaceNew() {
        console.log("Building paths!");
        this.waypoints.clear();
        const surfaces = this.wellKnownModel("VoxelSurfaces");
        surfaces.surfaces.forEach((surface,id) => {
            if (surface.isTraversable()) {
                this.waypoints.set(id, new Waypoint(Voxels.unpackXYZ(id)));
            }
        });

        this.waypoints.forEach(waypoint => waypoint.findExits(surfaces));
        this.waypoints.forEach(waypoint => waypoint.findRoads(surfaces, this));
        this.waypoints.forEach(waypoint => waypoint.validateRoads(this));

        this.publish("paths", "new");
    }

    handleSurfaceUpdate(data) {
        let updated = data.updated;
        updated = Voxels.expandSetDiagonally(updated);

        const surfaces = this.wellKnownModel("VoxelSurfaces");

        updated.forEach(id => {
            const surface = surfaces.getSurface(id);
            if (surface.isTraversable()) {
                let waypoint = this.waypoints.get(id);
                if (!waypoint) {
                    waypoint = new Waypoint(Voxels.unpackXYZ(id));
                    this.waypoints.set(id, waypoint);
                }
                waypoint.findExits(surfaces);
            } else {
                this.waypoints.delete(id);
            }
        });

        updated.forEach(id => {
            if (!this.waypoints.has(id)) return;
            const waypoint = this.waypoints.get(id);
            if (waypoint.isRoad) {
                this.shareRoad(waypoint, Voxels.above);
                this.shareRoad(waypoint, Voxels.below);
            }

        });

        updated.forEach(id => {
            if (!this.waypoints.has(id)) return;
            this.waypoints.get(id).findRoads(surfaces, this);
        });

        updated.forEach(id => {
            if (!this.waypoints.has(id)) return;
            this.waypoints.get(id).validateRoads(this);
        });

        this.publish("paths", "updated", updated);
    }

    handleBuildRoad(data) {
        const xyz = data;
        this.buildRoad(xyz);

    }

    handleDemolish(data) {
        const xyz = data;
        this.demolishRoad(xyz);
    }

    buildRoad(xyz) {
        const id = Voxels.packXYZ(...xyz);
        if (!this.waypoints.has(id)) return;
        const waypoint = this.waypoints.get(id);
        //if (waypoint.isRoad) return;
        waypoint.isRoad = !waypoint.isRoad;
        this.shareRoad(waypoint, Voxels.above);
        this.shareRoad(waypoint, Voxels.below);

        let updated = Voxels.expandSetDiagonally([id]);
        updated = Voxels.expandSetDiagonally(updated);
        this.rebuildRoads(updated);

    }

    demolishRoad(xyz) {
        const id = Voxels.packXYZ(...xyz);
        if (!this.waypoints.has(id)) return;
        const waypoint = this.waypoints.get(id);
        if (!waypoint.isRoad) return;
        waypoint.isRoad = false;
        this.shareRoad(waypoint, Voxels.above);
        this.shareRoad(waypoint, Voxels.below);

        let updated = Voxels.expandSetDiagonally([id]);
        updated = Voxels.expandSetDiagonally(updated);
        this.rebuildRoads(updated);

    }

    // If a waypoint has a path in the given direction, mirrors its road state to that voxel

    shareRoad(waypoint, direction) {
        if (!waypoint.hasExitDirection(direction)) return;
        const neighbor = Voxels.adjacent(...waypoint.xyz, direction);
        const neighborID = Voxels.packXYZ(...neighbor);
        if (!this.waypoints.has(neighborID)) return;
        this.waypoints.get(neighborID).isRoad = waypoint.isRoad;
    }

    rebuildRoads(updated) {
        const surfaces = this.wellKnownModel("VoxelSurfaces");
        updated.forEach(id => {
            if (!this.waypoints.has(id)) return;
            this.waypoints.get(id).findRoads(surfaces, this);
        });

        updated.forEach(id => {
            if (!this.waypoints.has(id)) return;
            this.waypoints.get(id).validateRoads(this);
        });

        this.publish("paths", "updated", updated);
    }


    // Returns true if the start voxel has an exit that leads to the end voxel.
    // This is used during travel to make sure that terrain edits haven't broken the path we're using.

    hasExit(startID, endID) {
        if (!this.waypoints.has(startID)) return false;
        return this.waypoints.get(startID).hasExit(endID);
    }

    // Returns true if there is a road connecting two adjacent voxels

    hasRoad(startID, endID) {
        if (!this.waypoints.has(startID)) return false;
        const startWaypoint = this.waypoints.get(startID);
        if (!startWaypoint.isRoad) return false;
        return startWaypoint.hasRoad(endID);
    }

    getWaypoint(id) {
        return this.waypoints.get(id);
    }

    findPath(startID, endID, useRoad = true) {

        const path = [];

        if (!this.waypoints.has(startID)) return path;  // Invalid start waypoint
        if (!this.waypoints.has(endID)) return path;    // Invalid end waypoint

        const frontier = new QPriorityQueue((a, b) => a.priority < b.priority);
        const used = [];

        const start = this.waypoints.get(startID);
        const end = this.waypoints.get(endID);

        // Add start waypoint to frontier
        start.from = start;
        used.push(start);
        frontier.push({priority: 0, waypoint: start});

        // Iterate until frontier is empty or we find the end of the path
        let waypoint = null;
        while (!frontier.isEmpty) {
            const next = frontier.pop();
            waypoint = next.waypoint;
            if (waypoint === end) break;
            waypoint.exits.forEach(exit => {
                if (exit.id === -1) return; // No exit in that direction
                const link = this.waypoints.get(exit.id);
                let weight = exit.weight;
                if (useRoad && exit.road === 2) weight *= roadMultiplier;
                const cost = waypoint.cost + weight;
                if (link.from === null) { // First time visited
                    used.push(link);
                } else if (link.cost <= cost ) return; // A better route to this exit already exists
                link.cost = cost;
                link.from = waypoint;
                const heuristic = Math.abs(end.x - link.x) + Math.abs(end.y - link.y) + Math.abs(end.z - link.z);  // Manhattan distance
                const priority = cost + heuristic;
                frontier.push({priority, waypoint: link});
            });
        }

        if (waypoint === end) { // A path was found!

            // Run backwards along "from" links to build path array
            const backPath = [];
            while (waypoint !== start) {
                backPath.push(waypoint);
                waypoint = waypoint.from;
            }
            backPath.push(start);

            //Run forward to calculate voxel ids and add them to path
            while (backPath.length > 0) {
                waypoint = backPath.pop();
                path.push(waypoint.id);
            }
        }

        // Clean up waypoints in "used" array
        used.forEach(wp => wp.reset());

        return path;
    }

}

class Waypoint {

    constructor(xyz) {
        this.xyz = xyz;
        this.isRoad = false;
        this.exits = [
            {id: -1, weight: 0, road: 0},   // Road:    0 = road not possible
            {id: -1, weight: 0, road: 0},   //          1 = road possible but doesn't exist
            {id: -1, weight: 0, road: 0},   //          2 = road exists
            {id: -1, weight: 0, road: 0},
            {id: -1, weight: 0, road: 0},
            {id: -1, weight: 0, road: 0},
            {id: -1, weight: 0, road: 0},
            {id: -1, weight: 0, road: 0},
            {id: -1, weight: 0, road: 0},
            {id: -1, weight: 0, road: 0}
        ];

        // Pathfinding variables
        this.from = null;
        this.cost = 0;
    }

    get x() {return this.xyz[0];}
    get y() {return this.xyz[1];}
    get z() {return this.xyz[2];}

    get cx() {return this.x + 0.5;}
    get cy() {return this.y + 0.5;}
    get cz() {return this.z;}

    get id() {return Voxels.packXYZ(...this.xyz);}

    reset() {
        this.from = null;
        this.cost = 0;
    }

    hasExit(id) {
        const exits = this.exits;
        for (let i = 0; i < exits.length; i++) {
            if (id === exits[i].id) return true;
        }
        return false;
    }

    hasRoad(id) {
        const exits = this.exits;
        for (let i = 0; i < exits.length; i++) {
            if (id === exits[i].id && exits[i].road === 2) return true;
        }
        return false;
    }

    hasExitDirection(direction) {
        return this.exits[direction].id !== -1;
    }

    findExits(surfaces) {

        const surface = surfaces.getSurface(this.id);

        this.exits.forEach(exit => exit.id = -1);

        const above = Voxels.adjacent(...this.xyz, Voxels.above);
        const below = Voxels.adjacent(...this.xyz, Voxels.below);

        // -- Find side exits --

        const sideExits = surface.getSideExits();
        for (let a = 0; a < 4; a++) {
            const sideExit = sideExits[a];
            if (sideExit === 1) {   // This side has a bottom exit

                const side = Voxels.adjacent(...this.xyz, a);
                const sideID = Voxels.packXYZ(...side);
                if (surfaces.hasSurface(sideID)) {
                    const sideSurface = surfaces.getSurface(sideID);
                    const oppositeExits = sideSurface.getSideExits();
                    if (oppositeExits[opposite(a)] === 1) { // Side voxel also has bottom exit
                        this.exits[a].id = sideID;
                        this.exits[a].weight = sideFlatWeight;
                    }
                }

                const sideBelow = Voxels.adjacent(...below, a);
                const sideBelowID = Voxels.packXYZ(...sideBelow);
                if (surfaces.hasSurface(sideBelowID)) {
                    const sideSurface = surfaces.getSurface(sideBelowID);
                    const oppositeExits = sideSurface.getSideExits();
                    if (oppositeExits[opposite(a)] === 3) { // Side + below voxel has a top exit
                        this.exits[a].id = sideBelowID;
                        this.exits[a].weight = sideSlopeWeight;
                    }
                }

            } else if (sideExit === 2) {    // This side has a middle exit

                const side = Voxels.adjacent(...this.xyz, a);
                const sideID = Voxels.packXYZ(...side);
                if (surfaces.hasSurface(sideID)) {
                    const sideSurface = surfaces.getSurface(sideID);
                    const oppositeExits = sideSurface.getSideExits();
                    if (oppositeExits[opposite(a)] === 2) { // Side voxel also has a middle exit
                        this.exits[a].id = sideID;
                        this.exits[a].weight = sideFlatWeight * slopeEffort;
                    }
                }

            } else if (sideExit === 3) {    // This side has a top exit

                const sideAbove = Voxels.adjacent(...above, a);
                const sideAboveID = Voxels.packXYZ(...sideAbove);
                if (surfaces.hasSurface(sideAboveID)) {
                    const sideSurface = surfaces.getSurface(sideAboveID);
                    const oppositeExits = sideSurface.getSideExits();
                    if (oppositeExits[opposite(a)] === 1) { // Side + above voxel has a bottom exit
                        this.exits[a].id = sideAboveID;
                        this.exits[a].weight = sideSlopeWeight * slopeEffort;
                    }
                }
            }
        }

        // -- Find corner exits --

        const cornerExits = surface.getCornerExits();

        for (let a = 0; a < 4; a++) {
            const c = a+6;
            const cornerExit = cornerExits[a];

            if (cornerExit === 1) {   //This corner has a bottom exit

                const corner = Voxels.adjacent(...this.xyz, c);
                const cornerID = Voxels.packXYZ(...corner);
                if (surfaces.hasSurface(cornerID)) {
                    const cornerSurface = surfaces.getSurface(cornerID);
                    const oppositeExits = cornerSurface.getCornerExits();
                    if (oppositeExits[opposite(a)] === 1) { // Corner voxel also has bottom exit
                        this.exits[c].id = cornerID;
                        this.exits[c].weight = cornerFlatWeight;
                    }
                }

                const cornerBelow = Voxels.adjacent(...below, c);
                const cornerBelowID = Voxels.packXYZ(...cornerBelow);
                if (surfaces.hasSurface(cornerBelowID)) {
                    const cornerSurface = surfaces.getSurface(cornerBelowID);
                    const oppositeExits = cornerSurface.getCornerExits();
                    if (oppositeExits[opposite(a)] === 3) { // Corner + below voxel has top exit
                        this.exits[c].id = cornerBelowID;
                        this.exits[c].weight = cornerSlopeWeight;
                    }
                }
            } else if (cornerExit === 3) {    // This corner has a top exit

                const corner = Voxels.adjacent(...this.xyz, c);
                const cornerID = Voxels.packXYZ(...corner);
                if (surfaces.hasSurface(cornerID)) {
                    const cornerSurface = surfaces.getSurface(cornerID);
                    const oppositeExits = cornerSurface.getCornerExits();
                    if (oppositeExits[opposite(a)] === 3) { // Corner voxel also has a top exit
                        this.exits[c].id = cornerID;
                        this.exits[c].weight = cornerFlatWeight * slopeEffort;
                    }
                }

                const cornerAbove = Voxels.adjacent(...above, c);
                const cornerAboveID = Voxels.packXYZ(...cornerAbove);
                if (surfaces.hasSurface(cornerAboveID)) {
                    const cornerSurface = surfaces.getSurface(cornerAboveID);
                    const oppositeExits = cornerSurface.getCornerExits();
                    if (oppositeExits[opposite(a)] === 1) { // Corner + above voxel has a bottom exit
                        this.exits[c].id = cornerAboveID;
                        this.exits[c].weight = cornerSlopeWeight * slopeEffort;
                    }
                }
            }
        }

        // -- Find center exits --

        const centerExit = surface.getCenterExit();
        if (centerExit === 1) { // This voxel has a bottom center exit
            const belowID = Voxels.packXYZ(...below);
            if (surfaces.hasSurface(belowID)) {
                const belowSurface = surfaces.getSurface(belowID);
                const oppositeExit = belowSurface.getCenterExit();
                if (oppositeExit === 3) { // Below voxel has a top center exit
                    this.exits[Voxels.below].id = belowID;
                    this.exits[Voxels.below].weight = centerWeight;
                }
            }
        } else if (centerExit === 3) { // This voxel has a top center exit
            const aboveID = Voxels.packXYZ(...above);
            if (surfaces.hasSurface(aboveID)) {
                const aboveSurface = surfaces.getSurface(aboveID);
                const oppositeExit = aboveSurface.getCenterExit();
                if (oppositeExit === 1) { // Above voxel has a bottom center exit
                    this.exits[Voxels.above].id = aboveID;
                    this.exits[Voxels.above].weight = centerWeight * slopeEffort;
                }
            }
        }

    }

    findRoads(surfaces, paths) {
        const surface = surfaces.getSurface(this.id);
        this.exits.forEach((exit,i) => {
            exit.road = 0;
            if (exit.id === -1) return; // No exit
            const roadIndex = directionToRoadIndex(i);
            if (roadIndex === undefined) return; // Not a road direction.
            if (!surface.allowsRoad(roadIndex)) return; // No road allowed in that direction.
            const exitSurface = surfaces.getSurface(exit.id);
            if (!exitSurface.allowsRoad(oppositeRoad(roadIndex))) return; // No matching road from destination.
            exit.road = 1;
            if (!this.isRoad) return;
            const exitWaypoint = paths.getWaypoint(exit.id);
            if (!exitWaypoint.isRoad) return;
            exit.road = 2;
        });

        // Side roads suppress adjacent corner roads

        if (this.exits[6].road === 2) {
            if (this.exits[0].road === 2 || this.exits[1].road === 2) this.exits[6].road = 1;
        }

        if (this.exits[7].road === 2) {
            if (this.exits[1].road === 2 || this.exits[2].road === 2) this.exits[7].road = 1;
        }

        if (this.exits[8].road === 2) {
            if (this.exits[2].road === 2 || this.exits[3].road === 2) this.exits[8].road = 1;
        }

        if (this.exits[9].road === 2) {
            if (this.exits[3].road === 2 || this.exits[0].road === 2) this.exits[9].road = 1;
        }

    }

    // Makes sure all roads leading out of this waypoint match up with a road leading in.

    validateRoads(paths) {

    this.exits.forEach((exit, i) => {
        if (exit.road !== 2) return; // No road.
        const destination = paths.getWaypoint(exit.id);
        if (destination.exits[oppositeDirection(i)].road !== 2) exit.road = 1; // Suppress road if it doesn't have a matching partner
    });

    }

    roadExits() {
        const out = [false, false, false, false, false, false, false, false];
        out[0] = this.exits[Voxels.north].road === 2;
        out[1] = this.exits[Voxels.northEast].road === 2;
        out[2] = this.exits[Voxels.east].road === 2;
        out[3] = this.exits[Voxels.southEast].road === 2;

        out[4] = this.exits[Voxels.south].road === 2;
        out[5] = this.exits[Voxels.southWest].road === 2;
        out[6] = this.exits[Voxels.west].road === 2;
        out[7] = this.exits[Voxels.northWest].road === 2;
        return out;
    }

}

function opposite(side) {
    switch (side) {
        case 0: return 2;
        case 1: return 3;
        case 2: return 0;
        case 3: return 1;
        default: return 0;
    }
}

function oppositeDirection(direction) {
    switch (direction) {
        case Voxels.north:      return Voxels.south;
        case Voxels.northEast:  return Voxels.southWest;
        case Voxels.east:       return Voxels.west;
        case Voxels.southEast:  return Voxels.northWest;
        case Voxels.south:      return Voxels.north;
        case Voxels.southWest:  return Voxels.northEast;
        case Voxels.west:       return Voxels.east;
        case Voxels.northWest:  return Voxels.southEast;
        case Voxels.above:      return Voxels.below;
        case Voxels.below:      return Voxels.above;
        default:                return undefined;
    }
}

    // Converts a voxel direction into a road index

function directionToRoadIndex(direction) {
    switch (direction) {
        case Voxels.north:      return 0;
        case Voxels.northEast:  return 1;
        case Voxels.east:       return 2;
        case Voxels.southEast:  return 3;
        case Voxels.south:      return 4;
        case Voxels.southWest:  return 5;
        case Voxels.west:       return 6;
        case Voxels.northWest:  return 7;
        default:                return undefined;
    }
}

function roadIndexToDirection(roadIndex) {
    switch (roadIndex) {
        case 0:     return Voxels.north;
        case 1:     return Voxels.northEast;
        case 2:     return Voxels.east;
        case 3:     return Voxels.southEast;
        case 4:     return Voxels.south;
        case 5:     return Voxels.southWest;
        case 6:     return Voxels.west;
        case 7:     return Voxels.northWest;
        default:    return undefined;
    }
}

function oppositeRoad(roadIndex) {
    switch (roadIndex) {
        case 0: return 4;
        case 1: return 5;
        case 2: return 6;
        case 3: return 7;
        case 4: return 0;
        case 5: return 1;
        case 6: return 2;
        case 7: return 3;
        default: return 0;
    }
}
