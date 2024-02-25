import { QNamedModel } from "@croquet/q";
import { Voxels } from "./Voxels";

// Voxel database extension that holds information about the surfaces of the voxel volume.
// The surfaces are the geometric elements that make up the surface of the terrain geometry.
// Entries in the surface database are always air voxels. They contain the geometry that defines
// the terrain that that air voxel touches.
//
// Primary surfaces are derived from the configuration of adjacent solid voxels.
// Secondary surfaces are derived from the configuration of adjacent primary surfaces.
//

const minElevation = -10000;

export class VoxelSurfaces extends QNamedModel {

    static types() {
        return { "W3:VoxelSurface": VoxelSurface };
    }

    init() {
        super.init("VoxelSurfaces");
        this.surfaces = new Map();

        // When a single voxel is changed, recalculate the primary surfaces in these nearby voxels.
        this.primaryOffsets = [ [0,0,1], [1,0,1], [-1,0,1], [0,1,1], [0,-1,1],
                                [0,0,0], [1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [1,1,0], [-1,1,0], [1,-1,0], [-1,-1,0], [2,0,0], [-2,0,0], [0,2,0], [0,-2,0],
                                [0,0,-1], [1,0,-1], [-1,0,-1], [0,1,-1], [0,-1,-1], [1,1,-1], [-1,1,-1], [1,-1,-1], [-1,-1,-1], [2,0,-1], [-2,0,-1], [0,2,-1], [0,-2,-1]];

        this.subscribe("voxels", "new", data => this.handleVoxelNew(data));
        this.subscribe("voxels", "set", data => this.handleVoxelSet(data));
    }

    hasSurface(id) {
        return this.surfaces.has(id);
    }

    getSurface(id) {
        if (this.surfaces.has(id)) return this.surfaces.get(id);
        return new VoxelSurface();
    }

    setSurface(id, surface) {
        if (surface.isNull()) {
            this.surfaces.delete(id);
        } else {
            this.surfaces.set(id, surface);
        }
    }

    // Returns the id of a random trasversable voxel
    getRandomTraversable() {
        const ids = Array.from(this.surfaces.keys());
        let safety = 20;
        do {
            const n = Math.floor(this.random() * ids.length);
            const id = ids[n];
            if (this.surfaces.get(id).isTraversable()) return id;
            safety--;
        } while (safety);
        console.error("Timeout trying to find traversable voxel!");
        return undefined;
    }

    // Returns true if the voxel is an air voxel with at least one adjacent solid voxel

    inPrimary(voxels, x,y,z) {
        const voxel = voxels.get(x,y,z);
        if (Voxels.isSolid(voxel)) return false;
        for (let a = 0; a < 6; a++) {
            const adjacent = Voxels.adjacent(x,y,z,a);
            if (Voxels.isValid(...adjacent)) {
                const neighbor = voxels.get(...adjacent);
                if (Voxels.isSolid(neighbor)) return true;
            }
        }
        return false;
    }

    // Builds the surface database from scratch from a new set of voxels.

    handleVoxelNew(data) {
        console.log("Building surfaces!");
        const voxels = data.voxels;
        this.surfaces = new Map();

        const primaries = new Set();

        for (let x = 0; x < Voxels.sizeX; x++) {
            for (let y = 0; y < Voxels.sizeY; y++) {
                for (let z = 0; z < Voxels.sizeZ; z++) {
                    if (this.inPrimary(voxels, x,y,z)) {
                        const id = Voxels.packXYZ(x,y,z);
                        primaries.add(id);
                    }
                }
            }
        }

        const secondaries = voxels.expandAirSet(primaries);

        primaries.forEach(id => {
            const xyz = Voxels.unpackXYZ(id);
            const surface = new VoxelSurface();
            surface.findFaces(...xyz,voxels);
            surface.findRamps(...xyz,voxels);
            this.setSurface(id, surface);
        });

        secondaries.forEach(id => {
            const xyz = Voxels.unpackXYZ(id);
            const surface = this.getSurface(id);
            surface.findFloors(...xyz, this.surfaces );
            surface.findTriangles(...xyz, this.surfaces);
            this.setSurface(id, surface);
        });

        secondaries.forEach(id => {
            const xyz = Voxels.unpackXYZ(id);
            const surface = this.getSurface(id);
            surface.findShims(...xyz, this.surfaces );
            surface.liftFloors();
            this.setSurface(id, surface);
        });

        // console.log(this.surfaces.size);

        this.publish("surfaces", "new");
    }

    // Updates the surface database when a single voxel is changed.

    handleVoxelSet(data) {

        const voxels = data.voxels;
        const x0 = data.x;
        const y0 = data.y;
        const z0 = data.z;

        // Clear out the previous entry for the changed voxel

        const id0 = Voxels.packXYZ(x0, y0, z0);
        const nullSurface = new VoxelSurface();
        this.setSurface(id0, nullSurface);
        const nullSet = new Set();
        nullSet.add(id0);
        this.publish("surfaces", "update", {surfaces: this, updated: nullSet});

        const primaries = new Set();

        this.primaryOffsets.forEach(offset => {
            const x = x0 + offset[0];
            const y = y0 + offset[1];
            const z = z0 + offset[2];
            if (Voxels.isValid(x,y,z)) {
                const voxel = voxels.get(x,y,z);
                if (!Voxels.isSolid(voxel)) {
                    const id = Voxels.packXYZ(x,y,z);
                    primaries.add(id);
                }
            }
        });

        const secondaries = voxels.expandAirSet(primaries);

        secondaries.forEach(id => {
            const xyz = Voxels.unpackXYZ(id);
            const surface = new VoxelSurface();
            surface.findFaces(...xyz, voxels);
            surface.findRamps(...xyz, voxels);
            this.setSurface(id, surface);
        });

        secondaries.forEach(id => {
            const xyz = Voxels.unpackXYZ(id);
            const surface = this.getSurface(id);
            surface.findFloors(...xyz, this.surfaces );
            surface.findTriangles(...xyz, this.surfaces);
            this.setSurface(id, surface);
        });

        secondaries.forEach(id => {
            const xyz = Voxels.unpackXYZ(id);
            const surface = this.getSurface(id);
            surface.findShims(...xyz, this.surfaces );
            surface.liftFloors();
            this.setSurface(id, surface);
        });

        this.publish("surfaces", "update", {surfaces: this, updated: secondaries});

    }

    // Given an id, returns the elevation of the surface in the voxel at the xy position, or -1 is there is none

    elevation(id, x, y) {
        if (!this.surfaces.has(id)) return minElevation;
        const surface = this.surfaces.get(id);
        return surface.elevation(x, y);
    }

    rawElevation(xyz) {
        const x = Math.floor(xyz[0]);
        const y = Math.floor(xyz[1]);
        let z = Math.floor(xyz[2]);
        const xf = xyz[0] - x;
        const yf = xyz[1] - y;
        while (z >= 0) {
            const id = Voxels.packXYZ(x,y,z);
            if (this.surfaces.has(id)) {
                const surface = this.surfaces.get(id);
                const e = surface.rawElevation(xf, yf);
                if (e !== undefined) return z + e;
            }
            z--;
        }
        return undefined;
    }

        // Given an id, returns the xy slope of the surface in the voxel at the xy position, or [0,0] is there is no surface

    slope(id, x, y) {
        if (!this.surfaces.has(id)) return [0,0];
        const surface = this.surfaces.get(id);
        return surface.slope(x, y);
    }

}

// -- Shapes --
//
// 0 = null
// 1 = sides only
// 2 = flat
// 3 = ramp
// 4 = half flat
// 5 = shim
// 6 = double ramp (ramp + ramp)
// 7 = wedge (half flat + shim)
// 8 = butterfly (shim + shim)
// 9 = cuban (shim + shim)
// 10 = left skew (ramp + left shim)
// 11 = right skew (ramp + right shim)

class VoxelSurface  {

