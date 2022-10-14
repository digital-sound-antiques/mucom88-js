import moduleFactory from '../lib/mucom88.js';

interface CMucom {
  init(): void;
  loadMML(mml: string): number;
  render(buffer: number, samples: number): void;
}

interface CMucomConstructor {
  new (): CMucom;
}

interface Mucom88Module extends EmscriptenModule {
  ccall: typeof ccall;
  cwrap: typeof cwrap;
  addFunction: typeof addFunction;
  removeFunction: typeof removeFunction;
  FS: typeof FS;
  CMucom: CMucomConstructor;
}

let _module: Mucom88Module | null;

export async function initModule(): Promise<void> {
  _module = await moduleFactory() as Mucom88Module;
}

export function getModule(): Mucom88Module {
  if (_module == null) {
    throw new Error("Mucom88 module is not initialized.");
  }
  return _module;
}
