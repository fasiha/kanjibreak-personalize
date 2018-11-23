"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const USAGE = `USAGE: invoke as:

$ echo "制作の日本" | node index.js KANJIBREAK.CSV

OR

$ node index.js KANJIBREAK.CSV "制作の日本"

to see the Markdown output.
`;
const fs_1 = require("fs");
const util_1 = require("util");
const existsPromise = util_1.promisify(fs_1.exists);
const readFilePromise = util_1.promisify(fs_1.readFile);
function flatten1(v) { return v.reduce((prev, curr) => prev.concat(curr), []); }
;
const CSV_SEP = ',';
function allDescendents(deps, kanji) {
    let nodes = new Set([kanji]);
    let edges = new Map([]);
    let parents = [kanji];
    while (parents.length > 0) {
        let cousins = [];
        for (let kanji of parents) {
            let hit = deps.get(kanji);
            if (!hit) {
                continue;
            }
            let kids = flatten1(hit).filter(x => x !== kanji); // no self-references
            if (kids.length === 0) {
                continue;
            }
            kids.forEach(kid => {
                nodes.add(kid);
                let tmp = edges.get(kanji) || new Set([]);
                if (!tmp.has(kid)) {
                    cousins.push(kid);
                } // don't walk down edges we've already traversed
                edges.set(kanji, tmp.add(kid));
            });
        }
        parents = cousins;
    }
    return { nodes, edges };
}
function graphToMarkdown(kanji, graph, visitedNodes = new Set([]), indent = 0) {
    let header = ' '.repeat(indent) + '- ' + kanji;
    if (visitedNodes.has(kanji)) {
        return header + ' (repeat breakdown omitted)';
    }
    visitedNodes.add(kanji);
    const hit = graph.edges.get(kanji);
    if (!hit) {
        return header;
    }
    let ret = header + '\n' + [...hit].map(k => graphToMarkdown(k, graph, visitedNodes, indent + 2)).join('\n');
    return ret;
}
function dependencyTableToMap(dependencies) {
    let kanjiUserComponents = new Map([]);
    for (let [kanji, user, component] of dependencies) {
        if (kanjiUserComponents.has(kanji)) {
            let userComponents = kanjiUserComponents.get(kanji);
            if (!userComponents) {
                throw new Error('typescript pacification');
            }
            userComponents.set(user, (userComponents.get(user) || []).concat(component));
        }
        else {
            kanjiUserComponents.set(kanji, new Map([[user, [component]]]));
        }
    }
    let kanjiComponents = new Map([]);
    for (let [kanji, userComponents] of kanjiUserComponents) {
        kanjiComponents.set(kanji, Array.from(userComponents).map(([_, components]) => components));
    }
    return kanjiComponents;
}
if (require.main === module) {
    (function main() {
        return __awaiter(this, void 0, void 0, function* () {
            const [kanjibreakCsv, inputText] = process.argv.slice(2);
            if (!kanjibreakCsv) {
                console.log(USAGE);
                process.exit(1);
            }
            if (!(yield existsPromise(kanjibreakCsv))) {
                console.log('ERROR: cannot read input file, ' + kanjibreakCsv);
                process.exit(1);
            }
            const raw = yield readFilePromise(kanjibreakCsv, 'utf8');
            const sections = raw.trim().split('\n\n');
            if (sections.length !== 3) {
                throw new Error('three sections expected: "me", metadata, and dependency');
            }
            const dependencySection = sections.find(s => s.startsWith('target,user'));
            if (!dependencySection) {
                console.error('ERROR: could not find dependency table in ' + kanjibreakCsv);
                process.exit(1);
                return;
            }
            const dependencies = dependencySection.trim().split('\n').map(line => line.split(CSV_SEP));
            let kanjiComponents = dependencyTableToMap(dependencies);
            const hanRegexp = /[\u2E80-\u2E99\u2E9B-\u2EF3\u2F00-\u2FD5\u3005\u3007\u3021-\u3029\u3038-\u303B\u3400-\u4DB5\u4E00-\u9FEF\uF900-\uFA6D\uFA70-\uFAD9]/g;
            if (inputText) {
                for (let k of new Set(inputText.match(hanRegexp))) {
                    console.log(graphToMarkdown(k, allDescendents(kanjiComponents, k)));
                    console.log('');
                }
            }
            else {
                console.error('[waiting for stdin]');
                let seen = new Set([]);
                process.stdin.on('data', (line) => {
                    let kanjis = [...new Set(line.toString('utf8').match(hanRegexp))].filter(k => !seen.has(k));
                    kanjis.forEach(k => seen.add(k));
                    console.log(kanjis.map(k => graphToMarkdown(k, allDescendents(kanjiComponents, k))).join('\n\n'));
                });
            }
        });
    })();
}
module.exports = {
    allDescendents,
    graphToMarkdown
};
