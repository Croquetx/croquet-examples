import { QNamedModel, QModel, QPerlinNoise } from "@croquet/q";

//------------------------------------------------------------------------------------------
//-- VoxelColumn ---------------------------------------------------------------------------
//------------------------------------------------------------------------------------------

class VoxelColumn  {

    constructor(counts=[Voxels.sizeZ], voxels=[Voxels.air]) {
        this.counts = new Uint16Array(counts);
        this.voxels = new Uint8Array(voxels);
    }

    get(z) {
        for (let i = 0; i < this.counts.length; i++) {
            z -= this.counts[i];
            if (z < 0) return this.voxels[i];
        }
        return undefined;
    }

    // This can probably be speeded up by not expanding and compressing the whole column.

    set(z, type) {
        const expanded = this.expand();
        if (expanded[z] === type) return false;
        expanded[z] = type;
        this.compress(expanded);
        return true;
    }

    // Expands the RLE voxel column into an uncompressed voxel array.

    expand() {
        const result = new Uint8Array(Voxels.sizeZ);
        let n = 0;
        for (let i = 0; i < this.counts.length; i++) {
            for (let j = 0; j < this.counts[i]; j++) {
                result[n++] = this.voxels[i];
            }
        }
        return result;
    }

    // Compresses an uncompress voxel array in an RLE voxel column.

    compress(input) {

        // Count changes
        let n = 1;
        let previous = input[0];
        for (let i = 1; i < input.length; i++) {
            if (input[i] !== previous) {
                n++;
                previous = input[i];
            }
        }

        // Allocate new buffers
        this.counts = new Uint16Array(n);
        this.voxels = new Uint8Array(n);

        // Compress
        let count = 1;
        n = 0;
        previous = input[0];
        for (let i = 1; i < input.length; i++) {
            if (input[i] !== previous) {
                this.counts[n] = count;
                this.voxels[n] = previous;
                count = 1;
                n++;
                previous = input[i];
            } else {
                count++;
            }
        }
        this.counts[n] = count;
        this.voxels[n] = previous;
    }

}

//------------------------------------------------------------------------------------------
//-- Voxels --------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------

export class Voxels extends QNamedModel {

    static types() {
        return {
            "W3:VoxelColumn": {
                cls: VoxelColumn,
                write: col => ({c: [...col.counts], v: [...col.voxels]}),
                read: ({c, v}) => new VoxelColumn(c, v),
            }
        };
    }

    //-- Constants --

    static get sizeX() { return 32; }
    static get sizeY() { return 32; }
    static get sizeZ() { return 32; }

    static get scaleX() { return 5; }
    static get scaleY() { return 5; }
    static get scaleZ() { return 3; }


    static get north() { return 0; }
    static get east() { return 1; }
    static get south() { return 2; }
    static get west() { return 3; }
    static get above() { return 4; }
    static get below() { return 5; }

    static get northEast() { return 6; }
    static get southEast() { return 7; }
    static get southWest() { return 8; }
    static get northWest() { return 9; }

    static get air() { return 0; }
    static get rock() { return 1; }
    static get dirt() { return 2; }
    static get clay() { return 3; }
    static get sand() { return 4; }

    static get room() { return 10; }     // Flattens terrain, supports what's above
    static get roof() { return 11; }     // Flattens terrain, no support
    static get column() { return 12; }   // Leaves terrain as-is, supports what's above
    static get spire() { return 13; }    // Leaves terrain as-is, no support

    static get gravity() {return 100 / Voxels.scaleZ; }             // Gravitational acceleration in voxels / second / second.
    static get terminalVelocity() { return 500 / Voxels.scaleZ; }    // Terminal falling velocity in voxels / second

    //-- Helper functions --

    static isValid(x, y, z) {
        if (x < 0) return false;
        if (x >= Voxels.sizeX) return false;
        if (y < 0) return false;
        if (y >= Voxels.sizeY) return false;
        if (z < 0) return false;
        if (z >= Voxels.sizeZ) return false;
        return true;
    }

    static adjacent(x,y,z, direction) {
        const out = [x,y,z];
        switch (direction) {
            case 0: // North
                out[1]++;
                break;
            case 1: // East
                out[0]++;
                break;
            case 2: // South
                out[1]--;
                break;
            case 3: // West
                out[0]--;
                break;
            case 4: // Above
                out[2]++;
                break;
            case 5: // Below
                out[2]--;
                break;
            case 6: // NorthEast
                out[0]++;
                out[1]++;
                break;
            case 7: // SouthEast
                out[0]++;
                out[1]--;
                break;
            case 8: // SouthWest
                out[0]--;
                out[1]--;
                break;
            case 9: // NorthWest
                out[0]--;
                out[1]++;
                break;
                default:
        }
        return out;
    }

    static isSolid(type) {
        if (type === Voxels.rock) return true;
        if (type === Voxels.dirt) return true;
        if (type === Voxels.clay) return true;
        if (type === Voxels.sand) return true;
        return false;
    }

    static packXYZ(x,y,z) {
        return (((x << 10) | y) << 10) | z;
    }

    static unpackXYZ(id) {
        const y = id >>> 10;
        const x = y >>> 10;
        return [x & 0x3FF, y & 0x3FF, id & 0x3FF];
    }

    static unpackZ(id) {
        return id & 0x3FF;
    }

    static floorXYZ(x, y, z) {
        return [Math.floor(x), Math.floor(y), Math.floor(z)];
    }