    constructor() {
        this.shape = 0;
        this.facing = 0;
        this.faces = [0,0,0,0,0,0]; // voxel type
        this.sides = [0,0,0,0];     // 0 = solid, 1 = left, 2 = right
    }

    isNull() {
        return this.shape === 0;
    }

    // Returns true if a character can stand on the surface

    isTraversable() {
        switch (this.shape) {
            case 0:
            case 1:
                return false;
            default:
                return true;
        }
    }

    // Returns the elevation in voxel coordiates (0 to 1).
    // Returns min elevation if there is no surface.

    elevation(x,y) {

        // rotate to facing 0
        let xx = x;
        let yy = y;
        switch (this.facing) {
            case 1:
                xx = 1-y;
                yy = x;
                break;
            case 2:
                xx = 1-x;
                yy = 1-y;
                break;
            case 3:
                xx = y;
                yy = 1-x;
                break;
            default:
        }

        // find elevation based on shape
        switch (this.shape) {
            case 0:
            case 1:
                return minElevation;
            case 2:
                return 0;
            case 3:
                return yy;
            case 4:
                if (xx+yy < 1) return 1 - (xx + yy);    // Even though there's no surface here, this prevents bad edge conditions
                return 0;
            case 5:
                if (xx+yy < 1) return 1 - (xx + yy);    // Even though there's no surface here, this prevents bad edge conditions
                return (xx + yy) - 1;
            case 6:
                if (xx + yy < 1) return xx + yy;
                return 1;                               // Even though there's no surface here, this prevents bad edge conditions
            case 7:
                if (xx + yy < 1) return 0;
                return (xx + yy) - 1;
            case 8:
                if (xx + yy < 1) return 1 - (xx + yy);
                return (xx + yy) - 1;
            case 9:
                return Math.max(0, 1 - (xx + yy), xx - yy);
            case 10:
                return Math.max(yy, 1 - (xx + yy));
            case 11:
                return Math.max(yy, xx - yy);
            default:
        }
        return minElevation;
    }

