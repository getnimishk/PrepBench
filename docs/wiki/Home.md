# PrepBench Wiki

Reference documentation for people working *on* PrepBench, or pushing it past the defaults.

If you just want to run it, the [README](https://github.com/getnimishk/PrepBench#quick-start) covers installation and the five-minute tour. This wiki holds the material that would bloat a README: how the layers fit together, why certain things are built the way they are, and how to extend them.

## Pages

| Page | What it covers |
|---|---|
| **[Architecture](Architecture)** | Backend layering, the request path, the 19 tables, why there is no Alembic, and what CI actually enforces |
| **[Chart Sandbox](Chart-Sandbox)** | The executable delivery model, the coupling ledger, the 27 views, and the guided learning layer |
| **[AI Providers](AI-Providers)** | The provider gateway, task-level routing, local model setup, and how keys are stored |
| **[Importing Content](Importing-Content)** | Question formats, roadmap column detection, and the pre-import audit |
| **[Development Guide](Development-Guide)** | Environment setup, the test suites, conventions, and how to add a chart, endpoint, or provider |
| **[Troubleshooting](Troubleshooting)** | The failures people actually hit |

## The three rules this codebase holds to

Most of the design decisions documented here follow from these. They come up often enough to state once, up front.

**1. Never fabricate a number.** If a score cannot be computed, the UI says so. Grading with no provider configured returns *"Not Graded"*, not `0%`. A percentage with no denominator renders as `—`. An invented grade is worse than a missing one, because the learner cannot tell the difference.

**2. Never present a modelling choice as a fact.** In the Chart Sandbox this is enforced structurally: every relationship between models is typed `arithmetic | assumption | convention`, and assumptions render on-chart as assumptions. *"High WIP raises defect injection"* stated as fact is a claim you cannot defend when someone asks for the evidence.

**3. The machine boundary is real.** No telemetry, no analytics SDK, no account system. The only outbound path is a cloud AI provider you configure yourself, and PrepBench will not download or launch a model on your behalf.

## License

[PolyForm Noncommercial License 1.0.0](https://github.com/getnimishk/PrepBench/blob/main/LICENSE). Free for personal study, hobby projects, research, and use by schools, charities and public institutions. **Commercial use is not permitted** — ask if you want it.
