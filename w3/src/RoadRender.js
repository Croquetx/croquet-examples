//import { vec2 } from 'gl-matrix';
import { QNamedView, QView, QTools, QTriangles } from "@croquet/q";
import { v2_rotate, v2_scale, v2_add, v2_lerp, v2_sub } from "@croquet/q/src/QVector";
import { Voxels } from './Voxels';


const roadColor = [0.6, 0.6, 0.6, 1];

class RoadTile extends QView {
    constructor() {
        super();
        this.roadIDs = new Set();
        this.dirty = true;
        this.triangles = new QTriangles();
    }

    destroy() {
        this.triangles.destroy();
    }

    isEmpty() {
        return this.roadIDs.size === 0;
    }

    addRoadID(id) {
        this.roadIDs.add(id);
        this.dirty = true;
    }

    removeRoadID(id) {
        this.roadIDs.delete(id);
        this.dirty = true;
    }

    rebuild() {
        const paths = this.getNamedView("ViewRoot").modelRoot.paths;
        this.triangles.clear();
        this.roadIDs.forEach(id => {
            const waypoint = paths.getWaypoint(id);
            if (waypoint.hasExitDirection(Voxels.above)) return; // The top half of an up/down waypoint pair will handle the road.

            const roadExits = waypoint.roadExits();
            let count = 0;
            roadExits.forEach(exit => { if (exit) count++; });

            switch (count) {
                case 1:
                    this.build1(waypoint, roadExits);
                    break;
                case 2:
                    this.build2(waypoint, roadExits);
                    break;
                case 3:
                case 4:
                    this.build34(waypoint, roadExits);
                    break;
                default:
                    this.build0(waypoint);
                    break;
                }

            if (roadExits[5]) this.buildCorner00(waypoint);
            if (roadExits[7]) this.buildCorner01(waypoint);

        });

        this.triangles.update();
        this.triangles.clear();
        this.dirty = false;
    }

    build0(waypoint) {
        const center = [waypoint.cx, waypoint.cy, waypoint.cz];
        const steps = 32;
        const angle = 2 * Math.PI / steps;
        const rotor = [OCTAGON_SIDE * 0.5, 0];

        const circle = [];
        for (let i = 0; i < steps; i++) {
            const p = v2_rotate(rotor, angle*i);
            // vec2.rotate(p, rotor, [0,0], angle * i);
            circle.push([waypoint.cx + p[0], waypoint.cy + p[1], waypoint.cz]);
        }
        circle.push([...circle[0]]);

        this.format([center]);
        this.format(circle);

        this.triangles.addPie(center, circle, roadColor);

    }

    build1(waypoint, roadExits) {

        let side = 0;
        roadExits.forEach((exit,i)=> { if (exit) side = i; });

        const center = [waypoint.cx, waypoint.cy, waypoint.cz];
        const steps = 17;
        const angle = Math.PI / (steps-1);
        const rotor = [OCTAGON_SIDE * -0.5, 0];
        // const p = vec2.create();

        const perimeter = [];
        for (let i = 0; i < steps; i++) {
            const p = v2_rotate(rotor, angle*i);
//            vec2.rotate(p, rotor, [0,0], angle * i);
            perimeter.push([waypoint.cx + p[0], waypoint.cy + p[1], waypoint.cz]);
        }
        perimeter.push([waypoint.cx + OCTAGON_SIDE * 0.5, waypoint.cy + OCTAGON_SIDE * 0.5, waypoint.cz]);
        perimeter.push([waypoint.cx + OCTAGON_SIDE * 0.5, waypoint.y + 0.99999, waypoint.cz]);
        perimeter.push([waypoint.cx - OCTAGON_SIDE * 0.5, waypoint.y + 0.99999, waypoint.cz]);
        perimeter.push([waypoint.cx - OCTAGON_SIDE * 0.5, waypoint.cy + OCTAGON_SIDE * 0.5, waypoint.cz]);
        perimeter.push([...perimeter[0]]);

        this.rotate(perimeter, center, QTools.toRad(-45 * side));

        this.format([center]);
        this.format(perimeter);

        this.triangles.addPie(center, perimeter, roadColor);

    }

