---
id: networking
title: Azure networking for Databricks
summary: The three connections you secure separately, VNet injection and subnet sizing, secure cluster connectivity and egress, the three kinds of Private Link, and how serverless reaches firewalled storage.
sources: §20, §17
---

## Roadmap alignment
**Roadmap topics covered in this chapter:**

- **Topic 78 — Three Network Connections** (Full)
  - *Relevant sections:* Three connections, secured separately
  - *Learning evidence:* Draw the three connections for one workspace and name a control for each.
- **Topic 79 — Serverless vs Hybrid Workspaces** (Full)
  - *Relevant sections:* Serverless and hybrid workspaces
  - *Learning evidence:* Choose a workspace type for two teams with different needs and justify it.
- **Topic 80 — VNet Injection and Subnet Sizing** (Full)
  - *Relevant sections:* VNet injection; Sizing the subnets
  - *Learning evidence:* Size a VNet and its two subnets for a 100-node peak and show the arithmetic.
- **Topic 81 — Subnet Delegation and NSG Rules** (Full)
  - *Relevant sections:* Delegation and the managed NSG rules
  - *Learning evidence:* Explain which outbound ports a VNet-injected workspace needs and what each one is for.
- **Topic 82 — Secure Cluster Connectivity and Egress** (Full)
  - *Relevant sections:* Secure cluster connectivity and egress
  - *Learning evidence:* Explain why a new workspace's clusters can't reach the internet without a NAT gateway, and how to fix it.
- **Topic 83 — Private Link: Three Kinds** (Full)
  - *Relevant sections:* Private Link: three kinds
  - *Learning evidence:* Pick the Private Link setup for a bank that forbids any public path, and list the endpoints it needs.
- **Topic 84 — Browser Authentication and the Transit VNet** (Full)
  - *Relevant sections:* Browser sign-in over Private Link, and the transit VNet
  - *Learning evidence:* Explain why deleting one workspace could break SSO for every private workspace in the region.
- **Topic 85 — Serverless Connectivity and Storage Firewalls** (Full)
  - *Relevant sections:* Serverless compute reaching your resources
  - *Learning evidence:* Diagnose a serverless job getting 403 Forbidden from a firewalled ADLS account and give the fix.

## Three connections, secured separately
Everything in this chapter is Azure-specific, and none of it can be run in Free Edition: **read, not run**.

Databricks networking has three connection points, each secured on its own:

1. **Users and applications → Databricks** (inbound): front-end Private Link, context-based ingress control, IP access lists for workspaces and for the account console.
2. **Control plane ↔ classic compute plane**: VNet injection, secure cluster connectivity, back-end Private Link, user-defined routes, peering, VPN or ExpressRoute to on-premises.
3. **Serverless compute plane → your resources**: network connectivity configurations (NCCs), private endpoints, serverless egress control, storage firewalls.

Traffic between the classic compute plane and the control plane crosses the **Microsoft network backbone, not the public internet**, even without secure cluster connectivity; control plane to serverless traffic stays on the backbone too. Azure Databricks charges for networking when serverless workloads connect to your resources and when some services send data back across regions.

![The three network connections of an Azure Databricks workspace: users to the control plane, the control plane to classic compute in your VNet through the secure cluster connectivity relay, and serverless compute to your storage through an NCC](/assets/content/packs/databricks/network-connections.svg)

## Serverless and hybrid workspaces
- A **serverless workspace** comes with serverless compute and **default storage**; you can still connect your own storage. Microsoft recommends it for most uses: dashboards, Apps, notebooks and SQL warehouses, serverless pipelines, AI features.
- A **hybrid (classic) workspace** provisions compute and storage in **your** subscription; serverless is still available in it. It fits porting RDD code, Scala or R as the main language, streams that need **time-based trigger intervals** (serverless allows only `availableNow`), and reaching on-premises or private databases directly through Lakeflow Connect.

Creating a workspace needs a subscription that isn't a Free Trial and the **Contributor or Owner** role at subscription level (or a custom role with the listed permissions). The standard deployment methods are the Azure portal and Terraform; ARM, Bicep, the Azure CLI and PowerShell also work.

## VNet injection
**VNet injection** deploys the classic compute plane into **your** VNet, so you get private connectivity to Azure services (service or private endpoints), on-premises access through user-defined routes, traffic inspection by network appliances, custom DNS and extra egress rules. Requirements:

- the VNet is in the **same region and subscription** as the workspace;
- VNet address space between **/16 and /24**;
- **two dedicated subnets**: a **container** subnet (also called private) and a **host** subnet (also called public), each **/26 or larger** recommended (down to /28 is possible, not recommended), ideally the same size;
- subnets **can't be shared** between workspaces or hold other resources;
- subnet ranges **can't be changed after deployment**;
- the workspace creator needs **Network Contributor** on the VNet (or the subnet join and write permissions).

## Sizing the subnets
Each cluster node takes **two IP addresses**: one in the host subnet and one in the container subnet. Azure reserves **five addresses in every subnet**. So for a peak of 100 nodes across all clusters, each subnet needs at least 100 + 5 = 105 addresses: a /26 (64 addresses) is too small, a **/25 (128 addresses)** is the smallest that fits. Two /25 subnets need 256 addresses of the VNet, so a /24 VNet is exactly full; choose a larger VNet (a /23 or more) if you want room for growth or a second workspace. A smaller VNet runs out of addresses sooner, and widening a deployed workspace's subnets means a network update (Public Preview) or a request to the account team.

## Delegation and the managed NSG rules
Both subnets are **delegated** to `Microsoft.Databricks/workspaces`, and Databricks **manages the network security group rules** on them: don't modify or delete them (one NSG per workspace is recommended). The outbound rules are in the table below.