    // Given a set of voxel IDs, returns an expanded set that includes all horizontally adjacent valid voxels.

    static expandSet(voxelSet) {
        const expanded = new Set();
        voxelSet.forEach(id => {
            expanded.add(id);
            const xyz = Voxels.unpackXYZ(id);
            for (let a = 0; a < 6; a++) {
                const adjacent = Voxels.adjacent(...xyz,a);
                if (Voxels.isValid(...adjacent)) expanded.add(Voxels.packXYZ(...adjacent));
            }
        });
        return expanded;
    }

    // Given a set of voxel IDs, returns an expanded set that includes all adjacent valid voxels, both horizontal and diagonal.

    static expandSetDiagonally(voxelSet) {
        const expanded = new Set();
        voxelSet.forEach(id => {
            const xyz = Voxels.unpackXYZ(id);
            for (let dx = -1; dx < 2; dx++) {
                for (let dy = -1; dy < 2; dy++) {
                    for (let dz = -1; dz < 2; dz++) {
                        const x = xyz[0] + dx;
                        const y = xyz[1] + dy;
                        const z = xyz[2] + dz;
                        if (Voxels.isValid(x,y,z)) expanded.add(Voxels.packXYZ(x,y,z));
                    }
                }
            }
        });
        return expanded;
    }

    //-- Methods --

    init() {
        super.init("Voxels");
        this.generated = false;
        this.voxels = new Array(Voxels.sizeX);
        for (let x = 0; x < Voxels.sizeX; x++) {
            this.voxels[x] = new Array(Voxels.sizeY);
            for (let y = 0; y < Voxels.sizeY; y++) {
                this.voxels[x][y] = new VoxelColumn();
            }
        }
        this.subscribe("player", "generate voxels", () => this.generateOnce());
        this.subscribe("ui", "newLevel", () => this.generate());
        this.subscribe("player", "set voxel", data => this.setVoxel(data));
    }

    get(x, y, z) {
        return this.voxels[x][y].get(z);
    }

    set(x, y, z, type) {
        if (this.voxels[x][y].set(z, type)) {
            this.publish("voxels", "set", {voxels: this, x, y, z, type});
            return true;
        }
        return false;
    }

    setVoxel({xyz, type}) {
        this.set(...xyz, type);
    }

    generateOnce() {
        if (this.generated) return;
        this.generate();
    }

    generate() {
        this.generated = true;
        const rawVoxels = RawVoxels.create();
        rawVoxels.generate();
        for (let x = 0; x < Voxels.sizeX; x++) {
            for (let y = 0; y < Voxels.sizeY; y++) {
                this.voxels[x][y].compress(rawVoxels.voxels[x][y]);
            }
        }
        rawVoxels.destroy();
        console.log("Voxels generated!");
        this.publish("voxels", "new", {voxels: this});
    }

    // Given a set of voxel IDs, returns an expanded set that includes all adjacent air voxels.

    expandAirSet(voxelSet) {
        const expanded = new Set();
        voxelSet.forEach(id => {
            expanded.add(id);
            const xyz = Voxels.unpackXYZ(id);
            for (let a = 0; a < 6; a++) {
                const adjacent = Voxels.adjacent(...xyz,a);
                if (Voxels.isValid(...adjacent)) {
                    const neighbor = this.get(...adjacent);
                    if (!Voxels.isSolid(neighbor)) {
                        expanded.add(Voxels.packXYZ(...adjacent));
                    }
                }
            }
        });
        return expanded;
    }

    isBuildable(x, y, z) {
        const below = [x, y, z-1];
        if (Voxels.isValid(...below)) return false;
        const type = this.get(x,y,z);
        if (Voxels.isSolid(type)) return false;
        const belowType = this.get(...below);
    }

}

export class RawVoxels extends QModel {

    init() {
        super.init();
        this.voxels = new Array(Voxels.sizeX);
        for (let x = 0; x < Voxels.sizeX; x++) {
            this.voxels[x] = new Array(Voxels.sizeY);
            for (let y = 0; y < Voxels.sizeY; y++) {
                this.voxels[x][y] = new Uint8Array(Voxels.sizeZ);
                for (let z = 0; z < Voxels.sizeZ; z++) {
                    this.voxels[x][y][z] = Voxels.air;
                }
            }
        }
    }

    get(x, y, z) {
        return this.voxels[x][y][z];
    }

    set(x, y, z, type) {
        this.voxels[x][y][z] = type;
        return true;
    }

    generate() {
        const perlin = new QPerlinNoise();
        for (let x = 0; x < Voxels.sizeX; x++) {
            for (let y = 0; y < Voxels.sizeY; y++) {

                let height = 0;
                height += 16 * perlin.noise2D(x * 0.025, y * 0.025);
                height += 12 * perlin.noise2D(x * 0.05, y * 0.05);
                height += 6 * perlin.noise2D(x * 0.1, y * 0.1);
                height += 3 * perlin.noise2D(x * 0.2, y * 0.2);
                height += 2 * perlin.noise2D(x * 0.4, y * 0.4);
                height = Math.min(height, 63);

                // let height = 4 + this.random() * 8;
                // height = Math.max(10, height);

                // const height = 12;

                const rockHeight = height - 6;
                for (let z = 0; z < height; z++) {
                    this.voxels[x][y][z] = Voxels.dirt;
                }
                for (let z = 0; z < rockHeight; z++) {
                    this.voxels[x][y][z] = Voxels.rock;
                }

            }
        }
    }

}
