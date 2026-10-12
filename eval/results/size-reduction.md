# Output size reduction

12 images, 2964 KB in total. Measured with `npm run eval:size` on 2026-10-09.

| Preset | Total after | Total saved | Median saved | Smallest saving |
|---|---:|---:|---:|---:|
| Web 1600 px WebP q80 | 1800 KB | 39.3% | 51.5% | -7.6% |
| Email 1200 px JPEG q80 | 1635 KB | 44.8% | 50.3% | 10.5% |
| Same size WebP q85 | 2852 KB | 3.8% | 13.7% | -25.1% |

## Per image

| File | Pixels | Before | Web 1600 px WebP q80 | Email 1200 px JPEG q80 | Same size WebP q85 |
|---|---|---:|---:|---:|---:|
| EC76-6048.jpg | 1920x1536 | 387 KB | 156 KB (59.6%) | 123 KB (68.3%) | 390 KB (-0.8%) |
| KSC-03pd2363.jpg | 1920x1251 | 396 KB | 219 KB (44.8%) | 163 KB (58.8%) | 419 KB (-5.7%) |
| KSC-03pd2987.jpg | 1280x851 | 314 KB | 322 KB (-2.4%) | 281 KB (10.5%) | 376 KB (-19.5%) |
| KSC-07PD-0647.jpg | 1920x1276 | 390 KB | 224 KB (42.5%) | 202 KB (48.2%) | 370 KB (5.2%) |
| KSC-2014-1790.jpg | 1920x1280 | 208 KB | 101 KB (51.5%) | 103 KB (50.3%) | 174 KB (16.2%) |
| KSC-20170219-PH_JBS01_0007.jpg | 1920x1280 | 96 KB | 29 KB (69.2%) | 45 KB (52.8%) | 53 KB (44.9%) |
| KSC-20190411-PH_ILW01_0075.jpg | 1920x1280 | 301 KB | 168 KB (44.2%) | 164 KB (45.6%) | 272 KB (9.7%) |
| KSC-20190925-PH-GEB01_0017.jpg | 1920x1050 | 247 KB | 128 KB (48.3%) | 133 KB (46.3%) | 213 KB (13.7%) |
| KSC-20210121-PH-JBS01_0143.jpg | 1280x853 | 337 KB | 363 KB (-7.6%) | 292 KB (13.3%) | 422 KB (-25.1%) |
| KSC-20240819-PH-JBS01_0009.jpg | 1920x1280 | 57 KB | 11 KB (81.5%) | 17 KB (70.1%) | 20 KB (64.4%) |
| iss040e080833.jpg | 1920x1277 | 126 KB | 44 KB (64.9%) | 60 KB (52.2%) | 79 KB (37.7%) |
| iss072e001649.jpg | 1920x1078 | 105 KB | 35 KB (66.2%) | 52 KB (50.2%) | 64 KB (38.9%) |
