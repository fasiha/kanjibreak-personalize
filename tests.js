"use strict";
const test = require('tape');
const mod = require('./index');

test('descender', t => {
  let tmap = new Map([['q-fq', [['q', 'fq']]], ['q', [['d']]], ['d', [['s']]], ['s', [['q']]], ['fq', [['q', 'f']]]]);
  let graph = mod.allDescendents(tmap, 'q-fq')
  t.equal(graph.nodes.size, 6, "found all nodes");
  t.ok(graph.edges.has('s'), "edge out of s");
  t.ok(graph.edges.get('s').has('q'), "edge between s and q (loop)");
  t.end();
})