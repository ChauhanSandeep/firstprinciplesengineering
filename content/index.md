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

## Learning paths

<div class="fpe-learning-paths">

<a class="fpe-path-card" href="01-Fundamentals/01-Concepts/01-Distributed-Systems/01-Distributed-Systems-Primitives">
  <span class="path-title">Distributed Systems</span>
  <span class="path-desc">Primitives, logical clocks, consensus, distributed locks, transactions, gossip, microservices boundaries.</span>
  <span class="path-count">7 articles</span>
</a>

<a class="fpe-path-card" href="01-Fundamentals/01-Concepts/02-Architecture/01-Choreography-Orchestration">
  <span class="path-title">Architecture & Patterns</span>
  <span class="path-desc">Choreography vs orchestration, event sourcing, fan-out strategies, strangler fig, BFF, multi-tenancy.</span>
  <span class="path-count">7 articles</span>
</a>

<a class="fpe-path-card" href="01-Fundamentals/01-Concepts/03-Data/01-Big-Data-Stream-Processing">
  <span class="path-title">Data & APIs</span>
  <span class="path-desc">Stream processing, change data capture, caching techniques, consistent hashing, API design, gRPC, GraphQL.</span>
  <span class="path-count">9 articles</span>
</a>

<a class="fpe-path-card" href="01-Fundamentals/01-Concepts/07-Operations/01-Observability">
  <span class="path-title">Operations & Security</span>
  <span class="path-desc">Observability, testing strategies, container internals, cryptographic primitives, authentication, authorization.</span>
  <span class="path-count">6 articles</span>
</a>

<a class="fpe-path-card" href="01-Fundamentals/05-AI-ML/04-RAG-Architecture">
  <span class="path-title">AI & ML Systems</span>
  <span class="path-desc">Retrieval-augmented generation, ML system design fundamentals, model serving — the production patterns behind the buzz.</span>
  <span class="path-count">3 articles</span>
</a>

<a class="fpe-path-card" href="01-Fundamentals/02-Databases/01-Fundamentals/06-MVCC">
  <span class="path-title">Databases & Storage</span>
  <span class="path-desc">CAP & PACELC, isolation levels, MVCC, Redis internals, DynamoDB, Kafka, Spanner, Zanzibar, lakehouse architecture.</span>
  <span class="path-count">12 articles</span>
</a>

</div>

## How to browse

- **Search** in the toolbar (⌘K / Ctrl+K) — fastest way to a specific concept.
- **Explorer** on the left — browse by topic.
- **Featured** above — opinionated entry points.

> [!note]
> This is a **curated slice** of my private notebook. Many drafts and half-formed ideas stay unpublished by design. If a published note is wrong or unclear, [open an issue](https://github.com/chauhansandeep/firstprinciplesengineering).