    // Returns the elevation in voxel coordiates (0 to 1).
    // Returns undefined if there is no surface at this position.

    rawElevation(x,y) {

        // rotate to facing 0
        let xx = x;
        let yy = y;
        switch (this.facing) {
            case 1:
                xx = 1-y;
                yy = x;
                break;
            case 2:
                xx = 1-x;
                yy = 1-y;
                break;
            case 3:
                xx = y;
                yy = 1-x;
                break;
            default:
        }

        // find elevation based on shape
        switch (this.shape) {
            case 0:
            case 1:
                return undefined;
            case 2:
                return 0;
            case 3:
                return yy;
            case 4:
                if (xx + yy < 1) return undefined;
                return 0;
            case 5:
                if (xx + yy < 1) return undefined;
                return (xx + yy) - 1;
            case 6:
                if (xx + yy < 1) return xx + yy;
                return undefined;
            case 7:
                if (xx + yy < 1) return 0;
                return (xx + yy) - 1;
            case 8:
                if (xx + yy < 1) return 1 - (xx + yy);
                return (xx + yy) - 1;
            case 9:
                return Math.max(0, 1 - (xx + yy), xx - yy);
            case 10:
                return Math.max(yy, 1 - (xx + yy));
            case 11:
                return Math.max(yy, xx - yy);
            default:
        }
        return undefined;
    }

    // Returns the x slope in voxel coordiates (0 to 1).
    // If the surface only fills half the voxel (or none of it), returns -1.

