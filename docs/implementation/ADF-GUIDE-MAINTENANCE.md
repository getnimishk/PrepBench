# ADF Study Guide: maintenance note

Which claims in the guide are most sensitive to changes in the Microsoft documentation, and what to re-read before a release. The
limits register in Chapter 21 lists the figures with their sources and last-read dates.

## Re-read before every release

| Claim | Chapter | Page to re-read |
| --- | --- | --- |
| Legacy trusted service retirement date, and which scenarios are affected | 14 | Modern mode for trusted service firewall bypass |
| Tumbling window minimum interval (5 minutes, and the 15 on the limits page) | 3, 5, 21 | Create a tumbling window trigger; Azure subscription and service limits |
| The default checkpoint key for change data capture | 10 | Change data capture; Data Flow activity |
| Which data flow transformations Fabric supports, and in which experience | 8, 11, 20 | Mapping data flow transforms in Dataflow Gen2; the Assert and Alter Row pages |
| What Fabric still lacks (SSIS, managed virtual networks), activity parity | 1, 20 | Differences between ADF and Fabric Data Factory |
| Which copies resume, and the self-hosted runtime version needed | 6, 13 | Copy activity overview |
| ForEach batch count, Lookup caps, payload size, concurrency ceilings | 3, 17, 21 | ForEach activity; Lookup activity; service limits |
| Connector versions and removal dates | 6 | Connector release stages and timelines |
| Whether stopping triggers is needed for a deployment | 18 | CI/CD overview; Azure Pipelines release guide |
| Customer-managed key rules (empty factory, no removal) | 14 | Encrypt Azure Data Factory with customer-managed keys |
| Regional failover rules | 13 | Reliability in Azure Data Factory |

## Known disagreements between pages

Recorded in the chapters: the checkpoint key (Chapter 10), the trusted services list and the Azure IR IP ranges (Chapter 14), the
tumbling window interval (Chapters 3 and 5), and what the service stores (Chapter 14). Recheck each when its pages are updated.

## The lab's planning ranges

The Behaviour Lab allows parallel copies from 1 to 32. That range is a planning range and is not stated as a limit in the documentation
(Chapter 17). The pinned phrase and its tests stay; the wording says so.