    build2(waypoint, roadExits) {
        let side1 = 0;
        for (let i = 0; i < 8; i++) {
            if (roadExits[i]) side1 = i;
        }
        let side0 = 0;
        for (let i = 7; i >= 0; i--) {
            if (roadExits[i]) side0 = i;
        }
        const gap = side1 - side0;

        if (gap === 1 || gap === 7) return;

        if (gap === 2 || gap === 6) {

            const arc0 = arc(side0, side1, 0, 16 );
            const arc1 = arc(side0, side1, 1, 16 );

            const right = [];
            arc0.forEach(p => {
                right.push([waypoint.x + p[0], waypoint.y + p[1], waypoint.z]);
            });

            const left = [];
            arc1.forEach(p => {
                left.push([waypoint.x + p[0], waypoint.y + p[1], waypoint.z]);
            });

            this.format(right);
            this.format(left);

            this.triangles.addStrip(right, left, roadColor);

        } else { // gap = 3,4,5

            const arc0 = arc(side0, side1, 0, 16);
            const arc1 = arc(side0, side1, 1, 16 );

            const center = [waypoint.cx, waypoint.cy, waypoint.cz];
            const perimeter = [];

            for (let i = 0; i < arc0.length; i++) {
                const p = arc0[i];
                perimeter.push([waypoint.x + p[0], waypoint.y + p[1], waypoint.z]);
            }

            for (let i = arc1.length-1; i >= 0; i--) {
                const p = arc1[i];
                perimeter.push([waypoint.x + p[0], waypoint.y + p[1], waypoint.z]);
            }

            perimeter.push([...perimeter[0]]);

            this.format([center]);
            this.format(perimeter);
            this.triangles.addPie(center, perimeter, roadColor);

        }
    }

    build34(waypoint, roadExits) {

        let start = 0;
        roadExits.forEach((exit,i)=> { if (exit) start = i; });

        const center = [waypoint.cx, waypoint.cy, waypoint.cz];
        const perimeter = [];

        let side0 = start;
        do {
            let side1 = (side0 + 7) % 8;
            while (!roadExits[side1]) side1 = (side1 + 7) % 8;
            const arc0 = arc(side0, side1, 0, 16);
            arc0.forEach(p => {
                perimeter.push([waypoint.x + p[0], waypoint.y + p[1], waypoint.z]);
            });
            side0 = side1;
        } while (side0 !== start);
        perimeter.push([...perimeter[0]]);

        this.format([center]);
        this.format(perimeter);
        this.triangles.addPie(center, perimeter, roadColor);

    }

    buildCorner00(waypoint) {
        let face = [
            [waypoint.x, waypoint.y - OCTAGON_INSET, waypoint.z],
            [waypoint.x + OCTAGON_INSET, waypoint.y, waypoint.z],
            [waypoint.x, waypoint.y + OCTAGON_INSET, waypoint.z],
            [waypoint.x - OCTAGON_INSET, waypoint.y, waypoint.z]
        ];
        this.scale(face);
        this.offset(face);
        this.triangles.addFace(face, roadColor);
        face = [
            [waypoint.x, waypoint.y - OCTAGON_INSET, waypoint.z],
            [waypoint.x, waypoint.y - OCTAGON_INSET, waypoint.z - 0.3],
            [waypoint.x + OCTAGON_INSET, waypoint.y, waypoint.z - 0.3],
            [waypoint.x + OCTAGON_INSET, waypoint.y, waypoint.z]
        ];
        this.scale(face);
        this.offset(face);
        this.triangles.addFace(face, roadColor);
        face = [
            [waypoint.x, waypoint.y + OCTAGON_INSET, waypoint.z],
            [waypoint.x, waypoint.y + OCTAGON_INSET, waypoint.z-0.3],
            [waypoint.x - OCTAGON_INSET, waypoint.y, waypoint.z-0.3],
            [waypoint.x - OCTAGON_INSET, waypoint.y, waypoint.z]
        ];
        this.scale(face);
        this.offset(face);
        this.triangles.addFace(face, roadColor);
    }

    buildCorner01(waypoint) {
        let face = [
            [waypoint.x, waypoint.y + 0.9999 - OCTAGON_INSET, waypoint.z],
            [waypoint.x + OCTAGON_INSET, waypoint.y + 0.9999, waypoint.z],
            [waypoint.x, waypoint.y + 0.9999 + OCTAGON_INSET, waypoint.z],
            [waypoint.x - OCTAGON_INSET, waypoint.y + 0.9999, waypoint.z]
        ];
        this.scale(face);
        this.offset(face);
        this.triangles.addFace(face, roadColor);
        face = [
            [waypoint.x, waypoint.y + 0.9999 - OCTAGON_INSET, waypoint.z],
            [waypoint.x - OCTAGON_INSET, waypoint.y + 0.9999, waypoint.z],
            [waypoint.x - OCTAGON_INSET, waypoint.y + 0.9999, waypoint.z-0.3],
            [waypoint.x, waypoint.y + 0.9999 - OCTAGON_INSET, waypoint.z-0.3],
        ];
        this.scale(face);
        this.offset(face);
        this.triangles.addFace(face, roadColor);
        face = [
            [waypoint.x, waypoint.y + 0.9999 + OCTAGON_INSET, waypoint.z],
            [waypoint.x + OCTAGON_INSET, waypoint.y + 0.9999, waypoint.z],
            [waypoint.x + OCTAGON_INSET, waypoint.y + 0.9999, waypoint.z-0.3],
            [waypoint.x, waypoint.y + 0.9999 + OCTAGON_INSET, waypoint.z-0.3]
        ];
        this.scale(face);
        this.offset(face);
        this.triangles.addFace(face, roadColor);
    }

