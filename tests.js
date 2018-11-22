"use strict";
const test = require('tape');
const mod = require('./index');

let tmap = new Map([
  ['q-fq', [['q', 'fq']]],
  ['q', [['d']]],
  ['d', [['s']]],
  ['s', [['q'], ['s']]],
  ['fq', [['q', 'f']]],
]);

test('descender', t => {
  let graph = mod.allDescendents(tmap, 'q-fq')
  t.equal(graph.nodes.size, 6, "found all nodes");
  t.ok(graph.edges.has('s'), "edge out of s");
  t.ok(graph.edges.get('s').has('q'), "edge between s and q (loop)");
  t.ok(!graph.edges.get('s').has('s'), "don't represent self-loops");
  t.end();
})

test('printer', t => {
  let graph = mod.allDescendents(tmap, 'q-fq')
  let printed = mod.graphToMarkdown('q-fq', graph);
  t.comment(JSON.stringify(printed));
  t.ok(printed.indexOf('\n\n') < 0, "no repeated newlines");

  t.equal(mod.graphToMarkdown('XXX', graph), '- XXX', "searching for nonsense results in single line");
  t.end();
})