---
title: First Principles Engineering
publish: true
---

<div class="fpe-hero">

# First Principles Engineering

<p class="fpe-hero-byline"><strong><a href="about">Sandeep Chauhan</a></strong><span class="fpe-hero-bullet"> · </span><span class="fpe-hero-role">Senior Software Engineer @ LinkedIn</span></p>

<p>Writing about Distributed Systems, System Design, Staff Engineering, Algorithms and AI — built from the ground up, not from buzzwords. Curated notes I'm willing to be wrong about in public.</p>

<p class="fpe-hero-cta"><a class="fpe-hero-link" href="about">About this site<span aria-hidden="true"> →</span></a></p>

</div>

## Featured

<div class="fpe-featured-grid">

<a class="fpe-article-card" href="01-Fundamentals/05-AI-ML/04-RAG-Architecture">
  <span class="article-eyebrow">AI</span>
  <span class="article-title">RAG Architecture</span>
  <span class="article-desc">The most-deployed LLM pattern in production is mostly a retrieval system with a model bolted on — not the other way around.</span>
</a>

<a class="fpe-article-card" href="01-Fundamentals/02-Databases/01-Fundamentals/06-MVCC">
  <span class="article-eyebrow">Databases</span>
  <span class="article-title">MVCC</span>
  <span class="article-desc">Uber's 2016 migration from Postgres to MySQL forced the community to reckon with what "multi-version" actually costs in practice.</span>
</a>

<a class="fpe-article-card" href="01-Fundamentals/01-Concepts/01-Distributed-Systems/03-Consensus-Algorithm">
  <span class="article-eyebrow">Distributed Systems</span>
  <span class="article-title">Consensus Algorithms</span>
  <span class="article-desc">Paxos, Raft, and why Lamport spent eight years arguing about Greek allegory before "Paxos Made Simple" finally shipped.</span>
</a>

<a class="fpe-article-card" href="01-Fundamentals/01-Concepts/04-Caching/02-Consistent-Hashing">
  <span class="article-eyebrow">Caching</span>
  <span class="article-title">Consistent Hashing</span>
  <span class="article-desc">The textbook ring is a classroom curiosity. Virtual nodes are what makes it work in production — and most explanations skip them.</span>
</a>

<a class="fpe-article-card" href="01-Fundamentals/01-Concepts/01-Distributed-Systems/02-Logical-Clocks">
  <span class="article-eyebrow">Distributed Systems</span>
  <span class="article-title">Logical Clocks</span>
  <span class="article-desc">Lamport imported special relativity into distributed systems because physical timestamps quietly lie under clock skew.</span>
</a>

<a class="fpe-article-card" href="01-Fundamentals/01-Concepts/01-Distributed-Systems/05-Distributed-Transactions">
  <span class="article-eyebrow">Distributed Systems</span>
  <span class="article-title">Distributed Transactions</span>
  <span class="article-desc">Two-phase commit, Jim Gray's disappearance, and the cruel irony of a community that couldn't coordinate finding its own founder.</span>
</a>

<a class="fpe-article-card" href="01-Fundamentals/01-Concepts/02-Architecture/02-Event-Sourcing-CQRS">
  <span class="article-eyebrow">Architecture</span>
  <span class="article-title">Event Sourcing & CQRS</span>
  <span class="article-desc">Double-entry bookkeeping from 1494, now sold back as blockchain. The pattern is older than computers.</span>
</a>

<a class="fpe-article-card" href="01-Fundamentals/01-Concepts/03-Data/02-Change-Data-Capture">
  <span class="article-eyebrow">Data</span>
  <span class="article-title">Change Data Capture</span>
  <span class="article-desc">Why dual writes always drift. CDC reframes the database write-ahead log as the source of truth — not an implementation detail.</span>
</a>

<a class="fpe-article-card" href="01-Fundamentals/01-Concepts/05-API/04-gRPC-RPC">
  <span class="article-eyebrow">API</span>
  <span class="article-title">gRPC vs REST</span>
  <span class="article-desc">REST works until JSON parse cost dominates your CPU bill and bolted-on WebSockets become load-bearing. Then it doesn't.</span>
</a>

</div>

## Reading Series

<div class="fpe-learning-paths">

<a class="fpe-path-card" href="01-Fundamentals/01-Concepts/01-Distributed-Systems/">
  <span class="path-title">Distributed Systems from First Principles</span>
  <span class="path-desc">Primitives → logical clocks → consensus → distributed locks → transactions → gossip → microservices. Read in dependency order.</span>
  <span class="path-count">7 articles</span>
</a>

<a class="fpe-path-card" href="01-Fundamentals/01-Concepts/02-Architecture/">
  <span class="path-title">Architecture & Patterns</span>
  <span class="path-desc">Choreography vs orchestration, event sourcing, fan-out, locking, strangler fig, BFF, multi-tenancy — and the failure modes each pattern exists to solve.</span>
  <span class="path-count">7 articles</span>
</a>

<a class="fpe-path-card" href="02-Series/production-systems-deep-dives">
  <span class="path-title">Production Systems Deep Dives</span>
  <span class="path-desc">Kafka, Redis, DynamoDB, Spanner, Zanzibar, Lakehouse — the design decisions that defined each system, not the marketing pages.</span>
  <span class="path-count">6 articles</span>
</a>

<a class="fpe-path-card" href="01-Fundamentals/02-Databases/01-Fundamentals/">
  <span class="path-title">Database Internals</span>
  <span class="path-desc">ACID foundations, CAP & PACELC, isolation levels, MVCC. The minimum mental model before debugging any data layer at 2 AM.</span>
  <span class="path-count">4 articles</span>
</a>

<a class="fpe-path-card" href="02-Series/apis-and-networking">
  <span class="path-title">APIs & Networking</span>
  <span class="path-desc">TCP/UDP/QUIC up through API design, gateways, GraphQL, gRPC. The stack read bottom-up so trade-offs compose instead of fighting.</span>
  <span class="path-count">5 articles</span>
</a>

<a class="fpe-path-card" href="01-Fundamentals/05-AI-ML/">
  <span class="path-title">AI Systems in Production</span>
  <span class="path-desc">RAG architecture, ML system design, model serving. The production view, not the model view — where the latency, cost, and quality actually live.</span>
  <span class="path-count">3 articles</span>
</a>

</div>

## How to browse

- **Reading Series** above — each is curated in dependency order. Start with whichever pulls you in.
- **Search** in the toolbar (⌘K / Ctrl+K) — fastest way to a specific concept.
- **Explorer** on the left — the full tree if you want to browse loose.

> [!note]
> This is a **curated slice** of my private notebook. Many drafts and half-formed ideas stay unpublished by design. If a published note is wrong or unclear, [open an issue](https://github.com/chauhansandeep/firstprinciplesengineering).
