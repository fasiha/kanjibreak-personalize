const USAGE = `USAGE: invoke as:

$ echo "制作の日本" | node index.js KANJIBREAK.CSV

OR

$ node index.js KANJIBREAK.CSV "制作の日本"

to see the Markdown output.
`;

import {exists, readFile} from 'fs';
import {promisify} from 'util';

const existsPromise = promisify(exists);
const readFilePromise = promisify(readFile);
function flatten1<T>(v: T[][]): T[] { return v.reduce((prev, curr) => prev.concat(curr), []); };

const CSV_SEP = ',';

type NodesEdges<T> = {
  nodes: Set<T>,
  edges: Map<T, Set<T>>
};
function allDescendents(deps: Map<string, string[][]>, kanji: string): NodesEdges<string> {
  let nodes: Set<string> = new Set([kanji]);
  let edges: Map<string, Set<string>> = new Map([]);
  let parents = [kanji];
  while (parents.length > 0) {
    let cousins: string[] = [];
    for (let kanji of parents) {
      let hit = deps.get(kanji);
      if (!hit) { continue; }
      let kids = flatten1(hit).filter(x => x !== kanji); // no self-references
      if (kids.length === 0) { continue; }
      kids.forEach(kid => {
        nodes.add(kid);
        let tmp = edges.get(kanji) || new Set([]);
        if (!tmp.has(kid)) { cousins.push(kid); } // don't walk down edges we've already traversed
        edges.set(kanji, tmp.add(kid));
      });
    }
    parents = cousins;
  }
  return {nodes, edges};
}

function graphToMarkdown(kanji: string, graph: NodesEdges<string>, kanjiPrinter: ((s: string) => string) = s => s,
                         visitedNodes: Set<string> = new Set([]), indent: number = 0): string {
  let header = ' '.repeat(indent) + '- ' + kanjiPrinter(kanji);
  if (visitedNodes.has(kanji)) { return header + ' (repeat breakdown omitted)'; }
  visitedNodes.add(kanji);

  const hit = graph.edges.get(kanji);
  if (!hit) { return header; }
  let ret =
      header + '\n' + [...hit].map(k => graphToMarkdown(k, graph, kanjiPrinter, visitedNodes, indent + 2)).join('\n');
  return ret;
}

function dependencyTableToMap(dependencies: string[][]): Map<string, string[][]> {
  let kanjiUserComponents: Map<string, Map<string, string[]>> = new Map([]);
  for (let [kanji, user, component] of dependencies) {
    if (kanjiUserComponents.has(kanji)) {
      let userComponents = kanjiUserComponents.get(kanji);
      if (!userComponents) { throw new Error('typescript pacification'); }
      userComponents.set(user, (userComponents.get(user) || []).concat(component))
    } else {
      kanjiUserComponents.set(kanji, new Map([[user, [component]]]));
    }
  }

  let kanjiComponents: Map<string, string[][]> = new Map([]);
  for (let [kanji, userComponents] of kanjiUserComponents) {
    kanjiComponents.set(kanji, Array.from(userComponents).map(([_, components]) => components));
  }
  return kanjiComponents;
}

if (require.main === module) {
  (async function main() {
    // Parse inputs
    const [kanjibreakCsv, inputText]: (string|undefined)[] = process.argv.slice(2);
    if (!kanjibreakCsv) {
      console.log(USAGE);
      process.exit(1);
    }

    // Slurp CSV file from KanjiBreak
    if (!await existsPromise(kanjibreakCsv)) {
      console.log('ERROR: cannot read input file, ' + kanjibreakCsv);
      process.exit(1);
    }
    const raw = await readFilePromise(kanjibreakCsv, 'utf8');
    const sections = raw.trim().split('\n\n');

    // Extract metadata table (allowed kanji, primitives, etc.)
    const metadataSection = sections.find(s => s.startsWith('target,primitive,kanji'));
    if (!metadataSection) {
      console.error('ERROR: could not find metadata table in ' + kanjibreakCsv);
      process.exit(1);
      return;
    }
    const metadata: [string, boolean, boolean][] =
        metadataSection.trim()
            .split('\n')
            .map(line => line.split(CSV_SEP))
            .map(v => [v[0], !!(+v[1]), !!(+v[2])] as [string, boolean, boolean]);
    const valueIsPrimitive: Set<string> = new Set(metadata.filter(([_, p]) => p).map(([k]) => k));
    const valueIsKanji: Set<string> = new Set(metadata.filter(([_, _2, k]) => k).map(([k]) => k));

    // Extract dependency table
    const dependencySection = sections.find(s => s.startsWith('target,user'));
    if (!dependencySection) {
      console.error('ERROR: could not find dependency table in ' + kanjibreakCsv);
      process.exit(1);
      return;
    }
    const dependencies = dependencySection.trim().split('\n').map(line => line.split(CSV_SEP));
    let kanjiComponents: Map<string, string[][]> = dependencyTableToMap(dependencies);

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
        console.log(graphToMarkdown(k, allDescendents(kanjiComponents, k), kankenPrinter));
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
          console.log(graphToMarkdown(k, allDescendents(kanjiComponents, k), kankenPrinter));
          console.log('');
        }
      });
    }
  })();
}

module.exports = {
  allDescendents,
  graphToMarkdown
};