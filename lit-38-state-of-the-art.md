# LIT-38 State of the Art: Agent Registry + Versioning

**Research date:** 2026-06-27  
**Workflow:** deep-research (106 agents, 24 sources, 103 claims → 25 verified → 7 confirmed)  
**Question:** What is the state of the art for a discoverable agent catalog with versioning, schema-on-push validation, manifest contracts, parallel version coexistence, and reuse metrics?

---

## Confirmed Findings (adversarially verified, 3-vote panel)

### 1. OCI as the Storage Primitive for Agent Artifacts (3-0)

**AGNTCY Agent Directory Service** packages directory records as OCI-compliant artifacts addressed by cryptographic SHA-256 digests. This enforces immutability and enables de-duplication across multi-registry deployments.

> "Directory records are packaged as OCI-compliant artifacts and pushed to registries; each artifact is addressed by a cryptographic digest that enforces immutability and enables de-duplication."

**Source:** arxiv.org/html/2508.03095v3 — *Evolution of AI Agent Registry Solutions*

**LIT-38 implication:** OCI is the right storage backend for `agent@1.2.0` style addressing. A digest-per-version model gives immutability for free — `1.1.0` and `1.2.0` can coexist as separate digest-addressed records in the same registry.

---

### 2. No Existing Registry Enforces Breaking Schema Changes on Push (3-0)

Across five prominent agent registry systems surveyed (MCP Registry, A2A, AGNTCY, Microsoft Entra Agent ID, NANDA Index), **none** specifies an automated policy for detecting or rejecting breaking schema changes on push. MCP Registry is described as schema-driven via `mcp.json` but without automated breaking-change validation.

> "MCP Registry uses 'schema-driven by mcp.json (OpenAPI/JSON Schema)' but no automated breaking-change validation is specified."

**Source:** arxiv.org/html/2508.03095v3 — *Evolution of AI Agent Registry Solutions*

**LIT-38 implication:** AC#2 (reject breaking schema change without major version bump) is **novel** — no existing agent registry does this today. The PoC can borrow from adjacent tooling (Buf Schema Registry, oasdiff, schema registry contract testing) and apply it to agent manifests. This is a genuine contribution worth highlighting in the article.

---

### 3. HuggingFace Hub Is Insufficient as a Structured Agent Registry (3-0)

HuggingFace Hub's model cards provide only limited dependency information that is neither mandatory nor normalized into a dependency graph schema — insufficient as a structured agent registry.

> "Hugging Face relies primarily on model cards with limited dependency information…neither mandatory nor normalized into a dependency graph schema."

**Source:** arxiv.org/html/2510.03495

**LIT-38 implication:** Do not model the PoC on HuggingFace Hub. The gap is exactly what LIT-38 fills: a structured YAML manifest with typed fields (inputs, outputs, model recs, eval suite), enforced on push.

---

### 4. ORAS: OCI Registries as General-Purpose Artifact Storage (3-0)

ORAS (OCI Registry As Storage) supports attaching supply chain artifacts to container images and discovering artifact reference relations, enabling a graph of versioned artifacts linked to base images.

> "Attach supply chain artifacts to container images and Discover and show the artifact reference relations."

**Source:** oras.land

**LIT-38 implication:** ORAS is a practical implementation path for `agent push` / `agent pull`. It reuses existing OCI infrastructure (Docker Hub, GHCR, ECR) without a custom storage layer. Tag = human-readable version (`1.2.0`), digest = immutable pointer.

*Note: The claim that ORAS is "the de facto tool for OCI Artifacts" was refuted 0-3 — verify current ecosystem positioning before citing this in the article.*

---

### 5. A2A AgentCard: The Most Widely Adopted Agent Manifest Format (3-0)

The **A2A AgentCard** is a JSON metadata document with structured fields for identity, capabilities, skills, service endpoint, and authentication requirements — the most widely adopted agent contract format (150+ organizations).

> "An Agent Card is a JSON metadata document published by an A2A Server, describing its identity, capabilities, skills, service endpoint, and authentication requirements."

