import {exists, readFile} from 'fs';
import {promisify} from 'util';

const existsPromise = promisify(exists);
const readFilePromise = promisify(readFile);
function flatten1<T>(v: T[][]): T[] { return v.reduce((prev, curr) => prev.concat(curr), []); };
function setdiff<T>(arr: T[], set: Set<T>): T[] { return arr.filter(x => !set.has(x)) }

const KANJIBREAK_CSV_FILE = "kanjibreak.csv";
const CSV_SEP = ',';

interface DeepArray<T> extends Array<T|DeepArray<T>> {}
type Deep<T> = T|DeepArray<T>;

function allDescendents(deps: Map<string, string[][]>, kanji: string, seen: Set<string> = new Set([])): Deep<string> {
  let hit = deps.get(kanji);
  if (!hit) { return []; }
  let pieces = setdiff(flatten1(hit), seen);
  if (pieces.length === 0) { return []; }
  pieces.forEach(x => seen.add(x));
  return pieces.map(x => {
    let ret: Deep<string> = [x];
    let kids = allDescendents(deps, x, seen);
    if (kids.length) { ret.push(kids); }
    return ret;
  });
}
function allDescendents2(deps: Map<string, string[][]>,
                         kanji: string): {nodes: Set<string>, edges: [string, string][]} {
  let nodes: Set<string> = new Set([]);
  let edges: Array<[string, string]> = []; // to -> from
  let kanjis = [kanji];
  let cousins: string[] = [];
  do {
    cousins = [];
    for (let kanji of kanjis) {
      let hit = deps.get(kanji);
      if (!hit) { continue; }
      let kids = setdiff(flatten1(hit), nodes);
      if (kids.length === 0) { continue; }
      kids.forEach(kid => {
        nodes.add(kid);
        edges.push([kanji, kid]);
        cousins.push(kid);
      });
    }
    kanjis = cousins;
  } while (kanjis.length > 0);
  return {nodes, edges};
}

if (require.main === module) {
  (async function main() {
    if (!await existsPromise(KANJIBREAK_CSV_FILE)) { throw new Error('cannot find input file'); }
    const raw = await readFilePromise(KANJIBREAK_CSV_FILE, 'utf8');
    const sections = raw.trim().split('\n\n');
    if (sections.length !== 3) { throw new Error('three sections expected: "me", metadata, and dependency'); }

    const metadata = sections[1].trim().split('\n').map(line => line.split(CSV_SEP)).map(v => [v[0], +v[1], +v[2]]);
    const dependencies = sections[2].trim().split('\n').map(line => line.split(CSV_SEP));

    let kanjiUserComponents: Map<string, Map<string, string[]>> = new Map([]);
    // kanjiUserComponents = new Map([]);
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
    // kanjiComponents = new Map([])
    for (let [kanji, userComponents] of kanjiUserComponents) {
      kanjiComponents.set(kanji, Array.from(userComponents).map(([_, components]) => components));
    }
  })();
}