#include <emscripten/bind.h>
#include <emscripten/val.h>

#include <iostream>
#include <fstream>

#include "../mucom88/src/cmucom.h"
#include "./rateconv.h"

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

#ifndef min
#define min(a, b) ((a > b) ? b : a)
#endif

#ifndef max
#define max(a, b) ((a > b) ? a : b)
#endif

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
  int GetStatus(int type);
  PCHDATA GetChannelData(int ch);

private:
  int CompileImpl(const std::string &mml, const char *output, int options);
  CMucom *mucom;
  RateConv *rconv;
  double f_inp;
  double f_out;
  double out_time;
  int32_t mixBuffer[16 * 2];
  int mixRp = 0;
};

CMucomWrap::CMucomWrap(void)
{
  mucom = new CMucom();
  rconv = nullptr;
}

CMucomWrap::~CMucomWrap(void)
{
  delete mucom;
  mucom = nullptr;
  if (rconv != nullptr)
  {
    delete rconv;
    rconv = nullptr;
  }
}

void CMucomWrap::Reset(int sampleRate)
{
  f_inp = MUCOM_AUDIO_RATE;
  f_out = sampleRate;
  mucom->Init(nullptr, MUCOM_CMPOPT_STEP, f_inp);
  if (rconv != nullptr)
  {
    delete rconv;
  }
  rconv = new RateConv(f_inp, f_out, 2);
  out_time = 0;
  rconv->reset();
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

val CMucomWrap::Compile(const std::string &mml)
{
  printf("CMucomWrap::Compile\n");
  const char *tempfile = "temp.mub";
  int res = this->CompileImpl(mml, tempfile, 0);
  if (res != 0)
  {
    std::vector<uint8_t> vec;
    return val(typed_memory_view(vec.size(), vec.data()));
  }
  auto vec = loadFileAsVector(tempfile);
  return val(typed_memory_view(vec.size(), vec.data()));
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
  rconv->reset();
  mixRp = 0;
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
  rconv->reset();
  mixRp = 0;
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
static int16_t renderBuffer[MAX_RENDER_SAMPLES * 2];

val CMucomWrap::Render(int samples)
{
  int32_t tmp[2];
  for (int t = 0; t < samples; t++)
  {
    while (f_inp > out_time)
    {
      out_time += f_out;
      if (mixRp == 0)
      {
        mucom->RenderAudio(mixBuffer, 16);
      }
      rconv->putData(mixBuffer + mixRp * 2);
      mixRp = (mixRp + 1) % 16;
    }
    out_time -= f_inp;
    rconv->getData(tmp);
    renderBuffer[t * 2 + 0] = max(-32768, min(32767, tmp[0] >> 2));
    renderBuffer[t * 2 + 1] = max(-32768, min(32767, tmp[1] >> 2));
  }

  return val(typed_memory_view(samples * 2, renderBuffer));
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
      .function("getMessageBuffer", &CMucomWrap::GetMessageBuffer)
      .function("getInfoBuffer", &CMucomWrap::GetInfoBuffer)
      .function("setDriverMode", &CMucomWrap::SetDriverMode)
      .function("getStatus", &CMucomWrap::GetStatus)
      .function("render", &CMucomWrap::Render)
      .function("getChannelData", &CMucomWrap::GetChannelData);
}