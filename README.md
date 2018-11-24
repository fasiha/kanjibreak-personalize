# KanjiBreak Personalize

After installing [Git](https://git-scm.com) and [Node.js](https://nodejs.org),

1. run `git clone https://github.com/fasiha/kanjibreak-personalize.git && cd kanjibreak-personalize` in your command line terminal.
1. Visit https://kanjibreak.glitch.me/export.html and click "Click to download SQLite database".
1. Optional, but I assume you've done this in what follows: move the downloaded file into the directory made above (`kanjibreak-personalize`) and name it `kanjibreak.sqlite3`.
1. Run
```
$ node index.js kanjibreak.sqlite3 "制作の日本"
```
or equivalently
```
$ echo "制作の日本" | node.js kanjibreak.sqlite3
```

This will output the following Markdown (note that "Kanken" refers to [Kanji Kentei (Wikipedia)](https://en.wikipedia.org/wiki/Kanji_Kentei)):

- 制 (kanji) (Kanken 6)

- 作 (kanji) (Kanken 9)
  - 乍 (primitive)
    - 一 (primitive) (kanji) (Kanken 10)
    - 丨 (primitive)
    - 丿 (primitive)
    - 午 (primitive) (kanji) (Kanken 9)
      - 丿 (primitive) (repeat breakdown omitted)
      - 于 (primitive)
        - ニ
          - 一 (primitive) (kanji) (Kanken 10) (repeat breakdown omitted)
        - 亅 (primitive)
  - 亻 (primitive)
    - 人 (primitive) (kanji) (Kanken 10)

- 日 (primitive) (kanji) (Kanken 10)

- 本 (primitive) (kanji) (Kanken 10)
  - 一 (primitive) (kanji) (Kanken 10)
  - 木 (primitive) (kanji) (Kanken 10)

## Rationale

KanjiBreak is good at collaboratively making kanji dependency graphs (i.e., breakdowns). This is one attempt at a tool for what comes next: you have a database and want to use it.

The plan: also print onyomi/kunyomi with each kanji, and other metadata to help me resurrect my memory of a kanji that I may have forgotten.