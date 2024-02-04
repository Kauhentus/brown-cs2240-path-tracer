import { SceneObjectGroup, SceneObjectMaterial } from "./ts-util/data-structs";

export const pack_scene_object_group = (g: SceneObjectGroup) => {
    let object_indices = g.objects.map((o, id) => {
        let new_indices = [];
        for(let i = 0; i < o.indices.length; i += 3){
            new_indices.push(
                o.indices[i],
                o.indices[i + 1],
                o.indices[i + 2],
                id
            );
        }
        return new_indices;
    }).flat();
    
    let object_materials = g.objects.map(o => o.material as SceneObjectMaterial)

    const pack_material = (m: SceneObjectMaterial) => {
        return [ // 3 + 3 * 4 = 15 floats long always
            m.Ns, m.Ni, m.illum,
            ...m.Ka,
            ...m.Kd,
            ...m.Ks,
            ...m.Ke,
        ];
    }
    let packed_materials = object_materials.map(pack_material).flat();

    let group = [
        g.vertices.length / 3, // num vertices
        g.objects.length, // num objects

        8, // index where vertices start
        8 + g.vertices.length, // index where object_indices start
        8 + g.vertices.length + object_indices.length, // index where packed_materials start,

        0, 0, 0 // padding so meta section is 8 bytes long!

    ].concat(g.vertices)
     .concat(object_indices)
     .concat(packed_materials);

    let current_group_length = group.length; // must be divisible by 16!
    let missing_offset = 16 - current_group_length % 16;
    let end_padding = new Array(missing_offset).fill(0);
    group = group.concat(end_padding);

    return new Float32Array(group);
}