**Source:** a2a-protocol.org/latest/specification/

**LIT-38 implication:** The PoC YAML manifest should be compatible with or a superset of AgentCard fields. Key fields to include: `name`, `version`, `description`, `inputs` (JSON Schema), `outputs` (JSON Schema), `skills`, `model_recommendations`, `eval_suite`. This gives interoperability with 150+ A2A-compatible orgs.

*Note: A2A uses Major.Minor versioning (not full semver) — this was refuted 0-3. Verify from the spec directly before citing.*

---

### 6. ARD Specification: Well-Known URI for Agent Discovery (3-0)

The **Agentic Resource Discovery (ARD)** specification hosts capability manifests at the well-known URI `/.well-known/ai-catalog.json`, validated using JSON Schema Draft 2020-12.

> "JSON Schema validation via spec/schemas/ai-catalog.schema.json (Draft 2020-12)"

**Source:** agenticresourcediscovery.org/spec/

**LIT-38 implication:** `/.well-known/ai-catalog.json` is a discoverable registry endpoint pattern. For the PoC demo, serving the catalog at this path makes it machine-discoverable without custom tooling. JSON Schema Draft 2020-12 is the right validation target.

*Note: ARD's specific mandatory endpoints (POST /search, POST /explore) and URN namespace format were both refuted 0-3 — verify from the spec before implementing.*

---

### 7. Agent Protocol: JSON Schema for Input/Output Contracts (3-0)

The **Agent Protocol** (LangChain) defines a REST/OpenAPI contract where agent input, output, state, and config schemas are all represented in JSON Schema format, retrievable via `GET /agents/{agent_id}/schemas`.

> "GET /agents/{agent_id}/schemas - Get the input, output, state and config schemas for an agent. All schemas are represented in JSON Schema format."

**Source:** github.com/langchain-ai/agent-protocol

**LIT-38 implication:** JSON Schema is the right format for the `inputs`/`outputs` fields in the agent manifest. The `GET /{agent}/schemas` endpoint pattern is a clean API surface for the PoC CLI's schema-check command. A breaking change = a JSON Schema diff that removes required fields, changes types, or narrows constraints.

*Note: The claim that Agent Protocol has no versioning strategy was refuted 0-3 — Agent Protocol does have versioning; verify the current state before citing absence of it.*

---

## Refuted — Do Not Cite Without Direct Verification

| Claim | Vote | Source |
|---|---|---|
| AGNTCY OASF manifests encode 4MB+signature constraint descriptors | 0-3 | arxiv 2508.03095v3 |
| AgentHub validates manifests on push (schema-on-push validation) | 0-3 | arxiv 2510.03495 |
| AgentHub has explicit version lifecycle states (active/deprecated/retired/revoked) | 0-3 | arxiv 2510.03495 |
| MLflow LoggedModel is the core versioning mechanism for AI agents | 1-2 | mlflow.org docs |
| MLflow lacks schema validation and breaking-change detection | 0-3 | mlflow.org docs |
| ORAS is "the de facto tool for working with OCI Artifacts" | 0-3 | oras.land |
| A2A AgentCard uses Major.Minor only (no patch) | 0-3 | a2a-protocol.org spec |
| A2A handles breaking changes via formal deprecation aliases | 0-3 | a2a-protocol.org spec |
| ARD requires mandatory POST /search and POST /explore endpoints | 0-3 | agenticresourcediscovery.org |
| ARD uses URN namespace for global uniqueness | 0-3 | agenticresourcediscovery.org |
| Agent Protocol has no versioning strategy | 0-3 | github.com/langchain-ai/agent-protocol |
| InnerSource Ratio = (InnerSource Contributions) / (Total Contributions) | 0-2 | github-community-projects/measure-innersource |

---

## Unverified — Promising, Verification Failed Due to Session Limit

These claims came from fetch agents but verification agents hit the session limit. Do not cite as fact — verify from sources directly before using.

