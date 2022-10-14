#include <emscripten/bind.h>
#include <emscripten/val.h>
#include "../mucom88/src/cmucom.h"

using namespace emscripten;

class CMucomWrap
{
public:
    CMucomWrap();
    ~CMucomWrap();
    //	MUCOM88 main service
    void Init(int option = 0, int sampleRate = 0);
    int LoadMML(const std::string &mml);
    val Render(int samples);
    std::string GetMessageBuffer();
    void SetDriverMode(int mode);

private:
    CMucom *mucom;
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

void CMucomWrap::Init(int option, int sampleRate)
{
    printf("CMucomWrap::Init\n");
    mucom->Init(nullptr, MUCOM_CMPOPT_STEP, sampleRate);
}

int CMucomWrap::LoadMML(const std::string &mml)
{
    printf("CMucomWrap::LoadMML\n");
    const char *tempfile = "/temp.mub";
    mucom->Reset(2); // Reset Compiler

    char *mmlptr = (const_cast<char *>(mml.c_str()));
    int res;

    mucom->ProcessHeader(mmlptr);
    // res = mucom->GetDriverModeMem(mmlptr);
    res = mucom->Compile(mmlptr, tempfile);
    if (res != 0)
    {
        return res;
    }

    mucom->SetLogFilename("/temp.vgm");
    mucom->Reset(0);
    res = mucom->LoadFMVoice();
    printf("LoadFMVoice: %d\n", res);
    res = mucom->LoadPCM();
    printf("LoadPCM: %d\n", res);
    res = mucom->LoadMusic(tempfile, 0);
    if (res != 0)
    {
        return res;
    }
    res = mucom->Play(0);
    return res;
}

std::string CMucomWrap::GetMessageBuffer()
{
    printf("CMucomWrap::GetMessageBuffer");
    return std::string(mucom->GetMessageBuffer());
}

val CMucomWrap::Render(int samples)
{
    const int channelCount = 2;
    int wave[samples * channelCount];
    int16_t buffer[samples * channelCount];

    const int reso = 16;
    for (int t = 0; t < samples; t += reso)
    {
        mucom->RenderAudio(wave + t * 2, (samples - t) < reso ? samples - t : reso);
    }

    for (int i = 0; i < (samples * channelCount); i++)
    {
        buffer[i] = wave[i];
    }

    return val(typed_memory_view(samples * channelCount, buffer));
}

void CMucomWrap::SetDriverMode(int mode)
{
    mucom->SetDriverMode(mode);
}

EMSCRIPTEN_BINDINGS(cmucom_module)
{
    class_<CMucomWrap>("CMucom")
        .constructor<>()
        .function("init", &CMucomWrap::Init)
        .function("loadMML", &CMucomWrap::LoadMML)
        .function("getMessageBuffer", &CMucomWrap::GetMessageBuffer)
        .function("setDriverMode", &CMucomWrap::SetDriverMode)
        .function("render", &CMucomWrap::Render);
}