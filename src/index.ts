import { load_file } from "./ts-util/load-file";
import { programEntry } from "./program-raymarch";
import { ini_file_to_ini_scene, parse_ini_file } from "./ts-util/parse-ini";
import * as convert from "xml-js";
import { CameraData, SceneObjectNode } from "./ts-util/data-structs";
import { Vertex, mat4_clone, mat4_matmul, mat4_rot_y, mat4_scale, mat4_translate } from "@toysinbox3dprinting/js-geometry";
import { mat4_rot_axis } from "./ts-util/math";
import { parse_obj } from "./ts-util/parse-obj";
import { pack_scene_object_group } from "./packer";

// import { init_three } from "@toysinbox3dprinting/js-geometry";
// init_three();

load_file('/scene_files/milestone/cornell_box_milestone.ini').then(async (file) => {
    // parse scene config .ini file
    const ini_file = parse_ini_file(file);
    const scene_description = ini_file_to_ini_scene(ini_file);
    const scene_file_path = scene_description.IO.scene;
    const scene_xml = await load_file(scene_file_path);
    const scene_root = (convert.xml2js(scene_xml, {compact: true}) as any)['scenefile'];
    
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
            console.log(obj)
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
    console.log(final_primitives);

    // pack extracted primitives into buffers for the GPU
    const gpu_packed_primitives = await Promise.all(final_primitives.slice(0, 1).map(async (p) => {
        if(!p.data) throw Error('mesh primitive missing its data');
        let path = p.data.path;

        let obj_data = await load_file(path);
        let mtl_data;
        try {
            mtl_data = await load_file(path.slice(0, -3) + 'mtl');
        } catch(e) {
            mtl_data = "";
        }

        const intermediate = parse_obj(obj_data, mtl_data, p.ctm);
        const packed_array = pack_scene_object_group(intermediate);
        
        return packed_array;
    }));

    console.log(gpu_packed_primitives)

    // initialize gpu pipeline
    const x_res = 512 * 1.5;
    const aspect_ratio = 1.5;
    const round_4 = (n : number) => Math.floor(n / 4) * 4;
    const screenDimension = [round_4(x_res), round_4(x_res / aspect_ratio)];
    const mainCanvas = document.getElementById('main-canvas') as HTMLCanvasElement;
    mainCanvas.width = screenDimension[0];
    mainCanvas.height = screenDimension[1];
    const ctx = mainCanvas.getContext('2d') as CanvasRenderingContext2D;
    programEntry(screenDimension, ctx, gpu_packed_primitives);
});


console.log("hello world");
