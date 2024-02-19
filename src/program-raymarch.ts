import { mat4_translate, mat4_scale, world_to_camera, mat4_invert, mat4_rot_z, mat4_matmul, mat4_vecmul, mat4_rot_y, sub_v, vec3_dot } from "@toysinbox3dprinting/js-geometry";
import { loadShaders, preprocessShaders } from "./ts-util/shader-utils";
import { Vertex } from "@toysinbox3dprinting/js-geometry";
import { CameraData, SceneObjectPacked } from "./ts-util/data-structs";
import { IniFileScene } from "ts-util/parse-ini";
import { compiled_shader } from "./compiled_shader";

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

export const programEntry = (
    screenDimension: number[], ctx: CanvasRenderingContext2D, 
    primitive_data: SceneObjectPacked[], camera_data: CameraData,
    scene_description: IniFileScene,
    use_microfacet?: boolean,
    use_cosine_importance?: boolean,
    use_web_paths?: boolean
) => {  
    let screen_dimension_inv = [1 / screenDimension[0], 1 / screenDimension[1]];
    
    let camera_position = camera_data.pos;
    let camera_look = camera_data.focus.sub_v(camera_position).normalize();
    let FOV = camera_data.heightangle;
    // TODO: convert to horizontal FOV

    let focal_length = 1;
    let aspect_ratio = screenDimension[0] / screenDimension[1];
    let world_to_cam_mat = world_to_camera(camera_position, camera_look, camera_data.up);
    let cam_to_world_mat = mat4_invert(world_to_cam_mat);
    
    let samples_per_pixel = scene_description.Settings.samplesPerPixel;
    let path_cont_prob = scene_description.Settings.pathContinuationProb;
    let direct_lighting_only = scene_description.Settings.directLightingOnly;

    let looping = true;
    let break_loop = () => looping = false;

    let frames = 0;
    let get_num_samples = () => frames;

    const initGPUCompute = async (shaders: string[]) => {
        const adapter = await navigator.gpu.requestAdapter({
            powerPreference: "high-performance"
        });
        if (!adapter) throw Error("No GPU device located");
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

            samples_per_pixel, path_cont_prob, // 44, 45, 46, 47
            direct_lighting_only ? 1 : -1, 
            use_microfacet ? 1 : -1,

            use_cosine_importance ? 1 : -1,
            0, 0, 0, 0
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
    
        const resultMatrixBufferSize = 3 * Float32Array.BYTES_PER_ELEMENT * (screenDimension[0] * screenDimension[1]);
        const resultMatrixBuffer = device.createBuffer({
            size: resultMatrixBufferSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        });

        const packed_primitive_triangle_buffers = primitive_data.map(data => {
            const packed_buffer = device.createBuffer({
                mappedAtCreation: true,
                size: data.triangle_data.byteLength,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            });
            const packed_buffer_arrayref = packed_buffer.getMappedRange();
            new Float32Array(packed_buffer_arrayref).set(data.triangle_data);
            packed_buffer.unmap();
            return packed_buffer;
        });

        const packed_primitive_bvh_buffers = primitive_data.map(data => {
            const packed_buffer = device.createBuffer({
                mappedAtCreation: true,
                size: data.bvh_data.byteLength,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            });
            const packed_buffer_arrayref = packed_buffer.getMappedRange();
            new Float32Array(packed_buffer_arrayref).set(data.bvh_data);
            packed_buffer.unmap();
            return packed_buffer;
        });

        const sample_collector = new Float32Array(screenDimension[0] * screenDimension[1] * 3);
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

                ...packed_primitive_triangle_buffers.map((_, i) => ({
                    binding: i + 3,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "read-only-storage"
                    }
                } as GPUBindGroupLayoutEntry)),
                ...packed_primitive_bvh_buffers.map((_, i) => ({
                    binding: i + 10,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "read-only-storage"
                    }
                } as GPUBindGroupLayoutEntry))
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

                ...packed_primitive_triangle_buffers.map((buffer, i) => ({
                    binding: i + 3,
                    resource: {
                        buffer: buffer
                    }
                } as GPUBindGroupEntry)),
                ...packed_primitive_bvh_buffers.map((buffer, i) => ({
                    binding: i + 10,
                    resource: {
                        buffer: buffer
                    }
                } as GPUBindGroupEntry))
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

        let start_time = new Date().getTime();
        const imageData = ctx.createImageData(screenDimension[0], screenDimension[1]);

        let rot_z = mat4_rot_y(1 * Math.PI / 180);
        let enable_camera_movement = false;

        console.log(`Starting path tracing with the following settings`);
        console.log(`    ${samples_per_pixel} samples per pixel`);
        console.log(`    ${path_cont_prob} Russian roulette probability`);

        const render_loop = async () => {
            if(!looping) return;
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
        
            const time = new Date().getTime();
            // read data and put onto screen
            gpuReadBuffer.mapAsync(GPUMapMode.READ).then(() => {
                const arrayBuffer = gpuReadBuffer.getMappedRange();
                const outputData = new Float32Array(arrayBuffer);

                sample_runs += 1;
                let num_pixels = outputData.length / 3;

                for(let i = 0; i < num_pixels; i++){
                    let i3 = i * 3;
                    let i4 = i * 4;

                    sample_collector[i3] += outputData[i3] >= 0 ? outputData[i3] : 0;
                    sample_collector[i3 + 1] += outputData[i3 + 1] >= 0 ? outputData[i3 + 1] : 0;
                    sample_collector[i3 + 2] += outputData[i3 + 2] >= 0 ? outputData[i3 + 2] : 0;

                    let raw_r = sample_collector[i3] / sample_runs;
                    let raw_g = sample_collector[i3 + 1] / sample_runs;
                    let raw_b = sample_collector[i3 + 2] / sample_runs;

                    let lum_i = (raw_r + raw_g + raw_b) / 3.0;
                    let lum_o = lum_i / (lum_i + 1);

                    let final_r = raw_r * lum_o ** 0.01;
                    let final_g = raw_g * lum_o ** 0.01;
                    let final_b = raw_b * lum_o ** 0.01;

                    display_buffer[i4] = (final_r * 255) | 0;
                    display_buffer[i4 + 1] = (final_g * 255) | 0;
                    display_buffer[i4 + 2] = (final_b * 255) | 0;
                    display_buffer[i4 + 3] = 255;
                }
                imageData.data.set(display_buffer);
                ctx.putImageData(imageData, 0, 0);

                gpuReadBuffer.unmap();
                gpuReadBuffer.destroy();

                // console.log(`Path traced in ${new Date().getTime() - time} ms`);

                // if(frames < samples_per_pixel){
                    requestAnimationFrame(render_loop);
                // } else {
                //     console.log("Finished rendering!")
                // }
            })
        };
        render_loop();

        return true;
    }
    
    const shaderPaths = !use_web_paths ? [
        '/src/program-raymarch.wgsl',
        '/src/wgsl-util/data-structs.wgsl',
        '/src/primitive.wgsl',
        '/src/wgsl-util/hash.wgsl',
        '/src/wgsl-util/samplers.wgsl',
        '/src/wgsl-util/ray-triangle-intersection.wgsl',
        '/src/wgsl-util/ray-bbox-intersection.wgsl',
        '/src/wgsl-util/intersection-logic.wgsl',
    ] : [
        '/basic-path-tracer/src/program-raymarch.wgsl',
        '/basic-path-tracer/src/wgsl-util/data-structs.wgsl',
        '/basic-path-tracer/src/primitive.wgsl',
        '/basic-path-tracer/src/wgsl-util/hash.wgsl',
        '/basic-path-tracer/src/wgsl-util/samplers.wgsl',
        '/basic-path-tracer/src/wgsl-util/ray-triangle-intersection.wgsl',
        '/basic-path-tracer/src/wgsl-util/ray-bbox-intersection.wgsl',
        '/basic-path-tracer/src/wgsl-util/intersection-logic.wgsl',
    ];

    if(!use_web_paths){
        loadShaders(shaderPaths).then(shaders => {
            return preprocessShaders(shaders, shaderPaths);
        }).then(async (shaders) => {
            console.log(shaders);
            initGPUCompute(shaders).catch(err => {
                console.log(err);
            }); 
        });
    } else {
        initGPUCompute([compiled_shader]).catch(err => {
            console.log(err);
        }); 
    }


    return {
        break_loop: break_loop,
        get_num_samples: get_num_samples
    };
}