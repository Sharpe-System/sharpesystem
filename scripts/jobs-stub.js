// UI-only stub adapter for Dashboard.
// Canon: no globals, deterministic output, no backend assumptions.

export function getJobsStub() {
  return [
    {
      jobId: "abc123",
      flow: "rfo",
      form: "fl300",
      title: "Request for Order",
      caseNumber: "17D009277",
      county: "Orange",
      pageCount: 12,
      createdAt: "2026-02-25T10:30:00Z",
      downloadUrl: ""
    },
    {
      jobId: "def456",
      flow: "dvro",
      form: "dv100",
      title: "DVRO Packet",
      caseNumber: "22D000000",
      county: "Orange",
      pageCount: 8,
      createdAt: "2026-02-24T18:05:00Z"
    }
  ];
}
