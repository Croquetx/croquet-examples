//import { vec3, mat4} from 'gl-matrix';
import { QView, UnitCube, QIndexedTriangles, QTransform, QKeyDown } from "@croquet/q";
import { Voxels } from './Voxels';
import { FilteredVoxelRaycast } from './VoxelRaycast';
import { m4_scaling, m4_translation } from "@croquet/q/src/QVector";

let pawnCount = 0;

export class VoxelCursor extends QView {

    constructor(player) {
        super();

        this.filter = null;
        this.action = null;
        this.player = player;
        this.position = [0,0,10];
        this.cursorPosition = [0,0];
        this.isBlockedByUI = false;
        this.isVisible = true;
        this.triangles = null;
        this.transform = new QTransform();

        this.buildGeometry();

        this.subscribe("ui", "mouseDown", () => this.handleEditAction());
        this.subscribe("ui", "mouseMove", data => this.handleCursorMove(data));
        this.subscribe("ui", "touchTap", data => this.handleTouchTap(data));
        this.subscribe("ui", "digMode", () => this.enterDigMode());
        this.subscribe("ui", "fillMode", () => this.enterFillMode());
        this.subscribe("ui", "spawnMode", () => this.enterSpawnMode());
        this.subscribe("ui", "roadMode", () => this.enterBuildRoadMode());

        this.enterDigMode();
    }

    buildGeometry() {
        const cubeSize = 0.75;
 //       const scaleMatrix = mat4.fromScaling(mat4.create(), [cubeSize, cubeSize, cubeSize]);
        const scaleMatrix = m4_scaling(cubeSize);

        const c0 = UnitCube();
        c0.transform(scaleMatrix);

//        const cornerMatrix = mat4.create();
        let cornerMatrix;

        const c1 = c0.clone();
        // mat4.fromTranslation(cornerMatrix, [Voxels.scaleX,0,0]);
        cornerMatrix = m4_translation([Voxels.scaleX,0,0]);
        c1.transform(cornerMatrix);

        const c2 = c0.clone();
        // mat4.fromTranslation(cornerMatrix, [0,Voxels.scaleY,0]);
        cornerMatrix = m4_translation([0,Voxels.scaleY,0]);
        c2.transform(cornerMatrix);

        const c3 = c0.clone();
        // mat4.fromTranslation(cornerMatrix, [0,0,Voxels.scaleZ]);
        cornerMatrix = m4_translation([0,0,Voxels.scaleZ]);
        c3.transform(cornerMatrix);

        const c4 = c0.clone();
        // mat4.fromTranslation(cornerMatrix, [Voxels.scaleX,Voxels.scaleY,0]);
        cornerMatrix = m4_translation([Voxels.scaleX,Voxels.scaleY,0]);
        c4.transform(cornerMatrix);

        const c5 = c0.clone();
        // mat4.fromTranslation(cornerMatrix, [Voxels.scaleX,0,Voxels.scaleZ]);
        cornerMatrix = m4_translation([Voxels.scaleX,0,Voxels.scaleZ]);
        c5.transform(cornerMatrix);

        const c6 = c0.clone();
        // mat4.fromTranslation(cornerMatrix, [0,Voxels.scaleY,Voxels.scaleZ]);
        cornerMatrix = m4_translation([0,Voxels.scaleY,Voxels.scaleZ]);
        c6.transform(cornerMatrix);

        const c7 = c0.clone();
        // mat4.fromTranslation(cornerMatrix, [Voxels.scaleX,Voxels.scaleY,Voxels.scaleZ]);
        cornerMatrix = m4_translation([Voxels.scaleX,Voxels.scaleY,Voxels.scaleZ]);
        c7.transform(cornerMatrix);

        this.triangles = new QIndexedTriangles();
        this.triangles.merge(c0);
        this.triangles.merge(c1);
        this.triangles.merge(c2);
        this.triangles.merge(c3);
        this.triangles.merge(c4);
        this.triangles.merge(c5);
        this.triangles.merge(c6);
        this.triangles.merge(c7);
        this.triangles.update();

    }

