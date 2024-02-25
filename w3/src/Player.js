//import {mat4, mat3, vec3, vec2} from 'gl-matrix';
import { QView, QTools, QCamera, m4_translation, m4_rotationX, m4_rotationZ, m4_multiply, v3_transform, v3_scale, v3_add, v3_cross } from "@croquet/q";
//import { m4_translation, m4_rotationX, m4_rotationZ, m4_multiply, v3_transform, v3_scale, v3_add, v3_cross} from "@croquet/q/src/QVector";
import { Voxels } from "./Voxels";
import { FilteredVoxelRaycast } from './VoxelRaycast';


const TICK_DELTA = 15; // Milliseconds between ticks

export class Player extends QView {

    constructor() {
        super();
        this.camera = new QCamera(QTools.toRad(60), 0.5, 10000.0);
//        this.position = vec3.fromValues(80,0, 110);
        this.position = [80,0, 110];
        this.pitch = QTools.toRad(45);
        this.yaw = 0;
        this.desiredYaw = 0;

        this.zSum = 0;
        this.zoom = 1;
        this.elevations = [200, 110, 80];
        this.pans = [2, 1, 0.5];

        this.rightOffset = 0;
        this.foreOffset = 0;
        this.upOffset = 0;

        this.foreSpeed = 0;
        this.backSpeed = 0;
        this.leftSpeed = 0;
        this.rightSpeed = 0;

        this.desiredFacing = 0;
        this.currentFacing = 0;
        this.camActor = null;

        this.subscribe("input", "xDelta", data => this.handleXDelta(data));
        this.subscribe("input", "yDelta", data => this.handleYDelta(data));
        this.subscribe("input", "zDelta", data => this.handleZDelta(data));

        this.subscribe("input", "touchDrag", data => this.handleTouchDrag(data));
        this.subscribe("input", "mouseDrag", data => this.handleMouseDrag(data));

        this.subscribe("input", "jump", () => this.handleJump());
        // this.subscribe("input", "togglePawnCam", () => this.handleTogglePawnCam());
        this.subscribe("input", "resize", data=> this.handleResize(data));

        this.subscribe("ui", "spinLeft", () => this.handleSpinLeft());
        this.subscribe("ui", "spinRight", () => this.handleSpinRight());
        this.subscribe("ui", "zoomIn", () => this.handleZoomIn());
        this.subscribe("ui", "zoomOut", () => this.handleZoomOut());

        this.subscribe("ui", "pawnCamera", () => this.handlePawnCamera());
        this.subscribe("ui", "normalCamera", () => this.handleNormalCamera());

        this.future(TICK_DELTA).tick();
    }


    handleTouchDrag(data) {
        const deltaX = data[0];
        const deltaY = data[1];
        this.rightOffset -= 30 * deltaX * this.pans[this.zoom];
        this.foreOffset -= 50 * deltaY * this.pans[this.zoom];
    }

    handleMouseDrag(data) {
        const cursor = this.getNamedView("QCursor");
        cursor.setVisibility(data === 0);
    }

    handleXDelta(data) {
        this.rightOffset -= 2 * data * this.pans[this.zoom];
    }

    handleYDelta(data) {
        this.foreOffset -= 2 * data * this.pans[this.zoom];
    }

    handleZDelta(data) {
        this.zSum += data;
        this.zSum = Math.max(-2000, this.zSum);
        this.zSum = Math.min(2000, this.zSum);
        if (this.zSum < -1000) {
            this.zoom = 2;
        } else if (this.zSum < 1000) {
            this.zoom = 1;
        } else {
            this.zoom = 0;
        }
    }

    handleTogglePawnCam() {
        if (this.camActor) {
            this.camActor = null;
        } else {
            const pawnRender = this.getNamedView("PawnRender");
            this.camActor = pawnRender.randomActor();
        }
    }

    handleJump() {
    }

    handleResize(data) {
        this.camera.setAspect(data[0], data[1]);
    }

    handleSpinLeft() {
        // const viewRoot = this.getNamedView("ViewRoot");
        // const width = viewRoot.ui.width;
        // const height = viewRoot.ui.height;
        // const pivot = this.project([width/2, height/2 ]);
        // console.log(pivot);
        this.desiredYaw += QTools.toRad(45);
        if (this.desiredYaw >= 2 * Math.PI) this.desiredYaw -= 2 * Math.PI;
    }

    handleSpinRight() {
        // const viewRoot = this.getNamedView("ViewRoot");
        // const width = viewRoot.ui.width;
        // const height = viewRoot.ui.height;
        // const pivot = this.project([width/2, height/2 ]);
        // console.log(pivot);
        this.desiredYaw += QTools.toRad(315);
        if (this.desiredYaw >= 2 * Math.PI) this.desiredYaw -= 2 * Math.PI;
    }

