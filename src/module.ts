import moduleFactory from "../lib/mucom88.js";

export enum MucomStatusType {
  PLAYING = 0,
  INTCOUNT = 1,
  PASSTICK = 2,
  MAJORVER = 3,
  MINORVER = 4,
  COUNT = 5,
  MAXCOUNT = 6,
  MUBSIZE = 7,
  MUBRATE = 8,
  BASICSIZE = 9,
  BASICRATE = 10,
  AUDIOMS = 11,
};

export interface CMucom {
  reset(sampleRate: number): void;
  loadMML(mml: string): number;
  compile(mml: string): Uint8Array;
  load(mub: Uint8Array): number;
  render(samples: number): Int16Array;
  getMessageBuffer(): string;
  getInfoBuffer(): string;
  getStatus(type: MucomStatusType): number;
  delete(): void;
}

export interface CMucomConstructor {
  new (): CMucom;
}

export interface Mucom88Module extends EmscriptenModule {
  ccall: typeof ccall;
  cwrap: typeof cwrap;
  addFunction: typeof addFunction;
  removeFunction: typeof removeFunction;
  FS: typeof FS;
  CMucom: CMucomConstructor;
}

let _module: Mucom88Module | null;

export async function initModule(): Promise<void> {
  _module = (await moduleFactory()) as Mucom88Module;
}

export function getModule(): Mucom88Module {
  if (_module == null) {
    throw new Error("Mucom88 module is not initialized.");
  }
  return _module;
}
