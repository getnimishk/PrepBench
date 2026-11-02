---
id: cicd
title: Identity, secrets and CI/CD
summary: Service principals for automation, secret scopes and Key Vault, Git folders, and Declarative Automation Bundles that deploy code and jobs together to each environment.
sources: §14, §16, §0
---
## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 88 — Identity and Secrets** (Full)
  - *Relevant sections:* Who runs production: service principals; Secrets
  - *Learning evidence:* Explain why a production job should run as a service principal and where its credentials live.
- **Topic 89 — Git Folders** (Full)
  - *Relevant sections:* Git folders
  - *Learning evidence:* Clone a repository into a Git folder, change a notebook on a branch and commit it.
- **Topic 90 — Declarative Automation Bundles** (Full)
  - *Relevant sections:* Declarative Automation Bundles; Variables and targets
  - *Learning evidence:* Deploy one job to dev and prod targets with a different schema name per target.

## Who runs production: service principals
Databricks principals are users, groups and **service principals**. A service principal is an identity for automation, with API-only access, granted privileges like a user. Running jobs **as a service principal** keeps them working when the person who built them leaves, and limits what production can do to what that identity is granted.

On Azure there are two kinds: **Azure Databricks-managed** service principals (Databricks OAuth or personal access tokens; Databricks recommends these for automation inside Databricks) and **Microsoft Entra ID-managed** ones (Databricks OAuth or Entra ID tokens), for automation that also touches other Azure services.

## Secrets
A **secret scope** is a named collection of secrets, stored encrypted by Databricks, with permissions set per scope. Databricks recommends scopes per role or application, not per person.

- Read a secret with `dbutils.secrets.get(scope, key)` or SQL's `secret()` function. Values printed in notebook output are shown as `[REDACTED]` where possible, but anyone allowed to read a secret can still expose it, so grant carefully.
- **Azure:** an **Azure Key Vault-backed** scope is a **read-only** view of a Key Vault: you manage the secrets in Azure. Creating one needs the vault's access-policy permission model (not Azure RBAC) and Contributor or Owner on the vault.
- For cloud storage, don't keep keys in secrets at all: use Unity Catalog storage credentials and external locations (chapter 9).

## Git folders
**Git folders** (formerly Repos) are a visual Git client and API inside the workspace: clone a repository, create and switch branches, commit and push, pull, resolve conflicts. Notebooks are stored in the repository as source files, so they diff and review like code. In CI/CD, automate Git folder updates with a service principal.

## Declarative Automation Bundles
**Declarative Automation Bundles** (formerly Databricks Asset Bundles) are infrastructure as code for Databricks projects. A bundle is YAML, a `databricks.yml` plus resource files, describing jobs, pipelines, dashboards and other resources, deployed **together with their source files** to a **target** environment (dev, test, prod).

They are a feature of the **Databricks CLI** (v0.218.0 and above):

```
databricks bundle init                 # start from a template
databricks bundle validate             # check the configuration
databricks bundle deploy -t dev        # deploy code and resources to a target
databricks bundle run -t dev my_job    # run a deployed job
```

Databricks recommends OAuth user-to-machine authentication for the CLI when you run it yourself.

## Variables and targets
- **Variables** are declared under `variables` (with an optional `default`) and overridden per target under `targets`, or at run time with `--var="name=value"`, an environment variable **`BUNDLE_VAR_<name>`**, or a `variable-overrides.json` file.
- **Substitutions** such as `${bundle.target}` and `${workspace.current_user.userName}` make names environment-specific:

```
variables:
  schema:
    default: sales_dev
targets:
  dev:
    default: true
  prod:
    variables:
      schema: sales_prod
resources:
  jobs:
    nightly:
      name: nightly-${bundle.target}
```

- **Secrets never go in `databricks.yml`**: a CI system passes them as `BUNDLE_VAR_` environment variables.

## Try it in Free Edition
1. Create a Git folder from a repository you own (a personal GitHub repository is fine), create a branch, add a notebook, commit and push.
2. Bundles run from the Databricks CLI on your machine against your workspace: install the CLI, authenticate with OAuth to your Free Edition workspace, run `databricks bundle init` with the default Python template, then `validate` and `deploy -t dev`. **What you should see:** the template's job appears in your workspace under a dev name. If your setup can't run the CLI, this step is read, not run.

## Design trade-off
Bundles make every environment reproducible from Git, with reviews and rollbacks, at the cost of a deploy step and YAML to maintain; editing jobs by hand in the UI is faster today and unrepeatable tomorrow. For anything that runs in production, bundles (or another infrastructure-as-code tool) and a service principal are the baseline.

## Interview takeaway
"Production runs as a service principal, so it doesn't depend on a person and only has the privileges we grant it. Secrets live in secret scopes, on Azure usually Key Vault-backed and read-only from Databricks, and storage access uses Unity Catalog credentials, not keys. Code lives in Git through Git folders, and Declarative Automation Bundles deploy code and jobs together to dev, test and prod targets, with variables per target and secrets passed as BUNDLE_VAR environment variables, never in the YAML."
