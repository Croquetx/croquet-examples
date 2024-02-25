//import {mat4, vec3, vec4, quat} from 'gl-matrix';
import { QNamedView, QTransform, QTriangles, QCSG } from "@croquet/q";
import { m4_identity, quat_axisAngle, m4_scalingRotationTranslation } from "@croquet/q/src/QVector";
import { Voxels } from './Voxels';


export class PawnRender extends QNamedView {
    constructor() {
        super("PawnRender");
        this.pawns = new Map();

        const viewRoot = this.getNamedView("ViewRoot");
        const modelRoot = viewRoot.modelRoot;
        const actorBoss = modelRoot.wellKnownModel("ActorBoss");

        this.pawnGeometry0 = this.buildPawn([0.9,0.5,0.1,1]);
        this.pawnGeometry1 = this.buildPawn([0.13,0.67,0.8,1]);

        actorBoss.actors.forEach(actor => this.spawnPawn(actor));

        this.subscribe("actor", "create", data => this.handleActorCreate(data));
        this.subscribe("actor", "kill", data => this.handleActorKill(data));


    }

    buildPawn(bodyColor) {

        const torso = QCSG.prism({
            x0: 12,
            y0: 12,
            x1: 20,
            y1: 20,
            z: 20
        });
        torso.translate([0,0,-10]);

        const neck = QCSG.prism({
            x0: 20,
            y0: 20,
            x1: 10,
            y1: 10,
            z: 8
        });
        neck.translate([0,0,10]);

        const tail = QCSG.prism({
            x0: 12,
            y0: 12,
            x1: 2,
            y1: 2,
            z: 15
        });
        tail.rotateX(90);
        tail.translate([0,-5, -3]);

        const leg = QCSG.prism({
            x0: 1,
            y0: 1,
            x1: 5,
            y1: 5,
            z: 10
        });
        const leftLeg = leg.clone();
        const rightLeg = leg.clone();
        leftLeg.translate([-3, 0, -20]);
        rightLeg.translate([3, 0, -20]);

        const head = QCSG.cylinder({
            p0: [0,0,0],
            p1: [0,0,10],
            r: 13,
            f: 16,
            a: 180
        });
        head.rotateX(-90);
        head.rotateZ(90);
        head.rotateX(45);
        head.translate([5,7.5,20]);

        const solidBody = QCSG.union(torso, neck, head, tail, leftLeg, rightLeg);
        solidBody.setColor(bodyColor);

        const mouth = QCSG.prism({
            x0: 30,
            y0: 3,
            x1: 30,
            y1: 0.5,
            z: 7
        });
        mouth.setColor([0.6,0.1,0.1,1]);
        mouth.rotateX(90);
        mouth.translate([0,15,25]);

        const body = QCSG.subtraction(solidBody, mouth);

        const eyeBall = QCSG.sphere({
            c: [0,0,0],
            r: 2,
            f: 16
        });
        eyeBall.setColor([0.9, 0.9, 0.9, 1]);

        const pupil = QCSG.cylinder({
            p0: [0,0,0],
            p1: [0,0,2],
            r: 0.6,
            f: 16
        });
        pupil.setColor([0.1,0.1,0.1,1]);
        const eye = QCSG.union(eyeBall, pupil);
        const leftEye = eye.clone();
        const rightEye = eye.clone();

        leftEye.rotateY(-90);
        leftEye.rotateZ(-30);
        leftEye.translate([-5, 3, 27]);

        rightEye.rotateY(90);
        rightEye.rotateZ(30);
        rightEye.translate([5, 3, 27]);

        const spike = QCSG.prism({
            x0: 2,
            y0: 5,
            x1: 0.5,
            y1: 0.5,
            z: 4
        });
        spike.setColor([0.9, 0.9, 0.0, 1]);

        const spike0 = spike.clone();
        spike0.rotateX(10);
        spike0.translate([0,5,32]);

        const spike1 = spike.clone();
        spike1.rotateX(35);
        spike1.translate([0,0,30]);

        const spike2 = spike.clone();
        spike2.rotateX(60);
        spike2.translate([0,-3.5,25.5]);

        const spike3 = spike.clone();
        spike3.scale(0.7);
        spike3.rotateX(17);
        spike3.translate([0,-10.5,1]);

        const spike4 = spike.clone();
        spike4.scale(0.6);
        spike4.rotateX(17);
        spike4.translate([0,-14,-1]);

        const spikes = QCSG.union(spike0, spike1, spike2, spike3, spike4);

        const csg = QCSG.union(body, leftEye, rightEye, spikes);
        csg.translate([0,0,25]);
        csg.scale(0.035);

        const triangles = new QTriangles();

        csg.buildTriangles(triangles);
        triangles.update();
        triangles.clear();
        return triangles;
    }

    draw() {
        const viewRoot = this.getNamedView("ViewRoot");
        const topLayer = viewRoot.topLayer;
        this.pawns.forEach((pawn, actor) => {
            if (actor === viewRoot.player.camActor) return; // Don't draw actor in first person
            const position = actor.getPosition();
            if (position[2] <= topLayer-0.999) pawn.draw(actor.getPosition(), actor.getFacing());
        });
    }

    handleActorCreate(data) {
        const actor = data;
        this.spawnPawn(actor);

    }

    handleActorKill(data) {
        const actor = data;
        this.pawns.delete(actor);
    }

    spawnPawn(actor) {
        let geo = this.pawnGeometry0;
        if (actor.color > 0.95) geo = this.pawnGeometry1;
        const pawn = new Pawn(geo);
        this.pawns.set(actor, pawn);
    }

