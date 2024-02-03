import { mat4_translate, mat4_scale, world_to_camera, mat4_invert, mat4_rot_z, mat4_matmul, mat4_vecmul, mat4_rot_y, sub_v, vec3_dot } from "@toysinbox3dprinting/js-geometry";
import { loadShaders, preprocessShaders } from "./ts-util/shader-utils";
import { Vertex } from "@toysinbox3dprinting/js-geometry";

const profiles = [
    {
        camera_position: new Vertex(0, 0, 5),
        camera_look: new Vertex(0, 0, -1),
        mat4_translate: mat4_translate(0, 0, 0),
        mat4_scale: mat4_scale(1, 1, 1)
    },
];
const select_profile = 0;


class Material {
    color: number[];
    emissive: boolean;

    constructor(color: number[], emissive: boolean){
        this.color = color;
        this.emissive = emissive;
    }
}

class Primitive {
    kind: number;
    material: Material;
    ctm: number[];
    ctm_inv: number[];

    constructor(kind: number, ctm: number[], material: Material){
        this.kind = kind;
        this.ctm = ctm;
        this.ctm_inv = mat4_invert(ctm);
        this.material = material;
    }

    toPackedArray(): number[] {
        return [
            this.kind, ...this.material.color,
            ...this.ctm,
            ...this.ctm_inv,
            1, this.material.emissive ? 1 : 0, 0, 0
        ];
    }
}

const materials = {
    red: new Material([1, 0, 0], false),
    green: new Material([0, 1, 0], false),
    blue: new Material([0, 0, 1], true),
    yellow: new Material([1, 1, 0], true),
    white: new Material([1, 0.95, 0.9], false),
    lightwhite: new Material([1, 0.95, 0.9], true),
    purple: new Material([1, 0, 1], false)
}

const primitives = [
    new Primitive(
        1,
        mat4_matmul(mat4_translate(-0.5 -1, 0, -1), mat4_matmul(mat4_scale(1.5, 1.5, 1.5), mat4_rot_z(0))),
        materials.blue
    ),
    new Primitive(
        1,
        mat4_matmul(mat4_translate(0, 0.5 + 1, -0.5), mat4_matmul(mat4_scale(1, 1, 1), mat4_rot_z(0))),
        materials.yellow
    ),
    new Primitive(
        1,
        mat4_matmul(mat4_translate(0, -1, -0.5), mat4_matmul(mat4_scale(1, 1, 1), mat4_rot_z(0))),
        materials.lightwhite
    ),


    new Primitive(
        0,
        mat4_matmul(mat4_translate(3, 0, -2), mat4_matmul(mat4_scale(0.5, 6, 6), mat4_rot_z(0))),
        materials.green
    ), 
    new Primitive(
        0,
        mat4_matmul(mat4_translate(-3, 0, -2), mat4_matmul(mat4_scale(0.5, 6, 6), mat4_rot_z(0))),
        materials.red
    ), 
    new Primitive(
        0,
        mat4_matmul(mat4_translate(0, 0, -2 - 3), mat4_matmul(mat4_scale(6, 6, 0.5), mat4_rot_z(0))),
        materials.white
    ), 
    new Primitive(
        0,
        mat4_matmul(mat4_translate(0, -3, -2), mat4_matmul(mat4_scale(6, 0.5, 6), mat4_rot_z(0))),
        materials.white
    ), 
    new Primitive(
        0,
        mat4_matmul(mat4_translate(0, 3, -2), mat4_matmul(mat4_scale(6, 0.5, 6), mat4_rot_z(0))),
        materials.white
    )
]

