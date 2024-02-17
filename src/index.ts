import { load_file } from "./ts-util/load-file";
import { programEntry } from "./program-raymarch";
import { ini_file_to_ini_scene, parse_ini_file } from "./ts-util/parse-ini";
import * as convert from "xml-js";
import { CameraData, SceneObjectNode, SceneObjectPacked } from "./ts-util/data-structs";
import { Triangle, Vertex, mat4_clone, mat4_matmul, mat4_rot_y, mat4_scale, mat4_translate } from "@toysinbox3dprinting/js-geometry";
import { bounds_of_vec3, chunk_into_3, mat4_rot_axis } from "./ts-util/math";
import { parse_obj } from "./ts-util/parse-obj";
import { pack_bvh, pack_scene_object_group } from "./packer";
import { BVH, BVHObject } from "./ts-util/bvh";

// import { init_three } from "@toysinbox3dprinting/js-geometry";
// init_three();

// load_file('/scene_files/milestone/cornell_box_milestone.ini').then(async (file) => {
// load_file('/scene_files/milestone/sphere_milestone.ini').then(async (file) => {

// load_file('/scene_files/final/cornell_box_direct_lighting_only.ini').then(async (file) => {
// load_file('/scene_files/final/cornell_box_full_lighting_low_probability.ini').then(async (file) => {
// load_file('/scene_files/final/cornell_box_full_lighting.ini').then(async (file) => {
    
