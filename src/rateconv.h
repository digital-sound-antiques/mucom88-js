#ifndef __rateconv_h
#define __rateconv_h

#include <stdint.h>

class RateConv
{
public:
    RateConv(double f_inp, double f_out, int numChannels);
    ~RateConv();
    void reset();
    void putData(int32_t *inp);
    void getData(int32_t *out);

private:
    int numChannels;
    double timer;
    double f_ratio;
    int32_t *sinc_table;
    int32_t **buffers;
    int idx;
};

#endif /* __rateconv_h */
