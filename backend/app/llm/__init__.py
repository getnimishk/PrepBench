# PrepBench - Copyright (c) 2026 Nimish Kanungo
# Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
# Commercial use requires a separate licence from the copyright holder.

"""
Vendor-agnostic LLM layer.

Feature services ask this package for a *task* ("grade a system design
answer") and never for a vendor. Which provider, which model, which endpoint
and which timeout are resolved here, from user configuration in the database
falling back to profile defaults -- so adding a vendor is a JSON entry rather
than an edit to five services.
"""
