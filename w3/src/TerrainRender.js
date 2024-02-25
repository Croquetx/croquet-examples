//import {vec4} from 'gl-matrix';
import { QTriangles, QLines, QView } from "@croquet/q";
import { v4_max, v4_sub } from "@croquet/q/src/QVector";
import { Voxels } from "./Voxels";


class SurfaceTile extends QView {

    //-- Constants --

    constructor() {
        super();
        this.surfaceIDs = new Set();

        this.bottomTriangles = new QTriangles();
        this.middleTriangles = new QTriangles();
        this.topTriangles = new QTriangles();
        this.insideTriangles = new QTriangles();

        this.bottomLines = new QLines();
        this.middleLines = new QLines();
        this.topLines = new QLines();
        this.insideLines = new QLines();

        this.dirty = true;
    }

    isEmpty() {
        return this.surfaceIDs.size === 0;
    }

    addSurfaceID(id) {
        this.surfaceIDs.add(id);
        this.dirty = true;
    }

    removeSurfaceID(id) {
        this.surfaceIDs.delete(id);
        this.dirty = true;
    }

    rebuild() {

        const viewRoot = this.getNamedView("ViewRoot");
        const surfaces = viewRoot.modelRoot.wellKnownModel("VoxelSurfaces");

        this.bottomTriangles.clear();
        this.middleTriangles.clear();
        this.topTriangles.clear();
        this.insideTriangles.clear();

        this.bottomLines.clear();
        this.middleLines.clear();
        this.topLines.clear();
        this.insideLines.clear();

        this.surfaceIDs.forEach(id => {
            const surface = surfaces.getSurface(id);
            this.buildSurfaceGeometry(...Voxels.unpackXYZ(id), surface);
        }, this);

        this.dirty = false;
    }

