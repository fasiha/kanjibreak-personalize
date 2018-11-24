"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
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
const sqlite3_1 = __importDefault(require("sqlite3"));
const existsPromise = util_1.promisify(fs_1.exists);
const readFilePromise = util_1.promisify(fs_1.readFile);
function graphToMarkdown(kanji, graph, kanjiPrinter = s => s, visitedNodes = new Set([]), indent = 0) {
    const header = ' '.repeat(indent) + '- ' + kanjiPrinter(kanji);
    if (visitedNodes.has(kanji)) {
        return header + ' (repeat breakdown omitted)';
    }
    visitedNodes.add(kanji);
    const hit = graph.edges.get(kanji);
    if (!hit) {
        return header;
    }
    const ret = [...hit]
        .filter(x => x !== kanji)
        .map(k => graphToMarkdown(k, graph, kanjiPrinter, visitedNodes, indent + 2))
        .join('\n');
    return header + (ret ? '\n' + ret : '');
}
function databaseToGraph(db) {
    let nodes = new Set([]);
    let edges = new Map([]);
    db.each("SELECT * FROM deps", (err, row) => {
        if (err) {
            throw new Error('' + err);
        }
        if (!(row.hasOwnProperty('target') && row.hasOwnProperty('dependency'))) {
            throw new Error('malformed row in `deps`');
        }
        nodes.add(row.target);
        if (true || row.target !== row.dependency) { // don't allow self-references
            nodes.add(row.dependency);
            edges.set(row.target, (edges.get(row.target) || new Set([])).add(row.dependency));
        }
    });
    return { nodes, edges };
}
function databaseToMetadata(db) {
    let valueIsPrimitive = new Set([]);
    let valueIsKanji = new Set([]);
    db.each("SELECT * FROM targets", (err, row) => {
        if (err) {
            throw new Error('' + err);
        }
        if (!(row.hasOwnProperty('target') && row.hasOwnProperty('primitive') && row.hasOwnProperty('kanji'))) {
            throw new Error('malformed row in `targets`');
        }
        if (row.primitive) {
            valueIsPrimitive.add(row.target);
        }
        if (row.kanji) {
            valueIsKanji.add(row.target);
        }
    });
    return { valueIsPrimitive, valueIsKanji };
}
if (require.main === module) {
    (function main() {
        return __awaiter(this, void 0, void 0, function* () {
            // Parse inputs
            const [KANJIBREAK_SQLITE, inputText] = process.argv.slice(2);
            if (!KANJIBREAK_SQLITE) {
                console.log(USAGE);
                process.exit(1);
            }
            if (!(yield existsPromise(KANJIBREAK_SQLITE))) {
                console.log('ERROR: cannot read input file, ' + KANJIBREAK_SQLITE);
                process.exit(1);
            }
            // Load database
            let db = new sqlite3_1.default.Database(KANJIBREAK_SQLITE, err => {
                if (err) {
                    throw new Error('failed to open ' + KANJIBREAK_SQLITE);
                }
            });
            // Extract metadata and dependencies tables
            const { valueIsPrimitive, valueIsKanji } = databaseToMetadata(db);
            const graph = databaseToGraph(db);
            // Wait for all database queries to finish
            yield new Promise((resolve, reject) => {
                db.close(e => {
                    if (e) {
                        reject(e);
                    }
                    resolve();
                });
            });
            // Load Kanji Kentei (kanken) data
            const kankenYearToKanjis = new Map(Object.entries(JSON.parse(yield readFilePromise('kanken.json', 'utf8'))).map(v => [+v[0], v[1]]));
            const kankenKanjiToYear = new Map([]);
            for (let [year, kanjis] of kankenYearToKanjis) {
                kanjis.split('').forEach(k => kankenKanjiToYear.set(k, year));
            }
            // Function to nicely annotate a kanji, given metadata and Kanken data above
            const kankenPrinter = (k) => k + (valueIsPrimitive.has(k) && " (primitive)" || "") +
                (valueIsKanji.has(k) && " (kanji)" || "") +
                (kankenKanjiToYear.has(k) ? ` (Kanken ${kankenKanjiToYear.get(k)})` : '');
            // Prepare to parse input text
            const hanRegexp = /[\u2E80-\u2E99\u2E9B-\u2EF3\u2F00-\u2FD5\u3005\u3007\u3021-\u3029\u3038-\u303B\u3400-\u4DB5\u4E00-\u9FEF\uF900-\uFA6D\uFA70-\uFAD9]/g;
            // Text given as an argument?
            if (inputText) {
                for (let k of new Set(inputText.match(hanRegexp))) {
                    console.log(graphToMarkdown(k, graph, kankenPrinter));
                    console.log('');
                }
            }
            else {
                // Text piped into stdin
                console.error('[waiting for stdin]');
                let seen = new Set([]);
                process.stdin.on('data', (line) => {
                    let kanjis = [...new Set(line.toString('utf8').match(hanRegexp))].filter(k => !seen.has(k));
                    for (let k of kanjis) {
                        seen.add(k);
                        console.log(graphToMarkdown(k, graph, kankenPrinter));
                        console.log('');
                    }
                });
            }
        });
    })();
}
module.exports = { graphToMarkdown };
