import { QShader } from "@croquet/q";

export class GouraudShader extends QShader {
    constructor() {
        super();
        const vSource = `
            //#define SHOW_NORMALS; // for debugging

            attribute vec4 aVertex;
            attribute vec4 aNormal;
            attribute vec4 aColor;

            uniform mat4 uProjectionMatrix;
            uniform mat4 uViewMatrix;
            uniform mat4 uModelMatrix;
            uniform mat4 uNormalMatrix;

            uniform vec3 uAmbientLight;
            uniform vec3 uDirectionalLightAim;
            uniform vec3 uDirectionalLightColor;

            varying lowp vec4 vColor;
            varying highp vec3 vLighting;

            void main() {
                gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * aVertex;

                highp vec4 transformedNormal = uNormalMatrix * aNormal;

                highp float directional = dot(transformedNormal.xyz, uDirectionalLightAim)*0.5 + 0.5;

                #ifdef SHOW_NORMALS
                    vColor = transformedNormal*0.5+0.5;
                    vColor.a = 1.0;
                    vLighting = vec3(1.0, 1.0, 1.0);
                #else
                    vColor = aColor;
                    vLighting = uAmbientLight + (uDirectionalLightColor * directional);
                #endif
            }
        `;

        const fSource = `
            varying lowp vec4 vColor;
            varying highp vec3 vLighting;

            void main() {
                gl_FragColor = vec4(vColor.rgb * vLighting, vColor.a);
            }
        `;

        this.build(vSource, fSource);
    }
}

export class VoxelShader extends QShader {
    constructor() {
        super();
        const vSource = `
            attribute vec4 aVertex;
            attribute vec4 aNormal;
            attribute vec4 aColor;

            uniform mat4 uProjectionMatrix;
            uniform mat4 uViewMatrix;

            uniform vec3 uAmbientLight;
            uniform vec3 uDirectionalLightAim;
            uniform vec3 uDirectionalLightColor;

            varying lowp vec4 vColor;
            varying highp vec3 vLighting;

            void main() {
                gl_Position = uProjectionMatrix * uViewMatrix * aVertex;

                vColor = aColor;

                highp float directional = max(dot(aNormal.xyz, uDirectionalLightAim), 0.0);
                vLighting = uAmbientLight + (uDirectionalLightColor * directional);
                }
        `;

        const fSource = `
            varying lowp vec4 vColor;
            varying highp vec3 vLighting;

            void main() {
                gl_FragColor = vec4(vColor.rgb * vLighting, vColor.a);
            }
        `;

        this.build(vSource, fSource);
    }
}