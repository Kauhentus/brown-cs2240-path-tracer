import { mat4_vecmul } from "@toysinbox3dprinting/js-geometry";
import { SceneObjectGroup } from "./data-structs";

export const parse_obj = (obj_data: string, mtl_data: string, ctm: number[]) => {
    // first parse the obj data
    const raw_obj_lines = obj_data.split('\n');
    const object_groups: SceneObjectGroup = {
        vertices: [],
        objects: [{
            name: 'default',
            indices: []
        }]
    };

    for(let raw_line of raw_obj_lines){
        let line = raw_line.replace(/\s+/g, ' ').replace(/#.*$/, '').trim();
        if(line.length === 0) continue;
        if(line[0] === '#') continue;

        else if(line.slice(0, 2) === 'v '){
            let data = line.slice(2).trim().split(' ').map(parseFloat);
            let data_trans = mat4_vecmul(ctm, [...data, 1.0]);
            object_groups.vertices.push(...data_trans);
        }

        else if(line.slice(0, 2) === 'f '){
            let num_vertices = object_groups.vertices.length / 3;
            let raw_indices = line.slice(2).trim().split(' ').map(triplet => {
                let i = parseInt(triplet.split('/')[0]);
                if(i > 0) return i;
                else return num_vertices + i + 1;
            });

            object_groups.objects.at(-1)?.indices.push(...raw_indices)
        }

        else if(line.slice(0, 6) === 'usemtl'){
            object_groups.objects.push({
                name: line.split(' ')[1],
                indices: []
            })
        }

        // only allow one mtllib for now...
        // else if(line.slice(0, 6) === 'mtllib'){

        // }
    }

    object_groups.objects = object_groups.objects.filter(objs => objs.indices.length > 0);    // remove groups with no indices 


    // then parse the mtl data
    const raw_mtl_lines = mtl_data.split('\n');
    const material_map: {[key: string]: {[key: string]: number | number[]}} = {};
    let cur_mtl_name = 'default';

    for(let raw_line of raw_mtl_lines){
        let line = raw_line.replace(/\s+/g, ' ').replace(/#.*$/, '').trim();

        if(line.length === 0) continue;
        else if(line[0] === '#') continue;

        else if(line.slice(0, 6) === 'newmtl'){
            let mtl_name = line.split(' ')[1];
            cur_mtl_name = mtl_name;
            material_map[mtl_name] = {
                Ns: 0,
                Ni: 0,
                illum: 0,
                Ka: [0, 0, 0],
                Kd: [0, 0, 0],
                Ks: [0, 0, 0],
                Ke: [0, 0, 0]
            };
        }

        else if(line.slice(0, 2) === 'Ns'){
            let cur_mtl = material_map[cur_mtl_name];
            cur_mtl['Ns'] = parseFloat(line.split(' ')[1]);
        } 

        else if(line.slice(0, 2) === 'Ni'){
            let cur_mtl = material_map[cur_mtl_name];
            cur_mtl['Ni'] = parseFloat(line.split(' ')[1]);
        } 

        else if(line.slice(0, 5) === 'illum'){
            let cur_mtl = material_map[cur_mtl_name];
            cur_mtl['illum'] = parseFloat(line.split(' ')[1]);
        } 

        else if(line.slice(0, 2) === 'Ka'){
            let cur_mtl = material_map[cur_mtl_name];
            cur_mtl['Ka'] = line.split(' ').slice(1, 4).map(parseFloat);
        } 

        else if(line.slice(0, 2) === 'Kd'){
            let cur_mtl = material_map[cur_mtl_name];
            cur_mtl['Kd'] = line.split(' ').slice(1, 4).map(parseFloat);
        } 

        else if(line.slice(0, 2) === 'Ks'){
            let cur_mtl = material_map[cur_mtl_name];
            cur_mtl['Ks'] = line.split(' ').slice(1, 4).map(parseFloat);
        } 

        else if(line.slice(0, 2) === 'Ke'){
            let cur_mtl = material_map[cur_mtl_name];
            cur_mtl['Ke'] = line.split(' ').slice(1, 4).map(parseFloat);
        } 
    }

    // match object groups with material map
    object_groups.objects.forEach(obj => {
        obj.material = material_map[obj.name] as any
    });

    return object_groups;
}