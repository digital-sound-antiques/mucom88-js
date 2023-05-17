import commandLineArgs from "command-line-args";
import commandLineUsage from "command-line-usage";
import fs from "fs";
import { basename, dirname } from "path";
import pkg from "wavefile";
import { detectEncoding } from "./detect-encoding.js";
import { Mucom88 } from "./index.js";
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
  },
  {
    name: "output",
    alias: "o",
    description: "Specify output filename.",
    type: String,
  },
  {
    name: "encoding",
    alias: "e",
    description: "Specify an encoding of input .muc file.",
    type: String,
  },
  {
    name: "wav",
    description: "Ouptut .wav file",
    type: Boolean,
    defaultValue: false,
  },
  {
    name: "vgm",
    description: "Ouptut .vgm file",
    type: Boolean,
    defaultValue: false,
  },
  {
    name: "mub",
    description: "Ouptut .mub file",
    type: Boolean,
    defaultValue: true,
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

  if (true) {
    const mub = mucom.compile(mml);
    console.log(mucom.getMessageBuffer());
    if (mub == null) {            
      process.exit(1);
    }
    // load mub does not work for some file.
    // TODO: investigate reason.
    mucom.load(mub!);
  } else {
    mucom.loadMML(mml);
    console.log(mucom.getMessageBuffer());
  }

  if (options.wav) {
    const ch = 2;
    const seconds = 180;
    const res = new Int16Array(sampleRate * ch * seconds);
    const maxCount = mucom.getStatus(6); // MAXCOUNT

    let elapsed = 0;
    for (elapsed = 0; elapsed < seconds; elapsed++) {
      const buf = mucom.render(sampleRate);
      res.set(buf, elapsed * sampleRate * ch);
      const count = mucom.getStatus(1);
      console.log(`${count}/${maxCount}`);
      if (count >= maxCount) {
        break;
      }
      console.log(mucom.getChannelData(0));
    }

    const wav = new WaveFile();
    const length = sampleRate * ch * (elapsed + 1);
    wav.fromScratch(2, sampleRate, "16", res.slice(0, length));
    fs.writeFileSync(`${output}.wav`, wav.toBuffer());
  }

  mucom.release();

  if (options.mub) {
    try {
      const mub = readMemFile("/temp.mub");
      fs.writeFileSync(`${output}.mub`, mub);
    } catch (e) {
      console.log(".mub is not generated.");
    }
  }

  if (options.vgm) {
    try {
      const vgm = readMemFile("/temp.vgm");
      fs.writeFileSync(`${output}.vgm`, vgm);
    } catch (e) {
      console.log(".vgm is not generated.");
    }
  }
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
