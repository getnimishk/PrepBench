# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
The rule every built-in content seeder follows, in one place.

Seeding runs on every startup, so it needs an answer to "should this item be
created?" that is right in all four situations that actually occur:

  fresh install            -> create everything
  restart, nothing changed -> create nothing
  upgrade adding built-ins -> create only the new ones
  user deleted a built-in  -> leave it deleted

The first three are what a naive "seed only when the table is empty" check gets
wrong: it freezes the bank at whatever shipped the day the database was made.
The fourth is what matching against the bank's current contents gets wrong: the
deleted item is missing, so it is created again, and deleting a built-in becomes
something the app quietly undoes.

Both are answered by recording what has been *offered*, separately from what is
currently *present*.
"""
from typing import Callable, List
from sqlalchemy.orm import Session

from app.repositories.seeded_content_repository import SeededContentRepository


def seed_missing_content(
    db: Session,
    *,
    namespace: str,
    keys: List[str],
    bank_is_empty: bool,
    create: Callable[[str], None],
) -> int:
    """Create every built-in this install has never been offered, and only those.

    `keys` is the built-in list's identities in order, `create(key)` creates the
    one item that key names, and `bank_is_empty` says whether the content table
    this namespace covers currently holds anything.

    Returns how many items were created.
    """
    repo = SeededContentRepository(db)
    already_offered = repo.get_keys(namespace)

    if not already_offered and not bank_is_empty:
        # A database created before this ledger existed holds content but no
        # record of it, and there is no way to tell "the user deleted this one"
        # from "this one was never shipped". Assume the safer reading: treat
        # everything currently in the built-in list as already offered. Nothing
        # is created on this one boot -- correctly, since these built-ins are
        # exactly what such an install was seeded with -- and from here on only
        # genuinely new ones arrive.
        repo.mark_seeded(namespace, keys)
        return 0

    created = 0
    for key in keys:
        if key in already_offered:
            continue
        create(key)
        # Recorded one at a time rather than in a batch at the end, so a crash
        # part-way through leaves the ledger agreeing with the bank. Batched,
        # the next boot would find an empty ledger beside a non-empty bank,
        # take the branch above, and permanently skip whatever had not been
        # created yet.
        repo.mark_seeded(namespace, [key])
        created += 1
    return created
