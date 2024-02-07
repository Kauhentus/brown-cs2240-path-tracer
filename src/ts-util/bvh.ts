import { Bounds, Vertex, avg_nums } from "@toysinbox3dprinting/js-geometry";
import { bounds_bounds_intersection_3d, bounds_surface_area } from "./math";

export type BVHObject<T> = {obj: T, bounds: Bounds}
export type BVHNode<T> = {
    is_leaf: boolean;
    axis: number; // 0, 1, 2
    bounds: Bounds;
    left_child?: BVHNode<T>;
    right_child?: BVHNode<T>;
    objects: BVHObject<T>[];
}

export class BVH<T> {
    objects: BVHObject<T>[];
    outer_bounds: Bounds;
    root!: BVHNode<T>;

    constructor(objects: BVHObject<T>[], outer_bounds: Bounds){
        this.objects = objects;
        this.outer_bounds = outer_bounds;
        this.construct();
    }

    construct(){
        console.log(`Constructing BVH with ${this.objects.length} objects`)
        const MAX_DEPTH = 4;
        const MAX_OBJ_PER_NODE = 16;

        let num_nodes = 0;
        let num_leaves = 0;
        let num_children: number[] = [];

        const recurse = (node: BVHNode<T>, _axis: number, depth: number) => {
            num_nodes += 1;

            if(depth >= MAX_DEPTH){
                node.is_leaf = true;
                num_leaves += 1;
                num_children.push(node.objects.length);
                return;
            }

            let left_bounds_0: Bounds, right_bounds_0: Bounds;
            let left_bounds_1: Bounds, right_bounds_1: Bounds;
            let left_bounds_2: Bounds, right_bounds_2: Bounds;

            // let axis: number;
            // let nb = node.bounds;
            // if(nb.stride_x >= nb.stride_y && nb.stride_x >= nb.stride_z){
            //     axis = 0;
            // } else if(nb.stride_y >= nb.stride_x && nb.stride_y >= nb.stride_z){
            //     axis = 2;
            // } else {
            //     axis = 1;
            // }

            // let split = 0.5;
            // let cost = Infinity;
            // let parent_sa = bounds_surface_area(nb);

            // for(let s = 0.0; s <+ 1.0; s+= 0.05){
            //     let cur_split = s;
            //     let split_coord_on_axis;
            //     let w0 = cur_split, w1 = 1.0 - cur_split;

            //     if(axis == 0) {
            //         split_coord_on_axis = w0 * nb.max.x + w1 * nb.min.x;
            //     } else if(axis == 1) {
            //         split_coord_on_axis = w0 * nb.max.y + w1 * nb.min.y;
            //     } else {
            //         split_coord_on_axis = w0 * nb.max.z + w1 * nb.min.z;
            //     }

            //     let low_box = new Bounds(node.bounds.min, node.bounds.max);
            //     let high_box = new Bounds(node.bounds.max, node.bounds.max);
                
            //     if(axis == 0){
            //         low_box.max.x = split_coord_on_axis;
            //         high_box.min.x = split_coord_on_axis;
            //     } else if(axis == 1){
            //         low_box.max.y = split_coord_on_axis;
            //         high_box.min.y = split_coord_on_axis;
            //     } else {
            //         low_box.max.z = split_coord_on_axis;
            //         high_box.min.z = split_coord_on_axis;
            //     }

            //     let num_low = 0;
            //     let num_high = 0;

            //     for(let o of node.objects){
            //         if(bounds_bounds_intersection_3d(o.bounds, low_box)){
            //             num_low += 1;
            //         } 
            //         if(bounds_bounds_intersection_3d(o.bounds, high_box)){
            //             num_high += 1;
            //         }
            //     }

            //     let weight_l = bounds_surface_area(low_box) / parent_sa;
            //     let weight_r = bounds_surface_area(high_box) / parent_sa;
            //     let cur_cost = weight_l * num_low + weight_r * num_high;

            //     if(cur_cost < cost){
            //         split = cur_split;
            //         cost = cur_cost;
            //     }
            // }

            let mid_x = (node.bounds.min.x + node.bounds.max.x) * 0.5;
            left_bounds_0 = new Bounds(
                node.bounds.min, 
                new Vertex(mid_x, node.bounds.max.y, node.bounds.max.z)
            );
            right_bounds_0 = new Bounds(
                new Vertex(mid_x, node.bounds.min.y, node.bounds.min.z), 
                node.bounds.max
            );

            let mid_y = (node.bounds.min.y + node.bounds.max.y) * 0.5;
            left_bounds_1 = new Bounds(
                node.bounds.min, 
                new Vertex(node.bounds.max.x, mid_y, node.bounds.max.z)
            );
            right_bounds_1 = new Bounds(
                new Vertex(node.bounds.min.x, mid_y, node.bounds.min.z), 
                node.bounds.max
            );

            let mid_z = (node.bounds.min.z + node.bounds.max.z) * 0.5;
            left_bounds_2 = new Bounds(
                node.bounds.min, 
                new Vertex(node.bounds.max.x, node.bounds.max.y, mid_z)
            );
            right_bounds_2 = new Bounds(
                new Vertex(node.bounds.min.x, node.bounds.min.y, mid_z), 
                node.bounds.max
            );

            let left_bound_objects_0 = node.objects.filter(o => bounds_bounds_intersection_3d(o.bounds, left_bounds_0));
            let right_bound_objects_0 = node.objects.filter(o => bounds_bounds_intersection_3d(o.bounds, right_bounds_0));
            let left_bound_objects_1 = node.objects.filter(o => bounds_bounds_intersection_3d(o.bounds, left_bounds_1));
            let right_bound_objects_1 = node.objects.filter(o => bounds_bounds_intersection_3d(o.bounds, right_bounds_1));
            let left_bound_objects_2 = node.objects.filter(o => bounds_bounds_intersection_3d(o.bounds, left_bounds_2));
            let right_bound_objects_2 = node.objects.filter(o => bounds_bounds_intersection_3d(o.bounds, right_bounds_2));

            let target_num = node.objects.length / 2;
            let split_0 = Math.abs(left_bound_objects_0.length - target_num) + Math.abs(right_bound_objects_0.length - target_num);
            let split_1 = Math.abs(left_bound_objects_1.length - target_num) + Math.abs(right_bound_objects_1.length - target_num);
            let split_2 = Math.abs(left_bound_objects_2.length - target_num) + Math.abs(right_bound_objects_2.length - target_num);
            let min_split = Math.min(split_0, split_1, split_2);

            let new_axis = min_split === split_0 ? 
                0 : min_split === split_1 ? 
                1 : 
                2;
            let left_bounds = min_split === split_0 ? 
                left_bounds_0 : min_split === split_1 ? 
                left_bounds_1 : 
                left_bounds_2;
            let right_bounds = min_split === split_0 ? 
                right_bounds_0 : min_split === split_1 ? 
                right_bounds_1 : 
                right_bounds_2;
            let left_bound_objects = min_split === split_0 ? 
                left_bound_objects_0 : min_split === split_1 ? 
                left_bound_objects_1 : 
                left_bound_objects_2;
            let right_bound_objects = min_split === split_0 ? 
                right_bound_objects_0 : min_split === split_1 ? 
                right_bound_objects_1 : 
                right_bound_objects_2;
            node.axis = new_axis;

            node.left_child = {
                is_leaf: false,
                axis: -1,
                bounds: left_bounds,
                objects: left_bound_objects
            }
            if(
                left_bound_objects.length <= MAX_OBJ_PER_NODE || 
                left_bound_objects.length === node.objects.length
            ){
                node.left_child.is_leaf = true;
                num_nodes += 1;
                num_leaves += 1;
                num_children.push(node.objects.length);
            } else {
                recurse(node.left_child, new_axis, depth + 1);
            }

            node.right_child = {
                is_leaf: false,
                axis: -1,
                bounds: right_bounds,
                objects: right_bound_objects
            }
            if(
                right_bound_objects.length <= MAX_OBJ_PER_NODE ||
                right_bound_objects.length === node.objects.length
            ) {
                node.right_child.is_leaf = true;
                num_nodes += 1;
                num_leaves += 1;
                num_children.push(node.objects.length);
            } else {
                recurse(node.right_child, new_axis, depth + 1);
            }
        }

        this.root = {
            is_leaf: false,
            axis: 0, 
            bounds: this.outer_bounds,
            objects: this.objects
        }
        recurse(this.root, 0, 1);

        console.log(`    Finished with ${num_nodes} nodes created`)
        console.log(`    Contains ${num_leaves} leaf nodes`)
        console.log(`    Leaf nodes average ${avg_nums(...num_children)} primitives each`)
    }
}