# Direct MEGA
MEGA downloads working like normal downloads!

![Screenshot](https://i.imgur.com/750OurF.png)

[Download the file above](https://directme.ga/?!MAsFwa4b!d8o1uz6SffMAATSQmERLIYITkyc-eTbKQ6xqI3IQSms) or [watch it](https://directme.ga/view?!MAsFwa4b!d8o1uz6SffMAATSQmERLIYITkyc-eTbKQ6xqI3IQSms).

## How to use:

When downloading a file replace `https://mega.nz` with `https://directme.ga`.
You can replace `#` with `?` if you want.

Everything works in your computer and you can download anything directly from MEGA
without your precious data touching any server (beside MEGA ones, of course).

You can view files, if your browser supports then, by using `view` before the `#` or `?` part.
Folders are also supported: a link to a folder will show a list the files inside it so you can download or view one of those.

Normal downloading (the one from the image) depends on Service Workers and Streams API ([Chrome Status](https://www.chromestatus.com/feature/4531143755956224)).
Browsers that don't support it will use a fallback download method similar to the one MEGA uses,
but without asking if the user really wants to download the file.

Some arguments can be appended:

* `&use-http-range`: uses the HTTP Range header which allows video and music seeking
(disabled by default because seems it's bugged and also because it was badly implemented)
* `&start=X`: starts downloading from the X byte of the file
* `&end=X`: stops downloading at the X byte of the file