    slope(x,y) {

        const slope = [0,0];

        // rotate to facing 0
        let xx = x;
        let yy = y;
        switch (this.facing) {
            case 1:
                xx = 1-y;
                yy = x;
                break;
            case 2:
                xx = 1-x;
                yy = 1-y;
                break;
            case 3:
                xx = y;
                yy = 1-x;
                break;
            default:
        }

        // find slope based on shape
        switch (this.shape) {
            case 0:
            case 1:
            case 2:
            case 4:
                return slope;
            case 3:
                slope[0] = 0;
                slope[1] = 1;
                break;
            case 5:
            case 7:
                if (xx + yy < 1) return slope;
                slope[0] = 1;
                slope[1] = 1;
                break;
            case 6:
                if (xx + yy > 1) return slope;
                slope[0] = 1;
                slope[1] = 1;
                break;
            case 8:
                if (xx + yy < 1) {
                    slope[0] = -1;
                    slope[1] = -1;
                } else {
                    slope[0] = 1;
                    slope[1] = 1;
                }
                break;
            case 9:
                if (xx + yy < 1 && 1 - x + y < 1) return slope;
                slope[1] = -1;
                if (xx < 0.5) {
                    slope[0] = -1;
                } else {
                    slope[0] = 1;
                }
                break;
            case 10:
                if (xx + 2*yy < 1) {
                    slope[0] = -1;
                    slope[1] = -1;
                } else {
                    slope[0] = 0;
                    slope[1] = 1;
                }
                break;
            case 11:
                if (1 - xx + 2*yy < 1) {
                    slope[0] = 1;
                    slope[1] = -1;
                } else {
                    slope[0] = 0;
                    slope[1] = 1;
                }
                break;
            default:
        }

        this.rotSlope(slope, this.facing);

        return slope;
    }

    // Rotates slope values clockwise

    rotSlope(slope, facing) {
        const dx = slope[0];
        const dy = slope[1];
        switch (facing) {
            case 1:
                slope[0] = dy;
                slope[1] = -dx;
                break;
            case 2:
                slope[0] = -dx;
                slope[1] = -dy;
                break;
            case 3:
                slope[0] = -dy;
                slope[1] = dx;
                break;
            default:
        }
    }

    getCenterExit() {
        switch (this.shape) {
            case 4:
            case 5:
                return 1;
            case 6:
                return 3;
            default:
                return 0;
        }
    }

    getSideExits() {
        let exits = [0, 0, 0, 0];
        switch (this.shape) {
            case 2:
                exits = [1, 1, 1, 1];
                break;
            case 3:
                exits = [3, 2, 1, 2];
                break;
            case 4:
                exits = [1, 1, 0, 0];
                break;
            case 5:
                exits = [2, 2, 0, 0];
                break;
            case 6:
                exits = [0, 0, 2, 2];
                break;
            case 7:
                exits = [2, 2, 1, 1];
                break;
            case 8:
                exits = [2, 2, 2, 2];
                break;
            case 9:
                exits = [1, 2, 2, 2];
                break;
            case 10:
                exits = [3, 2, 2, 2];
                break;
            case 11:
                exits = [3, 2, 2, 2];
                break;
            default:
        }
        this.rotA4(exits, this.facing);

        return exits;
    }

    getCornerExits() {
        let exits = [0, 0, 0, 0];
        switch (this.shape) {
            case 2:
                exits = [1, 1, 1, 1];
                break;
            case 3:
                exits = [3, 1, 1, 3];
                break;
            case 4:
                exits = [1, 1, 0, 1];
                break;
            case 5:
                exits = [3, 1, 0, 1];
                break;
            case 6:
                exits = [0, 3, 1, 3];
                break;
            case 7:
                exits = [3, 1, 1, 1];
                break;
            case 8:
                exits = [3, 1, 3, 1];
                break;
            case 9:
                exits = [1, 3, 3, 1];
                break;
            case 10:
                exits = [3, 1, 3, 3];
                break;
            case 11:
                exits = [3, 3, 1, 3];
                break;
            default:
        }
        this.rotA4(exits, this.facing);

        // Throw out exits on corners with adjacent solid faces.

        if ((this.faces[0] || this.faces[1])) exits[0] = 0;
        if ((this.faces[1] || this.faces[2])) exits[1] = 0;
        if ((this.faces[2] || this.faces[3])) exits[2] = 0;
        if ((this.faces[3] || this.faces[0])) exits[3] = 0;


        return exits;
    }

    // Given a road direction 0-7, returns true if this surface shape + facing allow a road in to run in that direction