    handleZoomIn() {
        this.zoom = Math.min(2, this.zoom+1);
    }

    handleZoomOut() {
        this.zoom = Math.max(0, this.zoom-1);
    }

    handlePawnCamera() {
        const pawnRender = this.getNamedView("PawnRender");
        this.camActor = pawnRender.randomActor();
    }

    handleNormalCamera() {
        this.camActor = null;
    }

    project(screenXY) {
        const cameraAim = this.camera.screenLookRay( ...screenXY);
        cameraAim[0] /= Voxels.scaleX;
        cameraAim[1] /= Voxels.scaleY;
        cameraAim[2] /= Voxels.scaleZ;
        const voxelPosition = [];
        voxelPosition[0] = this.position[0] / Voxels.scaleX;
        voxelPosition[1] = this.position[1] / Voxels.scaleY;
        voxelPosition[2] = this.position[2] / Voxels.scaleZ;
        const voxelArray = FilteredVoxelRaycast(voxelPosition, cameraAim);
        const xyz = this.pivotFilter(voxelArray);
        return xyz;
    }

    pivotFilter(voxelArray) {
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

    tick() {

        if (this.camActor) {  // Follow view

            const actorPosition = this.camActor.getPosition();

            const cameraPosition = [];
            cameraPosition[0] = actorPosition[0] * Voxels.scaleX;
            cameraPosition[1] = actorPosition[1] * Voxels.scaleY;
            cameraPosition[2] = actorPosition[2] * Voxels.scaleZ + 2;

            this.desiredFacing = this.camActor.getFacing();
            let deltaFacing = this.desiredFacing - this.currentFacing;
            deltaFacing = Math.min(deltaFacing, QTools.toRad(1));
            deltaFacing = Math.max(deltaFacing, -QTools.toRad(1));
            this.currentFacing += deltaFacing;

            // const viewMatrix = mat4.multiply(mat4.create(), positionMatrix, rotationMatrix);

            const positionMatrix = m4_translation(cameraPosition);
            const pitchMatrix = m4_rotationX(QTools.toRad(90));
            const yawMatrix = m4_rotationZ(this.Yaw);
            const facingMatrix = m4_rotationZ(this.currentFacing);
            const rotationMatrix = m4_multiply(pitchMatrix, facingMatrix);
            const viewMatrix = m4_multiply(rotationMatrix, positionMatrix);
            this.camera.setTransform(viewMatrix);

        } else { // Normal view


            const step = QTools.toRad(2);
            const delta = this.desiredYaw - this.yaw;
            if (Math.abs(delta) < step) {
                this.yaw = this.desiredYaw;
            } else if ((delta > 0 && delta > Math.PI) || (delta < 0 && delta > -Math.PI)) {
                this.yaw += (2 * Math.PI - step);
                if (this.yaw >= (2 * Math.PI)) this.yaw -= (2 * Math.PI);
            } else {
                this.yaw += step;
                if (this.yaw >= (2 * Math.PI)) this.yaw -= (2 * Math.PI);
            }

            const stepZ = 2;
            const deltaZ = this.elevations[this.zoom] - this.position[2];
            if (Math.abs(deltaZ) < stepZ) {
                this.position[2] = this.elevations[this.zoom];
            } else if (deltaZ > 0 ) {
                this.position[2] += stepZ;
            } else {
                this.position[2] -= stepZ;
            }

            const pitchMatrix = m4_rotationX(this.pitch);
            const yawMatrix = m4_rotationZ(this.yaw);
            const rotationMatrix = m4_multiply(pitchMatrix, yawMatrix);

            const up = [0,0,1];
            const forward = v3_transform([0,0,-1], rotationMatrix);
            const right = v3_transform([1,0,0], rotationMatrix);
            const fore = v3_cross(right, up);

            this.position = v3_add(this.position, v3_scale(forward, (this.foreSpeed - this.backSpeed) * TICK_DELTA * 0.05));
            this.position = v3_add(this.position, v3_scale(up, this.upOffset / 200));
            this.position = v3_add(this.position, v3_scale(right, (this.rightSpeed - this.leftSpeed) * TICK_DELTA * 0.05));
            this.position = v3_add(this.position, v3_scale(right, this.rightOffset / 200));
            this.position = v3_add(this.position, v3_scale(fore, this.foreOffset / 200));

            this.upOffset = 0;
            this.rightOffset = 0;
            this.foreOffset = 0;

            const positionMatrix = m4_translation(this.position);
            const viewMatrix = m4_multiply(rotationMatrix, positionMatrix);

            this.camera.setTransform(viewMatrix);
        }

        this.future(TICK_DELTA).tick();
    }

}
