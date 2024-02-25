import { QNamedView, QRender, QLights, QCursor, QUI } from "@croquet/q";
import { CreateInputBindings } from "./InputBindings";
import { GouraudShader, VoxelShader } from "./Shaders";
import { Player } from './Player';
import { TerrainRender } from './TerrainRender';
import { Voxels } from './Voxels';
import { VoxelCursor } from './VoxelCursor';
import { PawnRender } from './PawnRender';
import { RoadRender } from "./RoadRender";
import { HUD } from "./HUD";


export class ViewRoot extends QNamedView {

    constructor(modelRoot) {
        super("ViewRoot");

        this.modelRoot = modelRoot;
        this.topLayer = Voxels.sizeZ;   // The top layer that's visible in the terrain slice.

        //-- Create the input handlers --

        CreateInputBindings();

        //-- Set up the renderer --

        this.render = new QRender();
        this.gouraudShader = new GouraudShader();
        this.voxelShader = new VoxelShader();
        this.lights = new QLights();
        this.terrainRender = new TerrainRender();
        this.pawnRender = new PawnRender();
        this.roadRender = new RoadRender();

        //-- Set up the UI --

        this.ui = new QUI();
        this.hud = new HUD();
        this.cursor = new QCursor();

        //-- Create the player --

        this.player = new Player();
        this.voxelCursor = new VoxelCursor(this.player);

        //-- Create event handlers

        this.subscribe("input", "layerUp", () => this.handleLayerUp());
        this.subscribe("input", "layerDown", () => this.handleLayerDown());

        this.generateVoxels();
    }

    in() {
    }

    out() {
        this.render.start();

        this.voxelShader.apply(this.lights, this.player.camera);
        this.terrainRender.draw();
        this.roadRender.draw();

        this.gouraudShader.apply(this.lights, this.player.camera);
        this.pawnRender.draw();
        this.voxelCursor.draw();


        this.render.end();
        //this.cursor.draw();
        this.ui.refresh();
    }

    update() {
        this.out();
    }
//
    generateVoxels() {
        this.publish("player", "generate voxels");
    }

    handleLayerUp() {
        this.setTopLayer(this.topLayer + 1);
    }

    handleLayerDown() {
        this.setTopLayer(this.topLayer - 1);
    }

    setTopLayer(layer) {
        this.topLayer = Math.min(Voxels.sizeZ, Math.max(2, layer));
    }
}
