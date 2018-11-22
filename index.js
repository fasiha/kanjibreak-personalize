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
const fs_1 = require("fs");
const util_1 = require("util");
const existsPromise = util_1.promisify(fs_1.exists);
const readFilePromise = util_1.promisify(fs_1.readFile);
function flatten1(v) { return v.reduce((prev, curr) => prev.concat(curr), []); }
;
function setdiff(arr, set) { return arr.filter(x => !set.has(x)); }
;
const KANJIBREAK_CSV_FILE = "kanjibreak.csv";
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
    const edges = graph.edges;
    const hit = edges.get(kanji);
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
            if (!(yield existsPromise(KANJIBREAK_CSV_FILE))) {
                throw new Error('cannot find input file');
            }
            const raw = yield readFilePromise(KANJIBREAK_CSV_FILE, 'utf8');
            const sections = raw.trim().split('\n\n');
            if (sections.length !== 3) {
                throw new Error('three sections expected: "me", metadata, and dependency');
            }
            // const metadata = sections[1].trim().split('\n').map(line => line.split(CSV_SEP)).map(v => [v[0], +v[1], +v[2]]);
            const dependencies = sections[2].trim().split('\n').map(line => line.split(CSV_SEP));
            let kanjiComponents = dependencyTableToMap(dependencies);
        });
    })();
}
module.exports = {
    allDescendents,
    graphToMarkdown
};
