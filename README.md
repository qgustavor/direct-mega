# Direct MEGA
MEGA downloads working like normal downloads!

![Screenshot](https://i.imgur.com/750OurF.png)

[Download the file above](https://directme.ga/?!MAsFwa4b!d8o1uz6SffMAATSQmERLIYITkyc-eTbKQ6xqI3IQSms) ~~or [watch it direcly](https://directme.ga/?!MAsFwa4b!d8o1uz6SffMAATSQmERLIYITkyc-eTbKQ6xqI3IQSms!view)~~.

**Warning:** Not compatible with Firefox with Service Workers enabled because its implementation is bugged. [Related issue](https://github.com/qgustavor/direct-mega/issues/2).

## How to use:

When downloading a file replace `https://mega.nz` with `https://directme.ga`. For
improved usability (or in case you're being redirected to this file) you can
replace the `#` with an `?`. ~~If you don't want to download add `!view` to the URL
and, if the browser can handle the file, it will be shown instead of downloaded.~~
Viewing files instead of downloading those is temporally disabled due bugs.

Everything works in your computer and you can download anything directy from MEGA
without your precious data touching any server (beside MEGA ones, of course).

Note: it don't work for folders because is quite hard to download folders.

Normal downloading (the one from the image) depends on Service Workers and Streams API ([Chrome Status](https://www.chromestatus.com/feature/4531143755956224)).
Browsers that don't support it will use a fallback download method similar to the one MEGA uses,
but without asking if the user really wants to download the file.
