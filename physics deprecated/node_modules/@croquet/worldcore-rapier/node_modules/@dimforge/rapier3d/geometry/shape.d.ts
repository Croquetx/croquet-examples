import { Vector } from "../math";
import { RawShape } from "../raw";
/**
 * The type of a shape supported by Rapier.
 */
export declare type Shape = Ball | Cuboid | Capsule | Segment | Triangle | TriMesh | Heightfield | ConvexPolyhedron | Cylinder | Cone | RoundCuboid | RoundCylinder | RoundCone | RoundConvexPolyhedron;
/**
 * An enumeration representing the type of a shape.
 */
export declare enum ShapeType {
    Ball = 0,
    Cuboid = 1,
    Capsule = 2,
    Segment = 3,
    Polyline = 4,
    Triangle = 5,
    TriMesh = 6,
    HeightField = 7,
    ConvexPolyhedron = 9,
    Cylinder = 10,
    Cone = 11,
    RoundCuboid = 12,
    RoundTriangle = 13,
    RoundCylinder = 14,
    RoundCone = 15,
    RoundConvexPolyhedron = 16
}
/**
 * A shape that is a sphere in 3D and a circle in 2D.
 */
export declare class Ball {
    /**
     * The balls radius.
     */
    readonly radius: number;
    /**
     * Creates a new ball with the given radius.
     * @param radius - The balls radius.
     */
    constructor(radius: number);
    intoRaw(): RawShape;
}
/**
 * A shape that is a box in 3D and a rectangle in 2D.
 */
export declare class Cuboid {
    /**
     * The half extent of the cuboid along each coordinate axis.
     */
    halfExtents: Vector;
    /**
     * Creates a new 3D cuboid.
     * @param hx - The half width of the cuboid.
     * @param hy - The half height of the cuboid.
     * @param hz - The half depth of the cuboid.
     */
    constructor(hx: number, hy: number, hz: number);
    intoRaw(): RawShape;
}
/**
 * A shape that is a box in 3D and a rectangle in 2D, with round corners.
 */
export declare class RoundCuboid {
    /**
     * The half extent of the cuboid along each coordinate axis.
     */
    halfExtents: Vector;
    /**
     * The radius of the cuboid's round border.
     */
    borderRadius: number;
    /**
     * Creates a new 3D cuboid.
     * @param hx - The half width of the cuboid.
     * @param hy - The half height of the cuboid.
     * @param hz - The half depth of the cuboid.
     * @param borderRadius - The radius of the borders of this cuboid. This will
     *   effectively increase the half-extents of the cuboid by this radius.
     */
    constructor(hx: number, hy: number, hz: number, borderRadius: number);
    intoRaw(): RawShape;
}
/**
 * A shape that is a capsule.
 */
export declare class Capsule {
    /**
     * The radius of the capsule's basis.
     */
    readonly radius: number;
    /**
     * The capsule's half height, along the `y` axis.
     */
    readonly halfHeight: number;
    /**
     * Creates a new capsule with the given radius and half-height.
     * @param halfHeight - The balls half-height along the `y` axis.
     * @param radius - The balls radius.
     */
    constructor(halfHeight: number, radius: number);
    intoRaw(): RawShape;
}
/**
 * A shape that is a segment.
 */
export declare class Segment {
    /**
     * The first point of the segment.
     */
    readonly a: Vector;
    /**
     * The second point of the segment.
     */
    readonly b: Vector;
    /**
     * Creates a new segment shape.
     * @param a - The first point of the segment.
     * @param b - The second point of the segment.
     */
    constructor(a: Vector, b: Vector);
    intoRaw(): RawShape;
}
/**
 * A shape that is a segment.
 */
export declare class Triangle {
    /**
     * The first point of the triangle.
     */
    readonly a: Vector;
    /**
     * The second point of the triangle.
     */
    readonly b: Vector;
    /**
     * The second point of the triangle.
     */
    readonly c: Vector;
    /**
     * Creates a new triangle shape.
     *
     * @param a - The first point of the triangle.
     * @param b - The second point of the triangle.
     * @param c - The third point of the triangle.
     */
    constructor(a: Vector, b: Vector, c: Vector);
    intoRaw(): RawShape;
}
/**
 * A shape that is a triangle with round borders and a non-zero thickness.
 */
export declare class RoundTriangle {
    /**
     * The first point of the triangle.
     */
    readonly a: Vector;
    /**
     * The second point of the triangle.
     */
    readonly b: Vector;
    /**
     * The second point of the triangle.
     */
    readonly c: Vector;
    /**
     * The radius of the triangles's rounded edges and vertices.
     * In 3D, this is also equal to half the thickness of the round triangle.
     */
    readonly borderRadius: number;
    /**
     * Creates a new triangle shape with round corners.
     *
     * @param a - The first point of the triangle.
     * @param b - The second point of the triangle.
     * @param c - The third point of the triangle.
     * @param borderRadius - The radius of the borders of this triangle. In 3D,
     *   this is also equal to half the thickness of the triangle.
     */
    constructor(a: Vector, b: Vector, c: Vector, borderRadius: number);
    intoRaw(): RawShape;
}
/**
 * A shape that is a triangle mesh.
 */
export declare class Polyline {
    /**
     * The vertices of the polyline.
     */
    readonly vertices: Float32Array;
    /**
     * The indices of the segments.
     */
    readonly indices: Uint32Array;
    /**
     * Creates a new polyline shape.
     *
     * @param vertices - The coordinates of the polyline's vertices.
     * @param indices - The indices of the polyline's segments. If this is `null` then
     *    the vertices are assumed to form a line strip.
     */
    constructor(vertices: Float32Array, indices: Uint32Array);
    intoRaw(): RawShape;
}
/**
 * A shape that is a triangle mesh.
 */
