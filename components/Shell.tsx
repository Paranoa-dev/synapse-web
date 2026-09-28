"use client";
import { useState, useEffect, useRef } from "react";
import { DashboardTab } from "./dashboard/DashboardTab";
import { TransactionsTab } from "./transactions/TransactionsTab";
import { AdminTab } from "./admin/AdminTab";
import { DocsTab } from "./docs/DocsTab";
import { TabErrorBoundary } from "@/components/ui/TabErrorBoundary";
import { AMBER, BG1, BORDER, DIM, MONO, STATUS_META } from "@/lib/constants";
import { useSorobanStatus } from "@/lib/soroban/useSorobanStatus";
import { useWallet } from "@/lib/wallet/WalletProvider";
import { useToast } from "@/components/ui/Toast";
import { shortId } from "@/lib/utils";
import { resolveActiveTab, visibleTabs, type FlagKey } from "@/lib/flags/definitions";
import { useFlag, useFlags } from "@/lib/flags/FlagProvider";

type Tab = "dashboard" | "transactions" | "admin" | "docs";
const TABS: Tab[] = ["dashboard", "transactions", "admin", "docs"];

export function Shell() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const { status: rpcStatus, lastEventAge, health: rpcHealth } = useSorobanStatus();
  const { address, connecting, error, connect, disconnect } = useWallet();

  // Feature flags. `isEnabled` is read during the first render, before the
  // remote config has arrived, so it resolves to the registry default — which
  // is the safe direction and identical on server and client, so there is no
  // hydration mismatch. The remote config lands in an effect one tick later.
  const {
    status: flagStatus,
    source: flagSource,
    stale: flagStale,
    lastError: flagError,
  } = useFlags();
  const adminEnabled = useFlag("tab.admin");
  const docsEnabled = useFlag("tab.docs");
  const isFlagEnabled = (key: FlagKey) =>
    key === "tab.admin" ? adminEnabled : key === "tab.docs" ? docsEnabled : true;

  // A tab can be switched off remotely *while it is open*, so the active tab is
  // re-validated against the visible set on every render rather than only on
  // click. Without this, disabling `tab.admin` from the flag console would
  // blank the content area for anyone currently looking at it.
  const shownTabs = visibleTabs(TABS, isFlagEnabled);
  const activeTab = resolveActiveTab(TABS, tab, isFlagEnabled);
  const connected = address !== null;
  const { toast } = useToast();

  useEffect(() => {
    if (error) toast(error, "error");
  }, [error, toast]);

  const prevAddress = useRef<string | null>(null);
  useEffect(() => {
    if (address && !prevAddress.current) {
      toast(`Wallet connected: ${shortId(address)}`, "success");
    }
    prevAddress.current = address;
  }, [address, toast]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* ── Header ── */}
      <header className="shell-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.14em", color: "#fff" }}>
            SYNAPSE
          </span>
          <span
            aria-hidden="true"
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: AMBER,
              display: "inline-block",
              boxShadow: `0 0 8px 2px rgba(245,166,35,0.55)`,
            }}
          />
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.14em", color: "#fff" }}>
            CORE
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span
            style={{
              fontSize: 9,
              color: DIM,
              letterSpacing: "0.14em",
              padding: "3px 10px",
              border: `1px solid ${BORDER}`,
            }}
          >
            TESTNET
          </span>
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: connected ? STATUS_META.COMPLETED.color : "#444",
              display: "inline-block",
              boxShadow: connected ? `0 0 6px 2px ${STATUS_META.COMPLETED.glow}` : "none",
              transition: "all 0.3s",
            }}
          />
          <button
            onClick={() => (connected ? disconnect() : connect())}
            disabled={connecting}
            style={{
              padding: "7px 18px",
              background: connected ? "transparent" : "rgba(245,166,35,0.08)",
              border: `1px solid ${connected ? BORDER : AMBER}`,
              color: connected ? "#aaa" : AMBER,
              fontFamily: MONO,
              fontSize: 11,
              fontWeight: 600,
              cursor: connecting ? "wait" : "pointer",
              letterSpacing: "0.06em",
              transition: "all 0.2s",
              opacity: connecting ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!connected) e.currentTarget.style.background = "rgba(245,166,35,0.16)";
            }}
            onMouseLeave={(e) => {
              if (!connected) e.currentTarget.style.background = "rgba(245,166,35,0.08)";
            }}
          >
            {connecting ? "connecting…" : connected ? shortId(address) : "connect wallet"}
          </button>
        </div>
      </header>

      {/* ── Tab Bar ── */}
      <nav className="shell-nav" role="tablist" aria-label="Sections">
        {shownTabs.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={activeTab === t}
            onClick={() => setTab(t)}
            style={{
              padding: "12px 22px",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.1em",
              color: activeTab === t ? "#fff" : DIM,
              borderBottom: activeTab === t ? `2px solid ${AMBER}` : "2px solid transparent",
              marginBottom: -1,
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => {
              if (activeTab !== t) e.currentTarget.style.color = "rgba(255,255,255,0.65)";
            }}
            onMouseLeave={(e) => {
              if (tab !== t) e.currentTarget.style.color = DIM;
            }}
          >
            {t}
          </button>
        ))}
      </nav>

      {/* ── Body ── */}
      <main className="shell-main">
        {activeTab === "dashboard" && (
          <TabErrorBoundary title="Dashboard tab error">
            <DashboardTab />
          </TabErrorBoundary>
        )}
        {activeTab === "transactions" && (
          <TabErrorBoundary title="Transactions tab error">
            <TransactionsTab />
          </TabErrorBoundary>
        )}
        {adminEnabled && activeTab === "admin" && (
          <TabErrorBoundary title="Admin tab error">
            <AdminTab />
          </TabErrorBoundary>
        )}
        {docsEnabled && activeTab === "docs" && (
          <TabErrorBoundary title="Docs tab error">
            <DocsTab />
          </TabErrorBoundary>
        )}
      </main>

      {/* ── Footer ── */}
      <footer
        style={{
          borderTop: `1px solid ${BORDER}`,
          padding: "10px 28px",
          display: "flex",
          justifyContent: "space-between",
          background: BG1,
        }}
      >
        <span style={{ fontSize: 9, color: DIM, letterSpacing: "0.1em" }}>
          SYNAPSE CORE · v0.1.0 · TESTNET
        </span>
        <span style={{ fontSize: 9, letterSpacing: "0.1em" }}>
          {/*
            Flag source indicator. Normally invisible-ish; it only draws
            attention when the flag config could not be loaded and the app is
            running on registry defaults, which is the one flag state worth
            noticing at a glance.
          */}
          {flagStatus === "loading"
            ? "FLAGS: loading"
            : flagSource === "remote"
              ? ""
              : `FLAGS: ${flagSource === "cache" ? "cached" : "defaults"}${flagStale ? " (stale)" : ""}${
                  flagError ? ` · ${flagError}` : ""
                }`}
        </span>
        <span
          style={{
            fontSize: 9,
            letterSpacing: "0.1em",
            color:
              rpcStatus === "connected"
                ? STATUS_META.COMPLETED.color
                : rpcStatus === "error"
                  ? STATUS_META.FAILED.color
                  : DIM,
          }}
        >
          ⬡ SOROBAN RPC:{" "}
          {rpcStatus === "connected"
            ? `connected${lastEventAge ? ` · last event ${lastEventAge}` : ""}`
            : rpcStatus === "error"
              ? `error${rpcHealth.error ? `: ${rpcHealth.error}` : ""}`
              : "connecting"}
        </span>
      </footer>
    </div>
  );
}
