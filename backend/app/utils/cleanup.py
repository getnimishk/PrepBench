# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
cleanup.py

Utility module for safely identifying and cleaning unnecessary/temporary files,
build caches, and log files within a specified directory target.
"""

import os
import shutil
from pathlib import Path
from typing import Any, Dict, List, Set, Union
from app.core.logging_config import logger

# Constants defining patterns for cleanup
TARGET_CACHE_DIRS: Set[str] = {
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
}

TARGET_FILE_EXTENSIONS: Set[str] = {
    ".log",
    ".tmp",
    ".temp",
    ".bak",
    ".swp",
}


def clean_unnecessary_files(
    target_directory: Union[str, Path], dry_run: bool = True
) -> Dict[str, Any]:
    """
    Safely delete unnecessary/temporary files, build caches, and log files.

    Parameters:
        target_directory (Union[str, Path]): Absolute directory path to inspect and clean.
        dry_run (bool): If True (default), lists items slated for deletion without removing them.

    Returns:
        Dict[str, Any]: Summary dictionary containing files/dirs slated or removed,
                        items skipped due to errors, and operation status.
    """
    target_path = Path(target_directory).resolve()

    if not target_path.exists():
        raise FileNotFoundError(f"Specified target directory does not exist: {target_path}")

    if not target_path.is_absolute():
        target_path = target_path.resolve()

    slated_files: List[Path] = []
    slated_dirs: List[Path] = []
    deleted_files: List[str] = []
    deleted_dirs: List[str] = []
    skipped_items: List[Dict[str, str]] = []

    logger.info(f"Scanning target directory for cleanup: {target_path} (dry_run={dry_run})")

    # Traverse directory tree to identify cache directories and temporary/log files
    for root, dirs, files in os.walk(target_path, topdown=True):
        root_path = Path(root)

        # 1. Identify build cache directories
        cache_match_dirs = [d for d in dirs if d in TARGET_CACHE_DIRS]
        for c_dir in cache_match_dirs:
            full_cache_path = root_path / c_dir
            slated_dirs.append(full_cache_path)

        # Prune cache directories from further sub-tree traversal
        dirs[:] = [d for d in dirs if d not in TARGET_CACHE_DIRS]

        # 2. Identify temporary and log files
        temp_log_files = [
            root_path / f
            for f in files
            if Path(f).suffix.lower() in TARGET_FILE_EXTENSIONS or f.startswith("~")
        ]
        slated_files.extend(temp_log_files)

    # Perform actual deletion if dry_run is False
    if not dry_run:
        # Delete temporary and log files
        for file_path in slated_files:
            try:
                if file_path.exists():
                    file_path.unlink()
                    deleted_files.append(str(file_path))
                    logger.info(f"Deleted file: {file_path}")
            except (PermissionError, FileNotFoundError, OSError) as exc:
                skipped_items.append({"path": str(file_path), "reason": str(exc)})
                logger.warning(f"Skipped file deletion ({file_path}): {exc}")

        # Delete cache directories
        for dir_path in slated_dirs:
            try:
                if dir_path.exists():
                    shutil.rmtree(dir_path)
                    deleted_dirs.append(str(dir_path))
                    logger.info(f"Deleted cache directory: {dir_path}")
            except (PermissionError, FileNotFoundError, OSError) as exc:
                skipped_items.append({"path": str(dir_path), "reason": str(exc)})
                logger.warning(f"Skipped directory deletion ({dir_path}): {exc}")

    summary: Dict[str, Any] = {
        "target_directory": str(target_path),
        "dry_run": dry_run,
        "slated_files_count": len(slated_files),
        "slated_dirs_count": len(slated_dirs),
        "slated_files": [str(p) for p in slated_files],
        "slated_dirs": [str(p) for p in slated_dirs],
        "deleted_files_count": len(deleted_files),
        "deleted_dirs_count": len(deleted_dirs),
        "deleted_files": deleted_files,
        "deleted_dirs": deleted_dirs,
        "skipped_items_count": len(skipped_items),
        "skipped_items": skipped_items,
    }

    return summary
