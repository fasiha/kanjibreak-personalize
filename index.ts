const USAGE = `USAGE: invoke as:

$ echo "制作の日本" | node index.js KANJIBREAK.CSV

OR

$ node index.js KANJIBREAK.CSV "制作の日本"

to see the Markdown output.
`;

import {exists, readFile, writeFile} from 'fs';
import {promisify} from 'util';
import fetch from 'node-fetch';
import sqlite from 'sqlite3';

const existsPromise = promisify(exists);
const readFilePromise = promisify(readFile);
const writeFilePromise = promisify(writeFile);

type NodesEdges<T> = {
  nodes: Set<T>,
  edges: Map<T, Set<T>>
};

function graphToMarkdown(kanji: string, graph: NodesEdges<string>, kanjiPrinter: ((s: string) => string) = s => s,
                         visitedNodes: Set<string> = new Set([]), indent: number = 0): string {
  const header = ' '.repeat(indent) + '- ' + kanjiPrinter(kanji);
  if (visitedNodes.has(kanji)) { return header + ' (repeat breakdown omitted)'; }
  visitedNodes.add(kanji);

  const hit = graph.edges.get(kanji);
  if (!hit) { return header; }
  const ret = [...hit]
                  .filter(x => x !== kanji)
                  .map(k => graphToMarkdown(k, graph, kanjiPrinter, visitedNodes, indent + 2))
                  .join('\n');
  return header + (ret ? '\n' + ret : '');
}

function databaseToGraph(db: sqlite.Database): NodesEdges<string> {
  let nodes: Set<string> = new Set([]);
  let edges: Map<string, Set<string>> = new Map([]);
  db.each("SELECT * FROM deps", (err, row) => {
    if (err) { throw new Error('' + err); }
    if (!(row.hasOwnProperty('target') && row.hasOwnProperty('dependency'))) {
      throw new Error('malformed row in `deps`');
    }
    nodes.add(row.target);
    if (true || row.target !== row.dependency) { // don't allow self-references
      nodes.add(row.dependency);
      edges.set(row.target, (edges.get(row.target) || new Set([])).add(row.dependency));
    }
  });
  return {nodes, edges};
}

function databaseToMetadata(db: sqlite.Database) {
  let valueIsPrimitive: Set<string> = new Set([]);
  let valueIsKanji: Set<string> = new Set([]);
  db.each("SELECT * FROM targets", (err, row) => {
    if (err) { throw new Error('' + err); }
    if (!(row.hasOwnProperty('target') && row.hasOwnProperty('primitive') && row.hasOwnProperty('kanji'))) {
      throw new Error('malformed row in `targets`');
    }
    if (row.primitive) { valueIsPrimitive.add(row.target); }
    if (row.kanji) { valueIsKanji.add(row.target); }
  });
  return {valueIsPrimitive, valueIsKanji};
}

async function verifyExistsOrDownload(sqliteFilepath = 'kanjibreak.sqlite3'): Promise<boolean> {
  if (!existsPromise(sqliteFilepath)) {
    await fetch('https://kanjibreak.glitch.me/api/exportdb')
        .then(x => x.arrayBuffer())
        .then(x => writeFilePromise(sqliteFilepath, Buffer.from(x)))
  }
  return true;
}

if (require.main === module) {
  (async function main() {
    // Parse inputs
    const [KANJIBREAK_SQLITE, inputText]: (string|undefined)[] = process.argv.slice(2);
    if (!KANJIBREAK_SQLITE) {
      console.log(USAGE);
      process.exit(1);
    }
    if (!await existsPromise(KANJIBREAK_SQLITE)) {
      console.log('ERROR: cannot read input file, ' + KANJIBREAK_SQLITE);
      process.exit(1);
    }

    // Load database
    let db = new sqlite.Database(KANJIBREAK_SQLITE, err => {
      if (err) { throw new Error('failed to open ' + KANJIBREAK_SQLITE); }
    });

    // Extract metadata and dependencies tables
    const {valueIsPrimitive, valueIsKanji} = databaseToMetadata(db);
    const graph: NodesEdges<string> = databaseToGraph(db);

    // Wait for all database queries to finish
    await new Promise((resolve, reject) => {
      db.close(e => {
        if (e) { reject(e); }
        resolve();
      });
    });

    // Load Kanji Kentei (kanken) data
    const kankenYearToKanjis: Map<number, string> = new Map(
        Object.entries(JSON.parse(await readFilePromise('kanken.json', 'utf8'))).map(v => [+v[0], v[1]]) as any);
    const kankenKanjiToYear: Map<string, number> = new Map([]);
    for (let [year, kanjis] of kankenYearToKanjis) { kanjis.split('').forEach(k => kankenKanjiToYear.set(k, year)); }

    // Function to nicely annotate a kanji, given metadata and Kanken data above
    const kankenPrinter = (k: string) => k + (valueIsPrimitive.has(k) && " (primitive)" || "") +
                                         (valueIsKanji.has(k) && " (kanji)" || "") +
                                         (kankenKanjiToYear.has(k) ? ` (Kanken ${kankenKanjiToYear.get(k)})` : '');

    // Prepare to parse input text
    const hanRegexp =
        /[\u2E80-\u2E99\u2E9B-\u2EF3\u2F00-\u2FD5\u3005\u3007\u3021-\u3029\u3038-\u303B\u3400-\u4DB5\u4E00-\u9FEF\uF900-\uFA6D\uFA70-\uFAD9]/g;

    // Text given as an argument?
    if (inputText) {
      for (let k of new Set(inputText.match(hanRegexp))) {
        console.log(graphToMarkdown(k, graph, kankenPrinter));
        console.log('');
      }
    } else {
      // Text piped into stdin
      console.error('[waiting for stdin]');
      let seen: Set<string> = new Set([]);
      process.stdin.on('data', (line: Buffer) => {
        let kanjis = [...new Set(line.toString('utf8').match(hanRegexp))].filter(k => !seen.has(k));
        for (let k of kanjis) {
          seen.add(k);
          console.log(graphToMarkdown(k, graph, kankenPrinter));
          console.log('');
        }
      });
    }
  })();
}

module.exports = {graphToMarkdown};