import { initModule, getModule } from "mucom88-js";
import wavefile from "wavefile";

import fs from "fs";
import { dirname } from "path";

const { WaveFile } = wavefile;

function findAttachments(mml) {
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

async function main() {
  await initModule();

  const input = process.argv[2];
  console.log(input);

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

  const sampleRate = 55467; // 44100;
  const Module = getModule();

  const mucom = new Module.CMucom();
  mucom.init(8, sampleRate);
  mucom.loadMML(mml);

  const ch = 2;
  const seconds = 90;
  const res = new Int16Array(sampleRate * ch * seconds);

  for (let i = 0; i < seconds; i++) {
    const buf = mucom.render(sampleRate);
    res.set(buf, i * sampleRate * 2);
  }

  const wav = new WaveFile();
  wav.fromScratch(2, sampleRate, "16", res);
  fs.writeFileSync("test.wav", wav.toBuffer());

  mucom.delete();

  const mub = readMemFile("/temp.mub");
  fs.writeFileSync("temp.mub", mub);

  const vgm = readMemFile("/temp.vgm");
  fs.writeFileSync("temp.vgm", vgm);
}

function readMemFile(path) {
  const Module = getModule();
  const fp = Module.FS.open(path, "r");
  const length = Module.FS.llseek(fp, 0, 2);
  const buf = new Uint8Array(length);
  Module.FS.read(fp, buf, 0, length, 0);
  Module.FS.close(fp);
  return buf;
}

function writeMemFile(path, buf) {
  const Module = getModule();
  const fp = Module.FS.open(path, "w");
  Module.FS.write(fp, buf, buf.byteOffset, buf.byteLength);
  Module.FS.close(fp);
}

main();
