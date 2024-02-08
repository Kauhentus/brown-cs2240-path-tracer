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
        const MAX_DEPTH = 16;
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

            let axis: number;
            let nb = node.bounds;
            if(nb.stride_x >= nb.stride_y && nb.stride_x >= nb.stride_z){
                axis = 0;
            } else if(nb.stride_y >= nb.stride_x && nb.stride_y >= nb.stride_z){
                axis = 1;
            } else {
                axis = 2;
            }

            let split = 0.5;
            let split_step = 0.05;
            let cost = Infinity;
            let parent_sa = bounds_surface_area(nb);

            for(let s = split_step; s <= 1.0 - split_step; s += split_step){
                let cur_split = s;
                let split_coord_on_axis;
                let w0 = cur_split, w1 = 1.0 - cur_split;

                if(axis == 0) {
                    split_coord_on_axis = w0 * nb.max.x + w1 * nb.min.x;
                } else if(axis == 1) {
                    split_coord_on_axis = w0 * nb.max.y + w1 * nb.min.y;
                } else {
                    split_coord_on_axis = w0 * nb.max.z + w1 * nb.min.z;
                }

                let low_box = new Bounds(node.bounds.min.clone(), node.bounds.max.clone());
                let high_box = new Bounds(node.bounds.min.clone(), node.bounds.max.clone());
                
                if(axis == 0){
                    low_box.max.x = split_coord_on_axis;
                    high_box.min.x = split_coord_on_axis;
                } else if(axis == 1){
                    low_box.max.y = split_coord_on_axis;
                    high_box.min.y = split_coord_on_axis;
                } else {
                    low_box.max.z = split_coord_on_axis;
                    high_box.min.z = split_coord_on_axis;
                }

                let num_low = 0;
                let num_high = 0;

                for(let o of node.objects){
                    if(bounds_bounds_intersection_3d(o.bounds, low_box)){
                        num_low += 1;
                    } 
                    if(bounds_bounds_intersection_3d(o.bounds, high_box)){
                        num_high += 1;
                    }
                }

                let weight_l = bounds_surface_area(low_box) / parent_sa;
                let weight_r = bounds_surface_area(high_box) / parent_sa;
                let avg_num = (num_low + num_high) * 0.5;
                let cur_cost = Math.abs(num_low - avg_num) + Math.abs(num_high - avg_num);
                // let cur_cost = weight_l * num_low + weight_r * num_high;

                // console.log(num_low, num_high, split);
                
                if(cur_cost < cost){
                    split = cur_split;
                    cost = cur_cost;
                }
            }
            

            let left_bounds = new Bounds(node.bounds.min.clone(), node.bounds.max.clone());
            let right_bounds = new Bounds(node.bounds.min.clone(), node.bounds.max.clone());
            let split_coord_on_axis;
            let w0 = split, w1 = 1.0 - split;
            if(axis == 0) {
                split_coord_on_axis = w0 * nb.max.x + w1 * nb.min.x;
            } else if(axis == 1) {
                split_coord_on_axis = w0 * nb.max.y + w1 * nb.min.y;
            } else {
                split_coord_on_axis = w0 * nb.max.z + w1 * nb.min.z;
            }

            if(axis == 0){
                left_bounds.max.x = split_coord_on_axis;
                right_bounds.min.x = split_coord_on_axis;
            } else if(axis == 1){
                left_bounds.max.y = split_coord_on_axis;
                right_bounds.min.y = split_coord_on_axis;
            } else {
                left_bounds.max.z = split_coord_on_axis;
                right_bounds.min.z = split_coord_on_axis;
            }

            const left_bound_objects = node.objects.filter(o => bounds_bounds_intersection_3d(o.bounds, left_bounds));
            const right_bound_objects = node.objects.filter(o => bounds_bounds_intersection_3d(o.bounds, right_bounds));

            node.left_child = {
                is_leaf: false,
                axis: -1,
                bounds: left_bounds,
                objects: left_bound_objects
            }
            if(
                left_bound_objects.length <= MAX_OBJ_PER_NODE 
                || left_bound_objects.length === node.objects.length
            ){
                node.left_child.is_leaf = true;
                num_nodes += 1;
                num_leaves += 1;
                num_children.push(node.objects.length);
            } else {
                recurse(node.left_child, axis, depth + 1);
            }

            node.right_child = {
                is_leaf: false,
                axis: -1,
                bounds: right_bounds,
                objects: right_bound_objects
            }
            if(
                right_bound_objects.length <= MAX_OBJ_PER_NODE 
                || right_bound_objects.length === node.objects.length
            ) {
                node.right_child.is_leaf = true;
                num_nodes += 1;
                num_leaves += 1;
                num_children.push(node.objects.length);
            } else {
                recurse(node.right_child, axis, depth + 1);
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