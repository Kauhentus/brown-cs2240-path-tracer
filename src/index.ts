import { programEntry } from "./program-raymarch";
// import { init_three } from "@toysinbox3dprinting/js-geometry";
// init_three();

const x_res = 512 * 1.5;
const aspect_ratio = 1.5;
const round_4 = (n : number) => Math.floor(n / 4) * 4;
const screenDimension = [round_4(x_res), round_4(x_res / aspect_ratio)];
const mainCanvas = document.getElementById('main-canvas') as HTMLCanvasElement;
mainCanvas.width = screenDimension[0];
mainCanvas.height = screenDimension[1];

const ctx = mainCanvas.getContext('2d') as CanvasRenderingContext2D;

console.log("hello world");

programEntry(screenDimension, ctx);