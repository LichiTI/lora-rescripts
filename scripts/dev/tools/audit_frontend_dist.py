#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable


ASSET_PREFIX = "/assets/"
ROUTE_CHUNK_RE = re.compile(r"^(?P<route>.+\.html)\.(?P<hash>[0-9a-f]+)\.js$")
ASSET_REF_RE = re.compile(r"(?:^|[(/\"'=])(?:\./|/assets/|assets/)(?P<asset>[A-Za-z0-9._-]+\.(?:js|css|svg|webp))")
TEXT_ASSET_SUFFIXES = {".js", ".css"}


class AssetRefParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.refs: dict[str, list[str]] = defaultdict(list)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = dict(attrs)

        if tag == "link":
            rel = (attr_map.get("rel") or "").strip()
            href = attr_map.get("href") or ""
            if href.startswith(ASSET_PREFIX):
                self.refs[f"link:{rel or 'unknown'}"].append(href.removeprefix(ASSET_PREFIX))
        elif tag == "script":
            src = attr_map.get("src") or ""
            if src.startswith(ASSET_PREFIX):
                self.refs["script"].append(src.removeprefix(ASSET_PREFIX))


def parse_html_assets(html_path: Path) -> dict[str, list[str]]:
    parser = AssetRefParser()
    parser.feed(html_path.read_text(encoding="utf-8"))
    return {key: sorted(values) for key, values in parser.refs.items()}


def route_variant_map(asset_names: list[str]) -> dict[str, list[str]]:
    grouped: dict[str, list[str]] = defaultdict(list)
    for name in asset_names:
        match = ROUTE_CHUNK_RE.match(name)
        if match:
            grouped[match.group("route")].append(name)
    return {route: sorted(names) for route, names in grouped.items()}


def parse_asset_refs(asset_path: Path) -> list[str]:
    if asset_path.suffix not in TEXT_ASSET_SUFFIXES:
        return []

    content = asset_path.read_text(encoding="utf-8")
    return sorted({match.group("asset") for match in ASSET_REF_RE.finditer(content)})


def walk_reachable_assets(roots: Iterable[str], asset_graph: dict[str, list[str]]) -> set[str]:
    pending = list(roots)
    visited: set[str] = set()

    while pending:
        current = pending.pop()
        if current in visited:
            continue
        visited.add(current)
        pending.extend(asset_graph.get(current, []))

    return visited


def build_report(dist_dir: Path) -> dict:
    html_files = sorted(dist_dir.rglob("*.html"))
    asset_files = sorted(
        path.relative_to(dist_dir / "assets").as_posix()
        for path in (dist_dir / "assets").glob("*")
        if path.is_file()
    )

    html_refs: dict[str, dict[str, list[str]]] = {}
    reference_counter: Counter[str] = Counter()
    preload_conflicts: dict[str, dict[str, list[str]]] = {}
    prefetch_conflicts: dict[str, dict[str, list[str]]] = {}
    asset_graph: dict[str, list[str]] = {}

    for html_path in html_files:
        rel_html = html_path.relative_to(dist_dir).as_posix()
        refs = parse_html_assets(html_path)
        html_refs[rel_html] = refs

        for values in refs.values():
            reference_counter.update(values)

        for ref_key, target in (("link:modulepreload", preload_conflicts), ("link:prefetch", prefetch_conflicts)):
            route_groups = route_variant_map(refs.get(ref_key, []))
            duplicates = {route: names for route, names in route_groups.items() if len(names) > 1}
            if duplicates:
                target[rel_html] = duplicates

    for asset_name in asset_files:
        asset_graph[asset_name] = parse_asset_refs(dist_dir / "assets" / asset_name)

    reachable_assets = walk_reachable_assets(reference_counter.keys(), asset_graph)
    unreachable_assets = sorted(set(asset_files) - reachable_assets)
    only_prefetch_assets = sorted(
        asset
        for asset in asset_files
        if reference_counter[asset] > 0
        and not any(
            asset in html_refs[html].get("link:modulepreload", []) or asset in html_refs[html].get("script", [])
            for html in html_refs
        )
    )

    route_variants = {
        route: names for route, names in route_variant_map(asset_files).items() if len(names) > 1
    }

    return {
        "dist_dir": dist_dir.as_posix(),
        "html_files": [path.relative_to(dist_dir).as_posix() for path in html_files],
        "asset_count": len(asset_files),
        "asset_files": asset_files,
        "html_refs": html_refs,
        "route_variants": route_variants,
        "modulepreload_conflicts": preload_conflicts,
        "prefetch_conflicts": prefetch_conflicts,
        "reachable_assets": sorted(reachable_assets),
        "unreachable_assets": unreachable_assets,
        "only_prefetch_assets": only_prefetch_assets,
        "asset_graph": asset_graph,
        "reference_counts": dict(sorted(reference_counter.items())),
    }


def print_summary(report: dict) -> None:
    print(f"dist: {report['dist_dir']}")
    print(f"html files: {len(report['html_files'])}")
    print(f"assets: {report['asset_count']}")
    print(f"route chunk variants: {len(report['route_variants'])}")
    print(f"modulepreload conflicts: {len(report['modulepreload_conflicts'])}")
    print(f"prefetch conflicts: {len(report['prefetch_conflicts'])}")
    print(f"unreachable assets: {len(report['unreachable_assets'])}")
    print(f"only-prefetch assets: {len(report['only_prefetch_assets'])}")

    if report["modulepreload_conflicts"]:
        print("\nModulepreload conflicts:")
        for html_name, conflicts in report["modulepreload_conflicts"].items():
            print(f"- {html_name}")
            for route, assets in sorted(conflicts.items()):
                print(f"  {route}: {', '.join(assets)}")

    if report["prefetch_conflicts"]:
        print("\nPrefetch conflicts:")
        for html_name, conflicts in report["prefetch_conflicts"].items():
            print(f"- {html_name}")
            for route, assets in sorted(conflicts.items()):
                print(f"  {route}: {', '.join(assets)}")

    if report["unreachable_assets"]:
        print("\nUnreachable assets:")
        for asset in report["unreachable_assets"]:
            print(f"- {asset}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit VuePress dist HTML and asset references.")
    parser.add_argument(
        "dist_dir",
        nargs="?",
        default="frontend/dist",
        help="Path to the dist directory to audit.",
    )
    parser.add_argument("--json", action="store_true", help="Print the full report as JSON.")
    args = parser.parse_args()

    dist_dir = Path(args.dist_dir).resolve()
    report = build_report(dist_dir)

    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        print_summary(report)


if __name__ == "__main__":
    main()