    handleCursorMove(data) {
        this.cursorPosition = data.position;
        this.isBlockedByUI = data.hovered;
        this.position = this.project(this.cursorPosition);
    }

    handleTouchTap(data) {
        const test = this.project(data);
        if (!test) return;
        if (this.position && this.position[0] === test[0] && this.position[1] === test[1]) {
            if (this.action) this.action();
            this.cursorPosition = null;
            this.position = null;
        } else {
            this.cursorPosition = data;
            this.position = this.project(this.cursorPosition);
        }
    }

    handleEditAction() {
        if (this.action) this.action();
    }

    project(screenXY) {
        const cameraAim = this.player.camera.screenLookRay( ...screenXY);
        cameraAim[0] /= Voxels.scaleX;
        cameraAim[1] /= Voxels.scaleY;
        cameraAim[2] /= Voxels.scaleZ;
        const voxelPosition = [];
        voxelPosition[0] = this.player.position[0] / Voxels.scaleX;
        voxelPosition[1] = this.player.position[1] / Voxels.scaleY;
        voxelPosition[2] = this.player.position[2] / Voxels.scaleZ;
        const voxelArray = FilteredVoxelRaycast(voxelPosition, cameraAim);
        const xyz = this.filter(voxelArray);
        return xyz;
    }


    draw() {
        if (!this.isVisible || this.isBlockedByUI || QKeyDown("mouse2") || !this.filter || !this.position) return;

        const xyz = [];
        xyz[0] = this.position[0];
        xyz[1] = this.position[1];
        xyz[2] = this.position[2];
        xyz[0] *= Voxels.scaleX;
        xyz[1] *= Voxels.scaleY;
        xyz[2] *= Voxels.scaleZ;
//        const positionMatrix = mat4.fromTranslation(mat4.create(), xyz);
        const positionMatrix = m4_translation(xyz);
        this.transform.setMatrix(positionMatrix);
        this.transform.apply();
        this.triangles.draw();
        this.triangles.drawHidden(0.2);


    }

    //-- Dig Mode --

    enterDigMode() {
        this.triangles.setColor([0.9,0.1,0.1,1]);
        this.triangles.update();
        this.filter = this.digFilter;
        this.action = this.digAction;
    }

    digFilter(voxelArray) {
        const viewRoot = this.getNamedView("ViewRoot");
        const voxels = viewRoot.modelRoot.wellKnownModel("Voxels");
        const topLayer = viewRoot.topLayer;
        for (let i = 0; i < voxelArray.length; i++) {
            const xyz = voxelArray[i];
            if (xyz[2] > 0 && xyz[2]< topLayer-1 && Voxels.isSolid(voxels.get(...xyz))) return xyz;
        }
        return null;
    }

    digAction() {
        if (!this.isVisible || this.isBlockedByUI || !this.position) return;
        if (!Voxels.isValid(...this.position)) return;
        if (this.position[2] === 0 ) return; // Can't dig in bottom row of voxels.
        const data = {xyz: this.position, type: Voxels.air};
        this.publish("player", "set voxel", data);
    }

    //-- Fill Mode --

    enterFillMode() {
        this.triangles.setColor([0.1,0.1,0.9,1]);
        this.triangles.update();
        this.filter = this.fillFilter;
        this.action = this.fillAction;
    }

    fillFilter(voxelArray) {
        const viewRoot = this.getNamedView("ViewRoot");
        const voxels = viewRoot.modelRoot.wellKnownModel("Voxels");
        const topLayer = viewRoot.topLayer;
        for (let i = 0; i < voxelArray.length; i++) {
            const xyz = voxelArray[i];
            if ((xyz[2] < topLayer) && (!Voxels.isSolid(voxels.get(...xyz)))) {
                const adjacent = Voxels.adjacent(...xyz, Voxels.below);
                if (Voxels.isValid(...adjacent)) {
                    const neighbor = voxels.get(...adjacent);
                    if (Voxels.isSolid(neighbor)) return xyz;
                }
            }
        }
        return null;
    }

