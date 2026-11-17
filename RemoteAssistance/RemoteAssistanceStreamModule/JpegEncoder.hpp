#pragma once
//
// JpegEncoder — minimal baseline JPEG (JFIF) encoder for planar YUV 4:2:0 input.
//
// Purpose-built for the RemoteAssistance streaming hot path: the Glasses camera delivers
// YUV_420_888 frames, and JPEG's internal color space is YCbCr — so encoding
// straight from the camera planes needs no color conversion at all. Standard
// Annex-K quantization (quality-scaled) + Huffman tables, 16x16 MCUs
// (4 Y blocks + Cb + Cr). Portable C++ (no SDK deps) so it can be unit-tested
// on the host with a stock JPEG decoder.
//
// Not general-purpose: no 4:4:4, no restart markers, no EXIF.
//

#include <cmath>
#include <cstdint>
#include <cstring>
#include <vector>

namespace remoteAssistanceJpeg {

namespace detail {

static const uint8_t kZigzag[64] = {
    0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5,
    12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28,
    35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51,
    58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63};

static const uint8_t kQuantLuma[64] = {
    16, 11, 10, 16, 24, 40, 51, 61,
    12, 12, 14, 19, 26, 58, 60, 55,
    14, 13, 16, 24, 40, 57, 69, 56,
    14, 17, 22, 29, 51, 87, 80, 62,
    18, 22, 37, 56, 68, 109, 103, 77,
    24, 35, 55, 64, 81, 104, 113, 92,
    49, 64, 78, 87, 103, 121, 120, 101,
    72, 92, 95, 98, 112, 100, 103, 99};

static const uint8_t kQuantChroma[64] = {
    17, 18, 24, 47, 99, 99, 99, 99,
    18, 21, 26, 66, 99, 99, 99, 99,
    24, 26, 56, 99, 99, 99, 99, 99,
    47, 66, 99, 99, 99, 99, 99, 99,
    99, 99, 99, 99, 99, 99, 99, 99,
    99, 99, 99, 99, 99, 99, 99, 99,
    99, 99, 99, 99, 99, 99, 99, 99,
    99, 99, 99, 99, 99, 99, 99, 99};

// Annex K Huffman table glasses: BITS (codes per length 1..16) + HUFFVAL.
static const uint8_t kDcLumaBits[17] = {0, 0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0};
static const uint8_t kDcLumaVals[12] = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11};
static const uint8_t kDcChromaBits[17] = {0, 0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0};
static const uint8_t kDcChromaVals[12] = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11};

static const uint8_t kAcLumaBits[17] = {0, 0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 0x7d};
static const uint8_t kAcLumaVals[162] = {
    0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07,
    0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0,
    0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
    0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49,
    0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69,
    0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
    0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7,
    0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5,
    0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
    0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
    0xf9, 0xfa};

static const uint8_t kAcChromaBits[17] = {0, 0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 0x77};
static const uint8_t kAcChromaVals[162] = {
    0x00, 0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21, 0x31, 0x06, 0x12, 0x41, 0x51, 0x07, 0x61, 0x71,
    0x13, 0x22, 0x32, 0x81, 0x08, 0x14, 0x42, 0x91, 0xa1, 0xb1, 0xc1, 0x09, 0x23, 0x33, 0x52, 0xf0,
    0x15, 0x62, 0x72, 0xd1, 0x0a, 0x16, 0x24, 0x34, 0xe1, 0x25, 0xf1, 0x17, 0x18, 0x19, 0x1a, 0x26,
    0x27, 0x28, 0x29, 0x2a, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48,
    0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68,
    0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87,
    0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5,
    0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3,
    0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda,
    0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
    0xf9, 0xfa};

struct HuffTable {
    uint16_t code[256];
    uint8_t size[256];

    void build(const uint8_t bits[17], const uint8_t* vals) {
        std::memset(size, 0, sizeof(size));
        uint16_t c = 0;
        int k = 0;
        for (int len = 1; len <= 16; ++len) {
            for (int i = 0; i < bits[len]; ++i) {
                const uint8_t v = vals[k++];
                code[v] = c++;
                size[v] = static_cast<uint8_t>(len);
            }
            c <<= 1;
        }
    }
};

class BitWriter {
public:
    explicit BitWriter(std::vector<uint8_t>& out) : out_(out) {}

    void put(uint32_t bits, int nbits) {
        acc_ = (acc_ << nbits) | (bits & ((1u << nbits) - 1));
        count_ += nbits;
        while (count_ >= 8) {
            const uint8_t byte = static_cast<uint8_t>((acc_ >> (count_ - 8)) & 0xff);
            out_.push_back(byte);
            if (byte == 0xff) out_.push_back(0x00);  // byte stuffing
            count_ -= 8;
        }
    }

    void flush() {
        const int pad = (8 - (count_ % 8)) % 8;  // count_ < 8 after put() drains
        if (pad > 0) put((1u << pad) - 1, pad);  // pad with 1-bits to the byte edge
        count_ = 0;
        acc_ = 0;
    }

private:
    std::vector<uint8_t>& out_;
    uint64_t acc_ = 0;
    int count_ = 0;
};

