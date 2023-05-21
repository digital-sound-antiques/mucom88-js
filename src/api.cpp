#include <emscripten/bind.h>
#include <emscripten/val.h>

#include <iostream>
#include <fstream>

#include "../mucom88/src/cmucom.h"

using namespace emscripten;

template <typename T>
std::vector<T> vecFromJSTypedArray(const val &ta)
{
  const auto size = ta["length"].as<unsigned>();
  std::vector<T> vec(size);
  val memoryView{typed_memory_view(size, vec.data())};
  memoryView.call<void>("set", ta);
  return vec;
}

class CMucomWrap
{
public:
  CMucomWrap();
  ~CMucomWrap();
  void Reset(int sampleRate);
  int LoadMML(const std::string &mml);
  val Render(int samples);
  std::string GetMessageBuffer();
  std::string GetInfoBuffer();
  void SetDriverMode(int mode);
  val Compile(const std::string &mml);
  int LoadImpl(const std::vector<uint8_t> &mub);
  int Load(const val &inp);
  val GenerateLogFile(const val &mub, int type, int maxCount);
  int GetStatus(int type);
  PCHDATA GetChannelData(int ch);

private:
  int CompileImpl(const std::string &mml, const char *output, int options);
  CMucom *mucom;
  std::vector<uint8_t> refVec;
};

CMucomWrap::CMucomWrap(void)
{
  mucom = new CMucom();
}

CMucomWrap::~CMucomWrap(void)
{
  delete mucom;
  mucom = nullptr;
}

void CMucomWrap::Reset(int sampleRate)
{
  mucom->Init(nullptr, MUCOM_CMPOPT_STEP, sampleRate);
}

int CMucomWrap::CompileImpl(const std::string &mml, const char *output, int options)
{
  char *mmlptr = (const_cast<char *>(mml.c_str()));

  int mode = mucom->GetDriverModeMem(mmlptr);
  mucom->SetDriverMode(mode);

  mucom->Reset(2); // with reset compiler memory
  // Note: call ProcessHeader in advance so that voice and pcm data will be loaded in compile phase.
  mucom->ProcessHeader(mmlptr);
  return mucom->Compile(mmlptr, output, options);
}

std::vector<uint8_t> loadFileAsVector(const char *file)
{
  std::ifstream ifs;
  ifs.open(file, std::ios::binary);
  std::vector<uint8_t> vec;
  vec.insert(vec.begin(),
             std::istreambuf_iterator<char>(ifs),
             std::istreambuf_iterator<char>());
  ifs.close();
  return vec;
}

val CMucomWrap::GenerateLogFile(const val &u8, int type, int maxCount)
{
  printf("CMucomWrap::GenerateLogFile: %d\n", type);

  const char *logfile = type == 0 ? "temp.vgm" : "temp.s98";
  mucom->SetLogFilename(logfile); // attach logwriter

  int res = this->Load(u8);
  if (res != 0)
  {
    // return empty vector
    std::vector<uint8_t> vec;
    return val(typed_memory_view(vec.size(), vec.data()));
  }

  int time = 0;       // in ms
  int timeToExit = 0; // in ms

  while (time < 10 * 60 * 1000)
  { // max 10 min
    if (timeToExit != 0 && time > timeToExit)
    {
      break;
    }

    mucom->UpdateTime(1);
    time += 1;
    int count = mucom->GetStatus(MUCOM_STATUS_INTCOUNT);
    if (count > maxCount && timeToExit == 0)
    {
      timeToExit = time + 1000;
    }
  }

  mucom->SetLogFilename(nullptr); // detach logwriter

  refVec = loadFileAsVector(logfile);
  return val(typed_memory_view(refVec.size(), refVec.data()));
}

val CMucomWrap::Compile(const std::string &mml)
{
  printf("CMucomWrap::Compile\n");
  const char *tempfile = "temp.mub";
  int res = this->CompileImpl(mml, tempfile, 0);
  if (res != 0)
  {
    // return empty vector
    std::vector<uint8_t> vec;
    return val(typed_memory_view(vec.size(), vec.data()));
  }
  refVec = loadFileAsVector(tempfile);
  return val(typed_memory_view(refVec.size(), refVec.data()));
}

