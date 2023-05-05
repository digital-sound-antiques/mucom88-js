import fs from "fs";
import { dirname } from "path";
import pkg from "wavefile";
const { WaveFile } = pkg;
import { Mucom88 } from "./index.js";

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

export async function main() {
  await Mucom88.initialize();

  const input = process.argv[2];

  const data = fs.readFileSync(input);
  const mml = new TextDecoder("sjis").decode(data);

  const { voiceFile, pcmFile } = findAttachments(mml);

  if (voiceFile != null) {
    console.log(`#voice ${voiceFile}`);
    const file = `${dirname(input)}/${voiceFile}`;
    if (fs.existsSync(file)) {
      console.log(`Found: ${voiceFile}`);
      const data = fs.readFileSync(file);
      writeMemFile("/voice.dat", data);
    }
  }

  if (pcmFile != null) {
    console.log(`#pcm ${pcmFile}`);
    const file = `${dirname(input)}/${pcmFile}`;
    if (fs.existsSync(file)) {
      console.log(`Found: ${pcmFile}`);
      const data = fs.readFileSync(file);
      writeMemFile("/mucompcm.bin", data);
    }
  }

  const mucom = new Mucom88();
  const sampleRate = 55467; // 44100;

  mucom.reset(sampleRate);

  if (false) {
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
  }

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
  }

  const wav = new WaveFile();
  const length = sampleRate * ch * (elapsed + 1);
  wav.fromScratch(2, sampleRate, "16", res.slice(0, length));
  fs.writeFileSync("test.wav", wav.toBuffer());

  mucom.release();

  try {
    const mub = readMemFile("/temp.mub");
    fs.writeFileSync("temp.mub", mub);
  } catch (e) {
    console.log("/temp.mub does not generated.");
  }

  try {
    const vgm = readMemFile("/temp.vgm");
    fs.writeFileSync("temp.vgm", vgm);
  } catch (e) {
    console.log("/temp.vgm does not generated.");
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