inline int bitCategory(int v) {
    int a = v < 0 ? -v : v;
    int n = 0;
    while (a) {
        a >>= 1;
        ++n;
    }
    return n;
}

// Plain separable float DCT-II on one 8x8 block (input level-shifted by -128),
// then zigzag + quantize into `out` (zigzag order, matching the quant tables).
inline void dctQuantBlock(const float in[64], const uint16_t quant[64], int out[64]) {
    static const float kC[8] = {
        0.70710678f, 1.f, 1.f, 1.f, 1.f, 1.f, 1.f, 1.f};
    static bool tabInit = false;
    static float cosTab[8][8];   // cosTab[x][u] = cos((2x+1)uπ/16)
    static uint8_t zzOf[64];     // natural index -> zigzag index
    if (!tabInit) {
        for (int x = 0; x < 8; ++x)
            for (int u = 0; u < 8; ++u)
                cosTab[x][u] = static_cast<float>(
                    std::cos((2 * x + 1) * u * 3.14159265358979323846 / 16.0));
        for (int i = 0; i < 64; ++i) zzOf[kZigzag[i]] = static_cast<uint8_t>(i);
        tabInit = true;
    }

    float tmp[64];
    // Rows.
    for (int y = 0; y < 8; ++y) {
        for (int u = 0; u < 8; ++u) {
            float s = 0;
            for (int x = 0; x < 8; ++x) s += in[y * 8 + x] * cosTab[x][u];
            tmp[y * 8 + u] = s;
        }
    }
    // Columns + normalization + quantization.
    for (int v = 0; v < 8; ++v) {
        for (int u = 0; u < 8; ++u) {
            float s = 0;
            for (int y = 0; y < 8; ++y) s += tmp[y * 8 + u] * cosTab[y][v];
            const float coeff = 0.25f * kC[u] * kC[v] * s;
            const int zz = zzOf[v * 8 + u];
            const float q = coeff / static_cast<float>(quant[zz]);
            out[zz] = static_cast<int>(q < 0 ? q - 0.5f : q + 0.5f);
        }
    }
}

inline void encodeBlock(BitWriter& bw, const int block[64], int& dcPred,
                        const HuffTable& dc, const HuffTable& ac) {
    // DC
    const int diff = block[0] - dcPred;
    dcPred = block[0];
    const int dcCat = bitCategory(diff);
    bw.put(dc.code[dcCat], dc.size[dcCat]);
    if (dcCat) bw.put(static_cast<uint32_t>(diff < 0 ? diff - 1 : diff), dcCat);

    // AC
    int run = 0;
    for (int i = 1; i < 64; ++i) {
        const int v = block[i];
        if (v == 0) {
            ++run;
            continue;
        }
        while (run >= 16) {
            bw.put(ac.code[0xf0], ac.size[0xf0]);  // ZRL
            run -= 16;
        }
        const int cat = bitCategory(v);
        const int sym = (run << 4) | cat;
        bw.put(ac.code[sym], ac.size[sym]);
        bw.put(static_cast<uint32_t>(v < 0 ? v - 1 : v), cat);
        run = 0;
    }
    if (run > 0) bw.put(ac.code[0x00], ac.size[0x00]);  // EOB
}

inline void putMarker(std::vector<uint8_t>& out, uint8_t marker) {
    out.push_back(0xff);
    out.push_back(marker);
}

inline void putSegment(std::vector<uint8_t>& out, uint8_t marker, const uint8_t* data, size_t len) {
    putMarker(out, marker);
    const size_t total = len + 2;
    out.push_back(static_cast<uint8_t>(total >> 8));
    out.push_back(static_cast<uint8_t>(total & 0xff));
    out.insert(out.end(), data, data + len);
}

// Load one 8x8 block from a plane with edge clamping, level-shifted to [-128, 127].
inline void loadBlock(const uint8_t* plane, int w, int h, int stride,
                      int x0, int y0, float out[64]) {
    for (int y = 0; y < 8; ++y) {
        int sy = y0 + y;
        if (sy >= h) sy = h - 1;
        const uint8_t* row = plane + static_cast<size_t>(sy) * stride;
        for (int x = 0; x < 8; ++x) {
            int sx = x0 + x;
            if (sx >= w) sx = w - 1;
            out[y * 8 + x] = static_cast<float>(row[sx]) - 128.0f;
        }
    }
}

}  // namespace detail

