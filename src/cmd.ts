import commandLineArgs from "command-line-args";
import commandLineUsage from "command-line-usage";
import fs from "fs";
import { basename, dirname } from "path";
import pkg from "wavefile";
import { detectEncoding } from "./detect-encoding.js";
import { Mucom88 } from "./index.js";
import { MucomLogFileType, MucomStatusType } from "./module.js";
const { WaveFile } = pkg;

function findAttachments(mml: string) {
  let voiceFile;
  let pcmFile;
  let m = mml.match(/^#voice\s+([^\s]+)$/m);
  if (m != null) {
    voiceFile = m[1];
  }
  m = mml.match(/^#pcm\s+([^\s]+)$/m);
  if (m != null) {
    pcmFile = m[1];
  }
  return { voiceFile, pcmFile };
}

const optionDefinitions = [
  {
    name: "input",
    alias: "i",
    description: "Specify a .muc file to be processed.",
    type: String,
    defaultOption: true,
    typeLabel: "file",
  },
  {
    name: "output",
    alias: "o",
    description: "Specify an output filename (without extension).",
    type: String,
    typeLabel: "file",
  },
  {
    name: "encoding",
    alias: "e",
    description: "Specify an encoding of input .muc file. (default: auto)",
    type: String,
    typeLabel: "auto|utf-8|shift-jis",
  },
  {
    name: "type",
    description: "Ouptut file type (default: wav)",
    type: String,
    defaultValue: "wav",
    typeLabel: "wav|mub|vgm|s98",
  },
  {
    name: "help",
    alias: "h",
    description: "Show this help",
    type: Boolean,
  },
];

const sections = [
  {
    header: "Options",
    optionList: optionDefinitions,
  },
];

export async function main() {
  await Mucom88.initialize();

  const options = commandLineArgs(optionDefinitions);

  if (options.input == null || options.help) {
    console.log(commandLineUsage(sections));
    process.exit(0);
  }

  const input: string = options.input;
  const name = basename(input).replace(/\..+$/, "");
  const output: string = options.output ?? name;
  let encoding: string = options.encoding;

  const data = fs.readFileSync(input);

  if (encoding == null || encoding == "auto") {
    encoding = detectEncoding(data) ?? "utf-8";
    console.log(`Guessed file encoding: ${encoding}`);
  }

  const mml = new TextDecoder(encoding).decode(data);
  const { voiceFile, pcmFile } = findAttachments(mml);

  if (voiceFile != null) {
    console.log(`#voice ${voiceFile}`);
    const file = `${dirname(input)}/${voiceFile}`;
    if (fs.existsSync(file)) {
      console.log(`Found: ${voiceFile}`);
      const data = fs.readFileSync(file);
      writeMemFile(voiceFile, data);
    }
  }

  if (pcmFile != null) {
    console.log(`#pcm ${pcmFile}`);
    const file = `${dirname(input)}/${pcmFile}`;
    if (fs.existsSync(file)) {
      console.log(`Found: ${pcmFile}`);
      const data = fs.readFileSync(file);
      writeMemFile(pcmFile, data);
    }
  }

  const mucom = new Mucom88();
  const sampleRate = 55467; // 44100;

  mucom.reset(sampleRate);

  try {
    if (options.type == "wav") {
      mucom.loadMML(mml);
      console.log(mucom.getMessageBuffer());

      const ch = 2;
      const maxSeconds = 60 * 5;
      const res = new Int16Array(sampleRate * ch * maxSeconds);
      const { maxCount } = mucom.getCountData();
      const start = Date.now();

      let time = 0;
      for (time = 0; time < maxSeconds; time++) {
        const buf = mucom.render(sampleRate);
        res.set(buf, time * sampleRate * ch);
        const count = mucom.getStatus(MucomStatusType.INTCOUNT);
        console.log(`${count}/${maxCount}`);
        if (count >= maxCount) {
          break;
        }
      }

      const elapsed = Date.now() - start;
      console.log(
        `elapsed: ${elapsed}ms (${((time * 1000) / elapsed).toFixed(
          2
        )}x faster than realtime)`
      );
      const wav = new WaveFile();
      const length = sampleRate * ch * (time + 1);
      wav.fromScratch(2, sampleRate, "16", res.slice(0, length));
      fs.writeFileSync(`${output}.wav`, wav.toBuffer());
    } else if (options.type == "mub") {
      const mub = mucom.compile(mml);
      console.log(mucom.getMessageBuffer());
      fs.writeFileSync(`${output}.mub`, mub);
    } else if (options.type == "s98") {
      const mub = mucom.compile(mml);
      console.log(mucom.getMessageBuffer());
      const { maxCount } = mucom.getCountData();
      const vgm = mucom.generateLogFile(mub, MucomLogFileType.S98, maxCount);
      fs.writeFileSync(`${output}.s98`, vgm);
    } else if (options.type == "vgm") {
      const mub = mucom.compile(mml);
      console.log(mucom.getMessageBuffer());
      const { maxCount } = mucom.getCountData();
      const vgm = mucom.generateLogFile(mub, MucomLogFileType.VGM, maxCount);
      fs.writeFileSync(`${output}.vgm`, vgm);
    }
  } catch (e) {
    console.log(e);
  }

  mucom.release();
}

function readMemFile(path: string) {
  const FS = Mucom88.FS;
  const fp = FS.open(path, "r");
  const length = FS.llseek(fp, 0, 2);
  const buf = new Uint8Array(length);
  FS.read(fp, buf, 0, length, 0);
  FS.close(fp);
  return buf;
}

function writeMemFile(path: string, buf: Uint8Array) {
  const FS = Mucom88.FS;
  const fp = FS.open(path, "w");
  FS.write(fp, buf, buf.byteOffset, buf.byteLength);
  FS.close(fp);
}