    fillAction() {
        if (!this.isVisible || this.isBlockedByUI || !this.position) return;
        if (!Voxels.isValid(...this.position)) return;
        if (this.position[2] === Voxels.sizeZ-1) return; // Can't fill in top row of voxels.
        const data = {xyz: this.position, type: Voxels.dirt};
        this.publish("player", "set voxel", data);
    }

     //-- Spawn Mode --

     enterSpawnMode() {
        this.triangles.setColor([0.9,0.9,0.9,1]);
        this.triangles.update();
        this.filter = this.fillFilter;
        this.action = this.spawnAction;
    }

    spawnAction() {
        if (!this.isVisible || this.isBlockedByUI || !this.position) return;
        if (!Voxels.isValid(...this.position)) return;

        for (let i = 0; i < 10; i++) {
            const x = this.position[0] + 0.5;
            const y = this.position[1] + 0.5;
            const z = this.position[2] + 0.5;
            pawnCount++;

            this.publish("player", "spawnActor", [x,y,z]);
        }

    }

    //-- Build Road Mode --

    enterBuildRoadMode() {
        this.triangles.setColor([0.9,0.1,0.9,1]);
        this.triangles.update();
        this.filter = this.buildRoadFilter;
        this.action = this.buildRoadAction;
    }

    buildRoadAction() {
        if (!this.isVisible || this.isBlockedByUI || !this.position) return;
        this.publish("player", "buildRoad", this.position);
    }

    buildRoadFilter(voxelArray) {
        const viewRoot = this.getNamedView("ViewRoot");
        const surfaces = viewRoot.modelRoot.surfaces;
        const topLayer = viewRoot.topLayer;
        for (let i = 0; i < voxelArray.length; i++) {
            const xyz = voxelArray[i];
            if (xyz[2] < topLayer) {
                const id = Voxels.packXYZ(...xyz);
                if (surfaces.hasSurface(id) && surfaces.getSurface(id).isTraversable()) return xyz;
            }
        }
        return null;
    }

    //-- Structure Mode --

    enterStructureMode() {
        this.triangles.setColor([0.5,0.5,0.5,1]);
        this.triangles.update();
        this.filter = this.buildStructureFilter;
        this.action = this.buildStructureAction;
    }

    buildStructureAction() {
        if (!this.isVisible || this.isBlockedByUI || !this.position) return;
        console.log("Builld Structure!");
        this.publish("player", "demolish", this.position);
        // const below = Voxels.adjacent(...this.position, Voxels.below);
        // if (Voxels.isValid(below)) {
        //     const belowID = Voxels.packXYZ(...below);
        //     const surfaces = this.getNamedView("ViewRoot").modelRoot.surfaces;
        //     if (surfaces.hasSurface(belowID) && surfaces.getSurface(belowID).isTraversable()) {
        //         this.publish("player", "demolish", below);
        //     }
        // }
    }

    buildStructureFilter(voxelArray) {
        const viewRoot = this.getNamedView("ViewRoot");
        const surfaces = viewRoot.modelRoot.surfaces;
        const paths = viewRoot.modelRoot.paths;
        const topLayer = viewRoot.topLayer;
        for (let i = 0; i < voxelArray.length; i++) {
            const xyz = voxelArray[i];
            if (xyz[2] < topLayer) {
                const id = Voxels.packXYZ(...xyz);
                if (surfaces.hasSurface(id) && surfaces.getSurface(id).isTraversable()) {
                    if (paths.getWaypoint(id).isRoad) return xyz;
                }
            }
        }
        return null;
    }
}
