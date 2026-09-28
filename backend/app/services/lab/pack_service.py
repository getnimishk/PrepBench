# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Lakehouse Lab scenario packs (design §4.1).

A pack is a folder under `app/data/lab_packs/<id>/`: `manifest.json`,
`scenario.md`, `dataset.json` and optionally `factory.json`. Packs are read-only
content served through the API; nothing about them is stored in the database, so
a new pack version is a file change reviewed like code.

A pack that doesn't load or validate is logged and skipped. It never stops the
app from starting -- the same spirit as the migrations and the content packs.
A future licensing model would hook in at `list_packs()`; station code never
checks entitlement.
"""
import json
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional

from app.core.logging_config import logger
from app.schemas.lab import DatasetSpec, LabPack, PackManifest

PACKS_DIR = Path(__file__).resolve().parents[2] / "data" / "lab_packs"


def _load_one(folder: Path) -> LabPack:
    manifest = PackManifest.model_validate(json.loads((folder / "manifest.json").read_text(encoding="utf-8")))
    if manifest.id != folder.name:
        raise ValueError(f"manifest id {manifest.id!r} doesn't match its folder {folder.name!r}")
    dataset = DatasetSpec.model_validate(json.loads((folder / "dataset.json").read_text(encoding="utf-8")))
    factory_file = folder / "factory.json"
    factory = json.loads(factory_file.read_text(encoding="utf-8")) if factory_file.exists() else {}
    return LabPack(
        manifest=manifest,
        scenario_md=(folder / "scenario.md").read_text(encoding="utf-8"),
        dataset=dataset,
        factory=factory,
    )


def _load_from_disk(base_dir: Path) -> Dict[str, LabPack]:
    packs: Dict[str, LabPack] = {}
    if not base_dir.exists():
        return packs
    for folder in sorted(p for p in base_dir.iterdir() if p.is_dir() and not p.name.startswith(("_", "."))):
        try:
            pack = _load_one(folder)
        except Exception as exc:
            logger.warning(f"Skipping lab pack {folder.name!r}: {exc}")
            continue
        packs[pack.manifest.id] = pack
    return packs


@lru_cache(maxsize=None)
def _load_cached(base_dir_str: str) -> Dict[str, LabPack]:
    return _load_from_disk(Path(base_dir_str))


def load_packs(base_dir: Optional[Path] = None) -> Dict[str, LabPack]:
    """Every valid pack, by id, cached per directory (tests pass their own)."""
    return _load_cached(str(base_dir or PACKS_DIR))


def clear_cache() -> None:
    _load_cached.cache_clear()


def list_packs(base_dir: Optional[Path] = None) -> List[LabPack]:
    packs = load_packs(base_dir)
    return [packs[k] for k in sorted(packs)]


def get_pack(pack_id: str, base_dir: Optional[Path] = None) -> Optional[LabPack]:
    return load_packs(base_dir).get(pack_id)