int CMucomWrap::Load(const val &u8)
{
  printf("CMucomWrap::Load\n");
  std::vector<uint8_t> buf = vecFromJSTypedArray<uint8_t>(u8);
  int mode = mucom->GetDriverModeMemMUB(buf.data(), buf.size());
  mucom->SetDriverMode(mode);

  mucom->Reset(0);
  int res = mucom->LoadMusicMem(buf.data(), buf.size(), 0);
  if (res)
  {
    return res;
  }
  res = mucom->Play(0);
  return res;
}

int CMucomWrap::LoadMML(const std::string &mml)
{
  printf("CMucomWrap::LoadMML\n");
  const char *tempfile = "temp.mub";
  int res = this->CompileImpl(mml, tempfile, MUCOM_COMPILE_TO_MUSBUFFER);
  if (res)
  {
    return res;
  }
  return mucom->Play(0);
}

std::string CMucomWrap::GetInfoBuffer()
{
  return std::string(mucom->GetInfoBuffer());
}

std::string CMucomWrap::GetMessageBuffer()
{
  return std::string(mucom->GetMessageBuffer());
}

static const int MAX_RENDER_SAMPLES = 192000;

int16_t renderBuffer[MAX_RENDER_SAMPLES * 2];

val CMucomWrap::Render(int samples)
{
  const int channelCount = 2;
  int wave[samples * channelCount];

  const int reso = 16;
  for (int t = 0; t < samples; t += reso)
  {
    mucom->RenderAudio(wave + t * 2, (samples - t) < reso ? samples - t : reso);
  }

  for (int i = 0; i < (samples * channelCount); i++)
  {
    int a = wave[i] >> 2;
    if (a > 32767)
    {
      renderBuffer[i] = 32767;
    }
    else if (a < -32768)
    {
      renderBuffer[i] = -32768;
    }
    else
    {
      renderBuffer[i] = a;
    }
  }

  return val(typed_memory_view(samples * channelCount, renderBuffer));
}

void CMucomWrap::SetDriverMode(int mode)
{
  mucom->SetDriverMode(mode);
}

int CMucomWrap::GetStatus(int type)
{
  return mucom->GetStatus(type);
}

PCHDATA CMucomWrap::GetChannelData(int ch)
{
  PCHDATA pch;
  mucom->GetChannelData(ch, &pch);
  pch.chnum = ch;
  return pch;
}

EMSCRIPTEN_BINDINGS(cmucom_module)
{
  value_object<PCHDATA>("PCHDATA")
      .field("length", &PCHDATA::length)
      .field("vnum", &PCHDATA::vnum)
      .field("volume", &PCHDATA::volume)
      .field("wadr", &PCHDATA::wadr)
      .field("tadr", &PCHDATA::tadr)
      .field("lfo_diff", &PCHDATA::lfo_diff)
      .field("quantize", &PCHDATA::quantize)
      .field("chnum", &PCHDATA::chnum)
      .field("detune", &PCHDATA::detune)
      .field("reverb", &PCHDATA::reverb)
      .field("pan", &PCHDATA::pan)
      .field("code", &PCHDATA::code)
      .field("flag", &PCHDATA::flag)
      .field("flag2", &PCHDATA::flag2)
      .field("note", &PCHDATA::keyon)
      .field("vol_org", &PCHDATA::vol_org)
      .field("vnum_org", &PCHDATA::vnum_org);

  class_<CMucomWrap>("CMucom")
      .constructor<>()
      .function("reset", &CMucomWrap::Reset)
      .function("compile", &CMucomWrap::Compile)
      .function("load", &CMucomWrap::Load)
      .function("loadMML", &CMucomWrap::LoadMML)
      .function("generateLogFile", &CMucomWrap::GenerateLogFile)
      .function("getMessageBuffer", &CMucomWrap::GetMessageBuffer)
      .function("getInfoBuffer", &CMucomWrap::GetInfoBuffer)
      .function("setDriverMode", &CMucomWrap::SetDriverMode)
      .function("getStatus", &CMucomWrap::GetStatus)
      .function("render", &CMucomWrap::Render)
      .function("getChannelData", &CMucomWrap::GetChannelData);
}