export const programEntry = (screenDimension: number[], ctx: CanvasRenderingContext2D) => {  
    let screen_dimension_inv = [1 / screenDimension[0], 1 / screenDimension[1]];
    let camera_position = profiles[select_profile].camera_position;
    let camera_look = profiles[select_profile].camera_look;
    let FOV = 60;
    let focal_length = 1;
    let aspect_ratio = screenDimension[0] / screenDimension[1];
    let world_to_cam_mat = world_to_camera(camera_position, camera_look, new Vertex(0, 1, 0));
    let cam_to_world_mat = mat4_invert(world_to_cam_mat);

    const initGPUCompute = async (shaders: string[]) => {
        const adapter = await navigator.gpu.requestAdapter({
            powerPreference: "high-performance"
        });
        if (!adapter) return;
        const device = await adapter.requestDevice();

        // META DATA GPU BUFFER
        let metaData = [
            ...screenDimension,
            focal_length, FOV * Math.PI / 180,
            ...camera_position.toArray(), 1, 

            ...screen_dimension_inv,
            aspect_ratio, 0,

            ...world_to_cam_mat,      
            ...cam_to_world_mat,
        ];
        const metaMatrix = new Float32Array(metaData);
        const gpuBufferMetaMatrix = device.createBuffer({
            mappedAtCreation: true,
            size: metaMatrix.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        const arrayBufferMetaMatrix = gpuBufferMetaMatrix.getMappedRange();
        new Float32Array(arrayBufferMetaMatrix).set(metaMatrix);
        gpuBufferMetaMatrix.unmap();

        const primitivesData = new Float32Array(primitives.map(p => {
            let data = p.toPackedArray();
            console.log(data)
            return data;
        }).flat());
        const primitivesBuffer = device.createBuffer({
            mappedAtCreation: true,
            size: primitivesData.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        const primitivesArrayRef = primitivesBuffer.getMappedRange();
        new Float32Array(primitivesArrayRef).set(primitivesData);
        primitivesBuffer.unmap();
        console.log(primitivesData, primitivesData.length)
    
        const resultMatrixBufferSize = 1 * Float32Array.BYTES_PER_ELEMENT * (screenDimension[0] * screenDimension[1]);
        const resultMatrixBuffer = device.createBuffer({
            size: resultMatrixBufferSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        });

        const sample_collector = new Int32Array(screenDimension[0] * screenDimension[1] * 4);
        const display_buffer = new Uint8ClampedArray(screenDimension[0] * screenDimension[1] * 4);
        let sample_runs = 0;
    
        const bindGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "read-only-storage"
                    }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "storage"
                    }
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "read-only-storage"
                    }
                },
            ]
        });
    
        const bindGroup = device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: gpuBufferMetaMatrix
                    }
                },
                {
                    binding: 1,
                    resource: {
                        buffer: resultMatrixBuffer
                    }
                },
                {
                    binding: 2,
                    resource: {
                        buffer: primitivesBuffer
                    }
                }
            ]
        });
    
        const shaderModule = device.createShaderModule({
            code: shaders[0]
        });
        const computePipeline = device.createComputePipeline({
            layout: device.createPipelineLayout({
                bindGroupLayouts: [bindGroupLayout]
            }),
            compute: {
                module: shaderModule,
                entryPoint: "main"
            }
        });

        let frames = 0;
        let start_time = new Date().getTime();
        const imageData = ctx.createImageData(screenDimension[0], screenDimension[1]);

        let rot_z = mat4_rot_y(1 * Math.PI / 180);
        let enable_camera_movement = false;

        setInterval(() => {
            const time_elapsed = (new Date().getTime() - start_time);
            console.log(`FPS: ${frames / time_elapsed * 1000}`)
        }, 1000);

        const render_loop = async () => {
            const time_elapsed = (new Date().getTime() - start_time);
            frames += 1;

            // update metadata
            if(enable_camera_movement){
                let cam_pos_v4 = camera_position.toArray().concat(1);
                let new_pos = mat4_vecmul(rot_z, cam_pos_v4);
                camera_position = new Vertex(new_pos[0], new_pos[1], new_pos[2]);
                camera_look = sub_v(new Vertex(0, 0, 0), new Vertex(new_pos[0], new_pos[1], new_pos[2]));
                world_to_cam_mat = world_to_camera(camera_position, camera_look, new Vertex(0, 1, 0));
                cam_to_world_mat = mat4_invert(world_to_cam_mat);
            }

            const metaData = [
                ...screenDimension,
                focal_length, FOV * Math.PI / 180,
                ...camera_position.toArray(), 1, 
    
                ...screen_dimension_inv,
                aspect_ratio, time_elapsed,
    
                ...world_to_cam_mat,      
                ...cam_to_world_mat,
            ];
            const metaMatrix = new Float32Array(metaData);
            device.queue.writeBuffer(gpuBufferMetaMatrix, 0, metaMatrix, 0, metaMatrix.length);

            // begin writing compute pass
            const commandEncoder = device.createCommandEncoder();
            const passEncoder = commandEncoder.beginComputePass();
            passEncoder.setPipeline(computePipeline);
            passEncoder.setBindGroup(0, bindGroup);
            passEncoder.dispatchWorkgroups(Math.ceil(screenDimension[0] / 8), Math.ceil(screenDimension[1] / 8));
            passEncoder.end();

            const gpuReadBuffer = device.createBuffer({
                size: resultMatrixBufferSize,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
            });
            commandEncoder.copyBufferToBuffer(resultMatrixBuffer, 0, gpuReadBuffer, 0, resultMatrixBufferSize);
            
            const gpuCommands = commandEncoder.finish();
            device.queue.submit([gpuCommands]);
        
            // read data and put onto screen
            gpuReadBuffer.mapAsync(GPUMapMode.READ).then(() => {
                const arrayBuffer = gpuReadBuffer.getMappedRange();
                const outputData = new Uint8ClampedArray(arrayBuffer);
                // imageData.data.set(outputData);
                // ctx.putImageData(imageData, 0, 0);
                
                sample_runs += 1;
                for(let i = 0; i < outputData.length; i++){
                    sample_collector[i] += outputData[i];
                    display_buffer[i] = sample_collector[i] / (sample_runs / 50);
                }
                imageData.data.set(display_buffer);
                ctx.putImageData(imageData, 0, 0);

                gpuReadBuffer.unmap();
                gpuReadBuffer.destroy();
            })

            setTimeout(() => {
                requestAnimationFrame(render_loop);
            }, 100);
        };
        render_loop();

        return true;
    }
    
    const shaderPaths = [
        '/src/program-raymarch.wgsl',
        '/src/wgsl-util/data-structs.wgsl',
        '/src/primitive.wgsl',
        '/src/wgsl-util/hash.wgsl',
        '/src/wgsl-util/samplers.wgsl'
    ];

    loadShaders(shaderPaths).then(shaders => {
        return preprocessShaders(shaders, shaderPaths);
    }).then(async (shaders) => {
        await initGPUCompute(shaders); 
        console.log("HI")
    });
}