    buildSurfaceGeometry(x,y,z, surface) {

        const x0 = x * Voxels.scaleX;
        const y0 = y * Voxels.scaleY;
        const z0 = z * Voxels.scaleZ;

        const x1 = x0 + Voxels.scaleX;
        const y1 = y0 + Voxels.scaleY;
        const z1 = z0 + Voxels.scaleZ;

        const x2 = x0 + Voxels.scaleX * 0.5;
        const y2 = y0 + Voxels.scaleY * 0.5;
        const z2 = z0 + Voxels.scaleZ * 0.5;

        let face = [];

        const shape = surface.shape;
        const facing = surface.facing;
        const faces = surface.faces;
        const sides = surface.sides;

        // -- north --
        if (faces[Voxels.north]) {
            const faceColor = voxelSideColor(faces[Voxels.north]);
            const lineColor = voxelLineColor(faceColor);
            switch (sides[0]) {
                case 0: // Solid face
                    face = [[x0, y1, z0], [x1, y1, z0],  [x1, y1, z1], [x0, y1, z1]];
                    break;
                case 1: // Left slope
                    face = [[x0, y1, z0], [x1, y1, z0],  [x0, y1, z1]];
                    break;
                case 2: // Right slope
                    face = [[x0, y1, z0], [x1, y1, z0],  [x1, y1, z1]];
                    break;
                default:
            }
            this.middleTriangles.addFace(face, faceColor );
            this.middleLines.addFace(face, lineColor);
        }

        // -- east --
        if (faces[Voxels.east]) {
            const faceColor = voxelSideColor(faces[Voxels.east]);
            const lineColor = voxelLineColor(faceColor);
            switch (sides[1]) {
                case 0: // Solid face
                    face = [[x1, y1, z0], [x1, y0, z0], [x1, y0, z1],  [x1, y1, z1]];
                    break;
                case 1: // Left slope
                    face = [[x1, y1, z0], [x1, y0, z0], [x1, y1, z1]];
                    break;
                case 2: // Right slope
                    face = [[x1, y1, z0], [x1, y0, z0], [x1, y0, z1]];
                    break;
                default:
            }
            this.middleTriangles.addFace(face, faceColor);
            this.middleLines.addFace(face, lineColor);
        }

        // -- south --
        if (faces[Voxels.south]) {
            const faceColor = voxelSideColor(faces[Voxels.south]);
            const lineColor = voxelLineColor(faceColor);
            switch (sides[2]) {
                case 0: // Solid face
                    face = [[x1, y0, z0], [x0, y0, z0], [x0, y0, z1], [x1, y0, z1]];
                    break;
                case 1: // Left slope
                    face = [[x1, y0, z0], [x0, y0, z0], [x1, y0, z1]];
                    break;
                case 2: // Right slope
                    face = [[x1, y0, z0], [x0, y0, z0], [x0, y0, z1]];
                    break;
                default:
            }
            this.middleTriangles.addFace(face, faceColor);
            this.middleLines.addFace(face, lineColor);
        }

        // -- west --
        if (faces[Voxels.west]) {
            const faceColor = voxelSideColor(faces[Voxels.west]);
            const lineColor = voxelLineColor(faceColor);
            switch (sides[3]) {
                case 0: // Solid face
                    face = [[x0, y0, z0], [x0, y1, z0],  [x0, y1, z1], [x0, y0, z1]];
                    break;
                case 1: // Left slope
                    face = [[x0, y0, z0], [x0, y1, z0],  [x0, y0, z1]];
                    break;
                case 2: // Right slope
                    face = [[x0, y0, z0], [x0, y1, z0],  [x0, y1, z1]];
                    break;
                default:
            }
            this.middleTriangles.addFace(face, faceColor);
            this.middleLines.addFace(face, lineColor);
        }

        //-- above --
        if (faces[Voxels.above]) {
            const faceColor = voxelSideColor(faces[Voxels.above]);
            const lineColor = voxelLineColor(faceColor);
            face = [[x0, y0, z1], [x0, y1, z1],  [x1, y1, z1], [x1, y0, z1]];
            this.topTriangles.addFace(face, faceColor);
            this.topLines.addFace(face, lineColor);
        }

        //-- below --
        if (faces[Voxels.below]) {
            const faceColor = voxelTopColor(faces[Voxels.below]);
            const lineColor = voxelLineColor(faceColor);
            const insideColor = voxelInsideColor(faces[Voxels.below]);
            const insideLineColor = voxelLineColor(insideColor);
            switch (shape) {
                case 1: // Sides Only
                    break;
                case 2: // Flat
                    face = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]];
                    this.bottomTriangles.addFace(face, faceColor);
                    this.bottomLines.addFace(face, lineColor);
                    break;
                case 3: // Ramp
                    switch (facing) {
                        case 0:
                            face = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z1], [x0, y1, z1]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            break;
                        case 1:
                            face = [[x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            break;
                        case 2:
                            face = [[x0, y0, z1], [x1, y0, z1], [x1, y1, z0], [x0, y1, z0]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            break;
                        case 3:
                            face = [[x0, y0, z1], [x1, y0, z0], [x1, y1, z0], [x0, y1, z1]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            break;
                        default:
                    }
                    face = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]];
                    this.insideTriangles.addFace(face, insideColor);
                    this.insideLines.addFace(face, insideLineColor);
                    break;
                case 4: // Half flat
                    switch (facing) {
                        case 0:
                            face = [[x1, y1, z0], [x0, y1, z0], [x1, y0, z0]];
                            this.bottomTriangles.addFace(face, faceColor);
                            this.bottomLines.addFace(face, lineColor);
                            break;
                        case 1:
                            face = [[x1, y0, z0], [x1, y1, z0], [x0, y0, z0]];
                            this.bottomTriangles.addFace(face, faceColor);
                            this.bottomLines.addFace(face, lineColor);
                            break;
                        case 2:
                            face = [[x0, y0, z0], [x1, y0, z0], [x0, y1, z0]];
                            this.bottomTriangles.addFace(face, faceColor);
                            this.bottomLines.addFace(face, lineColor);
                            break;
                        case 3:
                            face = [[x0, y1, z0], [x0, y0, z0], [x1, y1, z0]];
                            this.bottomTriangles.addFace(face, faceColor);
                            this.bottomLines.addFace(face, lineColor);
                            break;
                        default:
                    }
                    break;
                case 5: // Half slope
                    switch (facing) {
                        case 0:
                            face = [[x1, y1, z1], [x0, y1, z0], [x1, y0, z0]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            face = [[x1, y1, z0], [x0, y1, z0], [x1, y0, z0]];
                            this.insideTriangles.addFace(face,insideColor);
                            this.insideLines.addFace(face, insideLineColor);
                            break;
                        case 1:
                            face = [[x1, y0, z1], [x1, y1, z0], [x0, y0, z0]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            face = [[x1, y0, z0], [x1, y1, z0], [x0, y0, z0]];
                            this.insideTriangles.addFace(face,insideColor);
                            this.insideLines.addFace(face, insideLineColor);
                            break;
                        case 2:
                            face = [[x0, y0, z1], [x1, y0, z0], [x0, y1, z0]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            face = [[x0, y0, z0], [x1, y0, z0], [x0, y1, z0]];
                            this.insideTriangles.addFace(face,insideColor);
                            this.insideLines.addFace(face, insideLineColor);
                            break;
                        case 3:
                            face = [[x0, y1, z1], [x0, y0, z0], [x1, y1, z0]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            face = [[x0, y1, z0], [x0, y0, z0], [x1, y1, z0]];
                            this.insideTriangles.addFace(face,insideColor);
                            this.insideLines.addFace(face, insideLineColor);
                            break;
                        default:
                    }
                    break;
                case 6: // Double Ramp
                    switch (facing) {
                        case 0:
                            face = [[x0, y0, z0], [x1, y0, z1], [x0, y1, z1]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            break;
                        case 1:
                            face = [[x0, y1, z0], [x0, y0, z1], [x1, y1, z1]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            break;
                        case 2:
                            face = [[x1, y1, z0], [x0, y1, z1], [x1, y0, z1]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            break;
                        case 3:
                            face = [[x1, y0, z0], [x1, y1, z1], [x0, y0, z1]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            break;
                        default:
                    }
                    face = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]];
                    this.insideTriangles.addFace(face, insideColor);
                    this.insideLines.addFace(face, insideLineColor);
                    break;
                case 7: // Flat + slope
                    switch (facing) {
                        case 0:
                            face = [[x0, y0, z0], [x1, y0, z0], [x0, y1, z0]];
                            this.bottomTriangles.addFace(face, faceColor);
                            this.bottomLines.addFace(face, lineColor);
                            face = [[x1, y1, z1], [x0, y1, z0], [x1, y0, z0]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            face = [[x1, y1, z0], [x0, y1, z0], [x1, y0, z0]];
                            this.insideTriangles.addFace(face, insideColor);
                            this.insideLines.addFace(face, insideLineColor);
                            break;
                        case 1:
                            face = [[x0, y1, z0], [x0, y0, z0], [x1, y1, z0]];
                            this.bottomTriangles.addFace(face, faceColor);
                            this.bottomLines.addFace(face, lineColor);
                            face = [[x1, y0, z1], [x1, y1, z0], [x0, y0, z0]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            face = [[x1, y0, z0], [x1, y1, z0], [x0, y0, z0]];
                            this.insideTriangles.addFace(face, insideColor);
                            this.insideLines.addFace(face, insideLineColor);
                            break;
                        case 2:
                            face = [[x1, y1, z0], [x0, y1, z0], [x1, y0, z0]];
                            this.bottomTriangles.addFace(face, faceColor);
                            this.bottomLines.addFace(face, lineColor);
                            face = [[x0, y0, z1], [x1, y0, z0], [x0, y1, z0]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            face = [[x0, y0, z0], [x1, y0, z0], [x0, y1, z0]];
                            this.insideTriangles.addFace(face, insideColor);
                            this.insideLines.addFace(face, insideLineColor);
                            break;
                        case 3:
                            face = [[x1, y0, z0], [x1, y1, z0], [x0, y0, z0]];
                            this.bottomTriangles.addFace(face, faceColor);
                            this.bottomLines.addFace(face, lineColor);
                            face = [[x0, y1, z1], [x0, y0, z0], [x1, y1, z0]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            face = [[x0, y1, z0], [x0, y0, z0], [x1, y1, z0]];
                            this.insideTriangles.addFace(face, insideColor);
                            this.insideLines.addFace(face, insideLineColor);
                            break;
                        default:
                    }
                    break;
                case 8: // butterfly = slope + slope
                    switch (facing) {
                        case 0:
                        case 2:
                            face = [[x0, y0, z1], [x1, y0, z0], [x0, y1, z0]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            face = [[x1, y1, z1], [x0, y1, z0], [x1, y0, z0]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            break;
                        case 1:
                        case 3:
                            face = [[x0, y1, z1], [x0, y0, z0], [x1, y1, z0]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            face = [[x1, y0, z1], [x1, y1, z0], [x0, y0, z0]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            break;
                        default:
                    }
                    face = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]];
                    this.insideTriangles.addFace(face, insideColor);
                    this.insideLines.addFace(face, insideLineColor);
                    break;
                case 9: // cuban flag = slope + slope
                    switch (facing) {
                        case 0:
                            face = [[x2, y2, z0], [x1, y1, z0], [x0, y1, z0]];
                            this.bottomTriangles.addFace(face, faceColor);
                            this.bottomLines.addFace(face, lineColor);
                            face = [[x2, y2, z0], [x0, y1, z0], [x0, y0, z1], [x2, y0, z2]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            face = [[x2, y2, z0], [x0, y1, z0], [x0, y0, z0], [x2, y0, z0]];
                            this.insideTriangles.addFace(face, insideColor);
                            this.insideLines.addFace(face, insideLineColor);
                            face = [[x2, y2, z0], [x2, y0, z2], [x1, y0, z1], [x1, y1, z0]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            face = [[x2, y2, z0], [x2, y0, z0], [x1, y0, z0], [x1, y1, z0]];
                            this.insideTriangles.addFace(face, insideColor);
                            this.insideLines.addFace(face, insideLineColor);
                            break;
                        case 1:
                            face = [[x2, y2, z0], [x1, y0, z0], [x1, y1, z0]];
                            this.bottomTriangles.addFace(face, faceColor);
                            this.bottomLines.addFace(face, lineColor);
                            face = [[x2, y2, z0], [x1, y1, z0], [x0, y1, z1], [x0, y2, z2]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            face = [[x2, y2, z0], [x1, y1, z0], [x0, y1, z0], [x0, y2, z0]];
                            this.insideTriangles.addFace(face, insideColor);
                            this.insideLines.addFace(face, insideLineColor);
                            face = [[x2, y2, z0], [x0, y2, z2], [x0, y0, z1], [x1, y0, z0]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            face = [[x2, y2, z0], [x0, y2, z0], [x0, y0, z0], [x1, y0, z0]];
                            this.insideTriangles.addFace(face, insideColor);
                            this.insideLines.addFace(face, insideLineColor);
                            break;
                        case 2:
                            face = [[x2, y2, z0], [x0, y0, z0], [x1, y0, z0]];
                            this.bottomTriangles.addFace(face, faceColor);
                            this.bottomLines.addFace(face, lineColor);
                            face = [[x2, y2, z0], [x1, y0, z0], [x1, y1, z1], [x2, y1, z2]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            face = [[x2, y2, z0], [x1, y0, z0], [x1, y1, z0], [x2, y1, z0]];
                            this.insideTriangles.addFace(face, insideColor);
                            this.insideLines.addFace(face, insideLineColor);
                            face = [[x2, y2, z0], [x2, y1, z2], [x0, y1, z1], [x0, y0, z0]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            face = [[x2, y2, z0], [x2, y1, z0], [x0, y1, z0], [x0, y0, z0]];
                            this.insideTriangles.addFace(face, insideColor);
                            this.insideLines.addFace(face, insideLineColor);
                            break;
                        case 3:
                            face = [[x2, y2, z0], [x0, y1, z0], [x0, y0, z0]];
                            this.bottomTriangles.addFace(face, faceColor);
                            this.bottomLines.addFace(face, lineColor);
                            face = [[x2, y2, z0], [x0, y0, z0], [x1, y0, z1], [x1, y2, z2]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            face = [[x2, y2, z0], [x0, y0, z0], [x1, y0, z0], [x1, y2, z0]];
                            this.insideTriangles.addFace(face, insideColor);
                            this.insideLines.addFace(face, insideLineColor);
                            face = [[x2, y2, z0], [x1, y2, z2], [x1, y1, z1], [x0, y1, z0]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            face = [[x2, y2, z0], [x1, y2, z0], [x1, y1, z0], [x0, y1, z0]];
                            this.insideTriangles.addFace(face, insideColor);
                            this.insideLines.addFace(face, insideLineColor);
                            break;
                        default:
                    }
                    break;
                case 10: // Ramp + left shim
                    switch (facing) {
                        case 0:
                            face = [[x1, y1, z1], [x0, y1, z1], [x0, y2, z2], [x1, y0, z0]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            face = [[x0, y0, z1], [x1, y0, z0], [x0, y2, z2]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            break;
                        case 1:
                            face = [[x1, y0, z1], [x1, y1, z1], [x2, y1, z2], [x0, y0, z0]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            face = [[x0, y1, z1], [x0, y0, z0], [x2, y1, z2]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            break;
                        case 2:
                            face = [[x0, y0, z1], [x1, y0, z1], [x1, y2, z2], [x0, y1, z0]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            face = [[x1, y1, z1], [x0, y1, z0], [x1, y2, z2]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            break;
                        case 3:
                            face = [[x0, y1, z1], [x0, y0, z1], [x2, y0, z2], [x1, y1, z0]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            face = [[x1, y0, z1], [x1, y1, z0], [x2, y0, z2]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            break;
                        default:
                    }
                    face = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]];
                    this.insideTriangles.addFace(face, insideColor);
                    this.insideLines.addFace(face, insideLineColor);
                    break;
                case 11: // Ramp + right shim
                    switch (facing) {
                        case 0:
                            face = [[x1, y1, z1], [x0, y1, z1], [x0, y0, z0], [x1, y2, z2]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            face = [[x1, y0, z1], [x1, y2, z2], [x0, y0, z0]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            break;
                        case 1:
                            face = [[x1, y0, z1], [x1, y1, z1], [x0, y1, z0], [x2, y0, z2]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            face = [[x0, y0, z1], [x2, y0, z2], [x0, y1, z0]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            break;
                        case 2:
                            face = [[x0, y0, z1], [x1, y0, z1], [x1, y1, z0], [x0, y2, z2]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            face = [[x0, y1, z1], [x0, y2, z2], [x1, y1, z0]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            break;
                        case 3:
                            face = [[x0, y1, z1], [x0, y0, z1], [x1, y0, z0], [x2, y1, z2]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            face = [[x1, y1, z1], [x2, y1, z2], [x1, y0, z0]];
                            this.middleTriangles.addFace(face, faceColor);
                            this.middleLines.addFace(face, lineColor);
                            break;
                        default:
                    }
                    face = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]];
                    this.insideTriangles.addFace(face, insideColor);
                    this.insideLines.addFace(face, insideLineColor);
                    break;
                default:
            }

        }
    }

 }


class TerrainLayer extends QView  {
    constructor(z) {
        super();
        this.z = z;
        this.surfaceTiles = new Map();
        this.triangles0 = new QTriangles();     // 0 = bottom + middle + top
        this.triangles1 = new QTriangles();     // 1 = bottom + middle
        this.triangles2 = new QTriangles();     // 2 = inside + bottom
        this.lines0 = new QLines();
        this.lines1 = new QLines();
        this.lines2 = new QLines();
        this.dirty0 = true;
        this.dirty1 = true;
        this.dirty2 = true;
        this.hasInsideGeometry = false;
    }

    destroy() {
        this.surfaceTiles.forEach(tile => tile.destroy());
        this.triangles0.destroy();
        this.triangles1.destroy();
        this.triangles2.destroy();
        this.lines0.destroy();
        this.lines1.destroy();
        this.lines2.destroy();
    }

    clear() {
        this.surfaceTiles.clear();
        this.triangles0.clear();
        this.triangles1.clear();
        this.triangles2.clear();
        this.lines0.clear();
        this.lines1.clear();
        this.lines2.clear();
    }

    isEmpty() {
        return (this.surfaceTiles.size === 0);
    }

    tileID(id) {
        const xyz = Voxels.unpackXYZ(id);
        const x = xyz[0] >> 4;            // Divide by 16
        const y = xyz[1] >> 4;            // Divide by 16
        return (x << 4 || y);
    }

    addSurfaceID(id) {
        const tileID = this.tileID(id);
        if (!this.surfaceTiles.has(tileID)) this.surfaceTiles.set(tileID, new SurfaceTile());
        const tile = this.surfaceTiles.get(tileID);
        tile.addSurfaceID(id);
        this.dirty0 = true;
        this.dirty1 = true;
        this.dirty2 = true;
    }

    removeSurfaceID(id) {
        const tileID = this.tileID(id);
        if (!this.surfaceTiles.has(tileID)) return;
        const tile = this.surfaceTiles.get(tileID);
        tile.removeSurfaceID(id);
        if (tile.isEmpty()) {
            this.surfaceTiles.get(tileID).destroy();
            this.surfaceTiles.delete(tileID);
        }
        this.dirty0 = true;
        this.dirty1 = true;
        this.dirty2 = true;
    }

    rebuild0() {

        this.triangles0.clear();
        this.lines0.clear();

        this.surfaceTiles.forEach(function (tile) {
            if (tile.dirty) tile.rebuild();

            this.triangles0.merge(tile.topTriangles);
            this.triangles0.merge(tile.middleTriangles);
            this.triangles0.merge(tile.bottomTriangles);

            this.lines0.merge(tile.topLines);
            this.lines0.merge(tile.middleLines);
            this.lines0.merge(tile.bottomLines);

        }, this);

        this.dirty0 = false;

        this.triangles0.update();
        this.triangles0.clear();

        this.lines0.update();
        this.lines0.clear();
    }

    rebuild1() {

        this.triangles1.clear();
        this.lines1.clear();

        this.surfaceTiles.forEach(function (tile) {
            if (tile.dirty) tile.rebuild();

            this.triangles1.merge(tile.middleTriangles);
            this.triangles1.merge(tile.bottomTriangles);

            this.lines1.merge(tile.middleLines);
            this.lines1.merge(tile.bottomLines);

        }, this);

        this.dirty1 = false;

        this.triangles1.update();
        this.triangles1.clear();

        this.lines1.update();
        this.lines1.clear();
    }

    rebuild2() {

        this.triangles2.clear();
        this.lines2.clear();

        this.buildInsideGeometry();

        this.surfaceTiles.forEach(function (tile) {
            if (tile.dirty) tile.rebuild();

            this.triangles2.merge(tile.bottomTriangles);
            this.triangles2.merge(tile.insideTriangles);

            this.lines2.merge(tile.bottomLines);
            this.lines2.merge(tile.insideLines);

        }, this);

        this.dirty2 = false;

        this.triangles2.update();
        this.triangles2.clear();

        this.lines2.update();
        this.lines2.clear();
    }

    buildInsideGeometry() {
        this.hasInsideGeometry = false;
        const viewRoot = this.getNamedView("ViewRoot");
        const voxels = viewRoot.modelRoot.wellKnownModel("Voxels");
        const faceColor = voxelUnknownColor();
        const lineColor = voxelLineColor(faceColor);
        const z = this.z;
        const belowZ = this.z-1;
        if (belowZ < 0) return;
        for (let x = 0; x < Voxels.sizeX; x++) {
            for (let y = 0; y < Voxels.sizeY; y++) {
                const voxel = voxels.get(x, y, z);
                if (Voxels.isSolid(voxel)) {
                    const below = voxels.get(x,y,belowZ);
                    if (Voxels.isSolid(below)) {
                        const x0 = x * Voxels.scaleX;
                        const y0 = y * Voxels.scaleY;
                        const z0 = z * Voxels.scaleZ;
                        const x1 = x0 + Voxels.scaleX;
                        const y1 = y0 + Voxels.scaleY;
                        const face = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]];
                        this.triangles2.addFace(face, faceColor);
                        this.lines2.addFace(face, lineColor);
                        this.hasInsideGeometry = true;
                    }
                }
            }
        }
    }

    draw0() { // Draws the top, middle and bottom surfaces
        if (this.isEmpty()) return;
        this.triangles0.draw();
        this.lines0.draw();
    }

    draw1() { // Draws only the middle and bottom surfaces
        if (this.isEmpty()) return;
        this.triangles1.draw();
        this.lines1.draw();
    }

    draw2() { // Draws the bottom surfaces and the interior faces
        if (!this.hasInsideGeometry && this.isEmpty()) return;
        this.triangles2.draw();
        this.lines2.draw();
    }


}

export class TerrainRender extends QView {

    constructor() {
        super();

        this.layers = [];
        for (let z = 0; z < Voxels.sizeZ; z++) this.layers.push(new TerrainLayer(z));

        this.subscribe("surfaces", "new", () => this.handleSurfaceNew());
        this.subscribe("surfaces", "update", data => this.handleSurfaceUpdate(data));

        this.handleSurfaceNew();
    }

    destroy() {
        this.layers.forEach(layer => layer.destroy());
    }

    clear() {
        this.layers.forEach(layer => layer.clear());
    }

    handleSurfaceNew() {
        const viewRoot = this.getNamedView("ViewRoot");
        const surfaces = viewRoot.modelRoot.wellKnownModel("VoxelSurfaces");
        this.clear();
        surfaces.surfaces.forEach(function(surface, id) {
            const z = Voxels.unpackZ(id);
            this.layers[z].addSurfaceID(id);
        }, this);
    }

    handleSurfaceUpdate(data) {
        const surfaces = data.surfaces;
        const updated = data.updated;
        updated.forEach(id => {
            const z = Voxels.unpackZ(id);
            if (surfaces.hasSurface(id)) {
                this.layers[z].addSurfaceID(id);
            } else {
                this.layers[z].removeSurfaceID(id);
            }
            const aboveZ = z+1;
            if (aboveZ < Voxels.sizeZ) this.layers[aboveZ].dirty2 = true;
        });
    }

    draw() {
        const viewRoot = this.getNamedView("ViewRoot");
        const topLayer = viewRoot.topLayer;
        for (let n = 0; n < topLayer-2; n++) {
            const layer = this.layers[n];
            if (layer.dirty0) layer.rebuild0();
            layer.draw0();
        }
        if (topLayer-2 > 0) {
            const layer = this.layers[topLayer-2];
            if (layer.dirty1) layer.rebuild1();
            layer.draw1();
        }
        if (topLayer-1 > 0) {
            const layer = this.layers[topLayer-1];
            if (layer.dirty2) layer.rebuild2();
            layer.draw2();
        }
    }
}

function voxelTopColor(voxelType) {
    switch (voxelType) {
        case Voxels.rock:
            return [0.7, 0.7, 0.7, 1];
        case Voxels.dirt:
            return [0.4, 0.8, 0.2, 1];
        default:
            return [1, 1, 1, 1];
    }
}

function voxelSideColor(voxelType) {
    switch (voxelType) {
        case Voxels.rock:
            return [0.7, 0.7, 0.7, 1];
        case Voxels.dirt:
            return [0.8, 0.4, 0.2, 1];
        default:
            return [1, 1, 1, 1];
    }
}

function voxelInsideColor(voxelType) {
    switch (voxelType) {
        case Voxels.rock:
            return [0.6, 0.6, 0.6, 1];
        case Voxels.dirt:
            return [0.6, 0.4, 0.2, 1];
        default:
            return [1, 1, 1, 1];
    }
}

function voxelUnknownColor() {
    return [0.3, 0.3, 0.3, 1];
}

function voxelLineColor(baseColor) {
    // const out = vec4.clone(baseColor);
    return v4_max([0,0,0,1], v4_sub(baseColor, [0.25, 0.25, 0.25, 0]));
    // vec4.subtract(out, out, [0.25, 0.25, 0.25, 0]);
    // vec4.max(out, out, [0,0,0,1]);
    // return out;
}
