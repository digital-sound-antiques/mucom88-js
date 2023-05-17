import { CMucom, MucomStatusType, getModule, initModule } from "./module.js";
export { MucomStatusType } from "./module.js";

export type PCHDATA = {
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
  keyon: number;
  vnum_org: number;
  vol_org: number;
};

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
    if (samples > 192000) {
      throw new Error("Samples too long.");
    }
    return this.mucom!.render(samples);
  }

  getMessageBuffer(): string {
    return this.mucom!.getMessageBuffer().replace(/\r\n/g, "\n");
  }

  getInfoBuffer(): string {
    return this.mucom!.getInfoBuffer().replace(/\r\n/g, "\n");
  }

  getChannelCounts(): {
    totalCounts: number[];
    loopCounts: number[];    
    maxch: 11;
  } {
    const maxch = 11;
    const lines = this.getMessageBuffer().split(/\n/);
    const totalCounts = new Array<number>(maxch);
    const loopCounts = new Array<number>(maxch);

    const parseCounts = (line: string, counters: number[]) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length == maxch) {
        for (let i = 0; i < maxch; i++) {
          counters[i] = parseInt(parts[i].split(":")[1]);
        }
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\[\s*Total\s+count\s*\]/i.test(line)) {
        i++;
        parseCounts(lines[i], totalCounts);
      } else if (/^\[\s*Loop\s+count\s*\]/i.test(line)) {
        i++;
        parseCounts(lines[i], loopCounts);
      }
    }

    return {
      totalCounts,
      loopCounts,
      maxch,
    };
  }

  getChannelData(ch: number): PCHDATA {
    return this.mucom!.getChannelData(ch) as PCHDATA;
  }

  getStatus(type: MucomStatusType): number {
    return this.mucom!.getStatus(type);
  }

  release(): void {
    this.mucom?.delete();
  }
}

export default Mucom88;
