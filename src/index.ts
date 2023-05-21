import {
  CHDATA,
  CMucom,
  MucomLogFileType,
  MucomStatusType,
  getModule,
  initModule,
} from "./module.js";
export { CHDATA, MucomStatusType } from "./module.js";

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

  compile(mml: string): Uint8Array {
    const u8a = this.mucom!.compile(mml);
    if (u8a.length == 0) {
      throw new Error("Compile error.");
    }
    return u8a.slice();
  }

  load(mub: Uint8Array): boolean {
    return this.mucom!.load(mub) == 0;
  }

  generateLogFile(
    mub: Uint8Array,
    type: MucomLogFileType,
    maxCount: number
  ): Uint8Array {
    for (const file of ["temp.vgm", "temp.s98"]) {
      try {
        Mucom88.FS.unlink(file);
      } catch (e) {}
    }
    const u8a = this.mucom!.generateLogFile(mub, type, maxCount);
    if (u8a.length == 0) {
      throw new Error("Failed to generate logfile.");
    }
    return u8a.slice();
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

  /**
   * Get count info of the compiled music.
   */
  getCountData(): {
    totalCounts: number[];
    loopCounts: number[];
    maxCount: number;
    hasGlobalLoop: boolean;
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

    let maxCount = 0;
    for (let i = 0; i < maxch; i++) {
      const sum = totalCounts[i] + loopCounts[i];
      if (maxCount < sum) {
        maxCount = sum;
      }
    }
    let hasGlobalLoop = loopCounts.every((e) => e == 0);

    return {
      totalCounts,
      loopCounts,
      maxCount,
      hasGlobalLoop,
      maxch,
    };
  }

  getChannelData(ch: number): CHDATA {
    return this.mucom!.getChannelData(ch);
  }

  getStatus(type: MucomStatusType): number {
    return this.mucom!.getStatus(type);
  }

  release(): void {
    this.mucom?.delete();
  }
}

export default Mucom88;
