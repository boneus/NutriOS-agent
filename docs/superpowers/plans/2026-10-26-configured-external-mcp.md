# Configured External MCP Servers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect markdown-health, filesystem, weather, and optional Notion MCP servers through one declarative registry.

**Architecture:** A focused MCP manager converts enabled config entries to `MCPServerStdio` instances, connects them, indexes their unchanged tools by source, and exposes phase-filtered server lists. The harness remains server-agnostic and retains reviewer-gated writes.

**Tech Stack:** TypeScript, Next.js, OpenAI Agents SDK, MCP stdio, npm/npx.

**Spec:** `docs/superpowers/specs/2026-10-26-configured-external-mcp-design.md`

## Global Constraints

- Do not add tests or use TDD.
- Do not commit the result.
- Do not add per-server wrappers or grant filesystem access above `data/` and `plans/`.
- Preserve all safety, trace, replay, and eval invariants.

## Tasks

- [ ] Add `src/mcp/servers.config.ts` with all four process declarations and sandbox paths.
- [ ] Replace the single-server client factory with a generic lifecycle/source manager and annotation-based phase filtering.
- [ ] Update the harness, inspector, UI source labels, and compact trace names to use server-prefixed sources.
- [ ] Add coach prompt v4, location data, plans directory, and finalizer instructions for requested external writes.
- [ ] Document packages, authorization, guardrails, demos, and suggested MCP integrations in README.
- [ ] Verify real stdio discovery/calls and run `mcp:inspect`, `typecheck`, and `build` without model-backed eval/replay.

## Review Focus

- Notion absent token: omitted silently.
- Config `enabled: false`: process and tools disappear without harness edits.
- Duplicate MCP tool names: fail clearly rather than misattribute traces.
- Failed partial startup: already-connected processes close.
- Rejected plan: no external write-capable tool has been exposed.
