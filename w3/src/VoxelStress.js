import { QModel } from "@croquet/q";
import { Voxels } from "./Voxels";

export class VoxelStress extends QModel {

    //-- Constants --

    static get maxStress() { return 10000; }
    static get tickInterval() { return 100; } // milliseconds -- this affects the collapse rate of unsupported terrain

    static strength(type) {
        switch (type) {
            case Voxels.rock:
                return 5;
            case Voxels.dirt:
                return 2;
            case Voxels.clay:
                return 3;
            case Voxels.sand:
                return 0;
            default:
                return VoxelStress.maxStress;
        }
    }

    init() {
        super.init();
        this.voxels = this.wellKnownModel("Voxels");
        this.stressed = new Map();
        this.collapsing = new Set();
        this.doomed = new Set();
        this.future(VoxelStress.tickInterval).tick();
        this.subscribe("voxels", "new", data => this.handleVoxelNew(data));
        this.subscribe("voxels", "set", data => this.handleVoxelSet(data));
    }

    // Returns the stress value if the voxel is in the extension and zero otherwise.

    getStress(id) {
        if (!this.stressed.has(id)) return 0;
        return this.stressed.get(id);
    }

    // Adds the voxel to the extension if if doesn't exist.
    // Deletes the voxel from the extension if the stress is zero.

    setStress(id, stress) {
        if (stress > 0) {
            this.stressed.set(id, stress);
        } else {
            this.stressed.delete(id);
        }
    }

        // Returns the lowest stress of the four horizontally-adjacent voxels.

    minAdjacentStress(x, y, z) {
        let minStress = VoxelStress.maxStress;
        for (let a = 0; a < 4; a++) {
            const adjacent = Voxels.adjacent(x, y, z, a);
            if (Voxels.isValid(...adjacent)) {
                const neighbor = this.voxels.get(...adjacent);
                if (Voxels.isSolid(neighbor)) {
                    minStress = Math.min(minStress, this.getStress(Voxels.packXYZ(...adjacent)));
                }
            }
        }
        return minStress;
    }

    // Returns true if voxel is on the bottom layer, or has a solid voxel underneath it.

    isSupported(x, y, z) {
        if (z === 0) return true;
        const below = Voxels.adjacent(x, y, z, Voxels.below);
        return (Voxels.isSolid(this.voxels.get(...below)));
    }

    // Recalcuates the entire stress extension from scratch.

    handleVoxelNew(data) {

        this.voxels = data.voxels;

        // Find all solid voxels with air directly below them and set their stress to max.

        for (let x = 0; x < Voxels.sizeX; x++) {
            for (let y = 0; y < Voxels.sizeY; y++) {
                let previousSolid = true;
                for (let z = 0; z < Voxels.sizeZ; z++) {
                    const isSolid = Voxels.isSolid(this.voxels.get(x,y,z));
                    if (isSolid && !previousSolid) this.stressed.set(Voxels.packXYZ(x,y,z), VoxelStress.maxStress);
                    previousSolid = isSolid;
                }
            }
        }

        let set0 = new Set();
        let set1 = new Set();

        // Find all voxels with stress of one

        this.stressed.forEach((stress, id) => {
            if (this.minAdjacentStress(...Voxels.unpackXYZ(id)) === 0) {
                this.stressed.set(id, 1);
                set0.add(id);
            }
        });

        // Starting with voxels with stress one, recursively reduce stress of their neighbors

        while (set0.size > 0) {
            set1.clear();
            set0.forEach(id => {
                const stress = this.getStress(id) + 1;
                for (let a = 0; a < 4; a++) {
                    const adjacent = Voxels.adjacent(...Voxels.unpackXYZ(id), a);
                    if (Voxels.isValid(...adjacent)) {
                        const adjacentID = Voxels.packXYZ(...adjacent);
                        if (stress < this.getStress(adjacentID)) {
                            this.setStress(adjacentID, stress);
                            set1.add(adjacentID);
                        }
                    }
                }
            });
            const swap = set0;
            set0 = set1;
            set1 = swap;
        }

        this.stressed.forEach((stress,id) => {
            if (stress > VoxelStress.strength(this.voxels.get(...Voxels.unpackXYZ(id)))) {
                this.collapsing.add(id);
            }
        });
    }

    handleVoxelSet(data) {
        const x = data.x;
        const y = data.y;
        const z = data.z;
        const type = data.type;

        if (Voxels.isSolid(type)) {
            this.updateStress(x,y,z);
        } else {
            this.stressed.delete(Voxels.packXYZ(x,y,z));
            this.updateAdjacentStress(x,y,z);
        }
    }

    // Recursively updates stress on adjacent solid voxels

    updateStress(x,y,z) {
        const id = Voxels.packXYZ(x,y,z);
        const oldStress = this.getStress(id);
        let newStress = 0;
        if (!this.isSupported(x,y,z)) newStress = Math.min(this.minAdjacentStress(x,y,z) + 1, VoxelStress.maxStress);
        if (newStress === oldStress) return; // No change so don't need to check for collapse or tell adjacent cells to update

        this.setStress(id, newStress);

        if (newStress > VoxelStress.strength(this.voxels.get(x,y,z))) {
            this.collapsing.add(id);
            return; // Don't tell adjacent cells to update -- this prevents ping-pong recursion between adjacent cells during a collapse.
        }

        this.updateAdjacentStress(x,y,z);

    }

    updateAdjacentStress(x,y,z) {
        for (let a = 0; a < 5; a++) {   // Update cells to the side and above
            const adjacent = Voxels.adjacent(x,y,z, a);
            if (Voxels.isValid(...adjacent) && Voxels.isSolid(this.voxels.get(...adjacent))) {
                this.updateStress(...adjacent);
            }
        }
    }

    tick() {

        this.doomed.clear();
        this.collapsing.forEach(id => {
            if (this.getStress(id) > VoxelStress.strength(this.voxels.get(...Voxels.unpackXYZ(id)))) this.doomed.add(id);
        });

        this.collapsing.clear();
        this.doomed.forEach(id => {
            this.voxels.set(...Voxels.unpackXYZ(id), Voxels.air);
        });

        this.future(VoxelStress.tickInterval).tick();
    }
}
