import {exists, readFile} from 'fs';
import {promisify} from 'util';

const existsPromise = promisify(exists);
const readFilePromise = promisify(readFile);
function flatten1<T>(v: T[][]): T[] { return v.reduce((prev, curr) => prev.concat(curr), []); };
function setdiff<T>(arr: T[], set: Set<T>): T[] { return arr.filter(x => !set.has(x)); };

const KANJIBREAK_CSV_FILE = "kanjibreak.csv";
const CSV_SEP = ',';

function allDescendents(deps: Map<string, string[][]>,
                        kanji: string): {nodes: Set<string>, edges: Map<string, string[]>} {
  let nodes: Set<string> = new Set([kanji]);
  let edges: Map<string, string[]> = new Map([]);
  let parents = [kanji];
  while (parents.length > 0) {
    let cousins: string[] = [];
    for (let kanji of parents) {
      let hit = deps.get(kanji);
      if (!hit) { continue; }
      let kids = setdiff(flatten1(hit), nodes);
      if (kids.length === 0) { continue; }
      kids.forEach(kid => {
        nodes.add(kid);
        edges.set(kanji, (edges.get(kanji) || []).concat(kid));
        cousins.push(kid);
      });
    }
    parents = cousins;
  }
  return {nodes, edges};
}

function graphToMarkdown(kanji: string, edges: Map<string, string[]>) {}

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

    // const metadata = sections[1].trim().split('\n').map(line => line.split(CSV_SEP)).map(v => [v[0], +v[1], +v[2]]);
    const dependencies = sections[2].trim().split('\n').map(line => line.split(CSV_SEP));
    let kanjiComponents: Map<string, string[][]> = dependencyTableToMap(dependencies);
  })();
}