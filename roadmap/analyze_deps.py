#!/usr/bin/env python3
import sys
import re
import csv
from collections import Counter, defaultdict

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

def compute_in_degrees(edges):
    """
    edges: iterable of (src, tgt)
    returns: Counter mapping each node to its in-degree,
             and a set of all nodes
    """
    indegree = Counter()
    nodes = set()
    for src, tgt in edges:
        nodes.add(src)
        nodes.add(tgt)
        indegree[tgt] += 1
        # ensure nodes with zero indegree appear
        if src not in indegree:
            indegree[src] += 0
    return indegree

def main():
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} path/to/deps.dot [--csv output.csv]", file=sys.stderr)
        sys.exit(1)

    dot_path = sys.argv[1]
    out_csv = None
    if len(sys.argv) == 3 and sys.argv[2].startswith('--csv'):
        parts = sys.argv[2].split('=', 1)
        if len(parts) == 2:
            out_csv = parts[1]

    edges = list(parse_dot(dot_path))
    indegree = compute_in_degrees(edges)

    # Sort by descending in-degree
    sorted_nodes = sorted(indegree.items(), key=lambda kv: kv[1], reverse=True)

    if out_csv:
        with open(out_csv, 'w', newline='', encoding='utf-8') as csvf:
            writer = csv.writer(csvf)
            writer.writerow(['module/file', 'dependent_count'])
            for node, cnt in sorted_nodes:
                writer.writerow([node, cnt])
        print(f"Wrote results to {out_csv}")
    else:
        # Plain-text table
        print(f"{'dependents':>10}    module/file")
        print("-" * 40)
        for node, cnt in sorted_nodes:
            print(f"{cnt:>10}    {node}")

if __name__ == '__main__':
    main()