    allowsRoad(direction) {
        switch (this.shape) {
            case 2:
                return true;
            case 3:
                if (this.facing * 2 === direction) return true;
                if (((this.facing + 2) * 2) % 8 === direction) return true;
                return false;
            case 4:
                if (this.facing * 2 === direction) return true;
                if (((this.facing + 1) * 2) % 8 === direction) return true;
                return false;
            case 7:
                if (((this.facing + 2) * 2) % 8 === direction) return true;
                if (((this.facing + 3) * 2) % 8 === direction) return true;
                return false;
            default:
                return false;
        }
    }

    // Returns an array with flags for whether there is a side road exit from this
    // voxel in specified direction.  Starts with north side and proceeds clockwise.

    getSideRoads() {
        let roads = [false, false, false, false];
        switch (this.shape) {
            case 2:
                roads = [true, true, true, true];
                break;
            case 3:
                roads = [true, false, true, false];
                break;
            case 4:
                roads = [true, true, false, false];
                break;
            case 7:
                roads = [false, false, true, true];
                break;
            // case 9:
            // case 10:
            // case 11:
            //     roads = [true, false, false, false];
            //     break;
            default:
        }
        this.rotA4(roads, this.facing);

        return roads;
    }

    // Returns an array with flags for whether there is a corner road exit from this
    // voxel in specified direction.  Starts with northeast corner and proceeds clockwise.

    getCornerRoads() {
        let roads = [false, false, false, false];
        switch (this.shape) {
            case 2:
                roads = [true, true, true, true];
                break;
            // case 4:
            // case 5:
            //     roads = [true, false, false, false];
            //     break;
            // case 6:
            //     roads = [false, false, true, false];
            //     break;
            // case 7:
            // case 8:
            //     roads = [true, false, true, false];
            //     break;
            default:
        }
        this.rotA4(roads, this.facing);

        return roads;
    }

    // Rotates the values of a 4 element array clockwise.

    rotA4(a, n) {
        const a0 = a[0];
        const a1 = a[1];
        const a2 = a[2];
        const a3 = a[3];
        switch (n) {
            case 1:
                a[0] = a3;
                a[1] = a0;
                a[2] = a1;
                a[3] = a2;
                break;
            case 2:
                a[0] = a2;
                a[1] = a3;
                a[2] = a0;
                a[3] = a1;
                break;
            case 3:
                a[0] = a1;
                a[1] = a2;
                a[2] = a3;
                a[3] = a0;
                break;
            default:
        }
    }

    hasNorthRamp() {
        if (this.facing === Voxels.north && (this.shape === 3 || this.shape === 6 || this.shape === 10 || this.shape === 11)) return true;
        if (this.facing === Voxels.west && this.shape === 6) return true;
        return false;
    }

    hasEastRamp() {
        if (this.facing === Voxels.east && (this.shape === 3 || this.shape === 6 || this.shape === 10 || this.shape === 11)) return true;
        if (this.facing === Voxels.north && this.shape === 6) return true;
        return false;
    }

    hasSouthRamp() {
        if (this.facing === Voxels.south && (this.shape === 3 || this.shape === 6 || this.shape === 10 || this.shape === 11)) return true;
        if (this.facing === Voxels.east && this.shape === 6) return true;
        return false;
    }

    hasWestRamp() {
        if (this.facing === Voxels.west && (this.shape === 3 || this.shape === 6 || this.shape === 10 || this.shape === 11)) return true;
        if (this.facing === Voxels.south && this.shape === 6) return true;
        return false;
    }

    // Finds the base information about adjacent faces

    findFaces(x,y,z, voxels) {

        this.shape = 0;
        this.facing = 0;
        this.faces.fill(0);
        this.sides.fill(0);

        for (let a = 0; a < 5; a++) {
            const adjacent = Voxels.adjacent(x,y,z,a);
            if (Voxels.isValid(...adjacent)) {
                const neighbor = voxels.get(...adjacent);
                if (Voxels.isSolid(neighbor)) {
                    this.faces[a] = neighbor;
                    this.shape = 1;
                }
            }
        }

        const below = Voxels.adjacent(x,y,z,Voxels.below);
        if (Voxels.isValid(...below)) {
            const belowVoxel = voxels.get(...below);
            if (Voxels.isSolid(belowVoxel)) {
                this.faces[Voxels.below] = belowVoxel;
                this.shape = 2;
            }
        }

    }

