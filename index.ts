import {exists, readFile} from 'fs';
import {promisify} from 'util';

const existsPromise = promisify(exists);
const readFilePromise = promisify(readFile);
function flatten1<T>(v: T[][]): T[] { return v.reduce((prev, curr) => prev.concat(curr), []); };
function setdiff<T>(arr: T[], set: Set<T>): T[] { return arr.filter(x => !set.has(x)); };

const KANJIBREAK_CSV_FILE = "kanjibreak.csv";
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

function graphToMarkdown(kanji: string, graph: NodesEdges<string>, visitedNodes: Set<string> = new Set([]),
                         indent: number = 0): string {
  let header = ' '.repeat(indent) + '- ' + kanji;
  if (visitedNodes.has(kanji)) { return header + ' (repeat breakdown omitted)'; }
  visitedNodes.add(kanji);

  const hit = graph.edges.get(kanji);
  if (!hit) { return header; }
  let ret = header + '\n' + [...hit].map(k => graphToMarkdown(k, graph, visitedNodes, indent + 2)).join('\n');
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
    if (!await existsPromise(KANJIBREAK_CSV_FILE)) { throw new Error('cannot find input file'); }
    const raw = await readFilePromise(KANJIBREAK_CSV_FILE, 'utf8');
    const sections = raw.trim().split('\n\n');
    if (sections.length !== 3) { throw new Error('three sections expected: "me", metadata, and dependency'); }

    const dependencySection = sections.find(s => s.startsWith('target,user'));
    if (!dependencySection) { throw new Error('could not find dependency table'); }
    const dependencies = dependencySection.trim().split('\n').map(line => line.split(CSV_SEP));
    let kanjiComponents: Map<string, string[][]> = dependencyTableToMap(dependencies);

    console.error('[waiting for stdin]');
    let seen: Set<string> = new Set([]);
    const hanRegexp =
        /[\u2E80-\u2E99\u2E9B-\u2EF3\u2F00-\u2FD5\u3005\u3007\u3021-\u3029\u3038-\u303B\u3400-\u4DB5\u4E00-\u9FEF\uF900-\uFA6D\uFA70-\uFAD9]/g;
    process.stdin.on('data', (line: Buffer) => {
      let kanjis = [...new Set(line.toString('utf8').match(hanRegexp))].filter(k => !seen.has(k));
      kanjis.forEach(k => seen.add(k));
      console.log(kanjis.map(k => graphToMarkdown(k, allDescendents(kanjiComponents, k))).join('\n\n'));
    });
  })();
}

module.exports = {
  allDescendents,
  graphToMarkdown
};