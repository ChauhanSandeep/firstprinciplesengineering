---
title: First Principles Engineering
publish: true
description: >-
  Curated engineering notes from Sandeep Chauhan — distributed systems,
  system design, AI systems, and the trade-offs that only become obvious
  in production. Built from the ground up, not from buzzwords.
---

<div class="fpe-hero">

# First Principles Engineering

<p class="fpe-hero-byline"><strong><a href="about">Sandeep Chauhan</a></strong><span class="fpe-hero-bullet"> · </span><span class="fpe-hero-role">Senior Software Engineer @ LinkedIn</span></p>

<p>Writing about Distributed Systems, System Design, Staff Engineering, Algorithms and AI — built from the ground up, not from buzzwords. Curated notes I'm willing to be wrong about in public.</p>

<p class="fpe-hero-cta"><a class="fpe-hero-link" href="#start-with-a-roadmap">Start with a roadmap<span aria-hidden="true"> →</span></a></p>

</div>

## Start with a roadmap

<div class="fpe-roadmap-grid">

<a class="fpe-roadmap-card" href="03-roadmaps/distributed-systems-roadmap">
  <span class="roadmap-eyebrow">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
    Roadmap
  </span>
  <span class="roadmap-title">Distributed Systems Roadmap</span>
  <span class="roadmap-desc">Build the mental model for coordination, consistency, partial failure, and the operational cost of making machines agree.</span>
  <span class="roadmap-status">Foundational path</span>
</a>

<a class="fpe-roadmap-card" href="03-roadmaps/system-design-roadmap">
  <span class="roadmap-eyebrow">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
    Roadmap
  </span>
  <span class="roadmap-title">System Design Roadmap</span>
  <span class="roadmap-desc">Learn how product requirements turn into APIs, storage, caching, messaging, reliability, and trade-offs that survive production.</span>
  <span class="roadmap-status">Interview + production path</span>
</a>

<a class="fpe-roadmap-card" href="03-roadmaps/ai-systems-roadmap">
  <span class="roadmap-eyebrow">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
    Roadmap
  </span>
  <span class="roadmap-title">AI Systems Roadmap</span>
  <span class="roadmap-desc">Understand the engineering around the model: data quality, retrieval, serving, evaluation, cost, latency, and observability.</span>
  <span class="roadmap-status">Growing roadmap</span>
</a>

<a class="fpe-roadmap-card" href="03-roadmaps/staff-engineer-roadmap">
  <span class="roadmap-eyebrow">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
    Roadmap
  </span>
  <span class="roadmap-title">Staff Engineer Roadmap</span>
  <span class="roadmap-desc">A breadth map for technical leadership: durable systems vocabulary, trade-off framing, migration judgment, and operational taste.</span>
  <span class="roadmap-status">Breadth map</span>
</a>

</div>

## Recommended Reads

<div class="fpe-featured-grid">

<a class="fpe-article-card" href="01-fundamentals/05-ai-ml/04-rag-architecture">
  <span class="article-eyebrow">AI Systems</span>
  <span class="article-title">RAG Architecture</span>
  <span class="article-desc">The most-deployed LLM pattern in production is mostly a retrieval system with a model bolted on — not the other way around.</span>
</a>

<a class="fpe-article-card" href="01-fundamentals/02-databases/01-fundamentals/06-mvcc">
  <span class="article-eyebrow">Databases</span>
  <span class="article-title">MVCC</span>
  <span class="article-desc">Uber's 2016 migration from Postgres to MySQL forced the community to reckon with what "multi-version" actually costs in practice.</span>
</a>

<a class="fpe-article-card" href="01-fundamentals/01-concepts/01-distributed-systems/03-consensus-algorithm">
  <span class="article-eyebrow">Distributed Systems</span>
  <span class="article-title">Consensus Algorithms</span>
  <span class="article-desc">Paxos, Raft, and why Lamport spent eight years arguing about Greek allegory before "Paxos Made Simple" finally shipped.</span>
</a>

<a class="fpe-article-card" href="01-fundamentals/01-concepts/04-caching/02-consistent-hashing">
  <span class="article-eyebrow">Caching</span>
  <span class="article-title">Consistent Hashing</span>
  <span class="article-desc">The textbook ring is a classroom curiosity. Virtual nodes are what makes it work in production — and most explanations skip them.</span>
</a>

<a class="fpe-article-card" href="01-fundamentals/01-concepts/01-distributed-systems/02-logical-clocks">
  <span class="article-eyebrow">Distributed Systems</span>
  <span class="article-title">Logical Clocks</span>
  <span class="article-desc">Lamport imported special relativity into distributed systems because physical timestamps quietly lie under clock skew.</span>
</a>

<a class="fpe-article-card" href="01-fundamentals/01-concepts/01-distributed-systems/05-distributed-transactions">
  <span class="article-eyebrow">Distributed Systems</span>
  <span class="article-title">Distributed Transactions</span>
  <span class="article-desc">Two-phase commit, Jim Gray's disappearance, and the cruel irony of a community that couldn't coordinate finding its own founder.</span>
</a>

<a class="fpe-article-card" href="01-fundamentals/01-concepts/03-data/02-change-data-capture">
  <span class="article-eyebrow">Data</span>
  <span class="article-title">Change Data Capture</span>
  <span class="article-desc">Why dual writes always drift. CDC reframes the database write-ahead log as the source of truth — not an implementation detail.</span>
</a>

<a class="fpe-article-card" href="01-fundamentals/01-concepts/05-api/04-grpc-rpc">
  <span class="article-eyebrow">APIs</span>
  <span class="article-title">gRPC vs REST</span>
  <span class="article-desc">REST works until JSON parse cost dominates your CPU bill and bolted-on WebSockets become load-bearing. Then it doesn't.</span>
</a>

</div>

## About this project

<div class="fpe-about-strip">
  <div class="about-strip-left">
    <span class="about-strip-eyebrow">Learning in public</span>
    <span class="about-strip-name">First Principles Engineering</span>
    <span class="about-strip-role">Curated notes from a larger private notebook</span>
  </div>
  <div class="about-strip-right">
    <p>Start with a roadmap when you want structure. Use search when you already know the concept. The exact reading series live inside roadmaps and article pages so the homepage stays focused.</p>
    <p><a class="about-strip-link" href="about">About this site →</a> · <a class="about-strip-link" href="index.xml">RSS feed →</a></p>
  </div>
</div>
