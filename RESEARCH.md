# Research & lessons learned

Short notes on what we've learned while building Nogglebox, each with where it came from. "Observed" means we found it ourselves while building, not from a published source.

## Kids, attention & learning
- **Preschoolers watch what they can understand; pace and length matter less.** Attention drops sharply when content is incomprehensible (scrambled, foreign language); a fast-paced version didn't change attention spans.
  - [Anderson et al., comprehensibility experiment (PDF)](https://jerlab.sc.edu/wp-content/uploads/2018/07/Expt60.pdf)
  - [SAGE Encyclopedia: Television attention](https://sk.sagepub.com/ency/edvol/embed/childmedia/chpt/television-attention)
  - [Wilson Quarterly: Big Bad Bird?](https://www.wilsonquarterly.com/quarterly/_/big-bad-bird/)
- **Preschoolers can follow 10–15 minute stories.** Sesame Street moved to 10–12 minute storylines (1990) and the 15-minute "Elmo's World" (1998) based on its research.
  - [Format of Sesame Street](https://en.wikipedia.org/wiki/Format_of_Sesame_Street)
- **"2–5 minutes of attention per year of age" is a rough rule for tasks, not a measured limit for video.** It varies with interest, tiredness and distraction.
  - [Guardian NG: child attention span](https://guardian.ng/guardian-woman/how-well-do-you-know-your-childs-attention-span/)
  - [Speech Blubs: toddler attention span](https://speechblubs.com/blog/is-your-toddlers-attention-span-typical)
- **Our video length guideline: mostly 1–4 minutes; up to ~10 when it's one easy-to-follow thread.** Derived from the points above, plus the magazine format and the Next button.
  - Observed (project decision, Oct 2026)
- **Screen time for ages 2–5: about 1 hour a day of high-quality programming, ideally watched with an adult.**
  - [CHLA: AAP screen time guidelines](https://www.chla.org/blog/advice-experts/new-guidelines-screen-time-kids)
- **The same letter makes different sounds in different words (the A in "rat" vs. "ball"), so letter sounds must be recorded per word, not per letter.**
  - Observed (Sound It Out, Oct 2026)
- **Some letter pairs make one sound ("ll", "sh", "ck") and should share one tile.**
  - Observed (Sound It Out, Oct 2026)

## Content & licensing
- **US federal government works are public domain** (CDC, NASA, National Park Service, Fish & Wildlife), but credit is requested and third-party material on their sites isn't covered. NASA's logo and insignia are not free to use.
  - [CDC b-roll](https://www.cdc.gov/media/b-roll/)
  - [NASA media usage guidelines](https://www.nasa.gov/multimedia/guidelines/index.html)
- **CC BY needs visible credit; CC BY-SA also requires modified versions (even volume-leveled audio) to stay CC BY-SA.**
  - [Lingua Libre (CC BY-SA recordings)](https://en.wikipedia.org/wiki/Lingua_Libre)
  - [Creative Commons: Blender open movies (CC BY)](https://creativecommons.org/2016/10/12/blender-institutes-ton-roosendaal-open-licensing-artistic-success/)
- **Pixabay music and media can be used without credit; Pexels likewise, but Pexels doesn't guarantee model releases for people in its footage, so use it for animals and scenery, not children.**
  - [Pixabay FAQ](https://pixabay.com/service/faq/)
  - [Pexels: rules for using photos and videos](https://help.pexels.com/hc/en-us/articles/360042332714-What-are-the-rules-for-using-Pexels-photos-or-videos)
- **Kevin MacLeod's music (incompetech) is free under CC BY 4.0, with credit.**
  - [Creative Commons case study: Kevin MacLeod](https://wiki.creativecommons.org/Case_Studies/Kevin_MacLeod)
- **Old films aren't automatically public domain: in the US only works published in 1930 or earlier are (as of 2026); later ones depend on copyright renewal.**
  - [Duke Center for the Study of the Public Domain](https://web.law.duke.edu/cspd/publicdomainday/)
- **In the US, a transfer of copyright must be in a signed writing, so a contribution clause alone may not fully transfer rights; use a signed contributor agreement if it matters.**
  - [17 U.S.C. § 204(a)](https://www.law.cornell.edu/uscode/text/17/204)
- **Don't publish identifiable footage of young children without careful thought: online content is permanent and can be scraped.**
  - Observed (project decision, Oct 2026)

## Free sources of content
- **US federal agencies publish public-domain video; credit is requested, and third-party footage inside their videos isn't covered:** National Park Service b-roll (no implying NPS endorsement; the arrowhead logo isn't free), Fish & Wildlife Service's National Digital Library (animals), NOAA (ocean; Ocean Today).
  - [NPS: San Antonio Missions b-roll](https://www.nps.gov/saan/learn/photosmultimedia/videos.htm)
  - [NPS: Grand Canyon b-roll index](https://home.nps.gov/grca/learn/photosmultimedia/b-roll_hd_index.htm)
  - [USFWS National Digital Library](https://digitalibra.omeka.net/items/show/57)
  - [NOAA Ocean Today: about](https://oceantoday.noaa.gov/aboutsite.html)
  - [NOAA Ocean Exploration media kit](https://oceanexplorer.noaa.gov/news/media-kit.html)
- **Children's storybooks in many languages under CC BY 4.0 (with audio on Global Storybooks):** StoryWeaver (Pratham Books), Global Storybooks, African Storybook.
  - [StoryWeaver blog](https://storyweaver.org.in/v0/blog_posts/487-this-children-s-day-storyweaver-and-pratham-education-foundation-renew-their-commitment-to-providing-free-storybooks-to-children)
  - [Digital Public Goods: StoryWeaver](https://digitalpublicgoods.net/r/storyweaver)
  - [UBC: Global Storybooks](https://open.ubc.ca/?p=6278)
- **Musopen releases public-domain recordings of classical music** (asks for credit in derived works and not to sell the recordings).
  - [EFF: Musopen](https://www.eff.org/deeplinks/2010/08/musopen-wants-give-classical-music-public-domain)
- **ESA videos marked CC BY-SA 3.0 IGO need credit, a link to the license, and changed versions shared alike.**
  - [ESA open access](https://open.esa.int/?p=2)
- **Mixkit stock video: "Free License" items need no credit; "Restricted License" items are non-commercial only.**
  - [Mixkit: official information](https://mixkit.co/llm-info/)

## Audio & video
- **H.264 `.mp4` plays in every browser; HEVC (H.265), common from iPhones, doesn't.**
  - [MDN: Web video codec guide](https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Video_codecs)
  - [Can I use: HEVC](https://caniuse.com/hevc)
- **720p at 30 fps with a capped bitrate is plenty for tablets: a 673 MB phone video became 57 MB with no visible loss.**
  - Observed (Oct 2026)
- **Video loudness varies wildly between sources (we saw a 16 dB gap); normalize every video to one loudness target (we use −21 LUFS).**
  - [EBU R 128 loudness recommendation](https://tech.ebu.ch/publications/r128)
  - [FFmpeg loudnorm filter](https://ffmpeg.org/ffmpeg-filters.html#loudnorm)
- **Plosive pops (b, p, c) are low-frequency thumps; a steep 100 Hz high-pass cut them by ~17 dB while changing voice loudness by under 1 dB.**
  - Observed (Sound It Out recordings, Oct 2026)
- **Recording sounds with a clear pause after each one makes them easy to split automatically by silence.**
  - Observed (Sound It Out recordings, Oct 2026)

## Browsers
- **Video with sound only starts during a user gesture; call `play()` inside the tap itself.**
  - [Chrome autoplay policy](https://developer.chrome.com/blog/autoplay)
  - [MDN: Autoplay guide for media and Web Audio](https://developer.mozilla.org/en-US/docs/Web/Media/Autoplay_guide)
- **A touch only counts as a user gesture when the finger lifts, so start sound on `click`/`pointerup`, not `pointerdown`.**
  - [HTML spec: activation-triggering input events](https://html.spec.whatwg.org/multipage/interaction.html#activation-triggering-input-event)
- **Safari on iOS ignores `user-scalable=no`; block pinch zoom with gesture/touch event handlers.**
  - [WebKit: New interaction behaviors in iOS 10](https://webkit.org/blog/7367/new-interaction-behaviors-in-ios-10/)
- **Safari needs HTTP range requests to play video; Python's basic dev server doesn't support them.**
  - [Apple: Safari Web Content Guide, configuring your server for video](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/CreatingVideoforSafarioniPhone/CreatingVideoforSafarioniPhone.html)
- **The browser's built-in speech is unreliable: Chrome's speech engine can hang for the whole browser session (only a restart fixes it). Prefer recorded audio.**
  - Observed (Oct 2026)
- **iPad Home Screen web apps (iPadOS 26, added from Safari or Chrome) get the whole screen but report a viewport about 32pt too short (`innerHeight`, `100dvh`), and clip the page to it, leaving a strip at the bottom filled with the page's background color. Fix: when `navigator.standalone`, size both `<html>` and `<body>` to the screen's height in px, with `body` positioned absolutely; a `position: fixed` body stays clipped. Once sized, iOS reports the full height, so don't undo the fix when the gap reads 0 (it flickers), and re-check after startup, rotation and resume, since iOS settles its size late.**
  - Observed (Oct 2026)
- **Two CSS animations with the same name: the last one defined wins, silently breaking the other.**
  - [MDN: @keyframes](https://developer.mozilla.org/en-US/docs/Web/CSS/@keyframes)
- **Emoji drawn by scaling up a small font look blurry; draw them at their real pixel size.**
  - Observed (Powers of Ten, Oct 2026)
- **Loading fonts from Google sends every visitor's IP address to Google; self-host fonts on a kids' site.**
  - Landgericht München I, judgment of 20 Jan 2022, 3 O 17493/20 (German court ruling on Google Fonts and privacy)

## Hosting & tools
- **CloudFront's always-free tier includes 1 TB of transfer a month, enough for a family-scale video site.**
  - [AWS CloudFront pricing](https://aws.amazon.com/cloudfront/pricing/)
- **GitHub warns on files over 50 MB and rejects files over 100 MB.**
  - [GitHub Docs: About large files](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)
- **GitHub doesn't accept passwords for git over HTTPS; use SSH keys or a token.**
  - [GitHub Blog: token authentication requirements](https://github.blog/2020-12-15-token-authentication-requirements-for-git-operations/)
- **A dev server that lets browsers cache files causes confusing "fixed but still broken" bugs; serve with `Cache-Control: no-store` in development.**
  - Observed (Oct 2026)
