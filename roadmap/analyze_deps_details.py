#!/usr/bin/env python3
import sys
import re
import json
import csv
from collections import defaultdict

def parse_dot(path):
    """
    Read a GraphViz DOT file, yield (from_node, to_node) tuples.
    Assumes nodes are quoted strings:  "foo" -> "bar";
    """
    edge_re = re.compile(r'"\s*([^"]+)\s*"\s*->\s*"\s*([^"]+)\s*"')
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            m = edge_re.search(line)
            if m:
                yield m.group(1), m.group(2)

def build_dependency_map(edges):
    """
    edges: iterable of (src, tgt)
    returns: dict mapping src -> set of tgts, and ensures every node appears
    """
    deps = defaultdict(set)
    all_nodes = set()
    for src, tgt in edges:
        all_nodes.add(src)
        all_nodes.add(tgt)
        deps[src].add(tgt)
    # ensure nodes with no outgoing edges show up with empty set
    for node in all_nodes:
        deps.setdefault(node, set())
    return deps

def main():
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} path/to/deps.dot [--json out.json] [--csv roadmap.csv]", file=sys.stderr)
        sys.exit(1)

    dot_path = sys.argv[1]
    out_json = None
    out_csv = None

    # parse optional flags
    for arg in sys.argv[2:]:
        if arg.startswith('--json='):
            out_json = arg.split('=',1)[1]
        elif arg.startswith('--csv='):
            out_csv = arg.split('=',1)[1]

    edges = list(parse_dot(dot_path))
    deps_map = build_dependency_map(edges)

    # 1) Write JSON of dependencies
    if out_json:
        with open(out_json, 'w', encoding='utf-8') as jf:
            # convert sets to sorted lists
            json.dump({node: sorted(list(deps_map[node])) for node in deps_map},
                      jf, indent=2)
        print(f"Wrote dependency map to {out_json}")

    # 2) Prepare roadmap sorted by number of dependencies (out-degree)
    sorted_by_depcount = sorted(
        deps_map.items(),
        key=lambda kv: len(kv[1])
    )

    # Write CSV or print plain text
    if out_csv:
        with open(out_csv, 'w', newline='', encoding='utf-8') as cf:
            writer = csv.writer(cf)
            writer.writerow(['module/file', 'dependency_count', 'dependencies'])
            for node, deps in sorted_by_depcount:
                writer.writerow([node, len(deps), ";".join(sorted(deps))])
        print(f"Wrote roadmap to {out_csv}")
    else:
        print(f"{'deps':>4}  module/file")
        print("-" * 40)
        for node, deps in sorted_by_depcount:
            print(f"{len(deps):>4}  {node}")
            if deps:
                print("    depends on:", ", ".join(sorted(deps)))
        print()

if __name__ == '__main__':
    main()