Two inbound rules, ports 22 and 5557 from the `AzureDatabricks` tag, exist **only if secure cluster connectivity is off**. The managed resource group Databricks creates can't be modified.

| Destination (service tag) | Port | What for |
|---|---|---|
| AzureDatabricks | 443 | Databricks infrastructure, cloud data sources, libraries |
| AzureDatabricks | 3306 | The metastore |
| AzureDatabricks | 8443 | Compute calling the control plane API |
| AzureDatabricks | 8444 | Unity Catalog logging and lineage |
| Storage | 443 | Azure Storage |
| EventHub | 9093 | Event Hubs |

## Secure cluster connectivity and egress
With **secure cluster connectivity** (SCC, also called No Public IP), the VNet has **no open inbound ports** and cluster nodes have **no public IP addresses**. Each cluster opens an **outbound** connection on 443 to the control plane's **SCC relay**, and administration requests come back through that tunnel. SCC is **on by default** for new workspaces, and Microsoft says a future release will make it mandatory for classic workspaces. Adding it to an existing workspace needs VNet injection and stopping all classic compute first.

Egress (outbound internet access):

- With the default managed VNet, Databricks creates a **NAT gateway** in the managed resource group (extra cost).
- With VNet injection, Databricks recommends an **Azure NAT gateway on both subnets** for a **stable egress public IP**, which external systems can allow-list. **Don't use an egress load balancer** with SCC (port exhaustion risk).
- **After 31 March 2026, new Azure VNets have no default outbound internet access.** So a workspace deployed into a new VNet after that date has clusters that can't reach public endpoints (PyPI, external APIs) until you add an explicit method such as a NAT gateway. Existing workspaces aren't affected.
- Firewall rules should allow-list the SCC relay **domain names**, not IP addresses, which change.

## Private Link: three kinds
Azure Private Link comes in three kinds, compared in the table at the end of this section. The three can be used separately or together. A bank that forbids any public path needs **complete private isolation**: all three kinds, **public network access disabled** on the workspace, the required NSG rules set to `NoAzureDatabricksRules`, and every endpoint: front-end `databricks_ui_api`, `browser_authentication`, the back-end endpoint, and NCC private endpoints for serverless.

| Kind | Secures | Prerequisites | Endpoints |
|---|---|---|---|
| Inbound (front-end) | Users to the web app, REST API, Apps, Databricks Connect | Premium plan, VNet injection, SCC | databricks_ui_api, browser_authentication (optionally general_access) |
| Outbound (serverless) | Serverless compute to your Azure resources | Premium plan | Private endpoint rules in an NCC |
| Classic (back-end) | Classic compute to the control plane (REST API and SCC relay) | Premium plan, VNet injection, SCC | databricks_ui_api |

## Browser sign-in over Private Link, and the transit VNet
Browser single sign-on through Microsoft Entra ID doesn't work over a private connection without a **`browser_authentication`** endpoint. There is **one per region and private DNS zone**, and it serves every workspace there.

So Databricks recommends a dedicated **"private web auth workspace"** per production region whose only job is to host that endpoint, with public access disabled. If the workspace hosting the endpoint is deleted, **web login fails for every workspace that depends on it**. That is how deleting one workspace can break SSO for every private workspace in the region.

Private connectivity uses two VNets: a **transit VNet** (the hub for user connectivity: inbound private endpoints and the browser-auth workspace) and the **workspace VNet** (workspace subnets plus a subnet for the classic private endpoint). Suggested sizes: transit private-endpoint subnet /26 to /25, browser-auth workspace /28 or /27, classic private-endpoint subnet /27. The `general_access` endpoint can serve the account console and workspaces in **different regions**; the others are region-specific.

## Serverless compute reaching your resources
Serverless compute runs in Databricks' account, so it reaches your resources differently:

- A **network connectivity configuration (NCC)** is an account-level, regional object, created by account admins, that manages private endpoints for serverless. An NCC can serve up to **50 workspaces** in a region; up to **20 NCCs per region** per account; **100 private endpoints per region**. Adding a private endpoint creates a request that the resource's owner must **accept**.
- Without a private endpoint, serverless reaches Azure storage through **service endpoints** and other resources through **NAT IPs**.
- **The 403 trap:** storage accounts that allow-listed the serverless **subnet IDs can no longer be reached**; serverless gets **403 Forbidden**. The fix: put the storage account in a **network security perimeter** and allow the **`AzureDatabricksServerless`** service tag (optionally scoped to the region), or give serverless a private endpoint through an NCC.
- A storage firewall also affects **classic** compute, which must be allowed separately.

## Design trade-off
Every layer of private networking removes a public path and adds cost and moving parts: more endpoints, DNS zones, a browser-auth workspace to protect, NAT gateways, NCCs. Match it to the data's sensitivity and the organisation's rules: VNet injection plus SCC is a common baseline; full private isolation is for regulated workloads and needs an owner who understands every endpoint.

## Interview takeaway
"I think about three connections: users to the workspace, the control plane to classic compute, and serverless to our data. Classic compute goes into our VNet with VNet injection, two dedicated subnets sized at two IPs per node plus Azure's five reserved, and secure cluster connectivity so there are no public IPs, only an outbound relay; since March 2026 new VNets need a NAT gateway for egress. Private Link comes in three kinds, front-end, back-end and serverless through an NCC, with a protected browser-auth workspace per region. And serverless reaches firewalled storage through a network security perimeter with the AzureDatabricksServerless tag or a private endpoint; allow-listing subnet IDs now gets a 403."
