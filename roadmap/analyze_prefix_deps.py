#!/usr/bin/env python3
"""
analyze_prefix_deps.py

Parse a GraphViz DOT file of intra-crate dependencies and aggregate dependency counts
at each prefix level of module paths. Outputs a CSV sorted by ascending dependency count.

Usage:
    ./roadmap/analyze_prefix_deps.py ./roadmap/deps.dot --skip-levels 2 --csv=./roadmap/prefix_roadmap.csv
"""
import sys
import re
import csv
import argparse
from collections import defaultdict


def parse_dot(path):
    """
    Read a GraphViz DOT file, yield (from_node, to_node) tuples.
    Assumes nodes are quoted strings:  "foo" -> "bar";
    """
    edge_re = re.compile(r'"\s*([^\"]+)\s*"\s*->\s*"\s*([^\"]+)\s*"')
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            m = edge_re.search(line)
            if m:
                yield m.group(1), m.group(2)


def build_dependency_map(edges):
    """
    edges: iterable of (src, tgt)
    returns: dict mapping src -> set of tgts, ensuring every node appears
    """
    deps = defaultdict(set)
    all_nodes = set()
    for src, tgt in edges:
        all_nodes.add(src)
        all_nodes.add(tgt)
        deps[src].add(tgt)
    for node in all_nodes:
        deps.setdefault(node, set())
    return deps


def get_prefixes(path, skip):
    """
    Given a module path like 'a::b::c::d', skip the first `skip` segments,
    and return a list of prefix strings:
      ['b', 'b::c', 'b::c::d'] if skip=1
    """
    segments = path.split("::")[skip:]
    prefixes = []
    for i in range(len(segments)):
        prefixes.append("::".join(segments[: i + 1]))
    return prefixes


def infer_file_path(prefix):
    """
    Convert a prefix like 'backend::simd::cm31::PackedCM31' to a file path
    'backend/simd/cm31/PackedCM31.rs'.
    """
    return prefix.replace("::", "/") + ".rs"


def aggregate_prefix_deps(deps_map, skip):
    """
    Build a map of prefix -> set of dependencies for that group of modules.
    """
    prefix_deps = defaultdict(set)
    for module, deps in deps_map.items():
        for prefix in get_prefixes(module, skip):
            prefix_deps[prefix].update(deps)
    return prefix_deps


def main():
    parser = argparse.ArgumentParser(
        description="Aggregate dependency counts at each prefix level"
    )
    parser.add_argument(
        'dot_path',
        help='Path to the deps.dot file'
    )
    parser.add_argument(
        '--skip-levels',
        type=int,
        default=2,
        help='Number of leading segments to skip (default: 2)'
    )
    parser.add_argument(
        '--csv',
        dest='csv_out',
        required=True,
        help='Output CSV file for the prefix roadmap'
    )

    args = parser.parse_args()

    edges = list(parse_dot(args.dot_path))
    deps_map = build_dependency_map(edges)
    prefix_deps = aggregate_prefix_deps(deps_map, args.skip_levels)

    # Sort prefixes by ascending number of dependencies
    sorted_prefixes = sorted(
        prefix_deps.items(), key=lambda kv: len(kv[1])
    )

    # Write CSV with prefix, inferred file path, dependency count, and full dependency list
    with open(args.csv_out, 'w', newline='', encoding='utf-8') as csvf:
        writer = csv.writer(csvf)
        writer.writerow(['prefix', 'file', 'dependency_count', 'dependencies'])
        for prefix, deps in sorted_prefixes:
            file_path = infer_file_path(prefix)
            writer.writerow([prefix, file_path, len(deps), ";".join(sorted(deps))])

    print(f"Wrote prefix roadmap with file paths to {args.csv_out}")


if __name__ == '__main__':
    main()
