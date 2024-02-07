import { BVH, BVHNode } from "./ts-util/bvh";
import { SceneObjectGroup, SceneObjectMaterial } from "./ts-util/data-structs";

export const pack_scene_object_group = (g: SceneObjectGroup) => {
    // pack and parse object data
    let object_indices = g.objects.map((o, id) => {
        let new_indices: number[] = [];
        for(let i = 0; i < o.indices.length; i += 3){
            new_indices.push(
                o.indices[i],
                o.indices[i + 1],
                o.indices[i + 2],
                id
            );
        }
        return new_indices;
    });
    let object_indices_flat = object_indices.flat();

    let emissive_object_ids = g.objects.map((o, i) => {
        return (o.material as SceneObjectMaterial).Ke.some(n => n > 0) ? i : -1;
    }).filter(i => i != -1);
    let object_sizes = object_indices.map(indices => indices.length);
    let object_offsets = object_sizes.reduce((a, v) => {
        a.push(a.at(-1) as number + v);
        return a;
    }, [16 + g.vertices.length]).slice(0, -1);
    let emissive_offsets = emissive_object_ids.map(i => {
        return [object_offsets[i], object_offsets[i] + object_sizes[i]];
    });
    // console.log(object_offsets)
    // console.log(emissive_offsets)
    // console.log(emissive_offsets[0], emissive_offsets[2])
    
    // pack and parse material data
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
        // meta section is 16 bytes long!

        g.vertices.length / 3, // num vertices
        g.objects.length, // num objects

        16, // index where vertices start
        16 + g.vertices.length, // index where object_indices start
        16 + g.vertices.length + object_indices_flat.length, // index where packed_materials start,

        0, 0, 0, // padding

        // tells us which objects are emissive -- supports up to four
        // starting triangle index to ending triangle index
        ...(emissive_offsets[0] ? emissive_offsets[0] : [-1, -1]), // starts at index 8
        ...(emissive_offsets[1] ? emissive_offsets[1] : [-1, -1]), 
        ...(emissive_offsets[2] ? emissive_offsets[2] : [-1, -1]), 
        ...(emissive_offsets[3] ? emissive_offsets[3] : [-1, -1]), 

    ].concat(g.vertices)
     .concat(object_indices_flat)
     .concat(packed_materials);

    let current_group_length = group.length; // must be divisible by 16!
    let missing_offset = 16 - current_group_length % 16;
    let end_padding = new Array(missing_offset).fill(0);
    group = group.concat(end_padding);

    return new Float32Array(group);
}

export const pack_bvh = (bvh: BVH<number[]>) => {
    const result: number[] = [
        ...bvh.outer_bounds.min.toArray(),
        ...bvh.outer_bounds.max.toArray(),
    ];

    let num_objects = 0;

    // node data
    // 0, 0,          is_leaf, axis
    // 0, 0,          left child index, right child index
    // n,             num nodes
    // [0, 0, 0]x n   indices for triangle
    const recurse = (node: BVHNode<number[]>) => {
        let is_leaf = node.is_leaf;
        let children = is_leaf ? node.objects.map(o => o.obj).flat() : [];
        let num_children = children.length;

        let cur_offset = result.length;
        let left_node_offset = cur_offset + 5 + 12 + children.length;
        let right_node_offset_index = cur_offset + 3;

        if(is_leaf) num_objects += children.length / 4;

        result.push(
            is_leaf ? 1 : 0, 
            node.axis,

            is_leaf ? -1 : left_node_offset, // left node index
            -1, // right node index

            is_leaf ? num_children : -2,
            ...node.left_child ? node.left_child.bounds.min.toArray() : [0, 0, 0],
            ...node.left_child ? node.left_child.bounds.max.toArray() : [0, 0, 0],
            ...node.right_child ? node.right_child.bounds.min.toArray() : [0, 0, 0],
            ...node.right_child ? node.right_child.bounds.max.toArray() : [0, 0, 0],
            ...children
        );

        if(!is_leaf && node.left_child) recurse(node.left_child);

        if(!is_leaf && node.right_child) {
            let right_node_offset = result.length;
            result[right_node_offset_index] = right_node_offset;
            recurse(node.right_child);
        }
    }
    
    recurse(bvh.root);

    // console.log(result);
    // console.log(num_objects);

    return new Float32Array(result);
}