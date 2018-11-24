"use strict";
const test = require('tape');
const mod = require('./index');

let graph = {
  edges: new Map([
    ['q-fq', new Set(['q', 'fq'])],
    ['q', new Set(['d'])],
    ['d', new Set(['s'])],
    [
      's', new Set([
        'q',
        // 's' // ignore self loops
      ])
    ],
    ['fq', new Set(['q', 'f'])],
  ]),
  nodes: new Set([
    'q-fq',
    'q',
    'fq',
    'd',
    's',
    'f',
  ])
};

test('descender', t => {
  t.equal(graph.nodes.size, 6, "found all nodes");
  t.ok(graph.edges.has('s'), "edge out of s");
  t.ok(graph.edges.get('s').has('q'), "edge between s and q (loop)");
  t.ok(!graph.edges.get('s').has('s'), "don't represent self-loops");
  t.end();
})

test('printer', t => {
  let printed = mod.graphToMarkdown('q-fq', graph);
  t.comment(JSON.stringify(printed));
  t.ok(printed.indexOf('\n\n') < 0, "no repeated newlines");

  t.equal(mod.graphToMarkdown('XXX', graph), '- XXX', "searching for nonsense results in single line");
  t.end();
})