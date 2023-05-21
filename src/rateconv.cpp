#include <math.h>
#include <memory.h>
#include "rateconv.h"

/**
 * Sampling rate converter using sinc interporation.
 *
 * This code was made with reference to http://blog-yama.a-quest.com/?eid=970185
 */

/* LW is truncate length of sinc(x) calculation.
 * Lower LW is faster, higher LW results better quality.
 * LW must be a non-zero positive even number, no upper limit.
 * LW=16 or greater is recommended.
 * if you don't use upsampling, LW=8 is practically okay.
 */
#define LW 16
/* resolution of sinc(x) table. sinc(x) where 0.0≦x≦1.0 corresponds to sinc_table[0..SINC_RESO] */
#define SINC_RESO 256
#define SINC_AMP_BITS 12

// double hamming(double x) { return 0.54 - 0.46 * cos(2 * M_PI * x); }
static double blackman(double x) { return 0.42 - 0.5 * cos(2 * M_PI * x) + 0.08 * cos(4 * M_PI * x); }
static double sinc(double x) { return (x == 0.0 ? 1.0 : sin(M_PI * x) / (M_PI * x)); }
static double windowed_sinc(double x) { return blackman(0.5 + 0.5 * x / (LW / 2)) * sinc(x); }

/* f_inp: input frequency. f_out: output frequencey, ch: number of channels */
RateConv::RateConv(double f_inp, double f_out, int numChannels)
{
    this->numChannels = numChannels;
    this->f_ratio = f_inp / f_out;
    this->buffers = (int32_t **)malloc(sizeof(void *) * numChannels);
    for (int i = 0; i < numChannels; i++)
    {
        this->buffers[i] = (int32_t *)malloc(sizeof(this->buffers[0][0]) * LW);
    }

    /* create sinc_table for positive 0 <= x < LW/2. */
    this->sinc_table = (int32_t *)malloc(sizeof(this->sinc_table[0]) * SINC_RESO * LW / 2);
    for (int i = 0; i < SINC_RESO * LW / 2; i++)
    {
        const double x = (double)i / SINC_RESO;
        if (f_out < f_inp)
        {
            /* for downsampling */
            this->sinc_table[i] = (1 << SINC_AMP_BITS) * windowed_sinc(x / this->f_ratio) / this->f_ratio;
        }
        else
        {
            /* for upsampling */
            this->sinc_table[i] = (1 << SINC_AMP_BITS) * windowed_sinc(x);
        }
    }
}

RateConv::~RateConv()
{
    for (int i = 0; i < this->numChannels; i++)
    {
        free(this->buffers[i]);
    }
    free(this->buffers);
}

#ifndef min
#define min(a, b) ((a) > (b) ? (b) : (a))
#endif

void RateConv::reset()
{
    this->timer = 0;
    this->idx = 0;
    for (int ch = 0; ch < this->numChannels; ch++)
    {
        memset(this->buffers[ch], 0, sizeof(this->buffers[ch][0]) * LW);
    }
}

/* put original data to this converter at f_inp. */
void RateConv::putData(int32_t *inp)
{
    for (int ch = 0; ch < this->numChannels; ch++)
    {
        this->buffers[ch][this->idx] = inp[ch];
    }
    this->idx = (this->idx + 1) % LW;
}

static inline int32_t lookup_sinc_table(int32_t *table, double x)
{
    return table[min(SINC_RESO * LW / 2 - 1, (int)(abs(x) * SINC_RESO))];
}

/* get resampled data from this converter at f_out. */
/* this function must be called f_out times per f_inp times of putData calls. */
void RateConv::getData(int32_t *out)
{
    this->timer += this->f_ratio; // timer must be updated first.
    const double dn = this->timer - floor(this->timer);
    for (int ch = 0; ch < this->numChannels; ch++)
    {
        int32_t *buffer = this->buffers[ch];
        int32_t sum = 0;
        for (int k = 0; k < LW; k++)
        {
            double x = (double)k - (LW / 2 - 1) - dn;
            sum += buffer[(this->idx + k) % LW] * lookup_sinc_table(this->sinc_table, x);
        }
        out[ch] = sum >> SINC_AMP_BITS;
    }
}
