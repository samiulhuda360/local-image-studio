# Alt-text quality

20 labelled images. An item passes when the alt text names every labelled group. Measured with `npm run eval:alt` on 2026-10-12.

| Method | Items passing |
|---|---:|
| Local fallback (file name, size, colour) | 8/20 (40%) |
| AI (gemini-flash-lite-latest) | 20/20 (100%) |

The model returned a subject box for 17 of 20 images, so those get a subject-anchored crop.

## Per image

| File | Local alt | Local | AI alt | AI |
|---|---|:-:|---|:-:|
| red-circle.png | Image of red circle, landscape orientation, 640 by 480 pixels, mostly red tones. | pass | The national flag of Japan features a red circle centered on a white background. | pass |
| blue-square-top-left.png | Image of blue square top left, landscape orientation, 640 by 480 pixels, mostly blue tones. | pass | A solid blue square is positioned in the upper left corner on a plain white background. | pass |
| three-green-stripes.png | Image of three green stripes, landscape orientation, 640 by 480 pixels, mostly green tones. | pass | Green and white horizontal stripes pattern. | pass |
| yellow-triangle.png | Image of yellow triangle, portrait orientation, 480 by 640 pixels, mostly yellow tones. | pass | A solid yellow triangle on a plain white background. | pass |
| checkerboard.png | Image of checkerboard, square orientation, 512 by 512 pixels, mostly grey tones. | pass | A black and white checkered pattern filling the square frame. | pass |
| orange-ring.png | Image of orange ring, square orientation, 600 by 600 pixels, mostly orange tones. | pass | A solid orange ring shape centered against a white background. | pass |
| black-bar-on-blue.png | Image of black bar on blue, landscape orientation, 640 by 360 pixels, mostly blue tones. | pass | A black horizontal stripe bordered by two blue sections. | pass |
| two-red-circles.png | Image of two red circles, landscape orientation, 800 by 400 pixels, mostly red tones. | pass | Two red circles on a white background. | pass |
| EC76-6048.jpg | Image, landscape orientation, 1920 by 1536 pixels, mostly orange tones. | miss | An aerial view of the unusual HiMAT research aircraft in flight over a desert landscape. | pass |
| KSC-03pd2363.jpg | Image of ksc, landscape orientation, 1920 by 1251 pixels, mostly grey tones. | miss | Two manatees swimming together in murky water. | pass |
| KSC-03pd2987.jpg | Image of ksc, landscape orientation, 1280 by 851 pixels, mostly yellow tones. | miss | A pink spoonbill flies low over calm water with a lush green shoreline in the background. | pass |
| KSC-07PD-0647.jpg | Image of ksc, landscape orientation, 1920 by 1276 pixels, mostly grey tones. | miss | An adult bald eagle stands guard in a large nest high in a pine tree. | pass |
| KSC-2014-1790.jpg | Image of ksc, landscape orientation, 1920 by 1280 pixels, mostly blue tones. | miss | A small owl chick looks over the edge of a large stick nest against a blue sky. | pass |
| KSC-20170219-PH_JBS01_0007.jpg | Image of ksc ph, landscape orientation, 1920 by 1280 pixels, mostly brown tones. | miss | A golden sun sets over a dark forest canopy under a cloudy sky. | pass |
| KSC-20190411-PH_ILW01_0075.jpg | Image of ksc ph, landscape orientation, 1920 by 1280 pixels, mostly yellow tones. | miss | A small butterfly with patterned wings rests on orange flowers amidst green leaves. | pass |
| KSC-20190925-PH-GEB01_0017.jpg | Image of ksc ph, landscape orientation, 1920 by 1050 pixels, mostly brown tones. | miss | Close-up of an alligator's head submerged in a grassy marsh. | pass |
| KSC-20210121-PH-JBS01_0143.jpg | Image of ksc ph, landscape orientation, 1280 by 853 pixels, mostly grey tones. | miss | Three alligators rest on a grassy bank beside a calm body of water. | pass |
| KSC-20240819-PH-JBS01_0009.jpg | Image of ksc ph, landscape orientation, 1920 by 1280 pixels, mostly blue tones. | miss | A large red moon glows in a dark blue night sky above a silhouetted landscape. | pass |
| iss040e080833.jpg | Image, landscape orientation, 1920 by 1277 pixels, mostly grey tones. | miss | Earth's horizon and cloud cover viewed from space with sun glare overhead. | pass |
| iss072e001649.jpg | Image, landscape orientation, 1920 by 1078 pixels, mostly grey tones. | miss | A massive swirling hurricane viewed from space, showing white spiral clouds against Earth's surface. | pass |