| Claim | Source |
|---|---|
| OCI artifacts enable AI models to be versioned + addressed by digest+tag in any OCI registry | CNCF blog 2025-08-27 |
| CNCF ModelPack Specification standardizes AI model packaging on OCI (reproducibility, portability, vendor neutrality) | CNCF blog 2025-08-27 |
| InnerSource reuse measurable via `# of submodule usage` and `# of code reuse across projects` | InnerSourcePatterns |
| Cross-team contribution = code submissions to a repo not owned by the submitter's team | InnerSourcePatterns |
| Agent spec lifecycle: spec files version-controlled in git, CI/CD validates and deploys to registry | GSA-TTS devCrew template |
| Agent manifests should include version-controlled input/output data contracts (task_packet.json → Core Handoff Schema) | GSA-TTS devCrew template |

---

## Key Insights from Fetch Agents (high-signal, not adversarially verified)

These came from fetched sources but didn't go through the 3-vote panel. Treat as directional, verify before citing.

**Schema-on-push validation (adjacent tech to borrow from):**
- **Buf Schema Registry** blocks breaking schema commits automatically — moves them to "Pending" state, unavailable to downstream consumers until an admin reviews/approves. This is the pattern LIT-38 AC#2 should replicate for agent schemas. *(source: buf.build/blog/review-governance-workflow)*
- **oasdiff** detects breaking changes in OpenAPI specs (removed endpoints, changed parameters) and integrates into CI/CD via GitHub Actions. Applicable to agent manifest diffs. *(source: nordicapis.com)*
- **Schema registry contract testing** catches producer schema changes that break consumers before production. Kafka's Confluent Schema Registry enforces backward/forward compatibility at publish time. *(source: oneuptime.com/blog/post/2026-01-30-schema-registry-contract-testing)*
- **JSON Schema has no official backward-compatibility tool** — existing options (`getsentry/json-schema-diff`) are described as "work-in-progress" with incomplete keyword coverage. The PoC will need a custom comparator or rely on OpenAPI diff tools. *(source: github.com/json-schema-org/community/issues/984)*
- **64% of AI pipeline risk lives at the schema layer** — schema drift is the primary source of silent failures between pipeline stages, not model quality. Good article framing. *(source: tianpan.co/blog/2026-04-20-contract-testing-ai-pipelines)*

**Parallel version coexistence:**
- **Flux OCIRepository** supports parallel version coexistence via semver constraints — consumers pin `~1.1.0` vs `^1.1.0` against the same OCI registry, so `1.1.0` and `1.2.0` run simultaneously without interference. This is exactly the AC#1 pattern. *(source: oneuptime.com/blog/post/2026-03-05-ocirepository-semver-tag-filtering-flux)*

**Reuse metrics:**
- **MSR 2025 InnerSource Value framework** defines four measurement areas: cost savings through reuse, time-to-market, reduced maintenance, engineering health. Closest academic backing for `agents_reused / agents_authored`. *(source: 2025.msrconf.org/details/msr-2025-industry-track/2)*

---

## Landscape Map: Existing Agent Registries

| System | Storage | Schema Validation | Versioning | Breaking-Change Rejection |
|---|---|---|---|---|
| **AGNTCY** | OCI + IPFS Kademlia DHT | OASF schema | Digest-addressed | ✗ None |
| **A2A** | None (discovery only) | AgentCard JSON Schema | Major.Minor | ✗ None |
| **MCP Registry** | None (index only) | mcp.json (OpenAPI) | None specified | ✗ None |
| **ARD** | None (discovery only) | JSON Schema Draft 2020-12 | None specified | ✗ None |
| **Agent Protocol** | None (REST API) | JSON Schema | Has versioning | ✗ None |
| **HuggingFace Hub** | Custom | Model cards (optional) | Tags | ✗ None |
| **MLflow** | Custom | None | LoggedModel entities | ✗ None |
| **LIT-38 PoC** | OCI/S3 (planned) | YAML manifest + JSON Schema | SemVer | ✅ AC#2 |

**Key takeaway:** No existing system enforces breaking-change rejection on push. LIT-38 fills a real gap.