    format(xyzs) {
        this.stamp(xyzs);
        this.scale(xyzs);
        this.offset(xyzs);
    }

    stamp(xyzs) {
        const surfaces = this.getNamedView("ViewRoot").modelRoot.surfaces;
        xyzs.forEach( xyz => {
            xyz[2] = surfaces.rawElevation(xyz);
        });
    }

    scale(xyzs) {
        xyzs.forEach( xyz => {
            xyz[0] *= Voxels.scaleX;
            xyz[1] *= Voxels.scaleY;
            xyz[2] *= Voxels.scaleZ;
        });
    }

    offset(xyzs) {
        xyzs.forEach( xyz => {
            xyz[2] += 0.01;
        });
    }

    rotate(xyzs, center, angle) {
        const c = [center[0], center[1]];
        xyzs.forEach( xyz => {
            // const p = [xyz[0], xyz[1]];
            const p = v2_rotate([xyz[0], xyz[1]], angle, c);
            // vec2.rotate(p, p, c, angle);
            xyz[0] = p[0];
            xyz[1] = p[1];
        });
    }

    draw() {
        if (this.dirty) this.rebuild();
        this.triangles.draw();
    }


}

class RoadLayer extends QView  {
    constructor(z) {
        super();
        this.z = z;
        this.roadTiles = new Map();
    }

    destroy() {
        this.clear();
    }

    clear() {
        this.roadTiles.forEach(tile => tile.destroy());
        this.roadTiles.clear();
    }

    isEmpty() {
        return (this.roadTiles.size === 0);
    }

    tileID(id) {
        const xyz = Voxels.unpackXYZ(id);
        const x = xyz[0] >> 5;            // Divide by 32
        const y = xyz[1] >> 5;            // Divide by 32
        return (x << 5 || y);
    }

    addRoadID(id) {
        const tileID = this.tileID(id);
        if (!this.roadTiles.has(tileID)) this.roadTiles.set(tileID, new RoadTile());
        const tile = this.roadTiles.get(tileID);
        tile.addRoadID(id);
    }

    removeRoadID(id) {
        const tileID = this.tileID(id);
        if (!this.roadTiles.has(tileID)) return;
        const tile = this.roadTiles.get(tileID);
        tile.removeRoadID(id);
        if (tile.isEmpty()) {
            this.roadTiles.get(tileID).destroy();
            this.roadTiles.delete(tileID);
        }
    }

    draw() {
        if (this.isEmpty()) return;
        this.roadTiles.forEach(tile => tile.draw());
    }
}

export class RoadRender extends QNamedView {
    constructor() {
        super("RoadRender");

        this.layers = [];
        for (let z = 0; z < Voxels.sizeZ; z++) this.layers.push(new RoadLayer(z));

        this.subscribe("paths", "new", () => this.handleNew());
        this.subscribe("paths", "updated", data => this.handleUpdate(data));

        this.start();
    }

    clear() {
        this.layers.forEach(layer => layer.clear());
    }

    start() {
        const paths = this.getNamedView("ViewRoot").modelRoot.paths;
        paths.waypoints.forEach((waypoint, id) => {
            const xyz = Voxels.unpackXYZ(id);
            if (waypoint.isRoad) {
                this.layers[xyz[2]].addRoadID(id);
            }
        });
    }

    handleNew() {
        this.clear();
        this.start();
    }

    handleUpdate(data) {
        const updated = data;
        const paths = this.getNamedView("ViewRoot").modelRoot.paths;
        updated.forEach(id=> {
            const xyz = Voxels.unpackXYZ(id);
            if (paths.waypoints.has(id) && paths.waypoints.get(id).isRoad) {
                this.layers[xyz[2]].addRoadID(id);
            } else {
                this.layers[xyz[2]].removeRoadID(id);
            }
        });
    }