    // Finds the default ramps from the base face information

    findRamps(x,y,z, voxels) {

        const faces = this.faces;

        // No floor or low ceiling = no ramps

        if (faces[Voxels.above] || !faces[Voxels.below]) return;

        // Add a ramp if there's a face opposite a non-face.

        let ramp0 = false, ramp1 = false, ramp2 = false, ramp3 = false;

        if (faces[0] && !faces[2]) ramp0 = true;
        if (faces[1] && !faces[3]) ramp1 = true;
        if (faces[2] && !faces[0]) ramp2 = true;
        if (faces[3] && !faces[1]) ramp3 = true;

        // No ramps to nowhere -- ramps must lead up to empty voxels

        if (ramp0) {
            const side = Voxels.adjacent(x,y,z,Voxels.north);
            const sideAbove = Voxels.adjacent(...side, Voxels.above);
            if (!Voxels.isValid(...sideAbove) || Voxels.isSolid(voxels.get(...sideAbove))) ramp0 = false;
        }

        if (ramp1) {
            const side = Voxels.adjacent(x,y,z,Voxels.east);
            const sideAbove = Voxels.adjacent(...side, Voxels.above);
            if (!Voxels.isValid(...sideAbove) || Voxels.isSolid(voxels.get(...sideAbove))) ramp1 = false;
        }

        if (ramp2) {
            const side = Voxels.adjacent(x,y,z,Voxels.south);
            const sideAbove = Voxels.adjacent(...side, Voxels.above);
            if (!Voxels.isValid(...sideAbove) || Voxels.isSolid(voxels.get(...sideAbove))) ramp2 = false;
        }

        if (ramp3) {
            const side = Voxels.adjacent(x,y,z,Voxels.west);
            const sideAbove = Voxels.adjacent(...side, Voxels.above);
            if (!Voxels.isValid(...sideAbove) || Voxels.isSolid(voxels.get(...sideAbove))) ramp3 = false;
        }

        // No double ramps in tight spaces -- the diagonal voxel adjacent to the base corner of a double ramp must be empty.

        if (ramp0 && ramp1) {
            const south = Voxels.adjacent(x,y,z,Voxels.south);
            const sw = Voxels.adjacent(...south, Voxels.west);
            if (!Voxels.isValid(...sw) || Voxels.isSolid(voxels.get(...sw))) {
                ramp0 = false;
                ramp1 = false;
            }
        } else if ((ramp1 && ramp2)) {
            const north = Voxels.adjacent(x,y,z,Voxels.north);
            const nw = Voxels.adjacent(...north, Voxels.west);
            if (!Voxels.isValid(...nw) || Voxels.isSolid(voxels.get(...nw))) {
                ramp1 = false;
                ramp2 = false;
            }
        } else if ((ramp2 && ramp3)) {
            const north = Voxels.adjacent(x,y,z,Voxels.north);
            const ne = Voxels.adjacent(...north, Voxels.east);
            if (!Voxels.isValid(...ne) || Voxels.isSolid(voxels.get(...ne))) {
                ramp2 = false;
                ramp3 = false;
            }
        } else if ((ramp3 && ramp0)) {
            const south = Voxels.adjacent(x,y,z,Voxels.south);
            const se = Voxels.adjacent(...south, Voxels.east);
            if (!Voxels.isValid(...se) || Voxels.isSolid(voxels.get(...se))) {
                ramp3 = false;
                ramp0 = false;
            }
        }

        // Change shape to reflect ramps & delete hidden faces

        if (ramp0) {
            faces[0] = 0;
            if (ramp1) {
                faces[1] = 0;
                this.shape = 6;
                this.facing = 0;
            } else if (ramp3) {
                faces[3] = 0;
                this.shape = 6;
                this.facing = 3;
            } else {
                this.shape = 3;
                this.facing = 0;
            }
        } else if (ramp2) {
            faces[2] = 0;
            if (ramp1) {
                faces[1] = 0;
                this.shape = 6;
                this.facing = 1;
            } else if (ramp3) {
                faces[3] = 0;
                this.shape = 6;
                this.facing = 2;
            } else {
                this.shape = 3;
                this.facing = 2;
            }
        } else if (ramp1) {
            faces[1] = 0;
            this.shape = 3;
            this.facing = 1;
        } else if (ramp3) {
            faces[3] = 0;
            this.shape = 3;
            this.facing = 3;
        }
    }