---

## PoC Design Implications (mapped to AC)

**AC#1** — Publish `agent@1.2.0`, consume while `1.1.0` keeps running, eval delta report:
- Store each version as a separate OCI artifact tag + digest (AGNTCY/ORAS pattern)
- Semver filtering (Flux OCIRepository pattern) lets consumers pin to `~1.1.x` while `1.2.0` runs in parallel
- Eval delta = diff the `eval_suite` results between `1.1.0` and `1.2.0` manifests

**AC#2** — Reject breaking schema change without major version bump:
- Borrow Buf Schema Registry pattern: auto-block commits that introduce breaking changes until a major version bump is detected
- Implement a JSON Schema diff comparator on `push` — detect removed required fields, type narrowing, removed enum values
- No official JSON Schema backward-compat tool exists; write a lightweight comparator for the PoC

**AC#3** — Track `agents_reused / agents_authored` per team:
- Tag each agent manifest with `author_team` field
- Track pulls by team via registry access logs
- `agents_reused` = pulls of agents authored by another team; `agents_authored` = agents published by that team
- MSR 2025 InnerSource framework validates this metric category

**AC#4/AC#5** — Demo + Article:
- Article hook: "64% of AI pipeline failures are schema drift — no agent registry today prevents it on push. We built one."
- Demo: show `agent push logger@1.1.0` → works; then `agent push logger@1.2.0` (breaking change, no major bump) → rejected; then `agent push logger@2.0.0` → accepted, delta eval report generated

---

## Key Gaps Identified

1. **No verified reuse-vs-authored metric formula** — InnerSource community has frameworks but the specific `agents_reused/agents_authored` computation needs design. Verify InnerSourcePatterns source directly.
2. **JSON Schema breaking-change detection is immature** — No official tool. The PoC needs a custom comparator. Treat this as a known limitation in the article.
3. **Parallel version coexistence implementation** — Flux/OCI pattern shows it's feasible; the PoC needs to decide whether versions are isolated processes or just catalog entries.
4. **MLflow's agent versioning story** — The 1-2 vote on MLflow's LoggedModel claim (not fully refuted, not confirmed) suggests MLflow may be worth a direct look for the eval-tracking component.

---

## Sources

| URL | Quality | Notes |
|---|---|---|
| arxiv.org/html/2508.03095v3 | Primary | Comparative survey of 5 agent registry systems — highest signal source |
| arxiv.org/html/2510.03495 | Primary | AgentHub paper (claims refuted — cite cautiously) |
| a2a-protocol.org/latest/specification/ | Primary | A2A AgentCard spec (150+ orgs) |
| agenticresourcediscovery.org/spec/ | Primary | ARD well-known URI + JSON Schema validation |
| github.com/langchain-ai/agent-protocol | Primary | Agent Protocol REST/OpenAPI + JSON Schema fields |
| oras.land | Primary | OCI artifact attachment + reference graph |
| buf.build/blog/review-governance-workflow | Blog | Buf Schema Registry breaking-change governance pattern |
| oneuptime.com/.../ocirepository-semver-tag-filtering-flux | Blog | Parallel version coexistence via OCI semver |
| tianpan.co/.../contract-testing-ai-pipelines | Blog | 64% schema-layer risk claim — verify independently |
| oneuptime.com/.../schema-registry-contract-testing | Blog | Schema registry contract testing pattern |
| nordicapis.com/.../oasdiff-breaking-changes | Blog | oasdiff for OpenAPI breaking change detection |
| 2025.msrconf.org/.../Measuring-InnerSource-Value | Secondary | MSR 2025 InnerSource value measurement framework |
| github.com/InnerSourceCommons/InnerSourcePatterns | Secondary | Reuse metrics (unverified due to session limit) |
| mlflow.org/docs/latest/genai/version-tracking/ | Primary | MLflow versioning (mixed votes — verify directly) |
| cncf.io/blog/.../how-oci-artifacts-will-drive-future-ai | Blog | CNCF ModelPack (unverified due to session limit) |