/// Encode planar YUV 4:2:0 (chroma dimensions = ceil(w/2) x ceil(h/2)) to a
/// baseline JFIF JPEG. quality: 1..100. Appends the file to `out` (cleared first).
inline void EncodeYUV420(const uint8_t* Y, const uint8_t* U, const uint8_t* V,
                         int width, int height,
                         int yStride, int cStride,
                         int quality, std::vector<uint8_t>& out) {
    using namespace detail;
    out.clear();
    if (width < 1 || height < 1) return;
    if (quality < 1) quality = 1;
    if (quality > 100) quality = 100;

    // libjpeg quality scaling.
    const int scale = quality < 50 ? 5000 / quality : 200 - quality * 2;
    uint16_t qLuma[64], qChroma[64];
    uint8_t qLumaZ[64], qChromaZ[64];
    for (int i = 0; i < 64; ++i) {
        int l = (kQuantLuma[kZigzag[i]] * scale + 50) / 100;
        int c = (kQuantChroma[kZigzag[i]] * scale + 50) / 100;
        if (l < 1) l = 1;
        if (l > 255) l = 255;
        if (c < 1) c = 1;
        if (c > 255) c = 255;
        qLuma[i] = static_cast<uint16_t>(l);    // zigzag order
        qChroma[i] = static_cast<uint16_t>(c);
        qLumaZ[i] = static_cast<uint8_t>(l);
        qChromaZ[i] = static_cast<uint8_t>(c);
    }

    HuffTable dcL, acL, dcC, acC;
    dcL.build(kDcLumaBits, kDcLumaVals);
    acL.build(kAcLumaBits, kAcLumaVals);
    dcC.build(kDcChromaBits, kDcChromaVals);
    acC.build(kAcChromaBits, kAcChromaVals);

    out.reserve(static_cast<size_t>(width) * height / 4 + 1024);

    // SOI + JFIF APP0
    putMarker(out, 0xd8);
    static const uint8_t app0[] = {'J', 'F', 'I', 'F', 0, 1, 1, 0, 0, 1, 0, 1, 0, 0};
    putSegment(out, 0xe0, app0, sizeof(app0));

    // DQT (two tables, zigzag order)
    {
        uint8_t seg[65];
        seg[0] = 0x00;
        std::memcpy(seg + 1, qLumaZ, 64);
        putSegment(out, 0xdb, seg, sizeof(seg));
        seg[0] = 0x01;
        std::memcpy(seg + 1, qChromaZ, 64);
        putSegment(out, 0xdb, seg, sizeof(seg));
    }

    // SOF0: 8-bit, 3 components, Y 2x2 subsampling refs table 0, chroma 1x1 table 1.
    {
        const uint8_t sof[] = {
            8,
            static_cast<uint8_t>(height >> 8), static_cast<uint8_t>(height & 0xff),
            static_cast<uint8_t>(width >> 8), static_cast<uint8_t>(width & 0xff),
            3,
            1, 0x22, 0,
            2, 0x11, 1,
            3, 0x11, 1};
        putSegment(out, 0xc0, sof, sizeof(sof));
    }

    // DHT x4
    {
        auto putDht = [&](uint8_t cls, uint8_t id, const uint8_t bits[17],
                          const uint8_t* vals, size_t nvals) {
            std::vector<uint8_t> seg;
            seg.push_back(static_cast<uint8_t>((cls << 4) | id));
            seg.insert(seg.end(), bits + 1, bits + 17);
            seg.insert(seg.end(), vals, vals + nvals);
            putSegment(out, 0xc4, seg.data(), seg.size());
        };
        putDht(0, 0, kDcLumaBits, kDcLumaVals, 12);
        putDht(1, 0, kAcLumaBits, kAcLumaVals, 162);
        putDht(0, 1, kDcChromaBits, kDcChromaVals, 12);
        putDht(1, 1, kAcChromaBits, kAcChromaVals, 162);
    }

    // SOS
    {
        static const uint8_t sos[] = {3, 1, 0x00, 2, 0x11, 3, 0x11, 0, 63, 0};
        putSegment(out, 0xda, sos, sizeof(sos));
    }

    // Entropy-coded MCU scan (16x16 pixels each).
    const int cw = (width + 1) / 2;
    const int ch = (height + 1) / 2;
    const int mcusX = (width + 15) / 16;
    const int mcusY = (height + 15) / 16;

    BitWriter bw(out);
    int dcY = 0, dcU = 0, dcV = 0;
    float blk[64];
    int q[64];

    for (int my = 0; my < mcusY; ++my) {
        for (int mx = 0; mx < mcusX; ++mx) {
            // 4 luma blocks.
            for (int by = 0; by < 2; ++by) {
                for (int bx = 0; bx < 2; ++bx) {
                    loadBlock(Y, width, height, yStride, mx * 16 + bx * 8, my * 16 + by * 8, blk);
                    dctQuantBlock(blk, qLuma, q);
                    encodeBlock(bw, q, dcY, dcL, acL);
                }
            }
            // Cb, Cr (one 8x8 block each, covering the 16x16 luma area).
            loadBlock(U, cw, ch, cStride, mx * 8, my * 8, blk);
            dctQuantBlock(blk, qChroma, q);
            encodeBlock(bw, q, dcU, dcC, acC);

            loadBlock(V, cw, ch, cStride, mx * 8, my * 8, blk);
            dctQuantBlock(blk, qChroma, q);
            encodeBlock(bw, q, dcV, dcC, acC);
        }
    }
    bw.flush();

    putMarker(out, 0xd9);  // EOI
}

}  // namespace remoteAssistanceJpeg