    // Finds the half-flat surfaces at the top of double ramps.

    findFloors(x,y,z, surfaces) {

        const below = Voxels.adjacent(x,y,z,Voxels.below);
        const belowID = Voxels.packXYZ(...below);
        if (!surfaces.has(belowID)) return;
        const belowSurface = surfaces.get(belowID);
        if (belowSurface.shape !== 6) return; // Not a double ramp below
        this.shape = 4;
        this.facing = belowSurface.facing;
        this.faces[Voxels.below] = belowSurface.faces[Voxels.below];

    }

    // Find the triangles that block off the gaps at the sides of single and double ramps

    findTriangles(x,y,z, surfaces) {

        const faces = this.faces;
        const sides = this.sides;

        const north = Voxels.adjacent(x,y,z,Voxels.north);
        const northID = Voxels.packXYZ(...north);
        if (surfaces.has(northID)) {
            const northSurface = surfaces.get(northID);
            if (northSurface.hasWestRamp() && !this.hasWestRamp()) {
                faces[Voxels.north] = northSurface.faces[Voxels.below];
                sides[Voxels.north] = 1;
                if (this.shape === 0) this.shape = 1;
            } else if (northSurface.hasEastRamp() && !this.hasEastRamp()) {
                faces[Voxels.north] = northSurface.faces[Voxels.below];
                sides[Voxels.north] = 2;
                if (this.shape === 0) this.shape = 1;
            }
        }

        const east = Voxels.adjacent(x,y,z,Voxels.east);
        const eastID = Voxels.packXYZ(...east);
        if (surfaces.has(eastID)) {
            const eastSurface = surfaces.get(eastID);
            if (eastSurface.hasNorthRamp() && !this.hasNorthRamp()) {
                faces[Voxels.east] = eastSurface.faces[Voxels.below];
                sides[Voxels.east] = 1;
                if (this.shape === 0) this.shape = 1;
            } else if (eastSurface.hasSouthRamp() && !this.hasSouthRamp()) {
                faces[Voxels.east] = eastSurface.faces[Voxels.below];
                sides[Voxels.east] = 2;
                if (this.shape === 0) this.shape = 1;
            }
        }

        const south = Voxels.adjacent(x,y,z,Voxels.south);
        const southID = Voxels.packXYZ(...south);
        if (surfaces.has(southID)) {
            const southSurface = surfaces.get(southID);
            if (southSurface.hasEastRamp() && !this.hasEastRamp()) {
                faces[Voxels.south] = southSurface.faces[Voxels.below];
                sides[Voxels.south] = 1;
                if (this.shape === 0) this.shape = 1;
            } else if (southSurface.hasWestRamp() && !this.hasWestRamp()) {
                faces[Voxels.south] = southSurface.faces[Voxels.below];
                sides[Voxels.south] = 2;
                if (this.shape === 0) this.shape = 1;
            }
        }

        const west = Voxels.adjacent(x,y,z,Voxels.west);
        const westID = Voxels.packXYZ(...west);
        if (surfaces.has(westID)) {
            const westSurface = surfaces.get(westID);
            if (westSurface.hasSouthRamp() && !this.hasSouthRamp()) {
                faces[Voxels.west] = westSurface.faces[Voxels.below];
                sides[Voxels.west] = 1;
                if (this.shape === 0) this.shape = 1;
            } else if (westSurface.hasNorthRamp() && !this.hasNorthRamp()) {
                faces[Voxels.west] = westSurface.faces[Voxels.below];
                sides[Voxels.west] = 2;
                if (this.shape === 0) this.shape = 1;
            }
        }

    }