    draw() {
        const viewRoot = this.getNamedView("ViewRoot");
        const topLayer = viewRoot.topLayer;
        for (let n = 0; n < topLayer; n++) {
            this.layers[n].draw();
        }
    }

}

// Helper Functions


const OCTAGON_INSET = (1 - 1/Math.tan(QTools.toRad(67.5))) / 2;
const OCTAGON_SIDE = 1 - 2 * OCTAGON_INSET;

// Returns the perimeter vertices for an octagon inscribed on a voxel.

function octagon() {
    const a = OCTAGON_INSET;
    const b = 1-OCTAGON_INSET;
    return [
        [a, 0.99999], [b, 0.99999],
        [0.99999, b], [0.99999, a],
        [b, 0.00001], [a, 0.00001],
        [0.00001, a], [0.00001, b]
    ];
}

// Finds the arc running from side0 to side1
// Lane is a value from 0-1 that determines the left/right offset of the arc
// lane = 0.0 right / lane = 0.5 middle / lane = 1.0 left

function arc(side0, side1, lane, steps) {
    const o = octagon();
    // const start = vec2.create();
    // const mid = vec2.create();
    // const end = vec2.create();
    // const p0 = vec2.create();
    // const p1 = vec2.create();

    // Find arc start point
    // vec2.scale(p0, o[side0], 1-lane);
    // vec2.scale(p1, o[(side0+1)%8], lane);
    // vec2.add(start, p0, p1);

    let p0 = v2_scale(o[side0], 1-lane);
    let p1 = v2_scale(o[(side0+1)%8], lane);
    const start = v2_add(p0, p1);

    // Find arc end point
    // vec2.scale(p0, o[side1], lane);
    // vec2.scale(p1, o[(side1+1)%8], 1-lane);
    // vec2.add(end, p0, p1);

    p0 = v2_scale(o[side1], lane);
    p1 = v2_scale(o[(side1+1)%8], 1-lane);
    const end = v2_add(p0, p1);

    // Find arc mid point
    // vec2.add(mid, start, end);
    // vec2.scale(mid, mid, 0.5);

    const mid = v2_lerp(start, end, 0.5);

    const gap = (8 + side1 - side0)%8;
    if (gap === 1 || gap === 7) return null;
    if (gap === 4) { // straight line
        return [start, mid, end];
    }
    const out = [];
    let angle = 0;
    if (gap === 2 ) {
        angle = QTools.toRad(90 / steps);
    } else if (gap === 3 ) { // Gap = 2 or 6
        angle = QTools.toRad(45 / steps);
    } else if (gap === 5) {
        angle = QTools.toRad(-45 / steps);
    } else if (gap === 6) {
        angle = QTools.toRad(-90 / steps);
    }
    const piv = pivot(side0, side1);
    for (let i = 0; i < steps; i++) {
        // const p = vec2.create();
        // vec2.rotate(p, start, piv, angle * i);
        const p = v2_rotate(start, angle * i, piv);
        out.push(p);
    }
    out.push(end);
    return out;
}

// Returns the pivot point of an arc connecting the two sides of an octagon
// Undefined if side0 = side1 or they are opposite each other
// 0 = north, proceeds clockwise

function pivot(side0, side1) {
    const o = octagon();
    const p0 = o[side0];
    const p1 = o[(side0+1)%8];
    // const delta = vec2.create();
    // vec2.sub(delta, p1, p0);
    // vec2.scale(delta, delta, 1/OCTAGON_SIDE);
    const delta = v2_scale(v2_sub(p1, p0), 1/OCTAGON_SIDE);
    // switch ((8 + side1 - side0)%8) {
    //     case 1: return p1;
    //     case 2: return vec2.scaleAndAdd(vec2.create(), p1, delta, OCTAGON_INSET);
    //     case 3: return vec2.add(vec2.create(), p1, delta);
    //     case 5: return vec2.scaleAndAdd(vec2.create(), p0, delta, -1);
    //     case 6: return vec2.scaleAndAdd(vec2.create(), p0, delta, -1 * OCTAGON_INSET);
    //     case 7: return p0;
    //     default: return undefined;
    // }
    switch ((8 + side1 - side0)%8) {
        case 1: return p1;
        case 2: return v2_add(p1, v2_scale(delta, OCTAGON_INSET));
        case 3: return v2_add(p1, delta);
        case 5: return v2_add(p0, v2_scale(delta, -1));
        case 6: return v2_add(p0, v2_scale(delta, -1 * OCTAGON_INSET));
        case 7: return p0;
        default: return undefined;
    }

}
