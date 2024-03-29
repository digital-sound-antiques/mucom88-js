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

export enum MucomLogFileType {
  VGM = 0,
  S98 = 1, 
};

export type CHDATA = {
  length: number;
  vnum: number;
  volume: number;
  wadr: number;
  tadr: number;
  chnum: number;
  detune: number;
  reverb: number;
  lfo_diff: number;
  quantize: number;
  pan: number;
  flag: number;
  flag2: number;
  code: number;
  note: number;
  vnum_org: number;
  vol_org: number;
};

export interface CMucom {
  reset(sampleRate: number): void;
  loadMML(mml: string): number;
  compile(mml: string): Uint8Array;
  load(mub: Uint8Array): number;
  generateLogFile(mub: Uint8Array, type: MucomLogFileType, maxCount: number): Uint8Array;
  render(samples: number): Int16Array;
  getMessageBuffer(): string;
  getInfoBuffer(): string;
  getStatus(type: MucomStatusType): number;
  getChannelData(ch: number): CHDATA;
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