export declare class TriMesh {
    /**
     * The vertices of the triangle mesh.
     */
    readonly vertices: Float32Array;
    /**
     * The indices of the triangles.
     */
    readonly indices: Uint32Array;
    /**
     * Creates a new triangle mesh shape.
     *
     * @param vertices - The coordinates of the triangle mesh's vertices.
     * @param indices - The indices of the triangle mesh's triangles.
     */
    constructor(vertices: Float32Array, indices: Uint32Array);
    intoRaw(): RawShape;
}
/**
 * A shape that is a convex polygon.
 */
export declare class ConvexPolyhedron {
    /**
     * The vertices of the convex polygon.
     */
    readonly vertices: Float32Array;
    /**
     * The indices of the convex polygon.
     */
    readonly indices: Uint32Array | null;
    /**
     * Creates a new convex polygon shape.
     *
     * @param vertices - The coordinates of the convex polygon's vertices.
     * @param indices - The index buffer of this convex mesh. If this is `null`
     *   or `undefined`, the convex-hull of the input vertices will be computed
     *   automatically. Otherwise, it will be assumed that the mesh you provide
     *   is already convex.
     */
    constructor(vertices: Float32Array, indices: Uint32Array | null);
    intoRaw(): RawShape;
}
/**
 * A shape that is a convex polygon.
 */
export declare class RoundConvexPolyhedron {
    /**
     * The vertices of the convex polygon.
     */
    readonly vertices: Float32Array;
    /**
     * The indices of the convex polygon.
     */
    readonly indices: Uint32Array | null;
    /**
     * The radius of the convex polyhedron's rounded edges and vertices.
     */
    readonly borderRadius: number;
    /**
     * Creates a new convex polygon shape.
     *
     * @param vertices - The coordinates of the convex polygon's vertices.
     * @param indices - The index buffer of this convex mesh. If this is `null`
     *   or `undefined`, the convex-hull of the input vertices will be computed
     *   automatically. Otherwise, it will be assumed that the mesh you provide
     *   is already convex.
     * @param borderRadius - The radius of the borders of this convex polyhedron.
     */
    constructor(vertices: Float32Array, indices: Uint32Array | null, borderRadius: number);
    intoRaw(): RawShape;
}
/**
 * A shape that is a heightfield.
 */
export declare class Heightfield {
    /**
     * The number of rows in the heights matrix.
     */
    readonly nrows: number;
    /**
     * The number of columns in the heights matrix.
     */
    readonly ncols: number;
    /**
     * The heights of the heightfield along its local `y` axis,
     * provided as a matrix stored in column-major order.
     */
    readonly heights: Float32Array;
    /**
     * The dimensions of the heightfield's local `x,z` plane.
     */
    readonly scale: Vector;
    /**
     * Creates a new heightfield shape.
     *
     * @param nrows − The number of rows in the heights matrix.
     * @param ncols - The number of columns in the heights matrix.
     * @param heights - The heights of the heightfield along its local `y` axis,
     *                  provided as a matrix stored in column-major order.
     * @param scale - The dimensions of the heightfield's local `x,z` plane.
     */
    constructor(nrows: number, ncols: number, heights: Float32Array, scale: Vector);
    intoRaw(): RawShape;
}
/**
 * A shape that is a 3D cylinder.
 */
export declare class Cylinder {
    /**
     * The radius of the cylinder's basis.
     */
    readonly radius: number;
    /**
     * The cylinder's half height, along the `y` axis.
     */
    readonly halfHeight: number;
    /**
     * Creates a new cylinder with the given radius and half-height.
     * @param halfHeight - The balls half-height along the `y` axis.
     * @param radius - The balls radius.
     */
    constructor(halfHeight: number, radius: number);
    intoRaw(): RawShape;
}
/**
 * A shape that is a 3D cylinder with round corners.
 */
export declare class RoundCylinder {
    /**
     * The radius of the cylinder's basis.
     */
    readonly radius: number;
    /**
     * The cylinder's half height, along the `y` axis.
     */
    readonly halfHeight: number;
    /**
     * The radius of the cylinder's rounded edges and vertices.
     */
    readonly borderRadius: number;
    /**
     * Creates a new cylinder with the given radius and half-height.
     * @param halfHeight - The balls half-height along the `y` axis.
     * @param radius - The balls radius.
     * @param borderRadius - The radius of the borders of this cylinder.
     */
    constructor(halfHeight: number, radius: number, borderRadius: number);
    intoRaw(): RawShape;
}
/**
 * A shape that is a 3D cone.
 */
export declare class Cone {
    /**
     * The radius of the cone's basis.
     */
    readonly radius: number;
    /**
     * The cone's half height, along the `y` axis.
     */
    readonly halfHeight: number;
    /**
     * Creates a new cone with the given radius and half-height.
     * @param halfHeight - The balls half-height along the `y` axis.
     * @param radius - The balls radius.
     */
    constructor(halfHeight: number, radius: number);
    intoRaw(): RawShape;
}
/**
 * A shape that is a 3D cone with round corners.
 */
export declare class RoundCone {
    /**
     * The radius of the cone's basis.
     */
    readonly radius: number;
    /**
     * The cone's half height, along the `y` axis.
     */
    readonly halfHeight: number;
    /**
     * The radius of the cylinder's rounded edges and vertices.
     */
    readonly borderRadius: number;
    /**
     * Creates a new cone with the given radius and half-height.
     * @param halfHeight - The balls half-height along the `y` axis.
     * @param radius - The balls radius.
     * @param borderRadius - The radius of the borders of this cone.
     */
    constructor(halfHeight: number, radius: number, borderRadius: number);
    intoRaw(): RawShape;
}