// load_file('/scene_files/final/glossy.ini').then(async (file) => {
// load_file('/scene_files/final/mirror.ini').then(async (file) => {
load_file('/scene_files/final/refraction.ini').then(async (file) => {
    // parse scene config .ini file
    const ini_file = parse_ini_file(file);
    const scene_description = ini_file_to_ini_scene(ini_file);
    const scene_file_path = scene_description.IO.scene;
    const scene_xml = await load_file(scene_file_path);
    const scene_root = (convert.xml2js(scene_xml, {compact: true}) as any)['scenefile'];

    console.log(scene_description);
    
    const raw_camera_data = scene_root['cameradata'];
    const camera_focus = raw_camera_data.focus._attributes;
    const camera_heightangle = raw_camera_data.heightangle._attributes;
    const camera_pos = raw_camera_data.pos._attributes;
    const camera_up = raw_camera_data.up._attributes;
    const camera_data: CameraData = { // @ts-ignore
        focus: new Vertex(...[camera_focus.x, camera_focus.y, camera_focus.z].map(parseFloat)),
        heightangle: parseFloat(camera_heightangle.v), // @ts-ignore
        pos: new Vertex(...[camera_pos.x, camera_pos.y, camera_pos.z].map(parseFloat)), // @ts-ignore
        up: new Vertex(...[camera_up.x, camera_up.y, camera_up.z].map(parseFloat))
    };

    // extract primitives from scene description .xml file
    const final_primitives: SceneObjectNode[] = [];
    const raw_object_nodes: any[] = Array.isArray(scene_root.object) ? scene_root.object : [scene_root.object];
    const traverse_object_node = (obj: any, ctm: number[]): SceneObjectNode => {
        // console.log(obj)
        if(obj._attributes.type === "tree") {
            const objects: any[] = (Array.isArray(obj.object) ? obj.object : [obj.object]).filter((o: any) => o !== undefined);
            // console.log("A!", objects)
            const scene_objects = objects.map(o => traverse_object_node(o, ctm));
            const final_objects = scene_objects;

            if(obj.transblock){
                const transblocks: any[] = Array.isArray(obj.transblock) ? obj.transblock : [obj.transblock];
                transblocks.forEach(tb => {
                    let new_ctm = ctm;
                    if(tb.rotate){
                        const attr = tb.rotate._attributes;
                        new_ctm = mat4_matmul(mat4_rot_axis(
                            parseFloat(attr.x), parseFloat(attr.y), 
                            parseFloat(attr.z), parseFloat(attr.angle)
                        ), new_ctm);
                    }
                    if(tb.scale){
                        const attr = tb.scale._attributes;
                        new_ctm = mat4_matmul(mat4_scale(
                            parseFloat(attr.x), parseFloat(attr.y), parseFloat(attr.z)
                        ), new_ctm);
                    }
                    if(tb.translate){
                        const attr = tb.translate._attributes;
                        new_ctm = mat4_matmul(mat4_translate(
                            parseFloat(attr.x), parseFloat(attr.y), parseFloat(attr.z)
                        ), new_ctm);
                    }

                    const inner_objects: any[] = Array.isArray(tb.object) ? tb.object : [tb.object];
                    // console.log("B!", inner_objects, new_ctm)
                    const inner_scene_objects = inner_objects.map(o => traverse_object_node(o, new_ctm));
                    final_objects.push(...inner_scene_objects);
                });
            }

            return {
                type: "tree",
                name: obj._attributes.name,
                child_objects: final_objects,
                ctm: ctm
            }
        } 
        
        else if(obj._attributes.type === "primitive") {
            // console.log(obj)
            let primitive: SceneObjectNode = {
                type: "primitive",
                name: obj._attributes.name,
                data: {
                    path: '/scene_assets/' + obj._attributes.filename
                },
                child_objects: [],
                ctm: ctm
            } 
            final_primitives.push(primitive);
            return primitive;
        } 

        else throw Error("unknown type of object " + obj._attributes.type + " to parse");
    }
    const object_nodes: SceneObjectNode[] = raw_object_nodes.map(o => traverse_object_node(o, mat4_scale(1, 1, 1)));

    // pack extracted primitives into buffers for the GPU
    const gpu_packed_primitives: SceneObjectPacked[] = await Promise.all(final_primitives.slice(0, 1).map(async (p) => {
        if(!p.data) throw Error('mesh primitive missing its data');
        let path = p.data.path;

        let obj_data = await load_file(path);
        let mtl_data;
        try {
            mtl_data = await load_file(path.slice(0, -3) + 'mtl');
        } catch(e) {
            mtl_data = "";
        }

        // create packed triangle data 
        const intermediate = parse_obj(obj_data, mtl_data, p.ctm);
        const packed_array = pack_scene_object_group(intermediate);

        console.log(intermediate)

        // create packed bvh data
        const vertices = intermediate.vertices;
        const bvh_bounds = bounds_of_vec3(chunk_into_3(vertices));
        const bvh_objects = intermediate.objects.map((o, mat_i) => {
            const indices = o.indices;
            const objects: BVHObject<number[]>[] = [];

            for(let i = 0; i < indices.length; i += 3){
                let i0 = (indices[i] - 1) * 3;
                let i1 = (indices[i + 1] - 1) * 3;
                let i2 = (indices[i + 2] - 1) * 3;

                let v0 = [vertices[i0], vertices[i0 + 1], vertices[i0 + 2]];
                let v1 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]];
                let v2 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]];
                
                let tri = [v0, v1, v2];
                let tri_bounds = bounds_of_vec3(tri);
                objects.push({
                    obj: [indices[i], indices[i + 1], indices[i + 2], mat_i],
                    bounds: tri_bounds
                });
            }

            return objects;
        }).flat();
        const bvh = new BVH(bvh_objects, bvh_bounds);
        const packed_bvh = pack_bvh(bvh);
        // console.log(bvh)
        // console.log(packed_bvh)
        
        return {
            triangle_data: packed_array,
            bvh_data: packed_bvh,
            bounds: bvh_bounds
        };
    }));

    // initialize gpu pipeline
    const x_res = scene_description.Settings.imageWidth;
    const aspect_ratio = x_res / scene_description.Settings.imageHeight;
    const round_4 = (n : number) => Math.floor(n / 4) * 4;
    const screenDimension = [round_4(x_res), round_4(x_res / aspect_ratio)];
    const mainCanvas = document.getElementById('main-canvas') as HTMLCanvasElement;
    mainCanvas.width = screenDimension[0];
    mainCanvas.height = screenDimension[1];
    const ctx = mainCanvas.getContext('2d') as CanvasRenderingContext2D;
    programEntry(
        screenDimension, ctx, 
        gpu_packed_primitives, camera_data,
        scene_description
    );
});


console.log("hello world");