    // Extrude adjacent ramps into this voxel to create smooth terrain.
    // This uses the previously calculated side data.
    // Side and face data is left unchanged, which means there can be some hidden triangles behind the shim.

    findShims(x,y,z,surfaces) {

        const sides = this.sides;
        const faces = this.faces;

        if (!faces[Voxels.below]) return;

        const left0 = sides[0] === 2;
        const right0 = sides[1] === 1;
        const shim0 = (left0 && right0) || (left0 && faces[1]) || (faces[0] && right0);

        const left1 = sides[1] === 2;
        const right1 = sides[2] === 1;
        const shim1 = (left1 && right1) || (left1 && faces[2]) || (faces[1] && right1);

        const left2 = sides[2] === 2;
        const right2 = sides[3] === 1;
        const shim2 = (left2 && right2) || (left2 && faces[3]) || (faces[2] && right2);

        const left3 = sides[3] === 2;
        const right3 = sides[0] === 1;
        const shim3 = (left3 && right3) || (left3 && faces[0]) || (faces[3] && right3);

        // Delete hidden triangular faces

        if (shim0) {
            if (sides[0] === 2) faces[0] = 0;
            if (sides[1] === 1) faces[1] = 0;
        }

        if (shim1) {
            if (sides[1] === 2) faces[1] = 0;
            if (sides[2] === 1) faces[2] = 0;
        }

        if (shim2) {
            if (sides[2] === 2) faces[2] = 0;
            if (sides[3] === 1) faces[3] = 0;
        }

        if (shim3) {
            if (sides[3] === 2) faces[3] = 0;
            if (sides[0] === 1) faces[0] = 0;
        }

        // Update shape of voxel

        if (this.shape === 2) { // Currently flat
            if (shim0) {
                if (shim1) {
                    this.shape = 9;
                    this.facing = 3;
                } else if (shim2) {
                    this.shape = 8;
                    this.facing = 0;
                } else if (shim3) {
                    this.shape = 9;
                    this.facing = 2;
                } else {
                    this.shape = 7;
                    this.facing = 0;
                }
            } else if (shim1) {
                if (shim2) {
                    this.shape = 9;
                    this.facing = 0;
                } else if (shim3) {
                    this.shape = 8;
                    this.facing = 1;
                } else {
                    this.shape = 7;
                    this.facing = 1;
                }
            } else if (shim2) {
                if (shim3) {
                    this.shape = 9;
                    this.facing = 1;
                } else {
                    this.shape = 7;
                    this.facing = 2;
                }
            } else if (shim3) {
                this.shape = 7;
                this.facing = 3;
            }
        } else if (this.shape === 3) { // Currently ramp
            switch (this.facing) {
                case 0:
                    if (shim1) {
                        this.shape = 11;
                    } else if (shim2) {
                        this.shape = 10;
                    }
                    break;
                case 1:
                    if (shim2) {
                        this.shape = 11;
                    } else if (shim3) {
                        this.shape = 10;
                    }
                    break;
                case 2:
                    if (shim3) {
                        this.shape = 11;
                    } else if (shim0) {
                        this.shape = 10;
                    }
                    break;
                case 3:
                    if (shim0) {
                        this.shape = 11;
                    } else if (shim1) {
                        this.shape = 10;
                    }
                    break;
                default:
            }
        }
    }

    // Looks for the special case of a half floor above a double ramp.
    //

    liftFloors() {
        if (this.shape !== 4) return;
        const sides = this.sides;
        switch (this.facing) {
            case 0:
                if (sides[0] === 2 && sides[1] === 1) {
                    this.shape = 5;
                }
                break;
            case 1:
                if (sides[1] === 2 && sides[2] === 1) {
                    this.shape = 5;
                }
                break;
            case 2:
                if (sides[2] === 2 && sides[3] === 1) {
                    this.shape = 5;
                }
                break;
            case 3:
                if (sides[3] === 2 && sides[0] === 1) {
                    this.shape = 5;
                }
                break;
            default:
        }

    }

}
