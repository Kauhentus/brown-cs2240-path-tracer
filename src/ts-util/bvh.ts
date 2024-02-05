import { Bounds, Vertex, avg_nums, avg_v, bounds_bounds_intersection } from "@toysinbox3dprinting/js-geometry";

export type BVHObject = {obj: any, bounds: Bounds}
export type BVHNode = {
    is_leaf: boolean;
    axis: number; // 0, 1, 2
    bounds: Bounds;
    left_child?: BVHNode;
    right_child?: BVHNode;
    objects: BVHObject[];
}

export class BVH {
    objects: BVHObject[];
    outer_bounds: Bounds;
    root!: BVHNode;

    constructor(objects: BVHObject[], outer_bounds: Bounds){
        this.objects = objects;
        this.outer_bounds = outer_bounds;
    }

    construct(){
        const MAX_DEPTH = 8;
        const MAX_OBJ_PER_NODE = 8;

        const recurse = (node: BVHNode, axis: number, depth: number) => {
            if(depth >= MAX_DEPTH){
                node.is_leaf = true;
                return;
            }

            let left_bounds: Bounds, right_bounds: Bounds;
            if(axis === 0){
                let mid_x = avg_nums(node.bounds.min.x, node.bounds.max.x);
                left_bounds = new Bounds(
                    node.bounds.min, 
                    new Vertex(mid_x, node.bounds.max.y, node.bounds.max.z)
                );
                right_bounds = new Bounds(
                    new Vertex(mid_x, node.bounds.min.y, node.bounds.min.z), 
                    node.bounds.max
                );
            } else if(axis === 1){
                let mid_y = avg_nums(node.bounds.min.y, node.bounds.max.y);
                left_bounds = new Bounds(
                    node.bounds.min, 
                    new Vertex(node.bounds.max.x, mid_y, node.bounds.max.z)
                );
                right_bounds = new Bounds(
                    new Vertex(node.bounds.min.x, mid_y, node.bounds.min.z), 
                    node.bounds.max
                );
            } else {
                let mid_z = avg_nums(node.bounds.min.z, node.bounds.max.z);
                left_bounds = new Bounds(
                    node.bounds.min, 
                    new Vertex(node.bounds.max.x, node.bounds.max.y, mid_z)
                );
                right_bounds = new Bounds(
                    new Vertex(node.bounds.min.x, node.bounds.min.y, mid_z), 
                    node.bounds.max
                );
            }

            let left_bound_objects = node.objects.filter(o => bounds_bounds_intersection(o.bounds, left_bounds));
            let right_bound_objects = node.objects.filter(o => bounds_bounds_intersection(o.bounds, right_bounds));
            // console.log("LRB", left_bounds, right_bounds)
            // console.log("LR", node.objects.length, left_bound_objects.length, right_bound_objects.length)
            let new_axis = (axis + 1) % 3;

            node.left_child = {
                is_leaf: false,
                axis: new_axis,
                bounds: left_bounds,
                objects: left_bound_objects
            }
            if(left_bound_objects.length <= MAX_OBJ_PER_NODE) node.left_child.is_leaf = true;
            else recurse(node.left_child, new_axis, depth + 1);

            node.right_child = {
                is_leaf: false,
                axis: new_axis,
                bounds: right_bounds,
                objects: right_bound_objects
            }
            if(right_bound_objects.length <= MAX_OBJ_PER_NODE) node.right_child.is_leaf = true;
            else recurse(node.right_child, new_axis, depth + 1);
        }

        this.root = {
            is_leaf: false,
            axis: 0, 
            bounds: this.outer_bounds,
            objects: this.objects
        }
        recurse(this.root, 0, 1);
    }
}