    randomActor() {
        if (this.pawns.size === 0) return null;
        const actors = Array.from(this.pawns.keys());
        const n = Math.floor(Math.random() * actors.length);
        return actors[0];
    }

}

class Pawn {

    constructor(geometry) {
        this.transform = new QTransform();
        this.triangles = geometry;
        // this.build(color);
    }

    build(color) {
        this.transform = m4_identity();
        //this.transform.setMatrix(mat4.identity(mat4.create()));

        // const scale= mat4.fromScaling(mat4.create(), [0.7, 0.7, 1.5]);
        // const offset = mat4.fromTranslation(mat4.create, [0,0,1]);
        // const csg0 = QCSG.cube({
        //     c: [0,0,0],
        //     s: [0.3, 0.3, 2]
        // });
        // const csg1 = QCSG.sphere({
        //     c: [0,0,0],
        //     r: 1,
        //     f: 32
        // });
        // const csg2 = QCSG.subtraction(csg1, csg0);
        //this.triangles = new QTriangles();
        // csg2.buildTriangles(this.triangles);

        //this.triangles = UnitCube();
        // this.triangles.transform(scale);
        // this.triangles.transform(offset);

        const torso = QCSG.prism({
            x0: 12,
            y0: 12,
            x1: 20,
            y1: 20,
            z: 20
        });
        torso.translate([0,0,-10]);

        const neck = QCSG.prism({
            x0: 20,
            y0: 20,
            x1: 10,
            y1: 10,
            z: 8
        });
        neck.translate([0,0,10]);

        const tail = QCSG.prism({
            x0: 12,
            y0: 12,
            x1: 2,
            y1: 2,
            z: 15
        });
        tail.rotateX(90);
        tail.translate([0,-5, -3]);

        const leg = QCSG.prism({
            x0: 1,
            y0: 1,
            x1: 5,
            y1: 5,
            z: 10
        });
        const leftLeg = leg.clone();
        const rightLeg = leg.clone();
        leftLeg.translate([-3, 0, -20]);
        rightLeg.translate([3, 0, -20]);

        const head = QCSG.cylinder({
            p0: [0,0,0],
            p1: [0,0,10],
            r: 13,
            f: 16,
            a: 180
        });
        head.rotateX(-90);
        head.rotateZ(90);
        head.rotateX(45);
        head.translate([5,7.5,20]);

        const solidBody = QCSG.union(torso, neck, head, tail, leftLeg, rightLeg);
        solidBody.setColor([0.9,0.5,0.1,1]);

        const mouth = QCSG.prism({
            x0: 30,
            y0: 3,
            x1: 30,
            y1: 0.5,
            z: 7
        });
        mouth.setColor([0.6,0.1,0.1,1]);
        mouth.rotateX(90);
        mouth.translate([0,15,25]);

        const body = QCSG.subtraction(solidBody, mouth);

        const eyeBall = QCSG.sphere({
            c: [0,0,0],
            r: 2,
            f: 16
        });
        eyeBall.setColor([0.9, 0.9, 0.9, 1]);

        const pupil = QCSG.cylinder({
            p0: [0,0,0],
            p1: [0,0,2],
            r: 0.6,
            f: 16
        });
        pupil.setColor([0.1,0.1,0.1,1]);
        const eye = QCSG.union(eyeBall, pupil);
        const leftEye = eye.clone();
        const rightEye = eye.clone();

        leftEye.rotateY(-90);
        leftEye.rotateZ(-30);
        leftEye.translate([-5, 3, 27]);

        rightEye.rotateY(90);
        rightEye.rotateZ(30);
        rightEye.translate([5, 3, 27]);

        const spike = QCSG.prism({
            x0: 2,
            y0: 5,
            x1: 0.5,
            y1: 0.5,
            z: 4
        });
        spike.setColor([0.9, 0.9, 0.0, 1]);

        const spike0 = spike.clone();
        spike0.rotateX(10);
        spike0.translate([0,5,32]);

        const spike1 = spike.clone();
        spike1.rotateX(35);
        spike1.translate([0,0,30]);

        const spike2 = spike.clone();
        spike2.rotateX(60);
        spike2.translate([0,-3.5,25.5]);

        const spike3 = spike.clone();
        spike3.scale(0.7);
        spike3.rotateX(17);
        spike3.translate([0,-10.5,1]);

        const spike4 = spike.clone();
        spike4.scale(0.6);
        spike4.rotateX(17);
        spike4.translate([0,-14,-1]);

        const spikes = QCSG.union(spike0, spike1, spike2, spike3, spike4);

        const csg = QCSG.union(body, leftEye, rightEye, spikes);
        csg.translate([0,0,20]);
        csg.scale(0.03);

        csg.buildTriangles(this.triangles);
        // console.log("Vertices: " + this.testPawn.vertices.length);
        // this.testPawn.update();
        // this.testPawn.clear();

        // this.triangles.setColor(color);
        this.triangles.update();
        this.triangles.clear();
    }

    draw(position, rotation) {
        const x = position[0] * Voxels.scaleX;
        const y = position[1] * Voxels.scaleY;
        const z = position[2] * Voxels.scaleZ - 0.25;
        // let q = quat.create();
        // q = quat.rotateZ(q,q,rotation);
        // mat4.fromRotationTranslation(this.transform.matrix,q,[x,y,z]);
        const q = quat_axisAngle([0,0,1], rotation);
        this.transform.setMatrix(m4_scalingRotationTranslation(1, q, [x,y,z]));
        this.transform.apply();
        this.triangles.draw();
    }

}
