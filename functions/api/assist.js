/* functions/api/assist.js — Field Assist v1 (structured, deterministic) */
export async function onRequestPost({ request }) {
  let body = {};
  try { body = await request.json(); } catch {}

  const mode = String(body.mode || "");
  const field = String(body.field || "");

  if (!mode || !field) {
    return new Response(JSON.stringify({ error: "Missing mode or field" }), {
      status: 400,
      headers: { "content-type": "application/json" }
    });
  }

  const help = {
    story: {
      explanation: "Briefly describe what changed or what isn’t working. Stick to observable facts and patterns. Avoid insults; keep it court-appropriate.",
      options: [
        "Missed or delayed exchanges",
        "Repeated last-minute schedule changes",
        "Communication breakdown affecting the child",
        "New child needs (school, health, therapy)"
      ],
      drafts: [
        "Over the past [time period], the current arrangement has not been workable because [facts]. Examples include [example 1] and [example 2]. This has affected the child by [impact].",
        "Since [date], there have been repeated issues with [issue]. I am asking the court for clear, stable orders that support the child’s routine and reduce conflict."
      ]
    },
    child_impact: {
      explanation: "Explain how this affects the child’s routine, stability, school, health, or emotional wellbeing. Concrete examples help.",
      options: [
        "Stress/anxiety around exchanges",
        "Sleep or school disruption",
        "Loss of routine/consistency",
        "Missed activities or appointments"
      ],
      drafts: [
        "These issues have affected the child by [impact], including [example]. A more consistent schedule would reduce disruption and support stability.",
        "The child’s routine has been disrupted by [facts]. The requested order would improve consistency and reduce conflict."
      ]
    },
    schedule_detail: {
      explanation: "Describe the schedule you want in practical terms: days, times, exchanges, holidays, and how it reduces confusion.",
      options: [
        "Weekday schedule + alternating weekends",
        "School-based exchanges (pickup/drop-off at school)",
        "Holiday split with clear times",
        "Make-up time within 7 days"
      ],
      drafts: [
        "I request a parenting schedule that provides consistency: [days/times]. Exchanges should occur at [location] to reduce conflict.",
        "I request orders clarifying the schedule and exchange logistics so the child has a predictable routine and transitions are neutral."
      ]
    },
    other_orders: {
      explanation: "List any other orders you want the court to make (communication rules, exchange location, travel notice, decision-making, etc.).",
      options: [
        "Communication through a parenting app only",
        "Exchanges at school or a neutral location",
        "Travel notice requirements; international travel only by agreement/court order",
        "No messages through the child"
      ],
      drafts: [
        "I request orders that communication occur through [method], that exchanges occur at [location], and that neither parent use the child to relay messages.",
        "I request clear travel notice requirements and structured communication rules to reduce conflict and protect the child’s routine."
      ]
    },
    urgency: {
      explanation: "Explain why timing matters: upcoming changes, safety concerns, or repeated interference that makes delay harmful.",
      options: [
        "Withheld time or repeated cancellations",
        "Upcoming school or childcare change",
        "Relocation/travel issue",
        "Safety or instability concern"
      ],
      drafts: [
        "This matter is time-sensitive because [reason]. I am requesting orders on an expedited timeline to prevent further disruption to the child’s routine.",
        "Recent events since [date] have increased instability. Prompt clarification by the court would reduce ongoing disruption."
      ]
    }
  };

  const out = help[field] || {
    explanation: "Write what you know in plain language. Keep it factual, specific, and (when possible) connected to child impact.",
    options: ["Be specific", "Stick to facts", "Tie to child stability"],
    drafts: ["I am requesting [order] because [facts]. This is in the child’s best interest because [impact]."]
  };

  const resp =
    mode === "explain" ? { explanation: out.explanation } :
    mode === "options" ? { options: out.options } :
    mode === "draft" ? { drafts: out.drafts } :
    { explanation: out.explanation };

  return new Response(JSON.stringify(resp), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}
