import { QNamedModel } from "@croquet/q";
import { Voxels } from "./Voxels";
import { VoxelSurfaces } from "./VoxelSurfaces";
import { VoxelStress } from "./VoxelStress";
import { Paths } from "./VoxelPaths";
import { ActorBoss } from "./Actor";

export class ModelRoot extends QNamedModel {

    init() {
        super.init("ModelRoot");
        this.voxels = Voxels.create();
        this.surfaces = VoxelSurfaces.create();
        this.stress = VoxelStress.create();
        this.paths = Paths.create();
        this.actorBoss = ActorBoss.create();
    }


}
