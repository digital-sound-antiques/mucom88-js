import { CMucom, MucomStatusType, getModule, initModule } from "./module.js";
export { MucomStatusType } from "./module.js";

export class Mucom88 {
  static async initialize() {
    await initModule();
  }

  static get module() {
    return getModule();
  }

  static get FS() {
    return getModule().FS;
  }

  constructor() {
    this.mucom = new (getModule().CMucom)();
  }

  mucom: CMucom | null = null;
  sampleRate: number = 44100;

  reset(sampleRate: number) {
    this.mucom!.reset(sampleRate);
    this.sampleRate = sampleRate;
  }

  loadMML(mml: string): boolean {
    return this.mucom!.loadMML(mml) == 0;
  }

  compile(mml: string): Uint8Array | null {
    const u8a = this.mucom!.compile(mml);
    return u8a.length > 0 ? u8a : null;
  }

  load(mub: Uint8Array): boolean {
    return this.mucom!.load(mub) == 0;
  }

  render(samples: number): Int16Array {
    return this.mucom!.render(samples);
  }

  getMessageBuffer(): string {
    return this.mucom!.getMessageBuffer().replace(/\r\n/g, '\n');
  }

  getInfoBuffer(): string {
    return this.mucom!.getInfoBuffer().replace(/\r\n/g, '\n');
  }

  getStatus(type: MucomStatusType): number {
    return this.mucom!.getStatus(type);
  }

  release(): void {
    this.mucom?.delete();
  }
}

export default Mucom88;